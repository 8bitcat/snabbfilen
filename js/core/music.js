// Bakgrundsmusiken: riktiga CC0-låtar (assets/audio/music/, källor i assets/audio/CREDITS.md)
// som loopar sömlöst, en egen låt per stadsdel (centrum, parken, Söder, förorten, natten) och för
// några ställen inomhus (butikerna, caféet, klädaffären, hemma, dinerns jukebox). När man byter
// område eller går in tonar låtarna mjukt över i varandra (equal power, ~2,5 s), och en låt man
// kommer tillbaka till fortsätter där den var.
//
// Musiken ligger LÅGT och tar aldrig över: i staden ≈ −36 dBFS K-vägt (hela låten) – ungefär i nivå
// med lugn ambiens utomhus, ≥ 2 dB under effektljuden och ≈ 12 dB under rösterna (uppmätt i
// tools/out/ambiens/balans48.mjs och musik-nivaer.mjs). Den duckar under röstchatten (setDuck) och
// när någon pratar (ambience.js skickar duck).
// NIVÅHÅLLAREN (level) jämnar ut varje låt långsamt: tysta intron och mellanspel lyfts högst
// +LEV_UP dB, starka partier sänks högst −LEV_DOWN dB – så att musiken varken försvinner under
// ambiensen i ett tyst parti eller sticker ut i ett starkt.
//
// Styrning: js/core/ambience.js → audioTick(A, dt) väljer låt varje bildruta (musicFrame(pick)).
// Av/på: isMusicOn / setMusic / toggleMusic (sparas i localStorage), musicTick() efter mute-byte.
// Regler: tyst när ljudet är av (isMuted) eller musiken av, inget före första pekningen, stannar
// när fliken är dold.
// Minne: låtarna avkodas i 32 kHz (MP3:orna har inget över ≈ 14 kHz) och på mobilen i 22 kHz mono;
// högst tre låtar hålls avkodade (två på mobilen) – centrum, den längsta, tar då ≈ 29 MB resp. 10 MB.
//
// Filformatet: varje MP3 = [sista 0,5 s av loopen][loopen][första 0,5 s], så loopen spelas mellan
// PAD och PAD + loop med AudioBufferSourceNode – sampelexakt och oberoende av MP3-kodarens
// fördröjning (tools/out/ambiens/build_music*.py).
//
// Automationsregel: allt som ändrar en låts gain går via hold() först (cancelAndHoldAtTime), så att
// en ny rampning aldrig krockar med en pågående övertoningskurva (setValueCurveAtTime) – annars
// kastar webbläsaren NotSupportedError och ändringen uteblir.
import { audioContext, isMuted } from './sound.js';

const KEY = 'snabbfilen_music';
let on = true;
try { on = localStorage.getItem(KEY) !== '0'; } catch { /* ok */ }

