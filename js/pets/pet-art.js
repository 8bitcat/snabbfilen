// Husdjurens konst: mått per art/ras/ålder, poser per animation och bildruta,
// kroppsdelar, ansikten och pälsmönster. Varje djur är ett litet skelett i 3D
// (höft, bog, huvud, tassar, svanskedja) som projiceras snett ovanifrån; delarna
// målas sedan som 2D-former i pixelduken (pet-canvas.js) med handplacerade ögon,
// nosar, öron och mönster per vy (fram = 'down', bak = 'up', sida = 'right',
// 'left' speglas). Allt i heltalspixlar, en pixelkornighet, ingen skalning.
import { SPECIES } from './sprite-data.js';
import { BW, BH, AX, GY, SP, CP, G, projector, rampOf, newBuf, put, get, grpAt, ell, thick, poly, inkEdge, outline, toCanvas, lum } from './pet-canvas.js';
import { mix, mul, hash } from '../core/floor-pix.js';

const AGE = { unge: 0, ung: 1, vuxen: 2 };
const D2R = Math.PI / 180;
const frac = (x) => x - Math.floor(x);
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const strHash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };
const breedIn = (sp, id) => { const S = SPECIES[sp] || SPECIES.katt; return S.breeds.find((b) => b.id === id) || S.breeds[0]; };

// ======================================================================
//  Mått (pixlar). a = 0 unge, 1 ung, 2 vuxen
// ======================================================================
const DOG_SIZE = { xs: 0.62, s: 0.78, m: 0.9, l: 1, xl: 1.07 };
function dogRig(B, a) {
  const S = DOG_SIZE[B.size] ?? 0.9, HS = S ** 0.62;
  const kb = [0.56, 0.8, 1][a], kl = [0.6, 0.82, 1][a], kh = [0.8, 0.9, 1][a];
  const legs = B.legs ?? 1, len = B.len ?? 1, bulk = B.bulk ?? 1;
  return {
    S, legH: 4.0 * S * kl * legs + (a === 0 ? 0.6 : 0),
    tR: 2.5 * S * kb * bulk, tW: 2.7 * S * kb * bulk,
    bodyL: 6.6 * S * kb * len,
    hRx: 3.35 * HS * kh, hRy: 3.2 * HS * kh, hW: 3.7 * HS * kh * (B.head ?? 1),
    snL: ({ long: 2.3, mid: 1.7, short: 1.0, flat: 0.3 })[B.snout || 'mid'] * HS * [0.5, 0.78, 1][a],
    snH: 1.45 * HS * kh * (B.snout === 'flat' ? 1.1 : 1),
    legW: S * [0.8, 0.92, 1][a] >= 0.7 ? 2 : 1,
    ears: B.ears || 'flop', earL: 2.2 * HS * kh * (B.ears === 'bat' ? 1.3 : 1),
    tail: B.tail || 'whip', tailL: 4.4 * S * [0.5, 0.78, 1][a] * (B.tailK ?? 1),
    eyeBig: a === 0,
  };
}
function catRig(B, a) {
  const S = B.big ? 1.1 : B.slim ? 0.97 : 1, HS = S ** 0.62;
  const kb = [0.56, 0.8, 1][a], kl = [0.55, 0.8, 1][a], kh = [0.8, 0.9, 1][a];
  return {
    S, legH: 2.9 * S * kl * (B.slim ? 1.12 : 1) + (a === 0 ? 0.3 : 0),
    tR: 2.0 * S * kb * (B.round ? 1.12 : 1), tW: 2.2 * S * kb * (B.round ? 1.15 : 1),
    bodyL: 4.6 * S * kb * (B.slim ? 1.08 : 1),
    hRx: 2.25 * HS * kh, hRy: 2.05 * HS * kh, hW: 2.45 * HS * kh * (B.round ? 1.08 : B.slim ? 0.94 : 1),
    snL: 0.5 * HS * kh, snH: 1.0 * HS * kh,
    legW: a === 0 ? 1 : 2,
    ears: 'cat', earL: 1.75 * HS * kh * (B.slim ? 1.15 : B.round ? 0.85 : 1),
    tail: B.fluff ? 'bushy' : 'cat', tailL: 5.0 * S * [0.5, 0.78, 1][a],
    eyeBig: a === 0,
  };
}
function rabbitRig(B, a) {
  const S = B.round ? 1.05 : 1;
  const kb = [0.6, 0.82, 1][a], kh = [0.82, 0.92, 1][a];
  return {
    S, legH: 0,
    tR: 2.25 * S * kb, tW: 2.45 * S * kb, bodyL: 2.1 * S * kb,
    hRx: 1.85 * kh, hRy: 1.7 * kh, hW: 1.95 * kh * (B.round ? 1.08 : 1),
    snL: 0.4 * kh, snH: 0.9 * kh,
    legW: 1,
    ears: B.ears || 'up', earL: (B.ears === 'short' ? 1.7 : B.ears === 'lop' ? 2.6 : 3.0) * kh * [0.78, 0.9, 1][a],
    tail: 'puff', tailL: 1,
    eyeBig: a === 0,
  };
}

export function rigOf(pet) {
  const sp = SPECIES[pet?.species] ? pet.species : 'katt';
  const B = breedIn(sp, pet?.breed);
  const C = pet?.breed2 ? breedIn(sp, pet.breed2) : B;
  const a = AGE[pet?.stage] ?? 2;
  const R = sp === 'hund' ? dogRig(B, a) : sp === 'katt' ? catRig(B, a) : rabbitRig(B, a);
  Object.assign(R, { sp, B, C, age: a, sex: pet?.sex === 'hona' ? 'hona' : 'hane' });
  R.seed = pet?.seed != null ? strHash(pet.seed) : -1;
  R.fluff = C.fluff || B.fluff || 0;
  R.curly = sp === 'hund' && (C.coat === 'curly' || B.coat === 'curly');
  R.sp2 = R.tW * 0.52; // benens sidledsavstånd
  return R;
}

