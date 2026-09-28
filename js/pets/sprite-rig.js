// Djurens dockor: mått per art/ras/ålder, poser per animation och bildruta,
// pälsmönster och ansikten. Motorn (strålföljning, konturer) ligger i sprite-render.js.
import { SPECIES } from './sprite-data.js';
import { makeScene, renderScene, GRP, rampOf, proj, D2R, nrm, add, sub, scl, lerp, cross, dot, lum } from './sprite-render.js';
import { mix, mul, hash } from '../core/floor-pix.js';

const AGE = { unge: 0, ung: 1, vuxen: 2 };
const breedIn = (sp, id) => { const S = SPECIES[sp] || SPECIES.katt; return S.breeds.find((b) => b.id === id) || S.breeds[0]; };
const frac = (x) => x - Math.floor(x);
const strHash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };

// ======================================================================
//  Mått
// ======================================================================
const DOG_SIZE = { xs: 0.6, s: 0.76, m: 0.9, l: 1, xl: 1.1 };
function dogRig(B, a) {
  const S = DOG_SIZE[B.size] ?? 0.9;
  const k = [0.56, 0.8, 1][a], kh = [0.86, 0.94, 1][a], kl = [0.5, 0.78, 1][a];
  const hf = B.head || (B.size === 'xs' ? 1.3 : B.snout === 'flat' ? 1.15 : 1);
  return {
    S, legH: 5.0 * S * kl * (B.legs || 1), bodyL: 7.0 * S * k * (B.len || 1),
    tR: 2.45 * S * k, tW: 2.2 * S * k,
    hR: 2.6 * S * kh * hf, hW: 0.95, headUp: 1,
    snoutL: ({ long: 2.7, mid: 2.1, short: 1.2, flat: 0.5 })[B.snout || 'mid'] * S * [0.5, 0.78, 1][a],
    snoutR: 1.25 * S * kh * (B.snout === 'flat' ? 1.35 : 1), snoutH: 1.1 * S * kh,
    legW: S * [0.78, 0.9, 1][a] >= 0.66 ? 2 : 1,
    ears: a === 0 && (B.ears === 'up') ? 'fold' : B.ears || 'flop',
    earL: 1.9 * S * kh * (B.ears === 'bat' ? 1.5 : 1),
    tail: B.tail || 'whip', tailL: 4.3 * S * [0.55, 0.8, 1][a],
    eyeStyle: a === 0 ? 'L' : a === 1 ? 'M' : S >= 0.85 ? 'M' : 'M',
    fluff: B.fluff || 0,
  };
}
function catRig(B, a) {
  const S = B.big ? 1.12 : B.slim ? 0.97 : 1;
  const k = [0.58, 0.82, 1][a], kh = [0.86, 0.94, 1][a], kl = [0.55, 0.8, 1][a];
  return {
    S, legH: 3.2 * S * kl * (B.slim ? 1.12 : 1), bodyL: 5.4 * S * k * (B.slim ? 1.08 : 1),
    tR: 1.95 * S * k * (B.round ? 1.1 : 1), tW: 1.8 * S * k * (B.round ? 1.15 : 1),
    hR: 2.05 * S * kh, hW: 1.2, headUp: 0.8,
    snoutL: 0.5 * S * kh, snoutR: 1.05 * S * kh, snoutH: 0.8 * S * kh,
    legW: a === 0 ? 1 : 2,
    ears: 'cat', earL: 1.7 * S * kh * (B.slim ? 1.15 : 1),
    tail: B.fluff ? 'bushy' : 'cat', tailL: 5.2 * S * [0.5, 0.8, 1][a],
    eyeStyle: a === 0 ? 'L' : 'C',
    fluff: B.fluff || 0,
  };
}
function rabbitRig(B, a) {
  const S = B.round ? 1.04 : 1;
  const k = [0.58, 0.82, 1][a], kh = [0.84, 0.93, 1][a];
  return {
    S, legH: 0.6 * k, bodyL: 2.6 * S * k,
    tR: 2.2 * S * k, tW: 2.0 * S * k,
    hR: 1.75 * S * kh, hW: 1.0, headUp: 1,
    snoutL: 0.4 * kh, snoutR: 0.95 * kh, snoutH: 0.75 * kh,
    legW: 1,
    ears: B.ears || 'up', earL: (B.ears === 'short' ? 1.7 : B.ears === 'lop' ? 2.4 : 2.9) * kh * [0.8, 0.9, 1][a],
    tail: 'puff', tailL: 1,
    eyeStyle: a === 0 ? 'L' : 'R',
    fluff: B.fluff || 0,
  };
}

export const STYLE = {
  lat: { hund: 1.45, katt: 1.4, kanin: 1.25 },
  hlat: { hund: 1.18, katt: 1.12, kanin: 1.1 },
  head: { hund: [1.3, 1.18, 1.12], katt: [1.3, 1.18, 1.12], kanin: [1.25, 1.15, 1.08] },
  fb: {
    hund: { len: 0.7, lat: 1.3, hlat: 1.15, snout: 0.8, tail: 0.85 },
    katt: { len: 0.72, lat: 1.25, hlat: 1.12, snout: 1, tail: 0.85 },
    kanin: { len: 0.8, lat: 1.15, hlat: 1.1, snout: 1, tail: 1 },
  },
};
export function rigOf(pet) {
  const sp = SPECIES[pet?.species] ? pet.species : 'katt';
  const B = breedIn(sp, pet?.breed);
  const C = pet?.breed2 ? breedIn(sp, pet.breed2) : B;
  const a = AGE[pet?.stage] ?? 2;
  const R = sp === 'hund' ? dogRig(B, a) : sp === 'katt' ? catRig(B, a) : rabbitRig(B, a);
  Object.assign(R, { sp, B, C, age: a, sex: pet?.sex === 'hona' ? 'hona' : 'hane', seed: pet?.seed ?? null });
  R.fluff = C.fluff || B.fluff || 0;
  if (sp === 'hund' && C.coat === 'curly') R.curly = true;
  // Stilisering: bredare i sidled (så att djuren inte blir pinnar framifrån/bakifrån)
  // och större huvud – mer för ungar. Sidovyns siluett påverkas nästan inte av bredden.
  const LAT = STYLE.lat[sp], HEAD = STYLE.head[sp][a];
  R.tW *= LAT; R.hR *= HEAD; R.hW *= STYLE.hlat[sp]; R.snoutR *= LAT * 0.95;
  R.earL *= HEAD;
  return R;
}

