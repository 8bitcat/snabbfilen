// Effektljuden. Inspelningarna (js/core/rec.js, CC0) spelas via krokarna nedan; syntarna här är
// reserven tills filen laddats. Små synthar via WebAudio: fyrkantsvåg för pip,
// sågtand för fel, sinus för mjuka saker. Allt går genom en mastervolym
// och kan stängas av med mute-knappen i HUD:en (sparas i localStorage).
//
// Andra moduler kan haka på effektljuden (js/core/ambience.js gör det):
//   setPlayHook(namn, fn) – play(namn) spelar fn() i stället (t.ex. 'aska' = åskmuller från
//                           vädret, 'bark' = en hund som skäller i staden)
//   onPlay(fn)            – fn(namn) får veta varje play (t.ex. 'box' = jukeboxen i dinern)
// Inget låter före första pekningen/tangenten (webbläsarkrav – och inga varningar i konsolen).
let ctx = null, master = null;
let muted = false;
try { muted = localStorage.getItem('snabbfilen_mute') === '1'; } catch { /* ok */ }

let gesture = false;
const unlocked = () => gesture || !!(typeof navigator !== 'undefined' && navigator.userActivation && navigator.userActivation.hasBeenActive);
if (typeof document !== 'undefined') {
  const on = () => { gesture = true; };
  try {
    document.addEventListener('pointerdown', on, { capture: true, passive: true });
    document.addEventListener('keydown', on, { capture: true, passive: true });
  } catch { /* ok */ }
}

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
// Webbläsare kräver en användargest innan ljud får låta – anropas på första pekningen.
export function unlockAudio() { gesture = true; try { ac(); } catch { /* inget ljudstöd */ } }
// Ljudkontexten för musiken, ambiensen och rösterna – null om ljud saknas eller om ingen har
// pekat på sidan än (då skapas ingen kontext).
export function audioContext() { if (!unlocked()) return null; try { return ac(); } catch { return null; } }
export const audioUnlocked = () => unlocked();

export const isMuted = () => muted;
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('snabbfilen_mute', muted ? '1' : '0'); } catch { /* ok */ }
  if (!muted) play('click');
  return muted;
}

const hooks = new Map(), listeners = new Set();
export function setPlayHook(name, fn) { if (fn) hooks.set(name, fn); else hooks.delete(name); }
export function onPlay(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// En ton: frekvens, start (sekunder från nu), längd, vågform, volym, glid (slutfrekvens)
function tone(f, at, dur, type = 'square', vol = 0.16, slide = 0) {
  const c = ac(), t0 = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
// Biltutan: två toner samtidigt (en stor ters, som en riktig signalhorn) – kort, kort-lång.
// (Ljudvarvet 2026-09-28: ersatte de två fyrkantspipen 392/330 Hz, som lät som ett spelpip, när
// bilarna i staden fick ljud – används av traffic.js, jobb-bensin.js och jobb-verkstad.js. Samma
// längd som förut; lågpassad och något svagare, 0,07 mot 0,12.)
function horn(at, dur, vol) {
  const c = ac(), t0 = c.currentTime + at;
  const g = c.createGain(), lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.7;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  g.gain.setValueAtTime(vol, t0 + dur - 0.03);
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  lp.connect(g); g.connect(master);
  for (const f of [415, 523]) {
    const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f;
    o.connect(lp); o.start(t0); o.stop(t0 + dur + 0.02);
  }
}

export function play(name) {
  if (muted || !unlocked()) return;
  for (const fn of listeners) { try { fn(name); } catch { /* lyssnaren får aldrig stoppa ljudet */ } }
  // en krok spelar ljudet i stället (inspelningarna i rec.js, åskan, hundarna) – svarar den
  // false låter syntversionen nedan (t.ex. innan inspelningen hunnit laddas)
  const h = hooks.get(name);
  if (h) { let r; try { r = h(); } catch { r = undefined; } if (r !== false) return; }
  try {
    switch (name) {
      case 'click': tone(660, 0, 0.05, 'square', 0.1); break;
      case 'ok': tone(880, 0, 0.07); tone(1320, 0.07, 0.1); break;
      case 'fel': tone(180, 0, 0.16, 'sawtooth', 0.18, 110); break;
      case 'miss': tone(240, 0, 0.1, 'triangle', 0.12, 180); break;
      case 'coin': tone(990, 0, 0.06); tone(1319, 0.06, 0.16); break;
      case 'box': tone(523, 0, 0.07); tone(659, 0.07, 0.07); tone(784, 0.14, 0.14); break;
      case 'buy': tone(784, 0, 0.06); tone(988, 0.06, 0.06); tone(1175, 0.12, 0.14); break;
      case 'sleep': tone(440, 0, 0.5, 'sine', 0.14, 180); break;
      case 'morning': [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.12, 'triangle', 0.14)); break;
      case 'fanfare': [523, 523, 659, 784].forEach((f, i) => tone(f, i * 0.12, i === 3 ? 0.4 : 0.11)); break;
      case 'knock': tone(140, 0, 0.06, 'square', 0.2); tone(140, 0.12, 0.06, 'square', 0.2); break;
      case 'door': tone(300, 0, 0.08, 'triangle', 0.12, 380); break;
      case 'honk': horn(0, 0.16, 0.07); horn(0.24, 0.34, 0.07); break;
      case 'slide': tone(620, 0, 0.22, 'triangle', 0.05, 240); break;
      case 'chirp': tone(2200, 0, 0.05, 'sine', 0.05, 2800); tone(2600, 0.07, 0.05, 'sine', 0.04, 3000); break;
    }
  } catch { /* ljud är aldrig värt en krasch */ }
}