// ======================================================================
//  Poser – fyrfotadjur (hund, katt). Modell: u framåt, v vänster, w upp.
// ======================================================================
// ben: { front, v, paw:[u,w], kind: 'stand'|'sit'|'fold'|'tuck'|'up'|'lift'|'bent', knee }
function quadPose(R, anim, f) {
  const cat = R.sp === 'katt';
  const { legH, tR, bodyL, hRx, hRy } = R;
  const sp = R.sp2;
  const P = {
    hip: [-bodyL / 2, legH + tR], sh: [bodyL / 2, legH + tR + (cat ? 0 : 0.15)], lift: 0,
    head: null, hp: 0, tilt: 0, legs: null, tail: { up: cat ? 55 : 28, wag: 0 },
    eyes: f.blink ? 'closed' : 'open', mouth: 'closed', ears: 'normal', breath: 0, blush: false, look: 0,
  };
  const headStd = () => cat
    ? [P.sh[0] + tR * 0.62 + hRx * 0.4, P.sh[1] + tR * 0.3 + hRy * 0.5]
    : [P.sh[0] + tR * 0.72 + hRx * 0.42, P.sh[1] + tR * 0.35 + hRy * 0.52];
  const stand = (du = [0, 0, 0, 0], up = [0, 0, 0, 0]) => {
    const fu = P.sh[0] + 0.25, hu = P.hip[0] - 0.05;
    P.legs = [
      { front: true, v: sp, paw: [fu + du[0], up[0]], kind: 'stand' },
      { front: true, v: -sp, paw: [fu + du[1], up[1]], kind: 'stand' },
      { front: false, v: sp, paw: [hu + du[2], up[2]], kind: 'stand' },
      { front: false, v: -sp, paw: [hu + du[3], up[3]], kind: 'stand' },
    ];
  };
  const wagA = [-1, 0, 1, 0][f.wag || 0];
  switch (anim) {
    case 'walk': {
      const s = f.step || 0, A = Math.max(0.7, legH * 0.26 + 0.3);
      const ph = [1, 0, -1, 0][s];
      const L = Math.max(0.9, legH * 0.2);
      // diagonala par: (VF, HB) och (HF, VB)
      const up = s === 1 ? [0, L, L, 0] : s === 3 ? [L, 0, 0, L] : [0, 0, 0, 0];
      stand([A * ph, -A * ph, -A * ph, A * ph], up);
      P.lift = s === 1 || s === 3 ? 1 : 0;
      P.tail = { up: cat ? 42 : 30, wag: cat ? wagA * 0.35 : wagA * 0.6 };
      break;
    }
    case 'run': {
      const s = f.step || 0, A = legH * 0.45 + 0.7;
      stand();
      const fu = P.sh[0] + 0.25, hu = P.hip[0] - 0.05;
      const lf = [[A * 1.15, 0.2], [0.2, 1.1], [-A * 0.7, 0.3], [A * 0.3, 1.5]][s];
      const lh = [[-A * 1.1, 0.3], [-A * 0.2, 1.3], [A * 0.8, 0.2], [0, 1.2]][s];
      P.legs[0].paw = [fu + lf[0], lf[1]]; P.legs[1].paw = [fu + lf[0] - 0.7, lf[1] * 0.6];
      P.legs[2].paw = [hu + lh[0], lh[1]]; P.legs[3].paw = [hu + lh[0] + 0.7, lh[1] * 0.6];
      P.lift = [0, 1, 2, 1][s];
      P.hip[1] += [0.4, 0, -0.3, 0][s]; P.sh[1] += [-0.3, 0, 0.4, 0][s];
      P.tail = { up: cat ? 12 : 8, wag: wagA * 0.3 };
      P.ears = 'back';
      if (!cat) P.mouth = 'tongue';
      break;
    }
    case 'sit': case 'love': case 'beg': {
      const beg = anim === 'beg' && !cat;
      P.hip = [-bodyL * 0.22, tR * 0.95];
      P.sh = beg ? [P.hip[0] + tR * 0.25, P.hip[1] + bodyL * 0.72 + tR * 0.5] : [bodyL * (cat ? 0.12 : 0.18), legH + tR * (cat ? 1.25 : 1.1)];
      const fu = P.sh[0] + (cat ? 0.35 : 0.45);
      P.legs = [
        beg ? { front: true, v: sp * 0.9, kind: 'up', alt: f.alt } : { front: true, v: sp * (cat ? 0.7 : 0.85), paw: [fu, 0], kind: 'stand' },
        beg ? { front: true, v: -sp * 0.9, kind: 'up', alt: 1 - f.alt } : { front: true, v: -sp * (cat ? 0.7 : 0.85), paw: [fu, 0], kind: 'stand' },
        { front: false, v: sp * 1.2, kind: 'sit', paw: [P.hip[0] + tR * 1.05, 0] },
        { front: false, v: -sp * 1.2, kind: 'sit', paw: [P.hip[0] + tR * 1.05, 0] },
      ];
      P.head = beg ? [P.sh[0] + hRx * 0.35, P.sh[1] + tR * 0.35 + hRy * 0.85]
        : cat ? [P.sh[0] + tR * 0.3 + hRx * 0.2, P.sh[1] + tR * 0.35 + hRy * 0.72] : [P.sh[0] + tR * 0.45 + hRx * 0.3, P.sh[1] + tR * 0.45 + hRy * 0.78];
      P.tail = cat ? { lie: true, wrap: 1, wag: wagA * 0.2 } : { lie: true, wag: wagA * 0.8 };
      P.breath = f.breath ? 1 : 0;
      if (anim === 'love') { P.eyes = 'happy'; P.blush = true; P.tilt = 1; }
      if (anim === 'beg') { P.hp = 16; P.mouth = cat ? (f.alt ? 'meow' : 'closed') : 'tongue'; P.eyes = f.blink ? 'closed' : 'big'; if (cat) P.legs[0] = { front: true, v: sp * 0.7, kind: 'up', alt: f.alt }; }
      break;
    }
    case 'sleep': {
      P.sleep = true;
      P.hip = [-bodyL * 0.34, tR * 0.9]; P.sh = [bodyL * 0.3, tR * 0.92];
      P.legs = [
        { front: true, v: sp * 0.7, kind: 'tuck' }, { front: true, v: -sp * 0.7, kind: 'tuck' },
        { front: false, v: sp, kind: 'fold' }, { front: false, v: -sp, kind: 'fold' },
      ];
      P.head = [P.sh[0] + tR * 0.6 + hRx * 0.45, hRy * 0.95];
      P.hp = -6;
      P.eyes = 'closed'; P.breath = f.breath ? 1 : 0;
      P.tail = { lie: true, wrap: 1, wag: 0 };
      P.ears = 'rest';
      break;
    }
    case 'eat': {
      stand();
      P.head = [P.sh[0] + tR * 0.75 + hRx * 0.55, hRy * 0.95 + (f.chew ? 0.5 : 0) + legH * 0.12];
      P.hp = -40;
      P.eat = true;
      P.tail = { up: cat ? 22 : 32, wag: cat ? 0 : wagA * 0.7 };
      P.eyes = f.blink || (cat && f.chew) ? 'closed' : 'down';
      break;
    }
    case 'play': {
      const s = f.step || 0;
      if (s < 2) {
        // lekbugning: framdelen ner, rumpan upp
        stand();
        P.sh = [bodyL / 2 + 0.2, tR * 1.0 + 0.2];
        P.hip = [-bodyL / 2, legH + tR * 1.05 + (s ? 0.4 : 0)];
        P.legs[0] = { front: true, v: sp, kind: 'tuck', stretch: 1 };
        P.legs[1] = { front: true, v: -sp, kind: 'tuck', stretch: 1 };
        P.head = [P.sh[0] + tR * 0.75 + hRx * 0.45, tR * 1.05 + hRy * 0.85];
        P.hp = 6;
        P.tail = { up: cat ? 70 : 60, wag: wagA * (cat ? 0.5 : 1) };
      } else {
        stand([0.6, 0.6, -0.3, -0.3], [0.8, 0.8, 0, 0]);
        P.lift = s === 2 ? 2 : 1;
        P.sh[1] += 0.6;
        if (cat) P.legs[0] = { front: true, v: sp, kind: 'up', alt: 0, swipe: 1 };
        P.tail = { up: cat ? 60 : 50, wag: wagA };
      }
      P.eyes = 'big';
      if (!cat) P.mouth = 'tongue';
      P.ears = cat ? 'normal' : 'perk';
      break;
    }
    case 'poop': case 'pee': {
      const lift = anim === 'pee' && !cat && R.sex === 'hane';
      stand();
      if (lift) {
        P.legs[3] = { front: false, v: -sp, kind: 'lift' }; // närmaste bakbenet lyfts (sidovy: mot kameran)
        P.tail = { up: 40, wag: 0 };
        P.hip[1] += 0.2;
      } else {
        const sq = anim === 'poop' ? 1 : 0.7;
        P.hip = [-bodyL * 0.36, legH * (1 - 0.6 * sq) + tR * 0.9];
        P.sh = [bodyL * 0.45, legH + tR * 0.95];
        P.legs[2] = { front: false, v: sp * 1.15, kind: 'squat', paw: [P.hip[0] + tR * 0.6, 0] };
        P.legs[3] = { front: false, v: -sp * 1.15, kind: 'squat', paw: [P.hip[0] + tR * 0.6, 0] };
        P.arch = anim === 'poop' ? 0.5 + (f.alt ? 0.25 : 0) : 0.15;
        P.tail = { up: cat ? 30 : 55, wag: 0 };
      }
      P.head = headStd();
      if (anim === 'poop') P.eyes = f.alt ? 'closed' : 'squint';
      break;
    }
    case 'happy': {
      const s = f.step || 0;
      stand([0.2, 0.2, -0.2, -0.2]);
      if (cat) {
        P.tail = { up: 88, wag: wagA * 0.15, quiver: true };
        P.eyes = 'happy'; P.blush = true;
        P.lift = 0;
        P.hip[1] += [0, 0.35, 0, 0.35][s]; P.sh[1] += [0.35, 0, 0.35, 0][s];
      } else {
        P.lift = [0, 1, 2, 1][s];
        if (s === 2) { P.legs[0].paw[1] = 0.9; P.legs[1].paw[1] = 0.9; P.sh[1] += 0.5; }
        P.tail = { up: 50, wag: wagA * 1.3 };
        P.mouth = 'tongue';
        P.eyes = 'happy';
        P.ears = 'perk';
      }
      break;
    }
    default: { // idle
      stand();
      P.breath = f.breath ? 1 : 0;
      P.tail = { up: cat ? 55 : 26, wag: cat ? wagA * 0.3 : wagA * 0.45 };
      P.look = f.look || 0;
    }
  }
  if (!P.head) P.head = headStd();
  return P;
}

// ======================================================================
//  Poser – kanin
// ======================================================================
function rabbitPose(R, anim, f) {
  const { tR, bodyL, hRx, hRy } = R;
  const P = {
    hip: [-bodyL / 2, tR * 0.98], sh: [bodyL / 2, tR * 0.78 + 0.2], lift: 0, head: null, hp: 0,
    eyes: f.blink ? 'closed' : 'open', mouth: 'closed', ears: 'normal', nose: f.nose || 0, stretch: 0, front: 0, stand: false,
    earWiggle: 0, breath: 0, blush: false,
  };
  switch (anim) {
    case 'walk': case 'run': {
      const s = f.step || 0, big = anim === 'run' ? 1.5 : 1;
      P.stretch = [0, 0.9, 1.3, 0.5][s] * big;
      P.lift = Math.round([0, 1, 2, 1][s] * big);
      P.front = [0, 0.7, 1.2, 1.5][s] * big;
      P.ears = s === 2 ? 'back' : 'normal';
      break;
    }
    case 'sleep': P.eyes = 'closed'; P.ears = 'flat'; P.hip[1] -= 0.2; P.sh[1] -= 0.3; P.breath = f.breath ? 1 : 0; P.sleep = true; break;
    case 'eat': P.eat = true; P.chew = f.chew; P.eyes = f.blink ? 'closed' : 'down'; break;
    case 'beg': P.stand = true; P.eyes = f.blink ? 'closed' : 'big'; P.nose = f.nose; break;
    case 'love': P.eyes = 'happy'; P.blush = true; P.breath = f.breath ? 1 : 0; break;
    case 'happy': case 'play': {
      const s = f.step || 0;
      P.lift = [0, 2, 3, 1][s]; P.twist = [0, 1, -1, 0][s]; P.stretch = [0, 0.6, 0.2, 0][s];
      P.eyes = anim === 'happy' ? 'happy' : 'big';
      if (anim === 'happy') P.blush = true;
      break;
    }
    case 'poop': case 'pee': P.hip[1] -= 0.3; P.eyes = f.alt ? 'closed' : 'squint'; P.tailUp = true; break;
    case 'sit': P.sit = true; P.breath = f.breath ? 1 : 0; P.earWiggle = f.ear; break;
    default: P.breath = f.breath ? 1 : 0; P.earWiggle = f.ear; break;
  }
  return P;
}

