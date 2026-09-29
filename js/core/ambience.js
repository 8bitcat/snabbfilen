// AMBIENS – stadens och rummens ljud, syntat i WebAudio (inga ljudfiler).
//
// audioTick(A, dt) anropas varje bildruta (js/main.js). Den läser var man är (A.sceneName,
// figurens läge i staden, klockan, vädret, trafiken) och tonar mjukt (1–2 s) mellan ljudbäddar:
//   STADEN   bilarna (riktiga fordon ur trafiken: varje bil nära en egen röst med doppler, bussen
//            som bromsar och pyser, tutor), stadens brus efter avståndet till vägarna, sorl och steg
//            i centrum, butiksdörrar som plingar, parken (fåglar, lövprassel, fontänen, barn som
//            leker vid lekplatsen, änderna i dammen, ugglan på natten), KANALEN (skvalp mot kajen,
//            måsar, en båt som puttrar förbi, vinden som tar i mer vid vattnet, riggar som klirrar,
//            mistlur i dimma), förorten (trafik längre bort, moped, hundar långt bort), natten
//            (syrsor, en ensam bil, tystare stad).
//   VÄDRET   regn (brus + droppar + porlande stuprör, ösregn), blåst (byar som kommer och går),
//            snö (dämpad stad, mjuk vind), åska (sound.js play('aska') från weather.js, inomhus dovt).
//   INNE     dinern (fritös, grill, porslin, sorl, Doris kassaklocka), caféet (espressomaskin,
//            mjölkskum, kvarn, koppar), stormarknaden (kyldiskar, kassapip, vagnar, högtalarpling),
//            klädaffären, möbelvaruhuset (stort eko), bostadsbyrån (tangentbord, telefon),
//            djuraffären (akvarium, fåglar, valp), närbutiken (kyldisk, lysrör, dörrklocka), hemmet
//            (kylskåp, klocka, regn mot rutan) och jobben efter sin plats.
// Musiken (js/core/music.js) väljs härifrån också: pickMusic → musicFrame.
//
// Nivåer (aktiv RMS i dBFS i riktiga spelet vid 48 kHz, tools/out/ambiens/balans48.mjs): rösterna
// (voices.js) ≈ −23,8, effektljuden (sound.js) ≈ −34,6. Ambiensen ligger i bakgrunden: staden vid
// vägen ≈ −38,5…−39, parken ≈ −40,5, lugn kanal ≈ −41…−44, inne −40…−48 – och ALDRIG närmare
// effektljuden än 3 dB, inte ens i storm, ösregn eller åska (nivåvakten nedan). Musiken (music.js)
// ligger ungefär i nivå med ambiensen utomhus. setDuck(k) sänker ambiens OCH musik ca 40 % (k = 1)
// medan röstchatten pratar, och när pratbubblorna babblar sänks de lite av sig själva.
// Regler: tyst när ljudet är av (isMuted), inget före första klicket, stannar när fliken döljs,
// återanvänder noder (delade brusslingor, ljudbäddar byggs bara när de hörs och rivs 3 s efter att de
// tystnat), högst MAX_EV samtidiga småljud. Tål att WebAudio saknas (gör då ingenting).
// Ingen frysning: allt som räknas fram (brus, texturer, klangbanker, rumsklang, sorlet) byggs i en
// BYGGKÖ i små skivor – högst BUILD_MS per bildruta plus tomgångstid (requestIdleCallback). Ett ljud
// vars buffert inte är klar väntar (bädden tonar in när den blir klar, småljudet kommer nästa gång).
// Mobilprofil (pekskärm): färre bilröster och småljud, kortare efterklang.
// Nodbudget (uppmätt, tools/out/ambiens/granska-efter.mjs och live-test.mjs): ≈ 55–90 noder i staden,
// i värsta fall ≈ 105 (regn vid vägen med tre bilröster, brusslingor och småljud), 8–70 inne (dinern
// flest). Källorna (det som kostar i ljudtråden) är färre: högst ≈ 10 samtidigt.
//
// Testbart: createAmbienceEngine(ctx, dest, { seed, offline: true }) fungerar i en
// OfflineAudioContext (tools/out/ambiens/render.mjs driver den med ctx.suspend och tick(state, dt));
// offline byggs allt direkt i stället för i kön.
import { audioContext, isMuted, onPlay, setPlayHook } from './sound.js';
import { musicFrame, pickMusic, setDuck as musicSetDuck, musicDuckVoice, musicJukebox } from './music.js';
import { voiceFor, voicesStats, _render as VR } from './voices.js';
// Kartan läses som en namnrymd: försvinner en export i en framtida kartändring blir bara den delen av
// ljudet tyst, i stället för att hela modulen slutar laddas.
import * as MAP from '../city/map.js';
const { CITY, PARK_LAYOUT } = MAP;
const BUILDINGS = MAP.BUILDINGS || [];
const districtAt = (x, y) => { try { return MAP.districtAt(x, y) || { id: 'centrum' }; } catch { return { id: 'centrum' }; } };
// Floden (Pixelfloden, v3): vattnet mellan kajerna, Stora bron (hängbro) vid Pixelgatan, Järnbron vid
// Södergatan. Förortens lekplats ur tomterna.
const RIVER_W = MAP.RIVER ? [MAP.RIVER.wx0, MAP.RIVER.wx1] : null;
const SUB_PLAY = (MAP.LOTS || []).find((l) => l.id === 'lekplats_x')?.rect || [3310, 334, 3450, 452];
// Hur nära vattnet figuren är: kanalen längs Söder (y) och floden (x) – 1 = vid kajen / ute på bron.
function waterAt(x, y) {
  const canal = smooth(640, 765, y);
  const river = RIVER_W ? smooth(-110, 0, -distBand(x, RIVER_W[0], RIVER_W[1])) : 0;
  return { canal, river, water: Math.max(canal, river) };
}

// ---------------------------------------------------------------- inställningar
const MAX_EV = 12;          // samtidiga småljud (fåglar, klirr, pip …) – mobilen: 8
const CAR_VOICES = 3;       // bilar som hörs var för sig – mobilen: 2
const TSR = 22050;          // texturernas samplingsfrekvens (räcker för brus och sorl)
const BANK_SR = 32000;      // klangbankernas (porslin, klockor: delton upp till ≈ 15 kHz)
const BUILD_MS = 3;         // byggkön: högst så här många ms per bildruta (plus tomgångstid)
const CHUNK = 4095;         // långa slingor lämnar över (yield) var 4096:e sampel
const FADE = 0.45;          // tidskonstant för bäddarnas toning (≈ 1,4 s till 95 %)
const mobile = () => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } };
// Bäddarnas kalibrering (uppmätt med tools/out/ambiens/calibrate.mjs): nivå 1 i ett recept ≈ målnivån
// i dBFS RMS före AMB_LEVEL (offline, utan grind – därför inte direkt jämförbart med siffrorna i huvudet).
const CAL = {
  trafik: 0.075,  // −36  stadens brus
  vind: 0.1553,    // −38
  regn: 0.028,      // −40  (ösregn; sänkt 6,4 dB – ska ligga under effektljuden även i ösregn)
  lov: 0.0736,     // −44
  sorl: 0.1629,    // −36
  steg: 0.0629,    // −46
  barn: 0.0897,    // −42
  syrsor: 0.0622,  // −44
  vatten: 0.1077,  // −37  skvalp vid kajen
  fontan: 0.107,   // −40,5 (på nära håll ljust brus – sänkt 1,5 dB)
  stupror: 0.06,   // −47
  kyl: 0.0187,    // −42
  lysror: 0.0075, // −50
  flakt: 0.0263,   // −46
  fritos: 0.1141,  // −38
  grill: 0.0953,   // −42
  bubbel: 0.0573, // −42
  tangent: 0.0605, // −44
  klocka: 0.2897, // −48
  band: 0.053,   // −40
  tvatt: 0.0867,  // −40
  ugn: 0.0381,    // −42
  buss: 0.0485,    // −36
};
const EV_LVL = 0.16;        // småljudens grundnivå (ett småljud på nivå 1 ≈ −35 dBFS aktiv RMS)
const REV_OUT = 0.3;        // efterklangens nivå (konvolvern normaliserar sitt svar)
const CAR_LVL = 0.032;      // en bil precis intill (≈ −37 dBFS när den passerar)
const QUAY_CARS = 0.6;      // bilarna på Södergatan hörda nere från kajen (bakom kajkanten, −4,4 dB)
// Hela ambiensens nivå (efter allt ovan, före begränsaren): −4,4 dB. CAL/EV_LVL/CAR_LVL är uppmätta
// FÖRE den här trimmen. Resultatet: se nivåerna i huvudet ovan. Ihållande väder (storm, ösregn,
// åska) tas dessutom av nivåvakten.
const AMB_LEVEL = 0.6;
// NIVÅVAKTEN på ambiensbussen: summan av alla lager (storm + regn + vatten + åska + bilar …) får inte
// gå över taket – mätt som effekt (medel av vänster och höger kanal, glidande medel över GOV_TAU s),
// rått och K-vägt.
// Taket ligger ≈ 4 dB under effektljuden från sound.js (≈ −34,6 dBFS rått, −33,1 K som aktiv RMS i
// riktiga spelet, tools/out/ambiens/balans48.mjs). Vakten sänker bara (högst GOV_MIN, −8 dB), tonar ner på
// ≈ 1,2 s och upp igen på ≈ 3 s. Mätaren stiger med tidskonstanten GOV_ATT (en storm som tar i eller en
// åskskur fångas inom ≈ 2 s) och sjunker med GOV_TAU – en enskild fågel eller ett klirr flyttar den
// högst ≈ 1 dB. Lugna scener påverkas aldrig.
const GOV_RAW = -38.5, GOV_K = -37.3, GOV_MIN = 0.4, GOV_TAU = 3, GOV_ATT = 1.5;

// ---------------------------------------------------------------- små hjälpare
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const clamp01 = (v) => clamp(v, 0, 1);
const near = (d, r) => 1 / (1 + (d / r) * (d / r));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const distRect = (x, y, r) => Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - y, 0, y - r[3]));
const distBand = (v, a, b) => (v < a ? a - v : v > b ? v - b : 0);
const pick = (r, arr) => arr[(r() * arr.length) | 0];
function darkness(hour) { // samma kurva som staden (js/scenes/city.js)
  if (hour >= 7.5 && hour < 17.5) return 0;
  if (hour >= 17.5 && hour < 20.5) return (hour - 17.5) / 3 * 0.5;
  if (hour >= 5.5 && hour < 7.5) return (7.5 - hour) / 2 * 0.5;
  return 0.5;
}

// ---------------------------------------------------------------- DSP i JS (texturer)
// Buffertar räknas fram en gång och loopas. Allt placeras cirkulärt så att slutet går sömlöst över i
// början. Byggena är GENERATORER (function*) som lämnar över (yield) ofta – i spelet kör byggkön dem i
// skivor om högst BUILD_MS, i testerna körs de klart direkt (runSync).
const runSync = (it) => { let r; do { r = it.next(); } while (!r.done); return r.value; };
function mkBuf(ctx, sec, ch = 1, sr = TSR) {
  let b;
  try { b = ctx.createBuffer(ch, Math.max(1, Math.round(sec * sr)), sr); } catch { sr = ctx.sampleRate; b = ctx.createBuffer(ch, Math.max(1, Math.round(sec * sr)), sr); }
  const d = []; for (let i = 0; i < ch; i++) d.push(b.getChannelData(i));
  return { b, d, n: b.length, sr, ch };
}
// (heta slingor i block om CHUNK + 1 sampel: ingen kontroll per sampel, yield mellan blocken)
function* rmsOf(B) {
  let s = 0, c = 0;
  for (const x of B.d) {
    for (let i0 = 0; i0 < x.length; i0 += CHUNK + 1) { const i1 = Math.min(x.length, i0 + CHUNK + 1); for (let i = i0; i < i1; i++) s += x[i] * x[i]; yield; }
    c += x.length;
  }
  return Math.sqrt(s / Math.max(1, c));
}
function* scaleBy(B, k) {
  for (const x of B.d) for (let i0 = 0; i0 < x.length; i0 += CHUNK + 1) { const i1 = Math.min(x.length, i0 + CHUNK + 1); for (let i = i0; i < i1; i++) x[i] *= k; yield; }
}
// Texturens sista steg: tämj spetsarna (crest: klick och droppar får högst "crest" gånger texturens
// RMS – en mjuk tanh-gräns, så att täta småljud blir ett jämnt knaster i stället för enstaka skarpa
// smällar) och normalisera till RMS = target.
function* finishTex(B, { crest = 0, target = 0.1 } = {}) {
  if (crest) {
    const lim = (yield* rmsOf(B)) * crest;
    if (lim > 1e-9) {
      for (const x of B.d) for (let i0 = 0; i0 < x.length; i0 += CHUNK + 1) { const i1 = Math.min(x.length, i0 + CHUNK + 1); for (let i = i0; i < i1; i++) x[i] = lim * Math.tanh(x[i] / lim); yield; }
    }
  }
  const rms = yield* rmsOf(B);
  if (rms > 1e-9) yield* scaleBy(B, target / rms);
  return B.b;
}
function* peakNorm(B, target = 0.9) {
  let p = 0;
  for (const x of B.d) for (let i0 = 0; i0 < x.length; i0 += CHUNK + 1) { const i1 = Math.min(x.length, i0 + CHUNK + 1); for (let i = i0; i < i1; i++) { const a = x[i] < 0 ? -x[i] : x[i]; if (a > p) p = a; } yield; }
  if (p > 1e-9) yield* scaleBy(B, target / p);
  return B.b;
}
// (synkrona varianter för det som inte går genom byggkön)
const normRms = (B, target = 0.1) => runSync(finishTex(B, { target }));
// RBJ-biquad i JS
function bq(type, f, Q, sr) {
  const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * Q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; } else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al, a1 = -2 * cs / a0, a2 = (1 - al) / a0;
  b0 /= a0; b1 /= a0; b2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
// Samma sak som en generator (långa stötar, t.ex. vågorna mot kajen: upp till 2,8 s).
function* burstG(B, ch, t, len, amp, tau, { att = 0, fn = null, r = Math.random, pan = null } = {}) {
  const sr = B.sr, n = B.n, L = Math.min(n - 1, Math.round(len * sr)), aN = att * sr, dec = Math.exp(-1 / (tau * sr));
  const [d0, d1, g0, g1] = outs(B, ch, pan);
  let e = amp, j = Math.round(t * sr) % n;
  for (let k = 0; k < L; k++) {
    let w = r() * 2 - 1;
    if (fn) w = fn(w);
    let v;
    if (k < aN) { const a = k / aN; v = amp * w * a * a; } else { v = w * e; e *= dec; }
    d0[j] += v * g0; if (d1) d1[j] += v * g1;
    if (++j === n) j = 0;
    if ((k & CHUNK) === CHUNK) yield;
  }
}
// Vart ett ljud hamnar: kanal ch (utan panorering) eller vänster/höger efter pan (0–1).
function outs(B, ch, pan) {
  if (pan === null) return [B.d[ch], null, 1, 0];
  return [B.d[0], B.ch > 1 ? B.d[1] : null, Math.cos(pan * 1.5708), Math.sin(pan * 1.5708)];
}
// Ett avklingande sinusljud (droppe, klick, klang): f → f2 under len, tidskonstant tau. Fast ton =
// en roterande visare (ingen sin/exp per sampel); delton över Nyquist hoppas över (skulle vika ner).
function ring(B, ch, t, f, tau, amp, { f2 = f, len = tau * 6, att = 0, r = Math.random, pan = null } = {}) {
  const sr = B.sr, n = B.n;
  if (Math.max(f, f2) >= sr * 0.48) return;
  const L = Math.min(n - 1, Math.round(len * sr)), aN = att * sr, dec = Math.exp(-1 / (tau * sr));
  const [d0, d1, g0, g1] = outs(B, ch, pan);
  let e = amp, ph = r() * 6.2832, j = Math.round(t * sr) % n;
  if (f2 === f) {
    const w = 6.2832 * f / sr, cw = Math.cos(w), sw = Math.sin(w);
    let c = Math.cos(ph), s = Math.sin(ph);
    for (let k = 0; k < L; k++) {
      const c2 = c * cw - s * sw; s = c * sw + s * cw; c = c2;
      let v = e * s; e *= dec;
      if (k < aN) v *= k / aN;
      d0[j] += v * g0; if (d1) d1[j] += v * g1;
      if (++j === n) j = 0;
    }
  } else {
    for (let k = 0; k < L; k++) {
      ph += 6.2832 * (f + (f2 - f) * (k / L)) / sr;
      let v = e * Math.sin(ph); e *= dec;
      if (k < aN) v *= k / aN;
      d0[j] += v * g0; if (d1) d1[j] += v * g1;
      if (++j === n) j = 0;
    }
  }
}
// En brusstöt: noise genom valfritt filter (fn), envelope (attack, tau), cirkulärt placerad.
function burst(B, ch, t, len, amp, tau, { att = 0, fn = null, r = Math.random, pan = null } = {}) {
  const sr = B.sr, n = B.n, L = Math.min(n - 1, Math.round(len * sr)), aN = att * sr, dec = Math.exp(-1 / (tau * sr));
  const [d0, d1, g0, g1] = outs(B, ch, pan);
  let e = amp, j = Math.round(t * sr) % n;
  for (let k = 0; k < L; k++) {
    let w = r() * 2 - 1;
    if (fn) w = fn(w);
    let v;
    if (k < aN) { const a = k / aN; v = amp * w * a * a; } else { v = w * e; e *= dec; }
    d0[j] += v * g0; if (d1) d1[j] += v * g1;
    if (++j === n) j = 0;
  }
}