// Relativt till den här modulen (js/core/) – fungerar oavsett vilken sida som laddar den.
const DIR = (() => { try { return new URL('../../assets/audio/music/', import.meta.url).href; } catch { return 'assets/audio/music/'; } })();
const PAD = 0.5;
// loop = loopens längd (s). norm = förstärkning till SAMMA K-vägda snittnivå som de spelas (hela loopen
// genom motorn i 48 kHz, K-vägt, (L² + R²)/2 – tools/out/ambiens/musik-nivaer.mjs; butik.mp3 är ljus
// och mono, så RMS utan vägning ljuger om den). lvl = låtens egen nivå i mixen (natten och hemma
// lugnare). k = filens egen K-vägda snittnivå (dB) – nivåhållarens mål.
export const TRACKS = {
  centrum: { loop: 112.340431, norm: 1.023, lvl: 1, k: -19.9 },
  soder: { loop: 90.0, norm: 0.966, lvl: 1, k: -19.4 },
  parken: { loop: 64.0, norm: 1.018, lvl: 0.95, k: -19.9 },
  natt: { loop: 71.111134, norm: 1.132, lvl: 0.82, k: -20.8 },
  hemma: { loop: 46.451633, norm: 1.022, lvl: 0.85, k: -19.9 },
  fororten: { loop: 50.526327, norm: 0.928, lvl: 0.95, k: -19.1 },
  kafe: { loop: 40.421066, norm: 0.983, lvl: 0.95, k: -19.6 },
  klader: { loop: 44.307687, norm: 1.095, lvl: 0.9, k: -20.5 },
  butik: { loop: 88.0, norm: 1.357, lvl: 0.95, k: -22.4 },
  jukebox: { loop: 60.0, norm: 0.977, lvl: 1, k: -19.5 },
};
// Hela musikens nivå: en låt med lvl 1 och ingen klang hamnar på ≈ −35,6 dBFS K-vägt (−36,7 rått) –
// 2,5 dB under effektljuden (≈ −33,1 K) och ≈ 12 dB under rösterna (≈ −23,4 K).
export const MUSIC_LEVEL = 0.16;
const XFADE = 2.6;   // övertoning mellan låtar (s)
const BOOST = 1.4;   // jukeboxen i dinern: +2,9 dB en stund efter att man tryckt på den (tillfälligt, man bad om det)
// Nivåhållaren: högst så här mycket upp/ner (dB), mätarnas tidskonstanter (s: långsam, snabb),
// hur långt över snittet ett lyft får ta ett starkt parti (dB) och gainens glid upp/ner (s).
const LEV_UP = 4.5, LEV_DOWN = 3, LEV_TAU = 2.5, LEV_FAST = 0.25, LEV_HEAD = 2.5, LEV_GLIDE = 1.2, LEV_DROP = 0.12;

// Klangfärg per ställe: 'jukebox' = ur jukeboxens högtalare i rummet, 'vagg' = genom väggen
// (köket bakom dinern), 'radio' = en liten radio (närbutiken), 'inne' = butikshögtalare i taket.
const FX = {
  none: { hp: 20, lp: 20000, peak: 0 },
  inne: { hp: 90, lp: 9000, peak: 0 },
  jukebox: { hp: 170, lp: 4200, peak: 5 },
  jukeboxHog: { hp: 110, lp: 7000, peak: 3 },
  vagg: { hp: 190, lp: 950, peak: 0 },
  radio: { hp: 320, lp: 3200, peak: 4 },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mobile = () => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } };

// ---------------------------------------------------------------- motorn (valfri kontext)
// createMusicEngine(ctx, dest, { load(ctx, key) → Promise<AudioBuffer>, maxBuffers, leveler })
// → { want(pick), level(), preload(key), boost(sec), duck(chat, voice), fadeIn, fadeOut, stop(), stats() }
// (leveler: false = ingen nivåhållare; level() gör då ingenting)
// pick = { track, fx, lvl }. Motorn är samma live och i testerna (OfflineAudioContext).
export function createMusicEngine(ctx, dest, opts = {}) {
  const maxBuffers = opts.maxBuffers ?? (mobile() ? 2 : 3);
  const buffers = new Map();        // key → AudioBuffer (senast använd sist)
  const loading = new Map();        // key → Promise
  const pos = {};                   // key → var i loopen låten var när den tystnade
  const out = ctx.createGain(); out.gain.value = 1;          // av/på-toning
  const duckG = ctx.createGain(); duckG.gain.value = 1;      // röstchatt/röster
  const lev = ctx.createGain(); lev.gain.value = 1;          // nivåhållaren
  const master = ctx.createGain(); master.gain.value = MUSIC_LEVEL;
  // Mjuk toppbegränsare (tanh, ingen DynamicsCompressor – den lägger på egen "makeup"-förstärkning):
  // linjär upp till ≈ −22 dBFS (musiken ligger på ≈ −36 i snitt), tak vid ≈ −14 dBFS. Tar bara de
  // enstaka slag som nivåhållaren lyft i ett tyst parti.
  let top = null;
  if (typeof ctx.createWaveShaper === 'function') {
    try {
      top = ctx.createWaveShaper();
      const n = 4096, c = new Float32Array(n), L = 0.2;
      for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = L * Math.tanh(x / L); }
      top.curve = c; top.oversample = mobile() ? 'none' : '2x';
    } catch { top = null; }
  }
  master.connect(lev);
  if (top) { lev.connect(top); top.connect(duckG); } else lev.connect(duckG);
  duckG.connect(out); out.connect(dest);
  // Nivåhållarens mätare sitter på den spelande låtens källa (före nivå, klang och toning): K-vägd
  // (högpass 60 Hz + höjning +4 dB över 1,5 kHz), uppmixad till två kanaler (en monolåt ska läsas som
  // L = R) och vänster/höger var för sig – samma mått som TRACKS[].k. Inte kopplad till utgången
  // (en AnalyserNode drivs ändå).
  const meter = (() => {
    if (opts.leveler === false || typeof ctx.createAnalyser !== 'function' || typeof ctx.createChannelSplitter !== 'function') return null;
    try {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 60; hp.Q.value = 0.5;
      const sh = ctx.createBiquadFilter(); sh.type = 'highshelf'; sh.frequency.value = 1500; sh.gain.value = 4;
      const up = ctx.createGain(); up.channelCount = 2; up.channelCountMode = 'explicit'; up.channelInterpretation = 'speakers';
      const sp = ctx.createChannelSplitter(2), L = ctx.createAnalyser(), R = ctx.createAnalyser();
      L.fftSize = 2048; R.fftSize = 2048;
      hp.connect(sh); sh.connect(up); up.connect(sp); sp.connect(L, 0); sp.connect(R, 1);
      if (typeof L.getFloatTimeDomainData !== 'function') return null;
      return { hp, L, R, buf: new Float32Array(2048), p: 0, key: null, g: 1, t: 0 };
    } catch { return null; }
  })();
  const power = (an, buf) => { an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return s / buf.length; };
  let cur = null;                   // { key, src, g, hp, lp, pk, t0, off, lvl, fx, bufSr }
  const dying = [];                 // låtar som tonar ut
  let wantKey = null, wantPick = null, boostUntil = 0, stopped = false;
  let duckK = 0, duckVoice = 0, errors = 0;

  function load(key) {
    if (buffers.has(key)) { const b = buffers.get(key); buffers.delete(key); buffers.set(key, b); return Promise.resolve(b); }
    if (loading.has(key)) return loading.get(key);
    const p = (opts.load || defaultLoad)(ctx, key).then((b) => {
      loading.delete(key);
      if (!b) return null;
      buffers.set(key, b);
      // håll minnet nere: släpp de låtar som inte spelas och inte är de senaste
      for (const k of [...buffers.keys()]) {
        if (buffers.size <= maxBuffers) break;
        if (k !== key && k !== cur?.key && k !== wantKey && !dying.some((d) => d.key === k)) buffers.delete(k);
      }
      return b;
    }).catch(() => { loading.delete(key); return null; });
    loading.set(key, p);
    return p;
  }
  // Lågpasset följer också buffertens egen samplingsfrekvens: en låt avkodad i 22 kHz spelas upp med
  // linjär interpolation och ska inte få speglingar över ≈ 10 kHz.
  const lpFor = (f, bufSr) => Math.min(f.lp, ctx.sampleRate * 0.45, (bufSr || ctx.sampleRate) * 0.46);
  function chainFor(fx, bufSr) {
    const f = FX[fx] || FX.none;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = f.hp; hp.Q.value = 0.6;
    const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1400; pk.Q.value = 0.8; pk.gain.value = f.peak;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lpFor(f, bufSr); lp.Q.value = 0.5;
    hp.connect(pk); pk.connect(lp);
    return { hp, pk, lp };
  }
  function setFx(p, fx, tau = 0.4) {
    const f = FX[fx] || FX.none, now = ctx.currentTime;
    p.hp.frequency.setTargetAtTime(f.hp, now, tau);
    p.lp.frequency.setTargetAtTime(lpFor(f, p.bufSr), now, tau);
    p.pk.gain.setTargetAtTime(f.peak, now, tau);
    p.fx = fx;
  }
  const curve = (from, to, n = 33, up = true) => {
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1); c[i] = from + (to - from) * (up ? Math.sin(x * Math.PI / 2) : 1 - Math.cos(x * Math.PI / 2)); }
    return c;
  };
  // Frys parametern där den är just nu och släng allt som är planerat efter – även en pågående
  // kurva (cancelAndHoldAtTime; Firefox saknar den: då rensas allt och värdet sätts om).
  function hold(g) {
    const now = ctx.currentTime;
    let v = 0;
    try { v = g.value; } catch { /* ok */ }
    try { if (g.cancelAndHoldAtTime) { g.cancelAndHoldAtTime(now); return { now, v }; } } catch { /* faller igenom */ }
    try { g.cancelScheduledValues(0); g.setValueAtTime(v, now); } catch { /* ok */ }
    return { now, v };
  }
  // Mjuk övergång (equal power-kurva) från där gainen är nu till "to" på "sec" sekunder.
  function fadeGain(g, to, sec) {
    const { now, v } = hold(g);
    try {
      g.setValueAtTime(v, now);
      g.setValueCurveAtTime(curve(v, to, 33, to > v), now + 0.005, Math.max(0.05, sec));
    } catch {
      errors++;
      try { g.cancelScheduledValues(0); g.setValueAtTime(v, now); g.setTargetAtTime(to, now + 0.01, sec / 3); } catch { try { g.value = to; } catch { /* ok */ } }
    }
  }
  // Glid mot "to" (tidskonstant tau) – får avbryta en pågående övertoning.
  function glide(g, to, tau) {
    const { now } = hold(g);
    try { g.setTargetAtTime(to, now + 0.002, tau); } catch {
      errors++;
      try { g.cancelScheduledValues(0); g.setTargetAtTime(to, now + 0.002, tau); } catch { try { g.value = to; } catch { /* ok */ } }
    }
  }
  function where(p) { // position i loopen just nu
    const L = TRACKS[p.key].loop;
    return ((p.off + (ctx.currentTime - p.t0)) % L + L) % L;
  }
  const boosted = () => ctx.currentTime < boostUntil;
  // Klang och nivå för ett val: jukeboxen i dinern låter högre och klarare en stund efter ett tryck.
  const fxFor = (pick) => (pick.fx === 'jukebox' && boosted() ? 'jukeboxHog' : pick.fx);
  const lvlFor = (key, pick) => TRACKS[key].norm * TRACKS[key].lvl * (pick.lvl ?? 1) * (pick.fx === 'jukebox' && boosted() ? BOOST : 1);
  function retire(p, sec = XFADE) {
    if (!p) return;
    if (meter) { try { p.src.disconnect(meter.hp); } catch { /* ok */ } }
    pos[p.key] = where(p);
    fadeGain(p.g.gain, 0, sec);
    try { p.src.stop(ctx.currentTime + sec + 0.1); } catch { /* ok */ }
    p.src.onended = () => { try { p.src.disconnect(); p.g.disconnect(); p.hp.disconnect(); p.pk.disconnect(); p.lp.disconnect(); } catch { /* ok */ } const i = dying.indexOf(p); if (i >= 0) dying.splice(i, 1); };
    dying.push(p);
  }
  function startTrack(key, buf, pick, { fromStart = false, fade = XFADE } = {}) {
    const T = TRACKS[key];
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    src.loopStart = PAD; src.loopEnd = PAD + T.loop;
    const fx = fxFor(pick), ch = chainFor(fx, buf.sampleRate);
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(ch.hp); ch.lp.connect(g); g.connect(master);
    if (meter) {
      try { src.connect(meter.hp); } catch { /* ok */ }
      // ny start (annan låt, jukeboxen från början, tillbaka efter paus): nivåhållaren börjar om från
      // låtens snitt och neutral gain – ett förra partis sänkning får inte följa med in i ett intro
      meter.key = key; meter.p = meter.pf = 10 ** ((T.k ?? -20) / 10); meter.g = 1;
      glide(lev.gain, 1, 0.25);
    }
    const off = fromStart ? 0 : (pos[key] ?? 0);
    const t0 = ctx.currentTime + 0.02;
    src.start(t0, PAD + off);
    const lvl = lvlFor(key, pick);
    const p = { key, src, g, ...ch, t0, off, lvl, fx, bufSr: buf.sampleRate };
    fadeGain(g.gain, lvl, fade);
    return p;
  }
  function apply() {
    if (stopped || !wantPick) return;
    const pick = wantPick, key = pick.track;
    if (cur && cur.key === key) {
      // samma låt: bara klang och nivå följer med (klangen först – den kan aldrig kasta)
      const fx = fxFor(pick);
      if (fx !== cur.fx) setFx(cur, fx);
      const lvl = lvlFor(key, pick);
      if (Math.abs(lvl - cur.lvl) > 0.005) { cur.lvl = lvl; glide(cur.g.gain, lvl, 0.6); }
      return;
    }
    const buf = buffers.get(key);
    if (!buf) {
      if (pending !== key) { pending = key; load(key).then(() => { if (pending === key) pending = null; apply(); }); }
      return;
    }
    retire(cur);
    cur = startTrack(key, buf, pick);
  }
  let pending = null;

  const E = {
    // Välj låt (samma val många gånger i sekunden är billigt – bara förändringar gör något).
    want(pick) {
      if (!pick || !TRACKS[pick.track]) { if (cur) { retire(cur); cur = null; } wantKey = null; wantPick = null; return; }
      stopped = false;
      if (pick.fx !== 'jukebox') boostUntil = 0; // jukeboxens tryck gäller bara i dinern
      const changed = !wantPick || pick.track !== wantPick.track || pick.fx !== wantPick.fx || Math.abs((pick.lvl ?? 1) - (wantPick.lvl ?? 1)) > 0.01;
      wantKey = pick.track; wantPick = pick;
      if (changed || !cur) apply();
      else if (boostUntil && !boosted()) { boostUntil = 0; apply(); } // tiden ute: tillbaka till vanlig nivå
    },
    // Förladda en låt (t.ex. nästa område) utan att spela den.
    preload: (key) => (TRACKS[key] ? load(key) : Promise.resolve(null)),
    // Jukeboxen i dinern: ny låt från början, högre och klarare i "sec" sekunder.
    boost(sec = 45) {
      if (!cur || cur.key !== 'jukebox' || wantPick?.fx !== 'jukebox') return false;
      const buf = buffers.get('jukebox');
      if (!buf) return false;
      boostUntil = ctx.currentTime + sec;
      retire(cur, 0.4);
      cur = startTrack('jukebox', buf, wantPick, { fromStart: true, fade: 0.6 });
      return true;
    },
    // chat = röstchatten (0–1, 1 = sänk 40 %), voice = någon pratar i spelet (0–1, 1 = sänk 25 %).
    // Ett utelämnat värde (undefined) behåller det förra.
    duck(chat, voice) {
      if (chat !== undefined) duckK = clamp(+chat || 0, 0, 1);
      if (voice !== undefined) duckVoice = clamp(+voice || 0, 0, 1);
      const g = (1 - 0.4 * duckK) * (1 - 0.25 * duckVoice), now = ctx.currentTime;
      if (Math.abs(g - (E._duckT ?? 1)) < 0.005) return;
      E._duckT = g;
      duckG.gain.setTargetAtTime(g, now, g < duckG.gain.value ? 0.08 : 0.35);
    },
    // Nivåhållaren – anropas varje bildruta (musicFrame). Glidande effekt över de senaste LEV_TAU
    // sekunderna mot låtens eget snitt (TRACKS[].k): skillnaden blir en långsam gain (högst +LEV_UP,
    // −LEV_DOWN dB). En snabb mätare (LEV_FAST) ser till att ett lyft aldrig gör ett starkt parti
    // som just börjat starkare än snittet + LEV_HEAD dB – gainen sjunker då på ≈ 0,2 s (inga toppar
    // när ett tyst intro slår över i refrängen). Tystnad (före start, källan stannad) rör den inte.
    level() {
      if (!meter || !cur || stopped) return;
      const now = ctx.currentTime, dt = now - meter.t;
      if (dt >= 0 && dt < 0.045) return; // ≈ 20 gånger i sekunden räcker (mätaren läser 2048 sampel)
      meter.t = now;
      const k = TRACKS[cur.key].k ?? -20;
      if (meter.key !== cur.key) { meter.key = cur.key; meter.p = meter.pf = 10 ** (k / 10); } // ny låt: börja i snittet
      if (!(dt > 0) || dt > 0.5 || now < cur.t0 + 0.1) return;
      const pw = (power(meter.L, meter.buf) + power(meter.R, meter.buf)) / 2;
      if (!(pw > 1e-8)) return;
      meter.p += (pw - meter.p) * (1 - Math.exp(-dt / LEV_TAU));
      meter.pf += (pw - meter.pf) * (1 - Math.exp(-dt / LEV_FAST));
      const corr = clamp(Math.min(k - 10 * Math.log10(meter.p), k + LEV_HEAD - 10 * Math.log10(meter.pf)), -LEV_DOWN, LEV_UP);
      const g = 10 ** (corr / 20);
      if (Math.abs(20 * Math.log10(g / meter.g)) < 0.15) return;
      const down = g < meter.g;
      meter.g = g;
      try { lev.gain.setTargetAtTime(g, now, down ? LEV_DROP : LEV_GLIDE); } catch { errors++; }
    },
    fadeIn(sec = 0.8) { out.gain.setTargetAtTime(1, ctx.currentTime, sec / 3); },
    fadeOut(sec = 0.6) { out.gain.setTargetAtTime(0, ctx.currentTime, sec / 3); },
    // Stanna helt (musiken av, ljudet av, fliken dold): kom ihåg var låtarna var.
    stop(sec = 0.6) {
      stopped = true;
      if (cur) retire(cur, sec);
      cur = null;
    },
    stats: () => ({
      playing: cur ? cur.key : null, fx: cur?.fx || null, fading: dying.length, duck: +duckG.gain.value.toFixed(3), out: +out.gain.value.toFixed(3),
      buffers: [...buffers.keys()], bufferSr: cur?.bufSr || null, want: wantKey, pos: cur ? +where(cur).toFixed(2) : null,
      boost: boosted() ? +(boostUntil - ctx.currentTime).toFixed(1) : 0, lvl: cur ? +cur.lvl.toFixed(3) : null, errors,
      lev: +(20 * Math.log10(lev.gain.value || 1e-6)).toFixed(1), levMeter: meter ? +(10 * Math.log10(meter.p + 1e-12)).toFixed(1) : null,
      gain: +(out.gain.value * duckG.gain.value * lev.gain.value * master.gain.value * (cur ? cur.g.gain.value : 0)).toFixed(4),
    }),
    _nodes: { out, duckG, master, lev },
  };
  return E;
}

