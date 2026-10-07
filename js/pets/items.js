// Husdjursprylar i Snabbfilen – ritade i kod, pixel för pixel, sedda snett
// ovanifrån som möblerna. Allt i det logiska 384×216-rummet, heltalspixlar.
//
// ============================== API ==============================
// PET_ITEMS = { id: { namn, pris, w, h, forArt:[arter], typ, desc, solid?, sangFor?, art?, portioner? } }
//   id ∈ matskal, vattenskal, kattlada, hundkorg, kattkorg, kaninbur, kattklostrad,
//        leksak-boll, leksak-ben, leksak-morot (kaninens gnagmorot), sack-katt, sack-hund,
//        sack-kanin, koppel
//   typ ∈ 'skal' | 'vatten' | 'lada' | 'sang' | 'bur' | 'klos' | 'leksak' | 'sack' | 'koppel'
// drawPetItem(ctx, id, x, y, state = {})
//   (x, y) = mitten av föremålets underkant (där det står på golvet), som drawPet.
//   state: food 0–1 + foodKind ('katt'|'hund'|'kanin') för matskålen, water 0–1,
//          dirt 0–1 (kattlåda/kaninbur), left (säck: portioner kvar) eller frac 0–1,
//          t (sekunder – flugor, pompom, vattenglitter), rot (bollens rullning),
//          layer 'back' | 'front' | 'all' (kaninbur och korgar: 'back' = allt utom framkanten
//          / hela korgen, 'front' = framgaller/framkant som ritas ÖVER djuret som ligger i den),
//          hover (gula hörn), ghost (halvgenomskinlig), bad (röda hörn = går ej att ställa här).
// splitItem(id)   → true om saken ska ritas i två lager (back vid y − djup, front vid y + 0,2)
// itemBox(id)     → { x0, y0, x1, y1 } relativt (x, y) – klickyta
// itemSolid(id)   → { x0, y0, x1, y1 } relativt (x, y) eller null – hinder för spelaren
// itemSpot(id)    → { dx, dy } där ett djur står/ligger när det använder saken (relativt x, y)
// drawItemIcon(ctx, id, x, y, scale = 1, state) – ikon för menyer (övre vänstra hörnet i x, y)
// ==================================================================
import { mix, mul, hash } from '../core/floor-pix.js';
import { $t } from '../core/i18n.js';

export const PET_ITEMS = {
  matskal: { namn: $t('Matskål'), pris: 39, w: 11, h: 7, forArt: ['katt', 'hund', 'kanin'], typ: 'skal', desc: $t('Fyll den med mat ur en säck – djuren äter själva när de blir hungriga.') },
  vattenskal: { namn: $t('Vattenskål'), pris: 39, w: 11, h: 7, forArt: ['katt', 'hund', 'kanin'], typ: 'vatten', desc: $t('Friskt vatten gör djuren gladare. Fyll på från kranen.') },
  kattlada: { namn: $t('Kattlåda'), pris: 149, w: 19, h: 12, forArt: ['katt'], typ: 'lada', solid: true, desc: $t('Katten gör sina behov här. Töm den ibland!') },
  hundkorg: { namn: $t('Hundkorg'), pris: 299, w: 25, h: 13, forArt: ['hund'], typ: 'sang', solid: true, sangFor: 'hund', desc: $t('En flätad korg med mjuk dyna – hunden sover gott här.') },
  kattkorg: { namn: $t('Kattkorg'), pris: 199, w: 17, h: 10, forArt: ['katt'], typ: 'sang', solid: true, sangFor: 'katt', desc: $t('En plyschig kattsäng att rulla ihop sig i.') },
  kaninbur: { namn: $t('Kaninbur'), pris: 399, w: 33, h: 24, forArt: ['kanin'], typ: 'bur', solid: true, sangFor: 'kanin', desc: $t('Bur med halm, höhäck och vattenflaska. Byt halm ibland.') },
  kattklostrad: { namn: $t('Klösträd'), pris: 349, w: 19, h: 34, forArt: ['katt'], typ: 'klos', solid: true, desc: $t('Klättra, klösa och sova högst upp – katter älskar det.') },
  'leksak-boll': { namn: $t('Boll'), pris: 29, w: 5, h: 5, forArt: ['hund', 'katt'], typ: 'leksak', desc: $t('Klicka på bollen hemma så kastar du den.') },
  'leksak-ben': { namn: $t('Tuggben'), pris: 35, w: 11, h: 5, forArt: ['hund'], typ: 'leksak', desc: $t('Något att tugga på när du är borta.') },
  'leksak-morot': { namn: $t('Gnagmorot'), pris: 25, w: 12, h: 6, forArt: ['kanin'], typ: 'leksak', desc: $t('En morot av flätad pil och hö att gnaga på – kaninens egen leksak.') },
  'sack-katt': { namn: $t('Kattmat (säck)'), pris: 89, w: 11, h: 15, forArt: ['katt'], typ: 'sack', art: 'katt', portioner: 10, desc: $t('10 skålar kattmat.') },
  'sack-hund': { namn: $t('Hundmat (säck)'), pris: 119, w: 13, h: 16, forArt: ['hund'], typ: 'sack', art: 'hund', portioner: 10, desc: $t('10 skålar hundmat.') },
  'sack-kanin': { namn: $t('Kaninfoder (säck)'), pris: 69, w: 11, h: 14, forArt: ['kanin'], typ: 'sack', art: 'kanin', portioner: 10, desc: $t('10 skålar kaninfoder med hö och morötter.') },
  koppel: { namn: $t('Koppel'), pris: 99, w: 11, h: 7, forArt: ['hund'], typ: 'koppel', desc: $t('Behövs för att gå ut med hunden.') },
};