const TEXG = {
  // Regndroppar: tick mot asfalt/tak och små plopp i pölar.
  *drops(ctx, r) {
    const B = mkBuf(ctx, 6, 2), sec = 6;
    const count = 95 * sec;
    for (let i = 0; i < count; i++) {
      const t = r() * sec, pan = r(), amp = 0.12 + 0.88 * r() ** 3;
      if (r() < 0.72) {
        let prev = 0;
        burst(B, 0, t, 0.002 + 0.004 * r(), amp * 0.8, 0.0004 + 0.0012 * r(), { r, pan, fn: (w) => { const v = w - prev; prev = w; return v; } });
      } else {
        const f = 1100 + 2600 * r(), dur = 0.012 + 0.026 * r();
        ring(B, 0, t, f, dur * 0.35, amp * 0.5, { f2: f * (1.3 + 0.6 * r()), len: dur, r, pan });
      }
      if ((i & 31) === 31) yield;
    }
    return yield* finishTex(B, { crest: 4 });
  },
  // Frityroljan: täta små smällar (tungsvansade), då och då ett spott.
  *crackle(ctx, r) {
    const B = mkBuf(ctx, 5, 1), sec = 5;
    for (let i = 0; i < 260 * sec; i++) {
      const t = r() * sec, a = Math.min(1, 0.03 / (r() + 0.03)) ** 1.2;
      burst(B, 0, t, 0.0015 + 0.003 * r(), a * 0.6, 0.0003 + 0.001 * r(), { r });
      if ((i & 127) === 127) yield;
    }
    const f = bq('bp', 4200, 0.8, B.sr);
    for (let i = 0; i < 4 * sec; i++) { burst(B, 0, r() * sec, 0.04, 0.35 + 0.4 * r(), 0.008 + 0.012 * r(), { r, fn: f }); if ((i & 7) === 7) yield; }
    return yield* finishTex(B, { crest: 5 });
  },
  // Kanalen: vågor som slår mot kajen, skvalp och små bubbel efteråt.
  *lapping(ctx, r) {
    const sec = 10, B = mkBuf(ctx, sec, 2);
    let t = r() * 0.5;
    while (t < sec) {
      const pan = 0.15 + 0.7 * r(), amp = 0.35 + 0.65 * r(), a = 0.06 + 0.1 * r(), tau = 0.22 + 0.3 * r();
      const lp = bq('lp', 380 + 500 * r(), 0.6, B.sr);
      yield* burstG(B, 0, t, a + tau * 5, amp, tau, { att: a, fn: (w) => lp(w) * 3, r, pan });
      const hp = bq('hp', 1800 + 2000 * r(), 0.7, B.sr);
      burst(B, 0, t + a, 0.35, amp * 0.22, 0.09 + 0.08 * r(), { fn: hp, r, pan });
      const np = 5 + ((r() * 16) | 0);
      for (let k = 0; k < np; k++) {
        const f = 320 + 1100 * r(), d = 0.012 + 0.03 * r();
        ring(B, 0, t + a + 0.05 + 0.7 * r(), f, d * 0.4, amp * (0.06 + 0.14 * r()), { f2: f * (1.2 + 0.5 * r()), len: d, r, pan: clamp01(pan + (r() - 0.5) * 0.3) });
      }
      yield;
      t += 0.8 + 1.9 * r();
    }
    return yield* finishTex(B, { crest: 4 });
  },
  // Syrsor: fyra stycken med egen ton, puls och takt.
  *crickets(ctx, r) {
    const sec = 6, B = mkBuf(ctx, sec, 2);
    for (let c = 0; c < 4; c++) {
      const f = 4100 + 1000 * r(), pr = 26 + 16 * r(), np = 3 + ((r() * 3) | 0), per = sec / Math.round(sec / (0.38 + 0.5 * r()));
      const amp = 0.25 + 0.75 * r(), pan = r(), pd = 0.011 + 0.008 * r();
      for (let t = r() * per; t < sec; t += per * (0.985 + 0.03 * r())) {
        for (let p = 0; p < np; p++) {
          const tp = t + p / pr, sr = B.sr, i0 = Math.round(tp * sr), L = Math.round(pd * sr);
          let ph = 0;
          for (let k = 0; k < L; k++) {
            ph += 6.2832 * f / sr;
            const e = Math.sin(Math.PI * k / L) ** 2, v = amp * e * Math.sin(ph), j = (i0 + k) % B.n;
            B.d[0][j] += v * Math.cos(pan * 1.5708); B.d[1][j] += v * Math.sin(pan * 1.5708);
          }
        }
        yield;
      }
    }
    return yield* finishTex(B);
  },
  // Akvariets luftsten: en ström av små bubblor och en större då och då.
  *bubbles(ctx, r) {
    const sec = 5, B = mkBuf(ctx, sec, 1);
    for (let i = 0; i < 26 * sec; i++) {
      const f = 600 + 1800 * r(), d = 0.015 + 0.025 * r();
      ring(B, 0, r() * sec, f, d * 0.4, 0.2 + 0.8 * r(), { f2: f * (1.2 + 0.4 * r()), len: d, r });
      if ((i & 31) === 31) yield;
    }
    for (let i = 0; i < sec; i++) { const f = 250 + 200 * r(); ring(B, 0, r() * sec, f, 0.02, 1, { f2: f * 1.8, len: 0.06, r }); }
    return yield* finishTex(B, { crest: 4 });
  },
  // Tangentbord: skrivsjok med tryck och släpp, mellanslag ibland.
  *typing(ctx, r) {
    const sec = 8, B = mkBuf(ctx, sec, 1);
    let t = 0.2;
    while (t < sec - 0.3) {
      const nb = 4 + ((r() * 18) | 0);
      for (let i = 0; i < nb && t < sec - 0.2; i++) {
        const a = 0.5 + 0.5 * r(), space = r() < 0.12;
        burst(B, 0, t, 0.003, a * 0.5, 0.0006, { r });
        ring(B, 0, t, space ? 900 + 200 * r() : 1700 + 900 * r(), 0.003, a * 0.35, { r });
        ring(B, 0, t + 0.07 + 0.04 * r(), 2000 + 700 * r(), 0.002, a * 0.18, { r });
        t += 0.08 + 0.12 * r() + (r() < 0.08 ? 0.3 : 0);
      }
      yield;
      t += 0.6 + 1.8 * r();
    }
    return yield* finishTex(B, { crest: 6 });
  },
  // Väggklockan: tick … tack.
  *clock(ctx, r) {
    const B = mkBuf(ctx, 2, 1);
    burst(B, 0, 0.02, 0.002, 0.5, 0.0004, { r }); ring(B, 0, 0.02, 3300, 0.004, 0.6, { r });
    burst(B, 0, 1.02, 0.002, 0.35, 0.0004, { r }); ring(B, 0, 1.02, 2500, 0.005, 0.45, { r });
    return yield* peakNorm(B, 0.5);
  },
  // Skrammel: löpande band, vagnshjul.
  *rattle(ctx, r) {
    const sec = 4, B = mkBuf(ctx, sec, 1);
    let i = 0;
    for (let t = 0; t < sec; t += (1 / 32) * (0.7 + 0.6 * r())) {
      const a = (0.3 + 0.7 * r()) * (0.75 + 0.25 * Math.sin(t * Math.PI * 2 * 0.5));
      burst(B, 0, t, 0.002, a * 0.4, 0.0005, { r });
      ring(B, 0, t, 1700 + 200 * r(), 0.004, a * 0.35, { r });
      ring(B, 0, t, 2900 + 300 * r(), 0.003, a * 0.2, { r });
      if ((++i & 15) === 0) yield;
    }
    return yield* finishTex(B, { crest: 4 });
  },
  // Stupröret som porlar: täta små bubbel och klunkar.
  *trickle(ctx, r) {
    const sec = 6, B = mkBuf(ctx, sec, 2);
    for (let i = 0; i < 70 * sec; i++) {
      const f = 280 + 720 * r(), d = 0.008 + 0.022 * r();
      ring(B, 0, r() * sec, f, d * 0.4, 0.1 + 0.5 * r() ** 2, { f2: f * (1.3 + 0.7 * r()), len: d, r, pan: r() });
      if ((i & 31) === 31) yield;
    }
    for (let i = 0; i < 3 * sec; i++) { const f = 140 + 120 * r(); ring(B, 0, r() * sec, f, 0.025, 0.6 + 0.4 * r(), { f2: f * 2, len: 0.07, r, pan: 0.3 + 0.4 * r() }); }
    return yield* finishTex(B, { crest: 4 });
  },
  // Steg på trottoaren: sju personer som går förbi i olika takt.
  *steps(ctx, r) {
    const sec = 8, B = mkBuf(ctx, sec, 2);
    for (let w = 0; w < 7; w++) {
      const per = 0.48 + 0.14 * r(), amp = 0.15 + 0.85 * r() ** 2, pan = r(), start = r() * sec, len = 2 + 5 * r();
      const hard = r() < 0.5, lp = bq('lp', 900, 0.7, B.sr);
      for (let t = 0; t < len; t += per * (0.96 + 0.08 * r())) {
        const e = Math.sin(Math.PI * t / len) * amp;
        let prev = 0;
        burst(B, 0, start + t, 0.003, e * 0.9, 0.0012, { r, pan, fn: (x) => { const v = x - prev; prev = x; return v; } });
        if (hard) ring(B, 0, start + t, 900 + 500 * r(), 0.006, e * 0.3, { r, pan });
        burst(B, 0, start + t + 0.01, 0.03, e * 0.25, 0.01, { r, pan, fn: lp });
      }
      yield;
    }
    return yield* finishTex(B, { crest: 4 });
  },
  // Tvättmaskinen: trumman vänder, tvätten dunsar, vattnet skvalpar.
  *washer(ctx, r) {
    const sec = 8, B = mkBuf(ctx, sec, 1), turn = 1.6;
    const lp = bq('lp', 420, 0.7, B.sr), per = Math.round(turn * B.sr);
    // trummans svep sin²(π·fas) som en tabell (en trumvarv), i stället för en sinus per sampel
    const sw = new Float32Array(per);
    for (let i = 0; i < per; i++) sw[i] = 1.6 * (0.25 + 0.75 * Math.sin(Math.PI * i / per) ** 2);
    for (let i0 = 0; i0 < B.n; i0 += CHUNK + 1) {
      const i1 = Math.min(B.n, i0 + CHUNK + 1);
      for (let i = i0; i < i1; i++) B.d[0][i] += lp(r() * 2 - 1) * sw[i % per];
      yield;
    }
    for (let t = 0.6 * turn; t < sec; t += turn) { ring(B, 0, t + 0.05 * r(), 70 + 15 * r(), 0.04, 0.9, { r }); burst(B, 0, t, 0.05, 0.25, 0.015, { r, fn: bq('lp', 300, 0.7, B.sr) }); }
    return yield* finishTex(B, { crest: 4 });
  },
  // Reserv om OfflineAudioContext saknas: ett grovt sorl av filtrerat brus i talrytm.
  *murmurFallback(ctx, r) {
    const sec = 10, B = mkBuf(ctx, sec, 2);
    for (let v = 0; v < 7; v++) {
      const f1 = bq('bp', 350 + 350 * r(), 3, B.sr), f2 = bq('bp', 1100 + 900 * r(), 4, B.sr), pan = r(), amp = 0.3 + 0.7 * r();
      let t = r() * sec;
      const end = t + sec * (0.5 + 0.4 * r());
      while (t < end) {
        const syl = 0.12 + 0.12 * r();
        burst(B, 0, t, syl, amp, syl * 0.4, { att: syl * 0.3, r, pan, fn: (w) => f1(w) * 2 + f2(w) });
        t += syl + (r() < 0.2 ? 0.3 + 0.5 * r() : 0.02);
        yield;
      }
    }
    return yield* finishTex(B);
  },
};
// Synkrona varianter (testerna: skarvkontrollen i tools/out/ambiens/render.mjs).
const TEX = Object.fromEntries(Object.keys(TEXG).map((k) => [k, (ctx, r) => runSync(TEXG[k](ctx, r))]));

// ---------------------------------------------------------------- klangbanker (engångsljud)
// Varje bank = några varianter. modal() = summa av avklingande delton (porslin, metall, klockor).
function modal(B, t, f0, parts, amp, r, { tick = 0.3 } = {}) {
  for (const [ratio, tau, a] of parts) ring(B, 0, t, f0 * ratio * (0.99 + 0.02 * r()), tau, amp * a, { r, len: Math.min(tau * 6, B.n / B.sr - t - 0.01) });
  if (tick) { let prev = 0; burst(B, 0, t, 0.002, amp * tick, 0.0005, { r, fn: (w) => { const v = w - prev; prev = w; return v; } }); }
}
const BANKS = {
  cup: { n: 4, sec: 0.5, make: (B, r) => modal(B, 0.005, 2900 + 900 * r(), [[1, 0.12, 1], [1.62, 0.08, 0.6], [2.31, 0.05, 0.4], [3.1, 0.03, 0.25]], 0.8, r) },
  cutlery: { n: 4, sec: 0.6, make: (B, r) => { const f = 2200 + 900 * r(), k = 2 + ((r() * 2) | 0); for (let i = 0; i < k; i++) modal(B, 0.005 + i * (0.03 + 0.04 * r()), f * (0.95 + 0.1 * r()), [[1, 0.2, 1], [2.02, 0.13, 0.5], [2.87, 0.08, 0.35], [3.9, 0.05, 0.2]], i ? 0.5 : 0.8, r); } },
  plate: { n: 3, sec: 0.6, make: (B, r) => { modal(B, 0.005, 1200 + 500 * r(), [[1, 0.18, 1], [2.1, 0.11, 0.6], [3.3, 0.07, 0.4], [4.6, 0.04, 0.25]], 0.7, r); burst(B, 0, 0.005, 0.05, 0.4, 0.012, { r, fn: bq('lp', 400, 0.7, B.sr) }); } },
  glass: { n: 2, sec: 1.2, make: (B, r) => modal(B, 0.005, 3700 + 900 * r(), [[1, 0.5, 1], [1.58, 0.3, 0.5], [2.2, 0.18, 0.3]], 0.7, r, { tick: 0.15 }) },
  bottle: { n: 3, sec: 0.8, make: (B, r) => { modal(B, 0.005, 1700 + 900 * r(), [[1, 0.3, 1], [2.4, 0.15, 0.4], [3.6, 0.08, 0.2]], 0.7, r); if (r() < 0.6) modal(B, 0.09 + 0.05 * r(), 1800 + 800 * r(), [[1, 0.2, 1], [2.4, 0.1, 0.3]], 0.4, r); } },
  cupdown: { n: 2, sec: 0.5, make: (B, r) => { burst(B, 0, 0.004, 0.04, 0.6, 0.01, { r, fn: bq('lp', 350, 0.7, B.sr) }); modal(B, 0.006, 2600 + 700 * r(), [[1, 0.06, 1], [1.7, 0.04, 0.5], [2.6, 0.025, 0.3]], 0.35, r); modal(B, 0.05 + 0.02 * r(), 3200 + 500 * r(), [[1, 0.04, 1], [1.6, 0.03, 0.4]], 0.15, r); } },
  shopbell: { n: 2, sec: 1.8, *make(B, r) { const f = 2100 + 450 * r(); for (const [i, t] of [0, 0.09, 0.2, 0.34].entries()) { modal(B, t + 0.02 * r(), f * (1 + 0.01 * i), [[1, 0.9, 1], [2.4, 0.5, 0.5], [3.6, 0.3, 0.3], [5.1, 0.15, 0.15]], 0.7 * (1 - i * 0.2), r, { tick: 0.1 }); yield; } } },
  servicebell: { n: 2, sec: 2.2, make: (B, r) => modal(B, 0.005, 2300 + 300 * r(), [[1, 1.5, 1], [2.76, 0.8, 0.45], [5.4, 0.4, 0.25], [8.9, 0.15, 0.08]], 0.9, r, { tick: 0.2 }) },
  register: { n: 2, sec: 1.4, make: (B, r) => {
    for (let i = 0; i < 5; i++) { burst(B, 0, 0.02 + i * 0.025, 0.003, 0.35, 0.0008, { r }); ring(B, 0, 0.02 + i * 0.025, 3200 + 300 * r(), 0.004, 0.2, { r }); }
    burst(B, 0, 0.16, 0.12, 0.8, 0.03, { r, fn: bq('lp', 300, 0.8, B.sr) }); ring(B, 0, 0.16, 90, 0.05, 0.6, { r });
    modal(B, 0.2, 2800 + 300 * r(), [[1, 0.7, 1], [2.3, 0.4, 0.5], [3.9, 0.2, 0.3]], 0.7, r);
  } },
  chime: { n: 2, sec: 3.2, *make(B, r, i) {
    const notes = i % 2 === 0 ? [784, 659, 523] : [659, 523];
    for (const [k, f] of notes.entries()) { for (const [ra, tau, a] of [[1, 1.3, 1], [4.0, 0.45, 0.25], [10, 0.15, 0.06]]) ring(B, 0, 0.02 + k * 0.5, f * ra, tau, 0.7 * a, { r, att: 0.004 }); yield; }
  } },
  dingdong: { n: 1, sec: 2.6, make: (B, r) => { [[659, 0.02], [523, 0.55]].forEach(([f, t]) => { ring(B, 0, t, f, 0.8, 0.6, { r, att: 0.003 }); ring(B, 0, t, f * 2, 0.3, 0.15, { r }); ring(B, 0, t, f * 3, 0.15, 0.08, { r }); }); } },
  knock: { n: 2, sec: 0.7, make: (B, r) => { const k = 2 + ((r() * 2) | 0); for (let i = 0; i < k; i++) { const t = 0.01 + i * (0.13 + 0.05 * r()); ring(B, 0, t, 95 + 50 * r(), 0.04, 0.9, { r }); burst(B, 0, t, 0.02, 0.5, 0.004, { r, fn: bq('bp', 1400, 1, B.sr) }); } } },
  hanger: { n: 3, sec: 0.6, make: (B, r) => { const k = 2 + ((r() * 2) | 0); for (let i = 0; i < k; i++) ring(B, 0, 0.01 + i * (0.03 + 0.05 * r()), 1600 + 1200 * r(), 0.008, 0.7, { r }); burst(B, 0, 0.02, 0.15, 0.2, 0.06, { r, fn: bq('bp', 4500, 1.5, B.sr) }); } },
  clank: { n: 3, sec: 1.4, make: (B, r) => { modal(B, 0.005, 500 + 300 * r(), [[1, 0.5, 1], [2.56, 0.3, 0.6], [4.4, 0.15, 0.4], [6.8, 0.08, 0.25]], 0.8, r, { tick: 0.5 }); if (r() < 0.5) modal(B, 0.12 + 0.08 * r(), 700 + 300 * r(), [[1, 0.25, 1], [2.56, 0.15, 0.5]], 0.4, r); } },
  ting: { n: 2, sec: 1.6, make: (B, r) => modal(B, 0.005, 1500 + 700 * r(), [[1, 0.8, 1], [2.7, 0.4, 0.5], [5.1, 0.2, 0.25]], 0.6, r, { tick: 0.1 }) },
  stamp: { n: 2, sec: 0.4, make: (B, r) => { ring(B, 0, 0.005, 110 + 30 * r(), 0.03, 1, { r }); burst(B, 0, 0.005, 0.02, 0.6, 0.004, { r, fn: bq('bp', 2000, 1, B.sr) }); } },
  impact: { n: 2, sec: 1.4, *make(B, r) { const len = 0.7 + 0.5 * r(); for (let t = 0.02; t < len; t += 1 / (19 + 3 * r())) { burst(B, 0, t, 0.004, 0.5, 0.001, { r }); ring(B, 0, t, 1250 + 100 * r(), 0.01, 0.4, { r }); ring(B, 0, t, 2700 + 150 * r(), 0.006, 0.25, { r }); } yield; ring(B, 0, 0.01, 520, len * 0.8, 0.12, { r, f2: 640, len }); } },
  clunk: { n: 2, sec: 0.9, make: (B, r) => { modal(B, 0.005, 180 + 120 * r(), [[1, 0.25, 1], [2.3, 0.1, 0.5], [3.8, 0.05, 0.3]], 0.9, r, { tick: 0.4 }); } },
  phone: { n: 1, sec: 4.6, make: (B, r) => {
    for (const t0 of [0.05, 3.0]) for (let k = 0; k < 1.2 * 16; k++) { const f = k % 2 ? 1400 : 1100, t = t0 + k / 16; ring(B, 0, t, f, 0.05, 0.4, { r, len: 1 / 16, att: 0.004 }); ring(B, 0, t, f * 3, 0.02, 0.08, { r, len: 1 / 16 }); }
  } },
  buzzer: { n: 1, sec: 2.2, *make(B, r) { const lp = bq('lp', 1800, 0.7, B.sr), inc = 440 / B.sr; for (const t0 of [0.02, 1.1]) { const i0 = Math.round(t0 * B.sr), L = Math.round(0.8 * B.sr); let ph = 0; for (let k = 0; k < L; k++) { ph += inc; if (ph >= 1) ph -= 1; B.d[0][(i0 + k) % B.n] += lp(ph < 0.5 ? 0.4 : -0.4) * Math.min(1, k / 200, (L - k) / 200); if ((k & CHUNK) === CHUNK) yield; } } } },
  beep: { n: 3, sec: 0.35, make: (B, r, i) => { const f = [2850, 3050, 2950][i]; ring(B, 0, 0.005, f, 10, 0.7, { r, len: i === 2 ? 0.07 : 0.11, att: 0.004 }); if (i === 2) ring(B, 0, 0.13, f, 10, 0.7, { r, len: 0.07, att: 0.004 }); } },
};
// Klangbankerna mjukas upp i svansen (inga klick när bufferten tar slut).
function* finishBank(B) {
  const L = Math.min(B.n, Math.round(0.02 * B.sr));
  for (let k = 0; k < L; k++) B.d[0][B.n - 1 - k] *= k / L;
  return yield* peakNorm(B);
}
// En hel klangbank: varianterna en i taget (BANK_SR – delton över ≈ 15 kHz hörs ändå inte här).
function* bankJob(ctx, name) {
  const def = BANKS[name];
  if (!def) return null;
  const br = rng(name.length * 104729 + 5), list = [];
  for (let i = 0; i < def.n; i++) {
    const B = mkBuf(ctx, def.sec, 1, Math.min(BANK_SR, ctx.sampleRate));
    const it = def.make(B, br, i);
    if (it && typeof it.next === 'function') yield* it;
    yield;
    list.push(yield* finishBank(B));
  }
  return list;
}

