// Procedurgenererade pixelpersoner (~16×32 px). Varje figur ritas pixel för pixel
// i en liten sprite (24×40) med skuggning och mörk kontur, och cachas per
// utseende + riktning + bildruta. Fötterna står vid (x, y).
//
// frame: 0 stå · 1/2 gångsteg · 3 mellansteg (kroppen upp 1 px) · 4 andas in · 5 sitter

// Slumptabellerna för kunder (dubbletter = vanligare). Ändra inte ordning/innehåll –
// makeLook(rng) måste ge samma kunder som förut.
export const SKIN = ['#f6d7bf', '#eec3a0', '#e0a97f', '#c68a5c', '#a06a43', '#744a2d', '#553522'];
export const HAIR = ['#1d1714', '#1d1714', '#3b2619', '#3b2619', '#6b4226', '#a5692f', '#d9a95c', '#ecd489', '#b9b3ab', '#e6e2da', '#b7392b', '#3f4fa8', '#c65fa0', '#2f8f6f'];
export const SHIRT = ['#d9433b', '#3a7bd5', '#46a35a', '#f0b429', '#8e5bd1', '#2f3440', '#e8e3d6', '#e07a2e', '#2aa39a', '#b83d7a', '#5f7f99', '#f4f1ea', '#7a2e3e', '#26605a'];
export const PANTS = ['#3f5f8f', '#2d3a5c', '#2b2b30', '#9a8560', '#6f7c8a', '#5a4632', '#556b3a', '#7a2e2e'];
export const SHOES = ['#1c1c1c', '#f2f2f2', '#6b3e1e', '#c23b3b', '#3a6bc2', '#e0b24a', '#2f2f36'];
export const STYLES = ['short', 'short', 'side', 'long', 'long', 'ponytail', 'bun', 'curly', 'afro', 'spiky', 'bald', 'mohawk', 'bob', 'buzz'];
export const TOPS = ['tee', 'tee', 'stripes', 'hoodie', 'hoodie', 'jacket', 'sweater'];
export const BOTTOMS = ['jeans', 'jeans', 'pants', 'pants', 'shorts', 'skirt'];
export const PHONE_COLORS = ['#e8e8e8', '#222228', '#c9323a', '#3a7bd5'];
export const BAG_COLORS = ['#2f3440', '#c9323a', '#3a7bd5', '#46a35a', '#e0a02a', '#6b4a33', '#8e5bd1'];

// Alla giltiga värden (även sådana som bara avatarer använder – kunder slumpas aldrig fram dem)
export const HAIR_STYLES = ['short', 'side', 'long', 'ponytail', 'bun', 'curly', 'afro', 'spiky', 'bald', 'mohawk', 'bob', 'buzz', 'braids', 'pigtails', 'wavy'];
export const TOP_TYPES = ['tee', 'stripes', 'hoodie', 'jacket', 'sweater', 'shirt'];
export const BOTTOM_TYPES = ['jeans', 'pants', 'shorts', 'skirt', 'dress'];
export const HAT_TYPES = [null, 'cap', 'beanie', 'headband', 'bow', 'crown'];
export const GLASSES_TYPES = [false, 'square', 'round', 'sun'];
export const BEARD_TYPES = [false, 'full', 'mustache', 'stubble', 'goatee'];
export const BAG_TYPES = [null, 'backpack', 'shoulder'];
export const BUILDS = [4, 5, 6];

export const FIRST_NAMES = ['Alva', 'Elsa', 'Maja', 'Ella', 'Wilma', 'Saga', 'Nora', 'Vera', 'Liv', 'Stina', 'Ines', 'Greta',
  'Oscar', 'Liam', 'Noah', 'Hugo', 'William', 'Elias', 'Ludvig', 'Sixten', 'Vincent', 'Frans', 'Kalle', 'Bosse',
  'Ahmed', 'Leila', 'Yusuf', 'Mira', 'Kenji', 'Aiko', 'Mateo', 'Sofia', 'Ivan', 'Olga', 'Birgitta', 'Gunnar', 'Sven', 'Agneta'];

const pick = (rng, a) => a[Math.floor(rng() * a.length)];

export function makeLook(rng = Math.random) {
  const kid = rng() < 0.18;
  const style = pick(rng, STYLES);
  const r = rng();
  const hat = r < 0.14 ? 'cap' : r < 0.22 ? 'beanie' : null;
  const bag = rng() < (kid ? 0.45 : 0.22) ? 'backpack' : rng() < 0.15 ? 'shoulder' : null;
  const gl = rng();
  const look = {
    skin: pick(rng, SKIN), hair: pick(rng, HAIR), style,
    top: pick(rng, TOPS), shirt: pick(rng, SHIRT), accent: pick(rng, SHIRT),
    bottom: pick(rng, BOTTOMS), pants: pick(rng, PANTS), shoes: pick(rng, SHOES),
    hat, cap: pick(rng, SHIRT),
    glasses: gl < 0.16 ? 'square' : gl < 0.24 ? 'round' : gl < 0.28 ? 'sun' : false,
    beard: !kid && rng() < 0.2 ? pick(rng, ['full', 'full', 'mustache', 'stubble']) : false,
    phones: rng() < 0.12, phoneColor: pick(rng, PHONE_COLORS),
    bag, bagColor: pick(rng, BAG_COLORS),
    build: kid ? 4 : pick(rng, [4, 5, 5, 6]),
    blush: rng() < 0.35,
    kid,
  };
  return look;
}

export const SHOPKEEPER = {
  skin: '#eabf98', hair: '#4a2f1d', style: 'short', hat: 'cap', cap: '#c9323a', top: 'tee', shirt: '#c9323a', accent: '#f4f1ea',
  bottom: 'pants', pants: '#2d3a5c', shoes: '#1c1c1c', glasses: false, beard: false, phones: false, kid: false,
  apron: true, build: 5, bag: null,
};

export function shadeHex(h, f) {
  const n = parseInt(h.slice(1), 16);
  const r = Math.min(255, (n >> 16 & 255) * f) | 0, g = Math.min(255, (n >> 8 & 255) * f) | 0, b = Math.min(255, (n & 255) * f) | 0;
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ---------- färgverktyg (heltal 0xRRGGBB) ----------
const toInt = (h, fb = 0x888888) => (typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h) ? parseInt(h.slice(1), 16) : fb);
function mul(c, f) {
  const r = Math.min(255, ((c >> 16) & 255) * f) | 0, g = Math.min(255, ((c >> 8) & 255) * f) | 0, b = Math.min(255, (c & 255) * f) | 0;
  return (r << 16) | (g << 8) | b;
}
function mix(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  return (((ar + (((b >> 16) & 255) - ar) * t) | 0) << 16) | (((ag + (((b >> 8) & 255) - ag) * t) | 0) << 8) | ((ab + ((b & 255) - ab) * t) | 0);
}
// ljus/bas/skugga/djup – ljusare toner drar lite mot varmt vitt, skuggor mot blålila
const ramp = (c) => ({ hi: mix(mul(c, 1.12), 0xfff4e0, 0.12), base: c, lo: mix(mul(c, 0.74), 0x2a1f3a, 0.12), dk: mix(mul(c, 0.5), 0x1a1426, 0.2) });

function norm(L = {}) {
  const n = { ...L };
  if (n.style === 'cap') { n.hat = 'cap'; n.style = 'short'; }
  n.style = n.style || 'short';
  if (n.glasses === true) n.glasses = 'square';
  if (n.beard === true) n.beard = 'full';
  n.top = n.top || 'tee';
  n.bottom = n.bottom || 'pants';
  n.build = n.kid ? 4 : (n.build || 5);
  return n;
}