// ======================================================================
//  Poser (fyrfotadjur: hund och katt)
// ======================================================================
// P = { hip:[u,w], sh:[u,w], lift, head:[u,w], hp (nick, grader + = upp), hr (lutning), legs:[4×{top,knee,paw,fold}],
//       tail:{ up, wag, curl, lie }, eyes, mouth, ears }
function quadPose(R, anim, f) {
  const { legH, bodyL, tR, hR } = R;
  const cat = R.sp === 'katt';
  const sp = R.tW * 0.56;                        // benens sidledsavstånd
  const P = {
    hip: [-bodyL / 2, legH + tR * 0.96], sh: [bodyL / 2, legH + tR], lift: 0,
    head: null, hp: 0, hr: 0, legs: [], tail: { up: cat ? 30 : 25, wag: 0, curl: 0 }, eyes: f.blink ? 'closed' : 'open', mouth: 'closed', ears: 'normal',
    breath: f.breath ? 0.22 : 0,
  };
  const headStand = () => [P.sh[0] + tR * 0.85 + hR * 0.3, P.sh[1] + tR * 0.55 + hR * (cat ? 0.85 : 0.9) * R.headUp];
  const stand = (A = 0, lift = [0, 0, 0, 0], phase = 1) => {
    // benens fötter: [vänster fram, höger fram, vänster bak, höger bak]
    const fu = P.sh[0] + 0.25, hu = P.hip[0] - 0.2;
    P.legs = [
      { v: sp, paw: [fu + A * phase, sp, lift[0]] },
      { v: -sp, paw: [fu - A * phase, -sp, lift[1]] },
      { v: sp, hind: true, paw: [hu - A * phase, sp, lift[2]] },
      { v: -sp, hind: true, paw: [hu + A * phase, -sp, lift[3]] },
    ];
  };
  const wagA = [-1, 0, 1, 0][f.wag || 0];
  switch (anim) {
    case 'walk': {
      const s = f.step || 0, A = R.legH * 0.3 + 0.35;
      const ph = [1, 0, -1, 0][s];
      const up = s === 1 ? [0, 1, 1, 0] : s === 3 ? [1, 0, 0, 1] : [0, 0, 0, 0];
      stand(A, up.map((x) => x * Math.max(0.8, legH * 0.18)), ph);
      if (s === 1 || s === 3) P.lift = 0.5 / 0.83;
      P.tail = { up: cat ? 45 : 30, wag: cat ? wagA * 8 : wagA * 20, curl: 0 };
      break;
    }
    case 'run': {
      const s = f.step || 0, A = R.legH * 0.55 + 0.6;
      stand(0);
      const fu = P.sh[0] + 0.25, hu = P.hip[0] - 0.2;
      const lf = [[A * 1.2, 0.4], [0, 1.2], [-A * 0.6, 0.6], [A * 0.5, 1.6]][s];
      const lh = [[-A * 1.2, 0.5], [-A * 0.3, 1.4], [A * 0.8, 0.4], [0, 1.4]][s];
      P.legs[0].paw = [fu + lf[0], sp, lf[1]]; P.legs[1].paw = [fu + lf[0] - 0.6, -sp, lf[1] * 0.6];
      P.legs[2].paw = [hu + lh[0], sp, lh[1]]; P.legs[3].paw = [hu + lh[0] + 0.6, -sp, lh[1] * 0.6];
      P.lift = [0, 1, 1.6, 1][s] / 0.83;
      P.hip[1] += [0.4, 0, -0.3, 0][s]; P.sh[1] += [-0.3, 0, 0.4, 0][s];
      P.tail = { up: cat ? 10 : 5, wag: wagA * 6, curl: 0 };
      P.ears = 'back';
      if (!cat) P.mouth = 'tongue';
      break;
    }
    case 'sit':
    case 'love':
    case 'beg': {
      const beg = anim === 'beg';
      P.hip = [-bodyL * 0.2, tR * 0.95];
      P.sh = beg ? [P.hip[0] + tR * 0.35, P.hip[1] + bodyL * 0.78 + tR * 0.6] : [bodyL * 0.28, legH + tR + bodyL * 0.28];
      const fu = P.sh[0] + (beg ? 0.9 : 0.4);
      P.legs = [
        beg ? { v: sp, top: [P.sh[0] + 0.2, sp, P.sh[1] - tR * 0.3], paw: [fu + 0.9, sp, P.sh[1] - tR * 0.3 - legH * 0.45 + (f.alt ? 0.7 : 0)], nopaw: true } : { v: sp, paw: [fu, sp, 0] },
        beg ? { v: -sp, top: [P.sh[0] + 0.2, -sp, P.sh[1] - tR * 0.3], paw: [fu + 0.9, -sp, P.sh[1] - tR * 0.3 - legH * 0.45 + (f.alt ? 0 : 0.7)], nopaw: true } : { v: -sp, paw: [fu, -sp, 0] },
        { v: sp, hind: true, sit: true, paw: [P.hip[0] + tR * 0.9, sp * 1.25, 0] },
        { v: -sp, hind: true, sit: true, paw: [P.hip[0] + tR * 0.9, -sp * 1.25, 0] },
      ];
      P.head = beg ? [P.sh[0] + hR * 0.55, P.sh[1] + tR * 0.4 + hR * 0.85] : [P.sh[0] + tR * 0.6 + hR * 0.3, P.sh[1] + tR * 0.45 + hR * 0.85 * R.headUp];
      P.tail = cat ? { lie: true, wag: wagA * 10, curl: 1 } : { lie: true, wag: wagA * 28 };
      if (anim === 'love') { P.eyes = 'happy'; P.hr = 10; }
      if (beg) { P.hp = 18; P.mouth = cat ? (f.alt ? 'meow' : 'closed') : 'tongue'; }
      break;
    }
    case 'sleep': {
      P.hip = [-bodyL * 0.45, tR * 0.85 + P.breath * 0.5]; P.sh = [bodyL * 0.42, tR * 0.9 + P.breath * 0.5];
      P.legs = [
        { v: sp, top: [P.sh[0] + 0.3, sp, tR * 0.6], paw: [P.sh[0] + tR * 0.8 + legH * 0.55, sp * 0.8, 0.3], nopaw: true, flat: true },
        { v: -sp, top: [P.sh[0] + 0.3, -sp, tR * 0.6], paw: [P.sh[0] + tR * 0.8 + legH * 0.5, -sp * 0.8, 0.3], nopaw: true, flat: true },
        { v: sp, hind: true, fold: true }, { v: -sp, hind: true, fold: true },
      ];
      P.head = [P.sh[0] + tR * 0.75 + hR * 0.35, hR * 0.95];
      P.hp = -8;
      P.eyes = 'closed'; P.breath = 0;
      P.tail = { lie: true, wrap: 1, wag: 0 };
      P.ears = 'rest';
      break;
    }
    case 'eat': {
      stand(0);
      P.head = [P.sh[0] + tR * 0.9 + hR * 0.4, hR * 0.95 + (f.chew ? 0.45 : 0) + 0.2];
      P.hp = -38;
      P.tail = { up: cat ? 20 : 30, wag: cat ? 0 : wagA * 22 };
      P.eyes = f.chew && cat ? 'closed' : P.eyes;
      break;
    }
    case 'play': {
      const s = f.step || 0;
      if (s < 2) {
        // lekbugning: framdelen ner, rumpan upp
        stand(0);
        P.sh = [bodyL / 2 + 0.3, tR * 1.05 + 0.3];
        P.hip = [-bodyL / 2, legH + tR * 1.0 + (s ? 0.3 : 0)];
        P.legs[0] = { v: sp, top: [P.sh[0], sp, tR * 0.5], paw: [P.sh[0] + legH * 0.8 + 0.5, sp, 0.1], flat: true };
        P.legs[1] = { v: -sp, top: [P.sh[0], -sp, tR * 0.5], paw: [P.sh[0] + legH * 0.8 + 0.2, -sp, 0.1], flat: true };
        P.head = [P.sh[0] + tR * 0.8 + hR * 0.5, tR * 1.1 + hR * 0.85 + 0.2];
        P.hp = 8;
        P.tail = { up: cat ? 60 : 55, wag: wagA * (cat ? 12 : 30) };
      } else {
        stand(0.6, [0.6, 0.6, 0, 0]);
        P.lift = (s === 2 ? 2 : 1) / 0.83;
        P.sh[1] += 0.5;
        if (cat) { P.legs[0].paw = [P.sh[0] + 1.8, sp, legH + 1.4]; P.legs[0].top = [P.sh[0] + 0.3, sp, P.sh[1] - tR * 0.3]; }
        P.tail = { up: cat ? 50 : 45, wag: wagA * 30 };
      }
      if (!cat) P.mouth = 'tongue'; else if (s >= 2) P.eyes = 'open';
      P.ears = cat ? 'normal' : 'perk';
      break;
    }
    case 'poop':
    case 'pee': {
      const lift = anim === 'pee' && !cat && R.sex === 'hane';
      stand(0);
      if (lift) {
        // hanhund lyfter ett bakben
        P.legs[2].paw = [P.hip[0] - 0.3, R.tW * 1.9, legH * 0.85 + 0.6];
        P.legs[2].knee = [P.hip[0] - 0.2, R.tW * 1.3, legH * 0.9 + 0.3];
        P.legs[2].liftLeg = true;
        P.tail = { up: 40, wag: 0 };
        P.hip[1] += 0.2;
      } else {
        const sq = anim === 'poop' ? 1 : 0.7;
        P.hip = [-bodyL * 0.38, legH * (1 - 0.55 * sq) + tR * 0.9];
        P.sh = [bodyL * 0.45, legH + tR * 0.95];
        P.legs[2] = { v: sp, hind: true, squat: true, paw: [P.hip[0] + tR * 0.7, sp * 1.2, 0] };
        P.legs[3] = { v: -sp, hind: true, squat: true, paw: [P.hip[0] + tR * 0.7, -sp * 1.2, 0] };
        P.arch = anim === 'poop' ? 0.6 + (f.alt ? 0.25 : 0) : 0.2;
        P.tail = { up: cat ? 5 : 50, wag: 0 };
      }
      P.head = [P.sh[0] + tR * 0.85 + hR * 0.3, P.sh[1] + tR * 0.5 + hR * 0.8 * R.headUp];
      if (anim === 'poop' && f.alt) P.eyes = 'closed';
      break;
    }
    case 'happy': {
      const s = f.step || 0;
      stand(0.3, [0, 0, 0, 0]);
      if (cat) {
        P.tail = { up: 88, wag: wagA * 4, quiver: true };
        P.eyes = 'happy';
        P.lift = 0;
        P.hip[1] += [0, 0.3, 0, 0.3][s]; P.sh[1] += [0.3, 0, 0.3, 0][s];
      } else {
        P.lift = [0, 1, 2, 1][s] / 0.83;
        if (s === 2) { P.legs[0].paw[2] = 0.8; P.legs[1].paw[2] = 0.8; P.sh[1] += 0.5; }
        P.tail = { up: 50, wag: wagA * 34 };
        P.mouth = 'tongue';
        P.eyes = 'happy';
        P.ears = 'perk';
      }
      break;
    }
    default: { // idle
      stand(0);
      P.hip[1] += P.breath * 0.4; P.sh[1] += P.breath;
      P.tail = { up: cat ? 55 : 28, wag: cat ? wagA * 10 : wagA * 14, curl: 0 };
    }
  }
  if (!P.head) P.head = headStand();
  return P;
}

