// INSPELNINGARNA – riktiga ljud i stället för syntar (Carl 2026-09-28: "kan vi inte ha riktigt
// ljud … byt ut alla ljud"; "alla olika ställen i spelet ska ha någon form av bakgrundsljud som
// skiftar beroende på var man befinner sig"). Allt är CC0 och belagt, se assets/audio/rec/CREDITS-*.md.
//
//   BÄDDAR    en slinga per ställe som tonar över när man går: gatan (trafiken), parken, kanalen,
//             blåsten (vid vattnet tar den i), regnet (dämpat inomhus), snön, natten med syrsor,
//             dinern, caféet, stormarknaden, butikerna, hemma, flygplatsen och verkstäderna.
//             Stadens bäddar följer ljudmotorns recept (js/core/ambience.js recipe: avstånd till
//             vägen, parken, vattnet, vind, regn och natt) – bara ljuden är utbytta.
//   SMÅLJUD   fåglar och duvor i parken, måsar och båtmotorer vid vattnet, bussen, tutor,
//             hundar i förorten, espressomaskinen i caféet, fritösen i dinern, kassan i butikerna.
//   EFFEKTER  play('click'|'coin'|'door' …) spelar sin inspelning (sound.js-kroken); tills filen
//             hunnit laddas låter den gamla syntversionen, så inget klick blir tyst.
//   RÖSTER    simspråket och djurlätena (voices.js) spelar inspelade klipp: man/kvinna/barn/äldre ×
//             vanlig/fråga/glad/sur/arg, hundar efter storlek och humör, katter, kaniner, fåglar …
//             Samma person låter alltid likadant (samma klipp och tonhöjd för samma röst-frö).
//   MUSIKEN   väljs som förut (music.js pickMusic/musicFrame, egna CC0-låtar).
//
// Inget laddas före första klicket; allt är tyst vid mute och i dold flik. Filerna hämtas lat
// (manifesten först, sedan varje ljud första gången det behövs) och avkodas en i taget.
// main.js anropar recTick(A, dt) varje bildruta; röstchatten anropar setDuck(0|1).
import { audioContext, isMuted, setPlayHook } from './sound.js';
import { setVoiceSampler, voicesStats } from './voices.js';
import { pickMusic, musicFrame, setDuck as musicSetDuck, musicDuckVoice } from './music.js';
import { readState, recipe } from './ambience.js';