// ---------- spriten ----------
const SW = 24, SH = 40;
const CACHE = new WeakMap();

function render(L0, dir, frame) {
  const L = norm(L0);
  const cv = document.createElement('canvas'); cv.width = SW; cv.height = SH;
  const cx = cv.getContext('2d');
  const img = cx.createImageData(SW, SH), d = img.data;
  const flip = dir === 'left';
  const side = dir === 'left' || dir === 'right';
  const back = dir === 'up';
  const put = (x, y, c) => {
    if (flip) x = SW - 1 - x;
    if (x < 0 || y < 0 || x >= SW || y >= SH) return;
    const i = (y * SW + x) * 4;
    d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; d[i + 3] = 255;
  };
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c); };
  const has = (x, y) => { if (flip) x = SW - 1 - x; return x >= 0 && y >= 0 && x < SW && y < SH && d[(y * SW + x) * 4 + 3] > 0; };
  const topAt = (x, fb) => { for (let y = 0; y < SH; y++) if (has(x, y)) return y; return fb; }; // översta ritade pixeln i kolumnen

  const K = !!L.kid;
  // klänning = kjol i tröjans färg (lite längre, utan bälte)
  const dress = L.bottom === 'dress', skirted = L.bottom === 'skirt' || dress;
  const skirtLen = (K ? 3 : 5) + (dress ? 1 : 0), bareFrom = dress && !K ? 4 : 3;
  const skin = ramp(toInt(L.skin, 0xeabf98)), hair = ramp(toInt(L.hair, 0x3b2619));
  const shirt = ramp(toInt(L.shirt, 0x3a7bd5)), acc = ramp(toInt(L.accent, 0xf4f1ea));
  const pants = ramp(toInt(dress ? L.shirt : L.pants, dress ? 0x3a7bd5 : 0x2d3a5c)), shoe = ramp(toInt(L.shoes, 0x1c1c1c));
  const capc = ramp(toInt(L.cap, 0xc9323a)), bagc = ramp(toInt(L.bagColor, 0x2f3440));
  const sole = (toInt(L.shoes, 0) === 0xf2f2f2 || L.bottom === 'shorts') ? 0xd9d6cc : 0xe9e6dc;

  const eat = frame === 6, carry = frame >= 7;
  const walkA = frame === 1 || frame === 7, walkB = frame === 2 || frame === 8, sit = frame === 5 || eat;
  const bob = sit ? 1 : (frame === 3 || frame === 4) ? -1 : 0;

  // proportioner
  const shoeTop = 37, legLen = K ? 5 : 8, hipH = K ? 1 : 2, torsoH = K ? 6 : 9, headH = K ? 11 : 12;
  const legTop = shoeTop - legLen, hipTop = legTop - hipH;
  const torsoTop = hipTop - torsoH + bob, headTop = hipTop - torsoH - headH + bob;
  const tw = L.build, lw = K ? 3 : 4;
  const eyeRow = headTop + (K ? 6 : 7);
  const armLen = K ? 5 : 8;
  const longSleeve = L.top === 'hoodie' || L.top === 'jacket' || L.top === 'sweater';

  if (!side) {
    // ---------- ben (fram/bak) ----------
    const leg = (x0, lift, left) => {
      if (sit) {
        const top = hipTop + bob + hipH;
        const skinLap = L.bottom === 'shorts';
        const lap = skinLap ? skin : pants;
        rect(x0 - (left ? 1 : 0), top, lw + 1, 3, lap.base);
        rect(x0 - (left ? 1 : 0), top, lw + 1, 1, lap.hi);
        rect(x0 - (left ? 1 : 0), top + 2, lw + 1, 1, lap.lo);
        if (skirted) rect(x0 - (left ? 1 : 0), top, lw + 1, 2, pants.base);
        const shin = shoeTop - (top + 3);
        const skinLeg = L.bottom === 'shorts' || skirted;
        rect(x0, top + 3, lw, shin, skinLeg ? skin.base : pants.base);
        rect(left ? x0 : x0 + lw - 1, top + 3, 1, shin, skinLeg ? skin.lo : pants.lo);
      } else {
        const len = legLen - lift;
        const shorts = L.bottom === 'shorts', skirt = skirted;
        for (let j = 0; j < len; j++) {
          const y = legTop + j;
          const bare = (shorts && j >= 3) || (skirt && j >= bareFrom);
          const base = bare ? (skirt ? mix(skin.base, 0x2a2430, 0.15) : skin.base) : pants.base;
          const lo = bare ? skin.lo : pants.lo, hi = bare ? skin.hi : pants.hi;
          rect(x0, y, lw, 1, base);
          put(left ? x0 : x0 + lw - 1, y, left ? hi : lo);
          put(left ? x0 + lw - 1 : x0, y, lo);
          if (L.bottom === 'jeans' && j === 4 && !bare) put(x0 + 1, y, hi);
        }
      }
      // sko
      const sy = shoeTop - (sit ? 0 : lift);
      const sx = left ? x0 - 1 : x0;
      rect(sx, sy, lw + 1, 1, shoe.base);
      put(left ? sx + 1 : sx + lw - 1, sy, shoe.hi);
      rect(sx, sy + 1, lw + 1, 1, L.shoes === '#1c1c1c' || L.shoes === '#2f2f36' ? shoe.lo : sole);
      if (back) rect(sx + 1, sy, lw - 1, 1, shoe.lo);
    };
    leg(12 - lw, walkB ? 2 : 0, true);
    leg(12, walkA ? 2 : 0, false);

    // ---------- höfter / kjol ----------
    const hy = hipTop + (sit ? bob : 0);
    rect(12 - tw, hy, tw * 2, hipH, pants.base);
    if (skirted) {
      for (let j = 0; j < skirtLen; j++) {
        const w = tw + Math.min(2, (j + 1) >> 1);
        rect(12 - w, hy + j, w * 2, 1, pants.base);
        put(12 - w, hy + j, pants.hi); put(11 + w, hy + j, pants.lo);
        if (j === skirtLen - 1) rect(12 - w, hy + j, w * 2, 1, pants.lo);
      }
      if (dress && !back) for (let j = 1; j < skirtLen - 1; j += 2) put(12 - tw + 2 + (j % 4 === 1 ? 0 : 1), hy + j, pants.lo); // veck
    } else if (!K) {
      rect(12 - tw, hy, tw * 2, 1, mix(pants.dk, 0x1c1814, 0.4)); // bälte
      if (!back) rect(11, hy, 2, 1, 0xc9b27a);
    }
    if (!sit && !dress) put(11, legTop, pants.dk), put(12, legTop, pants.dk);

    // ---------- bål ----------
    const ty0 = torsoTop, ty1 = hipTop + (sit ? bob : 0); // [ty0, ty1)
    const topCol = L.apron && !back ? shirt : shirt;
    for (let y = ty0; y < ty1; y++) {
      const inset = y === ty0 ? 1 : 0;
      rect(12 - tw + inset, y, tw * 2 - inset * 2, 1, topCol.base);
      put(12 - tw + inset, y, topCol.hi);
      put(11 + tw - inset, y, topCol.lo); put(10 + tw - inset, y, y > ty0 + 1 ? topCol.lo : topCol.base);
    }
    rect(12 - tw + 1, ty1 - 1, tw * 2 - 2, 1, topCol.lo); // nedre veck
    if (L.top === 'stripes') for (let y = ty0 + 2; y < ty1 - 1; y += 2) { rect(13 - tw, y, tw * 2 - 3, 1, acc.base); put(10 + tw, y, acc.lo); }
    if (L.top === 'hoodie') {
      if (!back) {
        rect(12 - tw + 1, ty0, tw * 2 - 2, 1, shirt.lo);
        put(10, ty0 + 1, 0xf2f0ea); put(10, ty0 + 2, 0xf2f0ea); put(13, ty0 + 1, 0xf2f0ea); put(13, ty0 + 3, 0xf2f0ea);
        rect(12 - tw + 2, ty1 - 3, tw * 2 - 4, 1, shirt.lo); // magficka
      } else {
        rect(9, ty0, 6, 3, shirt.lo); rect(10, ty0, 4, 2, shirt.base); put(10, ty0, shirt.hi);
      }
    }
    if (L.top === 'jacket' && !back) {
      rect(11, ty0, 2, ty1 - ty0, acc.base); put(11, ty0 + 1, acc.hi);
      put(10, ty0, shirt.hi); put(13, ty0, shirt.hi); put(10, ty0 + 1, shirt.lo); put(13, ty0 + 1, shirt.lo);
    }
    if (!back && (L.top === 'tee' || L.top === 'stripes')) { rect(11, ty0, 2, 1, skin.lo); if (!K) put(11, ty0 + 1, skin.lo), put(12, ty0 + 1, skin.lo); }
    if (!back && L.top === 'sweater') { rect(10, ty0, 4, 1, shirt.lo); rect(11, ty0, 2, 1, skin.lo); }
    if (L.top === 'shirt') { // skjorta: krage + knappar i detaljfärgen
      if (!back) {
        rect(11, ty0, 2, 1, skin.lo); put(11, ty0 + 1, skin.lo);
        put(10, ty0, acc.hi); put(13, ty0, acc.hi); put(10, ty0 + 1, acc.base); put(12, ty0 + 1, acc.base); put(13, ty0 + 1, acc.lo);
        for (let y = ty0 + 2; y < ty1 - 1; y++) put(11, y, shirt.lo);
        for (let y = ty0 + 3; y < ty1 - 1; y += 2) put(12, y, acc.base);
      } else rect(10, ty0, 4, 1, acc.base);
    }
    if (!back && L.top === 'tee' && !L.apron && !K) { rect(13, ty0 + 3, 2, 2, acc.base); put(13, ty0 + 3, acc.hi); }
    if (L.apron) {
      if (!back) {
        rect(12 - tw + 1, ty0 + 2, tw * 2 - 2, legTop + 3 - (ty0 + 2), 0xf2eee4);
        for (let y = ty0 + 2; y < legTop + 3; y++) put(10 + tw, y, 0xcfc8b8);
        rect(12 - tw + 1, legTop + 2, tw * 2 - 2, 1, 0xd8d1c1);
        put(10, ty0, 0xf2eee4); put(10, ty0 + 1, 0xf2eee4); put(13, ty0, 0xf2eee4); put(13, ty0 + 1, 0xf2eee4);
        rect(10, ty0 + 6, 4, 1, 0xd8d1c1); // ficka
        rect(9, ty0 + 3, 2, 1, 0xe8b230); // namnbricka
      } else {
        for (let i = 0; i < 4; i++) { put(9 + i, ty0 + 1 + i, 0xf2eee4); put(14 - i, ty0 + 1 + i, 0xf2eee4); }
        rect(11, hipTop - 1, 2, 2, 0xf2eee4); put(10, hipTop, 0xe6e0d2); put(13, hipTop, 0xe6e0d2);
      }
    }
    // väskor
    if (L.bag === 'backpack') {
      if (back) {
        rect(12 - tw + 1, ty0 + 1, tw * 2 - 2, (K ? 6 : 9), bagc.base);
        rect(12 - tw + 1, ty0 + 1, tw * 2 - 2, 1, bagc.hi);
        put(12 - tw + 1, ty0 + 2, bagc.hi);
        for (let y = ty0 + 2; y < ty0 + (K ? 7 : 10); y++) put(10 + tw, y, bagc.lo);
        rect(12 - tw + 2, ty0 + (K ? 4 : 5), tw * 2 - 4, 1, bagc.dk);
        rect(11, ty0, 2, 1, bagc.lo);
      } else {
        for (let y = ty0; y < ty0 + (K ? 4 : 6); y++) { put(12 - tw + 1, y, bagc.lo); put(10 + tw, y, bagc.lo); }
      }
    }
    if (L.bag === 'shoulder') {
      const n = ty1 - ty0;
      for (let i = 0; i < n; i++) put(back ? 10 + tw - Math.round(i * (tw * 2 - 3) / n) : 13 - tw + Math.round(i * (tw * 2 - 3) / n), ty0 + i, bagc.dk);
      const bx = back ? 12 - tw - 3 : 11 + tw;
      rect(bx, ty1 - 3, 4, 4, bagc.base); rect(bx, ty1 - 3, 4, 1, bagc.hi); put(bx + 3, ty1, bagc.lo);
    }

    // ---------- armar ----------
    const arm = (left, swing) => {
      const x0 = left ? 12 - tw - 2 : 12 + tw;
      if (eat) {   // sitter och äter: överarmen ner, underarmen upp mot munnen
        for (let j = 0; j < 3; j++) { const y = torsoTop + 1 + j, c = longSleeve || j < 2 ? shirt : skin; put(x0, y, left ? c.hi : c.base); put(x0 + 1, y, left ? c.base : c.lo); }
        for (let k = 0; k < 4; k++) { const x = left ? x0 + 1 + k : x0 - k, y = torsoTop + 3 - k; put(x, y, k < 2 && longSleeve ? shirt.base : skin.base); }
        put(left ? 11 : 12, torsoTop - 1, skin.lo); put(left ? 10 : 13, torsoTop - 1, skin.base);   // händerna vid munnen
        put(left ? x0 + 1 : x0, torsoTop, shirt.base);
        return;
      }
      if (carry) {   // bär tallriken: armarna framåt, händerna ihop framför magen
        const len = armLen - 2;
        for (let j = 0; j < len; j++) { const y = torsoTop + 1 + j, inward = Math.round(j / len * (tw + 1)), x = left ? x0 + inward : x0 - inward, c = j >= len - 2 ? skin : (longSleeve || j < 3) ? shirt : skin; put(x, y, left ? c.hi : c.base); put(x + 1, y, left ? c.base : c.lo); }
        put(left ? x0 + 1 : x0, torsoTop, shirt.base);
        return;
      }
      const len = sit ? armLen : armLen + swing;
      const sleeve = longSleeve ? len - 2 : Math.min(3, len - 2);
      for (let j = 0; j < len; j++) {
        const y = torsoTop + 1 + j;
        const isHand = j >= len - 2;
        const cloth = j < sleeve;
        const c = isHand ? skin : cloth ? (L.top === 'stripes' && j % 2 === 1 ? acc : shirt) : skin;
        put(x0, y, left ? c.hi : c.base); put(x0 + 1, y, left ? c.base : c.lo);
        if (isHand && j === len - 1) { put(x0, y, c.base); put(x0 + 1, y, c.lo); }
      }
      put(left ? x0 + 1 : x0, torsoTop, shirt.base); // axel
      if (sit) { put(left ? x0 + 2 : x0 - 1, torsoTop + len, skin.base); put(left ? x0 + 3 : x0 - 2, torsoTop + len, skin.lo); }
    };
    const sw = walkA ? 1 : walkB ? -1 : 0;
    arm(true, sw); arm(false, -sw);

    // ---------- huvud ----------
    const h0 = headTop;
    for (let j = 0; j < headH; j++) {
      const y = h0 + j;
      let x0 = 7, x1 = 16;
      if (j === 0) { x0 = 8; x1 = 15; }
      if (j === headH - 2) { x0 = 8; x1 = 15; }
      if (j === headH - 1) { x0 = 9; x1 = 14; }
      rect(x0, y, x1 - x0 + 1, 1, skin.base);
      put(x1, y, skin.lo);
    }
    rect(9, h0 + headH - 1, 6, 1, skin.lo); // haka-skugga
    // öron
    rect(6, eyeRow - 1, 1, 3, skin.base); put(6, eyeRow, skin.lo);
    rect(17, eyeRow - 1, 1, 3, skin.lo);

    if (!back) {
      // ansikte
      const eye = 0x2a1d1a;
      if (K) { rect(8, eyeRow - 1, 2, 2, eye); rect(14, eyeRow - 1, 2, 2, eye); put(8, eyeRow - 1, 0xffffff); put(14, eyeRow - 1, 0xffffff); }
      else { rect(9, eyeRow - 1, 1, 2, eye); rect(14, eyeRow - 1, 1, 2, eye); }
      if (!K) { rect(8, eyeRow - 3, 3, 1, hair.lo); rect(13, eyeRow - 3, 3, 1, hair.lo); }
      put(12, eyeRow + 2, skin.lo); // näsa
      const lip = mix(skin.lo, 0xa0303a, 0.35);
      rect(11, eyeRow + (K ? 3 : 4), 2, 1, lip);
      if (L.blush || K) { put(8, eyeRow + 2, mix(skin.base, 0xe06070, 0.35)); put(15, eyeRow + 2, mix(skin.lo, 0xe06070, 0.35)); }
      if (L.beard === 'full') { for (let y = eyeRow + 2; y < h0 + headH; y++) { const e = y >= h0 + headH - 1 ? 9 : y >= h0 + headH - 2 ? 8 : 7; rect(e, y, 24 - e * 2, 1, hair.base); } rect(11, eyeRow + 4, 2, 1, lip); put(12, eyeRow + 2, skin.lo); rect(8, eyeRow + 2, 8, 1, hair.lo); rect(10, eyeRow + 2, 4, 1, skin.base); }
      if (L.beard === 'mustache') rect(10, eyeRow + 3, 4, 1, hair.base);
      if (L.beard === 'stubble') for (let y = eyeRow + 3; y < h0 + headH; y++) for (let x = 8; x < 16; x++) if ((x + y) % 2 === 0 && x !== 11 && x !== 12) put(x, y, mix(skin.base, hair.base, 0.35));
      if (L.beard === 'goatee') { rect(10, eyeRow + 3, 4, 1, hair.base); put(10, eyeRow + 4, hair.lo); put(13, eyeRow + 4, hair.lo); rect(11, h0 + headH, 2, 1, hair.base); put(12, h0 + headH, hair.lo); }
      // glasögon
      if (L.glasses === 'sun') { rect(8, eyeRow - 1, 3, 2, 0x16161c); rect(13, eyeRow - 1, 3, 2, 0x16161c); rect(11, eyeRow - 1, 2, 1, 0x16161c); put(8, eyeRow - 1, 0x8fa0b8); put(13, eyeRow - 1, 0x8fa0b8); }
      else if (L.glasses) {
        const fc = L.glasses === 'round' ? 0x6b3e1e : 0x1f1f26;
        const lens = mix(skin.base, 0xd8f0ff, 0.45);
        for (const lx of [8, 13]) { rect(lx, eyeRow - 1, 3, 2, lens); put(lx + 1, eyeRow - 1, 0x2a1d1a); put(lx + 1, eyeRow, 0x2a1d1a); }
        rect(8, eyeRow - 2, 3, 1, fc); rect(13, eyeRow - 2, 3, 1, fc); rect(11, eyeRow - 1, 2, 1, fc);
        rect(8, eyeRow + 1, 3, 1, mix(fc, skin.base, 0.45)); rect(13, eyeRow + 1, 3, 1, mix(fc, skin.base, 0.45));
        put(7, eyeRow - 1, fc); put(16, eyeRow - 1, fc);
      }
    }

    // ---------- hår ----------
    const H = hair;
    const cap = (rows) => { // hårkalott
      rect(8, h0 - 1, 8, 1, H.base); rect(7, h0, 10, rows, H.base);
      rect(9, h0 - 1, 3, 1, H.hi); rect(8, h0, 2, 1, H.hi);
      for (let j = 0; j < rows; j++) put(16, h0 + j, H.lo);
    };
    const st = L.style;
    const TIE = 0xc9323a;
    // fläta: 2 px bred, flätmönster, snodd + tofs i änden. xa bredvid ansiktet, xb nedanför hakan
    const braidEnd = h0 + headH + (K ? 2 : 4);
    const braid = (xa, xb, y0, dark) => {
      const A = dark ? [H.lo, H.dk] : [H.base, H.lo], B = dark ? [H.base, H.lo] : [H.hi, H.base];
      for (let y = y0; y < braidEnd; y++) { const x = y < h0 + headH ? xa : xb, c = (y - y0) % 2 ? B : A; put(x, y, c[0]); put(x + 1, y, c[1]); }
      rect(xb, braidEnd, 2, 1, TIE); put(xb + (dark ? 1 : 0), braidEnd + 1, H.base); put(xb + (dark ? 0 : 1), braidEnd + 1, H.lo);
    };
    // tofs (råttsvans) på sidan av huvudet; x speglas med mx
    const TAIL = [[5], [4, 5], [3, 4, 5], [3, 4, 5], [3, 4], [3, 4], [4]];
    const tail = (mx, dark) => {
      TAIL.forEach((xs, j) => xs.forEach((x, i) => put(mx(x), h0 + j, j === TAIL.length - 1 ? H.lo : i === 0 && j > 1 ? (dark ? H.lo : H.hi) : dark ? H.lo : H.base)));
      put(mx(6), h0 + 1, TIE); put(mx(6), h0 + 2, TIE);
    };
    const L2R = (x) => x, R2L = (x) => 23 - x;
    if (!back) {
      switch (st) {
        case 'braids': cap(3); rect(8, h0 + 3, 3, 1, H.base); rect(13, h0 + 3, 3, 1, H.base); put(12, h0, H.lo); put(12, h0 + 1, H.lo);
          braid(6, 7, h0 + 2, false); braid(16, 15, h0 + 2, true); break;
        case 'pigtails': cap(3); rect(8, h0 + 3, 8, 1, H.base); put(10, h0 + 3, H.lo); put(13, h0 + 3, H.lo); rect(7, h0 + 3, 1, 2, H.base); rect(16, h0 + 3, 1, 2, H.lo);
          tail(L2R, false); tail(R2L, true); break;
        case 'wavy': cap(3); rect(8, h0 + 3, 3, 1, H.base); rect(13, h0 + 3, 3, 1, H.base);
          for (let j = 0; j < headH + 3; j++) {
            const y = h0 + 1 + j, out = ((j + 1) >> 1) % 2 === 1;
            rect(out ? 5 : 6, y, out ? 3 : 2, 1, H.base); rect(16, y, out ? 3 : 2, 1, H.lo);
            put(out ? 5 : 6, y, out ? H.hi : H.base); put(out ? 18 : 17, y, H.dk);
          }
          put(6, h0 + 2, H.hi); break;
        case 'short': cap(3); rect(7, h0 + 3, 1, 3, H.base); rect(16, h0 + 3, 1, 3, H.lo); rect(8, h0 + 3, 3, 1, H.base); break;
        case 'side': cap(3); rect(7, h0 + 3, 1, 3, H.base); rect(16, h0 + 3, 1, 4, H.lo); rect(11, h0 + 3, 5, 1, H.base); put(15, h0 + 4, H.lo); put(10, h0, H.lo); break;
        case 'long': cap(3); rect(8, h0 + 3, 3, 1, H.base); rect(13, h0 + 3, 3, 1, H.base);
          rect(6, h0 + 1, 2, headH + 3, H.base); rect(16, h0 + 1, 2, headH + 3, H.lo); put(6, h0 + 2, H.hi); put(6, h0 + 3, H.hi); break;
        case 'ponytail': cap(3); rect(8, h0 + 3, 4, 1, H.base); rect(7, h0 + 3, 1, 4, H.base); rect(16, h0 + 3, 1, 4, H.lo); rect(17, h0 + 4, 1, 5, H.lo); break;
        case 'bun': cap(3); rect(10, h0 - 3, 4, 2, H.base); rect(11, h0 - 4, 2, 1, H.base); put(10, h0 - 3, H.hi); put(13, h0 - 2, H.lo); rect(7, h0 + 3, 1, 3, H.base); rect(16, h0 + 3, 1, 3, H.lo); rect(12, h0 + 3, 3, 1, H.base); break;
        case 'curly': rect(7, h0 - 2, 10, 5, H.base); rect(6, h0 - 1, 12, 4, H.base); rect(6, h0 + 3, 2, 4, H.base); rect(16, h0 + 3, 2, 4, H.lo);
          for (let y = h0 - 2; y < h0 + 7; y++) for (let x = 6; x < 18; x++) if (has(x, y) && (x * 3 + y * 5) % 4 === 0) put(x, y, (x + y) % 3 ? H.hi : H.lo);
          rect(8, h0 + 3, 8, 1, H.base); break;
        case 'afro': for (let y = h0 - 5; y < h0 + 7; y++) { const dy = (y - (h0 + 0.5)) / 6.5; const hw = Math.round(Math.sqrt(Math.max(0, 1 - dy * dy)) * 8); if (y >= h0 + 3 && hw) { rect(12 - hw, y, hw - 5 + 1, 1, H.base); rect(16, y, hw - 4, 1, H.lo); } else if (hw) rect(12 - hw, y, hw * 2, 1, H.base); }
          for (let y = h0 - 5; y < h0 + 7; y++) for (let x = 3; x < 21; x++) if (has(x, y) && (x * 7 + y * 3) % 5 === 0 && (y < h0 + 3 || x < 7 || x > 16)) put(x, y, (x + y) % 2 ? H.hi : H.lo);
          break;
        case 'spiky': cap(3); for (let i = 0; i < 4; i++) { put(8 + i * 2, h0 - 2, H.base); } put(9, h0 - 3, H.hi); put(13, h0 - 3, H.base); rect(7, h0 + 3, 1, 2, H.base); rect(16, h0 + 3, 1, 2, H.lo); put(9, h0 + 3, H.base); put(13, h0 + 3, H.base); break;
        case 'bald': rect(7, eyeRow - 2, 1, 3, H.base); rect(16, eyeRow - 2, 1, 3, H.lo); put(9, h0 + 1, skin.hi); put(10, h0 + 1, skin.hi); break;
        case 'mohawk': rect(10, h0 - 3, 4, 5, H.base); put(10, h0 - 3, H.hi); put(11, h0 - 2, H.hi); rect(7, h0 + 1, 1, 4, skin.lo); break;
        case 'bob': cap(4); rect(6, h0 + 1, 2, eyeRow + 3 - h0, H.base); rect(16, h0 + 1, 2, eyeRow + 3 - h0, H.lo); rect(8, h0 + 4, 8, 1, H.lo); break;
        case 'buzz': rect(8, h0, 8, 1, H.lo); rect(7, h0 + 1, 10, 2, mix(H.base, skin.base, 0.3)); rect(7, h0 + 3, 1, 2, H.lo); rect(16, h0 + 3, 1, 2, H.lo); break;
        default: cap(3);
      }
    } else {
      switch (st) {
        case 'bald': rect(7, eyeRow - 1, 10, 2, mix(H.base, skin.base, 0.35)); rect(8, eyeRow + 1, 8, 1, mix(H.lo, skin.lo, 0.4)); put(9, h0 + 1, skin.hi); put(10, h0 + 1, skin.hi); break;
        case 'mohawk': rect(10, h0 - 3, 4, headH - 1, H.base); put(10, h0 - 3, H.hi); break;
        case 'buzz': rect(8, h0, 8, 1, H.lo); rect(7, h0 + 1, 10, headH - 4, mix(H.base, skin.base, 0.3)); break;
        case 'afro': for (let y = h0 - 5; y < h0 + 9; y++) { const dy = (y - (h0 + 1)) / 7.5; const hw = Math.round(Math.sqrt(Math.max(0, 1 - dy * dy)) * 8); if (hw) rect(12 - hw, y, hw * 2, 1, H.base); }
          for (let y = h0 - 5; y < h0 + 9; y++) for (let x = 3; x < 21; x++) if (has(x, y) && (x * 7 + y * 3) % 5 === 0) put(x, y, (x + y) % 2 ? H.hi : H.lo);
          break;
        case 'curly': rect(7, h0 - 2, 10, 2, H.base); rect(6, h0, 12, headH - 2, H.base);
          for (let y = h0 - 2; y < h0 + headH - 2; y++) for (let x = 6; x < 18; x++) if (has(x, y) && (x * 3 + y * 5) % 4 === 0) put(x, y, (x + y) % 3 ? H.hi : H.lo);
          break;
        default: {
          const long = st === 'long' || st === 'bob' || st === 'wavy';
          const bottom = st === 'long' || st === 'wavy' ? h0 + headH + 3 : st === 'bob' ? eyeRow + 3 : h0 + headH - 3;
          rect(8, h0 - 1, 8, 1, H.base); rect(7, h0, 10, bottom - h0, H.base);
          if (long) rect(6, h0 + 1, 12, bottom - h0 - 1, H.base);
          rect(9, h0 - 1, 3, 1, H.hi); rect(8, h0, 3, 1, H.hi); put(8, h0 + 1, H.hi);
          for (let y = h0; y < bottom; y++) put(long ? 17 : 16, y, H.lo);
          rect(long ? 7 : 8, bottom - 1, long ? 10 : 8, 1, H.lo);
          if (st === 'wavy') for (let y = h0 + 1; y < bottom; y++) {
            const out = ((y - h0) >> 1) % 2 === 1;
            if (out) { put(5, y, H.base); put(18, y, H.lo); }
            if (y > h0 + 1 && y < bottom - 1) { const o = out ? 1 : 0; put(9 + o, y, H.lo); put(14 - o, y, H.lo); }
          }
          if (st === 'braids') { braid(8, 8, bottom - 1, false); braid(14, 14, bottom - 1, true); put(12, h0, H.lo); put(12, h0 + 1, H.lo); }
          if (st === 'pigtails') { tail(L2R, true); tail(R2L, true); }
          if (st === 'ponytail') { rect(11, bottom, 2, K ? 5 : 7, H.base); put(12, bottom + 1, H.lo); rect(11, bottom - 1, 2, 1, 0xc9323a); }
          if (st === 'bun') { rect(10, h0 - 3, 4, 3, H.base); rect(11, h0 - 4, 2, 1, H.base); put(10, h0 - 3, H.hi); }
          if (st === 'spiky') for (let i = 0; i < 4; i++) put(8 + i * 2, h0 - 2, H.base);
        }
      }
    }

    // ---------- huvudbonader + hörlurar ----------
    if (L.hat === 'cap') {
      rect(8, h0 - 2, 8, 1, capc.base); rect(7, h0 - 1, 10, 3, capc.base);
      rect(8, h0 - 2, 3, 1, capc.hi); rect(7, h0 - 1, 2, 2, capc.hi);
      for (let y = h0 - 1; y < h0 + 2; y++) put(16, y, capc.lo);
      if (!back) { rect(6, h0 + 2, 12, 1, capc.lo); rect(7, h0 + 3, 10, 1, mix(skin.lo, 0x201818, 0.25)); rect(11, h0, 2, 1, 0xf4f1ea); }
      else { rect(7, h0 + 2, 10, 1, capc.lo); rect(11, h0 + 2, 2, 1, hair.base); }
    }
    if (L.hat === 'beanie') {
      rect(9, h0 - 3, 6, 1, capc.base); rect(8, h0 - 2, 8, 1, capc.base); rect(7, h0 - 1, 10, 3, capc.base);
      rect(7, h0 + 1, 10, 2, capc.lo); for (let x = 7; x < 17; x += 2) put(x, h0 + 1, capc.dk);
      rect(9, h0 - 3, 3, 1, capc.hi); put(8, h0 - 2, capc.hi);
      rect(11, h0 - 5, 2, 2, 0xf4f1ea); put(12, h0 - 4, 0xd8d4c8);
    }
    if (L.hat === 'headband') { // hårband längs hela frisyrens bredd
      let a = 11, b = 12;
      while (a > 0 && has(a - 1, h0)) a--;
      while (b < SW - 1 && has(b + 1, h0)) b++;
      rect(a, h0, b - a + 1, 1, capc.base); put(a, h0, capc.hi); put(b, h0, capc.lo);
    }
    if (L.hat === 'bow') { // rosett på ena sidan av huvudet
      const bx = back ? 6 : 13, by = Math.max(1, topAt(bx + 2, h0) + 1);
      put(bx, by - 1, capc.hi); put(bx + 1, by - 1, capc.base); put(bx + 3, by - 1, capc.base); put(bx + 4, by - 1, capc.lo);
      rect(bx, by, 5, 1, capc.base); put(bx, by, capc.hi); put(bx + 2, by, capc.dk); put(bx + 4, by, capc.lo);
      put(bx, by + 1, capc.lo); put(bx + 1, by + 1, capc.lo); put(bx + 3, by + 1, capc.lo); put(bx + 4, by + 1, capc.dk);
    }
    if (L.hat === 'crown') {
      const cy = Math.max(3, topAt(9, h0));
      rect(8, cy - 1, 8, 2, capc.base); rect(8, cy - 1, 8, 1, capc.hi); put(15, cy - 1, capc.base); put(15, cy, capc.lo);
      put(8, cy - 2, capc.hi); put(15, cy - 2, capc.base); rect(11, cy - 3, 2, 2, capc.base); put(11, cy - 3, capc.hi);
      if (!back) { put(9, cy, 0x3a8ae0); rect(11, cy, 2, 1, 0xd83a4a); put(14, cy, 0x3a8ae0); }
    }
    if (L.phones) {
      const pc = ramp(toInt(L.phoneColor, 0x222228));
      rect(9, h0 - 3, 6, 1, 0x2a2a30); put(8, h0 - 2, 0x2a2a30); put(15, h0 - 2, 0x2a2a30); put(7, h0 - 1, 0x2a2a30); put(16, h0 - 1, 0x2a2a30);
      rect(5, eyeRow - 2, 2, 4, pc.base); put(5, eyeRow - 2, pc.hi);
      rect(17, eyeRow - 2, 2, 4, pc.lo);
    }
  } else {
    // ================= SIDOVY (höger; vänster speglas) =================
    const legSw = walkA ? 3 : walkB ? -3 : 0;
    const legX = 11; // närmaste benets vänsterkant
    const drawLeg = (swing, far) => {
      const top = legTop, len = legLen;
      const P = far ? { hi: pants.lo, base: pants.lo, lo: pants.dk } : pants;
      const Sk = far ? { hi: skin.lo, base: skin.lo, lo: skin.dk } : skin;
      const lift = swing < 0 ? 1 : 0;
      let lastX = legX;
      for (let j = 0; j < len - lift; j++) {
        const t = (j + 1) / len;
        const x = legX + Math.round(swing * t) - (far && !swing ? 1 : 0);
        const bare = (L.bottom === 'shorts' && j >= 3) || (skirted && j >= bareFrom);
        const c = bare ? Sk : P;
        rect(x, top + j, 3, 1, c.base); put(x, top + j, c.lo); put(x + 2, top + j, c.hi);
        lastX = x;
      }
      const sy = shoeTop - lift;
      const S = far ? { base: shoe.lo, hi: shoe.lo, lo: shoe.dk } : shoe;
      rect(lastX - 1, sy, 5, 1, S.base); put(lastX + 3, sy, S.hi);
      rect(lastX - 1, sy + 1, 5, 1, L.shoes === '#1c1c1c' ? shoe.lo : far ? mix(sole, 0x000000, 0.25) : sole);
    };
    drawLeg(-legSw, true);
    // bortre arm (syns när den svänger)
    const armSw = walkA ? -3 : walkB ? 3 : 0;
    const drawArm = (swing, far) => {
      const C = far ? { hi: shirt.lo, base: shirt.lo, lo: shirt.dk } : shirt;
      const Sk = far ? { hi: skin.lo, base: skin.lo, lo: skin.dk } : skin;
      if (eat) {   // underarmen upp mot munnen
        for (let j = 0; j < 3; j++) { rect(11, torsoTop + 1 + j, 3, 1, (longSleeve || j < 2 ? C : Sk).base); }
        for (let k = 0; k < 4; k++) { const c = k < 2 && longSleeve ? C : Sk; rect(12 + k, torsoTop + 3 - k, 2, 1, c.base); put(12 + k, torsoTop + 3 - k, c.lo); }
        put(16, torsoTop - 1, Sk.base); put(15, torsoTop - 1, Sk.lo);
        return;
      }
      if (carry) {   // armen rakt fram
        for (let j = 0; j < 3; j++) rect(11, torsoTop + 1 + j, 3, 1, (longSleeve || j < 2 ? C : Sk).base);
        for (let k = 0; k < 5; k++) { const c = k < 2 && longSleeve ? C : Sk; rect(12 + k, torsoTop + 4, 2, 1, c.base); put(12 + k, torsoTop + 5, c.lo); }
        return;
      }
      const len = sit ? armLen - 2 : armLen;
      const sleeve = longSleeve ? len - 2 : 3;
      for (let j = 0; j < len; j++) {
        const t = (j + 1) / len;
        const x = 11 + Math.round(swing * t * t) + (sit ? Math.round(t * 3) : 0);
        const c = j >= len - 2 ? Sk : j < sleeve ? C : Sk;
        rect(x, torsoTop + 1 + j, 3, 1, c.base); put(x, torsoTop + 1 + j, c.lo); put(x + 2, torsoTop + 1 + j, c.hi);
      }
    };
    if (armSw) drawArm(-armSw, true);
    drawLeg(legSw, false);
    // höft
    const hy = hipTop + (sit ? bob : 0);
    rect(9, hy, 7, hipH, pants.base); put(15, hy, pants.hi);
    if (skirted) for (let j = 0; j < skirtLen; j++) { const w = Math.min(2, (j + 1) >> 1); rect(9 - w, hy + j, 7 + w * 2, 1, pants.base); put(8 + w * 0 - w, hy + j, pants.lo); }
    else if (!K) rect(9, hy, 7, 1, mix(pants.dk, 0x1c1814, 0.4));
    // ryggsäck bakom ryggen
    if (L.bag === 'backpack') {
      rect(5, torsoTop + 1, 4, K ? 6 : 8, bagc.base); rect(5, torsoTop + 1, 4, 1, bagc.hi); put(5, torsoTop + 2, bagc.lo);
      rect(6, torsoTop + (K ? 4 : 5), 3, 1, bagc.dk);
    }
    // bål
    for (let y = torsoTop; y < hipTop + (sit ? bob : 0); y++) {
      const inset = y === torsoTop ? 1 : 0;
      rect(9 + inset, y, 7 - inset, 1, shirt.base); put(9 + inset, y, shirt.lo); put(15 - inset * 0, y, shirt.hi);
      if (L.top === 'stripes' && (y - torsoTop) % 2 === 0 && y > torsoTop) rect(10, y, 5, 1, acc.base);
    }
    if (L.top === 'hoodie') { rect(8, torsoTop, 3, 3, shirt.lo); put(9, torsoTop, shirt.base); }
    if (L.top === 'jacket') { rect(15, torsoTop, 1, hipTop - torsoTop, acc.base); }
    if (L.top === 'shirt') { rect(13, torsoTop, 3, 1, acc.base); put(15, torsoTop + 1, acc.lo); }
    if (L.apron) { rect(14, torsoTop + 2, 3, legTop + 3 - torsoTop - 2, 0xf2eee4); for (let y = torsoTop + 2; y < legTop + 3; y++) put(14, y, 0xcfc8b8); put(12, torsoTop + 1, 0xf2eee4); put(13, torsoTop + 2, 0xf2eee4); }
    if (L.bag === 'backpack') { rect(10, torsoTop, 1, 5, bagc.dk); }
    if (L.bag === 'shoulder') { for (let i = 0; i < 7; i++) put(10 + (i >> 1), torsoTop + i, bagc.dk); rect(13, hipTop - 3, 4, 4, bagc.base); rect(13, hipTop - 3, 4, 1, bagc.hi); }
    // närmaste arm
    drawArm(armSw, false);

    // huvud
    const h0 = headTop;
    for (let j = 0; j < headH; j++) {
      const y = h0 + j;
      let x0 = 8, x1 = 16;
      if (j === 0) { x0 = 9; x1 = 15; }
      if (j >= headH - 2) { x0 = 10; x1 = j === headH - 1 ? 15 : 16; }
      rect(x0, y, x1 - x0 + 1, 1, skin.base);
      put(x0, y, skin.lo);
    }
    put(17, eyeRow + 1, skin.base); put(17, eyeRow + 2, skin.lo); // näsa
    const eye = 0x2a1d1a;
    if (K) { rect(14, eyeRow - 1, 2, 2, eye); put(15, eyeRow - 1, 0xffffff); } else rect(15, eyeRow - 1, 1, 2, eye);
    if (!K) rect(14, eyeRow - 3, 3, 1, hair.lo);
    put(16, eyeRow + (K ? 3 : 4), mix(skin.lo, 0xa0303a, 0.35));
    if (L.blush || K) put(14, eyeRow + 2, mix(skin.base, 0xe06070, 0.35));
    rect(11, eyeRow - 1, 2, 3, skin.base); put(11, eyeRow, skin.lo); put(12, eyeRow, skin.dk); // öra
    if (L.beard === 'full') { rect(11, eyeRow + 2, 6, h0 + headH - eyeRow - 2, hair.base); put(16, eyeRow + 4, mix(skin.lo, 0xa0303a, 0.35)); rect(11, eyeRow + 2, 1, 2, hair.lo); }
    if (L.beard === 'mustache') rect(15, eyeRow + 3, 3, 1, hair.base);
    if (L.beard === 'stubble') for (let y = eyeRow + 3; y < h0 + headH; y++) for (let x = 11; x < 17; x++) if ((x + y) % 2 === 0) put(x, y, mix(skin.base, hair.base, 0.35));
    if (L.beard === 'goatee') { rect(15, eyeRow + 3, 3, 1, hair.base); put(15, eyeRow + 4, hair.lo); rect(14, h0 + headH, 2, 1, hair.base); }
    if (L.glasses === 'sun') { rect(14, eyeRow - 1, 3, 2, 0x16161c); rect(11, eyeRow - 1, 3, 1, 0x16161c); put(15, eyeRow - 1, 0x8fa0b8); }
    else if (L.glasses) { const fc = L.glasses === 'round' ? 0x6b3e1e : 0x1f1f26; rect(12, eyeRow - 2, 5, 1, fc); put(16, eyeRow - 1, mix(fc, 0xd8f0ff, 0.3)); put(16, eyeRow, fc); put(14, eyeRow + 1, mix(fc, skin.base, 0.5)); put(15, eyeRow + 1, mix(fc, skin.base, 0.5)); }

    const H = hair, st = L.style;
    const top = (rows) => { rect(9, h0 - 1, 7, 1, H.base); rect(8, h0, 9, rows, H.base); rect(10, h0 - 1, 3, 1, H.hi); put(9, h0, H.hi); };
    switch (st) {
      case 'bald': rect(8, eyeRow - 1, 2, 3, mix(H.base, skin.base, 0.35)); put(13, h0 + 1, skin.hi); break;
      case 'buzz': rect(9, h0, 7, 1, H.lo); rect(8, h0 + 1, 8, 2, mix(H.base, skin.base, 0.3)); rect(8, h0 + 3, 3, 4, mix(H.base, skin.base, 0.3)); break;
      case 'mohawk': rect(9, h0 - 3, 7, 3, H.base); rect(8, h0, 5, 2, H.base); put(10, h0 - 3, H.hi); break;
      case 'afro': for (let y = h0 - 5; y < h0 + 8; y++) { const dy = (y - (h0 + 0.5)) / 7; const hw = Math.round(Math.sqrt(Math.max(0, 1 - dy * dy)) * 7.5); if (hw) rect(11 - hw, y, y >= h0 + 3 ? Math.max(0, hw + 1) : hw * 2, 1, H.base); }
        for (let y = h0 - 5; y < h0 + 8; y++) for (let x = 3; x < 20; x++) if (has(x, y) && (x * 7 + y * 3) % 5 === 0 && (y < h0 + 3 || x < 11)) put(x, y, (x + y) % 2 ? H.hi : H.lo);
        break;
      case 'curly': rect(8, h0 - 2, 9, 5, H.base); rect(6, h0, 5, 8, H.base);
        for (let y = h0 - 2; y < h0 + 8; y++) for (let x = 6; x < 18; x++) if (has(x, y) && (x * 3 + y * 5) % 4 === 0 && (y < h0 + 3 || x < 11)) put(x, y, (x + y) % 3 ? H.hi : H.lo);
        break;
      default: {
        top(3);
        rect(8, h0 + 3, 3, st === 'long' || st === 'bob' ? 0 : 4, H.base);
        rect(16, h0 + 3, 1, 1, H.base); put(15, h0 + 3, H.base);
        if (st === 'side') { rect(13, h0 + 3, 4, 1, H.base); put(16, h0 + 4, H.base); }
        if (st === 'long') { rect(7, h0 + 1, 4, headH + 3, H.base); for (let y = h0 + 1; y < h0 + headH + 4; y++) put(7, y, H.lo); }
        if (st === 'bob') { rect(7, h0 + 1, 4, eyeRow + 3 - h0, H.base); put(7, eyeRow + 2, H.lo); rect(14, h0 + 3, 3, 1, H.base); }
        if (st === 'ponytail') { rect(8, h0 + 3, 3, 3, H.base); rect(5, eyeRow - 2, 3, 2, H.base); rect(5, eyeRow, 2, K ? 4 : 6, H.base); put(5, eyeRow + 1, H.lo); put(7, eyeRow - 2, 0xc9323a); }
        if (st === 'bun') { rect(6, h0 - 2, 4, 4, H.base); put(6, h0 - 2, H.hi); }
        if (st === 'spiky') { put(10, h0 - 2, H.base); put(12, h0 - 2, H.base); put(14, h0 - 2, H.base); put(11, h0 - 3, H.hi); }
        if (st === 'wavy') {
          rect(7, h0 + 1, 4, headH + 3, H.base);
          for (let j = 0; j < headH + 3; j++) { const y = h0 + 1 + j, out = ((j + 1) >> 1) % 2 === 1; if (out) put(6, y, H.lo); else put(7, y, H.lo); if (j % 4 === 1) put(9, y, H.lo); }
        }
        if (st === 'braids') { // flätan hänger ner bakom örat
          const end = h0 + headH + (K ? 2 : 4);
          for (let y = h0 + 3; y < end; y++) { const o = (y - h0) % 2; put(8, y, o ? H.lo : H.base); put(9, y, o ? H.base : H.hi); }
          rect(8, end, 2, 1, 0xc9323a); put(8, end + 1, H.lo); put(9, end + 1, H.base);
        }
        if (st === 'pigtails') { // tofs bakom huvudet
          [[5], [4, 5], [3, 4, 5], [3, 4, 5], [3, 4], [3, 4], [4]].forEach((xs, j) => xs.forEach((x) => put(x + 2, h0 + j, j === 6 ? H.lo : H.base)));
          put(8, h0 + 1, 0xc9323a); put(8, h0 + 2, 0xc9323a); put(5, h0 + 3, H.hi);
        }
      }
    }
    if (L.hat === 'cap') { rect(9, h0 - 2, 7, 1, capc.base); rect(8, h0 - 1, 9, 3, capc.base); rect(9, h0 - 2, 3, 1, capc.hi); rect(16, h0 + 2, 4, 1, capc.lo); rect(8, h0 + 2, 9, 1, capc.lo); }
    if (L.hat === 'beanie') { rect(10, h0 - 3, 5, 1, capc.base); rect(9, h0 - 2, 7, 1, capc.base); rect(8, h0 - 1, 9, 2, capc.base); rect(8, h0 + 1, 9, 2, capc.lo); rect(11, h0 - 5, 2, 2, 0xf4f1ea); }
    if (L.hat === 'headband') {
      let a = 12, b = 12;
      while (a > 0 && has(a - 1, h0)) a--;
      while (b < SW - 1 && has(b + 1, h0)) b++;
      rect(a, h0, b - a + 1, 1, capc.base); put(b, h0, capc.hi); put(a, h0, capc.lo);
    }
    if (L.hat === 'bow') {
      const bx = 8, by = Math.max(1, topAt(10, h0) + 1);
      put(bx, by - 1, capc.lo); put(bx + 1, by - 1, capc.base); put(bx + 3, by - 1, capc.base); put(bx + 4, by - 1, capc.hi);
      rect(bx, by, 5, 1, capc.base); put(bx + 2, by, capc.dk); put(bx + 4, by, capc.hi);
      put(bx, by + 1, capc.dk); put(bx + 1, by + 1, capc.lo); put(bx + 3, by + 1, capc.lo); put(bx + 4, by + 1, capc.lo);
    }
    if (L.hat === 'crown') {
      const cy = Math.max(3, topAt(10, h0));
      rect(9, cy - 1, 7, 2, capc.base); rect(9, cy - 1, 7, 1, capc.hi); put(9, cy, capc.lo);
      put(9, cy - 2, capc.base); put(15, cy - 2, capc.hi); rect(12, cy - 3, 1, 2, capc.base);
      put(13, cy, 0xd83a4a);
    }
    if (L.phones) { const pc = ramp(toInt(L.phoneColor, 0x222228)); rect(11, h0 - 2, 2, eyeRow - h0, 0x2a2a30); rect(10, eyeRow - 2, 3, 4, pc.base); put(10, eyeRow - 2, pc.hi); }
  }

  // ---------- kontur ----------
  const src = new Uint8ClampedArray(d);
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const i = (y * SW + x) * 4;
    if (src[i + 3]) continue;
    let best = -1;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= SW || yy >= SH) continue;
      const j = (yy * SW + xx) * 4;
      if (src[j + 3]) { best = j; if (dy === -1) break; }
    }
    if (best < 0) continue;
    d[i] = src[best] * 0.28 + 14; d[i + 1] = src[best + 1] * 0.24 + 10; d[i + 2] = src[best + 2] * 0.3 + 20; d[i + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  return cv;
}