// ======================================================================
//  Bygg dockan
// ======================================================================
function axesFor(pitch, roll = 0, yaw = 0) {
  // modellaxlar vridna: nick (runt v), lutning (runt u), gir (runt w)
  const cp = Math.cos(pitch * D2R), spn = Math.sin(pitch * D2R);
  let f = [cp, 0, spn], s = [0, 1, 0], u = [-spn, 0, cp];
  if (roll) { const c = Math.cos(roll * D2R), q = Math.sin(roll * D2R); const s2 = add(scl(s, c), scl(u, q)), u2 = add(scl(u, c), scl(s, -q)); s = s2; u = u2; }
  if (yaw) { const c = Math.cos(yaw * D2R), q = Math.sin(yaw * D2R); const rot = (a) => [a[0] * c - a[1] * q, a[0] * q + a[1] * c, a[2]]; f = rot(f); s = rot(s); u = rot(u); }
  return [f, s, u];
}
const M3 = (u, v, w) => [u, v, w];

function buildQuad(S, R, P) {
  const { tR, tW, hR, legH } = R;
  const cat = R.sp === 'katt';
  const L = P.lift || 0;
  const hip = M3(P.hip[0], 0, P.hip[1] + L), sh = M3(P.sh[0], 0, P.sh[1] + L);
  const ax = sub(sh, hip), len = Math.hypot(ax[0], ax[2]) || 1;
  const an = [ax[0] / len, 0, ax[2] / len], up = [-an[2], 0, an[0]];
  const bodyAx = [an, [0, 1, 0], up];
  S.anchors.body = { hip, sh, an, up, len };
  const fl = R.fluff ? 0.25 * R.fluff : 0;
  // bål: rumpa, mitt, bröst
  S.ell(add(hip, scl(up, 0.05)), [tR * 1.02 + fl, tW * 0.96 + fl, tR * 0.97 + fl], 'rump', { ax: bodyAx });
  const mid = lerp(hip, sh, 0.5);
  const arch = P.arch || 0;
  S.ell(add(mid, scl(up, arch)), [len / 2 + tR * 0.25, tW * 0.9 + fl, tR * 0.88 + fl + arch * 0.3], 'body', { ax: bodyAx });
  S.ell(add(sh, scl(an, 0.15)), [tR * 1.08 + fl, tW + fl, tR * 1.06 + fl], 'chest', { ax: bodyAx });
  // hals + huvud
  const hc = M3(P.head[0], 0, P.head[1] + L);
  const [hf, hs, hu] = axesFor(P.hp || 0, P.hr || 0, 0);
  const neck0 = add(add(sh, scl(an, tR * 0.45)), scl(up, tR * 0.35));
  const neck1 = add(hc, add(scl(hf, -hR * 0.35), scl(hu, -hR * 0.45)));
  S.along(neck0, neck1, tR * 0.2, tR * (cat ? 0.66 : 0.72) + fl * 0.6, 'neck', { rw: tR * (cat ? 0.7 : 0.78) + fl * 0.6 });
  S.anchors.neck = lerp(neck0, neck1, 0.72);
  const hRad = [hR * (cat ? 0.92 : 1), hR * R.hW, hR * (cat ? 0.9 : 0.95)];
  S.ell(hc, hRad, 'head', { ax: [hf, hs, hu], grp: GRP.head });
  if (R.fluff >= 2 && cat) S.ell(add(hc, add(scl(hf, -hR * 0.3), scl(hu, -hR * 0.55))), [hR * 0.8, hR * R.hW * 1.05, hR * 0.75], 'ruff', { ax: [hf, hs, hu], grp: GRP.head });
  // nos
  let snoutC;
  if (cat) {
    snoutC = add(hc, add(scl(hf, hRad[0] * 0.78), scl(hu, -hRad[2] * 0.38)));
    S.ell(snoutC, [R.snoutL + 0.35, R.snoutR, R.snoutH], 'snout', { ax: [hf, hs, hu], grp: GRP.head });
  } else {
    const flat = R.B.snout === 'flat';
    snoutC = add(hc, add(scl(hf, hRad[0] * (flat ? 0.8 : 0.72) + R.snoutL * 0.55), scl(hu, -hRad[2] * (flat ? 0.3 : 0.36))));
    S.ell(snoutC, [R.snoutL * 0.62 + 0.55, R.snoutR, R.snoutH], 'snout', { ax: [nrm(add(hf, scl(hu, -0.12))), hs, hu], grp: GRP.head });
  }
  const snoutTip = add(snoutC, scl(hf, (cat ? R.snoutL + 0.35 : R.snoutL * 0.62 + 0.55) * 0.97));
  // öron
  ears(S, R, P, hc, hRad, hf, hs, hu);
  // ben
  legs(S, R, P, hip, sh, an, up);
  // svans
  tail(S, R, P, hip, an, up);
  // ansikte
  face(S, R, P, hc, hRad, hf, hs, hu, snoutC, snoutTip);
  S.anchors.head = hc;
}

function ears(S, R, P, hc, hr, hf, hs, hu) {
  const at = (a, b, c) => add(hc, add(add(scl(hf, a), scl(hs, b)), scl(hu, c)));
  const back = P.ears === 'back' ? 1 : P.ears === 'rest' ? 0.6 : 0;
  const perk = P.ears === 'perk' ? 1 : 0;
  const E = R.earL;
  for (const sd of [1, -1]) {
    const g = sd > 0 ? GRP.ear : GRP.ear2;
    switch (R.ears) {
      case 'cat': case 'up': case 'bat': {
        const bat = R.ears === 'bat', dog = R.sp === 'hund';
        const wBase = hr[1] * (bat ? 0.62 : dog ? 0.5 : 0.56);
        const x0 = hr[1] * (bat ? 0.25 : dog ? 0.3 : 0.28), z0 = hr[2] * (bat ? 0.62 : 0.7);
        const a = at(-hr[0] * 0.05, sd * x0, z0 + 0.1), b = at(-hr[0] * 0.35, sd * (x0 + wBase), z0 - (bat ? 0.4 : 0.25));
        const tipOut = bat ? E * 0.75 : dog ? 0.35 : 0.3;
        const tip = at(-hr[0] * 0.25 - back * E * 0.9, sd * (x0 + wBase * 0.55 + tipOut + back * 0.4), z0 + E * (1 - back * 0.55) + perk * 0.3);
        S.tri(a, b, tip, 'ear', { grp: g, front: hf, inner: bat ? 0.5 : 0.7 });
        // lite tjocklek bakåt så örat syns även bakifrån
        S.tri(add(a, scl(hf, -0.35)), add(b, scl(hf, -0.35)), add(tip, scl(hf, -0.3)), 'ear', { grp: g });
        if (R.fluff >= 2 && R.sp === 'katt') S.tri(tip, add(tip, add(scl(hu, 0.8), scl(hs, sd * 0.1))), add(tip, scl(hs, sd * -0.4)), 'eartuft', { grp: g });
        break;
      }
      case 'fold': {
        // uppstående bas, spetsen viker framåt/nedåt
        const base = at(-hr[0] * 0.1, sd * hr[1] * 0.5, hr[2] * 0.72);
        const b2 = at(-hr[0] * 0.25, sd * hr[1] * 0.95, hr[2] * 0.42);
        const tip = at(hr[0] * 0.4 - back * 0.8, sd * hr[1] * (0.95 + back * 0.1), hr[2] * 0.3 + perk * 0.5);
        S.tri(base, b2, tip, 'ear', { grp: g });
        S.tri(add(base, scl(hu, 0.3)), b2, add(tip, scl(hu, 0.2)), 'ear', { grp: g });
        break;
      }
      case 'flop': case 'pom': {
        const pom = R.ears === 'pom';
        const c = at(-hr[0] * 0.15 - back * 0.5, sd * (hr[1] * 0.98 + (pom ? 0.3 : 0.1)), hr[2] * 0.05 - (pom ? 0.5 : 0.3) + perk * 0.3);
        const earAx = [hf, nrm(add(hs, scl(hu, sd * 0.15))), nrm(add(hu, scl(hs, -sd * 0.15)))];
        S.ell(c, [pom ? E * 0.62 : E * 0.52, pom ? 0.75 : 0.45, pom ? E * 0.95 : E * 0.9], 'ear', { ax: earAx, grp: g });
        break;
      }
      case 'up-rabbit': break;
    }
  }
}