// ---------------------------------------------------------------- simspråkssorl (offline)
// Folkmyllret byggs av spelets egna röster (voices.js): ett trettiotal repliker från olika
// personer renderas i en OfflineAudioContext (av huvudtråden), lågpassas, får lite rumsklang och
// viks ihop till en sömlös loop.
const ORD = ['hej', 'jaha', 'precis', 'nämen', 'kolla', 'vad', 'tror du', 'mm', 'ja', 'nej', 'kanske', 'i morgon', 'fika', 'jobbet', 'pengar', 'bussen',
  'regnet', 'visst', 'alltså', 'typ', 'eller hur', 'jättebra', 'okej', 'vi ses', 'lördag', 'mamma', 'titta', 'glass', 'hundar', 'vänta'];
function babbleText(r, kids) {
  if (kids) return pick(r, ['Hej!', 'Kom hit!', 'Wiii!', 'Jag vann!', 'Titta på mig!', 'Haha!', 'Nej, min tur!', 'Fånga mig!', 'Aaaah!', 'Högre!']);
  if (r() < 0.08) return pick(r, ['haha ha!', 'hihi', 'ha ha ha ha!']);
  const n = 2 + ((r() * 7) | 0), w = [];
  for (let i = 0; i < n; i++) w.push(pick(r, ORD));
  return w.join(' ') + pick(r, ['.', '.', '?', '!', '...', ',']);
}
const OACls = () => (typeof window !== 'undefined' ? (window.OfflineAudioContext || window.webkitOfflineAudioContext) : null);
// Schemaläggningen av replikerna sker i skivor (en replik per yield); själva renderingen gör
// webbläsaren utanför huvudtråden. Generatorn returnerar ett Promise<AudioBuffer>.
function* babbleJob(ctx, { sec = 12, n = 40, kids = false, lp = 3000, wet = 0.2, seed = 1 } = {}) {
  const OAC = OACls();
  if (!OAC || !VR?.babble) return yield* TEXG.murmurFallback(ctx, rng(seed));
  const r = rng(seed), tail = 3;
  let sr = TSR, oc;
  yield 'tung'; // nästa steg: en OfflineAudioContext på ≈ 2 MB
  try { oc = new OAC(2, Math.round((sec + tail) * sr), sr); } catch { sr = 44100; oc = new OAC(2, Math.round((sec + tail) * sr), sr); }
  yield;
  const low = oc.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = lp; low.Q.value = 0.5;
  const hi = oc.createBiquadFilter(); hi.type = 'highpass'; hi.frequency.value = kids ? 250 : 140;
  low.connect(hi); hi.connect(oc.destination);
  if (wet > 0 && oc.createConvolver) {
    const irSec = kids ? 1.4 : 0.8, ir = oc.createBuffer(2, Math.round(irSec * sr), sr);
    yield* irFill(ir, irSec, kids ? 0.5 : 0.35);
    yield 'tung'; // nästa steg: konvolverns förberedelse
    const cv = oc.createConvolver(); cv.buffer = ir;
    yield;
    const wg = oc.createGain(); wg.gain.value = wet; hi.connect(cv); cv.connect(wg); wg.connect(oc.destination);
  }
  for (let i = 0; i < n; i++) {
    const t = r() * sec, g = oc.createGain();
    g.gain.value = (kids ? 0.35 : 0.25) + 0.75 * r() ** 1.5;
    let node = g;
    if (oc.createStereoPanner) { const p = oc.createStereoPanner(); p.pan.value = (r() * 2 - 1) * 0.8; g.connect(p); node = p; }
    node.connect(low);
    const voice = voiceFor((kids ? 'barn' : r() < 0.5 ? 'dam' : 'herr') + ':' + seed + ':' + i);
    const mood = kids ? (r() < 0.5 ? 'glad' : 'ivrig') : r() < 0.75 ? 'neutral' : r() < 0.6 ? 'glad' : 'ivrig';
    try { VR.babble(oc, g, t, babbleText(r, kids), voice, mood); } catch { /* en replik mindre */ }
    yield;
  }
  return oc.startRendering().then((out) => {
    const L = Math.round(sec * sr), B = mkBuf(ctx, sec, 2, sr);
    for (let c = 0; c < 2; c++) {
      const src = out.getChannelData(Math.min(c, out.numberOfChannels - 1)), d = B.d[c];
      for (let i = 0; i < d.length; i++) d[i] = src[i] + (i + L < src.length ? src[i + L] : 0); // vik svansen över början
    }
    return normRms(B);
  });
}
const renderBabble = (ctx, o) => Promise.resolve(runSync(babbleJob(ctx, o)));
// Hundskall långt bort (voices.js-hundar renderade en gång). Promise<[AudioBuffer]>.
function* barksJob(ctx, seed = 7) {
  const OAC = OACls();
  if (!OAC || !VR?.bark) return [];
  const sorts = ['stor', 'mellan', 'tax', 'liten'], sr = 22050, per = 2;
  let oc;
  yield 'tung';
  try { oc = new OAC(1, sr * per * sorts.length, sr); } catch { return []; }
  for (let i = 0; i < sorts.length; i++) { try { VR.bark(oc, oc.destination, i * per + 0.02, sorts[i], i === 3 ? 'glad' : '', seed + i * 101); } catch { /* ok */ } yield; }
  return oc.startRendering().then((out) => {
    const x = out.getChannelData(0);
    return sorts.map((_, i) => {
      const B = mkBuf(ctx, per, 1, sr);
      B.d[0].set(x.subarray(i * per * sr, (i + 1) * per * sr));
      return runSync(finishBank(B));
    });
  });
}
const renderBarks = (ctx, seed) => Promise.resolve(runSync(barksJob(ctx, seed)));
// Rumsklang: avklingande brus som mörknar med tiden, lite tidiga reflexer (fyller en stereobuffert).
function* irFill(b, sec, bright = 0.4) {
  const sr = b.sampleRate, n = b.length, r = rng(sec * 1000 + 7), dec = Math.exp(-5.5 / n), ramp = sr * 0.004;
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(Math.min(c, b.numberOfChannels - 1));
    let lp = 0, e = 1;
    for (let i0 = 0; i0 < n; i0 += CHUNK + 1) {
      const i1 = Math.min(n, i0 + CHUNK + 1);
      for (let i = i0; i < i1; i++) {
        const a = 0.02 + bright * 0.5 * (1 - i / n);
        lp += a * ((r() * 2 - 1) - lp);
        d[i] = lp * e * (i < ramp ? i / ramp : 1);
        e *= dec;
      }
      yield;
    }
    for (let k = 0; k < 6; k++) { const i = Math.round(sr * (0.006 + 0.04 * r())); if (i < n) d[i] += (r() < 0.5 ? -1 : 1) * (0.3 + 0.4 * r()); }
  }
  return b;
}
function makeIR(ctx, sec, bright = 0.4) {
  const b = ctx.createBuffer(2, Math.max(1, Math.round(sec * ctx.sampleRate)), ctx.sampleRate);
  return runSync(irFill(b, sec, bright));
}
// Brusslingor: vitt, rosa och brunt (stereo, olika i vänster/höger), sömlöst loopade.
function* noiseJob(ctx, kind, sec, r) {
  const sr = kind === 'white' ? ctx.sampleRate : TSR;
  const B = mkBuf(ctx, sec, 2, sr);
  const BL = CHUNK + 1;
  for (const d of B.d) {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0;
    const N = d.length;
    for (let i0 = 0; i0 < N; i0 += BL) {
      const i1 = Math.min(N, i0 + BL);
      if (kind === 'white') for (let i = i0; i < i1; i++) d[i] = r() * 2 - 1;
      else if (kind === 'pink') {
        for (let i = i0; i < i1; i++) {
          const w = r() * 2 - 1;
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
        }
      } else for (let i = i0; i < i1; i++) { br = (br + 0.02 * (r() * 2 - 1)) / 1.02; d[i] = br; }
      yield;
    }
    // skarven: dra bort en rak linje så att slutet möter början (inget klick i lågbasen), och medelvärdet
    const e = d[N - 1] - d[0];
    let m = 0;
    for (let i0 = 0; i0 < N; i0 += BL) { const i1 = Math.min(N, i0 + BL); for (let i = i0; i < i1; i++) { d[i] -= e * (i / (N - 1)); m += d[i]; } yield; }
    m /= N;
    for (let i0 = 0; i0 < N; i0 += BL) { const i1 = Math.min(N, i0 + BL); for (let i = i0; i < i1; i++) d[i] -= m; yield; }
  }
  return yield* finishTex(B, { target: 0.3 });
}
const makeNoise = (ctx, kind, sec, r) => runSync(noiseJob(ctx, kind, sec, r));

