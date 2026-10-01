// Filmmusiken på BIO PIXEL: låtarna i fotbollsfilmerna (fotboll.js, tagningar med music: …).
//   'traning' – träningslåten. Carl ville ha "Eye of the Tiger" – den är upphovsrättsskyddad och
//               spelet har bara fria (CC0) ljud, så det här är en EGEN 80-talsrock i samma anda:
//               e-moll, 124 BPM, distade kraftackord med dämpade åttondelar, bas, trummor och en
//               melodislinga som kommer in efter två varv.
//   'intro'   – KBK-signaturen över förtexterna och eftertexterna (Carl: "när filmen börjar är det
//               tyst"): D-dur, 132 BPM, raka slag och en hjältemelodi från första takten.
// Allt syntat i Web Audio, inga ljudfiler. Spelas bara när ljudet och musiken är på (samma reglage
// som stadens musik).
//
//   filmMusic('traning')  starta (gör inget om den redan spelar)
//   filmMusic(null)       tona ut och sluta
// Anropas varje bildruta från salongen (shop-bio.js) – billigt när inget ändras.
import { audioContext, isMuted } from '../../core/sound.js';
import { isMusicOn } from '../../core/music.js';

const LEVEL = 0.2;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
// Låtarna: åtta takter. chords = ackordens grundton (gitarren spelar grundton + kvint + oktav),
// rytm = slagen per takt (A = öppet slag, m = dämpad åttondel), melodi = en ton per åttondel
// (null = håll, 0 = paus), melFran = melodin spelas från detta varv (0 = direkt, 1 = andra varvet)
// och varannat varv därefter om varv2 är sant.
const SONGS = {
  traning: {
    bpm: 124, rytm: 'AmmAmmAm', melFran: 1, varv2: true,
    chords: [52, 52, 48, 50, 52, 52, 55, 57],                // E E C D E E G A
    melodi: [
      [71, null, 74, null, 76, null, null, null],
      [76, null, 74, 76, 79, null, 76, null],
      [72, null, null, 71, 72, null, 74, null],
      [74, null, 76, null, 74, null, 71, null],
      [71, null, 74, null, 76, null, 79, null],
      [81, null, 79, 76, 79, null, null, 0],
      [79, null, 81, null, 83, null, 81, 79],
      [81, null, null, null, 76, null, 79, null],
    ],
  },
  intro: {
    bpm: 132, rytm: 'AmAmAAmA', melFran: 0, varv2: false,
    chords: [50, 50, 55, 57, 50, 50, 47, 57],                // D D G A D D Bm A
    melodi: [
      [74, null, 78, null, 81, null, null, null],
      [83, 81, 78, null, 81, null, null, 0],
      [79, null, 83, null, 86, null, 83, null],
      [85, null, null, 83, 81, null, null, 0],
      [74, null, 78, null, 81, null, 86, null],
      [85, null, 83, null, 81, null, null, 0],
      [83, null, 81, null, 78, null, 79, null],
      [81, null, null, null, null, null, 0, 0],
    ],
  },
};

let S = null;   // spelaren när låten går: { ctx, out, song, timer, step, next, … }
let current = null;