function legs(S, R, P, hip, sh, an, up) {
  const { tR, tW, legH } = R;
  const cat = R.sp === 'katt';
  const L = P.lift || 0;
  const farOf = (v) => proj(S.W([0, v, 0]))[2] > 0.05;
  P.legs.forEach((lg, idx) => {
    const v = lg.v, g = GRP.leg0 + idx, far = farOf(v);
    const base = lg.hind ? hip : sh;
    if (lg.fold) {
      // hopvikt bakben (ligger): bara låret syns
      S.ell(add(add(hip, [tR * 0.45, v * 1.35, -tR * 0.45]), [0, 0, 0]), [tR * 0.9, tW * 0.42, tR * 0.62], 'haunch', { grp: GRP.body });
      return;
    }
    const top = lg.top ? add(lg.top, [0, 0, L]) : add(base, [lg.hind ? -0.1 : 0.1, v, -tR * 0.35]);
    const paw = add(lg.paw, [0, 0, lg.paw[2] > 0.01 || !lg.hind ? 0 : 0]);
    const pawW = [paw[0], paw[1], paw[2] + (lg.nopaw || lg.flat || lg.liftLeg ? L : 0)];
    if (lg.hind) {
      // lår (ellipsoid) + hasen bakåt + mellanfot
      const sit = lg.sit, squat = lg.squat;
      const thighC = sit ? add(hip, [tR * 0.35, v * 1.2, -tR * 0.35]) : add(hip, [0.25, v * 1.15, -tR * 0.3]);
      S.ell(thighC, sit ? [tR * 0.95, tW * 0.45, tR * 0.75] : [tR * 0.72, tW * 0.42, tR * 0.9], 'haunch', { grp: GRP.body });
      if (sit || squat) {
        S.stroke(add(thighC, [tR * 0.6, 0, -tR * 0.5]), [pawW[0], v * 1.25, 0], R.legW, 'leg', { grp: g, far, paw: 1, pawDir: [0.8, 0, 0] });
        return;
      }
      const hock = lg.knee ? add(lg.knee, [0, 0, L]) : [thighC[0] - 0.55 - (cat ? 0.15 : 0), v, Math.max(pawW[2] + legH * 0.42, legH * 0.42 + L)];
      S.stroke(add(thighC, [0, 0, -tR * 0.35]), hock, R.legW, 'leg', { grp: g, far });
      S.stroke(hock, pawW, R.legW, 'leg', { grp: g, far, paw: lg.liftLeg ? 0 : 1, pawDir: [0.6, 0, 0] });
    } else {
      S.stroke(top, pawW, R.legW, 'leg', { grp: g, far, paw: lg.nopaw ? 0 : 1, pawDir: lg.flat ? null : [0.7, 0, 0] });
      if (lg.nopaw || lg.flat) S.ell(pawW, [0.75, 0.55, 0.5], 'leg-paw', { grp: g });
    }
  });
}

// svansen som en kedja punkter från roten
function tailPts(R, P, hip, an, up) {
  const { tR } = R, T = P.tail || {};
  const n = 7, Lt = R.tailL;
  const base = add(add(hip, scl(an, -tR * 0.92)), scl(up, tR * 0.4));
  const pts = [];
  const wag = (T.wag || 0) * D2R;
  let kind = R.tail;
  if (T.lie) {
    // ligger på golvet: bakåt och runt åt sidan
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const a = (T.wrap ? 150 : T.curl ? 110 : 40) * D2R * t + wag;
      const r = Lt * (T.wrap ? 0.55 : 0.75);
      const p = [base[0] - Math.cos(a) * r * t * 1.1 - (T.wrap ? 0 : t * 0.6), Math.sin(a) * r * t * 1.1, Math.max(0.45, base[2] * (1 - t * 2.2))];
      pts.push(p);
    }
    return { pts, base };
  }
  if (kind === 'curl') {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), a = (200 * t) * D2R;
      const r = Lt * 0.36;
      pts.push([base[0] - Math.sin(a) * r * 1.0 + t * 0.4, Math.sin(a * 0.5) * (T.wag || 0) * 0.03 + t * 0.6, base[2] + (1 - Math.cos(a)) * r]);
    }
    return { pts, base };
  }
  const upA = (T.up ?? 30) * D2R;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let a = upA, drop = 0;
    if (kind === 'brush' || kind === 'plume') { a = upA * 0.5 - 35 * D2R * t; }
    if (kind === 'otter') { a = upA * 0.6 - 20 * D2R * t; }
    if (kind === 'cat' || kind === 'bushy') { a = upA + (T.quiver ? 0 : 35 * D2R * t * t); }
    const r = Lt * t;
    const back = Math.cos(a) * r, rise = Math.sin(a) * r - drop;
    const w = wag * (0.4 + t * 0.8);
    pts.push([base[0] - back * Math.cos(w), -back * Math.sin(w), base[2] + rise]);
  }
  if (T.quiver) { const last = pts[n - 1]; pts[n - 1] = [last[0] - 0.6, last[1] + (T.wag || 0) * 0.02, last[2] - 0.3]; }
  return { pts, base };
}
function tail(S, R, P, hip, an, up) {
  const { pts } = tailPts(R, P, hip, an, up);
  const kind = R.tail;
  const g = GRP.tail;
  if (kind === 'bob') { S.ell(pts[1], [0.8, 0.7, 0.8], 'tail', { grp: g }); return; }
  if (kind === 'puff') return;
  const thick = { plume: [1.05, 0.95], brush: [1.05, 0.8], curl: [1.0, 0.75], bushy: [1.05, 0.95], otter: [0.95, 0.5] }[kind];
  if (thick) {
    const sc = R.age === 0 ? 0.75 : R.age === 1 ? 0.88 : 1;
    const r0 = thick[0] * sc * (R.S || 1) ** 0.5, r1 = thick[1] * sc * (R.S || 1) ** 0.5;
    for (let i = 1; i < pts.length; i++) {
      const t = i / (pts.length - 1);
      const r = r0 + (r1 - r0) * t;
      S.along(pts[i - 1], pts[i], r * 0.6, r, t > 0.8 ? 'tailtip' : 'tail', { grp: g });
    }
    return;
  }
  const w = kind === 'pom' ? 1 : R.age === 0 ? 1 : (R.sp === 'katt' ? (R.age === 2 ? 2 : 1) : R.S >= 0.85 ? 2 : 1);
  for (let i = 1; i < pts.length; i++) {
    const t = i / (pts.length - 1);
    S.stroke(pts[i - 1], pts[i], i > pts.length - 3 && w > 1 ? 1 : w, t > 0.75 ? 'tailtip' : 'tail', { grp: g });
  }
  if (kind === 'pom') S.ell(pts[pts.length - 1], [1.1, 1.1, 1.1], 'tailtip', { grp: g });
}

