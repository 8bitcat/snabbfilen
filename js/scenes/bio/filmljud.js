// Filmljuden på BIO PIXEL: effekterna och sorlet i filmerna (fotbollsfilmerna först) – syntade i
// Web Audio, inga ljudfiler (spelet har bara fria CC0-ljud och inga inspelade läktare).
//   filmSfx(kind)  en effekt: 'vissla' (domaren), 'slutsignal' (tre signaler), 'spark' (skottet),
//                  'nat' (bollen i nätet), 'mal' (läktaren exploderar), 'heja' (jubel och applåder),
//                  'oj' (publikens "oooh"), 'skratt', 'aww', 'grat', 'pokal' (fanfaren),
//                  anime-skotten: 'cutin' (närbilden smäller upp), 'swoosh' (bollen i slow
//                  motion), 'boom' (träffen – nätet eller handskarna)
//   filmAmb(key)   sorlet under en tagning: 'publik' (läktaren), 'regn' – null tonar ut
// Tyst när ljudet är av (mute) och före första pekningen. Tidpunkterna står i filmerna (shot.sfx,
// shot.amb – fotboll.js) och spelas av salongen (shop-bio.js) och bioartefakten.
import { audioContext, isMuted } from '../../core/sound.js';

const LEVEL = 0.4;
let out = null, noise = null, brown = null;
function ctxOut() {
  if (isMuted()) return null;
  const ctx = audioContext();
  if (!ctx) return null;
  if (!out || out.context !== ctx) {
    out = ctx.createGain(); out.gain.value = LEVEL; out.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    brown = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const b = brown.getChannelData(0); let last = 0;
    for (let i = 0; i < b.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
  }
  return ctx;
}
const end = (n) => { n.onended = () => { try { n.disconnect(); } catch { /* ok */ } }; return n; };
function env(ctx, t, peak, a, hold, rel) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  return g;
}
function noiseBand(ctx, t, { buf = noise, type = 'bandpass', f = 1000, f2 = null, q = 1, peak = 0.3, a = 0.01, hold = 0, rel = 0.2, dest = out }) {
  const n = end(ctx.createBufferSource()); n.buffer = buf; n.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + hold + rel);
  const g = env(ctx, t, peak, a, hold, rel);
  n.connect(fl); fl.connect(g); g.connect(dest);
  n.start(t, Math.random() * 1.5); n.stop(t + a + hold + rel + 0.05);
}
function tone(ctx, t, f, dur, { type = 'sine', peak = 0.3, f2 = null, a = 0.005 } = {}) {
  const o = end(ctx.createOscillator()); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = env(ctx, t, peak, a, 0, dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  return o;
}
// domarens visselpipa: två höga toner med snabb drill (kulan i pipan)
function whistle(ctx, t, dur) {
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.02); g.gain.setValueAtTime(0.16, t + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const am = ctx.createGain(); am.gain.value = 0.6;
  const lfo = end(ctx.createOscillator()); lfo.frequency.value = 27; const lg = ctx.createGain(); lg.gain.value = 0.4; lfo.connect(lg); lg.connect(am.gain);
  for (const f of [2870, 3060]) { const o = end(ctx.createOscillator()); o.type = 'sine'; o.frequency.value = f; o.connect(am); o.start(t); o.stop(t + dur + 0.02); }
  am.connect(g); g.connect(out); lfo.start(t); lfo.stop(t + dur + 0.02);
}
// applåder: många korta klapp (brus i 2 kHz-trakten) slumpade över tiden
function applause(ctx, t, dur, density = 40, peak = 0.12) {
  const n = Math.round(dur * density);
  for (let i = 0; i < n; i++) {
    const at = t + Math.random() * dur, fade = 1 - (at - t) / dur;
    noiseBand(ctx, at, { f: 1400 + Math.random() * 1800, q: 1.4, peak: peak * (0.5 + Math.random() * 0.5) * (0.4 + 0.6 * fade), a: 0.002, rel: 0.05 });
  }
}
// läktarens vrål: två band av brunt brus som sväller och klingar av, plus applåder
function roar(ctx, t, size = 1) {
  noiseBand(ctx, t, { buf: brown, f: 650, q: 0.7, peak: 0.55 * size, a: 0.3, hold: 1.2 * size, rel: 1.4 });
  noiseBand(ctx, t, { buf: noise, f: 1500, q: 0.9, peak: 0.12 * size, a: 0.25, hold: 1 * size, rel: 1.2 });
  applause(ctx, t + 0.4, 2.2 * size, 36, 0.1 * size);
}

export function filmSfx(kind) {
  const ctx = ctxOut();
  if (!ctx) return;
  const t = ctx.currentTime + 0.01;
  switch (kind) {
    case 'vissla': whistle(ctx, t, 0.5); break;
    case 'slutsignal': whistle(ctx, t, 0.28); whistle(ctx, t + 0.4, 0.28); whistle(ctx, t + 0.8, 1.0); break;
    case 'spark': tone(ctx, t, 130, 0.12, { peak: 0.6, f2: 48 }); noiseBand(ctx, t, { type: 'highpass', f: 2200, peak: 0.25, rel: 0.03 }); break;
    case 'nat': noiseBand(ctx, t, { f: 3200, f2: 1400, q: 1.2, peak: 0.16, a: 0.02, rel: 0.4 }); break;
    case 'mal': roar(ctx, t, 1); break;
    case 'heja': roar(ctx, t, 0.6); break;
    case 'oj': noiseBand(ctx, t, { buf: brown, f: 900, f2: 420, q: 2.2, peak: 0.45, a: 0.25, hold: 0.3, rel: 0.7 }); break;
    case 'skratt': for (let i = 0; i < 7; i++) noiseBand(ctx, t + i * 0.13 + (i > 3 ? 0.12 : 0), { buf: brown, f: 1050 + (i % 2) * 120, q: 3, peak: 0.35, a: 0.01, rel: 0.09 }); break;
    case 'aww': noiseBand(ctx, t, { buf: brown, f: 560, f2: 820, q: 3, peak: 0.35, a: 0.3, hold: 0.2, rel: 0.6 }); break;
    case 'grat': noiseBand(ctx, t, { type: 'highpass', f: 2500, peak: 0.08, rel: 0.12 }); noiseBand(ctx, t + 0.3, { type: 'highpass', f: 2500, peak: 0.06, rel: 0.12 }); break;
    case 'cutin': // brus som sveper uppåt + ett ljust "tjing" (som när en närbild smäller upp i en anime)
      noiseBand(ctx, t, { type: 'highpass', f: 600, f2: 7000, q: 0.8, peak: 0.22, a: 0.02, hold: 0.12, rel: 0.25 });
      tone(ctx, t + 0.1, 2640, 0.5, { type: 'triangle', peak: 0.14 }); tone(ctx, t + 0.1, 3960, 0.4, { peak: 0.06 });
      tone(ctx, t, 90, 0.3, { peak: 0.4, f2: 40 });
      break;
    case 'swoosh': noiseBand(ctx, t, { f: 2400, f2: 500, q: 1.6, peak: 0.24, a: 0.08, hold: 0.4, rel: 0.6 }); break;
    case 'boom': tone(ctx, t, 110, 0.5, { peak: 0.7, f2: 32 }); noiseBand(ctx, t, { type: 'lowpass', f: 1800, f2: 200, peak: 0.4, rel: 0.45 }); break;
    case 'pokal': { // fanfaren: mässing (sågtand genom lågpass) C–E–G–C och ett långt ackord
      const notes = [[523, 0, 0.16], [659, 0.16, 0.16], [784, 0.32, 0.16], [1047, 0.48, 0.9]];
      for (const [f, at, d] of notes) for (const det of [0, 1.004]) {
        const o = end(ctx.createOscillator()); o.type = 'sawtooth'; o.frequency.value = f * (det || 1);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
        const g = env(ctx, t + at, 0.09, 0.02, d - 0.05, 0.25);
        o.connect(lp); lp.connect(g); g.connect(out); o.start(t + at); o.stop(t + at + d + 0.3);
      }
      break;
    }
    default: break;
  }
}

// sorlet: en loop som följer tagningen ('publik' på matcherna, 'regn' i regnpasset)
let amb = null;
export function filmAmb(key) {
  const want = key && !isMuted() ? key : null;
  if ((amb?.key || null) === want) return;
  if (amb) {
    const a = amb; amb = null;
    try { const now = a.ctx.currentTime; a.g.gain.cancelScheduledValues(now); a.g.gain.setValueAtTime(a.g.gain.value, now); a.g.gain.linearRampToValueAtTime(0.0001, now + 0.6); } catch { /* ok */ }
    setTimeout(() => { try { a.src.stop(); a.g.disconnect(); } catch { /* ok */ } }, 700);
  }
  if (!want) return;
  const ctx = ctxOut();
  if (!ctx) return;
  const src = ctx.createBufferSource(); src.buffer = want === 'regn' ? noise : brown; src.loop = true;
  const f = ctx.createBiquadFilter();
  if (want === 'regn') { f.type = 'bandpass'; f.frequency.value = 3800; f.Q.value = 0.5; }
  else { f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.6; }
  const g = ctx.createGain(); g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(want === 'regn' ? 0.1 : 0.22, ctx.currentTime + 0.8);
  // läktaren andas: långsam svängning i styrkan
  if (want === 'publik') { const lfo = ctx.createOscillator(); lfo.frequency.value = 0.23; const lg = ctx.createGain(); lg.gain.value = 0.06; lfo.connect(lg); lg.connect(g.gain); lfo.start(); src.onended = () => { try { lfo.stop(); } catch { /* ok */ } }; }
  src.connect(f); f.connect(g); g.connect(out); src.start();
  amb = { key: want, ctx, src, g };
}
export function filmLjudStop() { filmAmb(null); }
