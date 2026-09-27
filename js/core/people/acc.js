// Accessoarer: huvudbonader, glasögon, väskor, hals (halsdukar/slipsar/halsband),
// smycken, hårspännen och hörlurar. Se docs/PEOPLE-ARKITEKTUR.md.
//
// Varje post: { label, group?, front(R), back(R), side(R), prep?, ...krokar }.
// Lagerordning (tidigast först): … bål → [hals] → [väska] → armar → huvud → ansikte →
// [glasögon] → hår → [hårspänne] → [huvudbonad] → [hörlurar] → [smycken] → kontur.
// Väskor har ofta en del bakom ryggen från sidan: lägg den i kroken beforeTorso(R)
// (kolla R.side) – då hamnar bålen framför.
// Färger: R.cap (look.cap – huvudbonaden), R.bagC (look.bagColor), R.phone (look.phoneColor),
// R.neckC (look.neckColor, annars detaljfärgen), R.acc (look.accent), R.skin, R.hair.
//
// Ändra inte de gamla posterna – de är pixellåsta av tools/people-regress.mjs.
import { mix, SW } from './util.js';

// ---------- huvudbonader (look.hat; null = ingen) ----------
const capFB = (R) => {
  const { rect, put, cap: C, skin, hair, h0, back } = R;
  rect(8, h0 - 2, 8, 1, C.base); rect(7, h0 - 1, 10, 3, C.base);
  rect(8, h0 - 2, 3, 1, C.hi); rect(7, h0 - 1, 2, 2, C.hi);
  for (let y = h0 - 1; y < h0 + 2; y++) put(16, y, C.lo);
  if (!back) { rect(6, h0 + 2, 12, 1, C.lo); rect(7, h0 + 3, 10, 1, mix(skin.lo, 0x201818, 0.25)); rect(11, h0, 2, 1, 0xf4f1ea); }
  else { rect(7, h0 + 2, 10, 1, C.lo); rect(11, h0 + 2, 2, 1, hair.base); }
};
const beanieFB = (R) => {
  const { rect, put, cap: C, h0 } = R;
  rect(9, h0 - 3, 6, 1, C.base); rect(8, h0 - 2, 8, 1, C.base); rect(7, h0 - 1, 10, 3, C.base);
  rect(7, h0 + 1, 10, 2, C.lo); for (let x = 7; x < 17; x += 2) put(x, h0 + 1, C.dk);
  rect(9, h0 - 3, 3, 1, C.hi); put(8, h0 - 2, C.hi);
  rect(11, h0 - 5, 2, 2, 0xf4f1ea); put(12, h0 - 4, 0xd8d4c8);
};
const headbandFB = (R) => { // hårband längs hela frisyrens bredd
  const { rect, put, has, cap: C, h0 } = R;
  let a = 11, b = 12;
  while (a > 0 && has(a - 1, h0)) a--;
  while (b < SW - 1 && has(b + 1, h0)) b++;
  rect(a, h0, b - a + 1, 1, C.base); put(a, h0, C.hi); put(b, h0, C.lo);
};
const bowFB = (R) => { // rosett på ena sidan av huvudet
  const { rect, put, topAt, cap: C, h0, back } = R;
  const bx = back ? 6 : 13, by = Math.max(1, topAt(bx + 2, h0) + 1);
  put(bx, by - 1, C.hi); put(bx + 1, by - 1, C.base); put(bx + 3, by - 1, C.base); put(bx + 4, by - 1, C.lo);
  rect(bx, by, 5, 1, C.base); put(bx, by, C.hi); put(bx + 2, by, C.dk); put(bx + 4, by, C.lo);
  put(bx, by + 1, C.lo); put(bx + 1, by + 1, C.lo); put(bx + 3, by + 1, C.lo); put(bx + 4, by + 1, C.dk);
};
const crownFB = (R) => {
  const { rect, put, topAt, cap: C, h0, back } = R;
  const cy = Math.max(3, topAt(9, h0));
  rect(8, cy - 1, 8, 2, C.base); rect(8, cy - 1, 8, 1, C.hi); put(15, cy - 1, C.base); put(15, cy, C.lo);
  put(8, cy - 2, C.hi); put(15, cy - 2, C.base); rect(11, cy - 3, 2, 2, C.base); put(11, cy - 3, C.hi);
  if (!back) { put(9, cy, 0x3a8ae0); rect(11, cy, 2, 1, 0xd83a4a); put(14, cy, 0x3a8ae0); }
};
const bucketFB = (R) => { // fiskehatt: kupol + nedvinklat brätte
  const { rect, put, cap: C, h0 } = R;
  rect(9, h0 - 4, 6, 1, C.base); rect(8, h0 - 3, 8, 3, C.base);
  rect(9, h0 - 4, 3, 1, C.hi); put(8, h0 - 3, C.hi); put(15, h0 - 2, C.lo);
  rect(6, h0, 12, 1, C.lo); put(6, h0 + 1, C.dk); put(17, h0 + 1, C.dk);
};
const tophatFB = (R) => { // hög hatt med band i detaljfärgen
  const { rect, put, cap: C, acc, h0 } = R;
  rect(8, h0 - 7, 8, 7, C.base); rect(8, h0 - 7, 8, 1, C.hi); put(8, h0 - 6, C.hi);
  for (let y = h0 - 6; y < h0 - 1; y++) put(15, y, C.lo);
  rect(8, h0 - 1, 8, 1, acc.base);
  rect(6, h0, 12, 1, C.dk);
};