// ---------- geometri för lagret ----------
export function itemBox(id) {
  const d = PET_ITEMS[id];
  if (!d) return { x0: -4, y0: -4, x1: 4, y1: 1 };
  const w = Math.max(9, d.w + 2), h = Math.max(7, d.h + 1);
  return { x0: -(w >> 1), y0: -h, x1: w - (w >> 1), y1: 2 };
}
const SOLID = {
  kattlada: [-9, -9, 10, 0], hundkorg: [-12, -9, 13, 0], kattkorg: [-8, -7, 9, 0],
  kaninbur: [-16, -13, 17, 0], kattklostrad: [-8, -6, 9, 0],
};
export const splitItem = (id) => id === 'kaninbur' || PET_ITEMS[id]?.typ === 'sang';
export function itemSolid(id) { const s = SOLID[id]; return s ? { x0: s[0], y0: s[1], x1: s[2], y1: s[3] } : null; }
const SPOT = {
  matskal: [0, 5], vattenskal: [0, 5], kattlada: [0, -3], hundkorg: [0, -3], kattkorg: [0, -3],
  kaninbur: [0, -3], kattklostrad: [0, 4], 'leksak-boll': [4, 1], 'leksak-ben': [0, 2], 'leksak-morot': [-2, 2],
  'sack-katt': [0, 3], 'sack-hund': [0, 3], 'sack-kanin': [0, 3], koppel: [0, 3],
};
export function itemSpot(id) { const s = SPOT[id] || [0, 4]; return { dx: s[0], dy: s[1] }; }

// ======================================================================
//  Liten pixelduk: färger per pixel (−1 = tomt) med alfablandning
// ======================================================================
class Grid {
  constructor(w, h) { this.w = w; this.h = h; this.c = new Int32Array(w * h).fill(-1); this.a = new Float32Array(w * h); }
  set(x, y, c, a = 1) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = y * this.w + x;
    if (a >= 1 || this.c[i] < 0) { this.c[i] = c; this.a[i] = Math.min(1, a); return; }
    this.c[i] = mix(this.c[i], c, a); this.a[i] = Math.min(1, this.a[i] + a * (1 - this.a[i]));
  }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : this.c[y * this.w + x]; }
  has(x, y) { return this.get(x, y) >= 0; }
  rect(x, y, w, h, c, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a); }
  // rader med tecken → palett (mellanslag/'.' = tomt)
  rows(x, y, rows, pal) {
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c !== undefined && c !== null) this.set(x + i, y + j, c); } });
  }
  // yttre kontur: tomma pixlar intill fyllda får färgen fn(grannens färg)
  outline(fn, diag = false) {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.has(x, y)) continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1], ...(diag ? [[1, 1], [-1, 1], [1, -1], [-1, -1]] : [])].map(([dx, dy]) => this.get(x + dx, y + dy)).filter((c) => c >= 0);
      if (n.length) add.push([x, y, fn(n[0])]);
    }
    for (const [x, y, c] of add) this.set(x, y, c);
  }
  canvas() {
    const cv = document.createElement('canvas');
    cv.width = this.w; cv.height = this.h;
    const x = cv.getContext('2d'), img = x.createImageData(this.w, this.h), d = img.data;
    for (let i = 0; i < this.w * this.h; i++) {
      const c = this.c[i];
      if (c < 0) continue;
      d[i * 4] = (c >> 16) & 255; d[i * 4 + 1] = (c >> 8) & 255; d[i * 4 + 2] = c & 255; d[i * 4 + 3] = Math.round(this.a[i] * 255);
    }
    x.putImageData(img, 0, 0);
    return cv;
  }
}
const ink = (c) => mix(mul(c, 0.32), 0x1a1224, 0.45); // kontur i materialets mörka ton
const lite = (c, t = 0.35) => mix(c, 0xffffff, t);
const dark = (c, f = 0.72) => mul(c, f);
const inEll = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 < 1;

