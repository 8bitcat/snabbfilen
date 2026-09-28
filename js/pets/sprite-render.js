// Husdjursmotorn: varje djur är en liten 3D-docka av ellipsoider (kropp, bröst,
// huvud, nos, öron, svansbollar), trianglar (spetsiga öron) och pixelexakta
// streck (ben, tunna svansar). Dockan poseras per animation och bildruta,
// vrids mot riktningen (down/up/left/right) och "strålföljs" i en ortografisk
// kamera som tittar snett ovanifrån (samma vinkel för alla arter). Varje pixel
// får en ton ur pälsens palett (ljus/bas/skugga/djup) efter ljuset, mönstret
// (ränder, sadel, fläckar …) räknas i djurets egna koordinater så att det sitter
// still oavsett riktning. Sist: inre konturer där en del skymmer en annan,
// ögon/nos/mun som dekaler (bara om punkten syns) och en mörk yttre kontur.
// Resultatet cachas per (djur, animation, riktning, bildruta).
//
// Koordinater: modell (u framåt, v djurets vänster, w upp) i "pixlar".
// Värld: X höger, Y bort från kameran, Z upp. Skärm: sx = X, sy = −(Y·sin p + Z·cos p).
import { mix, mul, hash, bayer } from '../core/floor-pix.js';

// ---------------------------------------------------------------- vektorer
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const D2R = Math.PI / 180;

// ---------------------------------------------------------------- kamera
const PITCH = 34 * D2R, CP = Math.cos(PITCH), SP = Math.sin(PITCH);
const CAMF = [0, CP, -SP];              // in i bilden
const CAMU = [0, SP, CP];               // uppåt på skärmen
const LIGHT = nrm([-0.55, -0.5, 0.95]); // från vänster, framifrån, ovanifrån
export const CW = 64, CH = 56, AX = 32, AY = 46; // arbetsytan; fötternas mitt i pixel (AX, AY−1)/(AX, AY)
const proj = (P) => [P[0], -(P[1] * SP + P[2] * CP), P[1] * CP - P[2] * SP]; // → [sx, sy, djup]

const DIRV = {
  right: { F: [1, 0, 0], L: [0, 1, 0] },
  left: { F: [-1, 0, 0], L: [0, -1, 0] },
  down: { F: [0, -1, 0], L: [1, 0, 0] },
  up: { F: [0, 1, 0], L: [-1, 0, 0] },
};

