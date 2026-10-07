// PIREN och SJÖBODEN (v4, Linnéstaden) – Carl 2026-10-07: "båtarna bara ligger.. gör lite större båtar,
// de kan vara knutna till kajen, någon som står och fiskar och får fisk, en korg vid sidan om. En pir ut
// till en fiskrestaurang … båtar längs med piren … lite som hänger längst ner, lampor längs med, mysigt."
//
// Ritar (allt i världskoordinater, y-sorterat som stadens andra föremål):
//   piren (PIER.walk) och bryggan (PIER.deck) i trä med pålar, räcken och lyktstolpar, öppningen i
//   kajräcket; uteserveringen framför Sjöboden (parasoll, bord, griffeltavla, hummertinor, rep), nät och
//   bojar som hänger ner mot vattnet; större båtar förtöjda med rep vid kajen och längs piren (guppar);
//   två fiskare med spö och korg – det nappar då och då och fisken landar i korgen.
// Kontrakt: createPier(env) → { items(), obstacles, glow(ctx, view), update(dt), fisherAt(x, y) }
//   openKrog(A) – Sjöbodens meny (city.js enter: 'fiskkrog'); talkFisher(A, f) – prata med fiskaren.
import { Pix, SMALL, text, textW, ctxText, mix, mul, hash } from '../core/floor-pix.js';
import { drawPerson } from '../core/people.js';
import { CITY, PIER } from './map.js';
import { ravaraOf, MAX_RAVA } from '../game.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';

const WHITE = 0xffffff;
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const spr = (w, h, ax, ay, fn) => { const P = new Pix(w, h, -ax, -ay); fn(P); return { img: P.flush(), ax, ay }; };
const put = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
const WOOD = [0x3a2616, 0x5a3c24, 0x7a5432, 0x9a6e44, 0xb88a58, 0xd4a874];
const WATER = [0x103a58, 0x1a5478, 0x28709a, 0x4492bc, 0x7cc0e0, 0xc8eefa];
const Q0 = CITY.QUAY[0];