const KIBBLE = {
  katt: [0xc8763a, 0xe29a52, 0x9a5226, 0xd8884a],
  hund: [0x8a5028, 0xa86a38, 0x5e3618, 0x9a5c2c],
  kanin: [0x7aa840, 0xd8c060, 0xe8802a, 0x5e8a30],
};

// ---------- skålar ----------
function paintBowl(kind, level, foodKind, glint) {
  const g = new Grid(11, 7);
  const body = kind === 'vatten' ? 0x3a7cc8 : 0xc8463c;
  const pal = {
    '#': ink(body), h: lite(body, 0.45), H: lite(body, 0.7), i: mul(body, 0.5), j: mul(body, 0.62),
    f: lite(body, 0.55), b: body, l: lite(body, 0.18), d: dark(body, 0.78), w: 0xf4efe6,
  };
  g.rows(0, 0, [
    '..#######..',
    '.#hHHHHhh#.',
    '#hiiiiiiih#',
    '#hjjjjjjjh#',
    '#fffffffff#',
    '.#llbbbdd#.',
    '..#######..',
  ], pal);
  g.set(5, 5, pal.w); g.set(4, 5, lite(body, 0.3)); // liten tass-/glansprick på framsidan
  if (kind === 'vatten') {
    const n = level > 0.55 ? 2 : level > 0.08 ? 1 : 0;
    for (let r = 0; r < n; r++) for (let x = 2; x <= 8; x++) g.set(x, 3 - r, r === n - 1 ? 0x8ad2f4 : 0x5ab4e8);
    if (n) { const y = 4 - n; g.set(3 + glint, y, 0xe8f8ff); g.set(4 + glint, y, 0xe8f8ff); g.set(7 - glint, 3, 0xbfe8fa); }
  } else if (level > 0.01) {
    const K = KIBBLE[foodKind] || KIBBLE.katt;
    const k = (x, y) => K[Math.floor(hash(x, y, 7) * K.length) % K.length];
    // fyllnad nerifrån: rad 3, rad 2, sedan en hög över bakkanten
    const cells = [];
    for (let x = 2; x <= 8; x++) cells.push([x, 3]);
    for (let x = 2; x <= 8; x++) cells.push([x, 2]);
    for (let x = 3; x <= 7; x++) cells.push([x, 1]);
    cells.push([4, 0], [5, 0], [6, 0]);
    const n = Math.max(2, Math.round(level * cells.length));
    // första raden fylls glest vid låg nivå (några korn kvar i botten)
    const order = [...cells.slice(0, 7).sort((a, b) => hash(a[0], 3, 11) - hash(b[0], 3, 11)), ...cells.slice(7)];
    for (let i = 0; i < n && i < order.length; i++) { const [x, y] = order[i]; g.set(x, y, k(x, y)); }
    if (level > 0.9) { g.set(4, 0, K[1]); g.set(6, 0, K[0]); g.set(5, 1, lite(K[1], 0.25)); }
  }
  return g;
}

// ---------- kattlåda ----------
function paintLitter(dirt) {
  const W = 19, H = 12, g = new Grid(W, H);
  const pl = 0x6f8fb0; // blågrå plast
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = x === 0 || x === W - 1;
    const r = y === 0 || y === H - 1 ? (x < 1 || x > W - 2 ? -1 : 1) : 0;
    if (r < 0) continue;
    let c;
    if (y === 0 || y === H - 1 || edge) c = ink(pl);
    else if (y === 1) c = lite(pl, 0.4);                    // bakre kanten
    else if (y === 2) c = x === 1 || x === W - 2 ? lite(pl, 0.3) : mul(pl, 0.62); // innervägg bak
    else if (y <= 7) c = x === 1 || x === W - 2 ? lite(pl, x === 1 ? 0.3 : 0.05) : -2; // sand
    else if (y === 8) c = lite(pl, 0.5);                     // främre kanten
    else c = y === 10 ? mul(pl, 0.78) : x < 4 ? lite(pl, 0.12) : pl;
    if (c === -2) {
      const n = hash(x, y, 3);
      c = n > 0.82 ? 0xf2e2b4 : n < 0.18 ? 0xcfb680 : 0xe2cc98;
      if (y === 3) c = mul(c, 0.86); // skugga under bakkanten
      c = mix(c, 0xa89878, dirt * 0.35);
    }
    g.set(x, y, c);
  }
  // klumpar (bajs + kisskakor) – antal efter smuts
  const spots = [[4, 4], [12, 6], [8, 5], [15, 4], [6, 6], [11, 4], [14, 6], [3, 6]];
  const n = Math.round(dirt * spots.length);
  for (let i = 0; i < n; i++) {
    const [x, y] = spots[i];
    if (i % 2 === 0) { g.set(x, y, 0x5a3a20); g.set(x + 1, y, 0x6e4828); g.set(x, y - 1, 0x7a5230); } // bajs
    else { g.set(x, y, 0xa89060); g.set(x + 1, y, 0x988050); g.set(x + 1, y - 1, 0xb8a070); }      // kisskaka
  }
  // skopa som lutar mot högra kanten
  g.set(W - 4, 8, 0xe8e0d0); g.set(W - 3, 7, 0xe8e0d0); g.set(W - 3, 8, 0xc8c0b0); g.set(W - 2, 6, 0x8a8478);
  return g;
}