// ---------------------------------------------------------------- färger
const lum = (c) => (((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11) / 255;
const RAMPS = new Map();
export function rampOf(c) {
  let r = RAMPS.get(c);
  if (r) return r;
  const L = lum(c);
  r = {
    hi: L > 0.86 ? mix(c, 0xffffff, 0.7) : mix(mul(c, 1.14), 0xfff4e2, L < 0.2 ? 0.2 : 0.14),
    base: c,
    lo: L > 0.86 ? mix(c, 0xa8a4c0, 0.32) : mix(mul(c, 0.76), 0x2a1f3a, 0.14),
    dk: L > 0.86 ? mix(c, 0x7a7494, 0.55) : mix(mul(c, 0.54), 0x1a1426, 0.24),
  };
  RAMPS.set(c, r);
  return r;
}
// ton ur ljuset; lätt dithring i övergångarna ger päls i stället för platta band
function toneOf(i, x, y, soft) {
  const d = soft ? (bayer(x, y) - 0.5) * 0.16 : 0;
  const v = i + d;
  return v > 0.6 ? 'hi' : v > 0.02 ? 'base' : v > -0.42 ? 'lo' : 'dk';
}

// ---------------------------------------------------------------- scenen
// En scen samlar primitiver i modellkoordinater och vet hur de vrids.
function makeScene(dir) {
  const { F, L } = DIRV[dir] || DIRV.down;
  const W = (m) => [m[0] * F[0] + m[1] * L[0], m[0] * F[1] + m[1] * L[1], m[2]];
  const toM = (p) => [dot(p, F), dot(p, L), p[2]];
  const S = { dir, F, L, W, toM, ells: [], tris: [], strokes: [], decals: [], anchors: {} };
  // ellipsoid: centrum c, radier [ru, rv, rw] längs axlarna ax (modellvektorer, ortonormala)
  S.ell = (c, r, part, o = {}) => {
    const ax = (o.ax || [[1, 0, 0], [0, 1, 0], [0, 0, 1]]).map(W);
    S.ells.push({ c: W(c), r, ax, part, grp: o.grp ?? GRP.body, fluff: o.fluff || 0, id: S.ells.length + 1 });
  };
  // ellipsoid utdragen mellan två punkter (t.ex. hals, lår, svansbitar)
  S.along = (p0, p1, rEnd, rSide, part, o = {}) => {
    const d = sub(p1, p0), len = Math.hypot(d[0], d[1], d[2]) || 0.001;
    const a = scl(d, 1 / len);
    let s = Math.abs(a[2]) < 0.9 ? nrm(cross([0, 0, 1], a)) : nrm(cross([0, 1, 0], a));
    const w = cross(a, s);
    S.ell(lerp(p0, p1, 0.5), [len / 2 + rEnd, rSide, o.rw ?? rSide], part, { ...o, ax: [a, s, w] });
  };
  // triangel (platt, dubbelsidig); front = modellriktningen som räknas som "insidan" (t.ex. örats insida)
  S.tri = (a, b, c, part, o = {}) => S.tris.push({ v: [W(a), W(b), W(c)], part, grp: o.grp ?? GRP.ear, front: o.front ? W(o.front) : null, inner: o.inner || 0 });
  // streck med fast pixelbredd (ben): p0 uppe, p1 nere
  S.stroke = (p0, p1, w, part, o = {}) => S.strokes.push({ a: W(p0), b: W(p1), w, part, grp: o.grp ?? GRP.leg0, far: !!o.far, paw: o.paw || 0, pawDir: o.pawDir ? W(o.pawDir) : null });
  S.decal = (kind, p, o = {}) => S.decals.push({ kind, p: W(p), ...o });
  return S;
}
export const GRP = { body: 1, head: 2, leg0: 3, leg1: 4, leg2: 5, leg3: 6, tail: 7, ear: 8, ear2: 9, snout: 10, fx: 11 };

// ---------------------------------------------------------------- rastrering
function raster(S, coat) {
  const N = CW * CH;
  const col = new Int32Array(N).fill(-1), dep = new Float32Array(N).fill(1e9), grp = new Uint8Array(N);
  const set = (i, j, c, d, g) => {
    if (i < 0 || j < 0 || i >= CW || j >= CH) return;
    const k = j * CW + i;
    if (d >= dep[k]) return;
    dep[k] = d; col[k] = c; grp[k] = g;
  };
  const rayO = (i, j) => { const sx = i - AX, sy = j - AY + 0.5; return [sx, -sy * SP, -sy * CP]; };

  // ellipsoider
  for (const E of S.ells) {
    const [pcx, pcy] = proj(E.c);
    const rm = Math.max(E.r[0], E.r[1], E.r[2]) + 1;
    const d = E.ax.map((a, k) => dot(CAMF, a) / E.r[k]);
    const A = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    for (let j = Math.floor(AY + pcy - rm); j <= AY + pcy + rm; j++) for (let i = Math.floor(AX + pcx - rm); i <= AX + pcx + rm + 1; i++) {
      const O = sub(rayO(i, j), E.c);
      const o = E.ax.map((a, k) => dot(O, a) / E.r[k]);
      const B = o[0] * d[0] + o[1] * d[1] + o[2] * d[2];
      const C = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - 1;
      const disc = B * B - A * C;
      if (disc < 0) continue;
      const t = (-B - Math.sqrt(disc)) / A;
      const q = [o[0] + t * d[0], o[1] + t * d[1], o[2] + t * d[2]];
      const nW = nrm(add(add(scl(E.ax[0], q[0] / E.r[0]), scl(E.ax[1], q[1] / E.r[1])), scl(E.ax[2], q[2] / E.r[2])));
      const P = add(rayO(i, j), scl(CAMF, t));
      const c = coat(E.part, S.toM(P), S.toM(nW), q, i, j);
      if (c == null) continue;
      const k = j * CW + i;
      if (t >= dep[k]) continue;
      const tone = toneOf(dot(nW, LIGHT), i, j, true);
      set(i, j, typeof c === 'number' ? rampOf(c)[tone] : c.flat, t, E.grp);
    }
  }
  // trianglar (Möller–Trumbore)
  for (const T of S.tris) {
    const [v0, v1, v2] = T.v;
    const e1 = sub(v1, v0), e2 = sub(v2, v0);
    const h = cross(CAMF, e2), a = dot(e1, h);
    if (Math.abs(a) < 1e-6) continue;
    const f = 1 / a;
    let nW = nrm(cross(e1, e2));
    const frontFacing = T.front ? dot(nW, T.front) * (dot(nW, CAMF) < 0 ? 1 : -1) > 0 : false;
    if (dot(nW, CAMF) > 0) nW = scl(nW, -1);
    const ps = T.v.map(proj);
    const x0 = Math.floor(Math.min(ps[0][0], ps[1][0], ps[2][0])) - 1, x1 = Math.ceil(Math.max(ps[0][0], ps[1][0], ps[2][0])) + 1;
    const y0 = Math.floor(Math.min(ps[0][1], ps[1][1], ps[2][1])) - 1, y1 = Math.ceil(Math.max(ps[0][1], ps[1][1], ps[2][1])) + 1;
    for (let j = AY + y0; j <= AY + y1; j++) for (let i = AX + x0; i <= AX + x1; i++) {
      const O = rayO(i, j), s = sub(O, v0), u = f * dot(s, h);
      if (u < 0 || u > 1) continue;
      const q = cross(s, e1), v = f * dot(CAMF, q);
      if (v < 0 || u + v > 1) continue;
      const t = f * dot(e2, q);
      const w0 = 1 - u - v;
      // insidan: en mindre triangel innanför kanterna (rosa i öronen)
      const inner = frontFacing && T.inner && Math.min(w0, u, v) > T.inner * 0.33 && w0 < 0.8;
      const c = coat(inner ? T.part + '-in' : T.part, S.toM(add(O, scl(CAMF, t))), S.toM(nW), [w0, u, v], i, j);
      if (c == null) continue;
      const tone = toneOf(dot(nW, LIGHT) * 0.8 + 0.1, i, j, false);
      set(i, j, typeof c === 'number' ? rampOf(c)[tone] : c.flat, t - 0.05, T.grp);
    }
  }
  // streck (ben): fast bredd, rader/kolumner i pixelsteg
  for (const L of S.strokes) {
    const A = proj(L.a), B = proj(L.b);
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 1.5));
    const vert = Math.abs(dy) >= Math.abs(dx);
    for (let k = 0; k <= n; k++) {
      const tt = k / n, sx = A[0] + dx * tt, sy = A[1] + dy * tt, d = A[2] + (B[2] - A[2]) * tt;
      const Pm = S.toM(lerp(L.a, L.b, tt));
      const c0 = coat(L.part, Pm, [0, 0, 0], [0, tt, 0], 0, 0);
      if (c0 == null) continue;
      const R = rampOf(typeof c0 === 'number' ? c0 : 0x888888);
      if (vert) {
        const j = AY + Math.floor(sy), i0 = AX + Math.round(sx - (L.w - 1) / 2);
        for (let q = 0; q < L.w; q++) {
          const tone = L.far ? (q === 0 ? 'lo' : 'dk') : L.w === 1 ? 'base' : q === 0 ? 'hi' : q === L.w - 1 ? 'lo' : 'base';
          set(i0 + q, j, R[L.w > 2 && q === 0 && !L.far ? 'base' : tone], d, L.grp);
        }
      } else {
        const i = AX + Math.round(sx), j0 = AY + Math.floor(sy - (L.w - 1) / 2);
        for (let q = 0; q < L.w; q++) set(i, j0 + q, R[L.far ? 'lo' : q === 0 ? 'hi' : 'base'], d, L.grp);
      }
    }
    // tass längst ner
    if (L.paw) {
      const c0 = coat(L.part + '-paw', S.toM(L.b), [0, 0, 0], [0, 1, 0], 0, 0);
      const R = rampOf(typeof c0 === 'number' ? c0 : 0x888888);
      const j = AY + Math.floor(B[1]), i0 = AX + Math.round(B[0] - (L.w - 1) / 2);
      let ext = 0;
      if (L.pawDir) { const pd = proj(add(L.b, L.pawDir)); ext = Math.round(pd[0] - B[0]); }
      const a0 = Math.min(i0, i0 + ext), a1 = Math.max(i0 + L.w - 1, i0 + L.w - 1 + ext);
      for (let i = a0; i <= a1; i++) set(i, j, R[L.far ? 'lo' : 'base'], B[2] - 0.2, L.grp);
    }
  }
  return { col, dep, grp };
}

