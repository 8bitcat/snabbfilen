// FINANSHUSET – mäklardesken (jobbet 'finans', kräver examen i Ekonomi från Pixelhögskolan).
// Man sitter vid sin desk i handelssalen med fyra skärmar – en per aktie (PIXEL, SNABB, BURGR,
// MÖBEL) med levande kurs, graf och knapparna KÖP och SÄLJ. Uppe på väggen löper börstavlan,
// bakom skärmarna ropar kollegorna i telefon.
//
// Kunderna ringer in order som dyker upp som lappar under skärmen för sin aktie:
//   KÖP 100 SNABB – UNDER 52 KR   → tryck KÖP när kursen är under gränsen
//   SÄLJ 50 PIXEL – ÖVER 130 KR   → tryck SÄLJ när kursen är över gränsen
// Gränsen syns som en gul streckad linje i grafen, och knappen lyser när läget är rätt.
// Rätt = affären klar (+lön), för dyrt/för billigt eller fel knapp = fel, lappen som hinner
// gå ut = kunden lägger på (miss). Passet via shift.js (60 s för en nybörjare, längre och
// tätare order med vanan – planOf). Escape = avbryt.
//
// JOBBA IHOP: flera kan dela passet (💼-inbjudan, js/net/coop.js). Skärmarna och lapparna är
// gemensamma och man sitter bredvid varandra vid desken; klickar man på en lapp blir ordern ens
// egen (låst – kollegan tar en annan). Skiftledaren kör kurserna och kunderna, medarbetarnas tryck
// blir önskemål – se "jobba tillsammans" i makeJobbFinans.
//
// _debug: state(), stocks(), tickets(), force(i, typ, gräns) (lägg en order), setPrice(i, p),
//   trade(i, typ) (samma som knappen), spot(i, typ) → { x, y } (typ 'LAPP' = lappen), finish(),
//   stats – och för jobba ihop (tools/coop-finans-test.mjs): coop(), lag(), title(), claim(i),
//   still(on), calm(), auto(on), expire(i), tradeTwice(i, typ), handled(), seat(), idle(), pops().
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, BIG, text, textW, ctxText, mix, mul, hash } from '../core/floor-pix.js';
import { createSpeech } from '../scenes/walkable.js';
import { planOf, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';
import { makeShiftCoop } from '../net/coop.js';
import { $t, $n } from '../core/i18n.js';

const FW = 384, FH = 216;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtKr = (v) => v.toFixed(1);   // (punkt: pixeltypsnittets komma liknar ett snedstreck i skärmstorlek)
const STOCKS = [
  { id: $n('PIXEL'), mean: 128, vol: 2.6, col: '#4ad8e8' },
  { id: $n('SNABB'), mean: 54, vol: 1.3, col: '#f0c850' },
  { id: $n('BURGR'), mean: 78, vol: 1.8, col: '#f08a4a' },
  { id: $n('MÖBEL'), mean: 215, vol: 3.6, col: '#b88ae8' },
];
const MON = STOCKS.map((_, i) => ({ x: 8 + i * 94, y: 96, w: 86, h: 56 }));
const BTN = (i, typ) => { const M = MON[i]; return typ === 'KÖP' ? { x: M.x + 4, y: M.y + M.h - 12, w: 38, h: 9 } : { x: M.x + M.w - 42, y: M.y + M.h - 12, w: 38, h: 9 }; };
const TICK = (i) => ({ x: MON[i].x + 2, y: 156, w: MON[i].w - 4, h: 22 });
const HIST = 64;

// ---------- bakgrunden: handelssalen ----------
let BG = null;
function paintBg() {
  if (BG) return BG;
  const P = new Pix(FW, FH);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    let c = y < 92 ? mix(0x2a3040, 0x3a4254, y / 92) : mix(0x4a4e58, 0x3a3e48, (y - 92) / 124);
    if (y >= 92) c = mul(c, 1 + (hash(x >> 2, y >> 2, 3) - 0.5) * 0.05);        // heltäckningsmatta
    P.px(x, y, c);
  }
  // fönsterband mot downtown (skyskraporna och himlen)
  for (let y = 38; y < 84; y++) for (let x = 0; x < FW; x++) {
    let c = mix(0x8ab8e0, 0xc8dcf0, (y - 38) / 46);
    const col = Math.floor(x / 22), hgt = 38 + ((hash(col, 1, 7) * 26) | 0);
    if (y > hgt) { c = mul(mix(0x4a5a74, 0x6a7a94, hash(col, 2, 7)), 1); if ((x % 22) % 4 === 1 && (y - hgt) % 5 === 2) c = 0xc8e0f0; }
    if (x % 64 === 0 || x % 64 === 1) c = 0x1a1e28;                            // fönsterposterna
    P.px(x, y, c);
  }
  for (let x = 0; x < FW; x++) { P.px(x, 37, 0x1a1e28); P.px(x, 84, 0x1a1e28); P.px(x, 85, 0x5a6270); }
  // börstavlans ram (texten löper i draw)
  P.rect(0, 18, FW, 18, 0x0a0a10); P.hl(0, 18, FW, 0x3a3a44); P.hl(0, 35, FW, 0x3a3a44);
  // kollegornas skrivbord bakom (en rad)
  for (let i = 0; i < 4; i++) {
    const x = 20 + i * 96;
    P.rect(x, 86, 70, 5, 0x5a4a3a); P.hl(x, 86, 70, 0x8a7458);
    P.rect(x + 8, 74, 20, 12, 0x1a1a24); P.rect(x + 9, 75, 18, 9, 0x2a4a7a); P.rect(x + 36, 74, 20, 12, 0x1a1a24); P.rect(x + 37, 75, 18, 9, 0x2a5a4a);
  }
  // min desk: skivan under skärmarna och lappytan
  P.rect(0, 150, FW, 34, 0x3a2e24); P.hl(0, 150, FW, 0x6a5440); P.hl(0, 151, FW, 0x5a4634); P.hl(0, 183, FW, 0x1a140e);
  for (let x = 0; x < FW; x += 2) P.px(x, 152 + ((x >> 3) & 1), 0x4a3a2c);
  // skärmarnas fötter
  for (const M of MON) { P.rect(M.x + M.w / 2 - 4, M.y + M.h, 8, 3, 0x2a2a30); P.rect(M.x + M.w / 2 - 10, M.y + M.h + 2, 20, 2, 0x3a3a44); }
  // tangentbord, telefonen, kaffekoppen och skylten FINANSHUSET
  P.rect(150, 186, 84, 8, 0x2a2a30); for (let i = 0; i < 20; i++) P.rect(152 + i * 4, 188, 3, 2, 0x5a5a64);
  P.rect(250, 186, 22, 10, 0x1a1a20); P.rect(252, 184, 18, 3, 0x2a2a30); P.hl(254, 190, 14, 0x3a7bd5);
  P.rect(110, 186, 8, 8, 0xf4f1ea); P.rect(111, 187, 6, 3, 0x6a3a1a); P.vl(118, 188, 3, 0xf4f1ea);
  const s = $t('FINANSHUSET'), sw = textW(SMALL, s) + 10;
  P.rect(FW - sw - 6, 4, sw, 10, 0x1a2a4a); P.box(FW - sw - 6, 4, sw, 10, 0xc89a40); text(P, SMALL, s, FW - sw - 1, 7, 0xf0d070);
  BG = P.flush();
  return BG;
}

