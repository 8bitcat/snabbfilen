// 🖼️ VISNINGSMÖBLER – Carl 2026-10-12: "att man kan visa upp sina mobilskal om man byggt på dream land, att man får en
// dreamlandhylla hemma att sätta ut … så man kan visa sina skal … du kan också ge dem pokaler att ha hemma i hylla".
// Möbler som ritas i kod och visar ens EGNA saker:
//   mobilhylla   – mobilskalen man designat i BLING BLING (upp till sex, de senaste)
//   smyckestavla – egna halsband och pärlhalsband på sammet i guldram (upp till fyra)
//   vaskkrokar   – egna väskor på krokar (upp till fyra)
//   pokal        – guld, silver och brons (stora presenter, och tävlingarna längre fram)
//   trofeskap    – glasskåpet med de tolv senaste meriterna (pokaler, rosetter, medaljer, stjärnor – js/core/meriter.js);
//                  man får det gratis med sin första merit (game.js merit)
// Man får hyllan/tavlan/krokarna gratis första gången man köper en egen design av den sorten (shop-bling.js).
// Tekniken: spelets möbler ritas ur möbelarket (assets/interior.png + js/data/frames.js) på många ställen (rummet,
// Möblera, besök, förhandsvisningar). De nya möblerna ritas därför i en extra rad UNDER arket: ett utökat ark byggs
// (original + raden) och ATLAS (room.js) byter till det (src = dataURL). FRAMES får rutorna. Ändras designerna ritas
// raden om (visningUppdatera) – samma rutor, nytt innehåll.
import { FRAMES } from '../data/frames.js';
import { Pix, mix, mul } from './floor-pix.js';

export const VISNING = new Set(['mobilhylla', 'smyckestavla', 'vaskkrokar', 'pokal', 'trofeskap']);
const BAS_H = 443, RAD_H = 40;   // möbelarkets höjd och den extra raden
const RUTOR = { mobilhylla0: [0, BAS_H, 44, 26], smyckestavla0: [46, BAS_H, 34, 26], vaskkrokar0: [82, BAS_H, 40, 24], pokal0: [124, BAS_H + 8, 12, 18], pokal1: [138, BAS_H + 8, 12, 18], pokal2: [152, BAS_H + 8, 12, 18], trofeskap0: [168, BAS_H, 40, 38] };
Object.assign(FRAMES, RUTOR);

const hexInt = (h, fb) => (typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h) ? parseInt(h.slice(1), 16) : fb);
let G0 = null;   // spelet (main.js och shop-bling.js skickar det med visningUppdatera)
const designer = () => { try { const d = (G0 || window.SF?.game)?.designs; return Array.isArray(d) ? d : []; } catch { return []; } };
const meriter = () => { try { const m = (G0 || window.SF?.game)?.meriter; return Array.isArray(m) ? m : []; } catch { return []; } };
const GEM = { rosa: 0xf5a3c7, lila: 0xb07ae0, bla: 0x4f8ff0, gron: 0x3fbf7a, rod: 0xe8394f, vit: 0xf4fbff };
const KEDJA = { lader: 0x7a4a2a, silver: 0xd8dee6, sammet: 0x8e1f3c, regnbage: 0xe8394f, guld: 0xe8b84a, parlor: 0xf6f2ea };