// ---------- piren och bryggan ----------
function deckArt() {
  const [wx0, wy0, wx1, wy1] = PIER.walk, [dx0, dy0, dx1, dy1] = PIER.deck;
  const x0 = dx0 - 4, x1 = wx1 + 4, y0 = Q0 + 2, y1 = dy1 + 16;
  return spr(x1 - x0, y1 - y0, -x0, -y0, (P) => {
    const plankX = (x, y, seed) => { const r = (y - y0) % 4, k = hash(Math.floor((y - y0) / 4), 1, seed); let c = mix(WOOD[3], WOOD[4], k * 0.8); if (r === 3) c = WOOD[1]; else if (r === 0) c = mix(c, WHITE, 0.12); if (hash(x, y, seed + 2) > 0.94) c = mul(c, 0.86); if ((x + Math.floor((y - y0) / 4) * 7) % 23 === 0) c = WOOD[2]; return c; };
    const plankY = (x, y, seed) => { const r = (x - dx0) % 5, k = hash(Math.floor((x - dx0) / 5), 2, seed); let c = mix(WOOD[3], WOOD[4], k * 0.8); if (r === 4) c = WOOD[1]; else if (r === 0) c = mix(c, WHITE, 0.12); if (hash(x, y, seed + 3) > 0.94) c = mul(c, 0.86); if ((y + Math.floor((x - dx0) / 5) * 11) % 29 === 0) c = WOOD[2]; return c; };
    // pålarna (syns under bryggans och pirens kant, ner i vattnet med en ring av krusningar)
    const pile = (x, top, len) => { for (let y = top; y < top + len; y++) { P.px(x, y, mix(WOOD[1], 0x2a4a3a, (y - top) / len)); P.px(x + 1, y, mix(WOOD[0], 0x1a3a2a, (y - top) / len)); P.px(x + 2, y, mul(WOOD[0], 0.8)); } for (let i = -2; i <= 4; i++) P.px(x + i, top + len, WATER[4], 0.7); };
    for (let y = wy0 + 10; y < dy0; y += 18) { pile(wx0 - 2, y, 7); pile(wx1 - 1, y, 7); }
    for (let x = dx0; x < dx1; x += 16) pile(x, dy1, 9);
    pile(dx1 - 3, dy1, 9);
    // pirens däck: plankor tvärs över gången
    for (let y = wy0; y < dy0; y++) for (let x = wx0; x < wx1; x++) P.px(x, y, plankX(x, y, 11));
    // bryggan: plankor på längden, en ljus kant mot vattnet
    for (let y = dy0; y < dy1; y++) for (let x = dx0; x < dx1; x++) P.px(x, y, plankY(x, y, 13));
    for (let x = dx0; x < dx1; x++) { P.px(x, dy1, WOOD[5]); P.px(x, dy1 + 1, WOOD[2]); P.px(x, dy1 + 2, WOOD[1]); P.px(x, dy1 + 3, WOOD[0]); P.px(x, dy1 + 4, 0x1a2a2a, 0.5); }   // kanten (bjälken) mot vattnet
    for (let y = wy0; y < dy0; y++) { P.px(wx0 - 1, y, WOOD[1]); P.px(wx1, y, WOOD[1]); P.px(wx1 + 1, y, 0x1a2a2a, 0.5); }
    for (let y = dy0; y < dy1; y++) { P.px(dx0 - 1, y, WOOD[1]); P.px(dx0 - 2, y, 0x1a2a2a, 0.4); }
    // överfarten från kajen (en ljusare tröskel där räcket öppnar sig)
    for (let x = wx0; x < wx1; x++) { P.px(x, wy0, WOOD[5]); P.px(x, wy0 + 1, WOOD[4]); }
  });
}
// räckets stolpar och överliggare: en bit per 12 px (y-sorteras för sig), lyktstolpar var tredje
function railPieces() {
  const [wx0, wy0, wx1] = PIER.walk, [dx0, dy0, dx1, dy1] = PIER.deck, out = [];
  const vRail = (x, ya, yb, lamp) => out.push({ x, y: yb, s: spr(8, yb - ya + 22, 3, yb - ya + 20, (P) => {
    for (let y = ya - yb; y <= 0; y++) { P.px(0, y - 8, WOOD[4]); P.px(1, y - 8, WOOD[2]); }        // överliggaren
    P.vl(0, -10, 10, WOOD[3]); P.vl(1, -10, 10, WOOD[1]);                                           // stolpen
    if (lamp) { P.vl(0, -18, 8, 0x2a2a30); P.rect(-1, -24, 4, 6, 0x2a2a30); P.rect(0, -23, 2, 4, 0xf0e8c0); P.hl(-2, -25, 6, 0x3a3a44); }
  }), lamp: lamp ? [x + 1, yb - 21] : null });
  let k = 0;
  for (let y = wy0 + 12; y <= dy0; y += 12, k++) { vRail(wx0 - 1, y - 12, y, k % 3 === 1); vRail(wx1, y - 12, y, k % 3 === 2); }
  for (let y = dy0 + 12; y <= dy1; y += 12, k++) vRail(wx1, y - 12, y, k % 3 === 0);
  for (let y = dy0 + 12; y <= dy1; y += 12, k++) vRail(dx0 - 1, y - 12, y, k % 3 === 2);
  // det södra räcket längs bryggans kant (framför allt som står på bryggan)
  for (let x = dx0; x < dx1; x += 24) out.push({ x: x + 12, y: dy1, s: spr(26, 14, 1, 12, (P) => {
    P.hl(0, -9, Math.min(24, dx1 - x), WOOD[4]); P.hl(0, -8, Math.min(24, dx1 - x), WOOD[2]); P.hl(0, -4, Math.min(24, dx1 - x), WOOD[3]);
    for (const px of [0, 12]) if (x + px < dx1) { P.vl(px, -10, 10, WOOD[3]); P.vl(px + 1, -10, 10, WOOD[1]); }
  }), x0: x, lamp: null });
  return out;
}
// det som hänger: fisknät över det södra räcket, bojar på rep ner mot vattnet, en livboj
function hangingArt() {
  const [dx0, , dx1, dy1] = PIER.deck;
  return spr(dx1 - dx0 + 8, 30, 4, 12, (P) => {
    // nätet (rutor) som hänger över kanten mellan två stolpar
    for (const nx of [10, 70]) for (let y = -8; y < 14; y++) for (let x = 0; x < 26; x++) {
      const sag = Math.round(Math.sin((x / 26) * Math.PI) * 4);
      if (y > 6 + sag) continue;
      if ((x + y) % 4 === 0 || (x - y + 40) % 4 === 0) P.px(nx + x, y, mix(0xb8a880, 0x8a7a5a, (y + 8) / 22), 0.85);
    }
    // bojar i rep
    [[44, 0xe8443a], [56, 0xf4d23c], [104, 0xf4f1ea], [130, 0xe8443a]].forEach(([bx, c], i) => {
      const len = 7 + (i % 2) * 4;
      for (let y = -6; y < len; y++) P.px(bx, y, 0xd8c8a0);
      P.ell(bx, len + 2, 2.6, 3, c, 1, 1); P.px(bx - 1, len, mix(c, WHITE, 0.5)); P.hl(bx - 2, len + 2, 5, mul(c, 0.7));
    });
    // livbojen på räcket
    const lx = dx1 - dx0 - 18;
    for (let a = 0; a < 28; a++) { const an = a / 28 * Math.PI * 2; for (const r of [4, 5]) P.px(Math.round(lx + Math.cos(an) * r), Math.round(-3 + Math.sin(an) * r), Math.floor((an / Math.PI) * 2) % 2 ? 0xf4f1ea : 0xe8443a); }
  });
}
// uteserveringen: bord med randiga parasoll, stolar, griffeltavlan, hummertinor och ett rep
function terraceArt() {
  const parasol = (c) => spr(30, 40, 15, 37, (P) => {
    P.vl(0, -30, 30, 0xd8d0c0);
    for (let j = 0; j < 8; j++) { const hw = 3 + j * 1.6; for (let i = -Math.round(hw); i <= Math.round(hw); i++) P.px(i, -36 + j, (Math.floor((i + 40) / 3) & 1) ? 0xf4f0e6 : c); }
    for (let i = -14; i <= 14; i++) if ((i + 40) % 3 !== 1) P.px(i, -28, (Math.floor((i + 40) / 3) & 1) ? 0xe0dcd0 : mul(c, 0.8));
    P.ell(0, -8, 7, 2, 0xf4efe4, 1, 1); P.hl(-7, -7, 15, 0xc8c0b0); P.vl(0, -6, 6, 0x5a5a60);                 // bordet
    for (const sx of [-9, 8]) { P.rect(sx, -9, 3, 2, WOOD[3]); P.vl(sx, -14, 5, WOOD[2]); P.vl(sx, -7, 7, WOOD[1]); P.vl(sx + 2, -7, 7, WOOD[1]); }   // stolarna
    P.rect(-3, -10, 2, 2, 0xf8f4ec); P.px(2, -10, 0x5aa0d8); P.px(2, -11, 0x5aa0d8);                           // tallrik och glas
  });
  const board = spr(14, 20, 7, 19, (P) => { P.line(-5, 0, -3, -17, WOOD[2]); P.line(5, 0, 3, -17, WOOD[2]); P.rect(-4, -17, 9, 12, WOOD[3]); P.rect(-3, -16, 7, 10, 0x2a3430); text(P, SMALL, 'FISK', -3, -15, 0xf4f1ea, 0.9); P.hl(-2, -9, 5, 0xf4d23c, 0.9); P.hl(-2, -7, 4, 0xe8e4dc, 0.7); });
  const traps = spr(22, 18, 11, 16, (P) => {
    for (const [ox, oy] of [[-10, 0], [0, 0], [-5, -7]]) {
      P.rect(ox, oy - 7, 10, 7, WOOD[2]); for (let i = ox; i < ox + 10; i += 2) P.vl(i, oy - 6, 5, 0x4a5a3a, 0.8); P.hl(ox, oy - 7, 10, WOOD[4]); P.hl(ox, oy - 4, 10, WOOD[3]);
    }
    P.ell(8, -3, 4, 2, 0xd8c8a0, 1, 1); P.ell(8, -3, 2, 1, 0xa89870, 1, 1);                                    // ett hoprullat rep
  });
  return { parasols: [parasol(0x2a6ab0), parasol(0xd8443a), parasol(0x2a8a5a)], board, traps };
}
// ---------- båtarna ----------
// liggande (öst–väst) vid kajen: 0 = roddeka, 1 = snipa, 2 = motorbåt med ruff, 3 = liten segelbåt med mast
function boatH(kind) {
  const L = kind === 2 ? 30 : kind === 3 ? 28 : 24, hull = kind === 0 ? [0x3a2214, 0x5e3a20, 0x86562e] : kind === 3 ? [0x2a3a5a, 0x3a5a8a, 0x5a7ab0] : [0x8a9098, 0xc8ccd4, 0xf4f4f6];
  const inside = kind === 0 ? [0x7a4a26, 0x9a6234] : [0xa8aeb8, 0xd8dce2];
  return spr(2 * L + 8, 40, L + 4, 30, (P) => {
    const top = (x) => -9 + Math.round(Math.pow(Math.abs(x) / L, 2) * 4), bot = (x) => 3 - Math.round(Math.pow(Math.abs(x) / L, 2.2) * 5);
    for (let x = -L; x <= L; x++) {
      const t = top(x), b = bot(x);
      for (let y = t + 1; y < b - 3; y++) P.px(x, y, (y + 40) % 2 && kind === 0 ? inside[0] : inside[1]);
      P.px(x, t, kind === 0 ? WOOD[5] : WHITE); P.px(x, t + 1, mul(hull[1], 0.8));
      for (let y = b - 3; y <= b; y++) { let c = hull[y === b ? 0 : y === b - 1 ? 1 : 2]; if (kind === 1 && y === b - 2) c = 0xc8302a; if (kind === 2 && y === b - 2) c = 0x2a5ad0; if (kind === 0 && (x + 40) % 9 === 0) c = hull[0]; P.px(x, y, c); }
      P.px(x, b - 4, kind === 0 ? WOOD[5] : WHITE);
      P.px(x, b + 1, WATER[0], 0.55);
    }
    if (kind === 0) { for (const x of [-11, 0, 11]) for (let y = top(x) + 1; y < bot(x) - 3; y++) { P.px(x, y, WOOD[5]); P.px(x + 1, y, WOOD[3]); } P.line(-18, -3, 17, -6, WOOD[5]); P.line(-17, -2, 18, -5, WOOD[3]); }
    if (kind === 1) { P.rect(-6, -9, 10, 3, 0x9ac4dc); P.hl(-6, -10, 10, 0xe8f4fa); P.vl(-7, -9, 4, 0x5a6068); P.rect(19, -7, 4, 6, 0x2a2a30); P.px(20, -6, 0xd8303a); P.rect(-16, -5, 7, 2, 0x2a5ad0); }
    if (kind === 2) {                                                                        // ruffen
      P.rect(-10, -18, 18, 10, 0xf4f4f6); P.hl(-10, -18, 18, WHITE); P.vl(7, -17, 9, 0xc8ccd4); P.hl(-12, -19, 22, 0x2a5ad0);
      for (const wx of [-8, -2, 3]) P.rect(wx, -15, 4, 3, 0x6a8ab0); P.px(-7, -15, 0xc8e0f0);
      P.rect(24, -8, 4, 7, 0x2a2a30); P.vl(-24, -12, 6, 0x8a8e96); P.rect(-26, -14, 4, 2, 0xe8443a);         // motorn och flaggstången
    }
    if (kind === 3) {                                                                        // masten med beslagen rulle segel
      P.vl(-2, -30, 22, 0xd8d0c0); P.vl(-1, -30, 22, 0xa8a090); P.line(-2, -30, -22, -4, 0xb8b0a0); P.line(-1, -30, 22, -5, 0xb8b0a0);
      P.rect(-1, -13, 16, 2, 0xf4f0e6); P.hl(-1, -13, 16, WHITE); P.rect(-12, -7, 7, 2, 0xe8443a);
    }
  });
}
// stående (nord–syd) längs piren: fören pekar norrut, aktern mot oss (0 = eka, 1 = snipa med motor)
function boatV(kind) {
  const rim = kind ? WHITE : WOOD[5], side = kind ? [0xc8ccd4, 0x8a9098] : [WOOD[3], WOOD[1]], inner = kind ? [0xb8c4d0, 0x9aa8b8] : [0x9a6234, 0x7a4a26];
  return spr(22, 46, 11, 42, (P) => {
    const hwAt = (y) => { const u = (y + 38) / 38; return u < 0.38 ? Math.max(1, Math.round(7 * Math.sqrt(u / 0.38))) : 7; };
    for (let y = -38; y <= -3; y++) {
      const hw = hwAt(y);
      for (let x = -hw; x <= hw; x++) {
        let c;
        if (Math.abs(x) === hw) c = rim;                                                  // relingen
        else if (Math.abs(x) === hw - 1) c = x > 0 ? side[1] : side[0];                   // bordläggningen
        else c = (y + 40) % 3 === 0 && !kind ? inner[1] : x > 0 ? inner[1] : inner[0];    // durken
        P.px(x, y, c);
      }
      P.px(hw + 1, y, 0x0a1a2a, 0.35);                                                    // skuggan på vattnet
    }
    for (const y of kind ? [-14] : [-28, -18, -9]) { P.hl(-5, y, 11, kind ? 0x2a5ad0 : WOOD[5]); P.hl(-5, y + 1, 11, kind ? 0x1a3a90 : WOOD[2]); }   // tofterna / dynan
    if (kind) { P.rect(-4, -32, 8, 4, 0x9ac4dc); P.hl(-4, -33, 8, 0xe8f4fa); }                                            // vindrutan
    for (let y = -2; y <= 1; y++) for (let x = -7; x <= 7; x++) P.px(x, y, y === -2 ? rim : y === 1 ? side[1] : kind && y === 0 ? 0xc8302a : side[0]);   // akterspegeln
    if (kind) { P.rect(-2, 0, 4, 6, 0x2a2a30); P.hl(-2, 0, 4, 0x5a5e66); P.px(0, 2, 0xd8303a); } else { P.line(-6, -24, 7, -20, WOOD[5]); }        // motorn / en åra
    for (let x = -9; x <= 9; x++) P.px(x, 2 + (kind ? 4 : 0), WATER[4], 0.4);
  });
}
// ---------- fiskarna ----------
const FISHERS = [
  { id: 'fiskare1', x: -1006, y: Q0 + 9, side: 1, look: { skin: '#e0a97f', hair: '#a8a8a8', style: 'short', hat: 'bucket', cap: '#4a6a3a', shirt: '#4a6a3a', pants: '#3a3a44', beard: true, build: 6 }, name: 'Fiskar-Folke',
    lines: ['Det nappar bäst på morgonen.', 'Abborren går till i dag!', 'Pst – byt till en röd mask.', 'I går fick jag en gädda så här stor!'] },
  { id: 'fiskare2', x: PIER.walk[2] - 6, y: PIER.deck[1] - 14, side: 1, look: { skin: '#c68a5c', hair: '#2a1a12', style: 'ponytail', hat: 'cap', cap: '#e8443a', shirt: '#f4d23c', pants: '#3a6ab0', kid: true, build: 4 }, name: 'Saga',
    lines: ['Jag har fått tre i dag!', 'Krabborna nappar på bacon.', 'Titta, där simmar en!'] },
];
function basketArt() { return spr(14, 12, 7, 10, (P) => { P.rect(-5, -6, 10, 6, 0xb08a50); for (let x = -5; x < 5; x += 2) P.vl(x, -6, 6, 0x8a6a3a); P.hl(-5, -6, 10, 0xd8b480); P.hl(-6, -7, 12, 0x8a6a3a); P.line(-4, -7, 0, -10, 0x8a6a3a); P.line(4, -7, 0, -10, 0x8a6a3a); }); }
function bucketArt() { return spr(10, 10, 5, 9, (P) => { P.rect(-3, -6, 7, 6, 0x6a8ab0); P.hl(-3, -6, 7, 0xa8c8e8); P.vl(3, -5, 5, 0x4a6a90); }); }