// inre konturer: där något närmare skymmer en annan del blir den bakre pixeln mörkare
function innerLines(R) {
  const { col, dep, grp } = R;
  const out = Int32Array.from(col);
  for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
    const k = j * CW + i;
    if (col[k] < 0 || grp[k] === GRP.fx) continue;
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
      const x = i + dx, y = j + dy;
      if (x < 0 || y < 0 || x >= CW || y >= CH) continue;
      const q = y * CW + x;
      if (col[q] < 0 || grp[q] === grp[k] || grp[q] === GRP.fx) continue;
      if (dep[q] < dep[k] - 1.1) { out[k] = mix(mul(col[k], 0.62), 0x1c1428, 0.2); break; }
    }
  }
  R.col = out;
}

// yttre kontur som på folket: mörk version av grannpixeln
function outline(R) {
  const { col } = R;
  const out = Int32Array.from(col);
  for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
    const k = j * CW + i;
    if (col[k] >= 0) continue;
    let best = -1;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const x = i + dx, y = j + dy;
      if (x < 0 || y < 0 || x >= CW || y >= CH) continue;
      const q = y * CW + x;
      if (col[q] >= 0) { best = col[q]; if (dy === -1) break; }
    }
    if (best < 0) continue;
    const r = (best >> 16) & 255, g = (best >> 8) & 255, b = best & 255;
    out[k] = (((r * 0.28 + 14) | 0) << 16) | (((g * 0.24 + 10) | 0) << 8) | ((b * 0.3 + 20) | 0);
  }
  R.col = out;
}

