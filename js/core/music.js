// Bakgrundsmusik utan ljudfiler: en liten chiptune-slinga (melodi i fyrkantsvåg, bas i
// triangel, hi-hat av brus) som schemaläggs i WebAudio. Av/på sparas i localStorage och
// musiken följer även mute-knappen. Startar först efter en pekning (webbläsarkrav).
import { audioContext, isMuted } from './sound.js';

const KEY = 'snabbfilen_music';
let on = true;
try { on = localStorage.getItem(KEY) !== '0'; } catch { /* ok */ }

const BPM = 132, STEP = 60 / BPM / 2; // åttondelar
// Tonhöjder som halvtoner från A4 (0). null = paus.
const N = (name) => { const m = /^([A-G])(#?)(\d)$/.exec(name); const base = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] ? 1 : 0); return base + (m[3] - 4) * 12; };
const hz = (st) => 440 * Math.pow(2, st / 12);
// 4 takter melodi (16 åttondelar per takt = 32 steg på två takter × 2)
const MELODY = ['E5', 'G5', 'A5', null, 'G5', 'E5', 'D5', null, 'C5', 'D5', 'E5', null, 'G5', null, 'E5', null,
  'D5', 'E5', 'G5', null, 'A5', 'G5', 'E5', null, 'D5', null, 'C5', 'D5', 'E5', null, null, null,
  'C5', 'E5', 'G5', null, 'A5', 'C6', 'A5', null, 'G5', 'E5', 'D5', null, 'E5', null, null, null,
  'A5', 'G5', 'E5', 'G5', 'A5', null, 'C6', null, 'B5', 'A5', 'G5', null, 'C5', null, null, null].map((n) => (n ? N(n) : null));
const BASS = ['C3', null, 'C3', 'G3', 'C3', null, 'G2', null, 'A2', null, 'A2', 'E3', 'A2', null, 'E3', null,
  'F2', null, 'F2', 'C3', 'F2', null, 'C3', null, 'G2', null, 'G2', 'D3', 'G2', null, 'B2', null].map((n) => (n ? N(n) : null));

let ctx = null, gain = null, timer = null, step = 0, nextAt = 0, noise = null;
function ensure() {
  if (ctx) return true;
  ctx = audioContext();
  if (!ctx) return false;
  gain = ctx.createGain();
  gain.gain.value = 0.18;
  gain.connect(ctx.destination);
  const len = ctx.sampleRate * 0.06, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  noise = buf;
  return true;
}
function note(st, at, dur, type, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = hz(st);
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + dur);
  o.connect(g); g.connect(gain);
  o.start(at); o.stop(at + dur + 0.02);
}
function hat(at, vol) {
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = noise; g.gain.value = vol;
  src.connect(g); g.connect(gain); src.start(at);
}
function schedule() {
  if (!ctx) return;
  while (nextAt < ctx.currentTime + 0.25) {
    const m = MELODY[step % MELODY.length], b = BASS[step % BASS.length];
    if (m !== null) note(m, nextAt, STEP * 0.9, 'square', 0.09);
    if (b !== null) note(b, nextAt, STEP * 0.8, 'triangle', 0.16);
    if (step % 2 === 0) hat(nextAt, step % 8 === 4 ? 0.07 : 0.035);
    nextAt += STEP; step++;
  }
}
function start() {
  if (timer || !on || isMuted()) return;
  if (!ensure()) return;
  if (ctx.state === 'suspended') ctx.resume();
  nextAt = ctx.currentTime + 0.05;
  timer = setInterval(schedule, 80);
  schedule();
}
function stop() { clearInterval(timer); timer = null; }

export const isMusicOn = () => on;
export function setMusic(v) {
  on = !!v;
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ok */ }
  if (on) start(); else stop();
  return on;
}
export const toggleMusic = () => setMusic(!on);
// Anropas när ljudet får låta (första pekningen) och när mute växlar.
export function musicTick() { if (on && !isMuted()) start(); else stop(); }
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', () => musicTick(), { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else musicTick(); });
}