// ---------- modulen ----------
export function createPier(env) {
  if (!PIER) return { items: () => [], obstacles: [], glow() {}, update() {}, fisherAt: () => null };
  const [wx0, wy0, wx1] = PIER.walk, [dx0, dy0, dx1, dy1] = PIER.deck;
  const DECK = deckArt(), RAILS = railPieces(), HANG = hangingArt(), TER = terraceArt(), BASKET = basketArt(), BUCKET = bucketArt();
  const BH = [0, 1, 2, 3].map(boatH), BV = [0, 1].map(boatV);
  // båtarna vid kajen (förtöjda med rep till pollarna på kajen) och längs piren
  const quayBoats = [[-1150, 2], [-1068, 0], [-904, 1], [-770, 3], [-650, 0], [-250, 1], [-120, 2]].map(([x, k]) => ({ x, y: Q0 + 32, k }));
  const pierBoats = [[wx1 + 12, 828, 1], [wx1 + 12, 874, 0], [wx1 + 12, 922, 1]].map(([x, y, k]) => ({ x, y, k }));
  const tables = [[dx0 + 22, dy0 + 22, 0], [dx0 + 62, dy0 + 32, 1], [dx0 + 102, dy0 + 22, 2]];
  const obstacles = [
    [wx0, wy0 + 4, wx0 + 3, dy0], [wx1 - 3, wy0 + 4, wx1, dy1], [dx0, dy1 - 3, dx1, dy1], [dx0, dy0, dx0 + 3, dy1],   // räckena
    ...tables.map(([x, y]) => [x - 10, y - 4, x + 10, y]),
    [dx1 - 30, dy1 - 10, dx1 - 8, dy1 - 3],                                                     // hummertinorna
    ...FISHERS.map((f) => [f.x - 5, f.y - 3, f.x + 9, f.y + 1]),
  ];
  const catchState = FISHERS.map((f, i) => ({ n: 2 + i, next: 6 + i * 9, anim: -1 }));
  let tAcc = 0;
  const items = () => {
    const t = env.t || 0, out = [];
    out.push({ y: wy0 - 1, draw: (ctx) => put(ctx, DECK, 0, 0) });
    for (const r of RAILS) out.push({ x: r.x, y: r.y, draw: (ctx) => put(ctx, r.s, r.x0 ?? r.x, r.y) });
    out.push({ x: (dx0 + dx1) / 2, y: dy1 + 1, draw: (ctx) => put(ctx, HANG, dx0, dy1) });
    // båtarna: guppar, repen spänns ner till pollarna på kajen
    for (const b of quayBoats) out.push({ x: b.x, y: b.y + 6, draw: (ctx) => {
      const bob = Math.round(Math.sin(t * 1.1 + b.x * 0.07) * 1.2), s = BH[b.k];
      ctx.fillStyle = '#d8c8a0';
      for (const [ax, bx] of [[b.x - 18, b.x - 28], [b.x + 18, b.x + 26]]) { const y0 = Q0 + 6, y1 = b.y - 6 + bob, n = 12; for (let i = 0; i <= n; i++) { const u = i / n; ctx.fillRect(Math.round(bx + (ax - bx) * u), Math.round(y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * 2), 1, 1); } }
      put(ctx, s, b.x, b.y + bob);
    } });
    for (const b of pierBoats) out.push({ x: b.x, y: b.y, draw: (ctx) => {
      const bob = Math.round(Math.sin(t * 1.3 + b.y * 0.1) * 1);
      ctx.fillStyle = '#d8c8a0'; const px = b.x < wx0 ? wx0 - 1 : wx1, py = b.y - 30 + bob; for (let i = 0; i <= 6; i++) ctx.fillRect(Math.round(px + (b.x - px) * i / 6), Math.round(py + Math.sin(i / 6 * Math.PI)), 1, 1);
      put(ctx, BV[b.k], b.x, b.y + bob);
    } });
    // uteserveringen
    tables.forEach(([x, y, k]) => out.push({ x, y, draw: (ctx) => put(ctx, TER.parasols[k], x, y) }));
    out.push({ x: dx1 - 20, y: dy1 - 3, draw: (ctx) => put(ctx, TER.traps, dx1 - 20, dy1 - 3) });
    out.push({ x: dx0 + 138, y: dy0 + 30, draw: (ctx) => put(ctx, TER.board, dx0 + 138, dy0 + 30) });
    // fiskarna: spö, lina, flöte, korgen – då och då nappar det och fisken landar i korgen
    FISHERS.forEach((f, i) => {
      const st = catchState[i];
      out.push({ x: f.x, y: f.y, draw: (ctx) => {
        put(ctx, f.id === 'fiskare1' ? BUCKET : BUCKET, f.x, f.y);
        drawPerson(ctx, f.x, f.y - (f.id === 'fiskare1' ? 4 : 0), f.look, 'down', f.id === 'fiskare1' ? 5 : 0);
        put(ctx, BASKET, f.x - 9, f.y + 1);
        for (let k = 0; k < Math.min(5, st.n); k++) { ctx.fillStyle = k % 2 ? '#8a9ab0' : '#a8b8c8'; ctx.fillRect(f.x - 13 + k * 2, f.y - 6 - (k & 1), 3, 1); }
        // spöet (böjer sig när det nappar), linan och flötet
        const a = st.anim, bite = a >= 0 && a < 1.2, fly = a >= 1.2 && a < 2.2;
        const hx = f.x + 4, hy = f.y - 14, tipX = f.x + 18, tipY = f.y - 24 + (bite ? 4 : 0);
        ctx.fillStyle = '#6a4a2a'; const n = 14; for (let k = 0; k <= n; k++) { const u = k / n; ctx.fillRect(Math.round(hx + (tipX - hx) * u), Math.round(hy + (tipY - hy) * u + (bite ? u * u * 3 : 0)), 1, 1); }
        const bx = f.x + 22, by = (f.id === 'fiskare1' ? Q0 + 30 : f.y + 18) + (bite ? 2 : Math.round(Math.sin(t * 2 + i) * 0.6));
        ctx.fillStyle = 'rgba(240,240,240,0.7)'; for (let k = 0; k <= 10; k++) { const u = k / 10; ctx.fillRect(Math.round(tipX + (bx - tipX) * u), Math.round(tipY + (by - tipY) * u), 1, 1); }
        if (!fly) { ctx.fillStyle = '#e8443a'; ctx.fillRect(bx, by - 1, 2, 1); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(bx, by, 2, 1); }
        if (bite) { ctx.fillStyle = 'rgba(200,238,250,0.8)'; ctx.fillRect(bx - 2, by + 1, 6, 1); }
        if (fly) {                                                                           // fisken flyger upp och ner i korgen
          const u = a - 1.2, fx = bx + (f.x - 9 - bx) * u, fy = by + (f.y - 8 - by) * u - Math.sin(u * Math.PI) * 18, flap = Math.floor(t * 12) % 2;
          ctx.fillStyle = '#a8b8c8'; ctx.fillRect(Math.round(fx) - 2, Math.round(fy), 5, 2); ctx.fillStyle = '#6a7a90'; ctx.fillRect(Math.round(fx) + (flap ? 3 : -3), Math.round(fy) - (flap ? 1 : 0), 1, 2);
          ctx.fillStyle = '#c8e8f8'; ctx.fillRect(Math.round(fx) - 1, Math.round(fy), 1, 1);
        }
        if (a >= 0 && a < 2.4) { const s = fly ? 'JAA!' : 'NAPP!', w = textW(SMALL, s) + 6, x = f.x - (w >> 1); ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 1, f.y - 41, w + 2, 12); ctx.fillStyle = '#fff6d8'; ctx.fillRect(x, f.y - 40, w, 10); ctxText(ctx, SMALL, s, x + 3, f.y - 37, '#8a2a1a'); }
      } });
    });
    return out;
  };
  function glow(ctx, view) {
    const k = Math.max(0, Math.min(1, ((env.dark || 0) - 0.1) / 0.28));
    if (k <= 0 || !view || view.x > dx1 + 60 || view.x + view.w < dx0 - 700 || view.y + view.h < Q0 - 40) return;
    const t = env.t || 0;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const r of RAILS) if (r.lamp) {
      const [x, y] = r.lamp, f = 0.85 + 0.15 * Math.sin(t * 3 + x);
      ctx.fillStyle = rgba(0xffe0a0, 0.9 * k * f); ctx.fillRect(x - 1, y, 2, 4);
      ctx.fillStyle = rgba(0xffc070, 0.18 * k * f); ctx.fillRect(x - 6, y - 4, 12, 12);
      ctx.fillStyle = rgba(0xffc070, 0.12 * k); ctx.fillRect(x - 8, y + 20, 16, 4);       // ljuspöl på plankorna
    }
    // ljusslinga mellan parasollen
    for (let x = dx0 + 8; x < dx0 + 120; x += 4) { const y = dy0 + 6 + Math.round(Math.sin(((x - dx0 - 8) % 40) / 40 * Math.PI) * 3); ctx.fillStyle = rgba(0xffd070, 0.8 * k); ctx.fillRect(x, y, 1, 1); ctx.fillStyle = rgba(0xffb050, 0.15 * k); ctx.fillRect(x - 1, y - 1, 3, 3); }
    // lyktorna speglar sig i vattnet
    for (const r of RAILS) if (r.lamp) { const [x, y] = r.lamp; for (let j = 0; j < 6; j++) { ctx.fillStyle = rgba(0xffd090, 0.14 * k * (1 - j / 6)); ctx.fillRect(x - 1 + Math.round(Math.sin(t * 2 + j) * 1), y + 34 + j * 2, 3, 1); } }
    ctx.restore();
  }
  function fisherAt(x, y) {
    for (const f of FISHERS) if (x >= f.x - 14 && x < f.x + 26 && y >= f.y - 34 && y < f.y + 6) return { ...f, walk: { x: f.x - 18, y: f.y + 2 } };
    return null;
  }
  return {
    items, obstacles, glow, fisherAt,
    update(dt) {
      tAcc += dt || 0;
      catchState.forEach((st, i) => {
        if (st.anim >= 0) { st.anim += dt; if (st.anim >= 2.4) { st.anim = -1; st.n = st.n >= 6 ? 2 : st.n + 1; st.next = tAcc + 18 + hash(i, Math.floor(tAcc), 5) * 20; } }
        else if (tAcc >= st.next) st.anim = 0;
      });
    },
  };
}

