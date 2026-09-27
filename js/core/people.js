// Procedurgenererade pixelpersoner (~16×32 px). Varje figur ritas pixel för pixel
// i en liten sprite (24×40) med skuggning och mörk kontur, och cachas per
// utseende + riktning + bildruta. Fötterna står vid (x, y).
//
// frame: 0 stå · 1/2 gångsteg · 3 mellansteg (kroppen upp 1 px) · 4 andas in · 5 sitter
//        6 sitter och äter · 7/8 bär (gångsteg) · 9 bär (står)
//
// Det här är MOTORN: lagerordning, ramper, kontur, cache, drawPerson/portrait/makeLook.
// Själva utseendena (frisyrer, ansikten, plagg, accessoarer) ligger i register i
// js/core/people/*.js – ett nytt val = en ny post där. Se docs/PEOPLE-ARKITEKTUR.md.
import { SW, SH, toInt, mul, mix, ramp, far, toneOf, TAG } from './people/util.js';
import { HAIR_REG, HAIR_FX_REG } from './people/hair.js';
import { EYE_REG, BROW_REG, NOSE_REG, MOUTH_REG, EAR_REG, CHEEK_REG, MAKEUP_REG, MARK_REG, BEARD_REG } from './people/face.js';
import { TOP_REG, TOP_PRINT_REG } from './people/tops.js';
import { BOTTOM_REG, BOTTOM_PRINT_REG, SHOE_REG } from './people/bottoms.js';
import { HAT_REG, GLASSES_REG, BAG_REG, NECK_REG, JEWEL_REG, HAIR_ACC_REG, PHONES_REG } from './people/acc.js';

export { shadeHex, TAG } from './people/util.js';

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

// ---------- alla val-fält i look-objektet ----------
// reg = registret (id → post), def = standardvärdet när fältet saknas,
// empty = fältets "inget"-värde (registrets post heter då 'none'),
// alias = registerid som lagras som ett annat värde (hörlurar: 'over' ⇔ true).
export const LOOK_FIELDS = {
  style: { reg: HAIR_REG, def: 'short', label: 'Frisyr' },
  hairFx: { reg: HAIR_FX_REG, def: 'none', label: 'Hårfärgseffekt' },
  hairAcc: { reg: HAIR_ACC_REG, def: 'none', label: 'I håret' },
  eyes: { reg: EYE_REG, def: 'normal', label: 'Ögon' },
  brows: { reg: BROW_REG, def: 'normal', label: 'Ögonbryn' },
  nose: { reg: NOSE_REG, def: 'normal', label: 'Näsa' },
  mouth: { reg: MOUTH_REG, def: 'normal', label: 'Mun' },
  ears: { reg: EAR_REG, def: 'normal', label: 'Öron' },
  cheeks: { reg: CHEEK_REG, def: 'none', label: 'Kinder' },
  makeup: { reg: MAKEUP_REG, def: 'none', label: 'Smink' },
  marks: { reg: MARK_REG, def: 'none', label: 'Märken & målning' },
  beard: { reg: BEARD_REG, def: false, empty: false, label: 'Skägg' },
  top: { reg: TOP_REG, def: 'tee', label: 'Överdel' },
  topPrint: { reg: TOP_PRINT_REG, def: 'none', label: 'Tryck' },
  bottom: { reg: BOTTOM_REG, def: 'pants', label: 'Underdel' },
  bottomPrint: { reg: BOTTOM_PRINT_REG, def: 'none', label: 'Mönster' },
  shoeType: { reg: SHOE_REG, def: 'normal', label: 'Skor' },
  hat: { reg: HAT_REG, def: null, empty: null, label: 'Huvudbonad' },
  glasses: { reg: GLASSES_REG, def: false, empty: false, label: 'Glasögon' },
  bag: { reg: BAG_REG, def: null, empty: null, label: 'Väska' },
  neck: { reg: NECK_REG, def: 'none', label: 'Hals' },
  jewel: { reg: JEWEL_REG, def: 'none', label: 'Smycken' },
  phones: { reg: PHONES_REG, def: false, empty: false, alias: { over: true }, label: 'Hörlurar' },
};