// ======================================================================
//  Päls: färg per del och läge (q) för rasens mönster
// ======================================================================
// q: { lu, lv } (normerat inom delen: lu −1 vänster/bak … 1 höger/fram, lv −1 upp … 1 ner),
//    bu (0 höft … 1 bog), bw (−1 buk … 1 rygg), lat (−1 … 1 i sidled, fram/bak-vy), t (längs ben/svans)
function coatOf(R, view) {
  const C = R.C, sp = R.sp;
  const c = C.c, c2 = C.c2 ?? mix(c, 0xffffff, 0.6), c3 = C.c3 ?? c2, belly = C.belly ?? mix(c, 0xf4efe6, 0.35);
  const pink = 0xeaa0ac;
  const side = view === 'side', front = view === 'front', back = view === 'back';
  const whiteSock = R.seed >= 0 && R.seed < 0.3;          // individuella tecken (ungar av blandras)
  const blaze = R.seed >= 0.3 && R.seed < 0.5;
  return (part, q, i, j) => {
    const { lu = 0, lv = 0, bu = 0.5, bw = 0.5, t = 0, lat = 0 } = q;
    const torso = part === 'rump' || part === 'mid' || part === 'chest' || part === 'neck' || part === 'thigh';
    const leg = part === 'leg' || part === 'paw' || part === 'foot';
    if (part === 'earIn') return sp === 'hund' ? mix(C.pat === 'solid' || C.pat === 'mask' ? mul(c, 0.8) : c, pink, 0.4) : pink;
    if (part === 'tuft') return mul(c3, 0.95);
    if (whiteSock && (part === 'paw' || (leg && t > 0.7))) return 0xf4f2ee;
    if (blaze && part === 'head' && front && Math.abs(lu) < 0.16 && lv > -0.6) return 0xf4f2ee;
    switch (C.pat) {
      case 'tabby': {
        const ring = (x) => frac(x) < 0.34;
        if (part === 'ear') return mul(c, 0.94);
        if (part === 'snout') return C.c3 ?? belly;
        if (part === 'ruff') return C.c3 ?? belly;
        if (part === 'head') {
          if (front || back) {
            if (lv < -0.35 && Math.abs(lu) < 0.55 && ring(lu * 2.6 + 0.5)) return c2;                      // "M" i pannan / ränder bak
            if (front && Math.abs(lu) > 0.6 && lv > -0.2 && lv < 0.45 && ring(lv * 2.2 + 0.3)) return c2;  // kindränder
            if (front && lv > 0.45 && Math.abs(lu) < 0.55) return C.c3 ?? belly;
            return c;
          }
          if (lv < -0.25 && lu < 0.35 && ring(lu * 2.2 + 0.2)) return c2;
          if (lu > -0.1 && lv > -0.05 && lv < 0.45 && ring(lv * 2.4)) return c2;
          return lv > 0.5 && lu > 0.1 ? (C.c3 ?? belly) : c;
        }
        if (torso) {
          if (C.c3 && (part === 'chest' && (front ? lv > -0.2 : lu > 0.2 && lv > -0.3) || part === 'neck')) return C.c3;
          if (bw < -0.45) return belly;
          if (side && ring(bu * 3.2 + bw * 0.35 + 0.1)) return c2;
          if (!side && ring(bu * 3.2 + lat * lat * 0.8)) return c2;
          return c;
        }
        if (leg) return C.c3 && t > 0.6 ? C.c3 : ring(t * 2.4 + 0.2) ? c2 : c;
        if (part === 'tail') return t > 0.82 ? c2 : ring(t * 3.4) ? c2 : c;
        return c;
      }
      case 'tortie': {
        const cell = hash(Math.floor(i / 2.2 + (side ? 0 : 50)), Math.floor(j / 2.6), 7);
        if (part === 'snout') return c3;
        if (part === 'ear') return lu < 0 ? c : c2;
        if (part === 'head') return (front || back) ? (lu > 0.08 ? c2 : c) : (lv < 0 ? c : c2);
        if (part === 'paw') return c3;
        return cell < 0.42 ? c : cell < 0.78 ? c2 : cell < 0.88 ? c3 : c;
      }
      case 'tux': {
        if (part === 'snout') return c2;
        if (part === 'head') {
          if (front) return (Math.abs(lu) < 0.2 && lv > -0.15) || (lv > 0.4 && Math.abs(lu) < 0.62) ? c2 : c;
          if (side) return lu > 0.55 && lv > 0.15 ? c2 : c;
          return c;
        }
        if (part === 'chest') return front ? (Math.abs(lu) < 0.7 ? c2 : c) : back ? c : (lu > 0.1 && lv > -0.2 ? c2 : c);
        if (part === 'neck') return side && lv > 0 ? c2 : c;
        if (torso) return bw < -0.5 ? c2 : c;
        if (leg) return t > 0.6 || part === 'paw' ? c2 : c;
        return c;
      }
      case 'points': {
        const pt = c2;
        if (part === 'ear' || part === 'snout' || part === 'tail') return part === 'tail' && t < 0.15 ? mix(c, pt, 0.6) : pt;
        if (part === 'head') {
          if (front) { const d = Math.hypot(lu * 1.1, lv - 0.35); return d < 0.6 ? pt : d < 0.8 ? mix(pt, c, 0.5) : c; }
          if (side) return lu > 0.3 && lv > -0.3 ? mix(pt, c, clamp01((0.6 - lu) * 1.6)) : c;
          return mix(c, pt, 0.2);
        }
        if (leg) return t > 0.3 || part === 'paw' ? pt : mix(c, pt, 0.5);
        if (torso) return bw > 0.4 ? mix(c, pt, 0.2) : c;
        return c;
      }
      case 'saddle': {
        if (part === 'ear') return mix(c2, c, 0.15);
        if (part === 'snout') return c2;
        if (part === 'head') {
          if (front) return lv < -0.45 ? mix(c, c2, 0.5) : lv > 0.25 && Math.abs(lu) < 0.45 ? mix(c, c2, 0.55) : c;
          if (side) return lu > 0.35 && lv > -0.2 ? mix(c, c2, 0.5) : lv < -0.4 ? mix(c, c2, 0.45) : c;
          return lv < -0.2 ? mix(c, c2, 0.6) : c;
        }
        if (part === 'mid' || part === 'rump') return bw > -0.05 ? c2 : c;
        if (part === 'neck' || part === 'chest') return side ? (bw > 0.55 && part !== 'chest' ? c2 : c) : (back && bw > 0.2 ? c2 : c);
        if (part === 'tail') return t < 0.75 && (lu < 0.1) ? c2 : mix(c2, c, 0.3);
        if (part === 'thigh') return bw > 0.4 ? c2 : c;
        return c;
      }
      case 'husky': {
        if (part === 'ear') return c;
        if (part === 'snout') return c2;
        if (part === 'head') {
          if (front) { if (lv < -0.3) return c; if (Math.abs(lu) < 0.14 && lv < 0.05) return c; if (lv < -0.05 && Math.abs(lu) > 0.62) return c; return c2; }
          if (side) return lv < -0.15 && lu < 0.55 ? c : lu < -0.35 ? c : c2;
          return c;
        }
        if (part === 'chest') return front ? c2 : back ? c : lu > 0 && lv > -0.3 ? c2 : c;
        if (torso) return bw > -0.25 ? c : c2;
        if (part === 'tail') return (side ? (bw > 0 || t < 0.3) : back) && t < 0.85 ? c : c2;
        if (leg) return c2;
        return c;
      }
      case 'collie': {
        if (part === 'snout') return c2;
        if (part === 'head') return (front && Math.abs(lu) < 0.2) || (side && lu > 0.6 && lv > -0.3) ? c2 : c;
        if (part === 'neck') return c2;
        if (part === 'chest') return front ? c2 : side ? (lu > 0 ? c2 : c) : mix(c, c2, 0) ;
        if (torso) return bw < -0.55 ? c2 : c;
        if (leg) return t > 0.4 || part === 'paw' ? c2 : c;
        if (part === 'tail') return t > 0.75 ? c2 : c;
        return c;
      }
      case 'jack': {
        if (part === 'ear') return c2;
        if (part === 'head') {
          if (front) return Math.abs(lu) > 0.2 && lv < 0.45 ? c2 : c;
          if (side) return lu < 0.45 && lv < 0.35 ? c2 : c;
          return c2;
        }
        if (part === 'snout') return c;
        if (part === 'rump' && (side ? bw > 0.1 : bw > 0.2)) return c2;
        if (part === 'tail') return t < 0.6 ? c2 : c;
        return c;
      }
      case 'corgi': {
        if (part === 'ear') return c;
        if (part === 'snout') return c2;
        if (part === 'head') return (front && (Math.abs(lu) < 0.16 || lv > 0.5)) || (side && lu > 0.5 && lv > 0) ? c2 : c;
        if (part === 'neck') return side ? (lv > -0.1 ? c2 : c) : c2;
        if (part === 'chest') return front ? c2 : side ? (lu > -0.1 || lv > 0.2 ? c2 : c) : c;
        if (torso) return bw < -0.35 ? c2 : c;
        if (leg) return c2;
        if (part === 'tail') return c2;
        return c;
      }
      case 'mask': {
        const dk = c2;
        if (part === 'ear') return dk;
        if (part === 'snout') return dk;
        if (part === 'head') {
          if (front) { const d = Math.hypot(lu * 0.95, (lv - 0.3) * 1.1); if (d < 0.5) return dk; if (d < 0.66) return mix(c, dk, 0.55); if (lv < -0.35 && lv > -0.55 && Math.abs(lu) < 0.4) return mul(c, 0.84); return c; }
          if (side) return lu > 0.62 && lv > -0.3 ? mix(c, dk, 0.6) : c;
          return c;
        }
        if (part === 'tail') return mul(c, 0.95);
        return c;
      }
      case 'bib': {
        if (part === 'ear') return mul(c, 0.8);
        if (part === 'snout') return side ? (q.sv > 0.1 ? c2 : c) : c2;
        if (part === 'head') return front && Math.abs(lu) < 0.15 && lv > -0.55 ? c2 : c;
        if (part === 'chest') return front ? (Math.abs(lu) < 0.55 ? c2 : c) : side ? (lu > 0.15 && lv > -0.35 ? c2 : c) : c;
        if (part === 'neck') return side && lv > 0 ? c2 : c;
        if (part === 'paw') return c2;
        if (part === 'tail') return t > 0.82 ? c2 : c;
        return c;
      }
      case 'agouti': {
        if (part === 'puff') return lv < -0.3 ? c : 0xf4f2ec;
        if (part === 'ear') return mix(c, c2, 0.35);
        if (torso && bw < -0.4) return belly;
        if (part === 'snout') return belly;
        if (part === 'head' && front && lv > 0.3) return mix(c, belly, 0.5);
        const h = hash(i, j, 11);
        return h < 0.2 ? c2 : h < 0.3 ? mix(c, 0xe8d8b8, 0.45) : c;
      }
      case 'spots': {
        if (part === 'ear') return c2;
        if (part === 'puff') return c;
        if (part === 'head') {
          if (front) { if (Math.abs(lu) > 0.25 && Math.abs(lu) < 0.8 && lv > -0.45 && lv < 0.15) return c2; return c; }
          if (side) return lu > 0 && lu < 0.7 && lv > -0.5 && lv < 0.15 ? c2 : c;
          return c;
        }
        if (part === 'snout') return c2;
        if (torso) {
          if (!front && Math.abs(lat) < 0.2 && bw > 0.6) return c2;
          if (side && bw > 0.75) return c2;
          const h = hash(Math.floor(i / 2), Math.floor(j / 2), 21);
          return h < 0.26 && bw < 0.5 ? c2 : c;
        }
        return c;
      }
      case 'dutch': {
        if (part === 'ear') return c;
        if (part === 'puff') return c;
        if (part === 'head') {
          if (front) return Math.abs(lu) < 0.18 + clamp01(lv + 0.2) * 0.5 ? c2 : c;
          if (side) return lu > 0.55 && lv > -0.2 ? c2 : c;
          return c;
        }
        if (part === 'snout') return c2;
        if (part === 'neck' || part === 'chest') return c2;
        if (part === 'mid') return bu > 0.5 ? c2 : c;
        if (part === 'foot') return t > 0.5 ? c2 : c;
        if (part === 'leg' || part === 'paw') return c2;
        return c;
      }
      default: { // solid
        if (part === 'ear') return sp === 'hund' ? mul(c, R.B.id === 'labrador' || R.B.id === 'golden' ? 0.88 : 0.92) : c;
        if (part === 'puff') return sp === 'kanin' ? mix(c, 0xffffff, 0.55) : c;
        if (part === 'mane') return mix(c, 0xf8e8c8, 0.28);
        if (part === 'tail' && R.B.id === 'golden') return mix(c, 0xf4e0b0, 0.25 + t * 0.3);
        if (part === 'snout' && sp !== 'hund') return mix(c, 0xffffff, 0.25);
        if (sp === 'kanin' && part === 'head' && front && lv > 0.35) return mix(c, 0xffffff, 0.2);
        if (R.curly && hash(i, j, 3) < 0.3) return mix(c, 0xb8a890, 0.3);
        return c;
      }
    }
  };
}