// ---------- Sjöbodens meny ----------
const KROG = [
  { id: 'fishchips', icon: '🐟', namn: 'Fish and chips med remouladsås', pris: 69, matt: 30, glad: 2 },
  { id: 'raksmorgas', icon: '🦐', namn: 'Räksmörgås på rågbröd', pris: 85, matt: 25, glad: 4 },
  { id: 'fisksoppa', icon: '🍲', namn: 'Fisksoppa med aioli', pris: 79, matt: 32, glad: 3 },
  { id: 'sill', icon: '🥔', namn: 'Inlagd sill med färskpotatis', pris: 59, matt: 28, glad: 2 },
  { id: 'hjortron', icon: '🍨', namn: 'Vaniljglass med varma hjortron', pris: 39, matt: 6, glad: 3 },
];
export function openKrog(A) {
  const g = A.game;
  const rows = KROG.map((m) => `<div class="prow shoprow"><span style="font-size:28px;text-align:center">${m.icon}</span>
      <span class="nm">${esc(m.namn)}<br><small class="sp">+${m.matt} mätthet · 😊 lycka · en halvtimme på bryggan</small></span>
      <button class="btn btn-small ${g.money >= m.pris ? 'btn-go' : ''}" data-krog="${m.id}" ${g.money >= m.pris ? '' : 'disabled'}>${m.pris} kr</button></div>`).join('');
  const dlg = openModal('🐟 Sjöboden', `<p style="font-size:var(--f2);margin-top:0">Fisk och skaldjur på bryggan – sätt dig under ett parasoll och titta på båtarna.<br>💰 <b>${g.money} kr</b></p><div class="plist">${rows}</div>`,
    [{ label: 'Inte nu', onClick: closeModal }]);
  dlg.querySelectorAll('[data-krog]').forEach((b) => (b.onclick = () => {
    const m = KROG.find((x) => x.id === b.dataset.krog);
    if (!m || g.money < m.pris) { play('fel'); toast('💸 Du har inte råd med den.', 'bad'); return; }
    g.money -= m.pris;
    g.hunger = Math.min(100, g.hunger + m.matt);
    g.glad?.(m.glad, 'Sjöboden', 'sjoboden', 8);
    g.passTime(30); g.save();
    closeModal(); play('coin');
    toast(`${m.icon} Mums! ${m.namn} ute på bryggan – måsarna skriker och båtarna guppar. 😊`, 'good');
  }));
}
// ---------- fiskarna ----------
export function talkFisher(A, f) {
  const g = A.game, line = f.lines[Math.floor(Math.random() * f.lines.length)];
  if (f.look?.kid) { toast(`🎣 ${f.name}: "${line}"`); return; }
  const fisk = ravaraOf('fisk'), pris = 30, full = (g.skafferi?.fisk | 0) >= MAX_RAVA;
  openModal(`🎣 ${esc(f.name)}`, `<p style="font-size:var(--f2);margin-top:0">"${esc(line)}"<br>Vill du köpa en nyfångad abborre? Den blir fiskfilé i skafferiet.<br>💰 <b>${g.money} kr</b></p>`, [
    { label: 'Nej tack', onClick: closeModal },
    { label: full ? 'Skafferiet är fullt' : `🐟 Köp en (${pris} kr)`, cls: g.money >= pris && !full ? 'btn-go' : '', onClick: () => {
      closeModal();
      if (full) return;
      if (g.money < pris) { play('fel'); toast('💸 Du har inte råd.', 'bad'); return; }
      g.money -= pris; g.skafferi.fisk = (g.skafferi.fisk | 0) + 1; g.save();
      play('coin'); toast(`${fisk?.icon || '🐟'} ${f.name} lindar in abborren i tidningspapper – den ligger i skafferiet.`, 'good');
    } },
  ]);
}