function decode(ctx, ab) {
  return new Promise((res, rej) => {
    try {
      const p = ctx.decodeAudioData(ab, res, rej);
      if (p && p.then) p.then(res, rej);
    } catch (e) { rej(e); }
  });
}
function toMono(ctx, b) {
  if (b.numberOfChannels < 2) return b;
  const m = ctx.createBuffer(1, b.length, b.sampleRate), o = m.getChannelData(0);
  const l = b.getChannelData(0), r = b.getChannelData(1);
  for (let i = 0; i < o.length; i++) o[i] = (l[i] + r[i]) * 0.5;
  return m;
}
// Avkoda i lägre samplingsfrekvens än kontexten (halva minnet eller mindre): en OfflineAudioContext
// i DEC_SR avkodar och samplar om i ett svep. Går det inte: kontextens egen avkodning.
async function defaultLoad(ctx, key) {
  const res = await fetch(DIR + key + '.mp3');
  if (!res.ok) return null;
  const ab = await res.arrayBuffer(), mob = mobile(), sr = mob ? 22050 : 32000;
  let b = null;
  const OAC = typeof window !== 'undefined' ? (window.OfflineAudioContext || window.webkitOfflineAudioContext) : null;
  if (OAC && ctx.sampleRate > sr) { try { b = await decode(new OAC(1, 1, sr), ab.slice(0)); } catch { b = null; } }
  if (!b) b = await decode(ctx, ab);
  return mob ? toMono(ctx, b) : b; // mobilen: mono
}