// ---------- jobba ihop ----------
// ljuden som skiftledarens utfall får spela hos den det gäller (eller hos alla)
const LJUD = new Set(['click', 'coin', 'fel', 'miss']);
// stolarna vid desken ihop (ryggen mot oss, i glappen mellan lapparna): var och en får en plats efter
// spelar-id – samma ordning hos alla. Ensam sitter man i mitten, som förut.
const SEATS = [192, 98, 286, 20, 364];

export function makeJobbFinans(A, { onDone } = {}) {
  let t = 0, done = false, doneT = 0, reported = false;
  const P = planOf(A);   // passets plan: längd (P.seconds) och ordertakt (P.pace) efter vanan
  const stats = { ok: 0, fel: 0, miss: 0 };
  const pops = makePops();
  const popLog = [];   // de senaste puffarnas text (provet läser dem: syntes "HANN FÖRE!"?)
  const addPop = pops.add;
  pops.add = (x, y, txt, c) => { popLog.push(txt); if (popLog.length > 30) popLog.shift(); addPop(x, y, txt, c); };
  // kurserna: slumpvandring som dras mot medelvärdet, ibland ett ryck
  let seed = ((A.game?.day || 1) * 9301 + 49297) % 233280;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const S = STOCKS.map((s) => {
    const p = s.mean * (0.96 + rnd() * 0.08);
    return { ...s, p, hist: Array.from({ length: HIST }, () => p), vel: 0, old: p };
  });
  let histT = 0, still = false;
  function stepPrices(dt) {
    if (still) return;   // (provet: kurserna står still)
    for (const s of S) {
      s.vel += ((s.mean - s.p) * 0.02 + (rnd() - 0.5) * s.vol * 2.2) * dt * 3;
      s.vel *= Math.pow(0.35, dt);
      if (rnd() < 0.004) s.vel += (rnd() - 0.5) * s.vol * 3;                  // nyhet!
      s.p = Math.max(1, s.p + s.vel * dt);
    }
    histT += dt;
    if (histT > 0.2) { histT = 0; for (const s of S) { s.hist.push(s.p); if (s.hist.length > HIST) s.hist.shift(); } }
  }
  // lapparna: en per aktie som mest (id = lappens nummer, by = mäklaren som tagit den – ihop)
  const tickets = [null, null, null, null];
  let nextT = 1.2, custSeq = 0, tkSeq = 0;
  const NAMES = ['FRU LIND', 'PENSIONSFONDEN', 'HERR ÖST', 'PIXELBANKEN', 'DORIS', 'KALLE', 'STIFTELSEN', 'FAMILJEN BERG'];
  function newTicket(i = null, typ = null, lim = null) {
    const free = [0, 1, 2, 3].filter((k) => !tickets[k]);
    if (!free.length) return null;
    i = i ?? free[(rnd() * free.length) | 0];
    if (tickets[i]) return null;
    const s = S[i];
    // oftast åt det håll kursen är på väg (över medel → den sjunker → köp under; under → sälj över)
    typ = typ || ((s.p > s.mean) === (rnd() < 0.7) ? 'KÖP' : 'SÄLJ');
    const off = s.vol * (0.25 + rnd() * 0.8) * (rnd() < 0.25 ? -1 : 1);      // ibland direkt uppfyllbar
    lim = lim ?? Math.round((typ === 'KÖP' ? s.p - off : s.p + off) * 10) / 10;
    const dur = 15 + rnd() * 6;
    tickets[i] = { id: ++tkSeq, i, typ, lim, n: [10, 25, 50, 100, 200][(rnd() * 5) | 0], who: NAMES[custSeq++ % NAMES.length], t: dur, dur, born: t, by: null };
    play('chirp');
    if (coop.active) snapAsap();
    return tickets[i];
  }
  const goodAt = (tk, p) => (tk.typ === 'KÖP' ? p <= tk.lim : p >= tk.lim);
  const good = (tk) => goodAt(tk, S[tk.i].p);

  // kollegorna bakom skärmarna
  const mates = [0, 1, 2].map((k) => ({ look: { ...makeLook(() => [0.2, 0.55, 0.8][k]), kid: false, top: 'jacket', shirt: ['#2d3a5c', '#3c3c3c', '#5a4632'][k], hat: null, bag: null }, x: 64 + k * 128, y: 94, talk: createSpeech(), nextT: 3 + k * 4 }));
  const meLook = A.avatar?.look;
  let chairX = SEATS[0];   // min stol (ihop rullar den till min plats)

  // ---------- jobba tillsammans (delat pass via js/net/coop.js) ----------
  // Skiftledaren (den som suttit längst vid desken) kör det gemensamma: kurserna och graferna på de
  // fyra skärmarna, börstavlan och lapparna – när kunderna ringer, köp eller sälj, gränsen, hur länge
  // de väntar och när de lägger på. Läget delas ~3 ggr/s (graferna en gång i sekunden); hos
  // medarbetarna glider kurserna vidare i ledarens riktning mellan lägena. En lapp man klickar på blir
  // ens egen (LÅST: ens namn och färg på lappen – kollegans KÖP/SÄLJ säger KOLLEGANS ORDER), så två
  // mäklare kan ta var sin; klickar man på sin egen igen släpps den. En lapp ingen tagit får vem som
  // helst handla direkt. Varje handling är ett numrerat önskemål med det man såg: lappens nummer, vem
  // som hade den och kursen på ens skärm (den ligger ett ögonblick efter hos en medarbetare – ligger
  // kursen man såg nära skiftledarens gäller den). Skiftledaren är ENDA domaren: en lapp handlas EN
  // gång och tas av EN – den som kom för sent ser HANN FÖRE! (inget fel). Poängen och felen går till
  // den som tryckte, en lapp som hinner gå ut blir missad hos den som tagit den; lagets rätt, fel och
  // missade delas lika vid passets slut. Går man hem släpps ens lappar. Ihop ringer kunderna tätare.
  // Man sitter bredvid varandra vid desken, med ryggen mot oss (stolarna i glappen mellan lapparna).
  const coop = makeShiftCoop(A, 'away:jobbfinans');
  let snapIn = 0, wasLead = true, wasCoop = false, maxN = 1, snaps = 0, handled = 0, mateSq = 0, hsAt = -9;
  let pend = null, queued = null;                // medarbetarens önskemål som väntar på svar (och ett köat klick)
  let reqN = (Math.random() * 1e6) | 0;          // önskemålens löpnummer (samma nummer två gånger = samma önskemål)
  const team = { ok: 0, fel: 0, miss: 0 };       // LAGETS räkning – delas lika vid passets slut
  const seenReq = new Map();                     // (skiftledaren) id → senaste önskemålets nummer
  const absent = new Map();                      // (skiftledaren) id → sedan när den som tagit en lapp inte syns
  const gone = [null, null, null, null];         // (skiftledaren) lappen som nyss handlades: { t, by }
  const medarb = () => coop.active && !coop.leader;
  const meId = () => coop.myId || '';
  const snapAsap = () => { snapIn = 0; };
  const int = (v, dflt) => (Number.isInteger(v) ? v : dflt);
  const str = (v) => (typeof v === 'string' ? v.slice(0, 64) : '');
  const hudTitle = () => (maxN > 1 ? $t('FINANSHUSET IHOP') : $t('FINANSHUSET'));
  function seatX() {
    if (!coop.active) return SEATS[0];
    const ids = [meId(), ...coop.peers().map((f) => f.id)].sort();
    return SEATS[Math.min(SEATS.length - 1, ids.indexOf(meId()))];
  }

  // lapp: [nummer, 0 KÖP / 1 SÄLJ, gräns·100, antal, tid kvar·10, tid·10, vem som tagit den ('' = ingen)]
  function sendSnap() {
    const hs = t - hsAt >= 1;   // (graferna en gång i sekunden – kurserna varje gång)
    if (hs) hsAt = t;
    coop.send({
      t: 'snap',
      px: S.flatMap((s) => [Math.round(s.p * 100), Math.round(s.vel * 100)]),
      ...(hs ? { hs: S.map((s) => s.hist.map((v) => Math.round(v * 10))) } : {}),
      tk: tickets.map((k) => (k ? [k.id, k.typ === 'KÖP' ? 0 : 1, Math.round(k.lim * 100), k.n, Math.round(Math.max(0, k.t) * 10), Math.round(k.dur * 10), k.by || ''] : 0)),
      tm: [team.ok, team.fel, team.miss],
      sq: tkSeq,   // (lapparnas nummer – tar någon annan över fortsätter numreringen efter det)
    });
  }
  function applySnap(m) {
    const first = snaps === 0;
    if (Array.isArray(m.px)) S.forEach((s, i) => {
      const p = (m.px[2 * i] | 0) / 100, v = (m.px[2 * i + 1] | 0) / 100;
      if (p > 0) s.p = p;
      s.vel = v;
    });
    if (Array.isArray(m.hs)) S.forEach((s, i) => {
      const h = Array.isArray(m.hs[i]) ? m.hs[i].slice(-HIST).map((v) => (+v || 0) / 10).filter((v) => v > 0) : [];
      if (h.length) { while (h.length < HIST) h.unshift(h[0]); s.hist = h; histT = 0; }
    });
    else if (first) for (const s of S) s.hist = Array.from({ length: HIST }, () => s.p);   // (grafen kommer strax)
    if (Array.isArray(m.tk)) for (let i = 0; i < 4; i++) {
      const a = m.tk[i];
      if (!Array.isArray(a)) { tickets[i] = null; continue; }
      const id = int(a[0], -1);
      let tk = tickets[i];
      if (!tk || tk.id !== id) {   // en ny kund ringer
        tk = { id, i, typ: 'KÖP', lim: 0, n: 0, who: '', t: 0, dur: 1, born: t, by: null };
        tickets[i] = tk;
        if (!first) play('chirp');
      }
      tk.typ = a[1] ? 'SÄLJ' : 'KÖP'; tk.lim = (+a[2] || 0) / 100; tk.n = a[3] | 0;
      const left = Math.max(0, (a[4] | 0) / 10);
      if (Math.abs(tk.t - left) > 0.3) tk.t = left;
      tk.dur = Math.max(0.1, (a[5] | 0) / 10);
      tk.by = str(a[6]) || null;
    }
    if (Array.isArray(m.tm)) { team.ok = m.tm[0] | 0; team.fel = m.tm[1] | 0; team.miss = m.tm[2] | 0; }
    if (Number.isFinite(m.sq)) mateSq = Math.max(mateSq, m.sq | 0);
    snaps++;
  }
  // Medarbetarens handelssal mellan ledarens lägen: kurserna glider vidare i ledarens riktning,
  // graferna rullar och lapparnas tid rinner – men bara skiftledaren låter kunderna lägga på.
  function mateTick(dt) {
    for (const s of S) { s.vel *= Math.pow(0.35, dt); s.p = Math.max(1, s.p + s.vel * dt); }
    histT += dt;
    if (histT > 0.2) { histT = 0; for (const s of S) { s.hist.push(s.p); if (s.hist.length > HIST) s.hist.shift(); } }
    for (const tk of tickets) if (tk) tk.t = Math.max(0, tk.t - dt);
  }
  // JAG tar över passet: nya lappar får nummer över allt som synts (inga krockar), kurserna går vidare
  // från där de står och nästa kund ringer snart. (Lapparna hos den som gick släpps av sweepGone.)
  function takeOver() {
    tkSeq = Math.max(tkSeq, mateSq, ...tickets.map((k) => (k ? k.id : 0)));
    nextT = Math.min(nextT, 1);
    hsAt = -9;
    pend = null; queued = null;
    snapAsap();
  }
  // jag blir medarbetare: nästa snap bestämmer kurserna och lapparna
  function becomeMate() { snaps = 0; }
  // (skiftledaren) lapparna som `by` tagit blir lediga igen
  function release(by) {
    let n = 0;
    for (const tk of tickets) if (tk && by && tk.by === by) { tk.by = null; n++; }
    if (n) snapAsap();
  }
  // (skiftledaren) den som gått från desken (en stund – inte bara ett ögonblick) har inga lappar längre
  function sweepGone() {
    const ids = new Set([meId(), ...coop.peers().map((f) => f.id)]);
    for (const by of new Set(tickets.filter((k) => k && k.by).map((k) => k.by))) {
      if (ids.has(by)) { absent.delete(by); continue; }
      if (!absent.has(by)) absent.set(by, t);
      if (t - absent.get(by) > 1.5) { absent.delete(by); release(by); }
    }
  }
  // mitt pass är slut: mina lappar blir lediga (kollegan kan ta dem)
  function letGo() {
    if (!coop.active) return;
    if (medarb()) { coop.send({ t: 'lamna' }); return; }
    release(meId());
    sendSnap(); coop.sentSnap();
  }

  // Mäklaren som gör något med det gemensamma: jag själv, eller – hos skiftledaren – en medarbetare
  // vars önskemål körs åt hen.
  const meK = () => ({ by: meId(), fx: [] });
  const forK = (by) => ({ by, fx: [], remote: true });
  const kOf = (by) => (!by || by === meId() ? meK() : forK(by));
  // Utfallet av en handling: [slag, vem (spelar-id; '' = alla vid desken), ...]. Det som gäller mig
  // (eller alla) syns och hörs här direkt – ensam gäller allt mig; i ett delat pass (eller när jag kör
  // en medarbetares önskemål) följer resten med svaret ut.
  const delat = (k) => coop.active || !!k.remote;
  function fx(k, who, kind, ...a) {
    const me = meId(), ut = delat(k);
    if (!who || who === me || !ut) doFx(kind, a);
    if (ut && who !== me) k.fx.push([kind, who, ...a]);
  }
  const popAt = (i, txt, col, y) => { const M = MON[clamp(i | 0, 0, 3)]; pops.add(M.x + M.w / 2, Number.isFinite(y) ? y : M.y - 2, String(txt).slice(0, 40), String(col || '#f4f1ea')); };
  function doFx(kind, a) {
    if (kind === 's') { if (LJUD.has(a[0])) play(a[0]); }
    else if (kind === 'p') popAt(a[0], a[1], a[2], a[3] === undefined ? undefined : +a[3]);
    else if (kind === 'H') { play('miss'); popAt(a[0], $t('HANN FÖRE!'), '#ff6a6a'); }   // någon annan hann först
    else if (kind === 'o') stats.ok++;
    else if (kind === 'f') stats.fel++;
    else if (kind === 'm') stats.miss++;
  }
  const kLjud = (k, s) => fx(k, k.by, 's', s);                                   // hörs hos den det gäller
  const kPop = (k, i, txt, col, y) => fx(k, '', 'p', i, txt, col, ...(y === undefined ? [] : [y]));   // vid skärmen – syns hos alla
  const kPopMe = (k, i, txt, col) => fx(k, k.by, 'p', i, txt, col);             // vid skärmen – bara hos den det gäller
  function kFel(k, i, txt) { team.fel++; fx(k, k.by, 'f'); kLjud(k, 'fel'); kPop(k, i, txt, '#ff6a5a'); }

  // ---------- det gemensamma (körs av skiftledaren – eller den ensamma – åt mäklaren k) ----------
  // KÖP/SÄLJ på skärm i. seen = det mäklaren såg när hen tryckte: { id (lappen, −1 = ingen), by (vem
  // som hade den), p (kursen på skärmen) } – ihop avgör det om någon annan hann före.
  function doTrade(k, i, typ, seen) {
    const tk = tickets[i], s = S[i], d = delat(k);
    if (!tk) {
      const g = gone[i];
      if (d && ((seen && seen.id >= 0) || (g && g.by !== k.by && t - g.t < 1))) fx(k, k.by, 'H', i);
      else { kPopMe(k, i, $t('INGEN ORDER'), '#d8d2c0'); kLjud(k, 'miss'); }
      return;
    }
    if (d && seen && seen.id >= 0 && seen.id !== tk.id) { fx(k, k.by, 'H', i); return; }   // (lappen jag såg är borta – en ny kund)
    if (d && tk.by && tk.by !== k.by) {
      if (seen && !seen.by) fx(k, k.by, 'H', i);   // (ledig när jag tryckte – kollegan tog den)
      else { kPopMe(k, i, $t('KOLLEGANS ORDER'), '#ffd23f'); kLjud(k, 'click'); }
      return;
    }
    // kursen på min skärm gäller, om den inte dragit iväg från skiftledarens
    const p = d && seen && Number.isFinite(seen.p) && Math.abs(seen.p - s.p) <= s.vol * 1.5 ? seen.p : s.p;
    tickets[i] = null; gone[i] = { t, by: k.by };
    if (tk.typ !== typ) { kFel(k, i, $t('FEL KNAPP!')); return; }
    if (!goodAt(tk, p)) { kFel(k, i, typ === 'KÖP' ? $t('FÖR DYRT!') : $t('FÖR BILLIGT!')); return; }
    team.ok++; fx(k, k.by, 'o'); kLjud(k, 'coin'); kPop(k, i, $t('AFFÄR KLAR!'), '#8ee03c');
    s.vel += (typ === 'KÖP' ? 1 : -1) * s.vol * 0.3;                          // ordern flyttar kursen lite
  }
  // (ihop) ta lappen på skärm i – den blir min; min egen släpps igen
  function doClaim(k, i, seen) {
    const tk = tickets[i];
    if (!tk || (seen && seen.id >= 0 && seen.id !== tk.id)) { fx(k, k.by, 'H', i); return; }   // (den är redan handlad)
    if (tk.by === k.by) { tk.by = null; kPopMe(k, i, $t('LEDIG IGEN'), '#d8d2c0'); kLjud(k, 'click'); return; }
    if (tk.by) {   // (ledig när jag klickade – eller tagen alldeles nyss: kollegan hann före)
      if ((seen && !seen.by) || (delat(k) && t - (tk.at ?? -9) < 1)) fx(k, k.by, 'H', i);
      else { kPopMe(k, i, $t('KOLLEGANS ORDER'), '#ffd23f'); kLjud(k, 'click'); }
      return;
    }
    tk.by = k.by; tk.at = t; kPopMe(k, i, $t('DIN ORDER!'), '#8ee03c'); kLjud(k, 'click');
  }
  // skiftledaren: läget ut direkt efter en handling (FÖRE svaret – då har den som frågade redan det
  // nya läget när svaret kommer) och utfallet till alla
  function publish(k, svar) {
    if (!svar && !(coop.active && coop.leader && coop.settled)) return;
    sendSnap(); coop.sentSnap(); snapIn = 0.35;
    if (svar) coop.send({ t: 'res', by: k.by, fx: k.fx, s: 1 });
    else if (k.fx.length) coop.send({ t: 'res', by: k.by, fx: k.fx });
  }
  // medarbetarens önskemål: man väntar på skiftledarens svar (högst 2,5 s – sedan kan man försöka
  // igen). n = löpnumret: kommer samma önskemål fram två gånger görs det EN gång (provet skickar två).
  function ask(m, n = 1) {
    m.n = ++reqN;
    for (let j = 0; j < n; j++) coop.send(m);
    pend = { t: 2.5 };
  }
  function answered() {
    pend = null;
    if (queued && !done) { const q = queued; queued = null; api.down(q[0], q[1]); }
  }
  // Ett tryck på KÖP/SÄLJ – eller (ihop) på en lapp: ensam (eller som skiftledare) görs det direkt, som
  // medarbetare blir det ett önskemål till skiftledaren med det jag ser på skärmen nu.
  function press(i, typ) {
    if (done) return;
    const tk = tickets[i], seen = { id: tk ? tk.id : -1, by: tk?.by || '', p: S[i].p };
    if (medarb()) {
      if (!tk) { play('miss'); popAt(i, $t('INGEN ORDER'), '#d8d2c0'); return; }
      if (tk.by && tk.by !== meId()) { play('click'); popAt(i, $t('KOLLEGANS ORDER'), '#ffd23f'); return; }
      if (!pend) ask({ t: 'do', a: 'handla', i, typ, id: seen.id, by: seen.by, p: Math.round(seen.p * 100) / 100 });
      return;
    }
    const k = meK();
    doTrade(k, i, typ, seen);
    publish(k, false);
  }
  function claim(i) {
    const tk = tickets[i];
    if (!tk || !coop.active || done) return;   // (ensam finns inget att låsa)
    if (medarb()) {
      if (tk.by && tk.by !== meId()) { play('click'); popAt(i, $t('KOLLEGANS ORDER'), '#ffd23f'); return; }
      if (!pend) ask({ t: 'do', a: 'ta', i, id: tk.id, by: tk.by || '' });
      return;
    }
    const k = meK();
    doClaim(k, i, { id: tk.id, by: tk.by || '' });
    publish(k, false);
  }
  coop.on('snap', (m) => { if (!coop.leader) applySnap(m); });
  coop.on('res', (m) => {   // ledarens utfall: puffarna hos alla – poängen hos den det gäller
    const me = coop.myId, mine = m.by === me;
    if (coop.leader && !mine) return;   // (skiftledaren har redan visat det hos sig)
    for (const f of (Array.isArray(m.fx) ? m.fx : []).slice(0, 24)) {
      if (!Array.isArray(f)) continue;
      const who = str(f[1]);
      if (!who || who === me) doFx(f[0], f.slice(2));
    }
    if (mine && m.s) answered();
  });
  coop.on('do', (m, from) => {   // en medarbetares handling på det gemensamma – körs här, åt hen
    if (!coop.leader || !coop.settled || done) return;   // (bara den som kör handelssalen avgör)
    if (Number.isInteger(m.n)) { if (seenReq.get(from) === m.n) return; seenReq.set(from, m.n); }   // (samma önskemål igen)
    const i = int(m.i, -1);
    if (i < 0 || i > 3) return;
    const k = forK(from), seen = { id: int(m.id, -1), by: str(m.by), p: +m.p };
    if (m.a === 'handla') doTrade(k, i, m.typ === 'SÄLJ' ? 'SÄLJ' : 'KÖP', seen);
    else if (m.a === 'ta') doClaim(k, i, seen);
    else return;
    handled++;
    publish(k, true);
  });
  // en kollega går hem (passet slut): hens lappar blir lediga
  coop.on('lamna', (m, from) => { if (coop.leader) release(from); });

  // skiftledarens (och den ensammas) handelssal: kurserna, nya kunder (tätare med vanan – och ihop),
  // lappar som går ut – och läget ut till medarbetarna ~3 ggr/s
  function leadTick(dt) {
    stepPrices(dt);
    nextT -= dt;
    // (tätare mot slutet av passet; en van mäklare får fler order – P.pace, samma tid att hinna)
    if (nextT <= 0) { newTicket(); nextT = (3.2 + rnd() * 2.6 - 1.5 * Math.min(1, t / P.seconds)) * P.pace * (coop.active ? 0.5 : 1); }
    for (let i = 0; i < 4; i++) {
      const tk = tickets[i];
      if (!tk) continue;
      tk.t -= dt;
      if (tk.t <= 0) {   // kunden lägger på: missad hos den som tagit lappen (ingen tagit den: hos skiftledaren)
        const k = kOf(tk.by);
        tickets[i] = null;
        team.miss++; fx(k, k.by, 'm'); fx(k, '', 's', 'miss'); kPop(k, i, $t('KUNDEN LADE PÅ…'), '#d8d2c0', 150);
        publish(k, false);
      }
    }
    if (coop.active || maxN > 1) sweepGone();
    if (coop.active) { snapIn -= dt; if (snapIn <= 0) { snapIn = 0.35; sendSnap(); coop.sentSnap(); } }
  }

  function update(dt) {
    pops.update(dt);
    if (done) {
      coop.tick(); coop.resign();   // MITT pass är slut – lämna över ledningen direkt (även på lönebeskedet)
      doneT += dt;
      if (doneT > 1.2 && !reported) {
        reported = true;
        if (maxN > 1) {   // jobbat ihop: laget delar lika på rätt, fel och missade
          const sh = (v) => Math.round(v / maxN);
          onDone?.({ ok: sh(team.ok), fel: sh(team.fel), miss: sh(team.miss), delat: maxN, lagOk: team.ok, lagFel: team.fel });
        } else onDone?.({ ...stats });
      }
      return;
    }
    t += dt;
    if (t >= P.seconds) { done = true; play('fanfare'); pend = null; queued = null; letGo(); return; }
    if (pend) { pend.t -= dt; if (pend.t <= 0) answered(); }   // inget svar (ledaren gick?) – då får man försöka igen
    coop.tick();
    if (coop.active) maxN = Math.max(maxN, coop.peers().length + 1);
    if (coop.active !== wasCoop) {   // en kollega satte sig bredvid: kunderna ringer tätare
      wasCoop = coop.active;
      if (wasCoop) { play('knock'); pops.add(FW / 2, 60, $t('NI JOBBAR IHOP!'), '#8ee03c'); }
    }
    // Skiftledaren (eller solo) kör handelssalen; medarbetare följer ledarens läge
    const iLead = !coop.active || (coop.leader && coop.settled);
    if (iLead && !wasLead) takeOver();
    else if (!iLead && wasLead) becomeMate();
    wasLead = iLead;
    if (iLead) leadTick(dt); else mateTick(dt);
    for (const m of mates) {
      m.nextT -= dt;
      if (m.nextT <= 0) { m.nextT = 5 + rnd() * 6; m.talk.say([$t('KÖP! KÖP!'), $t('SÄLJ ALLT!'), $t('VILKEN DAG!'), $t('HALLÅ? JA, JAG HÖR!'), $t('SNABB RUSAR!'), $t('KAFFE, NÅGON?')][(rnd() * 6) | 0], { x: m.x, y: m.y - 44 }, 2); }
    }
    chairX += (seatX() - chairX) * Math.min(1, dt * 3);   // (ihop rullar stolen till min plats)
  }

  // ---------- ritning ----------
  function drawTicker(ctx) {
    const line = S.map((s) => `${$t(s.id)} ${fmtKr(s.p)} ${s.p >= s.hist[Math.max(0, s.hist.length - 25)] ? '+' : '-'}`).join('   ') + '   ';
    const w = textW(SMALL, line), off = (t * 28) % w;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 20, FW, 14); ctx.clip();
    for (let k = -1; k < Math.ceil(FW / w) + 1; k++) {
      let x = Math.round(k * w - off) + 4;
      for (const s of S) {
        const up = s.p >= s.hist[Math.max(0, s.hist.length - 25)];
        const part = `${$t(s.id)} ${fmtKr(s.p)} `;
        ctxText(ctx, SMALL, part, x, 24, '#f4d24a'); x += textW(SMALL, part) + 1;
        ctx.fillStyle = up ? '#4ae84a' : '#ff5a4a';
        if (up) { ctx.fillRect(x + 1, 24, 1, 1); ctx.fillRect(x, 25, 3, 1); ctx.fillRect(x - 1, 26, 5, 1); }
        else { ctx.fillRect(x - 1, 25, 5, 1); ctx.fillRect(x, 26, 3, 1); ctx.fillRect(x + 1, 27, 1, 1); }
        x += 16;
      }
    }
    ctx.restore();
  }
  // (ihop) får jag trycka på den här lappen? (ingen har tagit den, eller jag själv)
  const mineOrFree = (tk) => !tk.by || tk.by === meId() || !coop.active;
  function drawMonitor(ctx, i) {
    const M = MON[i], s = S[i], tk = tickets[i];
    ctx.fillStyle = '#16161c'; ctx.fillRect(M.x - 2, M.y - 2, M.w + 4, M.h + 4);
    ctx.fillStyle = '#0c1424'; ctx.fillRect(M.x, M.y, M.w, M.h);
    const up = s.p >= s.hist[Math.max(0, s.hist.length - 25)];
    ctxText(ctx, SMALL, $t(s.id), M.x + 3, M.y + 3, s.col);
    const ps = $t`${fmtKr(s.p)} KR`;
    ctxText(ctx, SMALL, ps, M.x + M.w - 3 - textW(SMALL, ps), M.y + 3, up ? '#6aee6a' : '#ff6a5a');
    // grafen
    const gx = M.x + 3, gy = M.y + 11, gw = M.w - 6, gh = 28;
    ctx.fillStyle = '#101c30'; ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = '#18263e'; for (let k = 1; k < 4; k++) ctx.fillRect(gx, gy + Math.round((gh * k) / 4), gw, 1);
    let lo = Math.min(...s.hist, tk ? tk.lim : Infinity), hi = Math.max(...s.hist, tk ? tk.lim : -Infinity);
    const pad = Math.max(0.5, (hi - lo) * 0.15); lo -= pad; hi += pad;
    const Y = (v) => gy + gh - 1 - Math.round(((v - lo) / (hi - lo)) * (gh - 2));
    if (tk) {                                                                  // kundens gräns
      const ly = Y(tk.lim), ok = good(tk);
      ctx.fillStyle = ok ? '#8ee03c' : '#f0c850';
      for (let x = gx; x < gx + gw; x += 3) ctx.fillRect(x, ly, 2, 1);
      // den gröna sidan av gränsen (där affären går)
      ctx.fillStyle = 'rgba(142,224,60,0.10)';
      if (tk.typ === 'KÖP') ctx.fillRect(gx, ly, gw, gy + gh - ly); else ctx.fillRect(gx, gy, gw, ly - gy);
    }
    ctx.fillStyle = up ? '#6aee6a' : '#ff6a5a';
    for (let k = 1; k < s.hist.length; k++) {
      const x0 = gx + Math.round(((k - 1) / (HIST - 1)) * (gw - 1)), x1 = gx + Math.round((k / (HIST - 1)) * (gw - 1));
      const y0 = Y(s.hist[k - 1]), y1 = Y(s.hist[k]);
      for (let x = x0; x <= x1; x++) { const yy = Math.round(y0 + ((y1 - y0) * (x - x0)) / Math.max(1, x1 - x0)); ctx.fillRect(x, Math.min(yy, y0, y1), 1, Math.max(1, Math.abs(y1 - y0) / Math.max(1, x1 - x0) + 1)); }
    }
    // knapparna (kollegans lapp: knappen lyser inte hos mig)
    for (const typ of [$n('KÖP'), $n('SÄLJ')]) {
      const B = BTN(i, typ), lit = tk && tk.typ === typ && good(tk) && mineOrFree(tk) && Math.floor(t * 4) % 2 === 0;
      ctx.fillStyle = typ === 'KÖP' ? (lit ? '#6aee6a' : '#2a7a3a') : (lit ? '#ff7a6a' : '#8a2a2a');
      ctx.fillRect(B.x, B.y, B.w, B.h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(B.x, B.y, B.w, 1);
      ctxText(ctx, SMALL, $t(typ), B.x + ((B.w - textW(SMALL, $t(typ))) >> 1), B.y + 2, '#f4f6fa');
    }
  }
  function drawTicket(ctx, i) {
    const tk = tickets[i]; if (!tk) return;
    const R = TICK(i), k = clamp(tk.t / tk.dur, 0, 1), fresh = t - tk.born < 0.4;
    const y = R.y + (fresh ? Math.round((1 - (t - tk.born) / 0.4) * -8) : 0);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(R.x + 1, y + 1, R.w, R.h);
    ctx.fillStyle = tk.typ === 'KÖP' ? '#f8f0a0' : '#f8c8b8'; ctx.fillRect(R.x, y, R.w, R.h);
    ctx.fillStyle = tk.typ === 'KÖP' ? '#2a7a3a' : '#8a2a2a'; ctx.fillRect(R.x, y, 3, R.h);
    ctxText(ctx, SMALL, `${$t(tk.typ)} ${tk.n} ${$t(S[i].id)}`, R.x + 6, y + 2, '#1a1a24');
    ctxText(ctx, SMALL, tk.typ === 'KÖP' ? $t`UNDER ${fmtKr(tk.lim)} KR` : $t`ÖVER ${fmtKr(tk.lim)} KR`, R.x + 6, y + 9, good(tk) ? '#1f7a2a' : '#6a2a2a');
    // (ihop) tagen lapp: ram i mäklarens färg och namnet nere till höger (DIN = min)
    let bw = R.w - 10;
    if (tk.by && coop.active) {
      const mine = tk.by === meId(), f = mine ? null : coop.peers().find((q) => q.id === tk.by);
      const col = mine ? A.avatar?.color || '#3a7bd5' : f?.av?.color || '#8a8e98';
      const nm = mine ? $t('DIN') : String(f?.av?.name || '...').toUpperCase().slice(0, 6), nw = textW(SMALL, nm);
      ctx.fillStyle = col;
      ctx.fillRect(R.x - 1, y - 1, R.w + 2, 1); ctx.fillRect(R.x - 1, y + R.h, R.w + 2, 1); ctx.fillRect(R.x - 1, y, 1, R.h); ctx.fillRect(R.x + R.w, y, 1, R.h);
      ctxText(ctx, SMALL, nm, R.x + R.w - 3 - nw, y + 15, '#1a1a24');
      bw = Math.max(8, R.w - 10 - nw - 4);
    }
    ctx.fillStyle = '#c8c0a0'; ctx.fillRect(R.x + 6, y + R.h - 4, bw, 2);
    ctx.fillStyle = k < 0.3 ? '#d83a3a' : '#3a6ad8'; ctx.fillRect(R.x + 6, y + R.h - 4, Math.round(bw * k), 2);
  }
  // stolen och mäklaren vid desken (ryggen mot oss)
  function drawSeat(ctx, x, look) {
    x = Math.round(x);
    ctx.fillStyle = '#1a1a20'; ctx.fillRect(x - 12, 190, 24, 18); ctx.fillStyle = '#2a2a34'; ctx.fillRect(x - 11, 191, 22, 16);
    if (look) drawPerson(ctx, x, 214, look, 'up', 5);
  }

  const api = {
    get worldX() { return Math.round(chairX); },
    get worldY() { return 212; },
    update,
    exit() { coop.dispose(); },
    down(x, y) {
      if (done) return;
      if (pend) { queued = [x, y]; return; }   // väntar på skiftledarens svar – trycket tas strax
      for (let i = 0; i < 4; i++) for (const typ of ['KÖP', 'SÄLJ']) {
        const B = BTN(i, typ);
        if (x >= B.x - 1 && x <= B.x + B.w + 1 && y >= B.y - 1 && y <= B.y + B.h + 1) { press(i, typ); return; }
      }
      // ihop: klick på en lapp = ta ordern (kollegan tar en annan) – klickar man på sin egen släpps den
      if (coop.active) for (let i = 0; i < 4; i++) {
        const R = TICK(i);
        if (tickets[i] && x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h) { claim(i); return; }
      }
    },
    key(k) { if (k === 'Escape' && !done) abortShift(A); },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(paintBg(), 0, 0);
      drawTicker(ctx);
      for (const m of mates) drawPerson(ctx, m.x, m.y, m.look, 'down', Math.sin(t * 2 + m.x) > 0.8 ? 6 : 5);
      for (let i = 0; i < 4; i++) drawMonitor(ctx, i);
      for (let i = 0; i < 4; i++) drawTicket(ctx, i);
      // jag vid desken (ryggen mot oss) och stolen – ihop sitter kollegorna bredvid
      if (coop.active) for (const f of coop.peers()) drawSeat(ctx, f.x, f.av?.look);
      drawSeat(ctx, chairX, meLook);
      for (const m of mates) m.talk.draw(ctx, { x0: 0, x1: FW });
      pops.draw(ctx);
      drawShiftHud(ctx, A, { t, dur: P.seconds, ok: maxN > 1 ? team.ok : stats.ok, fel: maxN > 1 ? team.fel : stats.fel, title: $t`${hudTitle()} - ${maxN > 1 ? team.ok : stats.ok} AFFÄRER` });
      if (done) drawTimeUp(ctx, A);
    },
    _debug: {
      stats,
      state: () => ({ t: +t.toFixed(2), done, stats: { ...stats }, tickets: tickets.map((k) => (k ? { typ: k.typ, lim: k.lim, t: +k.t.toFixed(1), good: good(k) } : null)), prices: S.map((s) => +s.p.toFixed(2)) }),
      stocks: () => S.map((s) => ({ id: s.id, p: +s.p.toFixed(2) })),
      tickets: () => tickets.map((k) => (k ? { id: k.id, i: k.i, typ: k.typ, lim: k.lim, good: good(k), by: k.by || null } : null)),
      // lägg en order (skiftledaren/solo – hos en medarbetare null)
      force: (i, typ, lim) => { if (medarb()) return null; tickets[i] = null; return newTicket(i, typ, lim); },
      setPrice: (i, p) => { if (medarb()) return; S[i].p = p; S[i].vel = 0; snapAsap(); },
      trade: (i, typ) => { press(i, typ); return { ...stats }; },
      spot: (i, typ) => { if (typ === 'LAPP') { const R = TICK(i); return { x: R.x + (R.w >> 1), y: R.y + (R.h >> 1) }; } const B = BTN(i, typ); return { x: B.x + (B.w >> 1), y: B.y + (B.h >> 1) }; },
      tick: (sec) => { for (let k = 0; k < sec * 30; k++) update(1 / 30); },
      finish: () => { t = P.seconds - 0.01; update(0.02); for (let k = 0; k < 60; k++) update(0.05); },
      // ---------- jobba tillsammans (tools/coop-finans-test.mjs) ----------
      coop: () => ({ leader: coop.leader, active: coop.active, mates: coop.peers().length, settled: coop.settled, myId: coop.myId }),
      lag: () => ({ ...team, maxN }),
      title: () => hudTitle(),
      // ta lappen på skärm i (som ett klick på den) – vem som har den nu
      claim: (i) => { claim(i); return tickets[i]?.by || null; },
      // kurserna står still (skiftledaren/solo) – och inga nya kunder
      still: (on = true) => { still = !!on; if (still) for (const s of S) s.vel = 0; snapAsap(); return still; },
      calm: () => { if (medarb()) return null; nextT = 1e9; tickets.fill(null); snapAsap(); return 0; },
      // kunden på skärm i lägger på nästan direkt (skiftledaren/solo)
      expire: (i) => { if (medarb() || !tickets[i]) return false; tickets[i].t = 0.05; return true; },
      auto: (on = true) => { nextT = on ? 0.3 : 1e9; return on; },
      // provet: medarbetaren skickar SAMMA KÖP/SÄLJ två gånger (som om svaret dröjde) – görs EN gång
      tradeTwice: (i, typ) => {
        const tk = tickets[i];
        if (!medarb() || pend || !tk) return false;
        ask({ t: 'do', a: 'handla', i, typ, id: tk.id, by: tk.by || '', p: Math.round(S[i].p * 100) / 100 }, 2);
        return true;
      },
      handled: () => handled,   // (skiftledaren) hur många önskemål som körts
      seat: () => Math.round(chairX),
      idle: () => !pend && !queued,
      pending: () => !!pend,
      time: () => t,
      pops: () => popLog.slice(),
    },
  };
  return api;
}