function spriteFor(look, dir, frame) {
  const L = look && typeof look === 'object' ? look : {};
  let m = CACHE.get(L);
  if (!m) { m = new Map(); CACHE.set(L, m); }
  const key = dir + frame;
  let s = m.get(key);
  if (!s) { s = render(L, dir, frame); m.set(key, s); }
  return s;
}

// dir: 'down' | 'up' | 'left' | 'right'; frame: se överst
export function drawPerson(ctx, fx, fy, L, dir = 'down', frame = 0) {
  if (!['down', 'up', 'left', 'right'].includes(dir)) dir = 'down';
  frame = frame | 0;
  if (frame < 0 || frame > 9) frame = 0;
  const x = Math.round(fx), y = Math.round(fy);
  // skugga
  ctx.fillStyle = 'rgba(20,12,30,.28)';
  const kid = L && L.kid;
  ctx.fillRect(x - (kid ? 4 : 5), y - 1, kid ? 8 : 10, 2);
  ctx.fillRect(x - (kid ? 3 : 4), y + 1, kid ? 6 : 8, 1);
  ctx.drawImage(spriteFor(L, dir, frame), x - 12, y - 39);
}

// Porträtt (för dialoger/kort) – 80×96 canvas (5:6), bysten ur spriten i 4× skala
export function portrait(L, bg = '#d8cdb8') {
  const look = L && typeof L === 'object' ? L : {};
  const c = document.createElement('canvas');
  c.width = 80; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const base = toInt(bg, 0xd8cdb8);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 80, 96);
  // mjuk ljusfläck bakom huvudet + rutmönster
  const light = '#' + mix(base, 0xffffff, 0.28).toString(16).padStart(6, '0');
  const dark = '#' + mul(base, 0.92).toString(16).padStart(6, '0');
  for (let y = 0; y < 96; y += 4) for (let x = 0; x < 80; x += 4) if (((x + y) / 4) % 2 === 0) { ctx.fillStyle = dark; ctx.fillRect(x, y, 4, 4); }
  ctx.fillStyle = light;
  for (let y = 0; y < 24; y++) for (let x = 0; x < 20; x++) {
    const dd = Math.hypot((x - 9.5) / 8, (y - 9) / 9);
    if (dd < 1 && ((x + y) % 2 === 0 || dd < 0.7)) ctx.fillRect(x * 4, y * 4, 4, 4);
  }
  const s = spriteFor(look, 'down', 0);
  const top = look.kid ? 9 : 1;
  ctx.drawImage(s, 2, top, 20, 24, 0, 0, 80, 96);
  return c;
}