// ---------------------------------------------------------------- vilken låt var?
// pickMusic({ scene, district, night, canal, hem }) → { track, fx, lvl }
// scene = A.sceneName, district = 'centrum'|'parken'|'soder'|'downtown'|'bron'|'jarnbron'|'fororten',
// night = 0–1 (mörker), canal = 0–1 (nära vattnet: kanalen eller floden). Ute ligger musiken
// ungefär i nivå med ambiensen (0…+3 dB, även i mono på en mobilhögtalare – granska-efter.mjs); där
// det är tyst (parken, vid vattnet – där är ambiensen själv låg) lägre (−2,2 resp. −5,2 dB) så att
// fåglarna och skvalpet får höras – men inte så lågt att den försvinner.
// hem = låten man själv satt på hemma (js/core/hemmusik.js hemPick) – går före hemma-låten.
export function pickMusic(s = {}) {
  const sc = String(s.scene || 'city');
  const night = (s.night || 0) > 0.6;
  switch (sc) {
    case 'city': {
      const water = 1 - 0.45 * clamp(+s.canal || 0, 0, 1); // vid vattnet: skvalpet och måsarna bär
      if (night) return { track: 'natt', fx: 'none', lvl: +water.toFixed(2) };
      const d = s.district || 'centrum';
      // downtown = centrum-låten, broarna över floden = Söder-låten (vattnet)
      const track = TRACKS[d] ? d : ({ bron: 'soder', jarnbron: 'soder' }[d] || 'centrum');
      return { track, fx: 'none', lvl: +((d === 'parken' ? 0.7 : 0.9) * water).toFixed(2) };
    }
    case 'room': case 'visit': return sc === 'room' && s.hem ? s.hem : { track: night ? 'natt' : 'hemma', fx: 'none', lvl: night ? 0.8 : 0.9 };
    // (butik.mp3 är ljus: 'radio'-klangens topp vid 1,4 kHz lyfter den ≈ 3 dB K-vägt – därav lägre lvl)
    case 'mat': return { track: 'butik', fx: 'inne', lvl: 0.9 };
    case 'narbutik': return { track: 'butik', fx: 'radio', lvl: 0.65 };
    case 'mobler': case 'moblerGammal': case 'moblergammal': return { track: 'butik', fx: 'inne', lvl: 0.9 };
    case 'klader': return { track: 'klader', fx: 'inne', lvl: 1 };
    case 'bostad': return { track: 'klader', fx: 'inne', lvl: 0.75 };
    case 'kafe': case 'jobbkafe': return { track: 'kafe', fx: 'inne', lvl: 1 };
    case 'burgarbar': return { track: 'jukebox', fx: 'jukebox', lvl: 1 };
    case 'jobbburgare': case 'jobbkok': return { track: 'jukebox', fx: 'vagg', lvl: 0.9 };
    case 'djur': case 'leksaker': return { track: 'parken', fx: 'inne', lvl: 0.85 };
    case 'jobbtvatt': return { track: 'kafe', fx: 'radio', lvl: 1 };
    case 'jobbbensin': return { track: 'butik', fx: 'radio', lvl: 0.65 };
    case 'jobbverkstad': return { track: 'fororten', fx: 'radio', lvl: 1 };
    case 'jobbfrukt': case 'jobbpizzeria': return { track: 'soder', fx: 'inne', lvl: 0.9 };
    case 'jobbflyg': case 'jobbincheck': case 'terminal': case 'jobbposten': return { track: 'centrum', fx: 'inne', lvl: 0.9 };
    default: return { track: sc.startsWith('jobb') ? 'centrum' : 'hemma', fx: 'inne', lvl: 0.85 };
  }
}