export const HAT_REG = {
  none: { label: 'Ingen' },
  cap: {
    label: 'Keps', group: 'Kepsar & hattar', front: capFB, back: capFB,
    side(R) { const { rect, cap: C, h0 } = R; rect(9, h0 - 2, 7, 1, C.base); rect(8, h0 - 1, 9, 3, C.base); rect(9, h0 - 2, 3, 1, C.hi); rect(16, h0 + 2, 4, 1, C.lo); rect(8, h0 + 2, 9, 1, C.lo); },
  },
  beanie: {
    label: 'Mössa', group: 'Mössor', front: beanieFB, back: beanieFB,
    side(R) { const { rect, cap: C, h0 } = R; rect(10, h0 - 3, 5, 1, C.base); rect(9, h0 - 2, 7, 1, C.base); rect(8, h0 - 1, 9, 2, C.base); rect(8, h0 + 1, 9, 2, C.lo); rect(11, h0 - 5, 2, 2, 0xf4f1ea); },
  },
  headband: {
    label: 'Hårband', group: 'Hårband & rosetter', front: headbandFB, back: headbandFB,
    side(R) { const { rect, put, has, cap: C, h0 } = R;
      let a = 12, b = 12;
      while (a > 0 && has(a - 1, h0)) a--;
      while (b < SW - 1 && has(b + 1, h0)) b++;
      rect(a, h0, b - a + 1, 1, C.base); put(b, h0, C.hi); put(a, h0, C.lo); },
  },
  bow: {
    label: 'Rosett', group: 'Hårband & rosetter', front: bowFB, back: bowFB,
    side(R) { const { rect, put, topAt, cap: C, h0 } = R;
      const bx = 8, by = Math.max(1, topAt(10, h0) + 1);
      put(bx, by - 1, C.lo); put(bx + 1, by - 1, C.base); put(bx + 3, by - 1, C.base); put(bx + 4, by - 1, C.hi);
      rect(bx, by, 5, 1, C.base); put(bx + 2, by, C.dk); put(bx + 4, by, C.hi);
      put(bx, by + 1, C.dk); put(bx + 1, by + 1, C.lo); put(bx + 3, by + 1, C.lo); put(bx + 4, by + 1, C.lo); },
  },
  crown: {
    label: 'Krona', group: 'Fest', front: crownFB, back: crownFB,
    side(R) { const { rect, put, topAt, cap: C, h0 } = R;
      const cy = Math.max(3, topAt(10, h0));
      rect(9, cy - 1, 7, 2, C.base); rect(9, cy - 1, 7, 1, C.hi); put(9, cy, C.lo);
      put(9, cy - 2, C.base); put(15, cy - 2, C.hi); rect(12, cy - 3, 1, 2, C.base);
      put(13, cy, 0xd83a4a); },
  },
  bucket: {
    label: 'Fiske\u00adhatt', group: 'Kepsar & hattar', front: bucketFB, back: bucketFB,
    side(R) { const { rect, put, cap: C, h0 } = R; rect(10, h0 - 4, 5, 1, C.base); rect(9, h0 - 3, 7, 3, C.base); rect(10, h0 - 4, 2, 1, C.hi); rect(7, h0, 11, 1, C.lo); put(7, h0 + 1, C.dk); put(17, h0 + 1, C.dk); },
  },
  tophat: {
    label: 'Hög hatt', group: 'Fest', uses: ['accent'], front: tophatFB, back: tophatFB,
    side(R) { const { rect, put, cap: C, acc, h0 } = R; rect(9, h0 - 7, 7, 7, C.base); rect(9, h0 - 7, 7, 1, C.hi); put(9, h0 - 6, C.hi); rect(9, h0 - 1, 7, 1, acc.base); rect(7, h0, 11, 1, C.dk); },
  },
};