// ---------- ovala korgar (hund = flätad, katt = plysch) ----------
// part: 'all' = hela korgen, 'front' = bara framkanten (ritas över ett djur som ligger i korgen)
function paintBasket(kind, part = 'all') {
  const hund = kind === 'hundkorg';
  const W = PET_ITEMS[kind].w, H = PET_ITEMS[kind].h, g = new Grid(W, H);
  const innerMask = new Uint8Array(W * H);
  const cx = W / 2, rx = W / 2 - 1, ry = hund ? 4.6 : 4.2, cy = ry + 1, depth = hund ? 5 : 3;
  const rimW = hund ? 2.2 : 2.5;
  const wick = 0xb47a3e, cush = 0xc4443a, plush = 0x9c86c8, plushIn = 0xe8b4cc;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const inTop = inEll(x, y, cx, cy, rx, ry);
    // framsidan: under ellipsens nedre halva, 'depth' px ned
    let front = false;
    const dx = (x + 0.5 - cx) / rx;
    if (Math.abs(dx) < 1) {
      const yb = cy + ry * Math.sqrt(1 - dx * dx);
      front = y + 0.5 >= cy && y + 0.5 < yb + depth;
    }
    if (!inTop && !front) continue;
    const inner = inEll(x, y, cx, cy + 0.6, rx - rimW, ry - rimW * 0.6);
    if (inner) innerMask[y * W + x] = 1;
    let c;
    if (inner) {
      if (hund) { // rutig dyna
        const ch = ((x >> 1) + (y >> 1)) & 1;
        c = ch ? cush : lite(cush, 0.18);
        if ((x % 4 === 0) || (y % 3 === 0)) c = mix(c, 0xf0d8a0, 0.35);
        if (y + 0.5 < cy - 0.5) c = mul(c, 0.8); // skugga under bakkanten
      } else {
        c = mix(plushIn, 0xffffff, hash(x, y, 2) * 0.12);
        if (y + 0.5 < cy - 0.2) c = mul(c, 0.84);
        if (((x + y) % 4 === 0) && y + 0.5 >= cy) c = mix(c, 0xffffff, 0.25); // mjukt tyg
      }
    } else if (inTop && !front) { // kanten ovanifrån
      if (hund) c = ((x + y * 2) % 4 < 2) ? lite(wick, 0.25) : wick;
      else {
        c = mix(lite(plush, 0.3), plush, (y + 0.5 - (cy - ry)) / (ry * 1.2));
        if (Math.abs(inEll(x, y, cx, cy - 0.4, rx - 1, ry - 1) - inEll(x, y, cx, cy - 0.9, rx - 1, ry - 1.2)) && y + 0.5 < cy) c = lite(plush, 0.5); // glansbåge
      }
    } else { // framsidan
      const fy = y + 0.5 - cy;
      if (hund) {
        const band = Math.floor(y) % 2;
        c = ((x + band * 2) % 4 < 2) ? wick : mul(wick, 0.78);
        if (inTop) c = lite(wick, 0.12);
      } else {
        c = fy < ry + 0.6 ? lite(plush, 0.1) : mul(plush, 0.86);
        if (x % 3 === 1) c = mix(c, 0xffffff, 0.07);                  // lurvig plysch
        if (Math.abs(fy - (ry + 1.4)) < 0.5 && x % 2 === 0) c = lite(plushIn, 0.2); // söm
      }
      if (x < W * 0.25) c = lite(c, 0.1); else if (x > W * 0.75) c = mul(c, 0.86);
    }
    g.set(x, y, c);
  }
  // låg "ingång" fram på hundkorgen (dynan syns över kanten)
  if (hund) {
    for (let x = Math.floor(cx) - 4; x <= Math.floor(cx) + 4; x++) {
      const y = Math.round(cy + ry) - 1;
      g.set(x, y, lite(cush, 0.1)); g.set(x, y + 1, lite(wick, 0.3));
    }
  }
  g.outline((c) => ink(hund ? wick : plush));
  if (part !== 'front') return g;
  const f = new Grid(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = g.get(x, y);
    if (c >= 0 && !innerMask[y * W + x] && y + 0.5 >= cy + ry * 0.45) f.set(x, y, c);
  }
  return f;
}

