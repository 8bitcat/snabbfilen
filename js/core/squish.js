// SQUISH-MOTORN – klämbara leksaker (squishies) i pixelkorn.
//
// Varje leksak har förberäknade klämsteg (js/data/toys.js målar om formen för varje
// steg – ingen skalning, inga halvpixlar): steg 0 = vila, 1 … 7 = allt mer hopklämd
// (lägre och bredare, buktar ut), −1 … −3 = utsträckt (smalare och högre) när den
// studsar tillbaka. Bildrutorna cachas som canvasar, så draw() är billig.
//
//   Kläm (press)  → den sjunker mjukt ihop på ~0,2 s, ansiktet kniper ihop (>o<),
//                   kinderna blossar, glittret gnistrar och ett mjukt squish-pip hörs.
//   Släpp (release) → dämpad fjäderstuds tillbaka (2–3 svängningar: utsträckt, lite
//                   klämd, utsträckt …), ansiktet blir glatt (^▽^) en stund, ett litet
//                   plopp och ett hjärta som stiger.
//   Vila           → blinkar ibland.
//
// ============================== API ==============================
// createSquishy(id, opts = {}) → squishy
//   opts: { size: 1|2|3 (större, ritad om i samma pixelkorn), ljud: true, hjarta: true,
//           maxHold: 8 (s – släpper av sig själv om scenen aldrig får pointerup) }
//   squishy.update(dt)        – dt i sekunder (tål långa dt, delar upp i småsteg)
//   squishy.draw(ctx, x, y)   – (x, y) = fotpunkten, mitten nertill (som drawToy)
//   squishy.press()           – börja klämma (ignoreras om leksaken inte är klämbar)
//   squishy.release()         – släpp
//   squishy.pressed           – true medan man klämmer
//   squishy.step              – aktuellt klämsteg (−3 … 7)
//   squishy.amount            – kläm-mängden (0 = vila, 1 = helt hopklämd, < 0 = utsträckt)
//   squishy.box()             – { x0, y0, x1, y1 } relativt fotpunkten (aktuell bildruta)
//   squishy.hit(dx, dy)       – true om punkten (relativt fotpunkten) träffar leksaken
//   squishy.squishable        – false för leksaker som inte går att klämma (bilar, pussel …)
//   squishy._debug            – { state(), set(amount, vel), face(f), sound(kind) }
// squishPip(kind = 'in', pitch = 1) – bara ljudet ('in' = kläm, 'ut' = släpp)
// ==================================================================
// Ljudet följer spelets mute (isMuted) och webbläsarens gestregel (audioContext() är null
// tills någon har pekat på sidan) precis som js/core/sound.js – och spelas med samma
// mastervolym (0,5).
import { toyOf, toyFrame, toyFx, SQUISH_STEPS, STRETCH_STEPS } from '../data/toys.js';
import { isMuted, audioContext } from './sound.js';

const SQ = SQUISH_STEPS, ST = STRETCH_STEPS;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------- fjädrarna ----------
// Klämning: kraftigt dämpad (ζ ≈ 0,8) – sjunker ihop mjukt utan att studsa.
// Släpp: svagt dämpad (ζ ≈ 0,2, period ≈ 0,3 s) – 2–3 synliga svängningar.
const PRESS = { w: 17, z: 0.8 };
const BOUNCE = { w: 21, z: 0.19 };

// ---------- ljudet ----------
let noiseBuf = null, lastPip = 0;
function noise(c) {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const n = Math.floor(c.sampleRate * 0.25);
  noiseBuf = c.createBuffer(1, n, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < n; i++) { b = b * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = b; }   // mjukt (lågpassat) brus
  return noiseBuf;
}
// Ett kort mjukt squish-pip: luft som pressas ut (filtrerat brus) + ett litet pip som
// glider uppåt. 'ut' = ett mjukt plopp när den studsar tillbaka. pitch < 1 = större leksak.
export function squishPip(kind = 'in', pitch = 1) {
  if (isMuted()) return;
  const c = audioContext();
  if (!c) return;
  const wall = performance.now() / 1000;               // väggklocka: currentTime står still i en pausad kontext
  if (wall - lastPip < 0.045) return;
  lastPip = wall;
  const now = c.currentTime;
  try {
    const out = c.createGain();
    out.gain.value = 0.5;                                   // samma mastervolym som sound.js
    out.connect(c.destination);
    const jitter = 1 + (Math.random() - 0.5) * 0.08;
    if (kind === 'in') {
      // luften: brus genom ett bandpass som sjunker
      const src = c.createBufferSource(); src.buffer = noise(c);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(2200 * pitch, now); bp.frequency.exponentialRampToValueAtTime(700 * pitch, now + 0.14);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.09, now + 0.02); g.gain.exponentialRampToValueAtTime(0.0008, now + 0.16);
      src.connect(bp); bp.connect(g); g.connect(out);
      src.start(now); src.stop(now + 0.18);
      // pipet
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'sine';
      const f0 = 820 * pitch * jitter;
      o.frequency.setValueAtTime(f0, now + 0.01); o.frequency.exponentialRampToValueAtTime(f0 * 1.55, now + 0.07); o.frequency.exponentialRampToValueAtTime(f0 * 1.3, now + 0.12);
      og.gain.setValueAtTime(0.0001, now); og.gain.exponentialRampToValueAtTime(0.07, now + 0.018); og.gain.exponentialRampToValueAtTime(0.0008, now + 0.13);
      o.connect(og); og.connect(out);
      o.start(now); o.stop(now + 0.15);
    } else {
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'sine';
      const f0 = 520 * pitch * jitter;
      o.frequency.setValueAtTime(f0, now); o.frequency.exponentialRampToValueAtTime(f0 * 1.9, now + 0.06);
      og.gain.setValueAtTime(0.0001, now); og.gain.exponentialRampToValueAtTime(0.05, now + 0.01); og.gain.exponentialRampToValueAtTime(0.0008, now + 0.09);
      o.connect(og); og.connect(out);
      o.start(now); o.stop(now + 0.11);
    }
    setTimeout(() => { try { out.disconnect(); } catch { /* ok */ } }, 500);
  } catch { /* ljud är aldrig värt en krasch */ }
}