// ======================================================================
//  Ögon, nos, mun
// ======================================================================
const EYE_DK = 0x18121a, GLINT = 0xfcfaff;
function eyeAt(B, x, y, R, st, iris, fur, mirror) {
  // x = ögats vänstra kolumn, y = översta raden. mirror: glansen på andra sidan
  const lid = mix(rampOf(fur)[3], EYE_DK, 0.45);
  const big = R.eyeBig || st === 'big';
  if (st === 'closed' || st === 'squint') {
    const w = big ? 2 : 1;
    const yy = y + (big ? 1 : 1);
    for (let q = 0; q < w; q++) put(B, x + q, yy, lid, G.face);
    if (st === 'closed' && !big) put(B, x + (mirror ? 1 : -1), yy, mix(lid, fur, 0.55), G.face);
    return;
  }
  if (st === 'happy') {
    // ^ – en liten båge
    if (big) { put(B, x, y + 1, lid, G.face); put(B, x + 1, y, lid, G.face); put(B, x + 2, y + 1, lid, G.face); }
    else { put(B, x, y, lid, G.face); put(B, x - 1, y + 1, lid, G.face); put(B, x + 1, y + 1, lid, G.face); }
    return;
  }
  const down = st === 'down';
  if (big) {
    // 2×2: glans uppe mot ljuset, iris nere
    const gx = mirror ? x + 1 : x;
    put(B, x, y, EYE_DK, G.face); put(B, x + 1, y, EYE_DK, G.face);
    put(B, x, y + 1, iris != null ? mix(iris, EYE_DK, 0.35) : EYE_DK, G.face); put(B, x + 1, y + 1, iris != null ? mix(iris, EYE_DK, 0.35) : EYE_DK, G.face);
    if (!down) put(B, gx, y, GLINT, G.face);
    return;
  }
  // 1×2
  if (iris != null) {
    put(B, x, y, down ? mix(iris, EYE_DK, 0.5) : mix(iris, GLINT, 0.18), G.face);
    put(B, x, y + 1, EYE_DK, G.face);
  } else {
    put(B, x, y, down ? EYE_DK : mix(EYE_DK, GLINT, 0.28), G.face);
    put(B, x, y + 1, EYE_DK, G.face);
  }
}

// ======================================================================
//  Bygg en bildruta
// ======================================================================
export function paintPet(pet, anim, dir, f) {
  const R = rigOf(pet);
  const view = dir === 'down' ? 'front' : dir === 'up' ? 'back' : 'side';
  if (view !== 'side') {
    // fram/bak: kortare kropp (annars blir djuren höga pinnar), bredare kropp och större huvud
    const rab = R.sp === 'kanin';
    R.bodyL *= rab ? 0.85 : view === 'front' ? 0.7 : 0.5;
    R.tW *= rab ? 1.08 : 1.18; R.hW *= rab ? 1.05 : 1.1;
    R.sp2 = R.tW * 0.52;
    R.tailL *= 0.85;
  }
  const B = newBuf();
  const coat = coatOf(R, view);
  let P, info;
  if (R.sp === 'kanin') { P = rabbitPose(R, anim, f); info = drawRabbit(B, R, P, view, coat); }
  else { P = quadPose(R, anim, f); info = drawQuad(B, R, P, view, coat); }
  if (R.fluff || R.curly) fringe(B, R);
  outline(B);
  const spr = toCanvas(B, dir === 'left');
  const flipX = (x) => (dir === 'left' ? -x : x);
  spr.neck = { x: flipX(Math.round(info.neck[0] - AX - 0.5)), y: Math.round(info.neck[1] - GY - 0.5) };
  spr.lift = P.lift || 0;
  // skugga: fotavtrycket
  const len = R.sp === 'kanin' ? R.bodyL + R.tR * 2.2 : R.bodyL + R.tR * 1.7;
  const wid = R.tW * 2 + 0.8;
  spr.shadow = view === 'side'
    ? { rx: Math.max(3, Math.round(len / 2 + (P.sleep ? 0.5 : 0))), ry: Math.max(1, Math.round(wid * SP / 2 + 0.2)) }
    : { rx: Math.max(2, Math.round(wid / 2 + 0.3)), ry: Math.max(1, Math.round(len * SP / 2 + 0.2)) };
  return spr;
}

// luddiga raser: små tofsar längs konturen (undersida/svans) – deterministiskt
function fringe(B, R) {
  const add = [];
  for (let j = 1; j < BH - 1; j++) for (let i = 1; i < BW - 1; i++) {
    const k = j * BW + i;
    if (B.col[k] >= 0) continue;
    const up = B.col[k - BW], g = B.grp[k - BW];
    if (up >= 0 && (g === G.body || g === G.tail || g === G.mane || g === G.thigh || g === G.tailNear) && hash(i, j, 5) < (R.curly ? 0.3 : 0.22 * R.fluff)) add.push([k, mul(up, 0.9), g]);
  }
  for (const [k, c, g] of add) { B.col[k] = c; B.grp[k] = g; }
}