// ---------------------------------------------------------------- motorn
export function createAmbienceEngine(ctx, dest, opts = {}) {
  const r = opts.seed != null ? rng(opts.seed) : Math.random;
  const has = (m) => typeof ctx[m] === 'function';
  // filterfrekvenser under Nyquist (vissa mobiler och huvudlös Chromium kör på 16–22 kHz)
  const hz = (f) => Math.min(f, ctx.sampleRate * 0.45);
  const E = { ctx, r, nodes: 0, awake: false };
  // Mobilprofil (pekskärm): färre samtidiga röster och kortare efterklang – ljudtråden är svagare där.
  const lite = opts.lite ?? mobile();
  const maxEv = lite ? 8 : MAX_EV, carMax = lite ? 2 : CAR_VOICES;
  const live = !opts.offline;
  const now_ms = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // ---------- byggkön: allt som räknas fram byggs som jobb (generatorer) i små skivor
  // Nycklar: 'n:pink' (brus), 't:drops' (textur), 'b:cup' (klangbank), 'ir:hall' (efterklang).
  // Spelet: högst BUILD_MS per bildruta + tomgångstid; det som inte är klart väntar. Offline: direkt.
  const built = new Map(), jobs = new Map(), waiting = new Set();
  const Q = { syncBuilds: 0, ms: 0, sliceMax: 0, slices: 0, worst: {} }; // worst: längsta enskilda steg per jobb (ms)
  function jobFor(key) {
    const i = key.indexOf(':'), kind = key.slice(0, i), name = key.slice(i + 1);
    if (kind === 'n') return noiseJob(ctx, name, name === 'white' ? 4 : 5, rng(name.length * 977 + 3));
    if (kind === 'b') return bankJob(ctx, name);
    if (kind === 'ir') return irJob(name);
    if (name === 'murmur') return babbleJob(ctx, { sec: 12, n: 44, lp: 3000, wet: 0.2, seed: 17 });
    if (name === 'kids') return babbleJob(ctx, { sec: 10, n: 22, kids: true, lp: 2600, wet: 0.45, seed: 31 });
    if (name === 'barks') return barksJob(ctx);
    return TEXG[name] ? TEXG[name](ctx, rng(name.length * 7919 + (opts.seed ?? 11))) : null;
  }
  function done(key, v) {
    jobs.delete(key);
    if (v && typeof v.then === 'function') { // sorlet/hundarna: webbläsaren renderar klart
      waiting.add(key);
      v.then((x) => { waiting.delete(key); built.set(key, x || null); }, () => { waiting.delete(key); built.set(key, null); });
      return;
    }
    built.set(key, v || null);
  }
  // Kör ett jobb tills det är klart eller klockan passerat "until": 'klar' | 'tid' | 'tung' (jobbet
  // säger att nästa steg är odelbart och tungt – det tas helst på tomgång, se pump).
  const heavy = new Map(); // nyckel → när jobbet började vänta på tomgång (ms)
  function step(key, it, until) {
    for (;;) {
      let res;
      const t0 = now_ms();
      try { res = it.next(); } catch { res = { done: true, value: null }; }
      const t1 = now_ms();
      if (t1 - t0 > (Q.worst[key] || 0)) Q.worst[key] = +(t1 - t0).toFixed(2);
      heavy.delete(key);
      if (res.done) { done(key, res.value); return 'klar'; }
      if (res.value === 'tung' && live) { heavy.set(key, t1); return 'tung'; }
      if (t1 >= until) return 'tid';
    }
  }
  const drain = (key) => { const it = jobs.get(key); while (it && jobs.has(key)) step(key, it, Infinity); };
  function request(key) {
    if (built.has(key) || jobs.has(key) || waiting.has(key)) return;
    const it = jobFor(key);
    if (!it) { built.set(key, null); return; }
    jobs.set(key, it);
    idleKick();
  }
  const get = (key) => built.get(key) ?? null;
  // Allt i listan klart? Saknas något begärs det (offline: byggs direkt).
  function ensure(keys) {
    let all = true;
    for (const k of keys || []) {
      if (!built.has(k)) { request(k); if (!live) drain(k); }
      if (get(k) == null) all = false;
    }
    return all;
  }
  // Reserv: något behövdes som inte stod i behovslistorna – bygg det direkt (räknas i statistiken).
  function mustHave(key) {
    const v = get(key);
    if (v != null || built.has(key)) return v;
    request(key);
    if (jobs.has(key)) { if (live) Q.syncBuilds++; drain(key); }
    return get(key);
  }
  const hasIdle = typeof requestIdleCallback === 'function';
  // idle = anropad på tomgång med minst så många ms kvar (0 = i bildrutan). Ett tungt steg tas i
  // bildrutan bara om webbläsaren saknar requestIdleCallback eller ingen tomgång kommit på 1,5 s.
  function pump(ms, idle = 0) {
    if (!jobs.size) return;
    const t0 = now_ms(), until = t0 + ms;
    for (const [key, it] of jobs) {
      if (heavy.has(key) && hasIdle && idle < 6 && t0 - heavy.get(key) < 1500) continue;
      if (step(key, it, until) === 'tid' || now_ms() >= until) break;
    }
    const dt = now_ms() - t0;
    Q.ms += dt; Q.slices++; if (dt > Q.sliceMax) Q.sliceMax = dt;
  }
  let idleQ = false;
  function idleKick() {
    if (idleQ || !live || !hasIdle) return;
    idleQ = true;
    requestIdleCallback((dl) => {
      idleQ = false;
      if (!E.awake || !jobs.size) return;
      const left = dl.didTimeout ? 0 : dl.timeRemaining();
      pump(dl.didTimeout ? BUILD_MS : clamp(left - 1, 1, 8), left);
      if (jobs.size) idleKick();
    }, { timeout: 250 });
  }
  E.request = (keys) => { for (const k of keys) request(k); };

  // bussen: bäddar och småljud → mix → mjuk begränsare → duck → master → ut. Begränsaren är en
  // tanh-kurva (ingen DynamicsCompressor – den lägger på automatisk "makeup"-förstärkning som skiljer
  // mellan webbläsarna): linjär upp till ≈ −20 dBFS, mjukt tak vid ≈ −12 dBFS (åskknallar, klirr).
  const mix = ctx.createGain(); mix.gain.value = AMB_LEVEL;
  const comp = ctx.createWaveShaper();
  { const n = 2048, c = new Float32Array(n), L = 0.25; for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = L * Math.tanh(x / L); } comp.curve = c; comp.oversample = lite ? 'none' : '2x'; }
  const gov = ctx.createGain(); gov.gain.value = 1;      // nivåvakten
  const duckG = ctx.createGain(); duckG.gain.value = 1;
  const out = ctx.createGain(); out.gain.value = 0;
  mix.connect(comp); comp.connect(gov); gov.connect(duckG); duckG.connect(out); out.connect(dest);
  // vaktens mätare (före vakten, framkoppling): rått + K-vägt (högpass 60 Hz, +4 dB över 1,5 kHz),
  // vänster och höger var för sig (bilar och fåglar panoreras – en kanal räcker inte)
  const meter = (() => {
    if (!has('createAnalyser') || !has('createChannelSplitter')) return null;
    const an = () => { const a = ctx.createAnalyser(); a.fftSize = 4096; return a; };
    const pair = (src) => { const sp = ctx.createChannelSplitter(2), L = an(), R = an(); src.connect(sp); sp.connect(L, 0); sp.connect(R, 1); return [L, R]; };
    const hp = ctx.createBiquadFilter(), sh = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 60; hp.Q.value = 0.5; sh.type = 'highshelf'; sh.frequency.value = 1500; sh.gain.value = 4;
    comp.connect(hp); hp.connect(sh);
    return { raw: pair(comp), k: pair(sh), buf: new Float32Array(4096), pR: 0, pK: 0, g: 1 };
  })();
  const power = (an, buf) => { an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return s / buf.length; };
  const power2 = ([L, R], buf) => (power(L, buf) + power(R, buf)) / 2;
  function governor(now, step) {
    const m = meter;
    if (!m || !m.raw[0].getFloatTimeDomainData) return;
    const pR = power2(m.raw, m.buf), pK = power2(m.k, m.buf);
    m.pR += (pR - m.pR) * (1 - Math.exp(-step / (pR > m.pR ? GOV_ATT : GOV_TAU)));
    m.pK += (pK - m.pK) * (1 - Math.exp(-step / (pK > m.pK ? GOV_ATT : GOV_TAU)));
    const over = Math.max(10 * Math.log10(m.pR + 1e-12) - GOV_RAW, 10 * Math.log10(m.pK + 1e-12) - GOV_K, 0);
    const g = Math.max(GOV_MIN, 10 ** (-over / 20));
    if (Math.abs(g - m.g) > 0.01) { gov.gain.setTargetAtTime(g, now, g < m.g ? 0.4 : 1); m.g = g; }
  }
  const evBus = ctx.createGain(); evBus.connect(mix);
  // efterklang: en konvolver per sort (ute/rum/hall), byggd i kön en gång och sedan återanvänd
  let conv = null, revIn = null, revOut = null, revKind = null;
  const IR_SEC = { ute: 1.1, rum: 0.7, hall: 2.1 };
  function* irJob(kind) {
    if (!has('createConvolver')) return null;
    // mobilen: kortare efterklang (billigare i ljudtråden, och konvolverns förberedelse – det enda
    // odelbara steget, ≈ 4,5 ms per sekund efterklang på en dator – blir kort)
    const sec = lite ? Math.min((IR_SEC[kind] || 0.9) * 0.6, 0.9) : (IR_SEC[kind] || 0.9);
    const b = ctx.createBuffer(2, Math.max(1, Math.round(sec * ctx.sampleRate)), ctx.sampleRate);
    yield* irFill(b, sec, kind === 'hall' ? 0.55 : 0.35);
    yield 'tung'; // nästa steg går inte att dela: konvolverns förberedelse (≈ 4,5 ms per sekund efterklang)
    const cv = ctx.createConvolver(); cv.buffer = b;
    return cv;
  }
  function reverb(kind, send) {
    if (!send && !revIn) return;
    if (!revIn) { revIn = ctx.createGain(); revIn.gain.value = 0; revOut = ctx.createGain(); revOut.gain.value = REV_OUT; revOut.connect(mix); }
    if (kind !== revKind) {
      const cv = ensure(['ir:' + kind]) ? get('ir:' + kind) : null; // inte klar: den förra klingar vidare
      if (cv) {
        const old = conv;
        if (old) { try { revIn.disconnect(old); } catch { /* ok */ } setTimeoutSafe(() => { if (old !== conv) { try { old.disconnect(); } catch { /* ok */ } } }, 2500); }
        try { cv.disconnect(); } catch { /* ok */ }
        revIn.connect(cv); cv.connect(revOut);
        conv = cv; revKind = kind;
      }
    }
    revIn.gain.setTargetAtTime(send || 0, ctx.currentTime, 0.5);
  }
  const setTimeoutSafe = (fn, ms) => { if (typeof setTimeout === 'function' && !opts.offline) setTimeout(fn, ms); else fn(); };

  // delade brusslingor (räknar sina användare – en slinga utan användare stoppas efter 2 s)
  const noiseSrc = {}, noiseRef = {}, noiseIdle = {};
  function noise(kind) {
    if (!noiseSrc[kind]) {
      const s = ctx.createBufferSource(); s.buffer = mustHave('n:' + kind); s.loop = true;
      s.start(ctx.currentTime, r() * 3);
      noiseSrc[kind] = s; noiseRef[kind] = 0;
    }
    return noiseSrc[kind];
  }
  function noiseStop(kind, now) { try { noiseSrc[kind].stop(now); noiseSrc[kind].disconnect(); } catch { /* ok */ } delete noiseSrc[kind]; delete noiseRef[kind]; delete noiseIdle[kind]; }
  function noiseSweep(now) {
    for (const k of Object.keys(noiseSrc)) {
      if (noiseRef[k] > 0) { noiseIdle[k] = 0; continue; }
      if (!noiseIdle[k]) noiseIdle[k] = now;
      else if (now - noiseIdle[k] > 2) noiseStop(k, now);
    }
  }

  // Ett "scope" äger sina noder: kill() kopplar bort allt och stoppar källorna.
  function scope() {
    const list = [], srcs = [], taps = [];
    const S = {
      g(v = 1) { const n = ctx.createGain(); n.gain.value = v; list.push(n); E.nodes++; return n; },
      f(type, freq, Q = 0.7) { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = Math.min(freq, ctx.sampleRate * 0.45); n.Q.value = Q; list.push(n); E.nodes++; return n; },
      o(type, freq, t0 = ctx.currentTime) { const n = ctx.createOscillator(); n.type = type; n.frequency.value = freq; n.start(t0); list.push(n); srcs.push(n); E.nodes++; return n; },
      b(buffer, { loop = true, rate = 1, t0 = ctx.currentTime, offset = 0 } = {}) {
        const n = ctx.createBufferSource(); n.buffer = buffer; n.loop = loop; n.playbackRate.value = rate;
        n.start(t0, loop ? offset % buffer.duration : 0); list.push(n); srcs.push(n); E.nodes++; return n;
      },
      pan(p) {
        if (!has('createStereoPanner')) return S.g(1);
        const n = ctx.createStereoPanner(); n.pan.value = clamp(p, -1, 1); list.push(n); E.nodes++; return n;
      },
      from(kind, node) { const s = noise(kind); s.connect(node); taps.push([s, node, kind]); noiseRef[kind] = (noiseRef[kind] || 0) + 1; return node; },
      srcs, list,
      kill(at = ctx.currentTime) {
        for (const s of srcs) { try { s.stop(at); } catch { /* ok */ } }
        for (const [s, n, kind] of taps) { try { s.disconnect(n); } catch { /* ok */ } if (noiseSrc[kind] === s) noiseRef[kind]--; }
        for (const n of list) { try { n.disconnect(); } catch { /* ok */ } }
        E.nodes -= list.length; list.length = 0; srcs.length = 0; taps.length = 0;
      },
    };
    return S;
  }

  // ---------- texturer och banker (ur byggkön; ensure() före användning, mustHave() är bara en reserv)
  const tex = (name) => mustHave('t:' + name);
  const bank = (name) => mustHave('b:' + name);
  // Förbered allt ett recept behöver (testerna väntar in sorlet innan de renderar).
  E.prepare = async (names = [], banks = []) => {
    const keys = [...names.map((n) => 't:' + n), ...banks.map((b) => 'b:' + b)];
    for (const k of keys) { request(k); drain(k); }
    for (let i = 0; i < 600 && keys.some((k) => !built.has(k)); i++) await new Promise((res) => setTimeout(res, 25));
    return names.filter((n) => get('t:' + n) == null);
  };

  // ---------- ljudbäddarna
  // make(S) → { out, set(p, now) } eller null (textur inte klar än). p = receptets parametrar.
  const BEDS = {
    trafik(S) {
      const lp = S.from('brown', S.f('lowpass', 300, 0.6)), g1 = S.g(0.8), bp = S.from('pink', S.f('bandpass', 850, 0.6)), g2 = S.g(0.35), o = S.g(0);
      lp.connect(g1); g1.connect(o); bp.connect(g2); g2.connect(o);
      return { out: o, set(p, t) { lp.frequency.setTargetAtTime(p.muffle ? 170 : 300, t, 0.3); bp.frequency.setTargetAtTime(p.muffle ? 420 : 850 + 700 * (p.wet || 0), t, 0.3); g2.gain.setTargetAtTime(p.muffle ? 0.08 : 0.35 + 0.3 * (p.wet || 0), t, 0.3); } };
    },
    vind(S) {
      const bp = S.from('pink', S.f('bandpass', 400, 0.8)), wh = S.from('white', S.f('bandpass', 950, 14)), whg = S.g(0), am = S.g(1), lp = S.f('lowpass', 8000), o = S.g(0);
      bp.connect(am); wh.connect(whg); whg.connect(am); am.connect(lp); lp.connect(o);
      return { out: o, set(p, t) {
        const gu = p.gust || 1;
        am.gain.setTargetAtTime(0.35 + 0.65 * gu, t, 0.25);
        bp.frequency.setTargetAtTime(220 + 420 * clamp01(gu - 0.3), t, 0.35);
        wh.frequency.setTargetAtTime(760 + 420 * clamp01(gu - 0.5), t, 0.6);
        whg.gain.setTargetAtTime((p.whistle || 0) * 0.5 * clamp01(gu - 0.6), t, 0.3);
        lp.frequency.setTargetAtTime(hz(p.muffle ? 600 : p.soft ? 1500 : 8000), t, 0.3);
      } };
    },
    regn(S) {
      const hp = S.from('white', S.f('highpass', 1100, 0.6)), lpH = S.f('lowpass', 7500, 0.5), gH = S.g(1), body = S.from('pink', S.f('lowpass', 950, 0.6)), gL = S.g(0.9);
      hp.connect(lpH); lpH.connect(gH); body.connect(gL);
      const T = tex('drops'); const d = T ? S.b(T, { rate: 0.95 + 0.1 * r(), offset: r() * 5 }) : null;
      const dh = S.f('highpass', 600, 0.6), gD = S.g(0.9);
      if (d) { d.connect(dh); dh.connect(gD); }
      const m = S.f('lowpass', 12000, 0.5), o = S.g(0);
      gH.connect(m); gL.connect(m); gD.connect(m); m.connect(o);
      return { out: o, set(p, t) {
        const heavy = p.heavy || 0;
        m.frequency.setTargetAtTime(hz(p.muffle ? 1100 : 12000), t, 0.3);
        gH.gain.setTargetAtTime(p.muffle ? 0.3 : 0.7 + 0.5 * heavy, t, 0.4);
        gL.gain.setTargetAtTime(0.6 + 0.8 * heavy, t, 0.4);
        gD.gain.setTargetAtTime(p.muffle ? 1.4 : 1 - 0.3 * heavy, t, 0.4);
      } };
    },
    lov(S) {
      const bp = S.from('white', S.f('bandpass', 5200, 0.6)), am = S.g(0.5), o = S.g(0);
      bp.connect(am); am.connect(o);
      return { out: o, set(p, t) { am.gain.setTargetAtTime(0.25 + 0.75 * clamp01((p.gust || 1) - 0.4), t, 0.2); } };
    },
    sorl(S) {
      const T = tex('murmur'); if (!T) return null;
      const a = S.b(T, { rate: 0.98 + 0.04 * r(), offset: r() * 12 }), b = S.b(T, { rate: 0.95 + 0.03 * r(), offset: r() * 12 });
      const gb = S.g(0), lp = S.f('lowpass', 3200, 0.5), o = S.g(0);
      a.connect(lp); b.connect(gb); gb.connect(lp); lp.connect(o);
      return { out: o, rev: lp, set(p, t) { gb.gain.setTargetAtTime(p.dense ? 0.8 : 0, t, 0.5); lp.frequency.setTargetAtTime(p.muffle ? 700 : p.far ? 1800 : 3200, t, 0.4); } };
    },
    steg(S) { const T = tex('steps'), s = S.b(T, { offset: r() * 8 }), hp = S.f('highpass', 180), o = S.g(0); s.connect(hp); hp.connect(o); return { out: o, rev: hp }; },
    barn(S) {
      const T = tex('kids'); if (!T) return null;
      const s = S.b(T, { rate: 0.97 + 0.06 * r(), offset: r() * 10 }), lp = S.f('lowpass', 2600, 0.5), o = S.g(0);
      s.connect(lp); lp.connect(o);
      return { out: o, rev: lp, set(p, t) { lp.frequency.setTargetAtTime(p.far ? 1500 : 2600, t, 0.4); } };
    },
    syrsor(S) { const s = S.b(tex('crickets'), { offset: r() * 6 }), hp = S.f('highpass', 2500), o = S.g(0); s.connect(hp); hp.connect(o); return { out: o }; },
    vatten(S) {
      const s = S.b(tex('lapping'), { rate: 0.96 + 0.08 * r(), offset: r() * 10 }), lp = S.f('lowpass', 2600, 0.5), low = S.from('pink', S.f('lowpass', 320, 0.7)), gl = S.g(0.5), o = S.g(0);
      s.connect(lp); lp.connect(o); low.connect(gl); gl.connect(o);
      return { out: o, set(p, t) {
        const flow = p.flow || 0; // floden: jämnt strömmande (mer lågt brus), skvalpet lite mörkare
        lp.frequency.setTargetAtTime((2600 - 900 * flow) + 1500 * clamp01((p.gust || 1) - 1), t, 0.4);
        gl.gain.setTargetAtTime(0.5 + 0.2 * flow, t, 0.6);
      } };
    },
    fontan(S) {
      const bp = S.from('white', S.f('bandpass', 1600, 0.45)), g1 = S.g(0.55), s = S.b(tex('drops'), { rate: 1.25, offset: r() * 5 }), g2 = S.g(0.9), o = S.g(0);
      bp.connect(g1); g1.connect(o); s.connect(g2); g2.connect(o);
      return { out: o };
    },
    stupror(S) { const s = S.b(tex('trickle'), { offset: r() * 6 }), bp = S.f('bandpass', 900, 0.5), o = S.g(0); s.connect(bp); bp.connect(o); return { out: o }; },
    kyl(S) { // kylaggregat/kyldisk: 50 Hz-brum med övertoner + fläkt
      const re = new Float32Array(9), im = new Float32Array(9);
      [0, 0.25, 1, 0.45, 0.35, 0.12, 0.2, 0.06, 0.08].forEach((a, i) => { im[i] = a; });
      const ob = S.o('sine', 50); ob.setPeriodicWave(ctx.createPeriodicWave(re, im));
      const gh = S.g(0.9), fan = S.from('pink', S.f('lowpass', 700, 0.6)), gf = S.g(0.45), o = S.g(0);
      ob.connect(gh); gh.connect(o); fan.connect(gf); gf.connect(o);
      return { out: o };
    },
    lysror(S) { // lysrörsbrum: 100 Hz + surr högt upp
      const o1 = S.o('sine', 100), g1 = S.g(0.6), o2 = S.o('sawtooth', 100), bp = S.f('bandpass', 3000, 1.2), g2 = S.g(0.25), o = S.g(0);
      o1.connect(g1); g1.connect(o); o2.connect(bp); bp.connect(g2); g2.connect(o);
      return { out: o };
    },
    flakt(S) { const lp = S.from('pink', S.f('lowpass', 460, 0.6)), o = S.g(0); lp.connect(o); return { out: o }; },
    fritos(S) {
      const s = S.b(tex('crackle'), { rate: 0.95 + 0.1 * r(), offset: r() * 5 }), hp = S.f('highpass', 1800), gc = S.g(1);
      const bp = S.from('white', S.f('bandpass', 5500, 0.7)), gs = S.g(0.55), o = S.g(0);
      s.connect(hp); hp.connect(gc); gc.connect(o); bp.connect(gs); gs.connect(o);
      return { out: o, set(p, t) { const lp = p.muffle ? 0.5 : 1; gc.gain.setTargetAtTime(lp, t, 0.3); } };
    },
    grill(S) {
      const s = S.b(tex('crackle'), { rate: 0.65, offset: r() * 5 }), bp = S.f('bandpass', 2800, 0.6), gc = S.g(0.8);
      const hs = S.from('white', S.f('bandpass', 3400, 0.5)), gs = S.g(0.5), o = S.g(0);
      s.connect(bp); bp.connect(gc); gc.connect(o); hs.connect(gs); gs.connect(o);
      return { out: o };
    },
    bubbel(S) {
      const s = S.b(tex('bubbles'), { offset: r() * 5 }), o = S.g(0), pump = S.o('sine', 100), pg = S.g(0.15), p2 = S.o('sawtooth', 50), lp = S.f('lowpass', 300), pg2 = S.g(0.08);
      s.connect(o); pump.connect(pg); pg.connect(o); p2.connect(lp); lp.connect(pg2); pg2.connect(o);
      return { out: o };
    },
    tangent(S) { const s = S.b(tex('typing'), { offset: r() * 8 }), o = S.g(0); s.connect(o); return { out: o, rev: o }; },
    klocka(S) { const s = S.b(tex('clock'), { offset: r() * 2 }), o = S.g(0); s.connect(o); return { out: o }; },
    band(S) {
      const s = S.b(tex('rattle'), { offset: r() * 4 }), bp = S.f('bandpass', 2000, 0.5), m = S.from('brown', S.f('lowpass', 200)), gm = S.g(0.8), o = S.g(0);
      s.connect(bp); bp.connect(o); m.connect(gm); gm.connect(o);
      return { out: o, rev: bp };
    },
    tvatt(S) {
      const s = S.b(tex('washer'), { offset: r() * 8 }), o = S.g(0), hum = S.o('sawtooth', 50), lp = S.f('lowpass', 180), hg = S.g(0.12);
      s.connect(o); hum.connect(lp); lp.connect(hg); hg.connect(o);
      return { out: o };
    },
    ugn(S) {
      const rb = S.from('brown', S.f('lowpass', 240, 0.6)), gr = S.g(1), s = S.b(tex('crackle'), { rate: 0.5, offset: r() * 5 }), bp = S.f('bandpass', 2400, 0.7), gc = S.g(0.25), o = S.g(0);
      rb.connect(gr); gr.connect(o); s.connect(bp); bp.connect(gc); gc.connect(o);
      return { out: o };
    },
    buss(S) { // inne i bussen: dieselmullret och vägen
      const eng = S.o('sawtooth', 31), lp = S.f('lowpass', 190, 0.8), ge = S.g(0.5), rd = S.from('brown', S.f('lowpass', 260)), gr = S.g(1), o = S.g(0);
      eng.connect(lp); lp.connect(ge); ge.connect(o); rd.connect(gr); gr.connect(o);
      return { out: o };
    },
  };
  // Vad varje bädd och småljud behöver ur byggkön (n = brus, t = textur, b = klangbank). Saknas
  // något väntar ljudet – inget byggs synkront i spelet (statistiken räknar reserverna: syncBuilds).
  const BED_NEEDS = {
    trafik: ['n:brown', 'n:pink'], vind: ['n:pink', 'n:white'], regn: ['n:white', 'n:pink', 't:drops'], lov: ['n:white'],
    sorl: ['t:murmur'], steg: ['t:steps'], barn: ['t:kids'], syrsor: ['t:crickets'], vatten: ['t:lapping', 'n:pink'],
    fontan: ['n:white', 't:drops'], stupror: ['t:trickle'], kyl: ['n:pink'], lysror: [], flakt: ['n:pink'],
    fritos: ['t:crackle', 'n:white'], grill: ['t:crackle', 'n:white'], bubbel: ['t:bubbles'], tangent: ['t:typing'],
    klocka: ['t:clock'], band: ['t:rattle', 'n:brown'], tvatt: ['t:washer'], ugn: ['n:brown', 't:crackle'], buss: ['n:brown'],
  };
  const EV_NEEDS = {
    bat: ['n:brown', 'n:pink'], bil: ['n:pink'], moped: ['n:pink'], bussbroms: ['n:white'], bussdorr: ['n:white'],
    anga: ['n:white', 'n:pink'], kvarn: ['t:crackle'], stek: ['n:white', 't:crackle'], aska: ['n:brown', 'n:white'],
    plan: ['n:pink'], vagn: ['t:rattle', 'n:brown'], hund: ['t:barks'], tryckluft: ['n:white'], tejp: ['n:white'], spade: ['n:white'],
    pling: ['b:shopbell'], klocka: ['b:servicebell'], kassa: ['b:register'], pip: ['b:beep'], hogtalare: ['b:chime'],
    dingdong: ['b:dingdong'], telefon: ['b:phone'], kopp: ['b:cup', 'b:cupdown'], bestick: ['b:cutlery', 'b:plate', 'b:cup'],
    glas: ['b:glass'], flaskor: ['b:bottle'], knack: ['b:knock'], galge: ['b:hanger'], klang: ['b:clank'], rigg: ['b:ting'],
    stampel: ['b:stamp'], mutter: ['b:impact'], duns: ['b:clunk'], summer: ['b:buzzer'],
  };
  const beds = {};  // namn → { S, B, level, lastOn }
  function bedLevel(name, level, p, now) {
    let b = beds[name];
    if (!b) {
      if (level <= 0.001) return;
      if (!ensure(BED_NEEDS[name])) return; // byggs i kön – bädden tonar in när den är klar
      const S = scope(), B = BEDS[name](S);
      if (!B) { S.kill(); return; } // texturen renderas fortfarande – försök igen snart
      B.out.connect(mix);
      b = beds[name] = { S, B, level: 0, lastOn: now, send: null };
    }
    const tgt = level * (CAL[name] ?? 0.2);
    if (Math.abs(tgt - b.level) > 0.0005 || (tgt === 0 && b.level !== 0)) { b.B.out.gain.setTargetAtTime(tgt, now, FADE); b.level = tgt; }
    if (tgt > 0.0005) b.lastOn = now;
    b.B.set?.(p, now);
    // efterklang för det som står i rummet (sorl, steg, barn …)
    if (b.B.rev && revIn) {
      if (!b.send) { b.send = b.S.g(0); b.B.rev.connect(b.send); b.send.connect(revIn); }
      b.send.gain.setTargetAtTime(p.rev ?? 0.5, now, 0.5);
    }
  }
  function parkBeds(now, force = false) {
    for (const [name, b] of Object.entries(beds)) {
      if (force || (b.level === 0 && now - b.lastOn > 3)) { b.S.kill(now); delete beds[name]; }
    }
  }

  // ---------- småljuden
  const events = [];
  function evStart(S, end, tag) {
    const h = { S, end, tag, alive: true };
    const last = S.srcs[S.srcs.length - 1];
    let left = S.srcs.length;
    const done = () => { if (!h.alive) return; h.alive = false; S.kill(); const i = events.indexOf(h); if (i >= 0) events.splice(i, 1); };
    for (const s of S.srcs) s.onended = () => { if (--left <= 0) done(); };
    if (!last) done();
    h.done = done;
    events.push(h);
    return h;
  }
  // Placering: nivå, panorering, avståndsfilter och efterklang → evBus
  function spot(S, lvl, pan, { lp = 0, rev = 0.15 } = {}) {
    const g = S.g(lvl * EV_LVL), p = S.pan(pan);
    let head = g;
    if (lp) { const f = S.f('lowpass', lp, 0.6); f.connect(g); head = f; }
    g.connect(p); p.connect(evBus);
    if (rev && revIn) { const s = S.g(rev); p.connect(s); s.connect(revIn); }
    return head;
  }
  // En tyst oscillator som håller ett småljud vid liv (onended) när allt annat är delat brus.
  const keep = (S, t0, t1, head) => { const k = S.o('sine', 1, t0), g = S.g(0); k.connect(g); g.connect(head); k.stop(t1); };
  const env = (param, t, a, peak, hold, rel, floor = 0) => {
    param.setValueAtTime(floor, t);
    param.linearRampToValueAtTime(peak, t + a);
    param.setValueAtTime(peak, t + a + hold);
    param.linearRampToValueAtTime(floor, t + a + hold + rel);
  };
  // Engångsljud ur en klangbank
  function playBank(name, o = {}) {
    const list = bank(name); if (!list || !list.length) return null;
    const S = scope(), t0 = ctx.currentTime + 0.02 + (o.delay || 0);
    const b = S.b(pick(r, list), { loop: false, rate: (o.rate ?? 1) * (0.94 + 0.12 * r()), t0 });
    b.connect(spot(S, o.lvl ?? 1, o.pan ?? (r() * 1.6 - 0.8), o));
    return evStart(S, t0 + b.buffer.duration + 0.1, name);
  }
  // Fågelsång: koltrast, talgoxe, sparv, bofink
  function bird(o = {}) {
    const S = scope(), t0 = ctx.currentTime + 0.03;
    const osc = S.o('sine', 3000, t0), g = S.g(0);
    osc.connect(g); g.connect(spot(S, (o.lvl ?? 1) * (0.2 + 0.35 * r()), o.pan ?? (r() * 1.8 - 0.9), { lp: o.lp || 0, rev: 0.12 }));
    const F = osc.frequency, G = g.gain;
    let t = t0;
    const note = (f1, f2, d, a = 1) => { F.setValueAtTime(f1, t); F.linearRampToValueAtTime(f2, t + d); G.setValueAtTime(0, t); G.linearRampToValueAtTime(a, t + Math.min(0.012, d * 0.3)); G.setTargetAtTime(0, t + d * 0.7, d * 0.12); t += d; };
    const kind = o.kind || pick(r, ['koltrast', 'talgoxe', 'sparv', 'sparv', 'bofink']);
    if (kind === 'koltrast') {
      const n = 4 + ((r() * 4) | 0);
      for (let i = 0; i < n; i++) { const f = 1500 + 1300 * r(); note(f, f * (0.8 + 0.5 * r()), 0.08 + 0.14 * r(), 0.7 + 0.3 * r()); t += 0.02 + 0.05 * r(); }
      for (let i = 0; i < 4 + r() * 4; i++) { note(4200 + 1800 * r(), 3800 + 1500 * r(), 0.025, 0.4); t += 0.012; }
    } else if (kind === 'talgoxe') {
      const hi = 5200 + 600 * r(), lo = 3900 + 400 * r(), n = 3 + ((r() * 3) | 0);
      for (let i = 0; i < n; i++) { note(hi, hi * 0.98, 0.06, 0.8); t += 0.02; note(lo, lo * 0.97, 0.07, 0.7); t += 0.04; }
    } else if (kind === 'sparv') {
      const n = 3 + ((r() * 6) | 0), f = 3600 + 900 * r();
      for (let i = 0; i < n; i++) { note(f * (1.05 + 0.1 * r()), f * 0.72, 0.04 + 0.02 * r(), 0.6 + 0.4 * r()); t += 0.1 + 0.2 * r(); }
    } else {
      const n = 10 + ((r() * 5) | 0);
      for (let i = 0; i < n; i++) { const k = i / n; note(3800 - 1200 * k, 3600 - 1200 * k, 0.07 - 0.03 * k, 0.5 + 0.4 * k); t += 0.015; }
      note(4500, 3000, 0.08, 1); note(3200, 3900, 0.07, 0.8);
    }
    osc.stop(t + 0.1);
    return evStart(S, t + 0.1, 'fagel');
  }
  // Måsen: nasal, skrikig, 3–6 rop ("kiaaa … kyow kyow")
  function gull(o = {}) {
    const S = scope(), t0 = ctx.currentTime + 0.03;
    const osc = S.o('sawtooth', 900, t0), b1 = S.f('bandpass', 1700 + 300 * r(), 3), b2 = S.f('bandpass', 3100 + 300 * r(), 4), g1 = S.g(1), g2 = S.g(0.6);
    const am = S.g(0.7), lfo = S.o('sine', 50 + 20 * r(), t0), lg = S.g(0.3), env1 = S.g(0), lp = S.f('lowpass', 5200);
    osc.connect(b1); osc.connect(b2); b1.connect(g1); b2.connect(g2); g1.connect(am); g2.connect(am); lfo.connect(lg); lg.connect(am.gain);
    am.connect(env1); env1.connect(lp); lp.connect(spot(S, (o.lvl ?? 1) * (0.4 + 0.6 * r()), o.pan ?? (r() * 1.8 - 0.9), { rev: 0.2 }));
    let t = t0; const n = 3 + ((r() * 4) | 0), base = 0.85 + 0.3 * r();
    for (let i = 0; i < n; i++) {
      const long = i < 1 + (r() < 0.5 ? 1 : 0), d = long ? 0.33 + 0.15 * r() : 0.17 + 0.08 * r(), F = osc.frequency;
      F.setValueAtTime(700 * base, t); F.linearRampToValueAtTime(1500 * base, t + 0.04); F.linearRampToValueAtTime((long ? 1300 : 1400) * base, t + d * 0.6); F.linearRampToValueAtTime(760 * base, t + d);
      env1.gain.setValueAtTime(0, t); env1.gain.linearRampToValueAtTime(1, t + 0.02); env1.gain.setValueAtTime(0.9, t + d - 0.05); env1.gain.linearRampToValueAtTime(0, t + d);
      t += d + 0.2 + 0.2 * r();
    }
    osc.stop(t); lfo.stop(t);
    return evStart(S, t, 'mas');
  }
  // Båten som puttrar förbi längs kanalen (20–30 s)
  function boat(o = {}) {
    const S = scope(), t0 = ctx.currentTime + 0.05, dur = 20 + 10 * r(), dir = r() < 0.5 ? -1 : 1;
    const f0 = 48 + 12 * r(), eng = S.o('sawtooth', f0, t0), lp = S.f('lowpass', 230, 1), am = S.g(0.55), lfo = S.o('square', 6 + 2.5 * r(), t0), lg = S.g(0.4);
    const nz = S.from('brown', S.f('lowpass', 320)), gz = S.g(1.2), wake = S.from('pink', S.f('bandpass', 700, 0.5)), gw = S.g(0), vg = S.g(0), p = S.pan(0);
    eng.connect(lp); lp.connect(am); nz.connect(gz); gz.connect(am); lfo.connect(lg); lg.connect(am.gain);
    am.connect(vg); wake.connect(gw); gw.connect(vg); vg.connect(p); p.connect(evBus);
    const k = o.canal ?? 1;
    vg.gain.setValueAtTime(0, t0); gw.gain.setValueAtTime(0, t0); eng.frequency.setValueAtTime(f0, t0);
    if (p.pan) p.pan.setValueAtTime(clamp(-dir * 450 / 300, -0.9, 0.9), t0);
    for (let i = 0; i <= 20; i++) {
      const u = i / 20, t = t0 + u * dur, x = dir * (u - 0.5) * 900; // px relativt figuren
      const nearK = near(x, 170), v = dir * 900 / dur, rad = -x * v / Math.max(40, Math.abs(x)) ;
      vg.gain.linearRampToValueAtTime(EV_LVL * 0.25 * k * nearK * (u < 0.05 ? u / 0.05 : u > 0.95 ? (1 - u) / 0.05 : 1), t);
      gw.gain.linearRampToValueAtTime(0.6 * nearK, t);
      if (p.pan) p.pan.linearRampToValueAtTime(clamp(x / 300, -0.9, 0.9), t);
      eng.frequency.linearRampToValueAtTime(f0 / (1 - rad / 700), t);
    }
    eng.stop(t0 + dur + 0.1); lfo.stop(t0 + dur + 0.1);
    E.bump = { name: 'vatten', until: t0 + dur * 0.5 + 12, from: t0 + dur * 0.5, k: 0.6 }; // svallvågorna mot kajen
    return evStart(S, t0 + dur + 0.1, 'bat');
  }
  // En bil/moped som passerar (för ställen utan riktig trafik, och "en ensam bil" om natten)
  function pass(o = {}) {
    const S = scope(), t0 = ctx.currentTime + 0.05, moped = !!o.moped, dur = moped ? 4 + 2 * r() : 3.5 + 1.5 * r(), dir = r() < 0.5 ? -1 : 1;
    const f0 = moped ? 105 + 20 * r() : 38 + 12 * r(), eng = S.o('sawtooth', f0, t0), ef = S.f(moped ? 'bandpass' : 'lowpass', moped ? 1300 : 260, moped ? 1.5 : 0.8), ge = S.g(moped ? 0.9 : 0.6);
    const tire = S.from('pink', S.f('bandpass', 850, 0.6)), gt = S.g(moped ? 0.2 : 1), vg = S.g(0), p = S.pan(0);
    let head = vg;
    if (o.muffle) { const m = S.f('lowpass', 500); vg.connect(m); head = m; }
    eng.connect(ef); ef.connect(ge); ge.connect(vg); tire.connect(gt); gt.connect(vg); head.connect(p); p.connect(evBus);
    if (moped) { const am = S.o('square', 22 + 6 * r(), t0), ag = S.g(0.25); am.connect(ag); ag.connect(ge.gain); }
    const L = (o.lvl ?? 1) * EV_LVL * 0.9;
    vg.gain.setValueAtTime(0, t0); eng.frequency.setValueAtTime(f0 * 1.04, t0);
    if (p.pan) p.pan.setValueAtTime(clamp(-dir * 0.8, -0.9, 0.9), t0);
    for (let i = 0; i <= 16; i++) {
      const u = i / 16, t = t0 + u * dur, x = (u - 0.5) * 2, nk = Math.exp(-x * x * 3);
      vg.gain.linearRampToValueAtTime(L * nk, t);
      if (p.pan) p.pan.linearRampToValueAtTime(clamp(dir * x * 0.8, -0.9, 0.9), t);
      eng.frequency.linearRampToValueAtTime(f0 * (x < 0 ? 1.04 + (moped ? 0.05 : 0) : 0.96 - (moped ? 0.05 : 0)) * (1 - 0.02 * Math.abs(x)), t);
    }
    for (const s of S.srcs) try { s.stop(t0 + dur + 0.1); } catch { /* ok */ }
    return evStart(S, t0 + dur + 0.1, moped ? 'moped' : 'bil');
  }
  // Tuta långt bort
  function honk(o = {}) {
    const S = scope(), t0 = ctx.currentTime + 0.03, bp = S.f('bandpass', 900, 0.8), g = S.g(0), k = 0.95 + 0.1 * r();
    const a = S.o('square', 400 * k, t0), b = S.o('square', 505 * k, t0);
    a.connect(bp); b.connect(bp); bp.connect(g); g.connect(spot(S, (o.lvl ?? 1) * 0.5, o.pan ?? (r() * 1.6 - 0.8), { lp: 2200, rev: 0.35 }));
    const d1 = 0.25 + 0.25 * r(); env(g.gain, t0, 0.01, 0.4, d1, 0.03);
    let end = t0 + d1 + 0.05;
    if (r() < 0.5) { env(g.gain, end + 0.12, 0.01, 0.4, 0.12, 0.03); end += 0.3; }
    a.stop(end + 0.05); b.stop(end + 0.05);
    return evStart(S, end + 0.05, 'tuta');
  }
  // Bussen: bromsgnissel + luftbromsens pys, dörrarna
  function busBrake(o = {}) {
    const S = scope(), t0 = ctx.currentTime + 0.02, head = spot(S, o.lvl ?? 1, o.pan ?? 0, { rev: 0.2 });
    const sq = S.o('sine', 2000 + 300 * r(), t0), vib = S.o('sine', 7, t0), vg = S.g(30), sg = S.g(0);
    vib.connect(vg); vg.connect(sq.frequency); sq.connect(sg); sg.connect(head);
    env(sg.gain, t0, 0.08, 0.12, 0.35, 0.2);
    const hs = S.from('white', S.f('highpass', 2200)), bp = S.f('bandpass', 4500, 0.6), hg = S.g(0);
    hs.connect(bp); bp.connect(hg); hg.connect(head);
    env(hg.gain, t0 + 0.65, 0.01, 0.9, 0.25, 0.5);
    sq.stop(t0 + 0.8); vib.stop(t0 + 0.8);
    keep(S, t0, t0 + 1.5, head); // håller eventet vid liv tills pyset klingat ut
    return evStart(S, t0 + 1.5, 'buss');
  }
  function busDoor(o = {}) {
    const S = scope(), t0 = ctx.currentTime + 0.02, head = spot(S, o.lvl ?? 1, o.pan ?? 0, { rev: 0.15 });
    const hs = S.from('white', S.f('highpass', 2500)), hg = S.g(0); hs.connect(hg); hg.connect(head);
    env(hg.gain, t0, 0.01, 0.6, 0.12, 0.2);
    const th = S.o('sine', 90, t0), tg = S.g(0); th.connect(tg); tg.connect(head);
    env(tg.gain, t0 + 0.35, 0.005, 0.8, 0.02, 0.12);
    th.stop(t0 + 0.7);
    return evStart(S, t0 + 0.7, 'buss');
  }
  // Espressomaskinens ångrör: fräs, skrik när mjölken sträcks, bubbel – och pyset efteråt
  function steam(o = {}) {
    const S = scope(), t0 = ctx.currentTime + 0.03, dur = 2.5 + 3 * r(), head = spot(S, o.lvl ?? 1, o.pan ?? (r() - 0.5), { rev: 0.2 });
    const h = S.from('white', S.f('bandpass', 2600, 1.2)), hg = S.g(0), w = S.from('white', S.f('bandpass', 1500, 9)), wg = S.g(0);
    const gu = S.from('pink', S.f('bandpass', 420, 1)), am = S.g(0.5), lfo = S.o('sine', 9 + 6 * r(), t0), lg = S.g(0.5), gg = S.g(0);
    h.connect(hg); hg.connect(head); w.connect(wg); wg.connect(head); gu.connect(am); lfo.connect(lg); lg.connect(am.gain); am.connect(gg); gg.connect(head);
    env(hg.gain, t0, 0.05, 0.7, dur - 0.1, 0.08);
    env(wg.gain, t0 + 0.3, 0.4, 0.5, dur - 1, 0.1);
    w.frequency.setValueAtTime(1600, t0); w.frequency.linearRampToValueAtTime(1050, t0 + dur);
    env(gg.gain, t0, 0.1, 0.8, dur * 0.5, dur * 0.4);
    env(hg.gain, t0 + dur + 0.35, 0.01, 0.9, 0.2, 0.25);
    lfo.stop(t0 + dur + 0.9);
    return evStart(S, t0 + dur + 0.9, 'anga');
  }
  // Kaffekvarnen: motorn varvar upp, bönorna knastrar, varvar ner
  function grinder(o = {}) {
    const S = scope(), t0 = ctx.currentTime + 0.03, dur = 1.5 + r(), head = spot(S, o.lvl ?? 1, o.pan ?? (r() - 0.5), { rev: 0.15 });
    const m = S.o('sawtooth', 90, t0), bp = S.f('bandpass', 700, 1), mg = S.g(0);
    m.connect(bp); bp.connect(mg); mg.connect(head);
    m.frequency.setValueAtTime(90, t0); m.frequency.linearRampToValueAtTime(185, t0 + 0.35); m.frequency.setValueAtTime(185, t0 + dur); m.frequency.linearRampToValueAtTime(70, t0 + dur + 0.35);
    env(mg.gain, t0, 0.2, 0.5, dur, 0.35);
    const c = S.b(tex('crackle'), { rate: 1.8, t0 }), cb = S.f('bandpass', 2200, 0.6), cg = S.g(0);
    c.connect(cb); cb.connect(cg); cg.connect(head);
    env(cg.gain, t0 + 0.2, 0.1, 1.2, dur - 0.4, 0.2);
    m.stop(t0 + dur + 0.4); c.stop(t0 + dur + 0.4);
    return evStart(S, t0 + dur + 0.4, 'kvarn');
  }
  // Brusljud med envelope: tryckluft, tejp, stekpanna, spade …
  function hiss(o = {}) {
    const S = scope(), t0 = ctx.currentTime + 0.03, head = spot(S, o.lvl ?? 1, o.pan ?? (r() * 1.4 - 0.7), { rev: o.rev ?? 0.15 });
    const f = S.from(o.pink ? 'pink' : 'white', S.f('bandpass', o.f || 3800, o.q || 0.6)), g = S.g(0);
    f.connect(g); g.connect(head);
    let t = t0; const n = o.n || 1;
    for (let i = 0; i < n; i++) { const d = (o.dur || 0.5) * (0.6 + 0.8 * r()); env(g.gain, t, o.att || 0.01, 1, d, o.rel || 0.08); if (o.f2) { f.frequency.setValueAtTime(o.f, t); f.frequency.linearRampToValueAtTime(o.f2, t + d); } t += d + 0.15 + 0.2 * r(); }
    keep(S, t0, t + 0.1, head);
    return evStart(S, t + 0.1, o.tag || 'pys');
  }
  // Stekos: burgaren läggs på grillen (fräs + knaster som klingar av)
  function sizzle(o = {}) {
    const S = scope(), t0 = ctx.currentTime + 0.03, head = spot(S, o.lvl ?? 1, o.pan ?? (r() - 0.5), { rev: 0.1 });
    const f = S.from('white', S.f('bandpass', 4200, 0.5)), g = S.g(0), c = S.b(tex('crackle'), { rate: 1.3, t0 }), hp = S.f('highpass', 2000), cg = S.g(0);
    f.connect(g); g.connect(head); c.connect(hp); hp.connect(cg); cg.connect(head);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.7, t0 + 0.02); g.gain.setTargetAtTime(0, t0 + 0.05, 0.6);
    cg.gain.setValueAtTime(0, t0); cg.gain.linearRampToValueAtTime(0.45, t0 + 0.03); cg.gain.setTargetAtTime(0, t0 + 0.1, 0.7);
    c.stop(t0 + 3);
    return evStart(S, t0 + 3, 'stek');
  }
  // Åska: knall när den är nära, sedan mullret som rullar i omgångar
  function thunder(o = {}) {
    const S = scope(), t0 = ctx.currentTime + 0.05 + (o.delay ?? (0.3 + 2 * r())), nearK = o.near ?? r(), dur = 4 + 4 * r();
    const nz = S.from('brown', S.f('lowpass', 900, 0.7)), g = S.g(0), p = S.pan((r() - 0.5) * 0.9);
    let tail = g;
    if (o.muffle) { const m = S.f('lowpass', 260); g.connect(m); tail = m; }
    nz.connect(g); tail.connect(p); p.connect(evBus);
    if (revIn) { const s = S.g(0.35); p.connect(s); s.connect(revIn); }
    // (0,5: en nära åska är som starkast i nivå med effektljuden, aldrig över – balans48.mjs)
    const lvl = EV_LVL * 0.5 * (o.muffle ? 0.45 : 1) * (0.5 + 0.5 * nearK);
    nz.frequency.setValueAtTime(300 + 900 * nearK, t0); nz.frequency.exponentialRampToValueAtTime(85, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    let t = t0;
    const swells = 3 + ((r() * 4) | 0);
    for (let i = 0; i < swells; i++) { const a = lvl * (i === 0 ? 1 : 0.35 + 0.6 * r()); g.gain.setTargetAtTime(a, t, 0.05 + 0.1 * r()); t += 0.4 + dur / swells * r(); g.gain.setTargetAtTime(a * 0.3, t - 0.2, 0.25); }
    g.gain.setTargetAtTime(0, t, dur * 0.15);
    if (nearK > 0.6 && !o.muffle) { const c = S.from('white', S.f('highpass', 1200)), cg = S.g(0); c.connect(cg); cg.connect(p); env(cg.gain, t0 - 0.03, 0.005, EV_LVL * 0.7 * nearK, 0.02, 0.3); }
    keep(S, t0, t + dur * 0.6, p);
    return evStart(S, t + dur * 0.6, 'aska');
  }
  // Uggla (natt i parken), änder (dammen), mistlur (dimma vid kanalen), jetplan (flygplatsen)
  function owl(o = {}) {
    const S = scope(), t0 = ctx.currentTime + 0.03, osc = S.o('sine', 400, t0), g = S.g(0);
    osc.connect(g); g.connect(spot(S, (o.lvl ?? 1) * 0.28, o.pan ?? (r() - 0.5), { lp: 900, rev: 0.45 }));
    const f = 380 + 40 * r();
    [[0, 0.45], [0.95, 0.14], [1.15, 0.14], [1.35, 0.55]].forEach(([at, d]) => { const t = t0 + at; osc.frequency.setValueAtTime(f * 1.03, t); osc.frequency.linearRampToValueAtTime(f * 0.95, t + d); env(g.gain, t, 0.06, 0.8, d - 0.1, 0.05); });
    osc.stop(t0 + 2.1);
    return evStart(S, t0 + 2.1, 'uggla');
  }
  function quack(o = {}) {
    const S = scope(), t0 = ctx.currentTime + 0.03, osc = S.o('sawtooth', 260, t0), b1 = S.f('bandpass', 1000, 3), b2 = S.f('bandpass', 2300, 5), g = S.g(0);
    osc.connect(b1); osc.connect(b2); b1.connect(g); b2.connect(g); g.connect(spot(S, (o.lvl ?? 1) * 0.6, o.pan ?? (r() - 0.5), { rev: 0.15 }));
    const n = 2 + ((r() * 3) | 0), f = 240 + 60 * r();
    let t = t0;
    for (let i = 0; i < n; i++) { osc.frequency.setValueAtTime(f, t); osc.frequency.linearRampToValueAtTime(f * 0.85, t + 0.14); env(g.gain, t, 0.015, 0.9, 0.09, 0.04); t += 0.24 + 0.08 * r(); }
    osc.stop(t);
    return evStart(S, t, 'and');
  }
  function foghorn(o = {}) {
    const S = scope(), t0 = ctx.currentTime + 0.03, a = S.o('sawtooth', 88, t0), b = S.o('sawtooth', 176, t0), bg = S.g(0.4), lp = S.f('lowpass', 480, 0.8), g = S.g(0);
    a.connect(lp); b.connect(bg); bg.connect(lp); lp.connect(g); g.connect(spot(S, (o.lvl ?? 1) * 0.5, o.pan ?? (r() - 0.5), { rev: 0.8 }));
    env(g.gain, t0, 0.35, 0.8, 2.2, 1.0);
    a.stop(t0 + 3.8); b.stop(t0 + 3.8);
    return evStart(S, t0 + 3.8, 'mistlur');
  }
  function plane(o = {}) {
    const S = scope(), t0 = ctx.currentTime + 0.05, dur = 9 + 5 * r(), roar = S.from('pink', S.f('lowpass', 750, 0.6)), rg = S.g(0), wh = S.o('sine', 3400, t0), wg = S.g(0), p = S.pan(-0.7);
    roar.connect(rg); rg.connect(p); wh.connect(wg); wg.connect(p); p.connect(evBus);
    const L = (o.lvl ?? 1) * EV_LVL * 1.2;
    rg.gain.setValueAtTime(0, t0); rg.gain.linearRampToValueAtTime(L, t0 + dur * 0.45); rg.gain.linearRampToValueAtTime(0, t0 + dur);
    wg.gain.setValueAtTime(0, t0); wg.gain.linearRampToValueAtTime(L * 0.05, t0 + dur * 0.4); wg.gain.linearRampToValueAtTime(0, t0 + dur * 0.8);
    wh.frequency.setValueAtTime(3500, t0); wh.frequency.linearRampToValueAtTime(3000, t0 + dur);
    if (p.pan) { p.pan.setValueAtTime(-0.7, t0); p.pan.linearRampToValueAtTime(0.7, t0 + dur); }
    wh.stop(t0 + dur + 0.1);
    return evStart(S, t0 + dur + 0.1, 'plan');
  }
  // Kundvagn som rullar förbi
  function cart(o = {}) {
    const S = scope(), t0 = ctx.currentTime + 0.03, dur = 2.5 + 2.5 * r(), dir = r() < 0.5 ? -1 : 1;
    const c = S.b(tex('rattle'), { rate: 0.8 + 0.4 * r(), t0 }), bp = S.f('bandpass', 1600, 0.7), rb = S.from('brown', S.f('lowpass', 180)), rg = S.g(0.6), g = S.g(0), p = S.pan(0);
    c.connect(bp); bp.connect(g); rb.connect(rg); rg.connect(g); g.connect(p); p.connect(evBus);
    if (revIn) { const s = S.g(o.rev ?? 0.3); p.connect(s); s.connect(revIn); }
    const L = (o.lvl ?? 1) * EV_LVL * 0.7;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(L, t0 + dur * 0.4); g.gain.linearRampToValueAtTime(0, t0 + dur);
    if (p.pan) { p.pan.setValueAtTime(-0.7 * dir, t0); p.pan.linearRampToValueAtTime(0.7 * dir, t0 + dur); }
    c.stop(t0 + dur + 0.05);
    return evStart(S, t0 + dur + 0.05, 'vagn');
  }
  // Hund långt bort (voices.js-skall renderade en gång)
  function dogFar(o = {}) {
    const list = tex('barks'); if (!list || !list.length) return null;
    const S = scope(), t0 = ctx.currentTime + 0.03, buf = pick(r, list), head = spot(S, (o.lvl ?? 1) * 0.8, o.pan ?? (r() * 1.6 - 0.8), { lp: o.near ? 3500 : 1300, rev: 0.4 });
    const a = S.b(buf, { loop: false, t0, rate: 0.95 + 0.1 * r() }); a.connect(head);
    let end = t0 + buf.duration;
    if (r() < 0.5) { const b = S.b(buf, { loop: false, t0: end - 0.9, rate: 0.95 + 0.1 * r() }); b.connect(head); end += buf.duration - 0.9; }
    return evStart(S, end, 'hund');
  }
  // Djuraffären: ljud direkt ur voices.js (valp, katt, fåglar, gnagare) – lågt, i rummet
  function critter(kind, o = {}) {
    if (!VR) return null;
    const S = scope(), t0 = ctx.currentTime + 0.03, head = spot(S, (o.lvl ?? 1) * 0.5, o.pan ?? (r() * 1.4 - 0.7), { lp: 5000, rev: 0.25 });
    let h = null;
    try {
      const seed = (r() * 1e9) >>> 0;
      if (kind === 'valp') h = VR.bark(ctx, head, t0, 'valp', 'glad', seed);
      else if (kind === 'katt') h = VR.meow(ctx, head, t0, r() < 0.5 ? 'unge' : '', '', seed);
      else if (kind === 'mus') h = VR.squeak(ctx, head, t0, seed);
      else h = VR.chirp(ctx, head, t0, seed);
    } catch { h = null; }
    if (!h) { S.kill(); return null; }
    for (const s of h.srcs) S.srcs.push(s);
    for (const n of h.nodes) S.list.push(n);
    E.nodes += h.nodes.length;
    return evStart(S, h.end, 'djur');
  }
  // Glassbilen spelar sin slinga (speldosa ur en liten högtalare)
  function jingle(o = {}) {
    const S = scope(), t0 = ctx.currentTime + 0.03, osc = S.o('triangle', 1047, t0), bp = S.f('bandpass', 1800, 0.8), g = S.g(0);
    osc.connect(bp); bp.connect(g); g.connect(spot(S, (o.lvl ?? 1) * 0.5, o.pan ?? 0, { rev: 0.2 }));
    const mel = [1047, 1319, 1568, 1319, 1397, 1760, 1568, 0, 1319, 1568, 2093, 1568, 1319, 1175, 1047];
    let t = t0;
    for (const f of mel) { if (f) { osc.frequency.setValueAtTime(f, t); env(g.gain, t, 0.005, 0.7, 0.08, 0.08); } t += 0.19; }
    osc.stop(t + 0.1);
    return evStart(S, t + 0.1, 'glassbil');
  }
  // Skrivare/bandhantering: surr i rytm
  function printer(o = {}) {
    const S = scope(), t0 = ctx.currentTime + 0.03, dur = 1.5 + 1.5 * r(), osc = S.o('square', 190, t0), bp = S.f('bandpass', 1200, 2), am = S.g(0.5), lfo = S.o('square', 9, t0), lg = S.g(0.5), g = S.g(0);
    osc.connect(bp); bp.connect(am); lfo.connect(lg); lg.connect(am.gain); am.connect(g); g.connect(spot(S, (o.lvl ?? 1) * 0.35, o.pan ?? (r() - 0.5), { rev: 0.2 }));
    env(g.gain, t0, 0.02, 0.7, dur, 0.05);
    osc.stop(t0 + dur + 0.1); lfo.stop(t0 + dur + 0.1);
    return evStart(S, t0 + dur + 0.1, 'skrivare');
  }

  const FIRE = {
    fagel: bird, mas: gull, bat: boat, bil: (o) => pass(o), moped: (o) => pass({ ...o, moped: true }), tuta: honk, bussbroms: busBrake, bussdorr: busDoor,
    anga: steam, kvarn: grinder, stek: sizzle, aska: thunder, uggla: owl, and: quack, mistlur: foghorn, plan: plane, vagn: cart, hund: dogFar, glassbil: jingle, skrivare: printer,
    valp: (o) => critter('valp', o), katt: (o) => critter('katt', o), kvitter: (o) => critter('fagel', o), mus: (o) => critter('mus', o),
    tryckluft: (o) => hiss({ f: 3800, q: 0.5, dur: 0.5, n: 1 + ((r() * 3) | 0), tag: 'tryckluft', ...o }),
    tejp: (o) => hiss({ f: 900, f2: 3500, q: 1.5, dur: 0.45, tag: 'tejp', ...o }),
    spade: (o) => hiss({ f: 2200, f2: 3200, q: 2, dur: 0.22, rel: 0.05, tag: 'spade', ...o }),
    // klangbankerna
    pling: (o) => playBank('shopbell', { rev: 0.25, ...o }),
    klocka: (o) => playBank('servicebell', { rev: 0.3, ...o }),
    kassa: (o) => playBank('register', { rev: 0.2, ...o }),
    pip: (o) => playBank('beep', { rev: 0.2, lvl: 0.45, ...o }),
    hogtalare: (o) => playBank('chime', { rev: 0.7, lvl: 0.6, pan: 0, ...o }),
    dingdong: (o) => playBank('dingdong', { rev: 0.25, lvl: 0.55, ...o }),
    telefon: (o) => playBank('phone', { rev: 0.2, lvl: 0.45, ...o }),
    kopp: (o) => playBank(pick(r, ['cup', 'cup', 'cupdown']), { rev: 0.2, lvl: 0.5, ...o }),
    bestick: (o) => playBank(pick(r, ['cutlery', 'plate', 'cup']), { rev: 0.2, lvl: 0.45, ...o }),
    glas: (o) => playBank('glass', { rev: 0.2, lvl: 0.35, ...o }),
    flaskor: (o) => playBank('bottle', { rev: 0.25, lvl: 0.4, ...o }),
    knack: (o) => playBank('knock', { rev: 0.15, lvl: 0.5, ...o }),
    galge: (o) => playBank('hanger', { rev: 0.2, lvl: 0.4, ...o }),
    klang: (o) => playBank('clank', { rev: 0.35, lvl: 0.5, ...o }),
    rigg: (o) => playBank('ting', { rev: 0.3, lvl: 0.3, ...o }),
    stampel: (o) => playBank('stamp', { rev: 0.15, lvl: 0.5, ...o }),
    mutter: (o) => playBank('impact', { rev: 0.3, lvl: 0.45, ...o }),
    duns: (o) => playBank('clunk', { rev: 0.3, lvl: 0.55, ...o }),
    summer: (o) => playBank('buzzer', { rev: 0.2, lvl: 0.3, ...o }),
  };
  E.fire = (name, o = {}) => {
    if (!E.awake || !FIRE[name]) return null;
    if (!ensure(EV_NEEDS[name])) return null; // bufferten byggs – nästa gång
    if (events.length >= maxEv) { if (!o.force) return null; events[0].done(); }
    try { return FIRE[name](o); } catch { return null; }
  };

  // ---------- bilarna i trafiken (riktiga fordon ur traffic.vehicles())
  const cars = [];
  function carVoice() {
    const S = scope();
    const eng = S.o('sawtooth', 40), el = S.f('lowpass', 260, 0.9), eg = S.g(0.6), tire = S.from('pink', S.f('bandpass', 900, 0.6)), tg = S.g(0.6);
    const vg = S.g(0), p = S.pan(0), mf = S.f('lowpass', 20000, 0.5);
    eng.connect(el); el.connect(eg); eg.connect(vg); tire.connect(tg); tg.connect(vg); vg.connect(mf); mf.connect(p); p.connect(mix);
    return { S, eng, el, eg, tire, tg, vg, p, mf, ref: null, free: true, lastV: 0, lastDoor: 0, freeAt: 0 };
  }
  const BASE_F = { buss: 27, skapbil: 33, pickup: 34, plog: 30, moped: 110, glassbil: 38 };
  function updateCars(s, now) {
    const list = s.vehicles || [], px = s.x, py = s.y, dt = s.carDt || 0.1;
    const quayK = CITY && py > CITY.SIDEWALK_SS[1] ? QUAY_CARS : 1; // nere på kajen: gatan bakom kajkanten
    // kandidater: de närmaste fordonen
    const cand = [];
    for (const v of list) {
      if (v.rider) continue;
      const cx = (v.x0 + v.x1) / 2, cy = v.axis === 'y' ? ((v.y0 ?? v.y) + (v.y1 ?? v.y)) / 2 : v.y;
      const d = Math.hypot(cx - px, (cy - py) * 1.3);
      if (d < 380) cand.push({ v, cx, cy, d });
    }
    cand.sort((a, b) => a.d - b.d);
    const top = cand.slice(0, carMax);
    // behåll röster som fortfarande följer "sin" bil
    for (const cv of cars) {
      if (cv.free || !cv.ref) continue;
      const R = cv.ref;
      const m = top.find((c) => !c.used && c.v.kind === R.kind && c.v.dir === R.dir && c.v.axis === R.axis &&
        (R.axis === 'y' ? Math.abs(c.cx - R.cx) < 3 && Math.abs(c.cy - (R.cy + R.dir * R.vel * dt)) < 14 : Math.abs(c.cy - R.cy) < 3 && Math.abs(c.cx - (R.cx + R.dir * R.vel * dt)) < 14));
      if (m) { m.used = true; cv.cur = m; } else { cv.cur = null; cv.vg.gain.setTargetAtTime(0, now, 0.12); cv.free = true; cv.freeAt = now + 0.5; }
    }
    for (const c of top) {
      if (c.used) continue;
      let cv = cars.find((x) => x.free && now >= x.freeAt);
      if (!cv && cars.length < carMax && ensure(['n:pink'])) { cv = carVoice(); cars.push(cv); }
      if (!cv) break;
      cv.free = false; cv.cur = c; c.used = true; cv.lastV = c.v.v; cv.lastDoor = c.v.door || 0;
      cv.eng.frequency.setValueAtTime(BASE_F[c.v.kind] || 40, now);
    }
    for (const cv of cars) {
      const c = cv.cur;
      if (cv.free || !c) continue;
      const v = c.v, kind = v.kind, dx = c.cx - px, speed = Math.abs(v.v || 0), sp = clamp01(speed / 42);
      const nk = near(c.d, 62), moped = kind === 'moped', bus = kind === 'buss', big = bus || kind === 'plog' || kind === 'skapbil';
      const vx = v.axis === 'y' ? 0 : v.dir * speed, vy = v.axis === 'y' ? v.dir * speed : 0;
      const rad = -((dx * vx) + ((c.cy - py) * vy)) / Math.max(20, c.d);  // + = närmar sig
      const dop = 1 / (1 - clamp(rad, -120, 120) / 520);
      const f = (BASE_F[kind] || 40) * (0.62 + 0.55 * sp) * dop;
      cv.eng.frequency.setTargetAtTime(f, now, 0.08);
      cv.el.frequency.setTargetAtTime((moped ? 1400 : 170) + (moped ? 800 : 520) * nk, now, 0.1);
      cv.el.type = moped ? 'bandpass' : 'lowpass';
      cv.eg.gain.setTargetAtTime((moped ? 0.6 : big ? 0.55 : 0.32) * (0.55 + 0.45 * sp), now, 0.1);
      cv.tire.frequency.setTargetAtTime(650 + 900 * nk + 900 * (s.wet || 0), now, 0.1);
      cv.tg.gain.setTargetAtTime((moped ? 0.2 : 1.3) * sp * (0.6 + 0.25 * (s.wet || 0)), now, 0.1);
      cv.mf.frequency.setTargetAtTime(hz(s.muffleCars ? 700 : 20000), now, 0.2);
      cv.vg.gain.setTargetAtTime(CAR_LVL * (bus ? 1.35 : kind === 'plog' ? 1.4 : moped ? 0.8 : 1) * nk * (s.carK ?? 1) * quayK, now, 0.07);
      if (cv.p.pan) cv.p.pan.setTargetAtTime(clamp(dx / 170, -0.9, 0.9), now, 0.08);
      cv.ref = { kind, dir: v.dir, axis: v.axis, cx: c.cx, cy: c.cy, vel: speed };
      // bussen: bromsar in till hållplatsen (gnissel + pys) och öppnar dörrarna
      if (bus && nk > 0.08) {
        if (cv.lastV > 9 && speed < 3) E.fire('bussbroms', { lvl: 0.9 * nk + 0.2, pan: clamp(dx / 170, -0.9, 0.9) });
        if ((cv.lastDoor || 0) < 0.1 && (v.door || 0) >= 0.1) E.fire('bussdorr', { lvl: 0.8 * nk + 0.15, pan: clamp(dx / 170, -0.9, 0.9) });
      }
      if (kind === 'glassbil' && nk > 0.15 && now > (E.jingleAt || 0)) { E.jingleAt = now + 25; E.fire('glassbil', { lvl: 1.5 * nk + 0.3, pan: clamp(dx / 170, -0.9, 0.9) }); }
      cv.lastV = speed; cv.lastDoor = v.door || 0;
    }
  }
  function carsOff(now) { for (const cv of cars) { cv.vg.gain.setTargetAtTime(0, now, 0.15); cv.free = true; cv.cur = null; cv.freeAt = now + 0.4; } }

  // ---------- vindbyar (egen slump ovanpå väderets gust)
  const gustSt = { v: 1, target: 1, t: 0, next: 4 };
  function gustNow(w, dt) {
    gustSt.t += dt;
    if (gustSt.t > gustSt.next) { gustSt.t = 0; gustSt.next = 3 + 9 * r(); gustSt.target = r() < 0.35 ? 1.35 + 0.5 * r() : 0.65 + 0.5 * r(); }
    gustSt.v += (gustSt.target - gustSt.v) * Math.min(1, dt * (gustSt.target > gustSt.v ? 0.9 : 0.35));
    return gustSt.v * (w?.gust || 1);
  }

  // ---------- varje bildruta
  let acc = 0, carAcc = 0, lastScene = null, evClock = {}, carsGone = 0;
  E.tick = (s, dt) => {
    if (!E.awake) return;
    if (live) pump(BUILD_MS); // byggkön: en liten skiva per bildruta
    const now = ctx.currentTime;
    acc += dt; carAcc += dt;
    if (s.scene === 'city' && s.vehicles && carAcc >= 0.05) { s.carDt = carAcc; carAcc = 0; carsGone = 0; updateCars(s, now); }
    else if (s.scene !== 'city' && cars.length) {
      // inomhus: bilarna tonar ut och rivs sedan helt (inga oscillatorer som går i onödan)
      if (!carsGone) { carsOff(now); carsGone = now; }
      else if (now - carsGone > 1.5) { for (const cv of cars) cv.S.kill(now); cars.length = 0; carsGone = 0; }
    }
    if (acc < 1 / 15) return;
    const step = acc; acc = 0;
    if (s.scene !== lastScene) { // ny scen: småljuden från förra stället tonar bort
      for (const h of events.slice()) { if (h.tag !== 'aska') { try { h.S.list.forEach((n) => n.gain && n.gain.setTargetAtTime?.(0, now, 0.12)); } catch { /* ok */ } setTimeoutSafe(() => h.done(), 500); } }
      lastScene = s.scene; evClock = {};
    }
    const w = s.weather || {};
    s.gust = gustNow(w, step);
    const M = recipe(s);
    reverb(M.rev?.kind || 'ute', M.rev?.send || 0);
    governor(now, step);
    E.last = M;
    const bump = E.bump && now >= E.bump.from && now < E.bump.until ? E.bump : null;
    for (const name of new Set([...Object.keys(beds), ...Object.keys(M.beds)])) {
      let lv = M.beds[name] || 0;
      if (bump && bump.name === name) lv *= 1 + bump.k;
      bedLevel(name, lv, { ...(M.p?.[name] || {}), gust: s.gust, rev: M.rev?.[name] ?? M.rev?.bed }, now);
    }
    // småljuden: Poisson med minsta avstånd per sort
    for (const [name, spec] of Object.entries(M.ev)) {
      const { rate, gap, ...o } = typeof spec === 'number' ? { rate: spec } : spec;
      if (!(rate > 0)) continue;
      if (evClock[name] && now < evClock[name]) continue;
      if (r() < rate / 60 * step) { E.fire(name, o); evClock[name] = now + (gap ?? 60 / rate * 0.25); }
    }
    parkBeds(now);
    noiseSweep(now);
    // städa småljud som aldrig fick onended (säkerhetsnät)
    for (const h of events.slice()) if (now > h.end + 2) h.done();
  };

  // ---------- av/på
  E.wake = (sec = 1) => {
    E.awake = true; out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(1, ctx.currentTime, sec / 3);
    if (meter) { meter.pR = 0; meter.pK = 0; meter.g = 1; gov.gain.cancelScheduledValues(ctx.currentTime); gov.gain.setValueAtTime(1, ctx.currentTime); }
    for (const k of ['n:pink', 'n:brown', 'n:white']) request(k); // bruset behövs nästan överallt (och till åskan)
  };
  E.fadeOut = (sec = 0.3) => { out.gain.setTargetAtTime(0, ctx.currentTime, sec / 3); };
  // Somna: tysta och riv allt (bäddar, bilar, småljud, brusslingor) – buffertarna sparas.
  E.sleep = () => {
    const now = ctx.currentTime;
    E.awake = false;
    parkBeds(now, true);
    for (const h of events.slice()) h.done();
    for (const cv of cars) cv.S.kill(now);
    cars.length = 0;
    for (const k of Object.keys(noiseSrc)) noiseStop(k, now);
    lastScene = null; carsGone = 0;
  };
  let duckNow = 1;
  E.duck = (k) => { const g = 1 - 0.4 * clamp01(+k || 0); if (Math.abs(g - duckNow) < 0.005) return; duckNow = g; duckG.gain.setTargetAtTime(g, ctx.currentTime, g < duckG.gain.value ? 0.08 : 0.35); };
  E.thunder = (o) => E.fire('aska', { force: true, ...o });
  E.stats = () => ({
    awake: E.awake, nodes: E.nodes, beds: Object.fromEntries(Object.entries(beds).map(([k, b]) => [k, +b.level.toFixed(4)])),
    events: events.map((h) => h.tag), cars: cars.filter((c) => !c.free).length, carVoices: cars.length,
    noise: Object.keys(noiseSrc), noiseUsers: { ...noiseRef }, reverb: revKind, out: +out.gain.value.toFixed(3), duck: +duckG.gain.value.toFixed(3),
    textures: [...built.keys()].filter((k) => k.startsWith('t:') && built.get(k)).map((k) => k.slice(2)),
    banks: [...built.keys()].filter((k) => k.startsWith('b:') && built.get(k)).map((k) => k.slice(2)),
    build: { queued: [...jobs.keys()], rendering: [...waiting], built: built.size, syncBuilds: Q.syncBuilds, ms: +Q.ms.toFixed(1), sliceMaxMs: +Q.sliceMax.toFixed(2), slices: Q.slices, worst: Object.entries(Q.worst).sort((a, c) => c[1] - a[1]).slice(0, 5) },
    lite, maxEv, carMax, governor: meter ? +meter.g.toFixed(3) : null,
    meter: meter ? { raw: +(10 * Math.log10(meter.pR + 1e-12)).toFixed(1), k: +(10 * Math.log10(meter.pK + 1e-12)).toFixed(1) } : null,
  });
  E._nodes = { out, duckG, mix, comp, gov };
  // testkrokar (kalibreringen i tools/out/ambiens/): en bädd ensam, efterklangen
  E._bed = (name, level, p = {}) => bedLevel(name, level, { gust: 1, ...p }, ctx.currentTime);
  E._reverb = reverb;
  E._cars = (s, now = ctx.currentTime) => updateCars(s, now); // bilarna ensamma (tools/out/ambiens/bidrag-live.mjs)
  return E;
}

