// Röster och djurläten utan ljudfiler – allt syntas i WebAudio.
//
// SIMSPRÅK: babble(text, röst) spelar obegripligt babbel som följer repliken. Stavelser byggs
// av konsonanter (stötar, brus, nasaler, l/r/j/v) och vokaler (en glottiskälla genom tre
// formantfilter, som i en riktig strupe + mun) i talets rytm: betonade stavelser längre och
// högre, pauser vid komma och punkt, frågeton upp på '?', glad/ivrig/sur/arg ton efter
// utropstecken och emoji. Längden följer texten men är högst MAX_TAL sekunder.
// Varje person har en egen röst som alltid låter likadant: voiceFor(look | avatar | namn)
// → { pitch, kind: 'man'|'kvinna'|'barn'|'gammal', seed }. Rösten ger också personens egna
// favoritljud (vissa säger "bala-wu", andra "shiki-ne"), taltempo, heshet och klang.
//
// DJUR: bark(sort) (valp = pip-skall, tax = gläfs, stor = voff), meow(), purr(sek) (lågt
// mullrande AM-modulerat brus med andning), hiss(), growl(), whine(), snuff() (kaninens nos),
// thump(), chirp() (kvitter), coo() (duva), blubb() (fisk), squeak() (gnagare) – samlat i
// animalSound(art | husdjur, humör).
//
// Samma djur (husdjurets id, platsen) har alltid samma röst men skäller/jamar lite olika varje gång.
//
// speak(text, opts) gissar vem som pratar (🐶 🐱 🐰 … i början = djur, annars en person) och
// används av pratbubblorna (createSpeech/sayBubble i js/scenes/walkable.js); heardBubble gör
// samma sak för bubblor som ritas varje bildruta (spelarchatten, gästernas repliker).
//
// Regler: tyst när ljudet är avstängt (isMuted – kollas vid start och medan något låter), inget
// ljud före första pekningen/tangenten, högst MAX_VOICES samtidiga röster (den äldsta tonas
// ut), det som sades i en scen tystnar när man byter scen (window.SF.sceneName), allt kopplas
// bort när det tystnat. Utan WebAudio blir allt tyst utan fel. _render.* gör samma sak i
// valfri kontext (OfflineAudioContext i testerna, tools/out/roster/).
import { audioContext, isMuted } from './sound.js';

const MAX_VOICES = 3;      // samtidiga röster/djurläten
const MAX_TAL = 2.5;       // längsta babbel (sekunder)
// Nivåer per ljud (motorns utgång, topp ca 0,4–0,65). Bussen skalar sedan allt med OUT_LEVEL:
// babbel hamnar på ca −25 dBFS rms / topp ~0,3 – över ambiens och musik, i nivå med (lite
// över) spelets effektljud (sound.js: 0,5 × 0,1–0,2 fyrkantsvåg).
const OUT_LEVEL = 0.7;
// WebAudios DynamicsCompressor lägger alltid på en automatisk "makeup gain" (spec: (1/g)^0,6).
// Med inställningarna nedan är den ×1,52 för svaga signaler (uppmätt i Chromium, tools/out/
// roster/) – trimmen efter begränsaren tar bort den så att bara topparna påverkas.
const LIM = { threshold: -8, knee: 4, ratio: 12, attack: 0.002, release: 0.12, makeup: 1.52 };
const LEVEL = { babble: 0.62, bark: 0.5, meow: 0.42, purr: 1.0, hiss: 0.2, growl: 0.5, whine: 0.3, snuff: 0.3, thump: 0.5, chirp: 0.13, coo: 0.34, blubb: 0.22, squeak: 0.16 };

// ---------------------------------------------------------------- små hjälpare
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function wpick(r, w) {
  let sum = 0;
  for (const k in w) sum += w[k];
  let x = r() * sum;
  for (const k in w) { x -= w[k]; if (x <= 0) return k; }
  return Object.keys(w)[0];
}
const nowS = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

// ---------------------------------------------------------------- vem låter hur
// Tonhöjd (Hz) per röstsort. 'gammal' kan vara både tant och gubbe (fem avgör).
const PITCH = { man: [98, 138], kvinna: [180, 240], barn: [265, 345], gammal: [[104, 128], [165, 196]] };
const GREY = new Set(['#b9b3ab', '#e6e2da']);
function isGrey(hex) {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return false;
  if (GREY.has(hex.toLowerCase())) return true;
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx > 165 && mx - mn < 26;
}
// Hur "kvinnlig" en look ser ut (0–1) – bara en sannolikhet, fröet avgör resten.
function femOfLook(L) {
  if (L.beard) return 0.03;
  let f = 0.5;
  const st = String(L.style || '');
  if (/long|pony|bun|bob|fl[äa]t|uppsatt|tofs|lock|curl/i.test(st)) f += 0.32;
  if (/bald|buzz|mohawk|spiky|kal|snagg/i.test(st)) f -= 0.34;
  const bot = String(L.bottom || '');
  if (/skirt|dress|kjol|kl[äa]nning/i.test(bot)) f += 0.3;
  if (L.makeup && L.makeup !== 'none') f += 0.22;
  return clamp(f, 0.04, 0.96);
}
function stableKey(L) {
  try {
    return Object.keys(L).sort().map((k) => {
      const v = L[k];
      return k + ':' + (v && typeof v === 'object' ? JSON.stringify(v) : String(v));
    }).join('|');
  } catch { return String(L); }
}
// Vanliga förnamn (i spelet och i familjen) – "Kalle" slutar på e men är en kille, "Doris" en dam.
const F_NAMES = new Set(('doris bella ingrid karin greta astrid elsa maja lisa sara emma anna julia ella alice ebba stina britt maj gun siv ulla '
  + 'inga kerstin birgitta lena eva marie sofie linnea klara tilda saga wilma alma agnes vera selma frida hanna ida moa nora signe svea tyra '
  + 'ester elin mia my lotta ronja majken dagny berit').split(' '));
const M_NAMES = new Set(('sven olle bosse kalle nisse pelle lasse janne bengt göran erik lars per nils gustav oskar hugo leo axel anton arvid '
  + 'viktor sixten ture knut bertil rolf åke stig kurt sune gösta harry arne ove ville melker loke otto sigge elias noah liam adam ali omar '
  + 'carl kjell bamse rocky buster frasse tassen kurre').split(' '));