// ---------- mobilskalshyllan: två hyllplan, tre mobiler på varje ----------
function ritaMobilhylla(P, x0, y0, skal) {
  const W = 44, H = 26, tra = 0xfff7f0, kant = 0xe8b84a, skugga = 0xd8c8c8;
  for (const hy of [12, 24]) { P.rect(x0, y0 + hy, W, 2, tra); P.hl(x0, y0 + hy, W, 0xffffff); P.hl(x0, y0 + hy + 1, W, kant); P.px(x0 + 2, y0 + hy + 2, skugga); P.px(x0 + W - 3, y0 + hy + 2, skugga); }
  P.vl(x0, y0, H, kant); P.vl(x0 + W - 1, y0, H, kant);   // sidorna
  skal.slice(0, 6).forEach((m, i) => {
    const rad = Math.floor(i / 3), x = x0 + 4 + (i % 3) * 13, y = y0 + 1 + rad * 12;
    const c = hexInt(m[0], 0xf07ab0), ljus = mix(c, 0xffffff, 0.45), mork = mul(c, 0.7);
    P.rect(x + 1, y, 6, 11, c); P.rect(x, y + 1, 8, 9, c); P.rect(x + 2, y + 2, 4, 7, ljus);   // skalet
    P.rect(x + 2, y + 2, 2, 2, 0x3a3a46);                                                     // kameran
    P.vl(x + 7, y + 1, 9, mork); P.hl(x + 1, y + 10, 6, mork);
    if (m[1]) P.px(x + 5, y + 6, hexInt(m[1], 0xffffff));                                    // berlockerna
    if (m[2]) P.px(x + 3, y + 8, hexInt(m[2], 0xffffff));
    if (m[3]) { const s = hexInt(m[3], 0xe8b84a); P.px(x + 4, y + 11, s); }                 // mobilbandet
  });
  if (!skal.length) for (let i = 0; i < 3; i++) { const x = x0 + 4 + i * 13; P.box(x + 1, y0 + 2, 6, 10, 0xe4dcdc); }   // tom hylla: konturer
}
// ---------- smyckestavlan: sammet i guldram, fyra halsband ----------
function ritaSmyckestavla(P, x0, y0, halsband) {
  const W = 34, H = 26;
  P.rect(x0, y0, W, H, 0xe8b84a); P.box(x0, y0, W, H, 0xb9862a); P.hl(x0 + 1, y0 + 1, W - 2, 0xfff0b0);
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) P.px(x0 + x, y0 + y, (x + y) % 9 === 0 ? 0x5a1830 : 0x6e1f3c);
  halsband.slice(0, 4).forEach((h, i) => {
    const cx = x0 + 9 + (i % 2) * 16, cy = y0 + 5 + Math.floor(i / 2) * 10;
    P.px(cx, cy - 1, 0xe8b84a);   // nålen
    for (let t = 0; t <= 10; t++) {
      const x = cx - 5 + t, y = cy + Math.round(4 * (1 - ((t - 5) / 5) ** 2));
      P.px(x, y, h.parlor ? hexInt(h.parlor[t % h.parlor.length], 0xffffff) : h.kedja);
    }
    if (h.sten != null) { P.rect(cx - 1, cy + 5, 2, 2, h.sten); P.px(cx - 1, cy + 5, 0xffffff); }
  });
  if (!halsband.length) for (const cx of [x0 + 9, x0 + 25]) for (let t = 0; t <= 10; t++) P.px(cx - 5 + t, y0 + 7 + Math.round(3 * (1 - ((t - 5) / 5) ** 2)), 0x8e4a62);
}
// ---------- väskkrokarna: en träribba med fyra krokar ----------
const VASKFORM = {   // 7 × 7: kasse med handtag, midjeväska, ryggsäck med ficka, axelväska med lock, nalleryggsäck med öron, handväska med bygel
  kasse: ['.#...#.', '.#...#.', '#######', '#######', '#######', '#######', '#######'],
  midje: ['.......', '.......', '#######', '#######', '.#####.', '.......', '.......'],
  rygg: ['.#####.', '#######', '#######', '#.###.#', '#.....#', '#######', '#######'],
  axel: ['.......', '#######', '#######', '###o###', '#######', '#######', '.......'],
  nalle: ['#.....#', '##...##', '#######', '#k###k#', '#######', '#######', '.#####.'],
  hand: ['..###..', '.#...#.', '#######', '#######', '###o###', '#######', '#######'],
};
function ritaVaskkrokar(P, x0, y0, vaskor) {
  const W = 40;
  P.rect(x0, y0, W, 3, 0x9a6a3a); P.hl(x0, y0, W, 0xc8905a); P.hl(x0, y0 + 2, W, 0x6a4422);
  for (let i = 0; i < 4; i++) { const x = x0 + 5 + i * 10; P.vl(x, y0 + 3, 2, 0xc8ccd6); P.px(x + 1, y0 + 5, 0xc8ccd6); }
  vaskor.slice(0, 4).forEach((v, i) => {
    const x = x0 + 2 + i * 10, y = y0 + 7, c = hexInt(v.farg, 0xf07ab0), form = VASKFORM[v.modell] || VASKFORM.hand;
    P.px(x + 3, y - 1, mul(c, 0.6)); P.px(x + 3, y, mul(c, 0.6));   // handtaget på kroken
    form.forEach((row, j) => [...row].forEach((ch, k) => {
      if (ch === '.') return;
      const p = ch === 'o' ? 0xf2c14e : ch === 'k' ? 0x2a1a18 : j === 0 || (j > 0 && form[j - 1][k] === '.') ? mix(c, 0xffffff, 0.3) : k === 6 || row[k + 1] === '.' ? mul(c, 0.72) : c;
      P.px(x + k, y + 1 + j, p);
    }));
  });
}
// ---------- pokalen ----------
function ritaPokal(P, x0, y0, sort) {
  const [c, ljus, mork] = [[0xf2c14e, 0xfff0a0, 0xb9862a], [0xc8d0da, 0xffffff, 0x8a929c], [0xc8823a, 0xf0b070, 0x8a5420]][sort] || [0xf2c14e, 0xfff0a0, 0xb9862a];
  for (let y = 0; y < 8; y++) { const w = 8 - Math.floor(y / 3); for (let x = 0; x < w; x++) P.px(x0 + 6 - Math.ceil(w / 2) + x, y0 + y, x === 0 ? ljus : x === w - 1 ? mork : c); }   // skålen
  P.hl(x0 + 2, y0, 8, ljus);
  P.px(x0 + 1, y0 + 2, c); P.px(x0, y0 + 3, c); P.px(x0 + 1, y0 + 4, c);     // handtagen
  P.px(x0 + 10, y0 + 2, mork); P.px(x0 + 11, y0 + 3, mork); P.px(x0 + 10, y0 + 4, mork);
  P.rect(x0 + 5, y0 + 8, 2, 4, c); P.px(x0 + 6, y0 + 9, mork);               // foten
  P.rect(x0 + 3, y0 + 12, 6, 2, c); P.hl(x0 + 3, y0 + 12, 6, ljus);
  P.rect(x0 + 2, y0 + 14, 8, 4, 0x4a2c18); P.hl(x0 + 2, y0 + 14, 8, 0x6e4426); P.rect(x0 + 4, y0 + 15, 4, 2, c);   // sockeln med plakett
  P.px(x0 + 4, y0 + 2, 0xffffff);
}