// ---------------------------------------------------------------- live
let eng = null, engCtx = null, lastPick = null, active = false, frameAt = 0;
let unlockedFlag = false;
const unlocked = () => unlockedFlag || !!(typeof navigator !== 'undefined' && navigator.userActivation && navigator.userActivation.hasBeenActive);
const hidden = () => typeof document !== 'undefined' && document.hidden;
function engine() {
  if (!unlocked()) return null;
  const c = audioContext();
  if (!c || c.state === 'closed') return null;
  if (engCtx !== c) { eng = createMusicEngine(c, c.destination); engCtx = c; if (chatDuck) eng.duck(chatDuck, 0); }
  return eng;
}
function sceneGuess() { // när ambience.js inte har valt än: gissa från scenen
  const A = typeof window !== 'undefined' ? window.SF : null;
  if (!A || !A.sceneName) return pickMusic({ scene: 'room' });
  return pickMusic({ scene: A.sceneName, district: A.scene?._debug?.env?.district?.id, night: (A.scene?._debug?.env?.dark || 0) / 0.5 });
}
function run(pick) {
  const e = engine();
  if (!e) return;
  if (!on || isMuted() || hidden()) { if (active) { e.fadeOut(0.5); e.stop(0.6); active = false; } return; }
  if (!active) { e.fadeIn(0.8); active = true; }
  e.want(pick || lastPick || sceneGuess());
  e.level();
}