// ======================================================================
//  Fyrfotadjur
// ======================================================================
function drawQuad(B, R, P, view, coat) {
  const cat = R.sp === 'katt', dog = !cat;
  const side = view === 'side', front = view === 'front', back = view === 'back';
  const pr = projector(view);
  const L = P.lift || 0;
  const Pt = (u, v, w, lifted = true) => { const p = pr(u, v, w); if (lifted) p[1] -= L; return p; };
  const { tR, tW, legH } = R;
  const parts = [];
  const add = (z, fn) => parts.push({ z, fn });
  const breath = P.breath ? 0.35 : 0;
  const hip3 = [P.hip[0], 0, P.hip[1]], sh3 = [P.sh[0], 0, P.sh[1]];
  const H2 = Pt(...hip3), S2 = Pt(...sh3);
  const axx = S2[0] - H2[0], axy = S2[1] - H2[1], alen = Math.hypot(axx, axy) || 1;
  const ax = [axx / alen, axy / alen], upv = [ax[1], -ax[0]];
  // torso-koordinater för mönster
  const torsoQ = (i, j, lu, lv) => {
    const px = i + 0.5 - H2[0], py = j + 0.5 - H2[1];
    if (side) {
      const bu = (px * ax[0] + py * ax[1]) / alen;
      let bw = (px * upv[0] + py * upv[1]) / tR;
      if (upv[1] > 0) bw = -bw;
      return { lu, lv, bu, bw, lat: 0 };
    }
    const lat = (i + 0.5 - (AX + 0.5)) / (tW * 1.1);
    const bu = front ? clamp01((py) / (axy || 1)) : clamp01(py / (axy || -1));
    return { lu, lv, bu, bw: 1 - lat * lat * 1.6, lat };
  };
  const M = (part, extra) => (i, j, lu, lv) => coat(part, { ...torsoQ(i, j, lu, lv), ...(extra || {}) }, i, j);

  // ---------- bål ----------
  const zOf = (p3) => pr(...p3)[2];
  if (P.sleep) {
    add(zOf(hip3) * 0.5 + zOf(sh3) * 0.5, () => {
      const cx = (H2[0] + S2[0]) / 2, cy = (H2[1] + S2[1]) / 2;
      if (side) ell(B, cx, cy, alen / 2 + tR * 1.05, tR * (0.95 + breath * 0.15) + 0.2, 0, M('mid'), { g: G.body });
      else ell(B, cx, cy, tW * 1.12, Math.abs(axy) / 2 + tR * (0.9 + breath * 0.12), 0, M('mid'), { g: G.body });
    });
  } else {
    const fb = !side;
    add(zOf(hip3), () => ell(B, H2[0], H2[1], fb ? tW * 0.98 : tR * 1.0, fb ? tR * 0.9 : tR * (1.0 + breath * 0.1), 0, M('rump'), { g: G.body, ink: back ? false : undefined }));
    const mid3 = [(hip3[0] + sh3[0]) / 2, 0, (hip3[2] + sh3[2]) / 2 + (P.arch || 0)];
    const Mid = Pt(...mid3);
    add(zOf(mid3), () => {
      if (side) ell(B, Mid[0], Mid[1] - tR * 0.14, alen / 2 + tR * 0.35, tR * (0.78 + breath * 0.1), Math.atan2(ax[1], ax[0]), M('mid'), { g: G.body });
      else ell(B, Mid[0], Mid[1], tW * 0.94, Math.abs(axy) / 2 + tR * 0.82, 0, M('mid'), { g: G.body });
    });
    add(zOf(sh3) - (front ? 0.01 : 0), () => {
      const S = Pt(sh3[0] + 0.15, 0, sh3[2]);
      ell(B, S[0], S[1] + (fb ? 0 : tR * 0.12), fb ? tW * 1.0 : tR * 1.08, fb ? tR * 0.95 : tR * (1.14 + breath * 0.1), 0, M('chest'), { g: G.body });
    });
  }

  // ---------- huvud ----------
  const hc3 = [P.head[0], 0, P.head[1] - (back && !P.sleep ? R.hRy * 0.45 : 0)];
  const HC = Pt(...hc3);
  // hals (sidovy och bakifrån)
  const neck3 = [(sh3[0] + hc3[0]) / 2 + tR * 0.1, 0, (sh3[2] + hc3[2]) / 2 + (P.sleep ? 0 : tR * 0.1)];
  const NK = Pt(...neck3);
  if (!P.sleep && (side || back)) {
    add(side ? -0.05 : zOf(neck3), () => {
      const dx = HC[0] - S2[0], dy = HC[1] - S2[1];
      ell(B, NK[0], NK[1], Math.max(tR * 0.75, Math.hypot(dx, dy) * 0.45), tR * (cat ? 0.68 : 0.72), side ? Math.atan2(dy, dx) : Math.PI / 2, M('neck'), { g: G.body });
    });
  }
  add(side ? -0.2 : zOf(hc3) - (back ? 0 : 0.5), () => drawHead(B, R, P, view, HC, coat));

  // ---------- ben ----------
  P.legs.forEach((lg) => {
    const base = lg.front ? sh3 : hip3;
    const v = lg.v;
    const far = side && v > 0;
    const shade = far ? 1 : 0;
    const z = pr(base[0], v, 0)[2] + (side ? 0 : 1.2) + (lg.front ? 0 : 0.01);
    const legMat = (part, t0 = 0) => (i, j, t) => coat(t > 0.85 ? 'paw' : part, { t: t0 + t * (1 - t0) }, i, j);
    const W = R.legW, r = W / 2;
    if (lg.kind === 'fold') {
      if (!side) return;
      add(z - 0.3, () => { const T = Pt(hip3[0] + tR * 0.5, v * 1.1, tR * 0.62); ell(B, T[0], T[1], tR * 0.95, tR * 0.62, 0, M('thigh'), { g: G.thigh, far: shade }); });
      return;
    }
    if (lg.kind === 'tuck') {
      // framben framåt på golvet (ligger/lekbugning)
      add(z, () => {
        const top = Pt(sh3[0] + 0.3, v, Math.max(0.6, sh3[2] - tR * 0.6));
        const reach = lg.stretch ? legH * 0.9 + 1.2 : tR * 0.9 + 0.8;
        const paw = Pt(sh3[0] + reach, v, 0.45, false);
        thick(B, [top, paw], r, legMat('leg'), { g: G.leg, far: shade, leg: true });
        ell(B, paw[0] + (side ? 0.3 : 0), paw[1], side ? 1.0 : 0.8, 0.6, 0, (i, j) => coat('paw', { t: 1 }, i, j), { g: G.paw, far: shade });
      });
      return;
    }
    if (lg.kind === 'up') {
      // framtass i luften (tigga / slå)
      add(z - (side ? 0 : 1.5), () => {
        const top = Pt(sh3[0] + 0.2, v, sh3[2] - tR * 0.2);
        const lift = lg.alt ? 0.8 : 0;
        const elbow = Pt(sh3[0] + tR * 0.6 + (lg.swipe ? 0.8 : 0), v, sh3[2] - tR * 0.45 + lift);
        const paw = Pt(sh3[0] + tR * 0.9 + (lg.swipe ? 1.4 : 0.2), v, sh3[2] - tR * 0.2 + lift + (lg.swipe ? 1.2 : 0));
        thick(B, [top, elbow, paw], r, legMat('leg'), { g: G.leg, far: shade, leg: true });
        ell(B, paw[0], paw[1], 0.75, 0.65, 0, (i, j) => coat('paw', { t: 1 }, i, j), { g: G.paw, far: shade });
      });
      return;
    }
    if (lg.front) {
      add(z, () => {
        const top = Pt(sh3[0] + 0.15, v, sh3[2] - tR * 0.35);
        const paw = Pt(lg.paw[0], v, lg.paw[1], false);
        const mid = [(top[0] + paw[0]) / 2 + (side ? 0.15 : 0), (top[1] + paw[1]) / 2];
        thick(B, [top, mid, [paw[0], paw[1] - 0.5]], r, legMat('leg'), { g: G.leg, far: shade, leg: true });
        pawAt(B, paw, W, side, far, coat, lg.paw[1] > 0.3);
      });
      return;
    }
    // bakben
    if (lg.kind === 'sit' || lg.kind === 'squat') {
      add(z, () => {
        const T3 = [hip3[0] + tR * (lg.kind === 'sit' ? 0.3 : 0.1), v * 1.02, hip3[2] - tR * 0.1];
        const T = Pt(...T3);
        const paw = Pt(lg.paw[0], v, 0, false);
        const hock = Pt(hip3[0] - tR * 0.25, v, Math.min(hip3[2] * 0.5, legH * 0.35), false);
        if (side) thick(B, [hock, [paw[0] - 0.5, paw[1] - 0.5]], r, legMat('leg', 0.5), { g: G.leg, far: shade, leg: true });
        else thick(B, [[T[0], T[1] + tR * 0.3], [paw[0], paw[1] - 0.5]], r, legMat('leg', 0.3), { g: G.leg, far: 0, leg: true });
        pawAt(B, paw, W, side, far, coat, false, lg.kind === 'sit' ? 1.3 : 1);
        if (side) ell(B, T[0], T[1], tR * (lg.kind === 'sit' ? 1.0 : 0.85), tR * (lg.kind === 'sit' ? 0.9 : 0.95), 0, M('thigh'), { g: G.thigh, far: shade });
        else ell(B, T[0], T[1], tR * 0.6, tR * 0.85, 0, M('thigh'), { g: G.thigh });
      });
      return;
    }
    if (lg.kind === 'lift') {
      add(z, () => {
        const T = Pt(hip3[0] + 0.1, v * 1.1, hip3[2] - tR * 0.25);
        const knee = Pt(hip3[0] - tR * 0.1, v * 2.2, legH * 0.85 + 0.6);
        const paw = Pt(hip3[0] - tR * 0.7, v * 2.6, legH * 0.9 + 0.9);
        thick(B, [T, knee, paw], r, legMat('leg'), { g: G.leg, far: shade, leg: true });
        ell(B, T[0], T[1], tR * 0.7, tR * 0.85, 0, M('thigh'), { g: G.thigh, far: shade });
      });
      return;
    }
    add(z, () => {
      const T = Pt(hip3[0] + 0.15, v * 1.02, hip3[2] - tR * 0.28);
      const paw = Pt(lg.paw[0], v, lg.paw[1], false);
      const hockW = Math.max(lg.paw[1] + legH * 0.36, legH * 0.36);
      const hock = Pt(lg.paw[0] - (cat ? 0.55 : 0.45) - (side ? 0.1 : 0), v, hockW, false);
      hock[1] -= Math.min(L, 1);
      const knee = Pt(hip3[0] + 0.2, v, hip3[2] - tR * 0.75);
      if (side) thick(B, [knee, hock, [paw[0], paw[1] - 0.5]], r, legMat('leg', 0.3), { g: G.leg, far: shade, leg: true });
      else thick(B, [[T[0], T[1]], [paw[0], paw[1] - 0.5]], r, legMat('leg', 0.3), { g: G.leg, far: 0, leg: true });
      pawAt(B, paw, W, side, far, coat, lg.paw[1] > 0.3);
      if (side) ell(B, T[0], T[1] + 0.2, tR * 0.72, tR * 0.92, 0, M('thigh'), { g: G.thigh, far: shade });
      else ell(B, T[0], T[1], tR * 0.55, tR * 0.8, 0, M('thigh'), { g: G.thigh });
    });
  });

  // ---------- svans ----------
  const tp = tailPts(R, P, hip3);
  if (front && !P.tail.lie) {
    // framifrån syns svansen bara när den viftar ut åt sidan bakom kroppen
    const b = tp.base, bias = (P.tail.wag || 0) >= 0 ? 1 : -1;
    tp.pts = tp.pts.map((p, k) => { const t = k / (tp.pts.length - 1); return [b[0] + (p[0] - b[0]) * 0.8, p[1] + bias * t * R.tailL * 0.35 - (P.tail.wag || 0) * t * R.tailL * 0.3, b[2] + (p[2] - b[2]) * 0.55]; });
  }
  const TP = tp.pts.map((p) => Pt(...p));
  const tailZ = side ? (P.tail.lie ? -0.02 : (R.tail === 'curl' ? -0.01 : 0.6)) : zOf(tp.pts[Math.min(2, tp.pts.length - 1)]) + (front ? 0.5 : -0.5);
  add(tailZ, () => drawTail(B, R, P, view, TP, coat));

  parts.sort((a, b) => b.z - a.z);
  for (const p of parts) p.fn();
  return { neck: side ? Pt(sh3[0] + tR * 0.5, 0, sh3[2] + tR * 0.55) : front ? [HC[0], HC[1] + R.hRy * 0.8] : Pt(neck3[0], 0, neck3[2]) };
}

function pawAt(B, P2, W, side, far, coat, lifted, len = 1) {
  const x = Math.floor(P2[0] - W / 2 + 0.5 + (side ? 0 : 0)), y = Math.floor(P2[1] - 0.5 + 0.5);
  const c = coat('paw', { t: 1 }, x, y);
  const R = rampOf(c);
  const col = far ? R[2] : R[1];
  const w = side ? W + (lifted ? 0 : Math.round(len)) : W;
  for (let q = 0; q < w; q++) put(B, x + q, y, q === 0 && !far ? R[1] : col, G.paw);
  if (!far && side && !lifted) put(B, x + w - 1, y, R[far ? 2 : 1], G.paw);
}