// Färgfälten och deras standard (null = valfri; motorn väljer en passande färg)
export const LOOK_COLORS = {
  skin: '#eabf98', hair: '#3b2619', hair2: null,
  eyeColor: null, lipColor: null, shadowColor: null, markColor: null,
  shirt: '#3a7bd5', accent: '#f4f1ea', print2: null,
  pants: '#2d3a5c', pants2: null, shoes: '#1c1c1c', shoes2: null,
  cap: '#c9323a', bagColor: '#2f3440', phoneColor: '#222228', neckColor: null,
};

// look-värde → registerid ('none' för tomma värden; okänt ⇒ standard)
export function idOf(field, v) {
  const F = LOOK_FIELDS[field];
  if (!F) return null;
  if ('empty' in F && (v == null || v === false || v === F.empty)) return 'none';
  if (F.alias) for (const k in F.alias) if (F.alias[k] === v) return k;
  if (typeof v === 'string' && Object.hasOwn(F.reg, v)) return v;
  return 'empty' in F ? 'none' : F.def;
}
// registerid → look-värde (tvärtom mot idOf)
export function valueOf(field, id) {
  const F = LOOK_FIELDS[field];
  if (id === 'none' && 'empty' in F) return F.empty;
  if (F.alias && Object.hasOwn(F.alias, id)) return F.alias[id];
  return id;
}
// Finns värdet i registret? (null/false räknas för fält som har ett tomt värde)
export const isValid = (field, v) => { const F = LOOK_FIELDS[field]; if (!F) return false; if ('empty' in F && v === F.empty) return true; if (F.alias && Object.values(F.alias).includes(v)) return true; return typeof v === 'string' && Object.hasOwn(F.reg, v) && !(v === 'none' && 'empty' in F); };
export const entryOf = (field, v) => LOOK_FIELDS[field]?.reg[idOf(field, v)] || null;
export const labelOf = (field, v) => entryOf(field, v)?.label || String(v);
// Alla giltiga värden för ett fält, i registrets ordning
export const listOf = (field) => Object.keys(LOOK_FIELDS[field].reg).map((id) => valueOf(field, id));

// Alla giltiga värden (även sådana som bara avatarer använder – kunder slumpas aldrig fram dem).
// Byggs ur registren: ett nytt val i ett register hamnar automatiskt här.
export const HAIR_STYLES = listOf('style');
export const TOP_TYPES = listOf('top');
export const BOTTOM_TYPES = listOf('bottom');
export const HAT_TYPES = listOf('hat');
export const GLASSES_TYPES = listOf('glasses');
export const BEARD_TYPES = listOf('beard');
export const BAG_TYPES = listOf('bag');
export const BUILDS = [4, 5, 6];
export const HAIR_FX_TYPES = listOf('hairFx');
export const HAIR_ACC_TYPES = listOf('hairAcc');
export const EYE_TYPES = listOf('eyes');
export const BROW_TYPES = listOf('brows');
export const NOSE_TYPES = listOf('nose');
export const MOUTH_TYPES = listOf('mouth');
export const EAR_TYPES = listOf('ears');
export const CHEEK_TYPES = listOf('cheeks');
export const MAKEUP_TYPES = listOf('makeup');
export const MARK_TYPES = listOf('marks');
export const TOP_PRINTS = listOf('topPrint');
export const BOTTOM_PRINTS = listOf('bottomPrint');
export const SHOE_TYPES = listOf('shoeType');
export const NECK_TYPES = listOf('neck');
export const JEWEL_TYPES = listOf('jewel');
export const PHONE_TYPES = listOf('phones');

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

