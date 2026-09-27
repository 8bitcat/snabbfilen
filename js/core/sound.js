// Ljud utan ljudfiler: små synthar via WebAudio. Fyrkantsvåg för pip,
// sågtand för fel, sinus för mjuka saker. Allt går genom en mastervolym
// och kan stängas av med mute-knappen i HUD:en (sparas i localStorage).
let ctx = null, master = null;
let muted = false;
try { muted = localStorage.getItem('snabbfilen_mute') === '1'; } catch { /* ok */ }

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
export function unlockAudio() { try { ac(); } catch { /* inget ljudstöd */ } }

export const isMuted = () => muted;
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('snabbfilen_mute', muted ? '1' : '0'); } catch { /* ok */ }
  if (!muted) play('click');
  return muted;
}

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

export function play(name) {
  if (muted) return;
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
    }
  } catch { /* ljud är aldrig värt en krasch */ }
}