// ---------- kaninbur (två lager så att kaninen kan sitta inuti) ----------
const CAGE = { W: 33, H: 24, tray: 5, floorF: 18, floorB: 11, wallH: 10 };
function paintCage(layer, dirt) {
  const { W, H, floorF, floorB, wallH } = CAGE, g = new Grid(W, H);
  const tray = 0x3c8cc4, wire = 0xd6dce4, wireD = 0x8a94a4, straw = 0xe6c65e;
  if (layer === 'back') {
    // golv med halm
    for (let y = floorB; y <= floorF; y++) for (let x = 1; x < W - 1; x++) {
      const n = hash(x, y, 5), m = hash(x >> 1, y, 6);
      let c = n > 0.72 ? 0xf6e08a : n < 0.22 ? 0xc49a3e : straw;
      if ((x + y * 3) % 7 === 0 && m > 0.4) c = 0xfff0a8; // strån
      if (y === floorB) c = mul(c, 0.8);
      c = mix(c, 0x9a8a5a, dirt * 0.45);
      g.set(x, y, c);
    }
    // kaninbajs i halmen
    const pel = [[6, 15], [22, 13], [13, 16], [27, 16], [9, 12], [18, 15], [25, 12], [4, 13]];
    for (let i = 0; i < Math.round(dirt * pel.length); i++) { const [x, y] = pel[i]; g.set(x, y, 0x4a3018); g.set(x + 1, y, 0x5e3c20); }
    // bakväggens galler
    for (let y = floorB - wallH; y < floorB; y++) for (let x = 1; x < W - 1; x++) if (x % 3 === 1) g.set(x, y, mix(wire, 0x9aa4b0, 0.45));
    g.rect(1, floorB - wallH, W - 2, 1, wireD);
    // höhäck (vänster) och vattenflaska (höger) på bakväggen
    g.rows(4, 2, ['#######', '#hHhHh#', '.#hHh#.', '..###..'], { '#': 0x6a7480, h: 0x9ab84a, H: 0xd8c860 });
    g.rows(25, 1, ['.##.', '#bb#', '#BB#', '#BB#', '#BB#', '.##.', '.gg.', '..g.'], { '#': 0x6a8aa8, b: 0xd8eef8, B: 0x7ac0e8, g: 0xa0a8b0 });
    return g;
  }
  // FRAMDEL: framgaller, tak, stolpar, plastbricka
  const top = floorF - wallH;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c = -1;
    const post = x === 0 || x === W - 1;
    if (y >= floorF && y < floorF + CAGE.tray + 1) { // brickan
      if (y === floorF) c = lite(tray, 0.45);
      else if (y === floorF + CAGE.tray) c = ink(tray);
      else c = x < 5 ? lite(tray, 0.15) : x > W - 6 ? mul(tray, 0.82) : tray;
      if (y === floorF + 2 && x > 3 && x < W - 4 && x % 6 === 0) c = mul(tray, 0.7); // ventilhål
      if (post && y !== floorF) c = ink(tray);
    } else if (y < floorF) {
      if (post && y >= 0) c = y < top ? wireD : mix(wire, wireD, 0.5);
      else if (y === top || y === 0) c = y === 0 ? wireD : wire;                // takets fram-/bakkant
      else if (y > top && x % 3 === 1) c = (x % 6 === 1) ? wire : mix(wire, 0xffffff, 0.2); // framgaller
      else if (y < top && x % 6 === 1) c = mix(wire, 0x9aa4b0, 0.25);            // takgaller (glesare)
      else if (y < top && y % 3 === 0 && x > 0 && x < W - 1) c = mix(wire, 0x9aa4b0, 0.45);
    }
    if (c >= 0) g.set(x, y, c);
  }
  // dörren mitt fram + regel
  const dx0 = 12, dx1 = 20, dy0 = top + 2, dy1 = floorF - 1;
  for (let x = dx0; x <= dx1; x++) { g.set(x, dy0, 0xf2f4f8); g.set(x, dy1, 0xb8c0cc); }
  for (let y = dy0; y <= dy1; y++) { g.set(dx0, y, 0xf2f4f8); g.set(dx1, y, 0xb8c0cc); }
  g.set(dx1 + 1, dy0 + 3, 0xe8c040); g.set(dx1 + 1, dy0 + 4, 0xb89020);
  // handtag på taket
  g.rows(13, -1, ['.#####.', '#.....#'], { '#': wireD });
  return g;
}