// ---------------------------------------------------------------- ansiktet
const EYE_DARK = 0x1a1216;
function face(S, R, P, hc, hr, hf, hs, hu, snoutC, snoutTip) {
  const cat = R.sp === 'katt', dog = R.sp === 'hund';
  const C = R.C;
  const iris = C.eye ?? (dog ? 0x4a2c1a : cat ? 0x9ab040 : 0x2a1a14);
  const fur = rampOf(C.c);
  const ex = cat ? 0.72 : R.sp === 'kanin' ? 0.62 : 0.72, ey = cat ? 0.5 : R.sp === 'kanin' ? 0.62 : 0.52, ez = cat ? 0.2 : R.sp === 'kanin' ? 0.3 : 0.34;
  const d = nrm([ex, ey, ez]);
  const style = R.eyeStyle;
  const front = S.dir === 'down';
  for (const sd of [1, -1]) {
    const p = add(hc, add(add(scl(hf, hr[0] * d[0]), scl(hs, sd * hr[1] * d[1])), scl(hu, hr[2] * d[2])));
    const [sx] = proj(S.W(p));
    const [cx] = proj(S.W(hc));
    const left = sx < cx;                  // skärmens vänstra öga
    let ix = null;
    if (front) { const off = Math.max(1, Math.round(Math.abs(sx - cx))); ix = Math.round(cx) + (left ? -off : off); }
    S.decal('eye', p, {
      ix, tol: 1.4,
      draw(put, i, j) {
        drawEye(put, i, j, style, P.eyes, left, front, iris, fur);
      },
    });
  }
  // nos
  const noseC = dog ? (C.nose ?? 0x201a1e) : (C.nose ?? (lum(C.c) < 0.3 ? 0x40303a : 0xe88a9a));
  S.decal('nose', snoutTip, {
    ix: front ? 0 : null, tol: 1.6,
    draw(put, i, j) {
      if (front) {
        if (dog && R.S * [0.7, 0.85, 1][R.age] >= 0.75) { put(i - 1, j, noseC); put(i, j, noseC); put(i + 1, j, noseC); put(i, j + 1, mix(noseC, 0x000000, 0.2)); put(i, j, mix(noseC, 0x9a90a8, 0.35)); }
        else put(i, j, noseC);
        mouth(put, i, j + (dog && R.S >= 0.75 ? 2 : 1), P.mouth, R, true, fur);
      } else {
        put(i, j, noseC);
        if (dog && R.hR > 2.2) put(i, j + 1, mix(noseC, fur.lo, 0.3));
        mouth(put, i, j, P.mouth, R, false, fur, S.dir === 'left' ? -1 : 1);
      }
    },
  });
}
function drawEye(put, i, j, style, state, left, front, iris, fur) {
  const lid = mix(fur.dk, EYE_DARK, 0.5);
  const glint = 0xf6f4ff;
  if (state === 'closed' || state === 'happy') {
    const w = style === 'L' ? 2 : front ? 2 : 1;
    const x0 = front ? (left ? i - (w - 1) : i) : i;
    const yy = state === 'happy' ? j : j + (style === 'L' ? 1 : 0);
    for (let q = 0; q < w; q++) put(x0 + q, yy, lid);
    if (state === 'happy' && w === 2 && style === 'L') { put(x0 - (left ? 0 : 0), yy, lid); }
    return;
  }
  if (style === 'L') {
    // stora ungögon 2×2 med glans uppe till vänster
    const x0 = front ? (left ? i - 1 : i) : i;
    put(x0, j, glint); put(x0 + 1, j, EYE_DARK);
    put(x0, j + 1, mix(iris, EYE_DARK, 0.35)); put(x0 + 1, j + 1, EYE_DARK);
  } else if (style === 'C' || style === 'R') {
    // katt/kanin: 1×2 – iris upptill, pupill nertill
    put(i, j, mix(iris, glint, 0.25)); put(i, j + 1, EYE_DARK);
  } else {
    // hund: 1×2 mörk med glans
    put(i, j, mix(EYE_DARK, glint, 0.55)); put(i, j + 1, EYE_DARK);
  }
}
function mouth(put, i, j, m, R, front, fur, sd = 1) {
  const tongue = 0xe8687a, dark = mix(fur.dk, EYE_DARK, 0.6);
  if (front) {
    if (R.sp === 'katt') {
      if (m === 'meow') { put(i, j, dark); put(i, j + 1, tongue); }
      else { put(i - 1, j, mix(fur.lo, dark, 0.5)); put(i + 1, j, mix(fur.lo, dark, 0.5)); }
    } else if (R.sp === 'hund') {
      if (m === 'tongue' || m === 'open') { put(i, j, dark); put(i, j + 1, tongue); if (R.S >= 0.85 && R.age > 0) put(i, j + 2, mix(tongue, 0x000000, 0.15)); }
    } else {
      put(i, j, mix(fur.lo, dark, 0.3));
    }
  } else {
    if (R.sp === 'hund' && (m === 'tongue' || m === 'open')) { put(i - sd, j + 1, dark); put(i - sd, j + 2, tongue); }
    if (R.sp === 'katt' && m === 'meow') { put(i - sd, j + 1, dark); }
  }
}