// ---------------------------------------------------------------- recepten
// recipe(state) → { beds: { namn: nivå 0–1+ }, ev: { småljud: per minut | { rate, …opts } }, p: { bädd: parametrar }, rev: { kind, send, bed } }
// state = { scene, x, y, hour, dark, weather, district, home, people, vehicles, riding, … } (se readState)
export function recipe(s) {
  const w = s.weather || {}, kind = w.kind || 'sol', k = w.intensity ?? 0.6;
  const rain = kind === 'regn' ? 0.35 + 0.65 * k : 0;
  const snow = kind === 'snö' ? 0.4 + 0.6 * k : 0;
  const fog = kind === 'dimma';
  const windAbs = Math.abs(w.windNow ?? w.wind ?? 6), wind = clamp(windAbs / 60, 0, 1.6);
  const n = clamp01((s.dark ?? darkness(s.hour ?? 12)) / 0.5), hour = s.hour ?? 12;
  const warm = (w.season !== 'vinter') && (w.temp ?? 15) > 7;
  const thunder = kind === 'regn' && w.thunder;
  const M = { beds: {}, ev: {}, p: {}, rev: { kind: 'rum', send: 0.25, bed: 0.5 } };
  const B = M.beds, V = M.ev, P = M.p;
  const add = (name, v) => { if (v > 0.001) B[name] = (B[name] || 0) + v; };
  const inside = (outsideK, { muffle = true } = {}) => { // vädret hörs genom väggarna
    if (rain) { add('regn', rain * outsideK); P.regn = { muffle, heavy: k > 0.85 ? 1 : 0 }; }
    if (wind > 0.6) { add('vind', (wind - 0.4) * 0.5 * outsideK); P.vind = { muffle: true, whistle: 1 }; }
    if (thunder) V.aska = { rate: 1.2, muffle: true, gap: 25 };
  };
  const sc = s.scene || 'city';

  if (sc === 'city') {
    const x = s.x ?? 640, y = s.y ?? 296;
    const d = s.district || districtAt(x, y).id;
    const dRoad = Math.min(distBand(y, CITY.ROAD[0], CITY.ROAD[1]), distBand(y, CITY.ROAD_S[0], CITY.ROAD_S[1]),
      y > CITY.ROAD[1] && y < CITY.ROAD_S[0] ? distBand(x, CITY.INFARTEN[0], CITY.INFARTEN[1]) : 1e4);
    const road = near(dRoad, 70);
    const park = x < CITY.X_CITY + 26 ? smooth(-70, 0, -distBand(y, CITY.PARK[0], CITY.BACK_S[1])) : 0;
    const { canal, river, water } = waterAt(x, y);
    const hangbro = river > 0.9 && y < CITY.PARK[0]; // ute på Stora bron: kablarna viner i blåst
    const ice = (w.season === 'vinter' && (w.temp ?? 0) < 0) || (w.snowCover || 0) > 0.6;
    const green = Math.max(park, x > CITY.X_SUB ? 0.6 * smooth(-60, 0, -distBand(y, 306, 462)) : 0, 0.35 * canal);
    const busy = n < 0.5 ? 1 : 1 - (n - 0.5) * 1.6;
    // stadens brus: vägarna, fler bilar = mer, natten tystare, snön dämpar
    const traffic = (s.vehicles ? clamp01(s.vehicles.length / 14) : 0.7) * (d === 'fororten' ? 0.7 : 1);
    // nere på kajen, nedanför trottoaren: kajkanten skärmar av gatan (bilrösterna likadant, se QUAY_CARS)
    // – vattnet och vinden tar över, och en storm får plats att höras mer än ett lugnt skvalp
    const quay = y > CITY.SIDEWALK_SS[1] ? 0.6 : 1;
    add('trafik', (0.22 + 0.55 * road) * quay * (0.5 + 0.5 * traffic) * (1 - 0.55 * n) * (snow ? 0.6 : 1) * (s.riding ? 0.4 : 1));
    P.trafik = { muffle: !!snow || d === 'fororten' || s.riding, wet: rain ? 1 : w.wet || 0 };
    // vinden: alltid lite luft, byar i blåst, mest vid vattnet (kanalen, ute på broarna)
    // (0,3 i stället för 0,4: stormen −1,8 dB – nivåvakten behöver då bara ta ≈ 3 dB och byarna
    // behåller sin form; lugn vind är oförändrad och vattnet tar fortfarande i ×1,55)
    const windK = (0.12 + 0.3 * clamp01(wind)) * (1 + 0.55 * water) * (snow ? 0.8 : 1);
    add('vind', windK + (snow ? 0.15 : 0));
    P.vind = { whistle: wind > 0.75 ? clamp01((wind - 0.75) * 2) * (1 + water) : hangbro && wind > 0.5 ? clamp01((wind - 0.5) * 2) : 0, soft: !!snow, muffle: s.riding };
    if (rain) {
      add('regn', rain * (s.riding ? 0.6 : 1));
      P.regn = { heavy: k > 0.85 ? 1 : 0, muffle: s.riding };
      add('stupror', rain * (1 - 0.7 * park) * (1 - canal * 0.5) * (1 - 0.8 * river)); // inga stuprör ute på bron
    }
    if (thunder) V.aska = { rate: 0.25, gap: 40, near: 0.1, delay: 0 }; // weather.js spelar 'aska' vid blixtarna (≈ var 16:e s) – det här är sällsynt fjärran muller däremellan
    // parken: fåglar, löv, fontänen, dammen, barnen vid lekplatsen
    const birdK = (1 - n) * (rain ? 0.25 : 1) * (snow ? 0 : 1) * (fog ? 0.5 : 1) * (hour > 4.5 && hour < 8.5 ? 1.8 : 1);
    V.fagel = { rate: (2 + 10 * park + 3 * green) * birdK, lp: park > 0.5 ? 0 : 3500 };
    if (park > 0.3 && birdK > 0.2 && !snow) V.kvitter = { rate: 3 * park * birdK, lvl: 0.35 };
    add('lov', park * (0.25 + 0.75 * clamp01(wind)) * (w.season === 'vinter' ? 0.3 : 1) * (snow ? 0.5 : 1));
    const pl = PARK_LAYOUT;
    add('fontan', (w.season === 'vinter' ? 0 : 1) * near(Math.hypot(x - pl.plaza.cx, y - pl.plaza.cy), 50) * 1.2);
    const dPond = Math.hypot(x - pl.pond.cx, (y - pl.pond.cy) * 1.2);
    if (dPond < 220 && !ice && n < 0.6) V.and = { rate: 4 * near(dPond, 90), lvl: 0.5 + near(dPond, 60), pan: clamp((pl.pond.cx - x) / 200, -0.8, 0.8) };
    const kidsK = (hour > 8.5 && hour < 19.5 ? 1 : 0) * (rain ? 0.15 : 1) * (snow ? 0.5 : 1);
    const dPlay = Math.min(distRect(x, y, pl.playground), distRect(x, y, SUB_PLAY) + 40);
    add('barn', kidsK * (near(dPlay, 110) * 1.1 + 0.08 * park));
    P.barn = { far: dPlay > 150 };
    if (park > 0.3 && n > 0.7 && !rain) V.uggla = { rate: 1.1 * park, gap: 20 };
    add('syrsor', n * green * (warm && !rain && !snow ? 1 : 0));
    // centrum: sorl och steg på trottoarerna, butiksdörrar som plingar
    const folk = s.people ? s.people.filter((p) => Math.abs(p.x - x) < 170 && Math.abs(p.y - y) < 110).length : 4;
    const sidewalk = near(Math.min(distBand(y, CITY.SIDEWALK_N[0], CITY.SIDEWALK_S[1]), distBand(y, CITY.SIDEWALK_SN[0], CITY.SIDEWALK_SS[1])), 60);
    const dens = clamp01(0.15 + folk * 0.09);
    const city = d === 'centrum' || d === 'downtown'; // downtown: höga hus, banker, kostymer – lika livligt
    const crowdD = city ? 1 : d === 'soder' ? 0.6 : d === 'bron' || d === 'jarnbron' ? 0.25 : 0.35;
    add('sorl', 0.55 * crowdD * dens * (0.5 + 0.5 * sidewalk) * busy * (rain ? 0.5 : 1) * (snow ? 0.6 : 1) * quay);
    P.sorl = { far: sidewalk < 0.5, dense: city && folk > 6 };
    add('steg', crowdD * dens * sidewalk * busy * (snow ? 0.3 : 1) * 1.2 * quay); // kajen: folket går uppe på trottoaren
    const shopOpen = hour >= 7 && hour < 21;
    if (d === 'centrum' && shopOpen && y < CITY.SIDEWALK_S[0] + 10) {
      const b = BUILDINGS.reduce((best, bb) => { const dd = Math.abs((bb.door.x0 + bb.door.x1) / 2 - x); return dd < best.d ? { b: bb, d: dd } : best; }, { b: null, d: 1e9 });
      if (b.b && b.d < 220) V.pling = { rate: 2.2 * near(b.d, 90), lvl: 0.4 + 0.8 * near(b.d, 50), pan: clamp(((b.b.door.x0 + b.b.door.x1) / 2 - x) / 180, -0.85, 0.85), gap: 5 };
    }
    // vattnet: kanalen (skvalp mot kajen) och floden (strömmen under broarna), måsar, båten, riggen i
    // vinden vid kanalen, mistluren i dimman
    if (!ice) add('vatten', Math.max(canal * (0.32 + 0.5 * clamp01(wind)), river * (0.5 + 0.35 * clamp01(wind))) * 1.2); // lugnt: stilla skvalp – blåst: vågorna slår
    P.vatten = { flow: river > canal ? river : 0 };
    V.mas = { rate: (water * 4.5 + (d === 'soder' ? 0.8 : 0.3)) * (1 - n) * (snow ? 0.4 : 1), lvl: 0.35 + 0.8 * water };
    // en båt puttrar förbi IBLAND (Carl): ≈ varannan minut, hörs 20–30 s – inte halva tiden
    if (water > 0.35 && !ice && n < 0.7) V.bat = { rate: 0.5 * water * (wind > 0.9 ? 0.4 : 1), canal: water, gap: 80 };
    if (canal > 0.3 && wind > 0.55) V.rigg = { rate: 7 * canal * clamp01(wind - 0.4), lvl: 0.5 + 0.5 * canal };
    if (fog && water > 0.2) V.mistlur = { rate: 0.8 * (0.3 + water), lvl: 0.4 + 0.4 * water, gap: 30 };
    // förorten: moped, hundar långt bort; hela stan: en tuta ibland, en ensam bil på natten
    if (d === 'fororten') { if (!snow && !(rain && k > 0.6)) V.moped = { rate: 0.7, lvl: 0.5, gap: 20 }; V.hund = { rate: 1.1 + n, lvl: 0.45 }; }
    else V.hund = { rate: 0.25, lvl: 0.35 };
    V.tuta = { rate: (0.6 + 0.8 * road) * busy * (d === 'fororten' ? 0.6 : 1), lvl: 0.3 + 0.4 * road };
    if (!s.vehicles) V.bil = { rate: 6 * road * busy + 0.5, lvl: 0.4 + 0.6 * road };
    else if (n > 0.6) V.bil = { rate: 0.6, lvl: 0.25, muffle: true, gap: 25 };
    if (s.riding) add('buss', 1);
    M.rev = { kind: 'ute', send: d === 'downtown' ? 0.18 : 0.12, bed: 0.25, sorl: 0.3, barn: 0.2 }; // downtown: eko mellan höghusen
    return M;
  }

  // ---------- inomhus
  const busyIn = hour >= 21 || hour < 7 ? 0.5 : 1;
  switch (sc) {
    case 'room': case 'visit': {
      const home = s.home || 'rum';
      const where = /lagenhet|villa/.test(home) ? 'centrum' : /radhus|takvaning/.test(home) ? 'soder' : 'fororten';
      add('kyl', 0.55); add('klocka', 0.8);
      add('trafik', (where === 'centrum' ? 0.25 : 0.18) * (1 - 0.5 * n) * (home === 'takvaning' ? 0.5 : 1));
      P.trafik = { muffle: true };
      const thin = home === 'husvagn' ? 1.5 : 1;
      if (rain) { add('regn', rain * 0.75 * thin); P.regn = { muffle: true, heavy: k > 0.85 ? 1 : 0 }; }
      if (wind > 0.5 || home === 'takvaning') { add('vind', (0.1 + (wind - 0.3) * 0.5) * (home === 'takvaning' || home === 'husvagn' ? 1.6 : 1)); P.vind = { muffle: true, whistle: wind > 0.7 ? 1 : 0 }; }
      if (thunder) V.aska = { rate: 1.2, muffle: true, gap: 25 };
      if (n > 0.7 && warm && /radhus|villa|husvagn/.test(home)) add('syrsor', 0.25);
      M.rev = { kind: 'rum', send: 0.08, bed: 0.2 };
      return M;
    }
    case 'mat': {
      add('kyl', 1); add('flakt', 0.6); add('sorl', 0.45 * busyIn); P.sorl = { far: true };
      V.pip = { rate: 9 * busyIn, pan: -0.5, lvl: 0.4 }; V.vagn = { rate: 3 * busyIn, lvl: 0.7 }; V.hogtalare = { rate: 0.5, gap: 60 }; V.flaskor = { rate: 1.5, lvl: 0.35 };
      inside(0.25);
      M.rev = { kind: 'hall', send: 0.22, bed: 0.4 };
      return M;
    }
    case 'narbutik': {
      add('kyl', 1.2); add('lysror', 1);
      V.pip = { rate: 1.2, lvl: 0.4, pan: -0.3 }; V.dingdong = { rate: 0.8, gap: 25 }; V.flaskor = { rate: 1, lvl: 0.35 };
      inside(0.3);
      M.rev = { kind: 'rum', send: 0.12, bed: 0.3 };
      return M;
    }
    case 'klader': {
      add('flakt', 0.5); add('sorl', 0.28 * busyIn); P.sorl = { far: true };
      V.galge = { rate: 5, lvl: 0.45 }; V.pip = { rate: 1, lvl: 0.35, pan: 0.5 }; V.kassa = { rate: 0.3, lvl: 0.4 };
      inside(0.2);
      M.rev = { kind: 'rum', send: 0.18, bed: 0.4 };
      return M;
    }
    case 'mobler': case 'moblerGammal': case 'moblergammal': {
      add('flakt', 0.7); add('sorl', 0.32 * busyIn); P.sorl = { far: true }; add('barn', 0.25 * busyIn); P.barn = { far: true }; add('steg', 0.4 * busyIn);
      V.vagn = { rate: 4 * busyIn, lvl: 0.6, rev: 0.6 }; V.hogtalare = { rate: 0.6, gap: 45 }; V.pip = { rate: 2, lvl: 0.3 }; V.klang = { rate: 1.5, lvl: 0.25 };
      inside(0.15);
      M.rev = { kind: 'hall', send: 0.35, bed: 0.55 };
      return M;
    }
    case 'bostad': {
      add('flakt', 0.4); add('tangent', 0.9); add('klocka', 0.35); add('sorl', 0.12); P.sorl = { far: true };
      V.telefon = { rate: 0.8, gap: 30 }; V.skrivare = { rate: 0.5, gap: 30 };
      inside(0.3);
      M.rev = { kind: 'rum', send: 0.12, bed: 0.3 };
      return M;
    }
    case 'djur': {
      add('bubbel', 1.25); add('flakt', 0.4);
      V.kvitter = { rate: 12, lvl: 0.55 }; V.valp = { rate: 0.7, gap: 20 }; V.mus = { rate: 1.2, lvl: 0.4 }; V.katt = { rate: 0.4, gap: 40 };
      inside(0.25);
      M.rev = { kind: 'rum', send: 0.15, bed: 0.3 };
      return M;
    }
    case 'kafe': case 'jobbkafe': {
      const job = sc === 'jobbkafe';
      add('sorl', 0.8 * busyIn); P.sorl = { dense: !job }; add('flakt', 0.25);
      V.anga = { rate: job ? 2.2 : 1.1, lvl: job ? 1 : 0.6, gap: 8 }; V.kvarn = { rate: job ? 1.6 : 0.7, lvl: job ? 0.9 : 0.5, gap: 10 };
      V.knack = { rate: job ? 2 : 0.8 }; V.kopp = { rate: 9 }; V.bestick = { rate: 2.5 }; V.kassa = { rate: 0.4, lvl: 0.35 };
      inside(0.3);
      M.rev = { kind: 'rum', send: 0.2, bed: 0.4 };
      return M;
    }
    case 'burgarbar': {
      add('sorl', 0.65 * busyIn); P.sorl = { dense: true }; add('fritos', 0.45); add('grill', 0.35); add('flakt', 0.45);
      V.bestick = { rate: 10 }; V.kopp = { rate: 3 }; V.klocka = { rate: 1.1, gap: 20, lvl: 0.55, pan: -0.25 }; V.kassa = { rate: 0.8, lvl: 0.45, pan: -0.2 }; V.stek = { rate: 2, lvl: 0.5 }; V.glas = { rate: 1.5 };
      inside(0.3);
      M.rev = { kind: 'rum', send: 0.2, bed: 0.4 };
      return M;
    }
    case 'jobbburgare': case 'jobbkok': {
      add('fritos', 0.95); add('grill', 0.75); add('flakt', 0.9); add('sorl', 0.3); P.sorl = { muffle: true };
      V.stek = { rate: 5, lvl: 0.8 }; V.bestick = { rate: 6 }; V.klocka = { rate: 1.5, gap: 12, lvl: 0.6 }; V.spade = { rate: 4 };
      inside(0.2);
      M.rev = { kind: 'rum', send: 0.15, bed: 0.3 };
      return M;
    }
    case 'jobbpizzeria': {
      add('ugn', 1); add('sorl', 0.45); add('flakt', 0.4);
      V.bestick = { rate: 6 }; V.glas = { rate: 2 }; V.klocka = { rate: 0.8, gap: 20, lvl: 0.4 }; V.kassa = { rate: 0.5, lvl: 0.35 };
      inside(0.25);
      M.rev = { kind: 'rum', send: 0.18, bed: 0.4 };
      return M;
    }
    case 'jobbflyg': case 'jobbincheck': case 'terminal': {
      add('flakt', 0.8); add('sorl', sc === 'jobbflyg' ? 0.3 : 0.55); P.sorl = { far: true }; add('band', sc === 'jobbflyg' ? 0.8 : 0.35); add('steg', 0.35);
      V.hogtalare = { rate: 0.8, gap: 30 }; V.plan = { rate: 0.7, gap: 30 }; V.pip = { rate: 3, lvl: 0.3 }; V.vagn = { rate: 1.5, lvl: 0.5, rev: 0.6 };
      inside(0.15);
      M.rev = { kind: 'hall', send: 0.4, bed: 0.7 };
      return M;
    }
    case 'jobbfrukt': {
      add('band', 1); add('kyl', 0.5); add('flakt', 0.5);
      V.duns = { rate: 6, lvl: 0.45 }; V.tryckluft = { rate: 2, lvl: 0.35 }; V.klang = { rate: 2, lvl: 0.3 };
      M.rev = { kind: 'hall', send: 0.3, bed: 0.5 };
      return M;
    }
    case 'jobbposten': {
      add('flakt', 0.5); add('sorl', 0.3); P.sorl = { far: true }; add('band', 0.35);
      V.stampel = { rate: 6 }; V.pip = { rate: 4, lvl: 0.35 }; V.tejp = { rate: 2, lvl: 0.4 }; V.skrivare = { rate: 0.8, gap: 20 };
      inside(0.2);
      M.rev = { kind: 'rum', send: 0.18, bed: 0.4 };
      return M;
    }
    case 'jobbbensin': {
      add('kyl', 0.9); add('lysror', 0.7);
      V.pip = { rate: 3, lvl: 0.4 }; V.dingdong = { rate: 1, gap: 20 }; V.bil = { rate: 2.5, lvl: 0.5, muffle: true }; V.flaskor = { rate: 1 };
      inside(0.3);
      M.rev = { kind: 'rum', send: 0.12, bed: 0.3 };
      return M;
    }
    case 'jobbverkstad': {
      add('flakt', 0.4); add('trafik', 0.15); P.trafik = { muffle: true };
      V.tryckluft = { rate: 4, lvl: 0.6 }; V.mutter = { rate: 3, lvl: 0.6 }; V.klang = { rate: 5, lvl: 0.5 }; V.duns = { rate: 1 };
      inside(0.35);
      M.rev = { kind: 'hall', send: 0.3, bed: 0.4 };
      return M;
    }
    case 'jobbtvatt': {
      add('tvatt', 1); add('lysror', 0.5); add('flakt', 0.3);
      V.summer = { rate: 0.3, gap: 60 }; V.klang = { rate: 3, lvl: 0.2 }; V.dingdong = { rate: 0.3, gap: 60 };
      inside(0.3);
      M.rev = { kind: 'rum', send: 0.2, bed: 0.3 };
      return M;
    }
    case 'leksaker': {
      add('flakt', 0.4); add('sorl', 0.3); P.sorl = { far: true }; add('barn', 0.45);
      V.pip = { rate: 2, lvl: 0.35 }; V.kassa = { rate: 0.4, lvl: 0.35 }; V.hogtalare = { rate: 0.3, gap: 60 };
      inside(0.2);
      M.rev = { kind: 'rum', send: 0.2, bed: 0.4 };
      return M;
    }
    default: {
      add('flakt', 0.4); inside(0.2);
      return M;
    }
  }
}