// ---------- klösträd ----------
function paintTree(t) {
  const W = 19, H = 34, g = new Grid(W, H);
  const carpet = 0x9a8e84, sisal = 0xd8c08a, sisalD = 0xa88a58, pad = 0xb4a6c8;
  const oval = (cx, cy, rx, ry, depth, col) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry + depth; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const top = inEll(x, y, cx, cy, rx, ry);
      const dx = (x + 0.5 - cx) / rx;
      let front = false;
      if (Math.abs(dx) < 1) { const yb = cy + ry * Math.sqrt(1 - dx * dx); front = y + 0.5 >= cy && y + 0.5 < yb + depth; }
      if (!top && !front) continue;
      let c = top && !front ? lite(col, 0.22) : col;
      if (top && !front && (y + 0.5) < cy - ry * 0.3) c = lite(col, 0.32);
      if (front && !top) c = x + 0.5 < cx - rx * 0.4 ? col : mul(col, 0.8);
      c = mix(c, 0xffffff, (hash(x, y, 9) - 0.5) * 0.08);
      g.set(x, y, c);
    }
  };
  const post = (x0, y0, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x < x0 + 3; x++) {
      let c = (y % 2 === 0) ? sisal : sisalD;
      if (x === x0) c = lite(c, 0.18); else if (x === x0 + 2) c = mul(c, 0.8);
      g.set(x, y, c);
    }
  };
  oval(9.5, 29.5, 9, 2.6, 2, carpet);        // bottenplatta
  post(3, 14, 29);                            // vänster stolpe (låg)
  post(12, 5, 29);                            // höger stolpe (hög)
  oval(6, 13.5, 5.5, 2, 2, pad);              // mellanhylla
  // topp: skål att sova i
  oval(12.5, 4.5, 6, 2.6, 2, pad);
  for (let x = 9; x <= 16; x++) g.set(x, 4, mul(pad, 0.7));
  for (let x = 10; x <= 15; x++) g.set(x, 5, mul(pad, 0.82));
  g.outline(() => ink(0x6a5a70));
  return g;
}

// ---------- matsäckar ----------
function paintSack(k, frac) {
  const d = PET_ITEMS[k], W = d.w, H = d.h, g = new Grid(W, H);
  const col = { 'sack-katt': 0x7a4aa8, 'sack-hund': 0xc03a2e, 'sack-kanin': 0x4e9a3c }[k];
  const low = frac < 0.35 ? 3 : frac < 0.7 ? 1 : 0; // säcken sjunker ihop när den töms
  const top = 1 + low;
  for (let y = top; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const bulge = y > H * 0.45 ? 0 : 1;             // lite smalare upptill
    if (x < 1 + bulge || x > W - 2 - bulge) continue;
    if (y === H - 2 && (x === 1 || x === W - 2)) continue; // runda hörn nertill
    let c = col;
    if (x <= 2) c = lite(col, 0.22); else if (x >= W - 3) c = mul(col, 0.78);
    if (y <= top + 1) c = y === top ? lite(col, 0.55) : mix(lite(col, 0.4), 0x000000, (x % 2) * 0.12); // förslutning (krusad)
    if (low && y === top + 2 && x % 3 === 0) c = mul(col, 0.7);   // veck
    g.set(x, y, c);
  }
  // etikett + tryck
  const lx0 = 3, lx1 = W - 4, ly0 = top + 4, ly1 = Math.min(H - 4, ly0 + 7);
  for (let y = ly0; y <= ly1; y++) for (let x = lx0; x <= lx1; x++) g.set(x, y, y === ly0 ? 0xffffff : 0xf2ece0);
  const cx = Math.floor((lx0 + lx1) / 2), cy = ly0 + 2;
  if (k === 'sack-katt') {
    g.rows(cx - 2, cy, ['#...#', '##.##', '#####', '#o#o#', '.###.'], { '#': 0xe08a3a, o: 0x2a2230 }); // katthuvud
  } else if (k === 'sack-hund') {
    g.rows(cx - 3, cy + 1, ['#.....#', '#######', '#.....#'].map((r) => r.replace(/\./g, '.')), { '#': 0xb8864a }); // ben
    g.rows(cx - 3, cy + 1, ['##...##', '.#####.', '##...##'], { '#': 0xe8d4b0 });
  } else {
    g.rows(cx - 1, cy - 1, ['.gg.', '..g.', '.oo.', '.oo.', '.o..'], { g: 0x4aa040, o: 0xe8802a }); // morot
  }
  // tryckt rand under etiketten
  if (ly1 + 1 < H - 2) for (let x = 2; x < W - 2; x++) g.set(x, ly1 + 1, mix(col, 0xf0d060, 0.6));
  g.outline(() => ink(col));
  return g;
}