// ---------- troféskåpet: mörkt trä, sammet bakom glas, tre hyllplan med fyra meriter på varje ----------
const MER_FORM = {   // o = mitten (ljus), allt annat i meritens färg
  pokal: ['#######', '.#####.', '.#####.', '..###..', '...#...', '..###..', '.#####.'],
  rosett: ['.###.', '#####', '##o##', '#####', '.###.', '.#.#.', '#...#'],
  medalj: ['#...#', '.#.#.', '..#..', '.###.', '##o##', '#####', '.###.'],
  stjarna: ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'],
};
const METALL = [[0xf2c14e, 0xfff0a0, 0xb9862a], [0xc8d0da, 0xffffff, 0x8a929c], [0xc8823a, 0xf0b070, 0x8a5420]];
const ROSETT = [[0x3a6ad8, 0xf2c14e, 0x24448e], [0xd83a3a, 0xf2c14e, 0x8e2424], [0xf0c830, 0xffffff, 0xa8861c]];   // blå, röd, gul
const FORM_AV = { katt: 'pokal', hund: 'pokal', kanin: 'rosett', agility: 'medalj', bis: 'stjarna', hopp: 'rosett', kort: 'stjarna', mysterium: 'medalj', fiske: 'pokal' };
function ritaMerit(P, x, y, m) {
  const form = FORM_AV[m.typ] || 'pokal', rad = MER_FORM[form], p = Math.max(0, Math.min(2, (m.plats | 0) - 1));
  const [c, ljus, mork] = form === 'rosett' ? ROSETT[p] : form === 'stjarna' ? METALL[0] : METALL[p];
  const w = rad[0].length, dx = Math.floor((7 - w) / 2);
  rad.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch === '.') return;
    const band = form === 'medalj' && j < 3;   // medaljens band
    const col = ch === 'o' ? ljus : band ? (i < 2 ? 0x4a8de0 : 0x2a5aa8) : j === 0 || (j > 0 && rad[j - 1][i] === '.') ? ljus : i === w - 1 || r[i + 1] === '.' ? mork : c;
    P.px(x + dx + i, y + j, col);
  }));
}
function ritaTrofeskap(P, x0, y0, mer) {
  const W = 40, tra = 0x6e4426, ljus = 0x9a6a3a, mork = 0x3a2414;
  // krönet med en liten mässingsskylt
  P.rect(x0, y0, W, 3, tra); P.hl(x0, y0, W, ljus); P.hl(x0 + 1, y0 + 2, W - 2, mork);
  P.rect(x0 + 16, y0, 8, 2, 0xe8b84a); P.hl(x0 + 16, y0, 8, 0xfff0a0); P.px(x0 + 19, y0 + 1, 0xb9862a); P.px(x0 + 20, y0 + 1, 0xb9862a);
  // sidorna
  P.rect(x0, y0 + 3, 3, 28, tra); P.rect(x0 + W - 3, y0 + 3, 3, 28, tra); P.vl(x0, y0 + 3, 28, ljus); P.vl(x0 + W - 1, y0 + 3, 28, mork); P.vl(x0 + 2, y0 + 3, 28, mork);
  // insidan: mörkröd sammet med ett svagt mönster och skugga under krönet
  for (let y = 3; y < 31; y++) for (let x = 3; x < W - 3; x++) P.px(x0 + x, y0 + y, y === 3 ? 0x2e0a1a : (x * 3 + y) % 11 === 0 ? 0x4a1428 : 0x5a1830);
  // hyllplanen (y 12, 21, 30) och meriterna – fyra platser per hylla, mittposten mellan dörrarna lämnas fri
  for (const hy of [12, 21, 30]) { P.hl(x0 + 3, y0 + hy, W - 6, 0x8a5a30); P.hl(x0 + 3, y0 + hy - 1, W - 6, 0x46122a); }
  const SX = [4, 12, 21, 29];
  mer.slice(0, 12).forEach((m, i) => ritaMerit(P, x0 + SX[i % 4], y0 + 5 + Math.floor(i / 4) * 9, m));
  // glasdörrarna: mittposten och glansen (snedstreck) över glaset
  P.vl(x0 + 19, y0 + 3, 28, tra); P.vl(x0 + 20, y0 + 3, 28, mork);
  for (const [sx, len] of [[6, 9], [9, 5], [25, 8]]) for (let k = 0; k < len; k++) P.px(x0 + sx + k, y0 + 27 - k * 2, 0xffffff, 0.22);
  // sockeln med två lådor och mässingsknoppar, fötterna
  P.rect(x0, y0 + 31, W, 5, tra); P.hl(x0, y0 + 31, W, ljus); P.hl(x0, y0 + 35, W, mork); P.vl(x0 + 19, y0 + 32, 3, mork);
  P.px(x0 + 10, y0 + 33, 0xe8b84a); P.px(x0 + 29, y0 + 33, 0xe8b84a);
  P.rect(x0 + 1, y0 + 36, 3, 2, mork); P.rect(x0 + W - 4, y0 + 36, 3, 2, mork);
}