// ---------- lagren ----------
const FIELDS = Object.keys(LOOK_FIELDS);
// vilken etikett pixlarna får när ett fälts post ritar
const FIELD_TAG = {
  style: TAG.hair, hairFx: TAG.hair, hairAcc: TAG.hairAcc, eyes: TAG.face, brows: TAG.brow, nose: TAG.face, mouth: TAG.face,
  ears: TAG.ear, cheeks: TAG.face, makeup: TAG.face, marks: TAG.face, beard: TAG.beard, top: TAG.top, topPrint: TAG.torso,
  bottom: TAG.pants, bottomPrint: TAG.pants, shoeType: TAG.shoe, hat: TAG.hat, glasses: TAG.glasses, bag: TAG.bag,
  neck: TAG.neck, jewel: TAG.jewel, phones: TAG.phones,
};
// ordningen när prep() och krokarna anropas (samma som ritordningen)
const HOOK_ORDER = ['bottom', 'bottomPrint', 'shoeType', 'top', 'topPrint', 'neck', 'bag', 'ears', 'eyes', 'brows', 'nose', 'mouth',
  'cheeks', 'makeup', 'marks', 'beard', 'glasses', 'style', 'hairFx', 'hairAcc', 'hat', 'phones', 'jewel'];
// vilken ramp R.pattern jämför tonen mot per etikett
const SRC = { [TAG.torso]: 'shirt', [TAG.sleeve]: 'shirt', [TAG.top]: 'shirt', [TAG.pants]: 'pants', [TAG.hair]: 'hair', [TAG.skin]: 'skin',
  [TAG.head]: 'skin', [TAG.shoe]: 'shoe', [TAG.hat]: 'cap', [TAG.bag]: 'bagC', [TAG.beard]: 'hair', [TAG.brow]: 'hair', [TAG.neck]: 'neckC' };

const optRamp = (h) => (typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h) ? ramp(parseInt(h.slice(1), 16)) : null);

// ---------- spriten ----------
const CACHE = new WeakMap();