// ======================================================================
//  Kanin
// ======================================================================
function rabbitPose(R, anim, f) {
  const { tR, bodyL, hR } = R;
  const P = {
    hip: [-bodyL / 2, tR * 0.95], sh: [bodyL / 2, tR * 0.85 + 0.2], lift: 0, head: null, hp: 0, hr: 0,
    eyes: f.blink ? 'closed' : 'open', mouth: 'closed', ears: 'normal', nose: f.nose || 0, stretch: 0, front: 0, stand: false,
  };
  const wiggle = f.ear ? 1 : 0;
  switch (anim) {
    case 'walk': case 'run': {
      const s = f.step || 0, big = anim === 'run' ? 1.6 : 1;
      P.stretch = [0, 1, 1.3, 0.4][s] * big;
      P.lift = [0, 0.8, 1.6, 0.6][s] * big / 0.83;
      P.front = [0, 0.8, 1.2, 1.6][s] * big;     // framtassarna sträcks fram
      P.ears = s === 2 ? 'back' : 'normal';
      break;
    }
    case 'sleep': P.eyes = 'closed'; P.ears = 'flat'; P.hip[1] -= 0.2; P.sh[1] -= 0.3; P.breath = f.breath; break;
    case 'eat': P.head = 'down'; P.chew = f.chew; break;
    case 'beg': case 'love': case 'happy': case 'play': {
      if (anim === 'beg' || (anim === 'love' && false)) { P.stand = true; }
      if (anim === 'love') { P.eyes = 'happy'; }
      if (anim === 'happy' || anim === 'play') {
        const s = f.step || 0;
        P.lift = [0, 1.5, 2.5, 1][s] / 0.83; P.twist = [0, 12, -12, 0][s]; P.stretch = [0, 0.6, 0.3, 0][s];
        if (anim === 'happy') P.eyes = 'happy';
      }
      break;
    }
    case 'poop': case 'pee': P.hip[1] -= 0.25; P.eyes = f.alt ? 'closed' : P.eyes; break;
    case 'sit': break;
    default: break;
  }
  P.earWiggle = anim === 'idle' || anim === 'sit' ? wiggle : 0;
  P.breath = anim === 'sleep' || anim === 'idle' ? (f.breath ? 0.22 : 0) : 0;
  return P;
}
function buildRabbit(S, R, P) {
  const { tR, tW, hR, bodyL } = R;
  const L = P.lift || 0;
  const fl = R.fluff ? 0.2 : 0;
  if (P.stand) {
    // står på bakbenen: kroppen upprätt
    const hip = [-0.4, 0, tR * 0.95], sh = [0.1, 0, tR * 0.95 + bodyL * 1.25];
    S.anchors.body = { hip, sh };
    S.ell(hip, [tR * 0.95, tW * 1.02, tR * 1.02], 'rump', { ax: axesFor(70) });
    S.ell(sh, [tR * 0.7, tW * 0.82, tR * 0.85], 'chest', { ax: axesFor(80) });
    const hc = [sh[0] + 0.5, 0, sh[2] + tR * 0.55 + hR * 0.75];
    rabbitHead(S, R, P, hc, 12);
    for (const sd of [1, -1]) {
      S.ell([hip[0] + 0.9, sd * tW * 0.62, 0.35], [1.25, 0.5, 0.4], 'foot', { grp: sd > 0 ? GRP.leg2 : GRP.leg3 });
      S.ell([sh[0] + 0.9, sd * tW * 0.38, sh[2] - tR * 0.55], [0.55, 0.42, 0.62], 'leg-paw', { grp: sd > 0 ? GRP.leg0 : GRP.leg1 });
    }
    S.ell([hip[0] - tR * 0.9, 0, hip[2] - 0.4], [0.75, 0.8, 0.75], 'puff', { grp: GRP.tail });
    return;
  }
  const st = P.stretch || 0;
  const hip = [-bodyL / 2 - st * 0.35, 0, P.hip[1] + L + (P.breath || 0)], sh = [bodyL / 2 + st * 0.45, 0, P.sh[1] + L + (P.breath || 0) * 0.5];
  S.anchors.body = { hip, sh };
  const tw = P.twist ? axesFor(0, 0, P.twist) : undefined;
  S.ell(hip, [tR * 1.02 - st * 0.12, tW * 1.02 + fl, tR * 0.98 + fl - st * 0.1], 'rump', { ax: tw });
  S.ell(sh, [tR * 0.82, tW * 0.84 + fl, tR * 0.86 + fl], 'chest', { ax: tw });
  const down = P.head === 'down';
  const hc = down ? [sh[0] + tR * 0.75 + hR * 0.4, 0, hR * 0.9 + L + (P.chew ? 0.35 : 0)]
    : [sh[0] + tR * 0.55 + hR * 0.25 + st * 0.3, 0, sh[2] + tR * 0.45 + hR * 0.62];
  rabbitHead(S, R, P, hc, down ? -30 : P.twist ? P.twist * 0.5 : 0);
  // bakfötter (långa, platta) och framtassar
  for (const sd of [1, -1]) {
    const g = sd > 0 ? GRP.leg2 : GRP.leg3;
    const fz = L > 0.3 ? L * 0.55 : 0;
    const back = st * 0.7;
    S.ell([hip[0] + 0.55 - back, sd * tW * 0.66, 0.38 + fz], [1.3 + st * 0.2, 0.52, 0.42], 'foot', { grp: g, ax: P.twist ? axesFor(-st * 12, 0, P.twist) : axesFor(-st * 12) });
    S.ell([hip[0] + 0.1 - back * 0.4, sd * tW * 0.72, tR * 0.62 + L], [tR * 0.7, tW * 0.38, tR * 0.62], 'haunch', { grp: GRP.body, ax: tw });
    const fg = sd > 0 ? GRP.leg0 : GRP.leg1;
    const fr = P.front || 0;
    const top = [sh[0] + 0.2, sd * tW * 0.4, sh[2] - tR * 0.4];
    const paw = [sh[0] + 0.45 + fr * 0.6, sd * tW * 0.4, L > 0.3 ? Math.max(0.2, L - tR * 0.6 - 0.3) : 0.2];
    S.stroke(top, paw, 1, 'leg', { grp: fg, far: proj(S.W([0, sd, 0]))[2] > 0.05 });
    S.ell(paw, [0.6, 0.42, 0.35], 'leg-paw', { grp: fg });
  }
  S.ell([hip[0] - tR * 0.95, 0, hip[2] + tR * 0.25], [0.78, 0.8, 0.78], 'puff', { grp: GRP.tail });
}
function rabbitHead(S, R, P, hc, pitch) {
  const { hR } = R;
  const [hf, hs, hu] = axesFor(pitch, 0, 0);
  const hr = [hR * 0.95, hR * 1.0, hR * 0.95];
  // hals/kind
  S.ell(add(hc, add(scl(hf, -hR * 0.45), scl(hu, -hR * 0.55))), [hR * 0.8, hR * 0.85, hR * 0.7], 'neck', { ax: [hf, hs, hu] });
  S.ell(hc, hr, 'head', { ax: [hf, hs, hu], grp: GRP.head });
  if (R.fluff >= 2) S.ell(add(hc, add(scl(hf, -hR * 0.35), scl(hu, -0.1))), [hR * 1.05, hR * 1.22, hR * 1.15], 'mane', { ax: [hf, hs, hu], grp: GRP.head });
  const snoutC = add(hc, add(scl(hf, hr[0] * 0.78), scl(hu, -hr[2] * 0.3)));
  S.ell(snoutC, [R.snoutL + 0.4, R.snoutR, R.snoutH], 'snout', { ax: [hf, hs, hu], grp: GRP.head });
  const tip = add(snoutC, scl(hf, (R.snoutL + 0.4) * 0.96));
  S.anchors.neck = add(hc, add(scl(hf, -hR * 0.4), scl(hu, -hR * 0.75)));
  S.anchors.head = hc;
  // öron
  const E = R.earL;
  for (const sd of [1, -1]) {
    const g = sd > 0 ? GRP.ear : GRP.ear2;
    if (R.ears === 'lop') {
      const c = add(hc, add(add(scl(hf, -hr[0] * 0.2), scl(hs, sd * hr[1] * 0.95)), scl(hu, hr[2] * 0.05)));
      S.ell(c, [0.8, 0.42, E * 0.62], 'ear', { ax: [hf, nrm(add(hs, scl(hu, sd * 0.25))), nrm(add(hu, scl(hs, -sd * 0.25)))], grp: g });
    } else {
      const flat = P.ears === 'flat' ? 1 : P.ears === 'back' ? 0.55 : 0;
      const tilt = (8 + flat * 62) * D2R, spread = (P.earWiggle && sd > 0 ? 16 : 8) * D2R;
      const dir = nrm([-Math.sin(tilt), sd * Math.sin(spread), Math.cos(tilt)]);
      const w = [hf, hs, hu];
      const toH = (v) => add(add(scl(w[0], v[0]), scl(w[1], v[1])), scl(w[2], v[2]));
      const root = add(hc, toH([-hr[0] * 0.15, sd * hr[1] * 0.38, hr[2] * 0.72]));
      const ea = toH(dir), c = add(root, scl(ea, E * 0.5));
      const side = nrm(cross(ea, hf));
      const fwd = nrm(cross(side, ea));
      S.ell(c, [E * 0.55, 0.62 * (R.age === 0 ? 0.8 : 1), 0.3], 'ear', { ax: [ea, side, fwd], grp: g, rabbitEar: true });
    }
  }
  face(S, R, P, hc, hr, hf, hs, hu, snoutC, tip);
  // nosen nosar
  if (P.nose) S.decal('nosewig', tip, { tol: 1.6, draw(put, i, j) { put(i, j - 1, 0xe88a9a); } });
}