// svansen som en kedja punkter från roten (modellkoordinater)
function tailPts(R, P, hip) {
  const { tR } = R, T = P.tail || {};
  const n = 7, Lt = R.tailL;
  const base = [hip[0] - tR * 0.85, 0, hip[2] + tR * 0.35];
  const pts = [];
  const wag = T.wag || 0; // −1…1 sidledes
  if (T.lie) {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const a = (T.wrap ? 160 : 55) * D2R * t;
      const r = Lt * (T.wrap ? 0.55 : 0.8);
      pts.push([base[0] - Math.sin(a) * r * 0.9 * (T.wrap ? 1 : 1.2) + (T.wrap ? t * t * tR * 0.9 : 0), -(1 - Math.cos(a)) * r * 0.9 - wag * t * 1.2, Math.max(0.45, base[2] * (1 - t * 2.4))]);
    }
    return { pts, base };
  }
  const kind = R.tail;
  if (kind === 'curl') {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), a = (210 * t) * D2R;
      const r = Lt * 0.33;
      pts.push([base[0] + 0.3 - Math.sin(a) * r, wag * t * 0.8 + t * 0.4, base[2] + (1 - Math.cos(a)) * r * 0.95]);
    }
    return { pts, base };
  }
  if (kind === 'bob') { pts.push(base, [base[0] - 0.9, wag * 0.5, base[2] + 0.7]); return { pts, base }; }
  const upA = (T.up ?? 30) * D2R;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let a = upA;
    if (kind === 'brush' || kind === 'plume') a = upA * 0.45 - 40 * D2R * t + (T.up > 45 ? 40 * D2R * t : 0);
    if (kind === 'otter') a = upA * 0.6 - 18 * D2R * t;
    if (kind === 'cat' || kind === 'bushy') a = upA + (T.quiver ? 0 : 38 * D2R * t * t);
    if (kind === 'whip' || kind === 'pom') a = upA + 20 * D2R * t;
    const r = Lt * t;
    const bk = Math.cos(a) * r, rise = Math.sin(a) * r;
    pts.push([base[0] - bk, -wag * r * 0.75, base[2] + rise]);
  }
  if (T.quiver) { const l = pts[n - 1]; pts[n - 1] = [l[0] - 0.7, l[1], l[2] - 0.2]; }
  return { pts, base };
}

function drawTail(B, R, P, view, TP, coat) {
  const kind = R.tail;
  const g = view === 'back' ? G.tailNear : G.tail;
  const sc = [0.7, 0.86, 1][R.age] * Math.sqrt(R.S || 1);
  const mat = (i, j, t) => coat('tail', { t }, i, j);
  const ink = view === 'back' ? true : false;
  if (kind === 'bob') { ell(B, TP[1][0], TP[1][1], 0.9 * sc + 0.3, 0.8 * sc + 0.3, 0, (i, j) => coat('tail', { t: 0.5 }, i, j), { g, ink }); return; }
  const prof = {
    plume: (t) => (1.15 - t * 0.35) * sc, brush: (t) => (1.1 - t * 0.2) * sc, bushy: (t) => (1.05 + t * 0.1) * sc,
    curl: (t) => (1.0 - t * 0.2) * sc, otter: (t) => (1.05 - t * 0.6) * sc,
    cat: (t) => (R.age === 0 ? 0.5 : 0.95 - t * 0.35), whip: (t) => (R.S >= 0.85 && R.age > 0 ? 0.95 - t * 0.45 : 0.5), pom: () => 0.5,
  }[kind] || (() => 0.6);
  thick(B, TP, prof, mat, { g, ink });
  if (kind === 'pom') { const e = TP[TP.length - 1]; ell(B, e[0], e[1], 1.3, 1.2, 0, (i, j) => coat('tail', { t: 1 }, i, j), { g, ink: true }); }
}

// ---------- huvudet (alla vyer) ----------
function drawHead(B, R, P, view, HC, coat) {
  const cat = R.sp === 'katt', dog = R.sp === 'hund', rab = R.sp === 'kanin';
  const side = view === 'side', front = view === 'front', back = view === 'back';
  let [cx, cy] = HC;
  const rx = side ? R.hRx : R.hW, ry = R.hRy;
  const C = R.C;
  const fur = C.c;
  const iris = C.eye ?? (cat ? 0x9ab040 : rab ? 0x3a2418 : null);
  const hq = (part) => (i, j, lu, lv) => coat(part, { lu, lv }, i, j);
  const pitch = (P.hp || 0) * D2R;
  const eatDown = P.eat && !side;

  // --- öron bakom huvudet ---
  const E = R.earL * (P.ears === 'back' ? 0.75 : 1);
  if (!rab) {
    if (side) earSide(B, R, P, cx, cy, rx, ry, E, coat, true);
    else if (front && (R.ears === 'cat' || R.ears === 'up' || R.ears === 'bat')) earsUpFB(B, R, P, cx, cy, rx, ry, E, coat, true);
  } else {
    rabbitEars(B, R, P, view, cx, cy, rx, ry, coat, true);
  }

  // --- skalle ---
  ell(B, cx, cy, rx, ry, 0, hq('head'), { g: G.head, ink: front ? 'down' : false });
  if (cat && !side && R.age > 0) ell(B, cx, cy + ry * 0.32, rx * 1.1, ry * 0.62, 0, hq('head'), { g: G.head, clip: (i, j) => j + 0.5 > cy });
  if (cat && R.fluff >= 2 && !back) ell(B, cx - (side ? rx * 0.35 : 0), cy + ry * 0.62, side ? rx * 0.75 : rx * 0.95, ry * 0.5, 0, hq('ruff'), { g: G.head });
  if (rab && R.fluff >= 2) {
    // lejonhuvudets man
    const mane = hq('mane');
    if (side) ell(B, cx - rx * 0.35, cy + 0.1, rx * 0.95, ry * 1.12, 0, mane, { g: G.mane, clip: (i) => i + 0.5 < cx + rx * 0.1 });
    else ell(B, cx, cy + 0.3, rx * 1.3, ry * 1.18, 0, mane, { g: G.mane, clip: (i, j, lu, lv) => back || lv < -0.25 || Math.abs(lu) > 0.66 });
  }

  // --- nos / ansikte ---
  if (side) {
    const sx = Math.cos(pitch), sy = -Math.sin(pitch);
    if (dog) {
      const sl = R.snL, len = sl * 0.5 + 0.9;
      const ox = rx * 0.62 + sl * 0.45, oy = ry * 0.42;
      const scx = cx + ox * sx - oy * sy * 0.6, scy = cy + oy + ox * sy * 0.9;
      ell(B, scx, scy, len, R.snH * 0.5 + 0.25, -pitch * 0.9, (i, j, lu, lv) => coat('snout', { lu, lv, sv: lv }, i, j), { g: G.snout, ink: 'down' });
      const tipX = Math.floor(scx + len * sx * 0.95 - 0.5), tipY = Math.floor(scy - R.snH * 0.25 + len * sy * 0.8);
      const noseC = C.nose ?? 0x1e181c;
      put(B, tipX, tipY, noseC, G.face);
      if (R.snH > 1.2) { put(B, tipX - 1, tipY, mix(noseC, 0x6a6070, 0.35), G.face); }
      // mun
      const mx = Math.floor(scx - len * 0.2), my = Math.floor(scy + R.snH * 0.5 - 0.2);
      if (P.mouth === 'tongue') { put(B, mx + 1, my, 0x3a1a22, G.face); put(B, mx + 1, my + 1, 0xe86a7c, G.face); if (R.S >= 0.85 && R.age > 0) put(B, mx + 1, my + 2, 0xd05a6c, G.face); }
      else if (!P.eat) put(B, mx, my, mix(rampOf(coat('snout', { lu: 0, lv: 1 }, mx, my))[3], 0x201018, 0.4), G.face);
    } else {
      const scx = cx + rx * 0.72 * sx, scy = cy + ry * 0.36 - rx * 0.7 * sy * -1 * 0;
      ell(B, scx + (rab ? 0.1 : 0), scy + (P.eat ? 0.4 : 0), R.snL + 0.75, R.snH * 0.55 + 0.2, 0, hq('snout'), { g: G.snout });
      const nx = Math.floor(cx + rx + R.snL * 0.6 - 0.3), ny = Math.floor(scy - 0.6);
      put(B, nx, ny, C.nose ?? (lum(fur) < 0.3 ? 0x40303a : 0xe07a8c), G.face);
      if (rab && P.nose) put(B, nx, ny - 1, 0xe07a8c, G.face);
      if (P.mouth === 'meow') { put(B, nx - 1, ny + 2, 0x3a1a22, G.face); put(B, nx - 1, ny + 1, 0x5a2a32, G.face); }
    }
    // öga
    const ex = Math.floor(cx + rx * (dog ? 0.3 : 0.36) - (R.eyeBig ? 0.5 : 0)), ey = Math.floor(cy - ry * (dog ? 0.28 : 0.22) - (R.eyeBig ? 0.5 : 0) + (P.eat ? 0.5 : 0));
    eyeAt(B, ex, ey, R, P.eyes === 'big' ? 'open' : P.eyes, cat || rab || C.eye != null ? iris : null, fur, false);
    if (P.blush) put(B, ex, ey + 2 + (R.eyeBig ? 1 : 0), mix(rampOf(fur)[1], 0xf06080, 0.5), G.face);
    if (cat && R.age > 0 && !P.eat) { const wy = Math.floor(cy + ry * 0.3); put(B, Math.floor(cx + rx + 0.4), wy + 1, 0xe8e4dc, G.face); }
    // öra framför
    if (!rab) earSide(B, R, P, cx, cy, rx, ry, E, coat, false);
  } else if (front) {
    const c = Math.floor(cx); // mittkolumnen
    if (eatDown) {
      // tittar ner i skålen: ser pannan, nosen skymd
      const ey = Math.floor(cy + ry * 0.2);
      const k = Math.max(1, Math.round(rx * 0.45));
      eyeAt(B, c - k - (R.eyeBig ? 1 : 0), ey, R, 'closed', iris, fur, false);
      eyeAt(B, c + k, ey, R, 'closed', iris, fur, true);
      if (dog) ell(B, cx, cy + ry * 0.85, R.snH * 0.9 + 0.3, R.snH * 0.5, 0, hq('snout'), { g: G.snout, ink: 'down' });
    } else {
      // nosparti
      const tilt = P.tilt ? 1 : 0;
      if (dog) {
        const sw = Math.max(1.3, R.hW * 0.52 + (R.B.snout === 'flat' ? 0.4 : 0)), shh = R.snH * 0.55 + 0.25;
        const scy = cy + ry * 0.5 + (R.B.snout === 'long' ? 0.35 : 0);
        ell(B, cx, scy, sw, shh, 0, (i, j, lu, lv) => coat('snout', { lu, lv, sv: lv }, i, j), { g: G.snout });
        // nos
        const ny = Math.floor(scy - shh * 0.45);
        const noseC = C.nose ?? 0x1e181c;
        const big = R.hW >= 2.6;
        put(B, c, ny, noseC, G.face);
        if (big) { put(B, c - 1, ny, noseC, G.face); put(B, c + 1, ny, noseC, G.face); put(B, c, ny, mix(noseC, 0x9a90a8, 0.45), G.face); }
        // mun / tunga
        const my = ny + (big ? 2 : 1);
        if (P.mouth === 'tongue') { put(B, c, my - 1, 0x3a1a22, G.face); put(B, c, my, 0xe86a7c, G.face); if (big) put(B, c, my + 1, 0xd05a6c, G.face); }
        else if (big) { const mc = mix(rampOf(coat('snout', { lu: 0, lv: 0.8, sv: 0.8 }, c, my))[2], 0x201018, 0.3); put(B, c, my - 1, mc, G.face); }
      } else {
        const sw = rab ? 1.25 : Math.max(1.1, rx * 0.46), shh = rab ? 0.9 : 0.85;
        const scy = cy + ry * (rab ? 0.45 : 0.5);
        ell(B, cx, scy, sw, shh, 0, hq('snout'), { g: G.snout });
        const ny = Math.floor(scy - shh * 0.5);
        const noseC = C.nose ?? (lum(fur) < 0.3 ? 0x40303a : 0xe07a8c);
        put(B, c, ny, noseC, G.face);
        if (rab && P.nose) put(B, c, ny + 1, 0xd06a7c, G.face);
        if (P.mouth === 'meow') { put(B, c, ny + 1, 0x3a1a22, G.face); put(B, c, ny + 2, 0xe86a7c, G.face); }
        // morrhår (vuxna katter)
        if (cat && R.age > 0) { const wy = ny + 1; put(B, c - Math.ceil(rx) - 1, wy, 0xe8e4dc, G.face); put(B, c + Math.ceil(rx) + 1, wy, 0xe8e4dc, G.face); }
      }
      // ögon
      const big = R.eyeBig || P.eyes === 'big';
      const k = Math.max(1, Math.round(rx * (big ? 0.42 : 0.5)));
      const ey = Math.floor(cy - ry * (dog ? 0.25 : 0.18) - (big ? 0.5 : 0)) + (P.look === 2 ? 1 : 0);
      const lookX = P.look === 1 ? -1 : P.look === 3 ? 1 : 0;
      const st = P.eyes === 'big' ? 'open' : P.eyes;
      const ir = cat || rab || C.eye != null ? iris : null;
      if (big) { eyeAt(B, c - k - 1 + lookX * 0, ey, R, st, ir, fur, false); eyeAt(B, c + k, ey, R, st, ir, fur, true); }
      else { eyeAt(B, c - k, ey + tilt * 0, R, st, ir, fur, false); eyeAt(B, c + k, ey, R, st, ir, fur, true); }
      if (P.blush) { const bc = mix(rampOf(fur)[1], 0xf06080, 0.5); put(B, c - k - 1, ey + 2 + (big ? 1 : 0), bc, G.face); put(B, c + k + 1, ey + 2 + (big ? 1 : 0), bc, G.face); }
    }
    if (!rab) earsFB(B, R, P, cx, cy, rx, ry, E, coat, 'front');
  } else {
    // bakifrån: bara nacke och öron
    if (!rab) { earsFB(B, R, P, cx, cy, rx, ry, E, coat, 'back'); if (R.ears === 'cat' || R.ears === 'up' || R.ears === 'bat') earsUpFB(B, R, P, cx, cy, rx, ry, E, coat, false); }
  }
  if (rab) rabbitEars(B, R, P, view, cx, cy, rx, ry, coat, false);
}