function kindFromName(name, r) {
  const n = String(name).toLowerCase();
  if (/farmor|mormor|gumm|tant|faster|moster|mormo/.test(n)) return { kind: 'gammal', fem: 0.97 };
  if (/farfar|morfar|gubb|farbror|morbror/.test(n)) return { kind: 'gammal', fem: 0.03 };
  if (/barn|unge|pojk|flick|bebis|kid/.test(n)) return { kind: 'barn', fem: 0.5 };
  if (/mamma|kvinna|\bdam|tjej|\bfru\b/.test(n)) return { kind: 'kvinna', fem: 0.97 };
  if (/pappa|\bman\b|herr|kille/.test(n)) return { kind: 'man', fem: 0.03 };
  const first = (n.match(/[a-zåäöéü]+/) || [''])[0];
  if (F_NAMES.has(first)) return { kind: 'kvinna', fem: 0.97 };
  if (M_NAMES.has(first)) return { kind: 'man', fem: 0.03 };
  if (/^[@~#]/.test(n)) { // anonym talare (position/text): lite av varje
    const x = r();
    if (x < 0.1) return { kind: 'barn', fem: 0.5 };
    if (x < 0.22) return { kind: 'gammal', fem: r() };
    return { kind: r() < 0.5 ? 'kvinna' : 'man', fem: 0.5 };
  }
  const fem = /a$|ie$|y$|in$|elle$|ette$/.test(n.trim()) ? 0.72 : 0.38;
  return { kind: r() < fem ? 'kvinna' : 'man', fem };
}

// voiceFor(x) → { pitch, kind, seed }. x = look, avatar ({ name, look }), namn/sträng, tal,
// 'self' (den egna figuren) eller en färdig röst (returneras som den är). Alltid samma svar
// för samma person.
export function voiceFor(x) {
  if (x === 'self') return selfVoice();
  if (x && typeof x === 'object' && typeof x.pitch === 'number' && x.kind) return x;
  if (typeof x === 'number') x = '#' + x;
  if (x == null || x === '' || (typeof x !== 'string' && typeof x !== 'object')) x = '~neutral';
  let seed, info;
  if (typeof x === 'string') {
    seed = hashStr('röst:' + x.toLowerCase());
    info = kindFromName(x, rng(seed));
  } else {
    const L = x.look && typeof x.look === 'object' ? x.look : x;
    seed = hashStr('röst:' + stableKey(L) + '|' + (x.name || ''));
    const r = rng(seed);
    const fem = femOfLook(L);
    if (L.kid) info = { kind: 'barn', fem };
    else if (isGrey(L.hair) && !/bald|kal/.test(String(L.style || ''))) info = { kind: 'gammal', fem };
    else info = { kind: r() < fem ? 'kvinna' : 'man', fem };
  }
  const r = rng((seed ^ 0x5bd1e995) >>> 0);
  let range = PITCH[info.kind];
  if (info.kind === 'gammal') range = range[r() < info.fem ? 1 : 0];
  const pitch = Math.round(range[0] + (range[1] - range[0]) * r());
  return { pitch, kind: info.kind, seed };
}

// Den egna figuren: samma röst som avataren men mjukare (luftigare, mörkare, lugnare).
let selfOverride = null, selfCache = { raw: undefined, v: null };
export function setSelfVoice(x) { selfOverride = x ? { ...voiceFor(x), soft: true } : null; }
export function selfVoice() {
  if (selfOverride) return selfOverride;
  let raw = null;
  try { raw = localStorage.getItem('snabbfilen_avatar'); } catch { raw = null; }
  if (raw !== selfCache.raw) {
    let src = null;
    try { const a = JSON.parse(raw); if (a && a.look && typeof a.look === 'object') src = { name: a.name || '', look: a.look }; } catch { src = null; }
    selfCache = { raw, v: { ...voiceFor(src || '~jag'), soft: true } };
  }
  return selfCache.v;
}

// ---------------------------------------------------------------- ljudbitar
// Vokalernas formanter (Hz, vuxen man – skalas upp för kvinnor, barn och djur).
const VOW = {
  a: [700, 1150, 2450], e: [420, 2000, 2600], i: [300, 2250, 2950], o: [450, 800, 2450],
  u: [330, 750, 2350], ä: [580, 1700, 2500], ö: [430, 1450, 2350], y: [300, 1850, 2400], ə: [500, 1400, 2450],
};
// Konsonanter: plo = stöt (b d g p t k), nas = nasal, liq = l/r/w/j, fri = brus (s sj f v z), asp = h.
const CONS = {
  b: { k: 'plo', v: 1, burst: 900, F: [250, 900, 2200] },
  d: { k: 'plo', v: 1, burst: 3600, F: [260, 1700, 2600] },
  g: { k: 'plo', v: 1, burst: 2100, F: [260, 1900, 2300] },
  p: { k: 'plo', v: 0, burst: 1000 },
  t: { k: 'plo', v: 0, burst: 4600 },
  k: { k: 'plo', v: 0, burst: 2300 },
  m: { k: 'nas', F: [250, 1000, 2200] },
  n: { k: 'nas', F: [250, 1500, 2500] },
  l: { k: 'liq', F: [350, 1100, 2600] },
  r: { k: 'liq', F: [420, 1250, 1800], trill: true },
  w: { k: 'liq', F: [300, 650, 2200] },
  j: { k: 'liq', F: [280, 2150, 2900] },
  s: { k: 'fri', v: 0, f: 6200, q: 2.6, lvl: 0.55 },
  sj: { k: 'fri', v: 0, f: 3000, q: 1.7, lvl: 0.5 },
  f: { k: 'fri', v: 0, f: 4500, q: 0.6, lvl: 0.26 },
  v: { k: 'fri', v: 1, f: 4000, q: 0.7, lvl: 0.14, F: [300, 1100, 2300] },
  h: { k: 'asp' },
};
const ONSET_W = { b: 3, d: 3, g: 2, p: 1, t: 2, k: 2, m: 3, n: 3, l: 3, r: 1.2, w: 1.5, j: 1.2, s: 2, sj: 1.2, f: 1, v: 1.5, h: 1.3, '': 1.6 };
const VOWEL_W = { a: 3, e: 2, i: 2, o: 2, u: 1.4, ä: 1, ö: 0.7, y: 0.5, ə: 1.2 };
const CODA_W = { n: 3, m: 1.5, l: 2, s: 1.5, k: 1, r: 1 };

// Röstsorternas grundklang: fs = formantskala (kortare svalg = högre formanter), rate =
// stavelser/s, range = hur mycket tonen rör sig, breath = heshet, bright = klang (lågpass),
// trem = darr (äldre röster).
const BASE = {
  man: { fs: 1.0, rate: 5.3, range: 1.0, breath: 0.05, bright: 4200, trem: 0 },
  kvinna: { fs: 1.16, rate: 5.7, range: 1.15, breath: 0.08, bright: 5400, trem: 0 },
  barn: { fs: 1.32, rate: 6.2, range: 1.35, breath: 0.06, bright: 6200, trem: 0 },
  gammal: { fs: 1.0, rate: 4.5, range: 0.85, breath: 0.14, bright: 3600, trem: 0.028 },
};
function voiceParams(v) {
  const r = rng((v.seed ^ 0x27d4eb2f) >>> 0);
  const B = BASE[v.kind] || BASE.man;
  const P = {
    f0: clamp(v.pitch || 150, 60, 700),
    fs: B.fs * (0.95 + 0.1 * r()),
    rate: B.rate * (0.9 + 0.2 * r()),
    range: B.range * (0.75 + 0.55 * r()),
    breath: B.breath + 0.07 * r(),
    bright: B.bright * (0.85 + 0.3 * r()),
    trem: B.trem ? B.trem * (0.7 + 0.6 * r()) : 0,
    level: 1, cons: {}, vow: {},
  };
  if (v.kind === 'gammal' && P.f0 > 150) P.fs *= 1.12;
  // Nivåutjämning: ljusare röster fick ~5 dB mer per oktav (övertonerna träffar formanterna
  // bättre) – barn lät dubbelt så starka som män. Kompensera det mesta (ljusa röster uppfattas
  // ändå lite starkare, så en rest får vara kvar). Uppmätt i tools/out/roster/level.mjs.
  P.level = clamp(Math.pow(P.f0 / 150, -0.75), 0.5, 1.5);
  // personens egna favoritljud – samma person säger alltid "samma sorts" nonsens
  for (const [c, w] of Object.entries(ONSET_W)) P.cons[c] = w * (0.2 + 1.6 * Math.pow(r(), 1.4));
  for (const [c, w] of Object.entries(VOWEL_W)) P.vow[c] = w * (0.3 + 1.4 * r());
  if (v.soft) { P.rate *= 0.93; P.breath += 0.06; P.bright *= 0.78; P.level *= 0.84; P.range *= 0.9; P.soft = true; }
  return P;
}

// Humör: f0 = tonläge, range = melodins rörelse, rate = tempo, amp = styrka, bright = klang,
// end = slutmelodin (fall, uppåt vid fråga, studs när man är glad …)
const MOODS = {
  neutral: { f0: 1, range: 1, rate: 1, amp: 1, bright: 1, breath: 1, end: 'fall' },
  glad: { f0: 1.12, range: 1.5, rate: 1.07, amp: 1.05, bright: 1.1, breath: 1, end: 'bounce' },
  ivrig: { f0: 1.08, range: 1.3, rate: 1.1, amp: 1.1, bright: 1.15, breath: 0.9, end: 'peakfall' },
  sur: { f0: 0.9, range: 0.55, rate: 0.88, amp: 0.9, bright: 0.85, breath: 1.3, end: 'lowfall' },
  arg: { f0: 1.1, range: 1.15, rate: 1.18, amp: 1.28, bright: 1.45, breath: 0.6, end: 'peakfall' },
};
const EMO_GLAD = /[😀😃😄😁😆😊🙂😍🥰😘❤💖💕💗💛💙💚🎉🥳👍👋✨🌟😎🤩💃😂🤣😉😋🙌🎈]/u;
const EMO_ARG = /[😡😠🤬💢👿]/u;
const EMO_SUR = /[😕😒🙁☹😞😢😭😩😫👎😔😟😣😖🥺😐😑🙄]/u;
const PICTO = /\p{Extended_Pictographic}|\p{Regional_Indicator}|️|‍/gu;

// Texten → ord (stavelser + paus efter), fråga?, humör.
export function textInfo(text) {
  const s = String(text || '');
  const clean = s.replace(PICTO, ' ').replace(/…/g, '...');
  const tail = (clean.trim().match(/[.!?]+$/) || [''])[0];
  const question = tail.includes('?');
  const exclaim = /!/.test(clean);
  const mood = EMO_ARG.test(s) ? 'arg' : EMO_SUR.test(s) ? 'sur' : EMO_GLAD.test(s) ? 'glad' : exclaim ? 'ivrig' : 'neutral';
  const words = [];
  for (const tok of clean.split(/\s+/)) {
    if (!tok) continue;
    const letters = tok.replace(/[^0-9a-zåäöéüæø]/gi, '');
    let pause = 0;
    if (/\.\.\.["')]*$/.test(tok)) pause = 0.28;
    else if (/[.!?]+["')]*$/.test(tok)) pause = 0.2;
    else if (/[,;:]["')]*$/.test(tok) || /^[–-]$/.test(tok)) pause = 0.11;
    if (!letters) { if (pause && words.length) words[words.length - 1].pause = Math.max(words[words.length - 1].pause, pause); continue; }
    let syl = (letters.toLowerCase().match(/[aeiouyåäöéüæø]+/g) || []).length;
    for (const d of letters.match(/\d+/g) || []) syl += Math.min(3, d.length);
    words.push({ syl: clamp(syl, 1, 4), pause });
  }
  return { words, question, exclaim, mood };
}

// ---------------------------------------------------------------- kontext och buss
const KITS = new WeakMap();
function kit(c) {
  let k = KITS.get(c);
  if (k) return k;
  const n = Math.floor(c.sampleRate * 2), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  const r = rng(0x51f15e);
  for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
  // glottiskälla: övertoner som faller lite brantare än en sågtand (mjukare, mer röstlik)
  const N = 48, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
  for (let h = 1; h <= N; h++) im[h] = Math.pow(h, -1.25);
  const glot = c.createPeriodicWave(re, im);
  // pulskurva för spinnet: sinus → spetsiga positiva pulser 0..1
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.pow((i / (curve.length - 1)), 2.6);
  k = { noise: buf, glot, pulse: curve };
  KITS.set(c, k);
  return k;
}

let unlockedFlag = false;
if (typeof document !== 'undefined') {
  const on = () => { unlockedFlag = true; };
  try {
    document.addEventListener('pointerdown', on, { capture: true, passive: true });
    document.addEventListener('keydown', on, { capture: true, passive: true });
  } catch { /* ok */ }
}
const unlocked = () => unlockedFlag || !!(typeof navigator !== 'undefined' && navigator.userActivation && navigator.userActivation.hasBeenActive);

// Rösternas buss: in → begränsare (bara topparna när flera låter samtidigt) → trim → ut.
// Samma kedja i testerna (_render.chain) så att WAV-filerna låter som i spelet.
function makeChain(c, target, level = 1) {
  const input = c.createGain(); input.gain.value = 1;
  const lim = c.createDynamicsCompressor();
  lim.threshold.value = LIM.threshold; lim.knee.value = LIM.knee; lim.ratio.value = LIM.ratio;
  lim.attack.value = LIM.attack; lim.release.value = LIM.release;
  const trim = c.createGain(); trim.gain.value = (OUT_LEVEL * level) / LIM.makeup;
  input.connect(lim); lim.connect(trim); trim.connect(target);
  return { input, lim, trim };
}
let bus = null, chainNodes = null, busCtx = null, outTarget = null, userLevel = 1;
function live() {
  if (!unlocked()) { stats.locked++; return null; }
  if (typeof document !== 'undefined' && document.hidden) return null;
  let c = null;
  try { c = audioContext(); } catch { c = null; }
  if (!c || c.state === 'closed') return null;
  if (busCtx !== c) {
    busCtx = c;
    chainNodes = makeChain(c, outTarget && outTarget.context === c ? outTarget : c.destination, userLevel);
    bus = chainNodes.input;
  }
  return c;
}
// Om ljudet får en gemensam mixerbuss (t.ex. i sound.js): koppla rösterna dit i stället.
export function setVoicesOutput(node) {
  outTarget = node || null;
  if (!chainNodes) return;
  try { chainNodes.trim.disconnect(); chainNodes.trim.connect(outTarget && outTarget.context === busCtx ? outTarget : busCtx.destination); } catch { /* ok */ }
}
// Rösternas volym i mixen (1 = standard, 0 = tyst, högst 1,5) – för huvudmixern/inställningar.
export function setVoicesLevel(v) {
  userLevel = clamp(+v || 0, 0, 1.5);
  if (!chainNodes) return;
  try { chainNodes.trim.gain.setTargetAtTime((OUT_LEVEL * userLevel) / LIM.makeup, busCtx.currentTime, 0.05); } catch { /* ok */ }
}

// ---------------------------------------------------------------- röstmotorn
// Källa (glottis + andning) → amp → tre parallella formantfilter → lågpass → ut.
// Brus → asp (h, stötarnas aspiration) → formanterna. Brus → bandpass → fric (s, sj, stötar) → ut.
function multi(a, b, k) { // styr två frekvenser (grundton + undertonen en oktav ner) som en
  return {
    setValueAtTime(v, t) { a.setValueAtTime(v, t); b.setValueAtTime(v * k, t); },
    setTargetAtTime(v, t, tau) { a.setTargetAtTime(v, t, tau); b.setTargetAtTime(v * k, t, tau); },
    linearRampToValueAtTime(v, t) { a.linearRampToValueAtTime(v, t); b.linearRampToValueAtTime(v * k, t); },
  };
}
function engine(c, dest, t0, o = {}) {
  const K = kit(c), nodes = [], srcs = [];
  const mk = (n) => { nodes.push(n); return n; };
  const out = mk(c.createGain()); out.gain.value = o.level ?? 0.5; out.connect(dest);
  const lp = mk(c.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = clamp(o.lp || 5000, 400, c.sampleRate * 0.45); lp.Q.value = 0.5; lp.connect(out);
  const bank = mk(c.createGain());
  const F = [], Q = [], FG = o.fg || [1, -0.55, 0.32];
  for (let i = 0; i < 3; i++) {
    const bp = mk(c.createBiquadFilter()); bp.type = 'bandpass'; bp.Q.value = 6;
    const g = mk(c.createGain()); g.gain.value = FG[i];
    bank.connect(bp); bp.connect(g); g.connect(lp);
    F.push(bp.frequency); Q.push(bp.Q);
  }
  const osc = mk(c.createOscillator()); osc.setPeriodicWave(K.glot); srcs.push(osc);
  const src = mk(c.createGain()); osc.connect(src);
  let sub = null;
  if (o.sub) {
    sub = mk(c.createOscillator()); sub.setPeriodicWave(K.glot); srcs.push(sub);
    const sg = mk(c.createGain()); sg.gain.value = o.sub; sub.connect(sg); sg.connect(src);
  }
  const noise = mk(c.createBufferSource()); noise.buffer = K.noise; noise.loop = true; srcs.push(noise);
  const breath = mk(c.createGain()); breath.gain.value = o.breath ?? 0.05; noise.connect(breath); breath.connect(src);
  const amp = mk(c.createGain()); amp.gain.value = 0; src.connect(amp);
  let tail = amp;
  if (o.am) { // grovhet (morr): amplituden skakar
    const am = mk(c.createGain()); am.gain.value = 1 - o.am.depth; amp.connect(am); tail = am;
    const lfo = mk(c.createOscillator()); lfo.frequency.value = o.am.rate; srcs.push(lfo);
    const lg = mk(c.createGain()); lg.gain.value = o.am.depth; lfo.connect(lg); lg.connect(am.gain);
  }
  tail.connect(bank);
  const asp = mk(c.createGain()); asp.gain.value = 0; noise.connect(asp); asp.connect(bank);
  const fbp = mk(c.createBiquadFilter()); fbp.type = 'bandpass'; fbp.frequency.value = 5000; fbp.Q.value = 1.5;
  const fric = mk(c.createGain()); fric.gain.value = 0; noise.connect(fbp); fbp.connect(fric); fric.connect(out);
  if (o.vib) { // darr i rösten
    const lfo = mk(c.createOscillator()); lfo.frequency.value = o.vib.rate; srcs.push(lfo);
    const lg = mk(c.createGain()); lg.gain.value = o.vib.depth; lfo.connect(lg); lg.connect(osc.frequency);
    if (sub) { const lg2 = mk(c.createGain()); lg2.gain.value = o.vib.depth / 2; lfo.connect(lg2); lg2.connect(sub.frequency); }
  }
  const f0 = sub ? multi(osc.frequency, sub.frequency, 0.5) : osc.frequency;
  for (const s of srcs) s.start(t0, s === noise ? (o.noiseAt ?? 0) : 0);
  return {
    F, Q, f0, amp: amp.gain, asp: asp.gain, fric: fric.gain, fricF: fbp.frequency, fricQ: fbp.Q, lpF: lp.frequency,
    h: { srcs, nodes, outs: [out], end: t0 },
    finish(tEnd) { for (const s of srcs) s.stop(tEnd); this.h.end = tEnd; return this.h; },
  };
}
function setQ(E, fs, f0, wide = 1) {
  const AVG = [500, 1500, 2500], BWMIN = [80, 110, 170], BWK = [0.7, 0.9, 1.1];
  for (let i = 0; i < 3; i++) E.Q[i].value = clamp((AVG[i] * fs) / (Math.max(BWMIN[i], f0 * BWK[i]) * wide), 1.2, 18);
}
function setF(E, vals, t, tau, fs) { for (let i = 0; i < 3; i++) E.F[i].setTargetAtTime(vals[i] * fs, t, tau); }

// ---------------------------------------------------------------- babbel
function babbleAt(c, dest, t0, text, voice, moodIn) {
  const v = voiceFor(voice);
  const V = voiceParams(v);
  const T = textInfo(text);
  const mood = MOODS[moodIn] ? moodIn : T.mood;
  const M = MOODS[mood];
  const endKind = T.question ? 'rise' : M.end;
  const r = rng((hashStr(String(text)) ^ v.seed) >>> 0);
  const rate = V.rate * M.rate;
  // 1) stavelserna i tid (sekunder från start)
  const plan = [];
  let t = 0.015;
  outer: for (const w of T.words) {
    for (let i = 0; i < w.syl; i++) {
      const stress = i === 0 && (w.syl > 1 || r() < 0.55);
      const d = (stress ? 1.22 : 0.84) * (0.86 + 0.28 * r()) / rate;
      if (plan.length && t + d > MAX_TAL - 0.14) break outer;
      plan.push({ t, d, stress, on: wpick(r, V.cons), v: wpick(r, V.vow), coda: r() < 0.2 ? wpick(r, CODA_W) : '', gap: 0 });
      t += d;
    }
    const gap = w.pause || (r() < 0.22 ? 0.04 + 0.07 * r() : 0);
    if (plan.length && gap) { plan[plan.length - 1].gap = gap; t += gap; }
  }
  if (!plan.length) plan.push({ t, d: 0.24, stress: true, on: 'm', v: 'ə', coda: '', gap: 0 });
  const L = plan[plan.length - 1];
  L.gap = 0; L.d *= 1.3; L.last = true;
  const dur = L.t + L.d + 0.04;
  // 2) motorn
  const E = engine(c, dest, t0, {
    lp: V.bright * M.bright, breath: V.breath * M.breath, level: LEVEL.babble * V.level * M.amp,
    vib: V.trem ? { rate: 5 + r() * 1.5, depth: V.trem * V.f0 } : null, noiseAt: r() * 1.5,
  });
  const fs = V.fs, F0 = V.f0 * M.f0, acc = V.range * M.range;
  setQ(E, fs, F0);
  const v0 = VOW[plan[0].v];
  for (let i = 0; i < 3; i++) E.F[i].setValueAtTime(v0[i] * fs, t0);
  E.f0.setValueAtTime(F0, t0);
  E.amp.setValueAtTime(0, t0); E.asp.setValueAtTime(0, t0); E.fric.setValueAtTime(0, t0);
  const sq = Math.sqrt(fs), soft = V.soft ? 1.6 : 1;
  for (const s of plan) {
    const ts = t0 + s.t, te = ts + s.d;
    const A = (s.stress ? 1 : 0.74) * (0.92 + 0.16 * r());
    const decl = 1.05 - 0.11 * (s.t / dur); // tonen sjunker långsamt genom repliken
    let tv = ts;
    const C = CONS[s.on];
    if (C) {
      if (C.k === 'plo') {
        const clos = 0.026 + 0.014 * r(), tb = ts + clos;
        E.amp.setTargetAtTime(0, ts, 0.006);
        E.fricF.setValueAtTime(C.burst * sq, tb - 0.002); E.fricQ.setValueAtTime(1.2, tb - 0.002);
        E.fric.setTargetAtTime(0.9 * A / soft, tb, 0.0015);
        E.fric.setTargetAtTime(0, tb + 0.006, 0.006);
        if (C.v) { setF(E, C.F, ts, 0.01, fs); tv = tb + 0.004; }
        else { E.asp.setTargetAtTime(0.5 * A, tb + 0.004, 0.004); E.asp.setTargetAtTime(0, tb + 0.028, 0.008); tv = tb + 0.03; }
      } else if (C.k === 'nas') {
        E.amp.setTargetAtTime(0.32 * A, ts, 0.01); setF(E, C.F, ts, 0.012, fs); tv = ts + 0.045 + 0.02 * r();
      } else if (C.k === 'liq') {
        E.amp.setTargetAtTime(0.55 * A, ts, 0.01); setF(E, C.F, ts, 0.012, fs); tv = ts + 0.035 + 0.015 * r();
        if (C.trill) { E.amp.setTargetAtTime(0.15 * A, ts + 0.012, 0.004); E.amp.setTargetAtTime(0.55 * A, ts + 0.024, 0.004); }
      } else if (C.k === 'fri') {
        const fd = 0.05 + 0.025 * r();
        E.amp.setTargetAtTime(C.v ? 0.22 * A : 0, ts, 0.01);
        if (C.F) setF(E, C.F, ts, 0.012, fs);
        E.fricF.setValueAtTime(C.f * sq, ts); E.fricQ.setValueAtTime(C.q, ts);
        E.fric.setTargetAtTime(C.lvl * A / soft, ts, 0.01);
        E.fric.setTargetAtTime(0, ts + fd, 0.008);
        tv = ts + fd;
      } else if (C.k === 'asp') {
        E.amp.setTargetAtTime(0.04, ts, 0.01); setF(E, VOW[s.v], ts, 0.01, fs);
        E.asp.setTargetAtTime(0.35 * A, ts, 0.008); E.asp.setTargetAtTime(0, ts + 0.04, 0.01);
        tv = ts + 0.045;
      }
    }
    tv = Math.min(tv, te - 0.05);
    const vE = te - (s.coda ? 0.045 : 0);
    // vokalen: formanterna glider dit (samartikulation), rösten sätter i och klingar av
    setF(E, VOW[s.v], tv - 0.005, 0.02, fs);
    E.amp.setTargetAtTime(A, tv, (s.stress ? 0.012 : 0.016) * soft);
    E.amp.setTargetAtTime(A * 0.68, tv + (vE - tv) * 0.55, 0.04);
    // melodin
    const span = Math.max(0.06, vE - tv);
    if (s.last) {
      if (endKind === 'rise') { E.f0.setTargetAtTime(F0 * decl, tv - 0.01, 0.03); E.f0.setTargetAtTime(F0 * (1.45 + 0.15 * acc), tv + span * 0.2, span * 0.35); }
      else if (endKind === 'bounce') { E.f0.setTargetAtTime(F0 * (1.18 + 0.12 * acc), tv - 0.01, 0.025); E.f0.setTargetAtTime(F0 * 0.92, tv + span * 0.45, span * 0.3); }
      else if (endKind === 'peakfall') { E.f0.setTargetAtTime(F0 * (1.15 + 0.1 * acc), tv - 0.01, 0.02); E.f0.setTargetAtTime(F0 * 0.78, tv + span * 0.3, span * 0.3); }
      else if (endKind === 'lowfall') { E.f0.setTargetAtTime(F0 * 0.96, tv - 0.01, 0.03); E.f0.setTargetAtTime(F0 * 0.7, tv + span * 0.1, span * 0.45); }
      else { E.f0.setTargetAtTime(F0 * decl * 1.03, tv - 0.01, 0.03); E.f0.setTargetAtTime(F0 * 0.8, tv + span * 0.3, span * 0.4); }
    } else if (s.stress) {
      E.f0.setTargetAtTime(F0 * decl * (1 + 0.2 * acc * (0.55 + 0.45 * r())), tv - 0.015, 0.03);
      E.f0.setTargetAtTime(F0 * decl * (0.97 + 0.03 * r()), tv + span * 0.6, 0.05);
    } else {
      E.f0.setTargetAtTime(F0 * decl * (1 + 0.06 * acc * (r() * 2 - 1)), ts, 0.035);
    }
    // slutkonsonanten
    if (s.coda) {
      const K = CONS[s.coda];
      if (K.k === 'nas' || K.k === 'liq') { E.amp.setTargetAtTime(0.3 * A, vE, 0.01); setF(E, K.F, vE, 0.012, fs); }
      else if (K.k === 'fri') {
        E.amp.setTargetAtTime(0, vE, 0.008);
        E.fricF.setValueAtTime(K.f * sq, vE); E.fricQ.setValueAtTime(K.q, vE);
        E.fric.setTargetAtTime(K.lvl * A * 0.8 / soft, vE, 0.008); E.fric.setTargetAtTime(0, te - 0.006, 0.006);
      } else if (K.k === 'plo') {
        E.amp.setTargetAtTime(0, vE, 0.005);
        E.fricF.setValueAtTime(K.burst * sq, te - 0.014); E.fricQ.setValueAtTime(1.2, te - 0.014);
        E.fric.setTargetAtTime(0.5 * A / soft, te - 0.012, 0.002); E.fric.setTargetAtTime(0, te - 0.006, 0.005);
      }
    }
    if (s.gap || s.last) E.amp.setTargetAtTime(0, te - 0.012, s.last ? 0.028 : 0.012);
  }
  const tEnd = t0 + dur + 0.16;
  E.amp.setValueAtTime(0, tEnd - 0.02); E.fric.setValueAtTime(0, tEnd - 0.02); E.asp.setValueAtTime(0, tEnd - 0.02);
  return E.finish(tEnd);
}

// ---------------------------------------------------------------- hundar
const DOGS = {
  valp: { f0: 1150, fs: 1.75, dur: 0.1, n: [2, 3], gap: 0.13, noise: 0.12, sub: 0, v: ['i', 'a'], lp: 7000 },
  liten: { f0: 800, fs: 1.55, dur: 0.11, n: [2, 3], gap: 0.16, noise: 0.25, sub: 0, v: ['e', 'a'], lp: 6500 },
  tax: { f0: 560, fs: 1.35, dur: 0.12, n: [3, 4], gap: 0.15, noise: 0.35, sub: 0.15, v: ['ä', 'a'], lp: 6000 },
  mellan: { f0: 400, fs: 1.15, dur: 0.16, n: [2, 2], gap: 0.26, noise: 0.4, sub: 0.25, v: ['a', 'o'], lp: 5000 },
  stor: { f0: 210, fs: 0.9, dur: 0.22, n: [2, 2], gap: 0.34, noise: 0.45, sub: 0.45, v: ['o', 'u'], lp: 3800, voff: true },
};
const DOG_SORT = {
  valp: 'valp', unge: 'valp', liten: 'liten', tax: 'tax', mellan: 'mellan', stor: 'stor',
  chihuahua: 'liten', jack: 'liten', mops: 'liten', corgi: 'tax', pudel: 'mellan', blandras: 'mellan', collie: 'mellan',
  labrador: 'stor', golden: 'stor', schafer: 'stor', husky: 'stor', s: 'liten', t: 'tax', m: 'mellan', l: 'stor', xl: 'stor',
};
export function dogSort(x) {
  if (x && typeof x === 'object') {
    if (x.stage === 'unge') return 'valp';
    return DOG_SORT[String(x.sort || x.breed || '').toLowerCase()] || DOG_SORT[String(x.size || '').toLowerCase()] || 'mellan';
  }
  return DOG_SORT[String(x || '').toLowerCase()] || 'mellan';
}
// vary ≠ 0: samma djur (samma röst från seed) men ett nytt skall/jam – annars låter
// varje klick exakt likadant. vary = 0 → helt deterministiskt (testerna).
const varied = (seed, vary) => rng((seed ^ Math.imul(vary | 0, 0x9e3779b1)) >>> 0);
function barkAt(c, dest, t0, sort, mood, seed, vary = 0) {
  const D = DOGS[dogSort(sort)], r0 = rng(seed);
  const glad = mood === 'glad', ind = 0.94 + 0.12 * r0(); // individens röst
  const r = vary ? varied(seed, vary) : r0;
  let n = D.n[0] + Math.floor(r() * (D.n[1] - D.n[0] + 1)) + (glad ? 1 : 0);
  const f0 = D.f0 * ind * (glad ? 1.08 : 1) * (sort && sort.stage === 'ung' ? 1.12 : 1);
  const E = engine(c, dest, t0, { lp: D.lp, breath: 0.08, sub: D.sub || 0, level: LEVEL.bark, noiseAt: r() });
  setQ(E, D.fs, f0, 1.4);
  const V0 = VOW[D.v[0]], V1 = VOW[D.v[1]], VC = VOW.u;
  for (let i = 0; i < 3; i++) E.F[i].setValueAtTime(V0[i] * D.fs, t0);
  E.f0.setValueAtTime(f0, t0);
  E.amp.setValueAtTime(0, t0); E.asp.setValueAtTime(0, t0); E.fric.setValueAtTime(0, t0);
  let t = t0 + 0.01;
  for (let j = 0; j < n; j++) {
    const d = D.dur * (0.85 + 0.3 * r()), jf = 0.94 + 0.12 * r(), A = j === 0 ? 1 : 0.8 + 0.2 * r();
    E.f0.setValueAtTime(f0 * 0.82 * jf, t);
    E.f0.setTargetAtTime(f0 * 1.12 * jf, t, 0.012);
    E.f0.setTargetAtTime(f0 * 0.68 * jf, t + d * 0.4, d * 0.35);
    E.amp.setTargetAtTime(A, t, 0.004);
    E.amp.setTargetAtTime(A * 0.5, t + d * 0.35, d * 0.2);
    E.amp.setTargetAtTime(0, t + d * 0.72, d * 0.12);
    E.asp.setTargetAtTime(D.noise * 1.5 * A, t - 0.002, 0.003);
    E.asp.setTargetAtTime(D.noise * 0.5 * A, t + 0.02, 0.02);
    E.asp.setTargetAtTime(0, t + d * 0.7, 0.02);
    for (let i = 0; i < 3; i++) {
      E.F[i].setTargetAtTime(V0[i] * D.fs * 0.85, t - 0.004, 0.003);
      E.F[i].setTargetAtTime(V1[i] * D.fs, t + 0.006, d * 0.25);
      E.F[i].setTargetAtTime(VC[i] * D.fs, t + d * 0.6, d * 0.2);
    }
    if (D.voff) { // "voff": luften som pyser ut efteråt
      E.fricF.setValueAtTime(1700 * D.fs, t + d * 0.62); E.fricQ.setValueAtTime(0.8, t + d * 0.62);
      E.fric.setTargetAtTime(0.1 * A, t + d * 0.65, 0.015); E.fric.setTargetAtTime(0, t + d * 0.95, 0.03);
    }
    t += d + D.gap * (glad ? 0.85 : 1) * (0.85 + 0.3 * r());
  }
  return E.finish(t + 0.2);
}
function growlAt(c, dest, t0, sort, seed, dur = 0.75) {
  const D = DOGS[dogSort(sort)], r = rng(seed ^ 0x9e37);
  const f0 = Math.max(70, D.f0 * 0.34 * (0.92 + 0.16 * r()));
  const E = engine(c, dest, t0, { lp: D.lp * 0.6, breath: 0.3, sub: 0.7, am: { rate: 26 + 10 * r(), depth: 0.42 }, level: LEVEL.growl, noiseAt: r() });
  setQ(E, D.fs, f0, 1.2);
  for (let i = 0; i < 3; i++) E.F[i].setValueAtTime(VOW.o[i] * D.fs, t0);
  E.f0.setValueAtTime(f0, t0);
  E.amp.setValueAtTime(0, t0); E.asp.setValueAtTime(0, t0); E.fric.setValueAtTime(0, t0);
  E.amp.setTargetAtTime(0.9, t0, 0.04);
  E.asp.setTargetAtTime(0.18, t0, 0.05);
  for (let k = 1; k <= 3; k++) E.f0.setTargetAtTime(f0 * (0.93 + 0.14 * r()), t0 + dur * k / 4, 0.06);
  setF(E, VOW.ə, t0 + dur * 0.5, dur * 0.3, D.fs);
  E.amp.setTargetAtTime(0, t0 + dur * 0.82, dur * 0.07);
  E.asp.setTargetAtTime(0, t0 + dur * 0.82, dur * 0.07);
  const tEnd = t0 + dur + 0.15;
  E.amp.setValueAtTime(0, tEnd - 0.02); E.asp.setValueAtTime(0, tEnd - 0.02);
  return E.finish(tEnd);
}
function whineAt(c, dest, t0, sort, seed, yawn = false) {
  const D = DOGS[dogSort(sort)], r = rng(seed ^ 0x7f4a);
  const f0 = clamp(D.f0 * (yawn ? 1.1 : 1.6), yawn ? 300 : 650, 1600) * (0.94 + 0.12 * r());
  const dur = yawn ? 0.95 : 0.62 + 0.2 * r();
  const E = engine(c, dest, t0, { lp: 5000, breath: yawn ? 0.4 : 0.05, fg: [1, -0.35, 0.12], level: LEVEL.whine, vib: { rate: 6.5, depth: f0 * 0.035 }, noiseAt: r() });
  setQ(E, D.fs, f0, 1.3);
  const A0 = yawn ? VOW.a : VOW.i, A1 = VOW.u;
  for (let i = 0; i < 3; i++) E.F[i].setValueAtTime(A0[i] * D.fs, t0);
  E.f0.setValueAtTime(f0 * (yawn ? 1.25 : 0.9), t0);
  E.f0.setTargetAtTime(f0 * (yawn ? 0.55 : 1.15), t0 + 0.05, dur * 0.3);
  E.f0.setTargetAtTime(f0 * (yawn ? 0.5 : 0.85), t0 + dur * 0.6, dur * 0.2);
  E.amp.setValueAtTime(0, t0); E.asp.setValueAtTime(0, t0); E.fric.setValueAtTime(0, t0);
  E.amp.setTargetAtTime(yawn ? 0.7 : 0.9, t0, 0.05);
  if (yawn) { E.asp.setTargetAtTime(0.25, t0, 0.06); E.asp.setTargetAtTime(0, t0 + dur * 0.7, 0.08); }
  setF(E, A1, t0 + dur * 0.55, dur * 0.18, D.fs);
  E.amp.setTargetAtTime(0, t0 + dur * 0.8, dur * 0.07);
  if (yawn) { // litet pip i slutet av gäspningen
    E.f0.setTargetAtTime(f0 * 1.3, t0 + dur * 0.84, 0.02);
    E.amp.setTargetAtTime(0.35, t0 + dur * 0.85, 0.01); E.amp.setTargetAtTime(0, t0 + dur * 0.93, 0.015);
  }
  const tEnd = t0 + dur + 0.15;
  E.amp.setValueAtTime(0, tEnd - 0.02); E.asp.setValueAtTime(0, tEnd - 0.02);
  return E.finish(tEnd);
}

// ---------------------------------------------------------------- katter
function meowAt(c, dest, t0, sort, mood, seed, vary = 0) {
  const r0 = rng(seed ^ 0x3c6e), kitten = sort === 'unge' || sort === 'kattunge' || (sort && sort.stage === 'unge');
  const glad = mood === 'glad', hungry = mood === 'hungrig';
  const r = vary ? varied(seed ^ 0x3c6e, vary) : r0;
  const f0 = (kitten ? 780 : 560) * (0.9 + 0.2 * r0()) * (vary ? 0.96 + 0.08 * r() : 1);
  const fs = kitten ? 1.9 : 1.6;
  const dur = (kitten ? 0.42 : 0.66) * (hungry ? 1.45 : glad ? 0.72 : 1) * (0.9 + 0.2 * r());
  const E = engine(c, dest, t0, { lp: 6500, breath: 0.07, fg: [1, -0.6, 0.35], level: LEVEL.meow, noiseAt: r() });
  setQ(E, fs, f0, 1.2);
  const Fm = CONS.m.F;
  for (let i = 0; i < 3; i++) E.F[i].setValueAtTime(Fm[i] * fs, t0);
  E.f0.setValueAtTime(f0 * (glad ? 0.9 : 0.75), t0);
  E.f0.setTargetAtTime(f0 * (glad ? 1.35 : 1.25), t0 + 0.03, dur * 0.25);
  E.f0.setTargetAtTime(f0 * (glad ? 1.1 : 0.8), t0 + dur * 0.55, dur * 0.25);
  E.amp.setValueAtTime(0, t0); E.asp.setValueAtTime(0, t0); E.fric.setValueAtTime(0, t0);
  E.amp.setTargetAtTime(0.25, t0, 0.01);
  E.amp.setTargetAtTime(1, t0 + dur * 0.12, 0.03);
  E.amp.setTargetAtTime(0.7, t0 + dur * 0.6, dur * 0.15);
  E.amp.setTargetAtTime(0, t0 + dur * 0.85, dur * 0.06);
  setF(E, VOW.i, t0 + dur * 0.1, 0.02, fs);
  setF(E, VOW.a, t0 + dur * 0.28, dur * 0.12, fs);
  setF(E, VOW.u, t0 + dur * 0.7, dur * 0.1, fs);
  if (glad) { // "mrrp": en liten drill i början
    E.amp.setTargetAtTime(0.2, t0 + 0.03, 0.004); E.amp.setTargetAtTime(0.5, t0 + 0.05, 0.004);
    E.amp.setTargetAtTime(0.2, t0 + 0.07, 0.004); E.amp.setTargetAtTime(1, t0 + 0.09, 0.01);
  }
  const tEnd = t0 + dur + 0.15;
  E.amp.setValueAtTime(0, tEnd - 0.02);
  return E.finish(tEnd);
}
// Spinn: brus genom lågpass, pulsat 22–27 gånger i sekunden (struphuvudet), i andetag
// (in lite svagare och lägre, ut starkare), mjukt in och ut.
function purrAt(c, dest, t0, secs = 3, seed = 1) {
  const K = kit(c), r = rng(seed ^ 0x2545), nodes = [], srcs = [];
  const mk = (n) => { nodes.push(n); return n; };
  secs = clamp(+secs || 3, 0.6, 20);
  const out = mk(c.createGain()); out.gain.value = LEVEL.purr; out.connect(dest);
  const env = mk(c.createGain()); env.gain.value = 0; env.connect(out);
  const body = mk(c.createBiquadFilter()); body.type = 'lowpass'; body.frequency.value = 460; body.Q.value = 1.1; body.connect(env);
  const am = mk(c.createGain()); am.gain.value = 0; am.connect(body);
  const noise = mk(c.createBufferSource()); noise.buffer = K.noise; noise.loop = true; srcs.push(noise);
  const nlp = mk(c.createBiquadFilter()); nlp.type = 'lowpass'; nlp.frequency.value = 1100; noise.connect(nlp); nlp.connect(am);
  const lfo = mk(c.createOscillator()); lfo.frequency.value = 25; srcs.push(lfo);
  const sh = mk(c.createWaveShaper()); sh.curve = K.pulse; lfo.connect(sh); sh.connect(am.gain);
  let t = t0; const T = t0 + secs;
  env.gain.setValueAtTime(0, t0);
  let inhale = r() < 0.5;
  while (t < T - 0.15) {
    const d = Math.min(T - t, inhale ? 0.8 + 0.3 * r() : 1.0 + 0.35 * r());
    const lvl = inhale ? 0.55 + 0.1 * r() : 0.95 + 0.05 * r();
    env.gain.setTargetAtTime(lvl, t, 0.07);
    if (t + d < T - 0.15) env.gain.setTargetAtTime(lvl * 0.35, t + d - 0.08, 0.03); // andhämtning
    lfo.frequency.setTargetAtTime(inhale ? 22.5 + r() : 25.5 + r(), t, 0.05);
    t += d; inhale = !inhale;
  }
  env.gain.setTargetAtTime(0, T - 0.22, 0.07);
  env.gain.setValueAtTime(0, T + 0.3);
  for (const s of srcs) s.start(t0, s === noise ? r() * 1.5 : 0);
  for (const s of srcs) s.stop(T + 0.32);
  return { srcs, nodes, outs: [out], end: T + 0.32 };
}
function hissAt(c, dest, t0, dur = 0.75, level = LEVEL.hiss) {
  const K = kit(c), nodes = [], srcs = [];
  const mk = (n) => { nodes.push(n); return n; };
  const out = mk(c.createGain()); out.gain.value = level; out.connect(dest);
  const env = mk(c.createGain()); env.gain.value = 0; env.connect(out);
  const hp = mk(c.createBiquadFilter()); hp.type = 'highpass'; hp.frequency.value = 2200; hp.Q.value = 0.7; hp.connect(env);
  const noise = mk(c.createBufferSource()); noise.buffer = K.noise; noise.loop = true; noise.connect(hp); srcs.push(noise);
  env.gain.setValueAtTime(0, t0);
  env.gain.setTargetAtTime(1.4, t0, 0.006);            // fräset börjar med en spottning
  env.gain.setTargetAtTime(0.9, t0 + 0.04, 0.03);
  env.gain.setTargetAtTime(0, t0 + dur * 0.6, dur * 0.14);
  env.gain.setValueAtTime(0, t0 + dur + 0.12);
  noise.start(t0, 0.3); noise.stop(t0 + dur + 0.14);
  return { srcs, nodes, outs: [out], end: t0 + dur + 0.14 };
}

// ---------------------------------------------------------------- små djur
// En enkel ton med tonhöjdsglid och kort envelope, flera i följd (kvitter, blubb, pip).
function tonesAt(c, dest, t0, notes, { type = 'sine', level = 0.2, lp = 0 } = {}) {
  const nodes = [], srcs = [];
  const mk = (n) => { nodes.push(n); return n; };
  const out = mk(c.createGain()); out.gain.value = level; out.connect(dest);
  let tail = out;
  if (lp) { const f = mk(c.createBiquadFilter()); f.type = 'lowpass'; f.frequency.value = lp; f.connect(out); tail = f; }
  const g = mk(c.createGain()); g.gain.value = 0; g.connect(tail);
  const o = mk(c.createOscillator()); o.type = type; o.connect(g); srcs.push(o);
  let end = t0;
  o.frequency.setValueAtTime(notes[0]?.f1 || 1000, t0);
  g.gain.setValueAtTime(0, t0);
  for (const n of notes) {
    const t = t0 + n.t;
    o.frequency.setValueAtTime(n.f1, t);
    if (n.f2) o.frequency.exponentialRampToValueAtTime(n.f2, t + n.d);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(n.a ?? 1, t + (n.att ?? 0.005));
    g.gain.setTargetAtTime(0, t + n.d * 0.6, n.d * 0.18);
    end = Math.max(end, t + n.d);
  }
  g.gain.setValueAtTime(0, end + 0.06);
  o.start(t0); o.stop(end + 0.08);
  return { srcs, nodes, outs: [out], end: end + 0.08 };
}
function chirpAt(c, dest, t0, seed) {
  const r = rng(seed ^ 0x1b873593), notes = [];
  const base = 2900 + 2300 * r(), kind = r();
  let t = 0;
  if (kind < 0.4) { // "kvitt kvitt": uppåtsvep
    const n = 3 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) { const d = 0.045 + 0.03 * r(); notes.push({ t, d, f1: base * 0.8, f2: base * (1.2 + 0.1 * r()), a: 0.7 + 0.3 * r() }); t += d + 0.06 + 0.05 * r(); }
  } else if (kind < 0.7) { // "tsip": nedåtsvep
    const n = 2 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) { const d = 0.035 + 0.02 * r(); notes.push({ t, d, f1: base * 1.35, f2: base * 0.82, a: 0.8 }); t += d + 0.08 + 0.06 * r(); }
  } else { // drill + avslutande svep
    const n = 9 + Math.floor(r() * 8);
    for (let i = 0; i < n; i++) { const d = 0.018; notes.push({ t, d, f1: base * (i % 2 ? 1.08 : 0.94), f2: base * (i % 2 ? 0.98 : 1.02), a: 0.6 + 0.4 * (i / n) }); t += d + 0.013; }
    notes.push({ t: t + 0.03, d: 0.12, f1: base * 1.3, f2: base * 0.7, a: 1 });
  }
  return tonesAt(c, dest, t0, notes, { level: LEVEL.chirp });
}
function cooAt(c, dest, t0, seed) {
  const r = rng(seed ^ 0x68e31da4), nodes = [], srcs = [];
  const mk = (n) => { nodes.push(n); return n; };
  const out = mk(c.createGain()); out.gain.value = LEVEL.coo; out.connect(dest);
  const lp = mk(c.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.7; lp.connect(out);
  const am = mk(c.createGain()); am.gain.value = 0.75; am.connect(lp);
  const lfo = mk(c.createOscillator()); lfo.frequency.value = 13 + 4 * r(); srcs.push(lfo);
  const lg = mk(c.createGain()); lg.gain.value = 0.25; lfo.connect(lg); lg.connect(am.gain);
  const g = mk(c.createGain()); g.gain.value = 0; g.connect(am);
  const o = mk(c.createOscillator()); o.type = 'triangle'; o.connect(g); srcs.push(o);
  const f = 400 + 90 * r();
  const parts = [[0, 0.32, [0.95, 1.12, 1.02]], [0.42, 0.28, [1.05, 0.9]], [0.82, 0.17, [1.0, 0.88]]];
  o.frequency.setValueAtTime(f, t0); g.gain.setValueAtTime(0, t0);
  for (const [at, d, cont] of parts) {
    const t = t0 + at;
    o.frequency.setValueAtTime(f * cont[0], t);
    cont.slice(1).forEach((k, i, arr) => o.frequency.linearRampToValueAtTime(f * k, t + d * (i + 1) / arr.length));
    g.gain.setTargetAtTime(1, t, 0.025);
    g.gain.setTargetAtTime(0, t + d * 0.75, d * 0.12);
  }
  const end = t0 + 1.1;
  g.gain.setValueAtTime(0, end - 0.02);
  for (const s of srcs) { s.start(t0); s.stop(end); }
  return { srcs, nodes, outs: [out], end };
}
function blubbAt(c, dest, t0, seed) {
  const r = rng(seed ^ 0x85ebca6b), notes = [];
  let t = 0;
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) { const f = 260 + 260 * r(); notes.push({ t, d: 0.03 + 0.015 * r(), f1: f, f2: f * (2.2 + 0.6 * r()), a: 0.6 + 0.4 * r(), att: 0.003 }); t += 0.07 + 0.12 * r(); }
  return tonesAt(c, dest, t0, notes, { level: LEVEL.blubb });
}
function squeakAt(c, dest, t0, seed) {
  const r = rng(seed ^ 0xc2b2ae35), notes = [];
  let t = 0;
  const n = 2 + Math.floor(r() * 2), f = 1600 + 600 * r();
  for (let i = 0; i < n; i++) { const d = 0.07 + 0.08 * r(); notes.push({ t, d, f1: f, f2: f * (1.35 + 0.2 * r()), a: 0.9, att: 0.01 }); t += d + 0.06; }
  return tonesAt(c, dest, t0, notes, { type: 'triangle', level: LEVEL.squeak, lp: 5000 });
}
// Kaninens nos: små snabba snusningar i grupper.
function snuffAt(c, dest, t0, seed) {
  const K = kit(c), r = rng(seed ^ 0x27d4), nodes = [], srcs = [];
  const mk = (n) => { nodes.push(n); return n; };
  const out = mk(c.createGain()); out.gain.value = LEVEL.snuff; out.connect(dest);
  const env = mk(c.createGain()); env.gain.value = 0; env.connect(out);
  const bp = mk(c.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 4500; bp.Q.value = 1.4; bp.connect(env);
  const noise = mk(c.createBufferSource()); noise.buffer = K.noise; noise.loop = true; noise.connect(bp); srcs.push(noise);
  let t = t0 + 0.01;
  env.gain.setValueAtTime(0, t0);
  const groups = 2 + (r() < 0.4 ? 1 : 0);
  for (let gi = 0; gi < groups; gi++) {
    const n = 3 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      bp.frequency.setValueAtTime(3800 + 1800 * r(), t);
      env.gain.setTargetAtTime(0.7 + 0.3 * r(), t, 0.004);
      env.gain.setTargetAtTime(0, t + 0.018, 0.009);
      t += 0.075 + 0.03 * r();
    }
    t += 0.18 + 0.12 * r();
  }
  env.gain.setValueAtTime(0, t + 0.05);
  noise.start(t0, r()); noise.stop(t + 0.06);
  return { srcs, nodes, outs: [out], end: t + 0.06 };
}
// Kaninens stamp med bakbenet (arg/rädd).
function thumpAt(c, dest, t0) {
  const K = kit(c), nodes = [], srcs = [];
  const mk = (n) => { nodes.push(n); return n; };
  const out = mk(c.createGain()); out.gain.value = LEVEL.thump; out.connect(dest);
  const g = mk(c.createGain()); g.gain.value = 0; g.connect(out);
  const o = mk(c.createOscillator()); o.type = 'sine'; o.connect(g); srcs.push(o);
  o.frequency.setValueAtTime(120, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + 0.12);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + 0.003); g.gain.setTargetAtTime(0, t0 + 0.02, 0.03);
  g.gain.setValueAtTime(0, t0 + 0.25);
  const ng = mk(c.createGain()); ng.gain.value = 0; ng.connect(out);
  const lp = mk(c.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 500; lp.connect(ng);
  const noise = mk(c.createBufferSource()); noise.buffer = K.noise; noise.connect(lp); srcs.push(noise);
  ng.gain.setValueAtTime(0, t0); ng.gain.linearRampToValueAtTime(0.5, t0 + 0.002); ng.gain.setTargetAtTime(0, t0 + 0.006, 0.01);
  ng.gain.setValueAtTime(0, t0 + 0.12);
  for (const s of srcs) { s.start(t0); s.stop(t0 + 0.26); }
  return { srcs, nodes, outs: [out], end: t0 + 0.26 };
}

// ---------------------------------------------------------------- vem säger vad
const join = (...hs) => ({ srcs: hs.flatMap((h) => h.srcs), nodes: hs.flatMap((h) => h.nodes), outs: hs.flatMap((h) => h.outs), end: Math.max(...hs.map((h) => h.end)) });
const ALIAS = {
  hund: 'hund', dog: 'hund', valp: 'hund', katt: 'katt', cat: 'katt', kattunge: 'katt', kanin: 'kanin', rabbit: 'kanin', kaninunge: 'kanin',
  'fågel': 'fagel', fagel: 'fagel', bird: 'fagel', undulat: 'fagel', papegoja: 'fagel', sparv: 'fagel', duva: 'duva', pigeon: 'duva',
  fisk: 'fisk', fish: 'fisk', orm: 'orm', snake: 'orm', hamster: 'mus', marsvin: 'mus', mus: 'mus', rat: 'mus', råtta: 'mus',
};
// animalSound som en plan: { tag, fn(c, dest, t0) → handle }
function routeAnimal(kind, mood = '', opts = {}) {
  let sort = opts.sort || '', pet = null;
  if (kind && typeof kind === 'object') { pet = kind; kind = pet.species || pet.kind; mood = mood || pet.mood || ''; sort = sort || pet; }
  const k = ALIAS[String(kind || '').toLowerCase()] || String(kind || '').toLowerCase();
  const seed = opts.seed ?? hashStr(k + '|' + (pet ? (pet.id ?? pet.name ?? pet.breed ?? '') : sort) + '|' + (opts.key ?? ''));
  const vary = opts.vary | 0, sv = vary ? (seed ^ Math.imul(vary, 0x85ebca6b)) >>> 0 : seed; // sv: samma djur, nytt mönster
  const m = String(mood || '').toLowerCase();
  if (k === 'hund') {
    if (/arg|morr/.test(m)) return { tag: 'hund', fn: (c, d, t) => { const g = growlAt(c, d, t, sort, seed); return join(g, barkAt(c, d, g.end - 0.05, sort, '', seed, vary)); } };
    if (/ledsen|gnäll|hungrig/.test(m)) return { tag: 'hund', fn: (c, d, t) => whineAt(c, d, t, sort, seed) };
    if (/trött|trott|gäsp/.test(m)) return { tag: 'hund', fn: (c, d, t) => whineAt(c, d, t, sort, seed, true) };
    return { tag: 'hund', fn: (c, d, t) => barkAt(c, d, t, sort, m.includes('glad') ? 'glad' : '', seed, vary) };
  }
  if (k === 'katt') {
    const ks = sort || (String(kind).toLowerCase() === 'kattunge' ? 'unge' : '');
    if (m === 'mjauspinn') return { tag: 'katt', fn: (c, d, t) => { const a = meowAt(c, d, t, ks, 'glad', seed, vary); return join(a, purrAt(c, d, a.end - 0.1, opts.secs ?? 2.4, sv)); } };
    if (/spinn|nöjd|kel/.test(m)) return { tag: 'katt', fn: (c, d, t) => purrAt(c, d, t, opts.secs ?? 3, sv) };
    if (/arg|fräs/.test(m)) return { tag: 'katt', fn: (c, d, t) => hissAt(c, d, t) };
    return { tag: 'katt', fn: (c, d, t) => meowAt(c, d, t, ks, m, seed, vary) };
  }
  if (k === 'kanin') return /arg|rädd|stamp/.test(m) ? { tag: 'kanin', fn: (c, d, t) => thumpAt(c, d, t) } : { tag: 'kanin', fn: (c, d, t) => snuffAt(c, d, t, sv) };
  if (k === 'fagel') return { tag: 'fagel', fn: (c, d, t) => chirpAt(c, d, t, sv) };
  if (k === 'duva') return { tag: 'duva', fn: (c, d, t) => cooAt(c, d, t, sv) };
  if (k === 'fisk') return { tag: 'fisk', fn: (c, d, t) => blubbAt(c, d, t, sv) };
  if (k === 'orm') return { tag: 'orm', fn: (c, d, t) => hissAt(c, d, t, 1.1, LEVEL.hiss * 0.8) };
  if (k === 'mus') return { tag: 'mus', fn: (c, d, t) => squeakAt(c, d, t, sv) };
  return null;
}

// Djur-emoji i början av repliken → { kind, mood, sort } (annars null = en person pratar).
const START = [
  [/^(?:🐕‍🦺|🐕|🐶|🐩|🦮)/u, 'hund'], [/^(?:🐈‍⬛|🐈|🐱|😺|😸|😻|😼|😽|🙀|😿|😾)/u, 'katt'], [/^(?:🐰|🐇)/u, 'kanin'],
  [/^🕊/u, 'duva'], [/^(?:🐦|🐤|🐥|🐣|🦜)/u, 'fagel'], [/^(?:🐟|🐠|🐡)/u, 'fisk'], [/^🐍/u, 'orm'], [/^(?:🐹|🐭|🐁|🐀)/u, 'mus'],
];
export function guessAnimal(text) {
  const s = String(text || '').trimStart(), low = s.toLowerCase();
  const hit = START.find(([re]) => re.test(s));
  if (!hit) return null;
  const kind = hit[1];
  if (kind === 'hund') {
    const mood = /morr|grr|fräser|arg/.test(low) ? 'arg' : /gnäll|kvid|piper|ledsen/.test(low) ? 'ledsen'
      : /gäsp|sover|sömn|trött|snark/.test(low) ? 'trott' : /vift|glad|gillar|nosar|slick|leker|hopp/.test(low) ? 'glad' : '';
    return { kind, mood, sort: /valp/.test(low) ? 'valp' : /\btax/.test(low) ? 'tax' : '' };
  }
  if (kind === 'katt') {
    const mood = /spinn|kurr/.test(low) ? (/mjau/.test(low) ? 'mjauspinn' : 'spinn') : /fräs|väs|arg/.test(low) ? 'arg' : /hungrig/.test(low) ? 'hungrig' : '';
    return { kind, mood, sort: /kattunge/.test(low) ? 'unge' : '' };
  }
  if (kind === 'kanin') return { kind, mood: /stamp|arg|rädd/.test(low) ? 'arg' : '', sort: '' };
  return { kind, mood: '', sort: '' };
}

// speak som en plan (samma val som speak gör, men utan att spela) – används av _render.
function routeSpeak(text, opts = {}) {
  const str = String(text || '').trim();
  if (!str || opts.silent) return null;
  let a = null;
  if (opts.animal && typeof opts.animal === 'object') a = opts.animal;
  else if (typeof opts.animal === 'string') a = { kind: opts.animal, mood: opts.mood || guessAnimal(str)?.mood || '', sort: opts.sort || '' };
  else if (opts.animal !== false && !opts.voice) a = guessAnimal(str);
  if (a) {
    const R = routeAnimal(a.species ? a : a.kind, a.species ? (opts.mood || '') : a.mood, { sort: a.species ? '' : (opts.sort || a.sort), key: opts.key, secs: opts.secs, vary: opts.vary });
    if (R) return R;
  }
  const voice = opts.self || opts.voice === 'self' ? selfVoice() : opts.voice ? voiceFor(opts.voice) : voiceFor('~' + (opts.key ?? str));
  return { tag: 'babbel', info: { kind: voice.kind, pitch: voice.pitch, self: !!voice.soft }, fn: (c, d, t) => babbleAt(c, d, t, str, voice, opts.mood) };
}

// ---------------------------------------------------------------- spela (live)
const active = [];
const stats = { started: 0, muted: 0, locked: 0, stopped: 0, sceneStops: 0, byTag: {}, peakActive: 0, last: null };
// Scenen som visas (main.js sätter window.SF = A). Byter man scen tystnar det som sades i den förra.
const sceneNow = () => { try { return globalThis.SF?.sceneName ?? null; } catch { return null; } };
let watch = null;
function ensureWatch() {
  if (watch) return;
  watch = setInterval(() => {
    const hidden = typeof document !== 'undefined' && document.hidden;
    if (isMuted() || hidden) stopVoices(0.03);
    const sc = sceneNow();
    for (const v of active.slice()) if (v.scene !== sc) { stats.sceneStops++; v.stop(0.08); }
    for (const v of active.slice()) if (v.c.currentTime > v.end + 0.5) v.cleanup(); // om onended aldrig kom
    if (!active.length) { clearInterval(watch); watch = null; }
  }, 120);
}
let calls = 0; // räknare → djurens vary (nytt skall varje gång, samma röst)
// mix = { pan: -1..1 (vänster–höger), gain: 0..1 (svagare, t.ex. långt bort) }
function run(plan, mix = {}) {
  if (!plan) return null;
  if (isMuted()) { stats.muted++; return null; }
  const c = live();
  if (!c) return null;
  try {
    while (active.length >= MAX_VOICES) active[0].stop(0.05);
    let dest = bus;
    const extra = [];
    const pan = clamp(+mix.pan || 0, -1, 1), gain = mix.gain == null ? 1 : clamp(+mix.gain || 0, 0, 1.5);
    if (pan && typeof c.createStereoPanner === 'function') { const p = c.createStereoPanner(); p.pan.value = pan; p.connect(dest); dest = p; extra.push(p); }
    if (gain !== 1) { const g = c.createGain(); g.gain.value = gain; g.connect(dest); dest = g; extra.push(g); }
    const h = plan.fn(c, dest, c.currentTime + 0.015);
    h.nodes.push(...extra);
    let left = h.srcs.length, done = false;
    const V = {
      tag: plan.tag, c, end: h.end, stopped: false, nodes: h.nodes.length, scene: sceneNow(),
      playing: () => !done && !V.stopped && c.currentTime < h.end,
      stop(fade = 0.04) {
        if (V.stopped || done) return;
        V.stopped = true; stats.stopped++;
        const now = c.currentTime;
        for (const o of h.outs) { try { o.gain.cancelScheduledValues(now); o.gain.setValueAtTime(o.gain.value, now); o.gain.linearRampToValueAtTime(0, now + fade); } catch { /* ok */ } }
        for (const s of h.srcs) { try { s.stop(now + fade + 0.01); } catch { /* ok */ } }
        const i = active.indexOf(V); if (i >= 0) active.splice(i, 1);
      },
      cleanup() {
        if (done) return;
        done = true;
        for (const n of h.nodes) { try { n.disconnect(); } catch { /* ok */ } }
        const i = active.indexOf(V); if (i >= 0) active.splice(i, 1);
      },
    };
    for (const s of h.srcs) s.onended = () => { if (--left <= 0) V.cleanup(); };
    active.push(V);
    stats.started++; stats.byTag[plan.tag] = (stats.byTag[plan.tag] || 0) + 1;
    stats.last = { tag: plan.tag, ...(plan.info || {}), pan, gain };
    stats.peakActive = Math.max(stats.peakActive, active.length);
    ensureWatch();
    return V;
  } catch { return null; }
}

// ---------------------------------------------------------------- publika anrop
// Alla returnerar ett handtag { stop(), playing() } eller null (tyst: ljud av, inget klick än,
// ingen WebAudio).
// Alla tar också mix = { pan, gain } sist (pan −1..1, gain 0..1).
export const babble = (text, voice, mood, mix) => run({ tag: 'babbel', fn: (c, d, t) => babbleAt(c, d, t, text, voice, mood) }, mix);
export const bark = (sort = 'mellan', mood = '', mix) => run(routeAnimal('hund', mood, { sort, vary: ++calls }), mix);
export const meow = (sort = '', mood = '', mix) => run(routeAnimal('katt', mood, { sort, vary: ++calls }), mix);
export const purr = (secs = 3, mix) => run(routeAnimal('katt', 'spinn', { secs, vary: ++calls }), mix);
export const hiss = (mix) => run(routeAnimal('katt', 'arg'), mix);
export const growl = (sort = 'mellan', mix) => run({ tag: 'hund', fn: (c, d, t) => growlAt(c, d, t, sort, hashStr('morr' + sort)) }, mix);
export const whine = (sort = 'mellan', mix) => run(routeAnimal('hund', 'ledsen', { sort }), mix);
export const snuff = (mix) => run(routeAnimal('kanin', '', { vary: ++calls }), mix);
export const thump = (mix) => run(routeAnimal('kanin', 'arg'), mix);
export const chirp = (seed, mix) => run(routeAnimal('fagel', '', { seed: seed ?? ((Math.random() * 1e9) >>> 0) }), mix);
export const coo = (mix) => run(routeAnimal('duva', '', { vary: ++calls }), mix);
export const blubb = (mix) => run(routeAnimal('fisk', '', { vary: ++calls }), mix);
export const squeak = (mix) => run(routeAnimal('mus', '', { vary: ++calls }), mix);
// animalSound('hund'|'katt'|'kanin'|'fågel'|'duva'|'fisk'|'orm'|'hamster' eller husdjuret
// { species, breed, stage, id }, humör: 'glad'|'arg'|'ledsen'|'trött'|'hungrig'|'spinn'|'mjauspinn',
// opts { sort, secs, seed, pan, gain }). Samma djur har alltid samma röst men skäller/jamar lite
// olika varje gång.
export const animalSound = (kind, mood = '', opts = {}) => run(routeAnimal(kind, mood, { vary: ++calls, ...opts }), opts);

// speak(text, opts): det pratbubblorna använder. opts = { voice, animal, self, mood, key,
// sort, secs, silent, pan, gain }. voice = look/avatar/namn/röst/'self'; animal = true (gissa) |
// 'hund'|'katt'… | { kind, mood, sort } | husdjur | false (aldrig djur); self = true → den egna
// figurens mjukare röst (men djuremoji först gäller fortfarande). Utan voice och animal gissas
// djur efter emojin i början, annars en person med neutral röst (hash av key/text).
export function speak(text, opts = {}) {
  const o = opts || {};
  return run(routeSpeak(text, o.vary == null ? { ...o, vary: ++calls } : o), o);
}

// Pratbubblor som ritas varje bildruta (sayBubble: andra spelares chatt, gästernas repliker):
// första gången en text syns (eller efter minst 0,7 s utan den) hörs den – sedan tyst tills
// texten byts. voice = avatar/look/namn/'self' (utelämnad = gissning på texten + läget x, y),
// voice === false = bubblan har redan fått sitt ljud (createSpeech) – bara registrera.
// mix = { pan, gain }.
const HEARD = new Map();
export function heardBubble(text, x, y, voice, mix = {}) {
  const key = String(text || '');
  if (!key) return null;
  const now = nowS(), e = HEARD.get(key);
  if (e && now - e.t < 0.7) { e.t = now; return null; }
  HEARD.set(key, { t: now });
  if (HEARD.size > 64) for (const [k, v] of HEARD) if (now - v.t > 5) HEARD.delete(k);
  if (voice === false) return null;
  return speak(key, { voice: voice || undefined, key: '@' + Math.round((+x || 0) / 16) + ',' + Math.round((+y || 0) / 16), pan: mix.pan, gain: mix.gain });
}

export function stopVoices(fade = 0.04) { for (const v of active.slice()) v.stop(fade); }
export function voicesStats() {
  return { ...stats, byTag: { ...stats.byTag }, active: active.length, activeTags: active.map((v) => v.tag), activeNodes: active.reduce((a, v) => a + v.nodes, 0), hasBus: !!busCtx, unlocked: unlocked(), max: MAX_VOICES };
}

// Samma ljud i valfri kontext (OfflineAudioContext i testerna). Alla: (c, dest, t0, …) → { srcs, nodes, outs, end }.
export const _render = {
  babble: babbleAt, bark: barkAt, growl: growlAt, whine: whineAt, meow: meowAt, purr: purrAt, hiss: hissAt,
  chirp: chirpAt, coo: cooAt, blubb: blubbAt, squeak: squeakAt, snuff: snuffAt, thump: thumpAt,
  speak(c, dest, t0, text, opts) { const p = routeSpeak(text, opts || {}); return p ? p.fn(c, dest, t0) : null; },
  animal(c, dest, t0, kind, mood, opts) { const p = routeAnimal(kind, mood, opts || {}); return p ? p.fn(c, dest, t0) : null; },
  plan: (text, opts) => routeSpeak(text, opts || {})?.tag ?? null,
  chain: (c, target, level) => makeChain(c, target || c.destination, level).input, // spelets buss
  voiceParams, MAX_VOICES, OUT_LEVEL, LIM,
};