// dekaler (ögon, nos, mun, tunga …) – bara där punkten faktiskt syns
function decals(S, R) {
  const { col, dep } = R;
  const put = (i, j, c) => { if (i >= 0 && j >= 0 && i < CW && j < CH && c != null) col[j * CW + i] = c; };
  const visible = (i, j, d, tol = 1.2) => i >= 0 && j >= 0 && i < CW && j < CH && col[j * CW + i] >= 0 && Math.abs(dep[j * CW + i] - d) < tol;
  for (const D of S.decals) {
    const [sx, sy, d] = proj(D.p);
    const i = D.ix != null ? AX + D.ix : AX + Math.round(sx), j = D.iy != null ? AY + D.iy : AY + Math.floor(sy);
    if (!D.force && !visible(i, j, d, D.tol || 1.3)) continue;
    D.draw(put, i, j, col);
  }
}

// ---------------------------------------------------------------- canvas
function toCanvas(R) {
  let x0 = CW, y0 = CH, x1 = -1, y1 = -1;
  for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) if (R.col[j * CW + i] >= 0) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
  if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  const img = cx.createImageData(w, h), dd = img.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = R.col[(j + y0) * CW + i + x0];
    if (c < 0) continue;
    const p = (j * w + i) * 4;
    dd[p] = (c >> 16) & 255; dd[p + 1] = (c >> 8) & 255; dd[p + 2] = c & 255; dd[p + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  return { cv, ox: x0 - AX, oy: y0 - AY, w, h };
}

export function renderScene(S, coat) {
  const R = raster(S, coat);
  innerLines(R);
  decals(S, R);
  outline(R);
  return toCanvas(R);
}

export { add, sub, scl, dot, cross, nrm, lerp, clamp, D2R, proj, makeScene, DIRV, lum };