function distCurve(k = 30) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
  return c;
}
function noiseBuf(ctx) {
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function start(ctx, song) {
  const STEP = 60 / song.bpm / 2;                            // en åttondel
  const out = ctx.createGain(); out.gain.value = 0.0001; out.connect(ctx.destination);
  out.gain.setTargetAtTime(LEVEL, ctx.currentTime, 0.15);
  // gitarrbussen: distorsion → lågpass
  const gIn = ctx.createGain(); gIn.gain.value = 0.5;
  const ws = ctx.createWaveShaper(); ws.curve = distCurve(28); ws.oversample = '2x';
  const gLp = ctx.createBiquadFilter(); gLp.type = 'lowpass'; gLp.frequency.value = 2400; gLp.Q.value = 0.7;
  const gOut = ctx.createGain(); gOut.gain.value = 0.32;
  gIn.connect(ws); ws.connect(gLp); gLp.connect(gOut); gOut.connect(out);
  // melodins eko
  const dl = ctx.createDelay(1); dl.delayTime.value = STEP * 3;
  const fb = ctx.createGain(); fb.gain.value = 0.28;
  const lead = ctx.createGain(); lead.gain.value = 0.18;
  lead.connect(out); lead.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(out);
  S = { ctx, out, gIn, gLp, lead, song, STEP, noise: noiseBuf(ctx), step: 0, next: ctx.currentTime + 0.08, nodes: new Set() };
  S.timer = setInterval(schedule, 25);
  schedule();
}
function stop() {
  if (!S) return;
  const s = S; S = null;
  clearInterval(s.timer);
  const now = s.ctx.currentTime;
  try { s.out.gain.cancelScheduledValues(now); s.out.gain.setValueAtTime(s.out.gain.value, now); s.out.gain.linearRampToValueAtTime(0.0001, now + 0.5); } catch { /* ok */ }
  setTimeout(() => { try { s.out.disconnect(); } catch { /* ok */ } }, 800);
}
const keep = (n) => { S.nodes.add(n); n.onended = () => { S?.nodes.delete(n); try { n.disconnect(); } catch { /* ok */ } }; return n; };

function schedule() {
  if (!S) return;
  if (typeof document !== 'undefined' && document.hidden) { filmMusic(null); return; }
  const { ctx } = S;
  while (S.next < ctx.currentTime + 0.14) {
    play(S.step, S.next);
    S.step++; S.next += S.STEP;
  }
}
function play(step, t) {
  const { song, STEP } = S;
  const bar = Math.floor(step / 8) % 8, e = step % 8, varv = Math.floor(step / 64);
  const root = song.chords[bar], open = song.rytm[e] === 'A';
  guitar(t, root, open);
  bass(t, root - 12, open);
  // trummor: bastrumma 1, 3 och "och" efter 3 · virvel 2 och 4 · hihat åttondelar · crash på takt 1 och 5
  if (e === 0 || e === 4 || e === 5) kick(t);
  if (e === 2 || e === 6) snare(t);
  hat(t, e % 2 === 0 ? 0.5 : 0.32);
  if (e === 0 && (bar === 0 || bar === 4)) crash(t);
  // virvelfill sista takten före varvet börjar om (introt)
  if (!song.varv2 && bar === 7 && e >= 4) snare(t + STEP / 2);
  // melodin: träningslåten först bara kompet (som i en riktig träningslåt), introt direkt
  const mel = song.melodi[bar][e];
  const on = varv >= song.melFran && (!song.varv2 || (varv - song.melFran) % 2 === 0);
  if (on && mel) {
    let len = 1; while (e + len < 8 && song.melodi[bar][e + len] === null) len++;
    leadNote(t, mel, len * STEP);
  }
}
function guitar(t, root, open) {
  const { ctx, STEP } = S;
  const g = ctx.createGain(); g.connect(S.gIn);
  const dur = open ? STEP * 1.6 : STEP * 0.55;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(open ? 0.9 : 0.55, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  S.gLp.frequency.setValueAtTime(open ? 2600 : 950, t);
  for (const [n, det] of [[root, -6], [root + 7, 4], [root + 12, 0]]) {
    const o = keep(ctx.createOscillator()); o.type = 'sawtooth'; o.frequency.value = midi(n); o.detune.value = det;
    o.connect(g); o.start(t); o.stop(t + dur + 0.02);
  }
}
function bass(t, n, open) {
  const { ctx, STEP } = S;
  const o = keep(ctx.createOscillator()); o.type = 'sawtooth'; o.frequency.value = midi(n);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(open ? 0.5 : 0.38, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + STEP * 0.95);
  o.connect(lp); lp.connect(g); g.connect(S.out); o.start(t); o.stop(t + STEP);
}
function kick(t) {
  const { ctx } = S;
  const o = keep(ctx.createOscillator()); o.type = 'sine';
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(g); g.connect(S.out); o.start(t); o.stop(t + 0.3);
}
function noiseHit(t, type, freq, q, level, dur) {
  const { ctx } = S;
  const n = keep(ctx.createBufferSource()); n.buffer = S.noise;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f); f.connect(g); g.connect(S.out); n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.02);
}
function snare(t) {
  noiseHit(t, 'bandpass', 1900, 0.9, 0.55, 0.16);
  const { ctx } = S;
  const o = keep(ctx.createOscillator()); o.type = 'triangle'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(g); g.connect(S.out); o.start(t); o.stop(t + 0.12);
}
const hat = (t, lv) => noiseHit(t, 'highpass', 7500, 0.7, lv * 0.22, 0.045);
const crash = (t) => noiseHit(t, 'highpass', 4200, 0.5, 0.22, 1.3);
function leadNote(t, n, dur) {
  const { ctx } = S;
  const o = keep(ctx.createOscillator()); o.type = 'square'; o.frequency.value = midi(n);
  const lfo = keep(ctx.createOscillator()); lfo.frequency.value = 5.6;
  const lg = ctx.createGain(); lg.gain.value = 9; lfo.connect(lg); lg.connect(o.detune);   // vibrato
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.7, t + 0.012); g.gain.setTargetAtTime(0.45, t + 0.05, 0.1); g.gain.setTargetAtTime(0.0001, t + dur - 0.03, 0.03);
  o.connect(lp); lp.connect(g); g.connect(S.lead);
  o.start(t); o.stop(t + dur + 0.1); lfo.start(t); lfo.stop(t + dur + 0.1);
}

export function filmMusic(key) {
  const want = key && !isMuted() && isMusicOn() ? key : null;
  if (want === current && (want ? !!S : true)) return;
  if (!want) { current = null; stop(); return; }
  const ctx = audioContext();
  if (!ctx) { current = null; return; }                    // inget ljud än (före första pekningen)
  stop();
  current = want;
  try { start(ctx, SONGS[want] || SONGS.traning); } catch { current = null; S = null; }
}
export const filmMusicPlaying = () => !!S;