// ---------- glasögon (look.glasses; false = inga, gamla true ⇒ 'square') ----------
// Ritas sist i ansiktet (före håret). Syns inte bakifrån.
const framesF = (R, fc) => {
  const { rect, put, skin, eyeRow } = R;
  const lens = mix(skin.base, 0xd8f0ff, 0.45);
  for (const lx of [8, 13]) { rect(lx, eyeRow - 1, 3, 2, lens); put(lx + 1, eyeRow - 1, 0x2a1d1a); put(lx + 1, eyeRow, 0x2a1d1a); }
  rect(8, eyeRow - 2, 3, 1, fc); rect(13, eyeRow - 2, 3, 1, fc); rect(11, eyeRow - 1, 2, 1, fc);
  rect(8, eyeRow + 1, 3, 1, mix(fc, skin.base, 0.45)); rect(13, eyeRow + 1, 3, 1, mix(fc, skin.base, 0.45));
  put(7, eyeRow - 1, fc); put(16, eyeRow - 1, fc);
};
const framesS = (R, fc) => {
  const { rect, put, skin, eyeRow } = R;
  rect(12, eyeRow - 2, 5, 1, fc); put(16, eyeRow - 1, mix(fc, 0xd8f0ff, 0.3)); put(16, eyeRow, fc);
  put(14, eyeRow + 1, mix(fc, skin.base, 0.5)); put(15, eyeRow + 1, mix(fc, skin.base, 0.5));
};
export const GLASSES_REG = {
  none: { label: 'Inga' },
  square: { label: 'Fyr\u00adkantiga', group: 'Glasögon', front: (R) => framesF(R, 0x1f1f26), side: (R) => framesS(R, 0x1f1f26) },
  round: { label: 'Runda', group: 'Glasögon', front: (R) => framesF(R, 0x6b3e1e), side: (R) => framesS(R, 0x6b3e1e) },
  sun: {
    label: 'Sol\u00adglasögon', group: 'Solglasögon',
    front(R) { const { rect, put, eyeRow } = R; rect(8, eyeRow - 1, 3, 2, 0x16161c); rect(13, eyeRow - 1, 3, 2, 0x16161c); rect(11, eyeRow - 1, 2, 1, 0x16161c); put(8, eyeRow - 1, 0x8fa0b8); put(13, eyeRow - 1, 0x8fa0b8); },
    side(R) { const { rect, put, eyeRow } = R; rect(14, eyeRow - 1, 3, 2, 0x16161c); rect(11, eyeRow - 1, 3, 1, 0x16161c); put(15, eyeRow - 1, 0x8fa0b8); },
  },
};