// spetsiga öron fram/bak (katt, schäfer, husky, corgi, chihuahua)
function earsUpFB(B, R, P, cx, cy, rx, ry, E, coat, frontView) {
  const bat = R.ears === 'bat', dog = R.sp === 'hund';
  const backA = P.ears === 'back' ? 1 : P.ears === 'rest' ? 0.5 : 0;
  for (const s of [-1, 1]) {
    const x0 = cx + s * rx * (bat ? 0.98 : 0.95), y0 = cy - ry * (bat ? 0.1 : 0.28);
    const x1 = cx + s * rx * (bat ? 0.15 : 0.12), y1 = cy - ry * 0.92;
    const tx = cx + s * (rx * (bat ? 1.25 : dog ? 0.78 : 0.7) + backA * 1.2 + (bat ? E * 0.45 : 0)), ty = cy - ry - E * (1 - backA * 0.45) + (bat ? E * 0.25 : 0);
    const tri = [[x0, y0], [x1, y1], [tx, ty]];
    poly(B, tri, (i, j) => coat('ear', { lu: s }, i, j), { g: G.ear, tone: frontView ? 1 : 2, ink: !frontView });
    if (frontView) {
      // insidan: mindre triangel närmare mitten, rosa
      const k = bat ? 0.5 : 0.52;
      const m = [(x0 + x1 + tx) / 3, (y0 + y1 + ty) / 3];
      const inner = tri.map(([x, y]) => [m[0] + (x - m[0]) * k, m[1] + (y - m[1]) * k + 0.35]);
      poly(B, inner, (i, j) => coat('earIn', {}, i, j), { g: G.ear, tone: 1, eps: 0.2 });
      if (R.fluff >= 2 && R.sp === 'katt') { put(B, Math.floor(tx), Math.floor(ty) - 1, rampOf(coat('tuft', {}, 0, 0))[1], G.ear); }
    }
  }
}
// hängande/vikta öron fram/bak
function earsFB(B, R, P, cx, cy, rx, ry, E, coat, view) {
  const back = P.ears === 'back' ? 1 : 0, perk = P.ears === 'perk' ? 1 : 0;
  for (const s of [-1, 1]) {
    const mat = (i, j) => coat('ear', { lu: s }, i, j);
    switch (R.ears) {
      case 'flop': {
        const ex = cx + s * (rx * 0.9 + 0.1), ey = cy + ry * 0.12 - perk * 0.6 - back * 0.3;
        ell(B, ex, ey, Math.max(0.95, E * 0.42), E * 0.95, s * 0.18, mat, { g: G.ear });
        break;
      }
      case 'pom': {
        const ex = cx + s * (rx * 0.95 + 0.3), ey = cy + ry * 0.35;
        ell(B, ex, ey, E * 0.6, E * 0.85, 0, mat, { g: G.ear });
        break;
      }
      case 'fold': {
        const x0 = cx + s * rx * 0.25, y0 = cy - ry * 0.98;
        const x1 = cx + s * rx * 0.95, y1 = cy - ry * 0.5 - perk * 0.4;
        const tx = cx + s * (rx * 1.05 + 0.3 - back * 0.2), ty = cy - ry * 0.05 + (view === 'back' ? -0.6 : 0) - perk * 0.8;
        poly(B, [[x0, y0], [x1 + s * 0.4, y1 - 0.6], [tx, ty], [x0 + s * 0.8, y0 + 1.2]], mat, { g: G.ear, tone: view === 'back' ? 2 : 1, ink: true });
        break;
      }
      default: break;
    }
  }
}
// öron i sidovy. behind = det bortre örat (ritas före skallen)
function earSide(B, R, P, cx, cy, rx, ry, E, coat, behind) {
  const back = P.ears === 'back' ? 1 : P.ears === 'rest' ? 0.55 : 0, perk = P.ears === 'perk' ? 1 : 0;
  const mat = (i, j) => coat('ear', { lu: 0 }, i, j);
  const far = behind ? 1 : 0;
  const dx = behind ? 0.9 : 0, dy = behind ? -0.5 : 0;
  switch (R.ears) {
    case 'cat': case 'up': case 'bat': {
      const bat = R.ears === 'bat', dog = R.sp === 'hund';
      const x0 = cx - rx * (bat ? 0.55 : 0.6) + dx, y0 = cy - ry * (bat ? 0.45 : 0.62) + dy;
      const x1 = cx + rx * (dog ? 0.22 : 0.28) + dx, y1 = cy - ry * 0.95 + dy;
      const tx = cx - rx * (bat ? 0.35 : 0.22) - back * E * 0.7 + dx, ty = cy - ry - E * (1 - back * 0.5) + perk * -0.3 + dy;
      poly(B, [[x0, y0], [x1, y1], [tx, ty]], mat, { g: behind ? G.earFar : G.ear, tone: 1, far, ink: !behind });
      if (!behind && !back) {
        const m = [(x0 + x1 + tx) / 3, (y0 + y1 + ty) / 3];
        poly(B, [[x1, y1], [tx, ty], m].map(([x, y]) => [m[0] + (x - m[0]) * 0.75 + 0.4, m[1] + (y - m[1]) * 0.75 + 0.4]), (i, j) => coat('earIn', {}, i, j), { g: G.ear, tone: 1, eps: 0.25 });
      }
      break;
    }
    case 'fold': {
      if (behind) return;
      const x0 = cx - rx * 0.55, y0 = cy - ry * 0.75, x1 = cx + rx * 0.2, y1 = cy - ry * 1.02;
      const tx = cx + rx * 0.35 - back * 1.3, ty = cy - ry * 0.35 - perk * 0.7;
      poly(B, [[x0, y0], [x1, y1 - 0.5 - perk * 0.5], [tx + 0.6, ty], [x0 + 0.8, y0 + 1.4]], mat, { g: G.ear, tone: 1, ink: true });
      break;
    }
    case 'flop': {
      if (behind) return;
      ell(B, cx - rx * 0.42 - back * 0.4, cy + ry * 0.12 - perk * 0.6, Math.max(1.0, E * 0.45), E * 0.9, 0.25 + back * 0.4, mat, { g: G.ear });
      break;
    }
    case 'pom': {
      if (behind) return;
      ell(B, cx - rx * 0.25, cy + ry * 0.35, E * 0.62, E * 0.9, 0.1, mat, { g: G.ear });
      break;
    }
    default: break;
  }
}