// designernas färger (de senaste först)
function innehall() {
  const d = designer().slice().reverse();
  const skal = d.filter((x) => x.kind === 'phone' && Array.isArray(x.look?.mobil)).map((x) => x.look.mobil);
  const halsband = d.filter((x) => (x.kind === 'beads' && Array.isArray(x.look?.beads)) || x.kind === 'neck').map((x) => (x.kind === 'beads'
    ? { parlor: x.look.beads }
    : { kedja: hexInt(x.look?.neckColor, KEDJA[x.sel?.kedja] ?? 0xe8b84a), sten: x.sel?.sten && x.sel.sten !== 'ingen' ? GEM[x.sel.sten] ?? null : null }));
  const vaskor = d.filter((x) => x.kind === 'bag').map((x) => ({ farg: x.look?.bagColor, modell: x.sel?.modell }));
  const mer = meriter().slice(-12).reverse().map((m) => ({ typ: m.typ, plats: m.plats }));   // 🏆 de tolv senaste
  return { skal, halsband, vaskor, mer };
}

// ---------- det utökade arket ----------
let ATL = null, KALLA = null, sig = '';
function bygg() {
  if (!ATL || !KALLA?.complete || !KALLA.naturalWidth) return;
  const inn = innehall(), ny = JSON.stringify(inn);
  if (ny === sig) return;
  sig = ny;
  const cv = document.createElement('canvas'); cv.width = KALLA.naturalWidth; cv.height = BAS_H + RAD_H;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(KALLA, 0, 0, KALLA.naturalWidth, BAS_H, 0, 0, KALLA.naturalWidth, BAS_H);
  const P = new Pix(208, RAD_H);
  ritaMobilhylla(P, 0, 0, inn.skal);
  ritaSmyckestavla(P, 46, 0, inn.halsband);
  ritaVaskkrokar(P, 82, 0, inn.vaskor);
  for (let i = 0; i < 3; i++) ritaPokal(P, 124 + i * 14, 8, i);
  ritaTrofeskap(P, 168, 0, inn.mer);
  g.drawImage(P.flush(), 0, BAS_H);
  ATL.src = cv.toDataURL();
}
// room.js: kopplar ATLAS (en gång). Arket laddas en gång till för sig (KALLA) så att originalet alltid finns.
export function visningStart(atlas) {
  if (ATL || !atlas || typeof Image === 'undefined') return;
  ATL = atlas;
  KALLA = new Image();
  KALLA.onload = () => bygg();
  KALLA.src = 'assets/interior.png';
}
// designerna har ändrats (BLING BLING) eller spelet har laddats → raden ritas om om något ändrats
export const visningUppdatera = (G) => { if (G) G0 = G; bygg(); };

// Ger visningsmöbeln gratis första gången man köper en egen design av den sorten. → true om den gavs.
export function visningGava(G, designKind) {
  const k = designKind === 'phone' ? 'mobilhylla' : designKind === 'bag' ? 'vaskkrokar' : designKind === 'neck' || designKind === 'beads' ? 'smyckestavla' : null;
  if (!k || !G) return null;
  const finns = (G.storage || []).some((s) => s.k === k) || Object.values(G.deco || {}).some((list) => Array.isArray(list) && list.some((d) => d.k === k));
  if (finns) return null;
  G.storage.push({ k, v: 0 });
  return k;
}