// ======================================================================
//  Päls
// ======================================================================
function coatFn(R, P, S) {
  const C = R.C, sp = R.sp;
  const c = C.c, c2 = C.c2 ?? mix(c, 0xffffff, 0.6), c3 = C.c3 ?? c2, belly = C.belly ?? mix(c, 0xf4efe6, 0.35);
  const pink = 0xe8a2aa, pinkDk = 0xc87888;
  const body = S.anchors.body;
  // kroppens egna koordinater: bu (0 = höft, 1 = bog), bw (−1 buk, +1 rygg)
  const bodyUV = (m) => {
    if (!body || !body.an) return [0.5, 0];
    const d = sub(m, body.hip);
    return [dot(d, body.an) / body.len, dot(d, body.up) / R.tR];
  };
  const seedMark = R.seed != null ? strHash(R.seed) : -1;
  return (part, m, n, q, i, j) => {
    const [bu, bw] = bodyUV(m);
    const torso = part === 'body' || part === 'rump' || part === 'chest' || part === 'neck' || part === 'haunch';
    const leg = part === 'leg' || part === 'leg-paw' || part === 'foot';
    const tt = q ? q[1] : 0; // längs benet 0 (uppe) → 1 (nere)
    if (part === 'ear-in') return sp === 'hund' && C.pat !== 'solid' && C.pat !== 'mask' ? mix(c, pink, 0.45) : pink;
    if (part === 'eartuft') return mul(c2, 0.9);
    // individuella tecken (ungar): vit tass eller vit bläs
    if (seedMark >= 0 && part === 'leg-paw' && seedMark < 0.35) return 0xf4f2ee;
    switch (C.pat) {
      case 'tabby': {
        if (part === 'ear') return mul(c, 0.9);
        if (part === 'snout') return q[2] < 0.1 ? (C.c3 ?? belly) : c;
        if (part === 'head' || part === 'ruff') {
          if (part === 'ruff') return C.c3 ?? belly;
          if (q[0] > 0.3 && q[2] > 0.35 && Math.abs(q[1]) < 0.45 && frac(q[1] * 3.2 + 0.5) < 0.34) return c2; // M i pannan
          if (Math.abs(q[1]) > 0.7 && q[2] < 0.25 && frac(q[2] * 3) < 0.4) return c2;                     // kindränder
          return q[2] < -0.45 && q[0] > 0 ? (C.c3 ?? belly) : c;
        }
        if (torso) {
          if (C.c3 && (part === 'chest' && q[0] > 0.3 && q[2] < 0.35 || part === 'neck' && q[2] < 0.1)) return C.c3;
          if (bw < -0.5) return belly;
          if (frac(bu * 3.1 + bw * 0.25 + hash(Math.round(bu * 6), 1, 5) * 0.15) < 0.32 && bw > -0.3) return c2;
          return c;
        }
        if (leg) return (C.c3 && (tt > 0.6 || part !== 'leg')) ? C.c3 : frac(tt * 2.6) < 0.3 ? c2 : c;
        if (part === 'tail' || part === 'tailtip') { const s = m[0] * 0.9 + m[2] * 0.9; return part === 'tailtip' ? c2 : frac(s * 0.45) < 0.4 ? c2 : c; }
        return c;
      }
      case 'tortie': {
        if (part === 'ear-in') return pink;
        const cell = hash(Math.floor(m[0] / 1.7 + 50), Math.floor(m[2] / 1.7 + 50), Math.floor(m[1] / 2.2 + 7));
        if (part === 'snout') return q[2] < 0 ? c3 : c;
        if (part === 'head') return q[1] > 0.15 ? c2 : c;
        return cell < 0.4 ? c : cell < 0.75 ? c2 : cell < 0.85 ? c3 : mix(c, c2, 0.5);
      }
      case 'tux': {
        if (part === 'snout') return q[2] < 0.35 ? c2 : c;
        if (part === 'head') return q[0] > 0.55 && Math.abs(q[1]) < 0.2 && q[2] < 0.3 ? c2 : c;
        if (part === 'chest' && q[0] > 0.2 && q[2] < 0.5) return c2;
        if (part === 'neck' && q[2] < 0) return c2;
        if (torso && bw < -0.55) return c2;
        if (leg && (tt > 0.55 || part !== 'leg')) return c2;
        return c;
      }
      case 'points': {
        const pt = c2;
        if (part === 'ear') return pt;
        if (part === 'snout') return pt;
        if (part === 'head') return q[0] > 0.5 ? mix(pt, c, clampT((0.95 - q[0]) * 2.5)) : mix(c, pt, 0.12);
        if (leg) return mix(c, pt, Math.min(1, 0.35 + tt));
        if (part === 'tail' || part === 'tailtip') return pt;
        if (torso) return bw > 0.3 ? mix(c, pt, 0.18) : c;
        return c;
      }
      case 'saddle': {
        if (part === 'ear') return mix(c2, c, 0.2);
        if (part === 'snout') return q[0] > -0.2 ? c2 : mix(c, c2, 0.5);
        if (part === 'head') return q[2] > 0.5 && q[0] < 0.3 ? mix(c, c2, 0.55) : q[0] > 0.6 && q[2] > -0.1 ? mix(c, c2, 0.4) : c;
        if (torso) return bw > 0.05 && bu > -0.35 && bu < 1.05 && part !== 'chest' && part !== 'haunch' ? c2 : (part === 'chest' && bw > 0.55 ? c2 : c);
        if (part === 'tail' || part === 'tailtip') return (m[2] > 0 && hash(i, j, 3) < 0.6) || part === 'tailtip' ? c2 : c;
        if (leg) return mix(c, 0xe0b070, 0.2);
        return c;
      }
      case 'husky': {
        if (part === 'ear') return c;
        if (part === 'snout') return c2;
        if (part === 'head') {
          if (q[0] > 0.45 && q[2] > 0.15 && q[2] < 0.55 && Math.abs(q[1]) > 0.2 && Math.abs(q[1]) < 0.55) return c2; // ögonbryn
          return q[2] > 0.2 || q[0] < -0.2 ? c : c2;
        }
        if (torso) return bw > -0.1 && part !== 'chest' ? c : part === 'chest' && q[0] < 0 && q[2] > 0.3 ? c : c2;
        if (part === 'tail') return m[2] > 0 && q[2] > -0.2 ? c : c2;
        if (part === 'tailtip') return c2;
        if (leg) return c2;
        return c;
      }
      case 'collie': {
        if (part === 'snout') return c2;
        if (part === 'head') return (Math.abs(q[1]) < 0.22 && q[0] > 0.2) ? c2 : c;
        if (part === 'neck') return c2;
        if (part === 'chest') return q[0] > 0.2 && q[2] < 0.6 ? c2 : c;
        if (torso) return bw < -0.6 ? c2 : c;
        if (leg) return tt > 0.45 || part !== 'leg' ? c2 : c;
        if (part === 'tailtip') return c2;
        return c;
      }
      case 'jack': {
        if (part === 'ear') return c2;
        if (part === 'head') return (q[0] > 0.55 && Math.abs(q[1]) < 0.35) || q[2] < -0.5 ? c : c2;
        if (part === 'snout') return c;
        if (torso) return (bu < 0.28 && bw > 0.1) ? c2 : c;
        if (part === 'tail') return c2;
        return c;
      }
      case 'corgi': {
        if (part === 'ear') return c;
        if (part === 'snout') return c2;
        if (part === 'head') return (Math.abs(q[1]) < 0.18 && q[0] > 0.3) || q[2] < -0.35 ? c2 : c;
        if (part === 'neck') return q[2] < 0.3 ? c2 : c;
        if (part === 'chest') return q[0] > 0.25 || q[2] < -0.2 ? c2 : c;
        if (torso) return bw < -0.35 ? c2 : c;
        if (leg) return c2;
        return c;
      }
      case 'mask': {
        if (part === 'ear') return c2;
        if (part === 'snout') return c2;
        if (part === 'head') return q[0] > 0.72 ? mix(c, c2, 0.6) : (q[0] > 0.45 && q[2] > 0.3 && frac(q[2] * 4) < 0.3 ? mul(c, 0.8) : c);
        return c;
      }
      case 'bib': {
        if (part === 'ear') return mul(c, 0.82);
        if (part === 'snout') return q[2] < 0.3 || q[0] > 0.6 ? c2 : c;
        if (part === 'head') return Math.abs(q[1]) < 0.16 && q[0] > 0.55 ? c2 : c;
        if (part === 'chest') return q[0] > 0.35 && q[2] < 0.55 ? c2 : c;
        if (part === 'neck') return q[2] < -0.1 ? c2 : c;
        if (part === 'leg-paw' || (leg && tt > 0.8)) return c2;
        if (part === 'tailtip') return c2;
        return c;
      }
      case 'agouti': {
        if (part === 'puff') return q[2] > 0.35 ? c : 0xf4f2ec;
        if (part === 'ear') return mix(c, c2, 0.3);
        if (torso && bw < -0.45) return belly;
        if (part === 'snout' && q[2] < 0) return belly;
        const h = hash(i, j, 11);
        return h < 0.22 ? c2 : h < 0.3 ? mix(c, 0xe8d8b8, 0.4) : c;
      }
      case 'spots': {
        if (part === 'ear') return c2;
        if (part === 'puff') return c;
        if (part === 'head') return (q[0] > 0.1 && Math.abs(q[1]) > 0.42 && q[2] > -0.1 && q[2] < 0.55) ? c2 : c; // ögonringar
        if (part === 'snout') return q[2] > -0.1 && Math.abs(q[1]) < 0.5 ? c2 : c;                              // fjärilen
        if (torso) { if (bw > 0.55 && bu > 0.1 && bu < 0.95) return c2; const h = hash(Math.floor(m[0] / 1.5 + 30), Math.floor(m[2] / 1.4 + 30), Math.floor(m[1] / 1.5 + 30)); return h < 0.3 ? c2 : c; }
        return c;
      }
      case 'dutch': {
        if (part === 'ear') return c;
        if (part === 'puff') return c;
        if (part === 'head') return Math.abs(q[1]) < 0.22 && q[0] > 0.15 ? c2 : c;
        if (part === 'snout') return c2;
        if (part === 'neck') return c2;
        if (part === 'chest') return c2;
        if (part === 'foot') return q[0] > 0.3 ? c2 : c;
        if (part === 'leg' || part === 'leg-paw') return c2;
        return c;
      }
      default: { // solid
        if (part === 'ear') return sp === 'hund' ? mul(c, R.B.id === 'labrador' || R.B.id === 'golden' ? 0.88 : 0.92) : c;
        if (part === 'puff') return sp === 'kanin' ? mix(c, 0xffffff, 0.5) : c;
        if (part === 'mane') return mix(c, 0xf8e8c8, 0.25);
        if ((part === 'tail' || part === 'tailtip') && R.B.id === 'golden') return mix(c, 0xf4e0b0, 0.3);
        if (part === 'snout' && sp !== 'hund') return mix(c, 0xffffff, 0.2);
        if (R.curly && hash(i, j, 3) < 0.28) return mix(c, 0xb8a890, 0.35);
        return c;
      }
    }
  };
}
const clampT = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