// ---------- boll, ben, koppel ----------
function paintBall(rot) {
  const g = new Grid(5, 5);
  const R = 0xd8343a, Y = 0xf2c840;
  const stripe = [[0, 1, 2], [1, 2, 3], [2, 3, 1], [3, 1, 2]][rot & 3];
  const rows = ['.###.', '#ooo#', '#ooo#', '#ooo#', '.###.'];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    if (rows[y][x] === '.') continue;
    if (rows[y][x] === '#') { g.set(x, y, 0x5a1a22); continue; }
    let c = y === stripe[0] + 1 ? Y : R;
    if (x === 1 && y === 1) c = lite(c, 0.55);
    if (x === 3 && y === 3) c = mul(c, 0.75);
    g.set(x, y, c);
  }
  return g;
}
function paintBone() {
  const g = new Grid(11, 5);
  g.rows(0, 0, [
    '.oo.....oo.',
    'oWWo...oWso',
    '.oWWWWWWso.',
    'oWWssssssso',
    '.oo.....oo.',
  ], { o: 0x7a6a58, W: 0xf6eedc, s: 0xd2c4a8 });
  return g;
}
// Gnagmoroten: en morot av flätad pil (rutigt fläta-mönster) med en grön blasttofs, liggande
// på golvet med spetsen åt vänster – kaninens leksak.
function paintCarrotToy() {
  const g = new Grid(12, 6);
  g.rows(0, 0, [
    '.........G.H',
    '......ooogGg',
    '...oooLLLOg.',
    '.oodOdOdOdo.',
    'oOdOdOdOdo..',
    '.oooooooo...',
  ], { o: 0x7a3a14, O: 0xe8802a, d: 0xc4621e, L: 0xf6b060, g: 0x2f7a3a, G: 0x5cb040, H: 0x9ad860 });
  g.set(4, 3, 0xf6b060); // glans på den tunna delen
  return g;
}
function paintLeash() {
  const g = new Grid(11, 7);
  const r = 0xc03a3a;
  for (let y = 0; y < 7; y++) for (let x = 0; x < 11; x++) {
    const a = Math.hypot((x + 0.5 - 5) / 4.6, (y + 0.5 - 3.6) / 2.6);
    const b = Math.hypot((x + 0.5 - 5.6) / 3.2, (y + 0.5 - 3.2) / 1.7);
    if (Math.abs(a - 0.85) < 0.2) g.set(x, y, y < 3 ? lite(r, 0.25) : r);
    else if (Math.abs(b - 0.8) < 0.22) g.set(x, y, y < 3 ? r : mul(r, 0.8));
  }
  g.set(9, 5, 0xc8ccd4); g.set(10, 5, 0x8a909a); g.set(9, 6, 0x8a909a); // karbinhake
  g.outline(() => ink(r));
  return g;
}

// ======================================================================
//  Cache + ritning
// ======================================================================
const cache = new Map();
function sprite(key, make) {
  let c = cache.get(key);
  if (!c) {
    const g = make();
    c = { img: g.canvas(), w: g.w, h: g.h };
    if (cache.size > 400) cache.delete(cache.keys().next().value);
    cache.set(key, c);
  }
  return c;
}
const q = (v, n) => Math.round(Math.max(0, Math.min(1, +v || 0)) * n);

function spriteFor(id, s) {
  switch (PET_ITEMS[id]?.typ) {
    case 'skal': { const lv = q(s.food, 20); return sprite(`skal|${lv}|${s.foodKind || ''}`, () => paintBowl('mat', lv / 20, s.foodKind, 0)); }
    case 'vatten': { const lv = q(s.water ?? 1, 4), gl = Math.floor((s.t || 0) * 1.5) % 2; return sprite(`vatten|${lv}|${gl}`, () => paintBowl('vatten', lv / 4, null, gl)); }
    case 'lada': { const lv = q(s.dirt, 8); return sprite(`lada|${lv}`, () => paintLitter(lv / 8)); }
    case 'sang': return s.layer === 'front' ? sprite(id + '|f', () => paintBasket(id, 'front')) : sprite(id, () => paintBasket(id));
    case 'klos': return sprite('klos', () => paintTree(0));
    case 'leksak':
      if (id === 'leksak-boll') { const r = (s.rot | 0) & 3; return sprite('boll|' + r, () => paintBall(r)); }
      if (id === 'leksak-morot') return sprite('morot', paintCarrotToy);
      return sprite('ben', paintBone);
    case 'sack': {
      const def = PET_ITEMS[id];
      const f = s.frac ?? (s.left != null ? s.left / def.portioner : 1);
      const lv = f < 0.35 ? 0 : f < 0.7 ? 1 : 2;
      return sprite(`${id}|${lv}`, () => paintSack(id, [0.2, 0.5, 1][lv]));
    }
    case 'koppel': return sprite('koppel', paintLeash);
    default: return null;
  }
}

function shadow(ctx, x, y, w) {
  ctx.fillStyle = 'rgba(20,12,28,0.22)';
  ctx.fillRect(x - (w >> 1) + 1, y - 1, w - 2, 2);
  ctx.fillRect(x - (w >> 1) + 3, y + 1, Math.max(1, w - 6), 1);
}