// ---------------------------------------------------------------- spelets läge → state
let weatherAtFn = null;
import('../city/weather.js').then((m) => { weatherAtFn = m.weatherAt || null; }).catch(() => { /* reserv nedan */ });
let vehCache = { t: -1, list: null }, sceneRef = null;
export function readState(A) {
  const sc = A?.sceneName || '', g = A?.game;
  const hour = g ? ((g.min || 0) / 60) % 24 : 12;
  const s = { scene: sc === 'moblergammal' ? 'moblerGammal' : sc, hour, home: g?.home, attract: !!A?.attract };
  if (sc === 'city') {
    const dbg = A.scene?._debug, env = dbg?.env || null;
    s.x = A.scene?.worldX; s.y = A.scene?.worldY;
    s.district = env?.district?.id;
    s.dark = env?.dark;
    s.weather = env?.weather || null;
    s.people = env?.people || null;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (sceneRef !== A.scene || now - vehCache.t > 90) {
      sceneRef = A.scene;
      let list = null;
      try { list = dbg?.sim?.()?.traffic?.vehicles?.() || null; } catch { list = null; }
      vehCache = { t: now, list };
    }
    s.vehicles = vehCache.list;
    try { s.riding = !!dbg?.ride?.(); } catch { s.riding = false; }
    s.wet = s.weather?.kind === 'regn' ? 1 : (s.weather?.wet || 0);
  }
  if (!s.weather) {
    try { s.weather = weatherAtFn && g ? weatherAtFn(g.day || 1, hour, g.event?.id || null) : null; } catch { s.weather = null; }
    if (!s.weather) s.weather = { kind: g?.eventIs?.('regn') ? 'regn' : 'sol', intensity: 0.7, wind: 8, season: 'sommar', temp: 15 };
  }
  if (s.dark == null) s.dark = darkness(hour);
  return s;
}