// ---------- väskor (look.bag; null = ingen; färg look.bagColor → R.bagC) ----------
const shoulderFB = (R) => {
  const { rect, put, bagC: B, ty0, ty1, tw, back } = R;
  const n = ty1 - ty0;
  for (let i = 0; i < n; i++) put(back ? 10 + tw - Math.round(i * (tw * 2 - 3) / n) : 13 - tw + Math.round(i * (tw * 2 - 3) / n), ty0 + i, B.dk);
  const bx = back ? 12 - tw - 3 : 11 + tw;
  rect(bx, ty1 - 3, 4, 4, B.base); rect(bx, ty1 - 3, 4, 1, B.hi); put(bx + 3, ty1, B.lo);
};
export const BAG_REG = {
  none: { label: 'Ingen' },
  backpack: {
    label: 'Rygg\u00adsäck', group: 'Ryggsäckar',
    front(R) { const { put, bagC: B, ty0, tw, K } = R; for (let y = ty0; y < ty0 + (K ? 4 : 6); y++) { put(12 - tw + 1, y, B.lo); put(10 + tw, y, B.lo); } }, // axelremmarna
    back(R) { const { rect, put, bagC: B, ty0, tw, K } = R;
      rect(12 - tw + 1, ty0 + 1, tw * 2 - 2, (K ? 6 : 9), B.base);
      rect(12 - tw + 1, ty0 + 1, tw * 2 - 2, 1, B.hi);
      put(12 - tw + 1, ty0 + 2, B.hi);
      for (let y = ty0 + 2; y < ty0 + (K ? 7 : 10); y++) put(10 + tw, y, B.lo);
      rect(12 - tw + 2, ty0 + (K ? 4 : 5), tw * 2 - 4, 1, B.dk);
      rect(11, ty0, 2, 1, B.lo); },
    beforeTorso(R) { // från sidan: säcken bakom ryggen
      if (!R.side) return;
      const { rect, put, bagC: B, torsoTop, K } = R;
      rect(5, torsoTop + 1, 4, K ? 6 : 8, B.base); rect(5, torsoTop + 1, 4, 1, B.hi); put(5, torsoTop + 2, B.lo);
      rect(6, torsoTop + (K ? 4 : 5), 3, 1, B.dk); },
    side(R) { R.rect(10, R.torsoTop, 1, 5, R.bagC.dk); }, // remmen över axeln
  },
  shoulder: {
    label: 'Axel\u00adväska', group: 'Axelväskor', front: shoulderFB, back: shoulderFB,
    side(R) { const { rect, put, bagC: B, torsoTop, hipTop } = R; for (let i = 0; i < 7; i++) put(10 + (i >> 1), torsoTop + i, B.dk); rect(13, hipTop - 3, 4, 4, B.base); rect(13, hipTop - 3, 4, 1, B.hi); },
  },
};

// ---------- hals: halsdukar, slipsar, flugor, halsband (look.neck; färg look.neckColor → R.neckC) ----------
// Ritas efter överdelen och förklädet, före väskan och armarna. Huvudet ritas efter –
// det som ska ligga över hakan läggs i kroken afterHead(R).
export const NECK_REG = {
  none: { label: 'Inget' },
};

// ---------- smycken: örhängen, piercingar, armband, klockor (look.jewel) ----------
// Ritas sist, efter huvudbonaden (örhängen syns även med mössa). Armband: kroken afterArms(R).
export const JEWEL_REG = {
  none: { label: 'Inga' },
};

// ---------- hårspännen, diadem, blommor i håret (look.hairAcc) ----------
// Ritas direkt efter håret (och hårfärgseffekten), före huvudbonaden.
// R.topAt(x, fb) ger hårets/huvudets översta pixel i kolumnen x.
export const HAIR_ACC_REG = {
  none: { label: 'Inget' },
};

// ---------- hörlurar (look.phones; false = inga, true = 'over'; färg look.phoneColor → R.phone) ----------
const phonesFB = (R) => {
  const { rect, put, phone: pc, h0, eyeRow } = R;
  rect(9, h0 - 3, 6, 1, 0x2a2a30); put(8, h0 - 2, 0x2a2a30); put(15, h0 - 2, 0x2a2a30); put(7, h0 - 1, 0x2a2a30); put(16, h0 - 1, 0x2a2a30);
  rect(5, eyeRow - 2, 2, 4, pc.base); put(5, eyeRow - 2, pc.hi);
  rect(17, eyeRow - 2, 2, 4, pc.lo);
};
export const PHONES_REG = {
  none: { label: 'Inga' },
  over: {
    label: 'Hörlurar', group: 'Hörlurar', front: phonesFB, back: phonesFB,
    side(R) { const { rect, put, phone: pc, h0, eyeRow } = R; rect(11, h0 - 2, 2, eyeRow - h0, 0x2a2a30); rect(10, eyeRow - 2, 3, 4, pc.base); put(10, eyeRow - 2, pc.hi); },
  },
};