const BASE = new URL('../../assets/audio/rec/', import.meta.url).href;
const MANIFESTS = ['manifest-baddar.json', 'manifest-effekter.json', 'manifest-djur.json'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = (v) => clamp(v, 0, 1);
const hidden = () => typeof document !== 'undefined' && document.hidden;

// nivåer: effekter och röster överst, bäddarna under, musiken för sig (music.js)
const SFX_LEVEL = 0.55;     // inspelade effekter (≈ −16 LUFS i filen)
const BED_LEVEL = 0.34;     // bäddarna (≈ −23 LUFS i filen) → klart under effekterna
const EV_LEVEL = 0.22;      // småljuden i bakgrunden
const FADE = 0.6;           // bäddarnas tidskonstant (≈ 2 s till fullt)
const REF_LUFS = -23;

// ---------------------------------------------------------------- register och laddning
const REC = new Map();       // id → { url, loop, loopStart, loopEnd, norm, kategori }
let manifestP = null;
function loadManifests() {
  if (manifestP) return manifestP;
  manifestP = Promise.all(MANIFESTS.map((m) => fetch(BASE + m).then((r) => (r.ok ? r.json() : [])).catch(() => [])))
    .then((lists) => {
      for (const list of lists) for (const it of Array.isArray(list) ? list : []) {
        if (!it?.id || !it.fil) continue;
        const rel = String(it.fil).replace(/\\/g, '/').split('assets/audio/rec/').pop();
        const lufs = Number.isFinite(+it.lufs) ? +it.lufs : null;
        REC.set(it.id, {
          url: BASE + rel, loop: !!it.loop,
          loopStart: Number.isFinite(+it.loopStart) ? +it.loopStart : null, loopEnd: Number.isFinite(+it.loopEnd) ? +it.loopEnd : null,
          // normalisera efter uppmätt ljudstyrka (bäddarna mot −23, effekterna mot −16)
          norm: lufs == null ? 1 : clamp(Math.pow(10, ((it.loop ? REF_LUFS : -16) - lufs) / 20), 0.4, 1.6),
          kategori: it.kategori || '',
        });
      }
      // de små klippen (effekter, röster, djur) laddas i bakgrunden direkt – bäddarna när de behövs
      for (const [id, R] of REC) if (!R.loop && /^(effekter|roster|djur)$/.test(R.kategori)) want(id);
      return REC;
    });
  return manifestP;
}
const BUF = new Map();       // id → AudioBuffer | Promise | 'fel'
const queue = [];
let decoding = false;
function want(id) {
  const b = BUF.get(id);
  if (b && b !== 'fel') return b instanceof AudioBuffer ? b : null;
  if (b === 'fel' || !REC.has(id)) return null;
  BUF.set(id, 'kö'); queue.push(id); pump();
  return null;
}
function pump() {
  if (decoding || !queue.length) return;
  const c = audioContext();
  if (!c) return;
  decoding = true;
  const id = queue.shift(), R = REC.get(id);
  fetch(R.url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
    .then((ab) => new Promise((ok, fel) => { const p = c.decodeAudioData(ab, ok, fel); if (p?.then) p.then(ok, fel); }))
    .then((buf) => { BUF.set(id, buf); })
    .catch(() => { BUF.set(id, 'fel'); })
    .finally(() => { decoding = false; pump(); });
}
const ready = (id) => BUF.get(id) instanceof AudioBuffer;
const played = { sfx: 0, person: 0, animal: 0, ev: 0, last: null }; // för testerna (recStats)

// ---------------------------------------------------------------- utgångar
let ctxRef = null, bedBus = null, evBus = null, sfxBus = null, duckK = 0, voiceDuck = 0;
function buses() {
  const c = audioContext();
  if (!c) return null;
  if (ctxRef !== c) {
    ctxRef = c;
    bedBus = c.createGain(); bedBus.gain.value = BED_LEVEL; bedBus.connect(c.destination);
    evBus = c.createGain(); evBus.gain.value = EV_LEVEL; evBus.connect(bedBus);
    sfxBus = c.createGain(); sfxBus.gain.value = SFX_LEVEL; sfxBus.connect(c.destination);
    beds.clear();
  }
  return c;
}
// en inspelning en gång: { src, g } eller null
function one(id, dest, { gain = 1, pan = 0, rate = 1, at = 0, dur = null } = {}) {
  const c = ctxRef, buf = BUF.get(id), R = REC.get(id);
  if (!c || !(buf instanceof AudioBuffer)) return null;
  const src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
  const g = c.createGain(); g.gain.value = gain * (R?.norm ?? 1);
  let out = g;
  if (pan && typeof c.createStereoPanner === 'function') { const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); out = p; }
  src.connect(g); out.connect(dest);
  const t0 = c.currentTime + at;
  src.start(t0);
  const len = buf.duration / rate, end = t0 + (dur ? Math.min(dur, len) : len);
  if (dur && dur < len) { g.gain.setValueAtTime(g.gain.value, end - 0.08); g.gain.linearRampToValueAtTime(0, end); src.stop(end + 0.02); }
  src.onended = () => { try { g.disconnect(); out.disconnect(); } catch { /* ok */ } };
  return { src, g, out, end };
}

// ---------------------------------------------------------------- effekterna (sound.js)
const SFX = ['click', 'ok', 'fel', 'miss', 'coin', 'box', 'buy', 'sleep', 'morning', 'fanfare', 'knock', 'door', 'honk', 'slide', 'chirp'];
let sfxHooked = false;
function hookSfx() {
  if (sfxHooked) return;
  sfxHooked = true;
  for (const name of SFX) setPlayHook(name, () => {
    if (!buses()) return false;
    if (!ready(name)) { want(name); return false; }          // syntversionen tills filen finns
    one(name, sfxBus, { rate: name === 'click' || name === 'coin' ? 0.97 + Math.random() * 0.06 : 1 });
    played.sfx++; played.last = name;
    return true;
  });
}

// ---------------------------------------------------------------- rösterna och djuren (voices.js)
const MOOD = { glad: 'glad', ivrig: 'glad', sur: 'sur', arg: 'arg', neutral: 'vanlig' };
const PERSON = { man: 'man', kvinna: 'kvinna', barn: 'barn', gammal: 'aldre' };
const ids = (prefix) => [...REC.keys()].filter((k) => k === prefix || (k.startsWith(prefix + '-') && /^-\d+$/.test(k.slice(prefix.length))));
// välj ett klipp ur familjen (samma frö = samma klipp); är det inte laddat än duger ett laddat syskon
function pickId(list, seed) {
  if (!list.length) return null;
  const id = list[(seed >>> 0) % list.length];
  if (ready(id)) return id;
  want(id);
  return list.find(ready) || id;
}
function personClip(s) {
  const kind = PERSON[s.kind] || 'man';
  const mood = s.question ? 'fraga' : MOOD[s.mood] || 'vanlig';
  let list = [...REC.keys()].filter((k) => k.startsWith(kind + '-' + mood + '-'));
  if (!list.length) list = [...REC.keys()].filter((k) => k.startsWith(kind + '-vanlig-'));
  return pickId(list, (s.seed >>> 0) + (s.vary | 0));
}
function animalClip(s) {
  const m = s.mood || '', k = s.kind;
  if (k === 'hund') {
    if (/arg|morr/.test(m)) return 'hund-morr';
    if (/ledsen|gnäll|hungrig/.test(m)) return 'hund-gnall';
    if (/trött|trott|gäsp/.test(m)) return 'hund-gasp';
    if (/glad/.test(m) && (s.vary & 1)) return 'hund-glad';
    const sort = s.sort === 'valp' ? 'hund-valp' : s.sort === 'liten' || s.sort === 'tax' ? 'hund-liten' : s.sort === 'stor' ? 'hund-stor' : 'hund-mellan';
    return pickId(ids(sort), (s.seed >>> 0) + (s.vary | 0));
  }
  if (k === 'katt') {
    if (/spinn|nöjd|kel/.test(m) && m !== 'mjauspinn') return 'katt-spinn';
    if (m === 'mjauspinn') return 'katt-glad';
    if (/arg|fräs/.test(m)) return 'katt-fras';
    if (/hungrig/.test(m)) return 'katt-hungrig';
    if (/glad/.test(m)) return 'katt-glad';
    if (s.sort === 'unge') return pickId(ids('katt-unge'), (s.seed >>> 0) + (s.vary | 0));
    return pickId(ids('katt-jam'), (s.seed >>> 0) + (s.vary | 0));
  }
  if (k === 'kanin') return /arg|rädd|stamp/.test(m) ? 'kanin-stamp' : 'kanin-nos';
  if (k === 'fagel') return pickId(ids('fagel'), (s.seed >>> 0) + (s.vary | 0));
  if (k === 'duva') return pickId(ids('duva'), (s.seed >>> 0) + (s.vary | 0));
  if (k === 'fisk') return 'fisk';
  if (k === 'mus') return pickId(ids('hamster'), (s.seed >>> 0) + (s.vary | 0));
  return null;                                               // ormen m.fl.: syntversionen
}
// voices.js frågar: finns en inspelning för den här repliken? → en ritfunktion i samma form som
// syntarna ({ srcs, outs, nodes, end }) så att voices.js sköter max-röster, scenbyte och mute.
const sampler = {
  ready(s) {
    if (!s || !buses()) return false;
    const id = s.type === 'person' ? personClip(s) : animalClip(s);
    if (!id) return false;
    if (!ready(id)) { want(id); return false; }
    s._id = id;
    played[s.type === 'person' ? 'person' : 'animal']++; played.last = id;
    return true;
  },
  play(s, c, dest, t0) {
    const id = s._id, buf = BUF.get(id);
    const src = c.createBufferSource(); src.buffer = buf;
    // samma person: samma tonhöjd (±7 %), egen figur lite mjukare och kortare
    const r = s.type === 'person' ? 0.93 + (((s.seed >>> 3) % 1000) / 1000) * 0.14 : 0.95 + (((s.seed >>> 5) % 100) / 100) * 0.1;
    src.playbackRate.value = r;
    const g = c.createGain(), R = REC.get(id);
    const lvl = (R?.norm ?? 1) * (s.self ? 0.75 : 1) * (s.type === 'animal' ? 0.9 : 1);
    const len = buf.duration / r;
    const max = s.kind === 'katt' && id === 'katt-spinn' ? clamp(s.secs ?? 3, 1, 8) : Math.min(len, s.max ?? (s.self ? 1.1 : 2.6));
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(lvl, t0 + 0.012);
    if (id === 'katt-spinn') { src.loop = true; const Rs = REC.get(id); if (Rs?.loopEnd) { src.loopStart = Rs.loopStart || 0; src.loopEnd = Rs.loopEnd; } }
    const end = t0 + max;
    if (max < len || src.loop) { g.gain.setValueAtTime(lvl, end - 0.12); g.gain.linearRampToValueAtTime(0, end); }
    // genom röstbussen i voices.js (dest: panorering, begränsare) + vår egen nivå
    const vg = c.createGain(); vg.gain.value = 0.85;                   // röstbussen i voices.js ≈ 0,7 → ≈ −20 LUFS
    src.connect(g); g.connect(vg); vg.connect(dest);
    src.start(t0); src.stop(end + 0.03);
    return { srcs: [src], outs: [g], nodes: [src, g, vg], end };
  },
};

// ---------------------------------------------------------------- bäddarna
const beds = new Map();      // id → { src, g, f, level }
function bedNode(id) {
  let B = beds.get(id);
  if (B) return B;
  if (!ready(id)) { want(id); return null; }
  const c = ctxRef, buf = BUF.get(id), R = REC.get(id);
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  if (R.loopEnd && R.loopEnd > (R.loopStart || 0) + 1) { src.loopStart = R.loopStart || 0; src.loopEnd = R.loopEnd; }
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.min(18000, c.sampleRate / 2 - 100); f.Q.value = 0.5;
  const g = c.createGain(); g.gain.value = 0;
  src.connect(f); f.connect(g); g.connect(bedBus);
  // börja på ett slumpat ställe i slingan så två besök inte låter likadant
  const off = (R.loopStart || 0) + Math.random() * Math.max(0.1, (R.loopEnd || buf.duration) - (R.loopStart || 0) - 0.5);
  src.start(c.currentTime + 0.02, off);
  B = { src, g, f, level: 0 };
  beds.set(id, B);
  return B;
}
function dropBed(id) {
  const B = beds.get(id);
  if (!B) return;
  beds.delete(id);
  try { B.src.stop(ctxRef.currentTime + 0.05); } catch { /* ok */ }
  setTimeout(() => { try { B.src.disconnect(); B.f.disconnect(); B.g.disconnect(); } catch { /* ok */ } }, 200);
}

// inomhus: en bädd per ställe (och andra delen för kök och liknande); siffran = nivå 0–1
const SCENE_BED = {
  room: [['hemma', 0.9]], visit: [['hemma', 0.9]],
  burgarbar: [['diner', 1]], jobbburgare: [['diner', 1]], jobbkok: [['diner', 0.8], ['fritos', 0.7]],
  kafe: [['cafe', 1]], jobbkafe: [['cafe', 1]],
  mat: [['stormarknad', 1]], jobbfrukt: [['verkstad', 0.45]], mobler: [['stormarknad', 0.85]], moblerGammal: [['stormarknad', 0.85]], moblergammal: [['stormarknad', 0.85]],
  narbutik: [['butik', 0.9]], klader: [['butik', 0.85]], leksaker: [['butik', 0.8]], djur: [['butik', 0.7]], bostad: [['butik', 0.55]],
  elektronik: [['butik', 0.8]], bank: [['butik', 0.6]], skor: [['butik', 0.8]], accessoarer: [['butik', 0.8]], frisor: [['cafe', 0.35], ['butik', 0.5]],
  terminal: [['flygplats', 1]], jobbflyg: [['flygplats', 0.85]], jobbincheck: [['flygplats', 0.9]],
  jobbverkstad: [['verkstad', 1]], jobbbensin: [['stad-trafik', 0.55], ['verkstad', 0.35]], jobbtvatt: [['verkstad', 0.4], ['hemma', 0.4]], jobbposten: [['verkstad', 0.55]],
  jobbpizzeria: [['diner', 0.8]], universitet: [['cafe', 0.3], ['butik', 0.45]], jobbdatorbygge: [['verkstad', 0.45]], jobbfinans: [['cafe', 0.4], ['butik', 0.5]],
  bio: [['cafe', 0.35]], kebab: [['diner', 0.7]], pantbank: [['butik', 0.55]], jobbvard: [['butik', 0.5]],
};
// småljud per ställe: [id-prefix, per minut, nivå, panorering]
const SCENE_EV = {
  kafe: [['espresso', 1.2, 0.8]], jobbkafe: [['espresso', 2, 0.9]],
  burgarbar: [['fritos-ner', 0.9, 0.7]], jobbburgare: [['fritos-ner', 1.4, 0.8]], jobbkok: [['fritos-ner', 1.6, 0.9]],
  mat: [['kassa', 0.8, 0.5]], narbutik: [['kassa', 0.6, 0.6]], klader: [['kassa', 0.4, 0.5]], elektronik: [['kassa', 0.4, 0.5]],
  djur: [['fagel', 2.5, 0.5], ['hamster', 0.8, 0.6], ['hund-valp', 0.6, 0.5]],
};
function wantBeds(s) {
  const out = {};
  const put = (id, v) => { if (v > 0.02) out[id] = Math.max(out[id] || 0, clamp(v, 0, 1.3)); };
  const w = s.weather || {};
  let M = null;
  try { M = recipe(s); } catch { M = null; }
  const B = M?.beds || {}, rainK = B.regn || (w.kind === 'regn' ? 0.5 : 0), heavy = M?.p?.regn?.heavy || (w.intensity ?? 0) > 0.85;
  const inside = s.scene !== 'city';
  if (!inside) {
    put('stad-trafik', (B.trafik ?? 0.5) * 1.3);
    put('park', Math.max(B.lov || 0, B.fontan || 0, B.barn || 0) * 1.7);
    put('kanal', (B.vatten || 0) * 1.4);
    const wet = (B.vatten || 0) > 0.25;
    put(wet ? 'blast-hav' : 'blast', Math.max(0, (B.vind || 0) - 0.1) * (wet ? 1.8 : 1.4));
    put('natt', (B.syrsor || 0) * 1.6 + (s.dark > 0.6 && !rainK ? 0.2 : 0));
    if (w.kind === 'snö') put('sno', 0.8);
    if (rainK) put(heavy ? 'regn-hart' : 'regn', rainK * (s.riding ? 0.7 : 1.1));
  } else {
    for (const [id, v] of SCENE_BED[s.scene] || [['butik', 0.45]]) put(id, v);
    if (rainK) put(heavy ? 'regn-hart' : 'regn', rainK * 0.5);    // regnet mot fönstren, dämpat
  }
  return { beds: out, ev: M?.ev || {}, inside };
}

// ---------------------------------------------------------------- småljuden
const evNext = new Map();
function events(s, info, dt) {
  const list = [];
  if (!info.inside) {
    const V = info.ev;
    if (V.fagel) list.push(['fagel', V.fagel.rate * 0.5, 0.7], ['duva', V.fagel.rate * 0.15, 0.6]);
    if (V.kvitter) list.push(['fagel', V.kvitter.rate * 0.3, 0.5]);
    if (V.mas) list.push(['masar', V.mas.rate * 0.6, 0.35 + 0.6 * (V.mas.lvl || 0.5)]);
    if (V.bat) list.push(['batmotor', V.bat.rate * 0.8, 0.9]);
    if (V.tuta) list.push(['honk', V.tuta.rate * 0.4, 0.35 * (V.tuta.lvl || 0.5) + 0.15]);
    if (V.hund) list.push(['hund-mellan', V.hund.rate * 0.6, 0.35], ['hund-liten', V.hund.rate * 0.3, 0.3]);
    if (V.bil || V.tuta) list.push(['stad-buss', 0.25, 0.4]);
  } else list.push(...(SCENE_EV[s.scene] || []));
  for (const [pre, perMin, lvl] of list) {
    if (!(perMin > 0)) continue;
    const key = pre;
    const now = ctxRef.currentTime;
    const nx = evNext.get(key);
    if (nx == null) { evNext.set(key, now + (60 / perMin) * (0.3 + Math.random())); continue; }
    if (now < nx) continue;
    evNext.set(key, now + (60 / perMin) * (0.5 + Math.random()));
    const cand = ids(pre).length ? ids(pre) : [pre];
    const id = cand[(Math.random() * cand.length) | 0];
    if (!ready(id)) { want(id); continue; }
    one(id, pre === 'honk' ? sfxBus : evBus, { gain: pre === 'honk' ? lvl * 0.35 : lvl, pan: (Math.random() - 0.5) * 1.2, rate: 0.95 + Math.random() * 0.1 });
    played.ev++;
  }
}

// ---------------------------------------------------------------- varje bildruta
let voiceT = 0, awake = false, lastScene = null;
export function recTick(A, dt) {
  try {
    const s = readState(A);
    // musiken som förut (den sköter själv av/på, mute och flik)
    try {
      musicFrame(pickMusic({ scene: s.scene, district: s.district || 'centrum', night: clamp01((s.dark ?? 0) / 0.5), canal: 0 }));
    } catch { /* ok */ }
    const c = audioContext();
    if (!c) return;
    hookSfx();
    if (!REC.size) { loadManifests(); return; }
    buses();
    const quiet = isMuted() || hidden();
    const now = c.currentTime;
    if (quiet) {
      if (awake) { for (const B of beds.values()) B.g.gain.setTargetAtTime(0, now, 0.08); awake = false; setTimeout(() => { if (!awake) for (const id of [...beds.keys()]) dropBed(id); }, 600); }
      return;
    }
    awake = true;
    // pratar någon (simspråket)? – musiken och bäddarna viker undan en aning
    voiceT += dt;
    if (voiceT > 0.1) {
      voiceT = 0;
      let talking = 0;
      try { talking = voicesStats().active > 0 ? 1 : 0; } catch { talking = 0; }
      try { musicDuckVoice(talking); } catch { /* ok */ }
      voiceDuck = talking;
      bedBus.gain.setTargetAtTime(BED_LEVEL * (1 - 0.4 * duckK) * (1 - 0.2 * voiceDuck), now, 0.15);
    }
    const info = wantBeds(s);
    const sceneChanged = s.scene !== lastScene;
    lastScene = s.scene;
    // förladda det som behövs här
    for (const id of Object.keys(info.beds)) want(id);
    for (const [id, B] of beds) {
      const target = info.beds[id] || 0;
      B.g.gain.setTargetAtTime(target, now, sceneChanged ? 0.35 : FADE);
      // regn inne: dämpat genom väggen
      if (id.startsWith('regn')) B.f.frequency.setTargetAtTime(info.inside ? 900 : Math.min(18000, c.sampleRate / 2 - 100), now, 0.3);
      if (target <= 0.001) { B.idle = (B.idle || 0) + dt; if (B.idle > 6) dropBed(id); } else B.idle = 0;
    }
    for (const [id, v] of Object.entries(info.beds)) if (!beds.has(id) && v > 0.02) { const B = bedNode(id); if (B) B.g.gain.setTargetAtTime(v, now, FADE); }
    events(s, info, dt);
  } catch { /* ljudet får aldrig stoppa spelet */ }
}
// Röstchatten (js/net/voice.js): 1 = någon pratar → bäddar och musik sänks ≈ 40 %.
export function setDuck(k) {
  duckK = clamp01(+k || 0);
  try { musicSetDuck(duckK); } catch { /* ok */ }
  try { if (bedBus && ctxRef) bedBus.gain.setTargetAtTime(BED_LEVEL * (1 - 0.4 * duckK) * (1 - 0.2 * voiceDuck), ctxRef.currentTime, duckK ? 0.1 : 0.4); } catch { /* ok */ }
}
export function recStats() {
  return {
    manifest: REC.size, loaded: [...BUF.values()].filter((b) => b instanceof AudioBuffer).length, failed: [...BUF.entries()].filter(([, b]) => b === 'fel').map(([k]) => k),
    played: { ...played }, queue: queue.length, beds: Object.fromEntries([...beds].map(([k, B]) => [k, +B.g.gain.value.toFixed(3)])), scene: lastScene, duck: duckK, awake,
  };
}
// förladda allt som hör till ett ställe (testerna och första klicket)
export function recPreload(list) { loadManifests().then(() => { for (const id of list || [...REC.keys()]) want(id); }); }
setVoiceSampler(sampler);