// ---------------------------------------------------------------- live (spelet)
let eng = null, engCtx = null, lastA = null, sleepAt = 0, chatDuck = 0, voiceT = 0, lastMusic = null;
const hidden = () => typeof document !== 'undefined' && document.hidden;
function engine() {
  const c = audioContext(); // null före första klicket
  if (!c || c.state === 'closed') return null;
  if (engCtx !== c) { eng = createAmbienceEngine(c, c.destination); engCtx = c; if (chatDuck) eng.duck(chatDuck); }
  return eng;
}
// Varje bildruta från main.js.
export function audioTick(A, dt) {
  try {
    lastA = A;
    const s = readState(A);
    // musiken följer med oavsett (den kollar själv av/på, mute och flik) – ett fel där får aldrig
    // hoppa över ambiensen
    try {
      lastMusic = pickMusic({ scene: s.scene, district: s.district || (s.x != null ? districtAt(s.x, s.y).id : 'centrum'), night: clamp01((s.dark ?? 0) / 0.5), canal: s.scene === 'city' && s.y != null ? waterAt(s.x ?? 0, s.y).water : 0 });
      musicFrame(lastMusic);
    } catch { /* ok */ }
    if (isMuted() || hidden()) {
      if (eng && eng.awake) { eng.fadeOut(0.25); if (!sleepAt) sleepAt = eng.ctx.currentTime + 0.4; if (eng.ctx.currentTime >= sleepAt) { eng.sleep(); sleepAt = 0; } }
      return;
    }
    const E = engine();
    if (!E) return;
    sleepAt = 0;
    if (!E.awake) E.wake(1.2);
    // pratar någon? (pratbubblornas babbel) – sänk musiken och ambiensen en aning
    voiceT += dt;
    if (voiceT > 0.1) {
      voiceT = 0;
      let talking = 0;
      try { talking = voicesStats().active > 0 ? 1 : 0; } catch { talking = 0; }
      musicDuckVoice(talking);
      E.voiceDuck = talking;
      E.duck(Math.max(chatDuck, talking * 0.35));
    }
    E.tick(s, Math.min(0.1, Math.max(0, dt || 0)));
  } catch { /* ljudet får aldrig stoppa spelet */ }
}
// Röstchatten (js/net/voice.js): k = 0–1, 1 = någon pratar → ambiens och musik sänks ca 40 %.
export function setDuck(k) {
  chatDuck = clamp01(+k || 0);
  try { eng?.duck(Math.max(chatDuck, (eng?.voiceDuck || 0) * 0.35)); } catch { /* ok */ }
  try { musicSetDuck(chatDuck); } catch { /* ok */ }
}
export function ambienceStats() {
  return { unlocked: !!engCtx, muted: isMuted(), scene: lastA?.sceneName || null, music: lastMusic, ...(eng ? eng.stats() : { awake: false, nodes: 0 }), last: eng?.last ? { beds: eng.last.beds, ev: Object.keys(eng.last.ev) } : null };
}