export const isMusicOn = () => on;
export function setMusic(v) {
  on = !!v;
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ok */ }
  musicTick();
  return on;
}
export const toggleMusic = () => setMusic(!on);
// Anropas när ljudet får låta (första pekningen) och när mute/musik växlar.
export function musicTick() { try { run(null); } catch { /* musiken får aldrig stoppa spelet */ } }
// Varje bildruta från ambience.js: vilken låt som ska spela just nu.
export function musicFrame(pick) {
  if (pick) lastPick = pick;
  frameAt = typeof performance !== 'undefined' ? performance.now() : 0;
  run(lastPick);
}
// Röstchatten (0–1): sänker musiken ca 40 % medan någon pratar (1 = full duckning).
// (ambience.js setDuck anropar den här också – huvudagenten behöver bara ett av anropen.)
let chatDuck = 0;
export function setDuck(k) { chatDuck = clamp(+k || 0, 0, 1); eng?.duck(chatDuck, undefined); }
// Röster i spelet (pratbubblornas babbel): 0–1, sänker musiken högst 25 %.
export function musicDuckVoice(v) { eng?.duck(chatDuck, clamp(+v || 0, 0, 1)); }
// Jukeboxen i dinern trycktes: ny låt, högre en stund (bara om jukeboxlåten spelar i dinern).
export function musicJukebox(sec = 45) { try { return !!eng?.boost(sec); } catch { return false; } }
export function musicStats() { return { on, active, unlocked: unlocked(), ...(eng ? eng.stats() : { playing: null }), lastFrameMs: frameAt }; }

if (typeof document !== 'undefined') {
  const onGesture = () => { unlockedFlag = true; musicTick(); };
  try {
    document.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
    document.addEventListener('keydown', onGesture, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => musicTick());
  } catch { /* ok */ }
}