function render(L0, dir, frame) {
  const L = norm(L0);
  const cv = document.createElement('canvas'); cv.width = SW; cv.height = SH;
  const cx = cv.getContext('2d');
  const img = cx.createImageData(SW, SH), d = img.data;
  const tags = new Uint8Array(SW * SH);
  const flip = dir === 'left';
  const side = dir === 'left' || dir === 'right';
  const back = dir === 'up';
  const view = side ? 'side' : back ? 'back' : 'front';
  const R = { tag: TAG.none };
  const put = (x, y, c) => {
    if (flip) x = SW - 1 - x;
    if (x < 0 || y < 0 || x >= SW || y >= SH) return;
    const p = y * SW + x, i = p * 4;
    d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; d[i + 3] = 255;
    tags[p] = R.tag;
  };
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c); };
  const has = (x, y) => { if (flip) x = SW - 1 - x; return x >= 0 && y >= 0 && x < SW && y < SH && d[(y * SW + x) * 4 + 3] > 0; };
  const topAt = (x, fb) => { for (let y = 0; y < SH; y++) if (has(x, y)) return y; return fb; }; // översta ritade pixeln i kolumnen
  const get = (x, y) => { if (flip) x = SW - 1 - x; if (x < 0 || y < 0 || x >= SW || y >= SH) return -1; const i = (y * SW + x) * 4; return d[i + 3] ? (d[i] << 16) | (d[i + 1] << 8) | d[i + 2] : -1; };
  const tagAt = (x, y) => { if (flip) x = SW - 1 - x; return x < 0 || y < 0 || x >= SW || y >= SH ? 0 : tags[y * SW + x]; };
  // fn(x, y, färg) för varje ritad pixel med etiketten (x i vyns egna koordinater)
  const each = (tag, fn) => {
    for (let p = 0; p < SW * SH; p++) {
      if (tags[p] !== tag || !d[p * 4 + 3]) continue;
      const sx = p % SW;
      fn(flip ? SW - 1 - sx : sx, (p - sx) / SW, (d[p * 4] << 16) | (d[p * 4 + 1] << 8) | d[p * 4 + 2]);
    }
  };
  // Mönster: fn(x, y, färg) → ramp (tonen hi/base/lo/dk behålls), heltalsfärg, eller null = orörd
  const pattern = (tag, fn, src) => {
    const from = src || R[SRC[tag]] || null, keep = R.tag;
    R.tag = tag;
    each(tag, (x, y, c) => {
      const r = fn(x, y, c);
      if (r == null || r === false) return;
      if (typeof r === 'number') put(x, y, r);
      else put(x, y, r[toneOf(c, from) || 'base']);
    });
    R.tag = keep;
  };

  const K = !!L.kid;

  // ---------- registrens poster för det här utseendet ----------
  const id = {}, E = {};
  for (const f of FIELDS) {
    const v = f === 'cheeks' ? (L.cheeks && L.cheeks !== 'none' ? L.cheeks : L.blush ? 'blush' : 'none') : L[f];
    id[f] = idOf(f, v);
    E[f] = LOOK_FIELDS[f].reg[id[f]];
  }
  const draw = (f, arg) => { // rita fältets post i den här vyn
    const e = E[f], fn = e && e[view];
    if (!fn) return;
    const keep = R.tag; R.tag = FIELD_TAG[f];
    fn.call(e, R, arg);
    R.tag = keep;
  };
  const hook = (name) => {
    for (const f of HOOK_ORDER) { const e = E[f]; if (e[name]) { R.tag = FIELD_TAG[f]; e[name](R); } }
    R.tag = TAG.none;
  };

  // ---------- färger ----------
  const skinR = ramp(toInt(L.skin, 0xeabf98)), hairR = ramp(toInt(L.hair, 0x3b2619));
  const shirtR = ramp(toInt(L.shirt, 0x3a7bd5)), accR = ramp(toInt(L.accent, 0xf4f1ea));

  // ---------- rörelse + proportioner ----------
  const eat = frame === 6, carry = frame >= 7;
  const walkA = frame === 1 || frame === 7, walkB = frame === 2 || frame === 8, sit = frame === 5 || eat;
  const bob = sit ? 1 : (frame === 3 || frame === 4) ? -1 : 0;
  const shoeTop = 37, legLen = K ? 5 : 8, hipH = K ? 1 : 2, torsoH = K ? 6 : 9, headH = K ? 11 : 12;
  const legTop = shoeTop - legLen, hipTop = legTop - hipH;
  const torsoTop = hipTop - torsoH + bob, headTop = hipTop - torsoH - headH + bob;
  const tw = L.build, lw = K ? 3 : 4;
  const eyeRow = headTop + (K ? 6 : 7);
  const armLen = K ? 5 : 8;
  const hy = hipTop + (sit ? bob : 0);

  Object.assign(R, {
    L, dir, frame, view, side, back, front: view === 'front', flip, K, adult: !K, SW, SH, TAG,
    put, rect, has, topAt, get, tagAt, each, pattern, draw, E, id,
    mix, mul, ramp, far, toneOf, toInt,
    // färger (ramper { hi, base, lo, dk } om inget annat sägs)
    skin: skinR, hair: hairR, shirt: shirtR, acc: accR,
    hair2: optRamp(L.hair2) || ramp(mix(mul(toInt(L.hair, 0x3b2619), 1.35), 0xf2d68a, 0.5)),
    print: optRamp(L.print2) || accR,
    pants: ramp(toInt(L.pants, 0x2d3a5c)), pants2: optRamp(L.pants2) || accR,
    shoe: ramp(toInt(L.shoes, 0x1c1c1c)), shoe2: optRamp(L.shoes2) || ramp(0xf2f2f2),
    cap: ramp(toInt(L.cap, 0xc9323a)), bagC: ramp(toInt(L.bagColor, 0x2f3440)), phone: ramp(toInt(L.phoneColor, 0x222228)),
    neckC: optRamp(L.neckColor) || accR,
    eyeC: optRamp(L.eyeColor), lipC: optRamp(L.lipColor) || ramp(0xc0304a),
    shadowC: optRamp(L.shadowColor) || ramp(0x8e5bd1), markC: optRamp(L.markColor) || ramp(0x3a7bd5),
    eye: toInt(L.eyeColor, 0x2a1d1a),                    // heltal
    lip: mix(skinR.lo, 0xa0303a, 0.35),                   // heltal – smink kan byta i prep()
    sole: (toInt(L.shoes, 0) === 0xf2f2f2 || E.bottom.darkSole) ? 0xd9d6cc : 0xe9e6dc,
    darkShoe: L.shoes === '#1c1c1c' || L.shoes === '#2f2f36',
    // rörelse
    sit, eat, carry, walkA, walkB, bob,
    // mått
    shoeTop, legLen, hipH, torsoH, headH, legTop, hipTop, torsoTop, headTop, h0: headTop, eyeRow, tw, lw, armLen,
    ty0: torsoTop, ty1: hy, hy,
    longSleeve: E.top.sleeve === 'long', noSleeve: E.top.sleeve === 'none',
  });
  const B = E.bottom;
  R.skirtLen = B.skirt ? B.skirt(R) : 0;
  R.bareFrom = typeof B.bareFrom === 'function' ? B.bareFrom(R) : (B.bareFrom ?? null);
  // förberedelser: poster kan byta färger/mått innan något ritas (t.ex. klänning ⇒ R.pants = R.shirt)
  for (const f of HOOK_ORDER) if (E[f].prep) E[f].prep(R);
  R.skirted = R.skirtLen > 0;

  const { skin, shirt, pants, skirtLen, skirted, bareFrom, longSleeve, noSleeve } = R;
  const T = E.top, SHOE = E.shoeType;

  if (!side) {
    // ---------- ben (fram/bak) ----------
    const leg = (x0, lift, left) => {
      const rows = [];
      if (sit) {
        const top = hipTop + bob + hipH;
        const lap = B.lapSkin ? skin : pants;
        R.tag = B.lapSkin ? TAG.skin : TAG.pants;
        rect(x0 - (left ? 1 : 0), top, lw + 1, 3, lap.base);
        rect(x0 - (left ? 1 : 0), top, lw + 1, 1, lap.hi);
        rect(x0 - (left ? 1 : 0), top + 2, lw + 1, 1, lap.lo);
        R.tag = TAG.pants;
        if (skirted) rect(x0 - (left ? 1 : 0), top, lw + 1, 2, pants.base);
        const shin = shoeTop - (top + 3);
        const skinLeg = !!B.shinSkin || skirted;
        R.tag = skinLeg ? TAG.skin : TAG.pants;
        rect(x0, top + 3, lw, shin, skinLeg ? skin.base : pants.base);
        rect(left ? x0 : x0 + lw - 1, top + 3, 1, shin, skinLeg ? skin.lo : pants.lo);
        for (let y = top + 3; y < shoeTop; y++) rows.push({ x: x0, y, w: lw });
      } else {
        const len = legLen - lift;
        for (let j = 0; j < len; j++) {
          const y = legTop + j;
          const bare = bareFrom != null && j >= bareFrom;
          const base = bare ? (skirted ? mix(skin.base, 0x2a2430, 0.15) : skin.base) : pants.base;
          const lo = bare ? skin.lo : pants.lo, hi = bare ? skin.hi : pants.hi;
          R.tag = bare ? TAG.skin : TAG.pants;
          rect(x0, y, lw, 1, base);
          put(left ? x0 : x0 + lw - 1, y, left ? hi : lo);
          put(left ? x0 + lw - 1 : x0, y, lo);
          rows.push({ x: x0, y, w: lw });
          if (B.legRow) B.legRow(R, { x: x0, y, w: lw, j, n: len, left, far: false, side: false, bare });
        }
      }
      // sko
      const sy = shoeTop - (sit ? 0 : lift);
      R.tag = TAG.shoe;
      if (SHOE[view]) SHOE[view](R, { x: left ? x0 - 1 : x0, y: sy, left, rows });
    };
    leg(12 - lw, walkB ? 2 : 0, true);
    leg(12, walkA ? 2 : 0, false);
    hook('afterLegs');

    // ---------- höfter / kjol ----------
    R.tag = TAG.pants;
    rect(12 - tw, hy, tw * 2, hipH, pants.base);
    if (skirted) {
      for (let j = 0; j < skirtLen; j++) {
        const w = tw + Math.min(2, (j + 1) >> 1);
        rect(12 - w, hy + j, w * 2, 1, pants.base);
        put(12 - w, hy + j, pants.hi); put(11 + w, hy + j, pants.lo);
        if (j === skirtLen - 1) rect(12 - w, hy + j, w * 2, 1, pants.lo);
      }
      if (B.folds && !back) for (let j = 1; j < skirtLen - 1; j += 2) put(12 - tw + 2 + (j % 4 === 1 ? 0 : 1), hy + j, pants.lo); // veck
    } else if (!K && B.belt !== false) {
      R.tag = TAG.belt;
      rect(12 - tw, hy, tw * 2, 1, mix(pants.dk, 0x1c1814, 0.4)); // bälte
      if (!back) rect(11, hy, 2, 1, 0xc9b27a);
      R.tag = TAG.pants;
    }
    if (!sit && B.crotch !== false) { put(11, legTop, pants.dk); put(12, legTop, pants.dk); }
    draw('bottom');
    draw('bottomPrint');
    hook('afterHips');
    hook('beforeTorso');

    // ---------- bål ----------
    const ty0 = torsoTop, ty1 = hy; // [ty0, ty1)
    R.tag = TAG.torso;
    for (let y = ty0; y < ty1; y++) {
      const inset = y === ty0 ? 1 : 0;
      rect(12 - tw + inset, y, tw * 2 - inset * 2, 1, shirt.base);
      put(12 - tw + inset, y, shirt.hi);
      put(11 + tw - inset, y, shirt.lo); put(10 + tw - inset, y, y > ty0 + 1 ? shirt.lo : shirt.base);
    }
    rect(12 - tw + 1, ty1 - 1, tw * 2 - 2, 1, shirt.lo); // nedre veck
    draw('topPrint');
    draw('top');
    hook('afterTorso');
    if (L.apron) {
      R.tag = TAG.apron;
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
    draw('neck');
    draw('bag');
    hook('beforeArms');

    // ---------- armar ----------
    const arm = (left, swing) => {
      const x0 = left ? 12 - tw - 2 : 12 + tw;
      if (eat) {   // sitter och äter: överarmen ner, underarmen upp mot munnen
        for (let j = 0; j < 3; j++) { const y = torsoTop + 1 + j, cl = longSleeve || j < 2, c = cl ? shirt : skin; R.tag = cl ? TAG.sleeve : TAG.skin; put(x0, y, left ? c.hi : c.base); put(x0 + 1, y, left ? c.base : c.lo); }
        for (let k = 0; k < 4; k++) { const x = left ? x0 + 1 + k : x0 - k, y = torsoTop + 3 - k, cl = k < 2 && longSleeve; R.tag = cl ? TAG.sleeve : TAG.skin; put(x, y, cl ? shirt.base : skin.base); }
        R.tag = TAG.skin;
        put(left ? 11 : 12, torsoTop - 1, skin.lo); put(left ? 10 : 13, torsoTop - 1, skin.base);   // händerna vid munnen
        R.tag = TAG.sleeve;
        put(left ? x0 + 1 : x0, torsoTop, shirt.base);
        return;
      }
      if (carry) {   // bär tallriken: armarna framåt, händerna ihop framför magen
        const len = armLen - 2;
        for (let j = 0; j < len; j++) {
          const y = torsoTop + 1 + j, inward = Math.round(j / len * (tw + 1)), x = left ? x0 + inward : x0 - inward;
          const cl = j < len - 2 && (longSleeve || j < 3), c = cl ? shirt : skin;
          R.tag = cl ? TAG.sleeve : TAG.skin;
          put(x, y, left ? c.hi : c.base); put(x + 1, y, left ? c.base : c.lo);
        }
        R.tag = TAG.sleeve;
        put(left ? x0 + 1 : x0, torsoTop, shirt.base);
        return;
      }
      const len = sit ? armLen : armLen + swing;
      const sleeve = noSleeve ? 0 : longSleeve ? len - 2 : Math.min(3, len - 2);
      for (let j = 0; j < len; j++) {
        const y = torsoTop + 1 + j;
        const isHand = j >= len - 2;
        const cloth = j < sleeve;
        const c = isHand ? skin : cloth ? ((T.sleeveAt && T.sleeveAt(R, j)) || shirt) : skin;
        R.tag = !isHand && cloth ? TAG.sleeve : TAG.skin;
        put(x0, y, left ? c.hi : c.base); put(x0 + 1, y, left ? c.base : c.lo);
        if (isHand && j === len - 1) { put(x0, y, c.base); put(x0 + 1, y, c.lo); }
      }
      R.tag = TAG.sleeve;
      put(left ? x0 + 1 : x0, torsoTop, shirt.base); // axel
      R.tag = TAG.skin;
      if (sit) { put(left ? x0 + 2 : x0 - 1, torsoTop + len, skin.base); put(left ? x0 + 3 : x0 - 2, torsoTop + len, skin.lo); }
    };
    const sw = walkA ? 1 : walkB ? -1 : 0;
    arm(true, sw); arm(false, -sw);
    hook('afterArms');

    // ---------- huvud ----------
    const h0 = headTop;
    R.tag = TAG.head;
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
  } else {
    // ================= SIDOVY (höger; vänster speglas) =================
    const legSw = walkA ? 3 : walkB ? -3 : 0;
    const legX = 11; // närmaste benets vänsterkant
    const drawLeg = (swing, isFar) => {
      const top = legTop, len = legLen;
      const P = isFar ? { hi: pants.lo, base: pants.lo, lo: pants.dk } : pants;
      const Sk = isFar ? { hi: skin.lo, base: skin.lo, lo: skin.dk } : skin;
      const lift = swing < 0 ? 1 : 0;
      let lastX = legX;
      const rows = [];
      for (let j = 0; j < len - lift; j++) {
        const t = (j + 1) / len;
        const x = legX + Math.round(swing * t) - (isFar && !swing ? 1 : 0);
        const bare = bareFrom != null && j >= bareFrom;
        const c = bare ? Sk : P;
        R.tag = bare ? TAG.skin : TAG.pants;
        rect(x, top + j, 3, 1, c.base); put(x, top + j, c.lo); put(x + 2, top + j, c.hi);
        rows.push({ x, y: top + j, w: 3 });
        if (B.legRow) B.legRow(R, { x, y: top + j, w: 3, j, n: len - lift, left: false, far: isFar, side: true, bare });
        lastX = x;
      }
      R.tag = TAG.shoe;
      if (SHOE.side) SHOE.side(R, { x: lastX, y: shoeTop - lift, far: isFar, rows });
    };
    drawLeg(-legSw, true);
    // bortre arm (syns när den svänger)
    const armSw = walkA ? -3 : walkB ? 3 : 0;
    const drawArm = (swing, isFar) => {
      const C = isFar ? { hi: shirt.lo, base: shirt.lo, lo: shirt.dk } : shirt;
      const Sk = isFar ? { hi: skin.lo, base: skin.lo, lo: skin.dk } : skin;
      if (eat) {   // underarmen upp mot munnen
        for (let j = 0; j < 3; j++) { const cl = longSleeve || j < 2; R.tag = cl ? TAG.sleeve : TAG.skin; rect(11, torsoTop + 1 + j, 3, 1, (cl ? C : Sk).base); }
        for (let k = 0; k < 4; k++) { const cl = k < 2 && longSleeve, c = cl ? C : Sk; R.tag = cl ? TAG.sleeve : TAG.skin; rect(12 + k, torsoTop + 3 - k, 2, 1, c.base); put(12 + k, torsoTop + 3 - k, c.lo); }
        R.tag = TAG.skin;
        put(16, torsoTop - 1, Sk.base); put(15, torsoTop - 1, Sk.lo);
        return;
      }
      if (carry) {   // armen rakt fram
        for (let j = 0; j < 3; j++) { const cl = longSleeve || j < 2; R.tag = cl ? TAG.sleeve : TAG.skin; rect(11, torsoTop + 1 + j, 3, 1, (cl ? C : Sk).base); }
        for (let k = 0; k < 5; k++) { const cl = k < 2 && longSleeve, c = cl ? C : Sk; R.tag = cl ? TAG.sleeve : TAG.skin; rect(12 + k, torsoTop + 4, 2, 1, c.base); put(12 + k, torsoTop + 5, c.lo); }
        return;
      }
      const len = sit ? armLen - 2 : armLen;
      const sleeve = noSleeve ? 0 : longSleeve ? len - 2 : 3;
      for (let j = 0; j < len; j++) {
        const t = (j + 1) / len;
        const x = 11 + Math.round(swing * t * t) + (sit ? Math.round(t * 3) : 0);
        const cloth = j < len - 2 && j < sleeve;
        let c = cloth ? C : Sk;
        if (cloth && T.sleeveAt) { const s = T.sleeveAt(R, j); if (s) c = isFar ? far(s) : s; }
        R.tag = cloth ? TAG.sleeve : TAG.skin;
        rect(x, torsoTop + 1 + j, 3, 1, c.base); put(x, torsoTop + 1 + j, c.lo); put(x + 2, torsoTop + 1 + j, c.hi);
      }
    };
    if (armSw) drawArm(-armSw, true);
    drawLeg(legSw, false);
    hook('afterLegs');
    // höft
    R.tag = TAG.pants;
    rect(9, hy, 7, hipH, pants.base); put(15, hy, pants.hi);
    if (skirted) for (let j = 0; j < skirtLen; j++) { const w = Math.min(2, (j + 1) >> 1); rect(9 - w, hy + j, 7 + w * 2, 1, pants.base); put(8 - w, hy + j, pants.lo); }
    else if (!K && B.belt !== false) { R.tag = TAG.belt; rect(9, hy, 7, 1, mix(pants.dk, 0x1c1814, 0.4)); }
    draw('bottom');
    draw('bottomPrint');
    hook('afterHips');
    hook('beforeTorso'); // t.ex. ryggsäcken bakom ryggen
    // bål
    R.tag = TAG.torso;
    for (let y = torsoTop; y < hy; y++) {
      const inset = y === torsoTop ? 1 : 0;
      rect(9 + inset, y, 7 - inset, 1, shirt.base); put(9 + inset, y, shirt.lo); put(15, y, shirt.hi);
    }
    draw('topPrint');
    draw('top');
    hook('afterTorso');
    if (L.apron) {
      R.tag = TAG.apron;
      rect(14, torsoTop + 2, 3, legTop + 3 - torsoTop - 2, 0xf2eee4); for (let y = torsoTop + 2; y < legTop + 3; y++) put(14, y, 0xcfc8b8);
      put(12, torsoTop + 1, 0xf2eee4); put(13, torsoTop + 2, 0xf2eee4);
    }
    draw('neck');
    draw('bag');
    hook('beforeArms');
    // närmaste arm
    drawArm(armSw, false);
    hook('afterArms');

    // huvud
    const h0 = headTop;
    R.tag = TAG.head;
    for (let j = 0; j < headH; j++) {
      const y = h0 + j;
      let x0 = 8, x1 = 16;
      if (j === 0) { x0 = 9; x1 = 15; }
      if (j >= headH - 2) { x0 = 10; x1 = j === headH - 1 ? 15 : 16; }
      rect(x0, y, x1 - x0 + 1, 1, skin.base);
      put(x0, y, skin.lo);
    }
  }

  // ---------- ansikte, hår, huvudbonader (samma ordning i alla vyer) ----------
  draw('ears');
  hook('afterHead');
  draw('eyes'); draw('brows'); draw('nose'); draw('mouth'); draw('cheeks');
  draw('makeup'); draw('marks'); draw('beard'); draw('glasses');
  hook('afterFace');
  draw('style'); draw('hairFx'); draw('hairAcc');
  hook('afterHair');
  draw('hat'); draw('phones'); draw('jewel');
  hook('last');

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