// ======================================================================
//  Bildrutor, cache och ritning
// ======================================================================
const ANIM_OK = new Set(['idle', 'walk', 'run', 'sit', 'sleep', 'eat', 'play', 'poop', 'pee', 'love', 'happy', 'beg']);
// t (sekunder) → diskreta bildrutor. ph = djurets egen fas så att de inte blinkar i takt.
export function framesOf(pet, anim, t, sp) {
  const ph = strHash(pet?.id ?? pet?.name ?? pet?.breed ?? '') * 9.7;
  const T = (t || 0) + ph;
  const f = { step: 0, wag: 0, breath: 0, blink: false, chew: 0, alt: 0, nose: 0, ear: 0 };
  const blink = (T % 4.3) < 0.14 || ((T + 0.3) % 11.1) < 0.12;
  const breath = Math.floor(T / 1.15) % 2;
  switch (anim) {
    case 'walk': f.step = Math.floor(T * (sp === 'kanin' ? 7 : 8)) % 4; f.wag = Math.floor(T * 4) % 4; break;
    case 'run': f.step = Math.floor(T * (sp === 'kanin' ? 9 : 12)) % 4; f.wag = Math.floor(T * 6) % 4; break;
    case 'sleep': f.breath = Math.floor(T / 1.4) % 2; break;
    case 'eat': f.chew = Math.floor(T * 4.5) % 2; f.wag = Math.floor(T * 3) % 4; f.blink = blink; break;
    case 'play': f.step = Math.floor(T * 4.5) % 4; f.wag = Math.floor(T * 8) % 4; break;
    case 'poop': f.alt = Math.floor(T * 1.6) % 2; break;
    case 'pee': f.alt = Math.floor(T * 1.4) % 2; f.blink = blink; break;
    case 'happy': f.step = Math.floor(T * 6) % 4; f.wag = Math.floor(T * 10) % 4; break;
    case 'beg': f.alt = Math.floor(T * 2.5) % 2; f.wag = Math.floor(T * 6) % 4; f.blink = blink; break;
    case 'love': f.wag = Math.floor(T * 2) % 4; f.breath = breath; break;
    case 'sit': f.wag = sp === 'hund' ? Math.floor(T * 2.4) % 4 : Math.floor(T * 1.1) % 4; f.breath = breath; f.blink = blink; if (sp === 'kanin') { f.nose = Math.floor(T * 0.6) % 3 === 0 ? Math.floor(T * 7) % 2 : 0; f.ear = Math.floor(T * 0.37) % 4 === 1 ? 1 : 0; } break;
    default: // idle
      f.wag = sp === 'hund' ? Math.floor(T * 2.2) % 4 : Math.floor(T * 0.9) % 4;
      f.breath = breath; f.blink = blink;
      if (sp === 'kanin') { f.nose = Math.floor(T * 0.6) % 3 === 0 ? Math.floor(T * 7) % 2 : 0; f.ear = Math.floor(T * 0.37) % 4 === 1 ? 1 : 0; f.wag = 0; }
  }
  return f;
}
const fkey = (f) => `${f.step}${f.wag}${f.breath}${f.blink ? 1 : 0}${f.chew}${f.alt}${f.nose}${f.ear}`;

const CACHE = new Map();
const visKey = (pet) => `${pet?.species}|${pet?.breed}|${pet?.breed2 || ''}|${pet?.stage || 'vuxen'}|${pet?.sex || ''}|${pet?.seed ?? ''}`;

function build(pet, anim, dir, f) {
  const R = rigOf(pet);
  if (dir === 'down' || dir === 'up') {
    // fram-/bakifrån: kortare kropp och bredare djur (annars blir de smala pinnar)
    const D = STYLE.fb[R.sp];
    R.bodyL *= D.len; R.tW *= D.lat; R.hW *= D.hlat; R.snoutL *= D.snout; R.tailL *= D.tail;
  }
  const S = makeScene(dir);
  let P;
  if (R.sp === 'kanin') { P = rabbitPose(R, anim, f); buildRabbit(S, R, P); }
  else { P = quadPose(R, anim, f); buildQuad(S, R, P); }
  const spr = renderScene(S, coatFn(R, P, S));
  const nk = S.anchors.neck ? proj(S.W(S.anchors.neck)) : [0, -6];
  spr.neck = { x: Math.round(nk[0]), y: Math.floor(nk[1]) };
  // skuggans mått: fotavtrycket projicerat
  const len = R.sp === 'kanin' ? R.bodyL + R.tR * 2 : R.bodyL + R.tR * 1.6;
  const wid = R.tW * 2 + 0.6;
  const side = dir === 'left' || dir === 'right';
  const lyingish = anim === 'sleep';
  spr.shadow = side ? { rx: Math.max(3, Math.round(len / 2 + (lyingish ? 1 : 0))), ry: Math.max(1, Math.round(wid * 0.56 / 2 + 0.3)) }
    : { rx: Math.max(2, Math.round(wid / 2 + 0.5)), ry: Math.max(1, Math.round(len * 0.56 / 2)) };
  spr.lift = Math.round((P.lift || 0) * 0.83);
  return spr;
}
export function spriteOf(pet, anim, t, dir) {
  if (!ANIM_OK.has(anim)) anim = 'idle';
  if (!DIRS_OK.has(dir)) dir = 'down';
  const sp = SPECIES[pet?.species] ? pet.species : 'katt';
  const f = framesOf(pet, anim, t, sp);
  const key = visKey(pet) + '|' + anim + '|' + dir + '|' + fkey(f);
  let s = CACHE.get(key);
  if (!s) {
    s = build(pet, anim, dir, f);
    if (CACHE.size > 4000) CACHE.clear();
    CACHE.set(key, s);
  }
  return s;
}
const DIRS_OK = new Set(['down', 'up', 'left', 'right']);

function drawShadow(ctx, x, y, sh, lift) {
  const rx = Math.max(2, sh.rx - (lift > 1 ? 1 : 0)), ry = sh.ry;
  ctx.fillStyle = 'rgba(20,12,30,.24)';
  for (let r = -ry; r <= ry; r++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (r / (ry + 0.6)) ** 2)));
    if (w > 0) ctx.fillRect(x - w, y + r - 1, w * 2 + 1, 1);
  }
}
export function renderPet(ctx, x, y, pet, anim, t, dir) {
  const s = spriteOf(pet, anim, t, dir);
  drawShadow(ctx, x, y, s.shadow, s.lift);
  ctx.drawImage(s.cv, x + s.ox, y + s.oy);
}
export function spriteBox(pet, anim, dir, t = 0) {
  const s = spriteOf(pet, anim, t, dir);
  return { x0: s.ox, y0: s.oy, x1: s.ox + s.w, y1: s.oy + s.h };
}
export function neckOf(pet, anim, t, dir) { const s = spriteOf(pet, anim, t, dir); return { x: s.neck.x, y: s.neck.y }; }

export function renderIcon(ctx, x, y, pet, sc, W, H, opts = {}) {
  const anim = opts.anim || (pet?.species === 'kanin' ? 'idle' : 'sit');
  const s = spriteOf(pet, anim, opts.t ?? 0.5, opts.dir || 'down');
  const fx = Math.round(W / 2), fy = H - 2;
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  if (opts.shadow !== false) {
    ctx.fillStyle = 'rgba(20,12,30,.22)';
    const rx = s.shadow.rx + 1;
    ctx.fillRect(x + (fx - rx) * sc, y + (fy - 1) * sc, (rx * 2 + 1) * sc, 2 * sc);
  }
  ctx.drawImage(s.cv, x + (fx + s.ox) * sc, y + (fy + s.oy) * sc, s.w * sc, s.h * sc);
  ctx.imageSmoothingEnabled = smooth;
}