export function drawPetItem(ctx, id, x, y, state = {}) {
  const def = PET_ITEMS[id];
  if (!def) return;
  x = Math.round(x); y = Math.round(y);
  const s = state || {};
  const layer = s.layer || 'all';
  if (s.ghost) ctx.globalAlpha = 0.6;
  if (id === 'kaninbur') {
    const { W, H } = CAGE, lv = q(s.dirt, 8), x0 = x - (W >> 1), y0 = y - H;
    if (layer !== 'front') {
      shadow(ctx, x, y + 1, W + 2);
      ctx.drawImage(sprite(`bur-b|${lv}`, () => paintCage('back', lv / 8)).img, x0, y0);
    }
    if (layer !== 'back') ctx.drawImage(sprite('bur-f', () => paintCage('front', 0)).img, x0, y0);
  } else {
    const sp = spriteFor(id, s);
    if (!sp) return;
    const x0 = x - (sp.w >> 1), y0 = y - sp.h;
    if (layer === 'front') { if (def.typ === 'sang') ctx.drawImage(sp.img, x0, y0); } // korgens framkant över djuret
    else {
      if (def.typ !== 'leksak') shadow(ctx, x, y, sp.w);
      else { ctx.fillStyle = 'rgba(20,12,28,0.25)'; ctx.fillRect(x - (sp.w >> 1), y - 1, sp.w, 1); }
      if (id === 'kattklostrad') drawPompom(ctx, x0, y0, s.t || 0, false);
      ctx.drawImage(sp.img, x0, y0);
      if (id === 'kattklostrad') drawPompom(ctx, x0, y0, s.t || 0, true);
      if (def.typ === 'lada' && (s.dirt || 0) >= 0.7) drawFlies(ctx, x, y0 + 3, s.t || 0);
    }
  }
  if ((s.hover || s.bad) && layer !== 'back') {
    const b = itemBox(id);
    ctx.fillStyle = s.bad ? 'rgba(230,60,60,0.85)' : 'rgba(255,210,63,0.9)';
    const bx = x + b.x0, by = y + b.y0, bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    // hörnmarkeringar i stället för en hel ram
    for (const [cx, cy, sx, sy] of [[bx, by, 1, 1], [bx + bw - 1, by, -1, 1], [bx, by + bh - 1, 1, -1], [bx + bw - 1, by + bh - 1, -1, -1]]) {
      ctx.fillRect(cx, cy, 1, 1); ctx.fillRect(cx + sx, cy, 1, 1); ctx.fillRect(cx, cy + sy, 1, 1);
    }
  }
  if (s.ghost) ctx.globalAlpha = 1;
}

// pompom i ett snöre under mellanhyllan – svänger mjukt (heltalspixlar)
function drawPompom(ctx, x0, y0, t, front) {
  const ax = x0 + 3, ay = y0 + 16;
  const sw = Math.round(Math.sin(t * 2.2) * 2);
  const bx = ax + sw, by = ay + 6;
  if (!front) {
    ctx.fillStyle = '#e8e0d0';
    const n = 6;
    for (let i = 1; i < n; i++) ctx.fillRect(Math.round(ax + (bx - ax) * i / n), ay + i, 1, 1);
    return;
  }
  ctx.fillStyle = '#7a2a4a'; ctx.fillRect(bx - 1, by, 3, 2); ctx.fillRect(bx, by - 1, 1, 4);
  ctx.fillStyle = '#e04a7a'; ctx.fillRect(bx - 1, by, 2, 1); ctx.fillRect(bx, by - 1, 1, 2);
  ctx.fillStyle = '#ff9cc0'; ctx.fillRect(bx - 1, by, 1, 1);
}
function drawFlies(ctx, x, y, t) {
  for (let k = 0; k < 2; k++) {
    const a = t * (2.1 + k * 0.8) + k * 2.4;
    const fx = x + Math.round(Math.cos(a) * (6 - k)), fy = y - 3 + Math.round(Math.sin(a * 1.4) * 2);
    ctx.fillStyle = '#17151a'; ctx.fillRect(fx, fy, 1, 1);
    ctx.fillStyle = (Math.floor(t * 18 + k) % 2) ? 'rgba(220,235,255,0.85)' : 'rgba(220,235,255,0.35)';
    ctx.fillRect(fx - 1, fy - 1, 1, 1); ctx.fillRect(fx + 1, fy - 1, 1, 1);
  }
}

// Ikon för menyer/dialoger: föremålet centrerat i en ruta på (x, y), heltalsskala.
export function drawItemIcon(ctx, id, x, y, scale = 1, state = {}) {
  const def = PET_ITEMS[id];
  if (!def) return;
  scale = Math.max(1, Math.round(scale));
  const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!cv) return;
  const W = Math.max(def.w, 11) + 4, H = def.h + 4;
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  drawPetItem(c, id, W >> 1, H - 2, { food: 1, foodKind: def.art || 'katt', water: 1, dirt: 0, ...state });
  const was = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, Math.round(x), Math.round(y), W * scale, H * scale);
  ctx.imageSmoothingEnabled = was;
}