// ======================================================================
//  Kanin
// ======================================================================
function drawRabbit(B, R, P, view, coat) {
  const side = view === 'side', front = view === 'front', back = view === 'back';
  const pr = projector(view);
  const L = P.lift || 0;
  const Pt = (u, v, w, lifted = true) => { const p = pr(u, v, w); if (lifted) p[1] -= L; return p; };
  const { tR, tW, hRx, hRy, bodyL } = R;
  const parts = [];
  const add = (z, fn) => parts.push({ z, fn });
  const breath = P.breath ? 0.3 : 0;
  const st = P.stretch || 0;
  const zOf = (p3) => pr(...p3)[2];
  const bodyQ = (part) => (i, j, lu, lv) => coat(part, { lu, lv, bw: -lv, bu: part === 'chest' ? 1 : lu * 0.5 + 0.5, lat: front || back ? lu : 0 }, i, j);

  let hc3, neck;
  if (P.stand) {
    const hip3 = [-0.3, 0, tR * 0.95], sh3 = [0.2, 0, tR * 0.95 + bodyL * 1.1 + 0.6];
    const H2 = Pt(...hip3), S2 = Pt(...sh3);
    add(zOf(hip3), () => ell(B, H2[0], H2[1], side ? tR * 0.95 : tW * 0.98, tR * 1.02, 0, bodyQ('rump'), { g: G.body }));
    add(zOf(sh3) - 0.1, () => ell(B, S2[0], S2[1], side ? tR * 0.72 : tW * 0.78, tR * 0.9, 0, bodyQ('chest'), { g: G.body }));
    hc3 = [sh3[0] + 0.4, 0, sh3[2] + tR * 0.55 + hRy * 0.72];
    for (const s of [1, -1]) {
      const F = Pt(hip3[0] + 1.0, s * tW * 0.6, 0.3, false);
      add(zOf([hip3[0] + 1, s * tW * 0.6, 0]) + (side ? 0 : 1), () => ell(B, F[0], F[1], side ? 1.5 : 0.8, 0.6, 0, (i, j, lu) => coat('foot', { t: lu * 0.5 + 0.5 }, i, j), { g: G.leg, far: side && s > 0 ? 1 : 0 }));
      const Pw = Pt(sh3[0] + 0.8, s * tW * 0.35, sh3[2] - tR * 0.5 + (P.nose ? 0.4 : 0));
      add(zOf([sh3[0] + 0.8, s * tW * 0.35, 0]) - 0.6, () => ell(B, Pw[0], Pw[1], 0.65, 0.6, 0, (i, j) => coat('paw', { t: 1 }, i, j), { g: G.paw, far: side && s > 0 ? 1 : 0, ink: true }));
    }
    const T = Pt(hip3[0] - tR * 0.85, 0, 0.9);
    add(side ? 0.5 : zOf([hip3[0] - tR, 0, 0]), () => ell(B, T[0], T[1], 0.95, 0.9, 0, (i, j, lu, lv) => coat('puff', { lu, lv }, i, j), { g: back ? G.tailNear : G.tail, bright: 0.2, ink: back }));
    neck = Pt(sh3[0] + 0.3, 0, sh3[2] + tR * 0.4);
  } else {
    const loaf = P.sleep ? 1 : 0;
    const hip3 = [P.hip[0] - st * 0.35, 0, P.hip[1] + breath * 0.5], sh3 = [P.sh[0] + st * 0.45, 0, P.sh[1] + breath * 0.3];
    const H2 = Pt(...hip3), S2 = Pt(...sh3);
    // bakfötter (långa, platta) och lår
    for (const s of [1, -1]) {
      const far = side && s > 0 ? 1 : 0;
      const fz = L > 0 ? L * 0.5 : 0;
      const F3 = [hip3[0] + 0.7 - st * 0.8, s * tW * 0.62, 0.35];
      const F = Pt(F3[0], F3[1], F3[2], false); F[1] -= fz;
      add(zOf(F3) + (side ? 0 : 1.2), () => ell(B, F[0], F[1], side ? 1.55 + st * 0.25 : 0.85, side ? 0.62 : 0.8, 0, (i, j, lu) => coat('foot', { t: lu * 0.5 + 0.5 }, i, j), { g: G.leg, far }));
      if (side && !loaf) {
        const T3 = [hip3[0] + 0.3 - st * 0.3, s * tW * 0.7, hip3[2] - tR * 0.3];
        const T = Pt(...T3);
        add(zOf(T3) - 0.1, () => ell(B, T[0], T[1], tR * 0.68, tR * 0.62, 0, bodyQ('thigh'), { g: G.thigh, far, ink: !far }));
      }
      // framtassar
      const fr = P.front || 0;
      const top3 = [sh3[0] + 0.2, s * tW * 0.38, sh3[2] - tR * 0.4];
      const paw3 = [sh3[0] + 0.5 + fr * 0.6 + (P.eat ? 0.3 : 0), s * tW * 0.38, L > 0 ? Math.max(0.3, 0.6) : 0.2];
      if (!loaf) add(zOf(paw3) + (side ? -0.01 : 1.1), () => {
        const a = Pt(...top3), b = Pt(paw3[0], paw3[1], paw3[2], L === 0);
        thick(B, [a, b], 0.5, (i, j, t) => coat(t > 0.7 ? 'paw' : 'leg', { t }, i, j), { g: G.leg, far, leg: true });
        ell(B, b[0] + (side ? 0.3 : 0), b[1], side ? 0.85 : 0.6, 0.5, 0, (i, j) => coat('paw', { t: 1 }, i, j), { g: G.paw, far });
      });
    }
    // kroppen: stor rund rumpa + bröst
    const tw = P.twist || 0;
    add(zOf(hip3), () => ell(B, H2[0] + (side ? 0 : tw * 0.5), H2[1], side ? tR * (1.05 - st * 0.08) + loaf * 0.4 : tW * 1.0 + loaf * 0.3, tR * (1.0 + breath * 0.12) - st * 0.12 - loaf * 0.1, side ? 0 : tw * 0.12, bodyQ('rump'), { g: G.body }));
    add(zOf(sh3) - 0.01, () => ell(B, S2[0], S2[1], side ? tR * 0.85 : tW * 0.84, tR * 0.84, 0, bodyQ('chest'), { g: G.body }));
    // bomullssvans
    const T3 = [hip3[0] - tR * 0.95, 0, hip3[2] + tR * (P.tailUp ? 0.6 : 0.2)];
    const T = Pt(...T3);
    add(side ? 0.5 : zOf(T3), () => ell(B, T[0] + (side ? -0.1 : 0), T[1], 0.95 + (R.age ? 0.1 : 0), 0.9, 0, (i, j, lu, lv) => coat('puff', { lu, lv }, i, j), { g: back ? G.tailNear : G.tail, bright: 0.2, ink: back }));
    hc3 = P.eat ? [sh3[0] + tR * 0.7 + hRx * 0.45, 0, hRy * 0.85 + (P.chew ? 0.3 : 0)]
      : P.sleep ? [sh3[0] + tR * 0.6 + hRx * 0.3, 0, hRy * 0.95]
        : [sh3[0] + tR * 0.5 + hRx * 0.25 + st * 0.3, 0, sh3[2] + tR * 0.45 + hRy * 0.58];
    neck = Pt(sh3[0] + tR * 0.5, 0, sh3[2] + tR * 0.4);
  }
  const HC = Pt(...hc3);
  add(side ? -0.3 : zOf(hc3) - (back ? 0 : 0.5), () => drawHead(B, R, P, view, HC, coat));
  parts.sort((a, b) => b.z - a.z);
  for (const p of parts) p.fn();
  return { neck: front ? [HC[0], HC[1] + hRy * 0.8] : neck };
}

function rabbitEars(B, R, P, view, cx, cy, rx, ry, coat, behind) {
  const side = view === 'side', front = view === 'front';
  const E = R.earL;
  const flat = P.ears === 'flat' ? 1 : P.ears === 'back' ? 0.5 : 0;
  const mat = (i, j) => coat('ear', {}, i, j);
  const inMat = (i, j) => coat('earIn', {}, i, j);
  const w = R.age === 0 ? 0.8 : 0.95;
  if (R.ears === 'lop') {
    if (side) {
      if (behind) return;
      ell(B, cx - rx * 0.15, cy + ry * 0.35, w + 0.15, E * 0.58, 0.18, mat, { g: G.ear, ink: true });
    } else {
      if (behind) return;
      for (const s of [-1, 1]) ell(B, cx + s * (rx * 0.92 + 0.2), cy + ry * 0.35, w + 0.1, E * 0.56, s * 0.12, mat, { g: G.ear, ink: true });
    }
    return;
  }
  if (side) {
    // bortre örat bakom, närmre framför
    const tilt = (14 + flat * 60) * D2R;
    const ox = behind ? 0.8 : 0, oy = behind ? -0.4 : 0;
    const L2 = E * 0.55;
    const ex = cx - rx * 0.2 - Math.sin(tilt) * L2 + ox, ey = cy - ry * 0.75 - Math.cos(tilt) * L2 + oy;
    const m = ell(B, ex, ey, w, L2 + 0.2, -tilt, mat, { g: behind ? G.earFar : G.ear, far: behind ? 1 : 0, ink: !behind });
    if (!behind && !flat) ell(B, ex + 0.35, ey + 0.3, 0.45, L2 * 0.72, -tilt, inMat, { g: G.ear, clip: (i, j) => m.has(j * BW + i) });
    return;
  }
  if (behind && front) return;
  if (!behind && !front) { /* bakifrån ritas öronen efter huvudet */ }
  if (behind && !front) return;
  for (const s of [-1, 1]) {
    const wig = P.earWiggle && s > 0 ? 1 : 0;
    const spread = (7 + wig * 12 + flat * 55) * D2R * s;
    const L2 = E * 0.55;
    const ex = cx + s * rx * 0.42 + Math.sin(spread) * L2, ey = cy - ry * 0.72 - Math.cos(spread) * L2 * (1 - flat * 0.5) + flat * 1.2;
    const m = ell(B, ex, ey, w, L2 + 0.2, spread, mat, { g: G.ear, ink: true, far: front ? 0 : 0 });
    if (front && !flat) ell(B, ex, ey + 0.4, 0.45, L2 * 0.7, spread, inMat, { g: G.ear, clip: (i, j) => m.has(j * BW + i) });
  }
}