// ---------- små partiklar (gnistor, klämstreck, hjärta) ----------
const SPARK = ['#ffffff', '#fffbe0', '#fff0a0'];
function dot(ctx, x, y, col, a) { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
const HEART = ['.pp.pp.', 'pPppppp', 'ppppppp', '.ppppp.', '..ppp..', '...p...'];

export function createSquishy(id, opts = {}) {
  const def = toyOf(id);
  const size = clamp(opts.size | 0 || 1, 1, 3);
  const ljud = opts.ljud !== false, hjarta = opts.hjarta !== false;
  const maxHold = opts.maxHold ?? 8;                         // släpps av sig själv efter så många sekunder
  const squishable = !!def?.squish;
  const glitter = def?.grupp === 'glitter' || id === 'kattass';
  // tonhöjd efter storlek: små leksaker piper ljusare
  const pitch = def ? clamp(1.25 - (def.bw * def.bh) / 900, 0.7, 1.2) / Math.sqrt(size) : 1;
  let s = 0, v = 0, pressed = false, pressT = 0, gladT = 0, t = 0;
  let blinkIn = 1.5 + Math.random() * 3, blinkT = 0, faceLock = null;
  const parts = [];            // { x, y, vx, vy, life, max, kind }
  let lastStep = 0;

  function faceNow() {
    if (faceLock) return faceLock;
    if (pressed) return 'klamd';
    if (gladT > 0) return 'glad';
    if (blinkT > 0) return 'blink';
    return 'vila';
  }
  const stepOf = (a) => (a >= 0 ? clamp(Math.round(a * SQ), 0, SQ) : clamp(Math.round(a * SQ), -ST, 0));
  function frame() { return toyFrame(id, squishable ? stepOf(s) : 0, faceNow(), size); }

  function burst(n) {
    const f = frame();
    if (!f) return;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.1 + 0.8 * Math.random()) - (Math.random() < 0.3 ? Math.PI * 0.1 : 0);
      const sp = 22 + Math.random() * 30;
      const r = 0.5 + 0.5 * Math.random();
      parts.push({
        x: (Math.random() - 0.5) * f.w * 0.9, y: f.y0 + f.h * (0.25 + 0.5 * Math.random()),
        vx: Math.cos(a) * sp * 1.2, vy: Math.sin(a) * sp, life: 0.45 + 0.35 * r, max: 0.45 + 0.35 * r, kind: 'gnista',
        big: Math.random() < 0.45, col: SPARK[i % SPARK.length],
      });
    }
  }
  function marks() {
    const f = frame();
    if (!f) return;
    for (const side of [-1, 1]) parts.push({ side, x: 0, y: 0, vx: 0, vy: 0, life: 0.22, max: 0.22, kind: 'streck', w: f.w, y0: f.y0, h: f.h });
  }

  function press() {
    if (!squishable || pressed) return;
    pressed = true; pressT = 0;
    if (ljud) squishPip('in', pitch);
    marks();
    if (glitter) burst(10);
  }
  function release() {
    if (!pressed) return;
    pressed = false;
    gladT = 0.9;
    if (ljud) squishPip('ut', pitch);
    if (hjarta && pressT > 0.12) {
      const f = toyFrame(id, -ST, 'glad', size);            // ovanför den utsträckta formen
      parts.push({ x: 0, y: (f ? f.y0 : -14) - 1, vx: 0, vy: -16, life: 0.9, max: 0.9, kind: 'hjarta' });
    }
    if (glitter) burst(6);
  }
  function update(dt) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.25);
    t += dt;
    // fjädern i små steg (stabil även vid ryckig bildfrekvens)
    let left = dt;
    while (left > 0) {
      const h = Math.min(left, 1 / 240);
      left -= h;
      if (!squishable) break;
      const P = pressed ? PRESS : BOUNCE, target = pressed ? 1 : 0;
      const acc = -P.w * P.w * (s - target) - 2 * P.z * P.w * v;
      v += acc * h; s += v * h;
    }
    if (!pressed && Math.abs(s) < 0.004 && Math.abs(v) < 0.05) { s = 0; v = 0; }
    s = clamp(s, -0.6, 1.08);
    if (pressed) { pressT += dt; if (pressT > maxHold) release(); }   // tappat släppet (pekaren utanför bild, dialog …)
    if (gladT > 0) gladT -= dt;
    // blinka ibland i vila
    if (blinkT > 0) blinkT -= dt;
    else if (!pressed && gladT <= 0) { blinkIn -= dt; if (blinkIn <= 0) { blinkT = 0.13; blinkIn = 2.5 + Math.random() * 4; } }
    // gnistor medan man klämmer en glittrig
    const st = stepOf(s);
    if (glitter && pressed && Math.random() < dt * 6) burst(1);
    if (glitter && !pressed && st !== lastStep && st < 0) burst(1);
    lastStep = st;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'gnista') { p.vy += 40 * dt; p.vx *= 1 - dt * 2.5; }
      if (p.kind === 'hjarta') p.vy *= 1 - dt * 1.5;
    }
  }
  function draw(ctx, x, y) {
    const f = frame();
    if (!f) return;
    x = Math.round(x); y = Math.round(y);
    ctx.drawImage(f.c, x + f.x0, y + f.y0);
    toyFx(ctx, f, x, y, t, id, pressed ? 3 : gladT > 0 ? 2 : 1);
    if (!parts.length) return;
    ctx.save();
    for (const p of parts) {
      const k = p.life / p.max;
      if (p.kind === 'gnista') {
        const X = x + Math.round(p.x), Y = y + Math.round(p.y);
        dot(ctx, X, Y, p.col, Math.min(1, k * 1.6));
        if (p.big && k > 0.45) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(ctx, X + dx, Y + dy, p.col, k * 0.7);
        if (p.big && k > 0.75) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) dot(ctx, X + dx, Y + dy, p.col, k * 0.4);
      } else if (p.kind === 'streck') {
        // tre små klämstreck på varje sida, i mitthöjd
        const mid = y + p.y0 + Math.round(p.h * 0.5), ex = p.side < 0 ? x + f.x0 - 2 : x + f.x0 + f.w + 1;
        const a = Math.min(1, k * 2.2), o = Math.round((1 - k) * 2) * p.side;
        for (const [dx, dy] of [[0, -3], [p.side, -4], [0, 0], [p.side, 0], [p.side * 2, 0], [0, 3], [p.side, 4]]) dot(ctx, ex + dx + o, mid + dy, '#ffffff', a * 0.9);
      } else if (p.kind === 'hjarta') {
        const X = x + Math.round(p.x) - 3, Y = y + Math.round(p.y) - 6;
        const a = Math.min(1, k * 2);
        for (let j = 0; j < HEART.length; j++) for (let i = 0; i < HEART[j].length; i++) {
          const ch = HEART[j][i];
          if (ch === '.') continue;
          dot(ctx, X + i, Y + j, ch === 'P' ? '#ffd0e0' : '#ff6a98', a);
        }
      }
    }
    ctx.restore();
  }
  function box() {
    const f = frame();
    return f ? { x0: f.x0, y0: f.y0, x1: f.x0 + f.w, y1: f.y0 + f.h - 1 } : { x0: -6, y0: -12, x1: 6, y1: 0 };
  }
  function hit(dx, dy) {
    const f = toyFrame(id, 0, 'vila', size);
    if (!f) return false;
    // lite generös klickyta: hela vilobildens ruta räknas (lättare att träffa på mobilen)
    const X = Math.floor(dx) - f.x0, Y = Math.floor(dy) - f.y0;
    if (X < -1 || Y < -1 || X > f.w || Y > f.h) return false;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const xx = X + i, yy = Y + j;
      if (xx >= 0 && yy >= 0 && xx < f.w && yy < f.h && f.mask[yy * f.w + xx]) return true;
    }
    return false;
  }
  return {
    id, size, squishable,
    update, draw, press, release, box, hit,
    get pressed() { return pressed; },
    get step() { return squishable ? stepOf(s) : 0; },
    get amount() { return s; },
    _debug: {
      state: () => ({ id, s: +s.toFixed(3), v: +v.toFixed(3), step: squishable ? stepOf(s) : 0, face: faceNow(), pressed, parts: parts.length, t: +t.toFixed(2) }),
      set: (amount, vel = 0) => { s = +amount || 0; v = +vel || 0; },
      face: (f) => { faceLock = f || null; },
      sound: (kind = 'in') => squishPip(kind, pitch),
    },
  };
}