// Åskan från vädret (weather.js → env.play('aska')) och hundar som skäller i staden (life.js).
let barkAt = 0;
let askaAt = 0;
setPlayHook('aska', () => {
  if (!eng || !eng.awake) return;
  const t = eng.ctx.currentTime;
  if (t < askaAt) return; // dubbelblixten (två blixtar inom en halv sekund) = en åska
  askaAt = t + 2.5;
  const inside = lastA && lastA.sceneName !== 'city';
  eng.thunder({ near: 0.35 + 0.65 * Math.random(), muffle: inside });
});
setPlayHook('bark', () => {
  if (!eng || !eng.awake) return;
  const now = eng.ctx.currentTime;
  if (now < barkAt) return;
  barkAt = now + 8;
  eng.fire('hund', { near: true, lvl: 0.6 });
});
// Jukeboxen i dinern (shop-burgarbar.js spelar 'box' när man trycker på den).
onPlay((name) => { if (name === 'box' && lastA?.sceneName === 'burgarbar') musicJukebox(50); });
// Dold flik: rAF står still, så audioTick kommer inte – tysta och riv här i stället.
if (typeof document !== 'undefined') {
  try {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden || !eng || !eng.awake) return;
      eng.fadeOut(0.15);
      setTimeout(() => { if (document.hidden && eng?.awake) eng.sleep(); }, 250);
    });
  } catch { /* ok */ }
}

// för testerna (tools/out/ambiens/)
export const _test = {
  TEX, BANKS, makeIR, makeNoise, renderBabble, renderBarks, recipe, readState, CAL,
  buildBank: (ctx, name) => runSync(bankJob(ctx, name)),
  // generatorerna (tools/out/ambiens/kostnad.mjs mäter den längsta skivan mellan två yield)
  G: { TEXG, bankJob, noiseJob, irFill, babbleJob, barksJob },
};
