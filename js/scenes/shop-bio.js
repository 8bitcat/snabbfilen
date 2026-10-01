// BIO PIXEL INNE – biografen på Söder man går in i från staden (samma hus som fasaden med
// den lodräta BIO-neonen och ljusskylten, js/city/buildings-south.js). Två rum i samma scen:
//
//   FOAJÉN: skjutdörrarna ut, affischerna för kvällens sex filmer i guldramar, BILJETTLUCKAN
//     där kassörskan Greta sitter bakom glaset, POPCORN-baren med popcornmaskinen som poppar
//     och godisväggen (Kevin fyller bägarna), rundsoffan med palmen, kartongfiguren av
//     PIXELHÄMNAREN och dörrarna in till SALONG 1 där platsvakten Harald river biljetterna.
//     Andra biobesökare kommer in, köar till luckan, köper popcorn och går in i salongen.
//   SALONGEN: duken i guldram med sammetsridå, fem röda stolsrader i trappsteg, steglampor,
//     UTGÅNG och NÖDUTGÅNG. Publiken sitter redan där och äter popcorn och pratar.
//
// FLÖDET: köp biljett i luckan (BIO_PRIS.biljett = 90 kr, film valfri, sista biljetten
// 21:30) → ev. popcorn i baren (35 kr) → visa biljetten för platsvakten → sätt dig på en
// ledig plats → ljuset släcks, ridån går upp och filmen går på duken (egen animation per
// film, ~32 s) medan klockan går 2 speltimmar → eftertexter, ljuset tänds →
// +BIO_EFFEKT.energi. Publiken skrattar, gråter, ropar OJ och applåderar när filmen säger till.
//
// ÄTREGELN (som i alla matställen): popcornen äts sittande, tugga för tugga (salongen eller
// soffan i foajén). Med popcorn kvar – eller medan Kevin fyller den betalda bägaren – kommer
// man inte ut genom skjutdörrarna ("DU MÅSTE SÄTTA DIG OCH ÄTA UPP!"), och sitter man och äter
// reser man sig inte förrän bägaren är tom ("ÄT UPP FÖRST!"). leaveBlock() säger till
// huvudprogrammets knappar. Byts scenen ändå (midnatt, 👥-menyn, omladdning) räknas resten av
// popcornen in – betald mat går aldrig förlorad – och en oanvänd biljett lämnas tillbaka. Går
// man mitt i filmen får man så mycket energi som man hann se (popcornen äter man då upp först).
// Läggs sidan bara undan (mobilen låses) räknas allt in provisoriskt och tas tillbaka när man
// kommer tillbaka – filmen fortsätter och belönas helt (se "sidan läggs undan" nedan).
//
// KVÄLLEN: sista biljetten 21:30, en visning slutar senast 23:30 (sätter man sig sent kommer
// man in när filmen redan har börjat) och börjar inte alls efter 23:00 – då blir biljetten
// pengar igen. Godisbaren stänger 23:30. Ingen visning kör alltså in i midnattskollapsen.
//
// MOBILEN (fyll-läget beskär över- och nederkant, A.view.safe): kameran följer figuren i
// höjdled, sitter man i salongen under filmen ligger hela duken i bild, och alla pratbubblor
// hålls inom den synliga remsan.
import { Pix, SMALL, textW, ctxText, mix, hash, bayer } from '../core/floor-pix.js';
import { drawPerson, makeLook } from '../core/people.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { fmt, clock, SAVE_KEY } from '../game.js';
import { play } from '../core/sound.js';
import { createWalker, selfDrawable, WALK_SEQ, sayBubble, sayLines, createSpeech, nameTag } from './walkable.js';
import * as WORLD from '../net/world.js';
import * as MAP from '../city/map.js';
import { FILMER, filmById, drawFilm, filmLight, filmCues, filmMusicAt, filmAmbAt, filmSfxBetween, posterCanvas, FW as FILM_W, FH as FILM_H } from './bio/film.js';
import { filmMusic } from './bio/filmmusik.js';
import { filmSfx, filmAmb } from './bio/filmljud.js';
import {
  W, H, F, S, SEAT_XS, paintFoaje, paintBoothFront, paintCounter, paintSalonDoors, paintSofa, paintStandee, paintEasel,
  paintPalm, paintBin, paintPost, paintKlo, bucketImg, drawSlideDoors, paintSalong, paintSeatRow, drawCurtain,
} from './bio/paint.js';

// ================= priser, effekter och öppettider =================
export const BIO_PRIS = { biljett: 90, popcorn: 35 };
// Förslag på värden: en film = 2 speltimmar i en mjuk biofåtölj → +15 energi (lika mycket
// som en burgare + läsk). Spelet har ingen humörmätare än: humor = förslaget (+20) om en
// sådan läggs till – tills dess syns glädjen i pratbubblan efter filmen.
// Popcornen: +14 mättnad (2 per tugga, 7 tuggor) och +2 energi när bägaren är tom.
export const BIO_EFFEKT = { minuter: 120, energi: 15, humor: 20, popcornMatt: 14, popcornEnergi: 2, tuggor: 7 };
export const BIO_OPEN = [12, 24];
export const SISTA_BILJETT = 21.5;                    // sista biljetten 21:30 → filmen slutar 23:30
export const SISTA_POPCORN = 23.5;                    // godisbaren stänger 23:30
export const SLUT_SENAST = 23 * 60 + 30;              // en visning slutar senast 23:30 …
export const MIN_VISNING = 30;                        // … och börjar bara om minst 30 min återstår
const CITY_BIO = (() => { try { return MAP.buildingById?.('bio') || null; } catch { return null; } })();
export const HOURS = Array.isArray(CITY_BIO?.open) && CITY_BIO.open.length === 2 ? CITY_BIO.open : BIO_OPEN;
const DIM = 2.6, CRED = 4.5, LJUS = 2.4;              // ljuset släcks · eftertexter · ljuset tänds (sekunder)
const MSG_ATUPP = 'ÄT UPP FÖRST! 😋';
const MSG_DORR = 'DU MÅSTE SÄTTA DIG OCH ÄTA UPP!';
const MSG_VANTA = 'VÄNTA – KEVIN FYLLER DIN POPCORNBÄGARE!';
const SAY_W = 76;                                     // walkable.js: sayBubble() utan w
const SALONG_DY = 300;                                // salongen ligger 300 px "nedanför" foajén för världen
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const c100 = (v) => clamp(v, 0, 100);
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
function rngOf(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

// ================= personalen =================
const GRETA = { skin: '#f2cca6', hair: '#3a2418', style: 'bun', top: 'jacket', shirt: '#8a2a3a', accent: '#c8a44a', bottom: 'skirt', pants: '#5a1c28', shoes: '#1c1c1c', hat: 'cap', cap: '#8a2a3a', build: 4, blush: true, glasses: false, beard: false, phones: false, bag: null, kid: false };
const KEVIN = { skin: '#e0a97f', hair: '#a5692f', style: 'short', top: 'tee', shirt: '#c8262e', accent: '#f4f1ea', bottom: 'pants', pants: '#2b2b30', shoes: '#1c1c1c', hat: 'cap', cap: '#c8262e', apron: true, build: 5, glasses: false, beard: false, phones: false, bag: null, kid: false };
const HARALD = { skin: '#c68a5c', hair: '#b9b3ab', style: 'short', beard: 'mustache', top: 'suit', shirt: '#5a1c28', accent: '#c8a44a', bottom: 'pants', pants: '#2b2b30', shoes: '#1c1c1c', hat: 'cap', cap: '#5a1c28', glasses: 'round', build: 6, phones: false, bag: null, kid: false };

// publikens repliker
const PRAT = ['VAD SKA VI SE?', 'JAG HAR HÖRT ATT DEN ÄR JÄTTEBRA!', 'SKICKA POPCORNEN!', 'STÄNG AV MOBILEN NU.', 'BÄSTA PLATSERNA I HUSET!', 'JAG HAR SETT DEN TRE GÅNGER.', 'SITT STILL, DU SPARKAR PÅ STOLEN!', 'NU SLÄCKS DET SNART!', 'HAR DU TAGIT MED NÄSDUKAR?'];
const REACT = {
  skratt: ['HAHA!', 'HIHI!', '😂', 'HA HA HA!', 'HAHAHA!', '🤣'],
  grat: ['😢', 'SNYFT...', '😭', 'SÅ FINT...', 'BUHU!', '🥲'],
  oj: ['OJ!', '😱', 'WOW!', 'OOOH!', 'AKTA!', '😮'],
  aww: ['AWW!', '😍', '❤️', 'ÅÅH...', 'GULLIGT!', '🥰'],
  heja: ['JAAA!', 'HEJA!', '👏', 'YES!', 'SNYGGT!', '🙌'],
};
const EFTERAT = ['VILKEN FILM!', 'BRAVO!', '👏', 'DEN BÄSTA I ÅR!', 'JAG VILL SE DEN IGEN!', 'NU ÄR JAG HUNGRIG.'];
const FOLK_KASSA = ['TVÅ BILJETTER, TACK!', 'EN TILL PIXELHÄMNAREN!', 'FINNS DET PLATSER KVAR?', 'EN VUXEN OCH ETT BARN.'];
const FOLK_BAR = ['EN STOR POPCORN!', 'EXTRA SMÖR, TACK!', 'OCH EN LÄSK!', 'LÖSGODIS FÖR 20 KRONOR.'];
// eftertexterna per film (namnen är påhittade)
const ROLLER = {
  hamnaren: [['PIXELHÄMNAREN', 'KALLE KANT'], ['DOKTOR GLITCH', 'SVEN SPRITE']],
  karlek: [['NORA', 'ELSA ÅHLÉN'], ['LEO', 'NOAH LJUNG']],
  turbo: [['FÖRAREN', 'MAJA MOTOR'], ['POLISEN', 'IVAN BLÅLJUS']],
  sommar: [['UNGEN', 'SAGA SOL'], ['GLASSFARBROR', 'GUNNAR KULA'], ['HUNDEN', 'VOFF']],
  nattbuss: [['SPRINGAREN', 'YUSUF RUSH'], ['FÖRAREN', 'BOSSE RATT'], ['KATTEN', 'SIG SJÄLV']],
  amore: [['SOFIA', 'SOFIA ROSSI'], ['MARCO', 'MATEO VERDI'], ['SERVITÖREN', 'LUIGI']],
};

// ================= platser i foajén och salongen =================
const DOOR_SPOT = [(F.DOOR.x0 + F.DOOR.x1) >> 1, F.WALL_Y + 7];
const LUCKA_SPOT = [168, F.WALL_Y + 12];
const BAR_SPOT = [316, F.CNT.y + 10];
const SD_SPOT = [(F.SD.x0 + F.SD.x1) >> 1, F.WALL_Y + 7];
const SDOOR_SPOT = [(S.DOOR.x0 + S.DOOR.x1) >> 1, S.WALL_Y + 6];
const QPOS = [[168, 110], [168, 120], [168, 130], [176, 142]];

export function makeShopBio(A, opts = {}) {
  const g = A.game;
  let t = 0, rum = 'foaje', lockedCam = null, hoverId = null, hoverT = -9, VW = 384;
  const syncView = () => { VW = Math.max(384, Math.min(A.W || 384, W)); };
  syncView();
  const hour = () => g.min / 60;
  const isOpen = () => hour() >= HOURS[0] && hour() < HOURS[1];
  const ticketsOpen = () => isOpen() && hour() < SISTA_BILJETT;
  const popOpen = () => isOpen() && hour() < SISTA_POPCORN;
  const isNight = () => hour() >= 19.5 || hour() < 6.5;

  const talk = createSpeech(), talkKass = createSpeech(), talkGodis = createSpeech(), talkVakt = createSpeech();

  // ---------- den synliga remsan (fyll-läget på mobilen) ----------
  // A.view.safe = den del av 384×216-rutan som syns. På mobilen i NÄRA skärs ~55 rader bort
  // upptill och ~24 nedtill. Kameran flyttar då rummet i höjdled (cam.y, se camYTarget) och
  // pratbubblorna kläms in i remsan medan de ritas (clampOn) – rösten hör till den riktiga
  // platsen. Utan beskärning (datorn, ram/vid, testrobotarna) är cam.y alltid 0.
  const safeY = () => {
    const s = A.view?.safe, y0 = Math.max(0, s?.y0 | 0), y1 = Math.min(H, s?.y1 ?? H);
    return y1 - y0 < 60 ? [0, H] : [y0, y1];
  };
  let clampOn = false, visX0 = 0, visX1 = 384;
  function capY(pos, text, w, n) {
    if (!clampOn || !pos) return pos;
    const [y0, y1] = safeY(), cy = Math.round(cam.y);
    const h = sayLines(String(text || ''), w, n).reduce((a, l) => a + (l.some((q) => q.emoji) ? 10 : 7), 0) + 4;
    return { x: pos.x, y: clamp(pos.y, y0 - cy + h + 6, y1 - cy - 1) };   // ramen överst och spetsen nederst i bild
  }

  // ---------- bilderna ----------
  const cache = {};
  const bgF = () => { const k = 'f' + isNight(); return (cache[k] ||= paintFoaje(isNight())); };
  const bgS = () => (cache.s ||= paintSalong());
  const booth = paintBoothFront(), counter = paintCounter(), sdFrames = paintSalonDoors(), sofa = paintSofa();
  const standee = paintStandee(), palm = paintPalm(), bin = paintBin(), post = paintPost(), klo = paintKlo();
  // affischerna som inte får plats på väggen (de två fotbollsfilmerna) står på staffli
  const EASEL_FILMS = FILMER.slice(F.POSTERS.length);
  const easels = F.EASELS.slice(0, EASEL_FILMS.length).map((_, i) => paintEasel(EASEL_FILMS[i].id));
  const rowImgs = S.ROW_Y.map((_, k) => paintSeatRow(k));

  // ---------- hinder och gång ----------
  const obstF = [
    [F.CNT.x0 - 1, F.WALL_Y, F.CNT.x1 + 1, F.CNT.y + 1],
    [F.ROPE.xl - 2, F.ROPE.y0 - 3, F.ROPE.xl + 2, F.ROPE.y1 + 1], [F.ROPE.xr - 2, F.ROPE.y0 - 3, F.ROPE.xr + 2, F.ROPE.y1 + 1],
    [F.SOFA.x - 42, F.SOFA.y - 24, F.SOFA.x + 42, F.SOFA.y - 3],
    [F.KLO.x - 13, F.KLO.y - 5, F.KLO.x + 13, F.KLO.y + 1],
    [F.STANDEE.x - 11, F.STANDEE.y - 4, F.STANDEE.x + 11, F.STANDEE.y + 1],
    ...F.EASELS.slice(0, EASEL_FILMS.length).map(([x, y]) => [x - 14, y - 3, x + 14, y + 1]),
    [F.BIN.x - 6, F.BIN.y - 4, F.BIN.x + 6, F.BIN.y + 1],
    ...F.PALMS.map(([x, y]) => [x - 7, y - 4, x + 7, y + 1]),
    [F.USHER.x - 5, F.USHER.y - 4, F.USHER.x + 5, F.USHER.y + 1],
  ];
  const obstS = [];
  for (const y of S.ROW_Y) for (const [x0, n] of S.BLOCKS) obstS.push([x0 - 9, y - 5, x0 + (n - 1) * S.PITCH + 9, y + 2]);
  const mkF = (spawn) => { const w = createWalker({ W, H, left: 8, right: W - 8, top: F.WALL_Y + 3, bottom: H - 5, spawn }); w.setObstacles(obstF); return w; };
  const mkS = (spawn) => { const w = createWalker({ W, H, left: 10, right: W - 10, top: S.WALL_Y + 2, bottom: H - 2, spawn }); w.setObstacles(obstS); return w; };
  const wF = mkF([DOOR_SPOT[0], DOOR_SPOT[1] + 6]), wS = mkS(SDOOR_SPOT);
  let walker = wF;

  // ---------- sittplatserna ----------
  const seats = [];
  S.ROW_Y.forEach((y, k) => SEAT_XS.forEach((x, i) => seats.push({ id: `r${k + 1}p${i + 1}`, kind: 'salong', row: k, x, y, ax: x, ay: y - 10, dir: 'up', occ: null })));
  const sofaSeats = [[-26, 0], [0, 2], [26, 0]].map(([dx, dy], i) => ({ id: 'soffa' + i, kind: 'soffa', x: F.SOFA.x + dx, y: F.SOFA.y + dy, ax: F.SOFA.x + dx, ay: F.SOFA.y + dy + 10, dir: 'down', occ: null }));
  for (const s of sofaSeats) [s.ax, s.ay] = wF.nearestFree(s.ax, s.ay);
  const seatById = (id) => seats.find((s) => s.id === id) || sofaSeats.find((s) => s.id === id) || null;
  const roomSeats = () => (rum === 'salong' ? seats : sofaSeats);

  // ---------- figuren (jag) ----------
  // state: free · toCounter · waitPop · carry (popcorn i händerna) · sit
  // biljett = film-id för en oanvänd biljett; pop = { left, total } popcorn kvar i bägaren
  // order = popcorn som är betald men som Kevin fortfarande fyller (settled = redan inräknad)
  const me = { state: 'free', seat: null, res: null, biljett: null, pop: null, order: null, eating: 0, biteT: 0, sitT: 0, slide: null, msgT: -9, ursaktT: -9, sett: [], reward: null };
  const meAt = () => capY({ x: me.seat ? me.seat.x : walker.px, y: (me.seat ? me.seat.y : walker.py) - 44 }, talk.text(), 124, 5);
  function nag(text) {
    if (talk.text() === text) return;
    talk.say(text, meAt, 2.8);
    play('fel');
  }
  const kassAt = () => capY({ x: F.KASS.x, y: F.KASS.y - 42 }, talkKass.text(), 124, 5);
  const godisAt = () => capY({ x: godis.x, y: F.GODIS_Y - 44 }, talkGodis.text(), 124, 5);
  const vaktAt = () => capY({ x: F.USHER.x, y: F.USHER.y - 44 }, talkVakt.text(), 124, 5);

  // popcornen: varje tugga ger sin del av mättnaden, sista tuggan energin
  const perBite = () => BIO_EFFEKT.popcornMatt / BIO_EFFEKT.tuggor;
  function bite() {
    const p = me.pop;
    if (!p || p.left <= 0) return;
    p.left--;
    if (!p.settled) g.hunger = c100(g.hunger + perBite());
    me.eating = 0.6;
    if (p.left <= 0) {
      if (!p.settled) g.energy = c100(g.energy + BIO_EFFEKT.popcornEnergi);
      p.doneT = t;
      g.save();
      play('ok');
    }
  }
  // det som ännu inte ätits av betald popcorn: resten av bägaren – eller hela bägaren som
  // Kevin fortfarande fyller. obj = det som märks settled när det räknas in.
  function popOwed() {
    const p = me.pop;
    if (p && !p.settled && p.left > 0) return { obj: p, h: perBite() * p.left, e: BIO_EFFEKT.popcornEnergi };
    if (!p && me.order && !me.order.settled) return { obj: me.order, h: BIO_EFFEKT.popcornMatt, e: BIO_EFFEKT.popcornEnergi };
    return null;
  }
  // resten av popcornen räknas in (scenbyte, omladdning, gå mitt i filmen) – exakt en gång
  function settlePop() {
    const o = popOwed();
    if (!o) return false;
    g.hunger = c100(g.hunger + o.h);
    g.energy = c100(g.energy + o.e);
    o.obj.settled = true;
    return true;
  }
  function refundTicket(silent = false, why = '') {
    if (!me.biljett) return false;
    g.money += BIO_PRIS.biljett;
    me.biljett = null;
    g.save();
    if (!silent) { play('coin'); talk.say(`🎟️ ${why}Biljetten lämnades tillbaka – ${fmt(BIO_PRIS.biljett)} tillbaka i plånboken.`, meAt, 4); }
    return true;
  }
  const showEnergy = (frac) => (show ? Math.round(BIO_EFFEKT.energi * (show.minEff / BIO_EFFEKT.minuter) * frac) : 0);

  // ---------- sidan läggs undan eller stängs ----------
  // Fliken göms (mobilen låses, ett sms kommer, man byter app): allt som står på spel räknas
  // in PROVISORISKT och sparas – biljetten som pengar, resten av popcornen, energin för det
  // man hittills sett – så att inget går förlorat om mobilen stänger sidan i bakgrunden.
  // Scenen står still så länge. Kommer man tillbaka tas det provisoriska bort (exakt det som
  // lades till) och allt fortsätter: biljetten finns kvar och filmen belönas helt när den är slut.
  // Laddas sidan om (ny version, 'sf:before-reload') eller stängs den på riktigt ('pagehide'
  // utan bfcache) räknas allt in på riktigt. Menyns figurbyte/omstart/återställning byter eller
  // tömmer sparningen precis före omladdningen (och märker det i sessionStorage) – den skrivs
  // aldrig över (samma kontroll som i mataffären, shop-mat.js).
  let prov = null;                                        // { dm, dh, de, marks }
  function saveIsOurs() {
    try { if (sessionStorage.getItem('sf_menu_skip') || sessionStorage.getItem('sf_restored')) return false; } catch { /* ingen sessionStorage: kolla sparningen */ }
    try {
      const p = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return !!p && (p.day | 0) === (g.day | 0) && p.home === g.home;
    } catch { return false; }
  }
  function provisional() {
    if (prov || !saveIsOurs()) return;
    const m0 = g.money, h0 = g.hunger, e0 = g.energy, marks = [];
    const o = popOwed();
    if (o) { g.hunger = c100(g.hunger + o.h); g.energy = c100(g.energy + o.e); o.obj.settled = true; marks.push(o.obj); }
    if (me.biljett) g.money += BIO_PRIS.biljett;
    if (show && !show.given) g.energy = c100(g.energy + showEnergy(Math.min(1, show.t / show.total)));
    prov = { dm: g.money - m0, dh: g.hunger - h0, de: g.energy - e0, marks };
    try { g.save(); } catch { /* sparas ändå regelbundet */ }
  }
  function undoProvisional(save = true) {
    if (!prov) return;
    const p = prov;
    prov = null;
    g.money -= p.dm;
    g.hunger = c100(g.hunger - p.dh);
    g.energy = c100(g.energy - p.de);
    for (const o of p.marks) o.settled = false;
    if (save) { try { g.save(); } catch { /* sparas ändå regelbundet */ } }
  }
  // allt räknas in på riktigt: popcornen, biljetten tillbaka, energin för det man sett
  function settleAll() {
    undoProvisional(false);
    let any = settlePop();
    if (me.biljett) { g.money += BIO_PRIS.biljett; me.biljett = null; any = true; }
    if (show && !show.given) { giveReward(Math.min(1, show.t / show.total), true); any = true; }
    return any;
  }
  function onPage(e) {
    if (e.type === 'visibilitychange') { if (document.visibilityState === 'hidden') provisional(); else undoProvisional(); return; }
    if (e.type === 'pageshow') { if (e.persisted) undoProvisional(); return; }
    if (e.type === 'pagehide' && e.persisted) { provisional(); return; }        // bfcache: sidan kan komma tillbaka
    if (e.type === 'pagehide' && !saveIsOurs()) return;
    if (settleAll()) { try { g.save(); } catch { /* sparas ändå regelbundet */ } }
  }
  // capture: körs före menyns speglingslyssnare (menu.js), så att speglingen får med allt
  const UNLOAD = [[window, 'sf:before-reload'], [window, 'pagehide'], [window, 'pageshow'], [document, 'visibilitychange']];
  for (const [el, ev] of UNLOAD) el.addEventListener(ev, onPage, true);

  // ---------- sitta ----------
  function release() { if (me.res && me.res.occ === 'me' && me.res !== me.seat) me.res.occ = null; me.res = null; }
  function standUp() {
    if (!me.seat) return;
    const s = me.seat;
    s.occ = null; me.seat = null; me.slide = null;
    walker.px = s.ax; walker.py = s.ay; walker.stop();
    me.state = me.pop ? 'carry' : 'free';
  }
  function sitDown(s) {
    s.occ = 'me'; me.seat = s; me.res = null; me.sitT = 0; me.biteT = 0.9;
    me.slide = { fx: walker.px, fy: walker.py, k: 0 };
    me.state = 'sit';
    walker.stop();
    play('click');
    if (s.kind === 'salong') startShowIfTicket();
  }
  function goSit(s) {
    release();
    me.res = s;
    walker.walkTo(s.ax, s.ay, () => {
      if (s.occ && s.occ !== 'me') {
        me.state = me.pop ? 'carry' : 'free';
        talk.say('😕 Där sitter någon redan!', meAt);
        return;
      }
      sitDown(s);
    });
    if (!me.seat) s.occ = 'me';
  }

  // ---------- köpen ----------
  function buyTicket(id) {
    const film = filmById(id);
    if (!film) return { ok: false, msg: 'Den filmen går inte här.' };
    if (!isOpen()) return { ok: false, msg: `Luckan är stängd – bion öppnar ${clock(HOURS[0] * 60)}.` };
    if (!ticketsOpen()) return { ok: false, msg: 'Kvällens sista föreställning har redan börjat – välkommen åter i morgon!' };
    if (me.biljett === id) return { ok: false, msg: 'Den biljetten har du redan!' };
    if (me.biljett) { me.biljett = id; kass.handT = t; play('click'); return { ok: true, byte: true, film }; }   // byta film kostar inget
    if (g.money < BIO_PRIS.biljett) return { ok: false, msg: 'Du har inte råd – en biljett kostar 90 kr.' };
    g.money -= BIO_PRIS.biljett;
    g.passTime(5);
    g.save();
    me.biljett = id;
    kass.handT = t;
    play('coin');
    return { ok: true, film };
  }
  function buyPopcorn() {
    if (!isOpen()) return { ok: false, msg: 'Godisbaren är stängd.' };
    if (!popOpen()) return { ok: false, msg: `Godisbaren har stängt för i kväll (${clock(SISTA_POPCORN * 60)}).` };
    if (me.pop) return { ok: false, msg: 'Ät upp popcornen du har först!' };
    if (me.order || me.state === 'waitPop') return { ok: false, msg: 'Kevin fyller redan din bägare!' };
    if (g.money < BIO_PRIS.popcorn) return { ok: false, msg: 'Du har inte råd med popcorn.' };
    if (me.state === 'sit') standUp();
    release();
    g.money -= BIO_PRIS.popcorn;
    me.order = { settled: false };                        // betald – räknas in även om Kevin inte hinner fram
    g.passTime(5);
    g.save();
    play('coin');
    me.state = 'waitPop';
    godis.order = { t };
    if (Math.hypot(walker.px - BAR_SPOT[0], walker.py - BAR_SPOT[1]) > 12) walker.walkTo(...BAR_SPOT);
    talkGodis.say('🍿 En stor popcorn, kommer strax!', godisAt);
    return { ok: true };
  }

  // ---------- biljettluckan ----------
  function openBiljett() {
    if (!isOpen()) { talk.say(`🔒 Luckan är stängd – bion öppnar ${clock(HOURS[0] * 60)}.`, meAt); play('fel'); return; }
    if (!ticketsOpen()) { talkKass.say('Kvällens sista föreställning har redan börjat – välkommen åter i morgon!', kassAt); play('fel'); return; }
    const har = me.biljett ? filmById(me.biljett) : null;
    const rows = FILMER.map((f, i) => `<div class="prow" style="grid-template-columns:60px 1fr auto;${har?.id === f.id ? 'background:#fff4c8' : ''}">
        <canvas data-po="${i}" width="26" height="36" style="width:52px;height:72px;image-rendering:pixelated;border:2px solid #c8a44a"></canvas>
        <span class="nm"><b>${esc(f.titel)}</b><br><small class="sp">${esc(f.genre)} · ${esc(f.alder)} · 2 tim</small><br><small>${esc(f.blurb)}</small></span>
        <button class="btn btn-small btn-go" data-film="${f.id}" data-key="${i + 1}" ${!har && g.money < BIO_PRIS.biljett ? 'disabled' : ''}>${har ? (har.id === f.id ? '✓ Din' : '🔁 Byt') : `🎟️ ${fmt(BIO_PRIS.biljett)}`} <kbd>${i + 1}</kbd></button>
      </div>`).join('');
    const body = `<p style="font-size:var(--f2);margin:0 0 8px">💰 <b>${fmt(g.money)}</b> · ⚡ Energi <b>${Math.round(g.energy)}</b>/100 · 🕒 ${clock(g.min)}</p>
      ${har ? `<p style="font-size:var(--f2);margin:0 0 8px">🎟️ Du har en biljett till <b>${esc(har.titel)}</b> – byta film kostar inget.</p>` : ''}
      <div class="plist">${rows}</div>
      <p style="font-size:var(--f1);margin:10px 0 0;color:#6d6660">Filmen börjar när du satt dig i salongen och tar 2 timmar. Efteråt är du utvilad: +${BIO_EFFEKT.energi} energi. Sista biljetten säljs ${clock(SISTA_BILJETT * 60)}.</p>`;
    const dlg = openModal('🎟️ Biljettluckan – BIO PIXEL', body, [{ label: 'Nej tack', onClick: closeModal }]);
    dlg.querySelectorAll('canvas[data-po]').forEach((cv) => { const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(posterCanvas(FILMER[+cv.dataset.po].id), 0, 0); });
    dlg.querySelectorAll('[data-film]').forEach((b) => (b.onclick = () => {
      const r = buyTicket(b.dataset.film);
      closeModal();
      if (!r.ok) { talkKass.say('😳 ' + r.msg, kassAt); play('fel'); return; }
      talkKass.say(r.byte ? `Visst! Nu gäller den ${r.film.titel}.` : `Varsågod – ${r.film.titel}, salong 1! Sätt dig var du vill.`, kassAt);
    }));
  }
  // ---------- popcornbaren ----------
  function openPopcorn() {
    if (!isOpen()) { talk.say('🔒 Godisbaren är stängd.', meAt); play('fel'); return; }
    if (!popOpen()) { talkGodis.say(`Tyvärr, vi har stängt baren för i kväll (${clock(SISTA_POPCORN * 60)}). Välkommen åter!`, godisAt); play('fel'); return; }
    if (me.pop) { nag('🍿 ' + (me.state === 'sit' ? MSG_ATUPP : 'Ät upp popcornen du har först!')); return; }
    const body = `<p style="font-size:var(--f2);margin:0 0 8px">💰 <b>${fmt(g.money)}</b> · 🍽️ Mättnad <b>${Math.round(g.hunger)}</b>/100 · ⚡ Energi <b>${Math.round(g.energy)}</b>/100</p>
      <div class="plist"><div class="prow" style="grid-template-columns:52px 1fr auto">
        <canvas data-pop width="8" height="11" style="width:32px;height:44px;image-rendering:pixelated;background:#3c1420;border:2px solid #c8a44a"></canvas>
        <span class="nm">🍿 <b>Popcorn, stor bägare</b><br><small class="sp">+${BIO_EFFEKT.popcornMatt} mättnad · +${BIO_EFFEKT.popcornEnergi} energi – äts tugga för tugga när du sitter</small></span>
        <button class="btn btn-small btn-go" data-buy="pop" data-key="1" ${g.money < BIO_PRIS.popcorn ? 'disabled' : ''}>🍿 ${fmt(BIO_PRIS.popcorn)} <kbd>1</kbd></button>
      </div></div>
      <p style="font-size:var(--f1);margin:10px 0 0;color:#6d6660">Ta med bägaren in i salongen och ät under filmen – eller slå dig ner på soffan. Ut på gatan får den inte följa med!</p>`;
    const dlg = openModal('🍿 Godis & popcorn', body, [{ label: 'Nej tack', onClick: closeModal }]);
    const cv = dlg.querySelector('canvas[data-pop]');
    if (cv) { const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(bucketImg(7, 7), 0, 0); }
    dlg.querySelector('[data-buy]')?.addEventListener('click', () => {
      const r = buyPopcorn();
      closeModal();
      if (!r.ok) { talkGodis.say('😳 ' + r.msg, godisAt); play('fel'); }
    });
  }

  // ---------- in och ut ----------
  function trySalong() {
    if (!isOpen()) { talk.say(`🔒 Salongen är låst tills bion öppnar ${clock(HOURS[0] * 60)}.`, meAt); play('fel'); return; }   // platsvakten har inte kommit än
    if (!me.biljett) { talkVakt.say('🎟️ Biljett, tack! Luckan finns där borta vid entrén.', vaktAt); play('fel'); vakt.stopT = t; return; }
    vakt.ripT = t;
    talkVakt.say('Tack! Sätt dig var du vill – trevlig film! 🎬', vaktAt);
    play('click');
    sdOpenT = t + 0.9;
    pendingRoom = { at: t + 0.45, to: 'salong' };
  }
  let pendingRoom = null;
  function goSalong() {
    if (me.state === 'sit') standUp();
    release();
    rum = 'salong';
    walker = wS;
    wS.px = SDOOR_SPOT[0]; wS.py = SDOOR_SPOT[1]; wS.stop(); wS.snapFree();
    sDoorT = t + 0.8;
    if (!show && (salon.visad || !aud.length)) populateSalon();
    cam.x = camTarget(); cam.y = camYTarget();
    play('door');
    if (me.biljett) talk.say('🎬 Sätt dig på en ledig plats – filmen börjar när du sitter!', meAt);
  }
  function goFoaje() {
    if (me.state === 'sit') standUp();
    release();
    if (show && !show.given) { giveReward(Math.min(1, show.t / show.total)); endShow(); }
    rum = 'foaje';
    walker = wF;
    wF.px = SD_SPOT[0]; wF.py = SD_SPOT[1] + 3; wF.stop(); wF.snapFree();
    sdOpenT = t + 0.8;
    cam.x = camTarget(); cam.y = camYTarget();
    play('door');
  }
  function leaveBio() {
    if (me.pop || me.order) { nag(me.pop ? MSG_DORR : MSG_VANTA); return false; }
    if (me.biljett) refundTicket(true);
    play('door');
    A.go('city');
    return true;
  }

  // ---------- föreställningen ----------
  // show: { film, t, startMin, minEff, p0, filmDur, total, lastFilmT, given }
  let show = null;
  const salon = { visad: false };
  function startShowIfTicket() {
    if (show || !me.biljett) return;
    const film = filmById(me.biljett);
    if (!film) { me.biljett = null; return; }
    // visningen slutar senast 23:30 – sent in = filmen har redan börjat. Under 30 min kvar
    // (efter 23:00) börjar ingen visning alls: biljetten blir pengar igen. Spelets egen
    // klocka (2 min/s) går också under filmen, så en kort visning kan dra över några
    // minuter – men aldrig fram till midnattskollapsen.
    const startMin = g.min, minEff = Math.max(0, Math.min(BIO_EFFEKT.minuter, SLUT_SENAST - startMin));
    if (minEff < MIN_VISNING) { refundTicket(false, 'Kvällens sista visning är slut! '); return; }
    me.biljett = null;
    const p0 = film.langd * (1 - minEff / BIO_EFFEKT.minuter);                     // sent in: filmen har redan börjat
    const filmDur = film.langd - p0;
    show = { film, t: 0, startMin, minEff, p0, filmDur, total: DIM + filmDur + CRED, lastFilmT: p0, given: false };
    if (me.pop) me.biteT = 3;
    if (p0 > 0.5) talk.say('🤫 Oj, den har redan börjat!', meAt);
    const s = aud.filter((G) => G.state === 'sit');
    if (s.length) say(s[(Math.random() * s.length) | 0], 'SCH, NU BÖRJAR DEN!', 2.4);
    play('box');
  }
  const showPhase = () => {
    if (!show) return null;
    const a = DIM, b = DIM + show.filmDur, c = b + CRED;
    return show.t < a ? 'dim' : show.t < b ? 'film' : show.t < c ? 'slut' : 'ljus';
  };
  const filmT = () => (show ? show.p0 + clamp(show.t - DIM, 0, show.filmDur) : 0);
  function giveReward(frac, quiet = false) {
    if (!show || show.given) return;
    show.given = true;
    const target = show.startMin + show.minEff * frac;
    if (g.min < target) g.passTime(target - g.min);
    const e = showEnergy(frac);
    g.energy = c100(g.energy + e);
    me.reward = { film: show.film.id, energi: e, humor: Math.round(BIO_EFFEKT.humor * frac), full: frac >= 0.999 };
    if (frac >= 0.999 && !me.sett.includes(show.film.id)) me.sett.push(show.film.id);
    g.save();
    if (quiet) return;
    if (frac >= 0.999) {
      play('fanfare');
      toast(`🎬 ${show.film.titel}: vilken film! +${e} ⚡ energi`, 'good');
      talk.say(`😄 VILKEN FILM! Jag känner mig utvilad och glad.`, meAt, 4);
    } else if (e > 0) toast(`🎬 Du gick mitt i filmen – +${e} ⚡ energi ändå.`, '');
  }
  function endShow() {
    show = null;
    filmMusic(null); filmAmb(null);
    salon.visad = true;
    for (const G of aud) if (G.state === 'sit') G.leaveT = t + 1.5 + Math.random() * 16;
  }
  function updateShow(dt) {
    if (!show) return;
    show.t += dt;
    // klockan: 2 speltimmar på en visning (spelets vanliga klocka går också – det som
    // saknas fylls på jämnt så att visaren rör sig under hela filmen)
    if (!show.given) {
      const target = show.startMin + show.minEff * Math.min(1, show.t / show.total);
      if (g.min < target) g.passTime(target - g.min);
    }
    const ph = showPhase();
    if (ph === 'film') {
      const ft = filmT();
      for (const q of filmCues(show.film, show.lastFilmT, ft)) react(q.kind);
      for (const q of filmSfxBetween(show.film, show.lastFilmT, ft)) filmSfx(q.kind);   // visselpipan, sparken, jublet …
      show.lastFilmT = ft;
    }
    if (show.t >= show.total && !show.given) {
      giveReward(1);
      for (const G of aud) if (G.state === 'sit' && Math.random() < 0.45) say(G, EFTERAT[(Math.random() * EFTERAT.length) | 0], 3);
    }
    filmMusic(ph === 'film' ? filmMusicAt(show.film, filmT()) : null);            // träningslåten i fotbollsfilmerna
    filmAmb(ph === 'film' ? filmAmbAt(show.film, filmT()) : null);                // läktarsorlet, regnet
    if (show.t >= show.total + LJUS) endShow();
  }
  // mörker 0..1 och ridån 0 (stängd) … 1 (öppen)
  function lights() {
    const ph = showPhase();
    if (!ph) return { dark: 0, open: 0 };
    if (ph === 'dim') return { dark: ease(show.t / DIM) * 0.86, open: ease((show.t - 1) / (DIM - 1)) };
    if (ph === 'film' || ph === 'slut') return { dark: 0.86, open: 1 };
    const k = clamp((show.t - show.total) / LJUS, 0, 1);
    return { dark: 0.86 * (1 - ease(k)), open: 1 - ease(k) };
  }

  // ---------- publiken i salongen ----------
  let aud = [];
  const bubbles = [];                                     // { G, text, until }
  function say(G, text, secs = 2.2) {
    if (bubbles.length >= 5) bubbles.shift();
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].G === G) bubbles.splice(i, 1);
    bubbles.push({ G, text, until: t + secs });
  }
  function populateSalon() {
    for (const s of seats) if (s.occ && s.occ !== 'me') s.occ = null;
    aud = [];
    const rng = rngOf((g.day | 0) * 7919 + Math.floor(g.min) * 13 + 5);
    const n = hour() >= 18 ? 30 : hour() >= 15 ? 22 : 15;
    const free = seats.filter((s) => !s.occ);
    for (let k = 0; k < n && free.length; k++) {
      // helst mitten och de bakre raderna
      let best = null, bs = -1;
      for (let tries = 0; tries < 6; tries++) { const s = free[Math.floor(rng() * free.length)]; const sc = (Math.abs(s.x - 288) < 100 ? 2 : 0) + s.row * 0.4 + rng(); if (sc > bs) { bs = sc; best = s; } }
      free.splice(free.indexOf(best), 1);
      const G = mkAud(best, rng);
      aud.push(G);
    }
    salon.visad = false;
    lateT = 3;
  }
  function mkAud(seat, rng = Math.random) {
    const look = makeLook(rng); look.bag = null; look.hat = rng() < 0.85 ? null : look.hat;
    const G = { look, seat, state: 'sit', eatT: rng() * 4, eating: 0, react: null, leaveT: 0, w: null, pop: rng() < 0.7 ? { left: 3 + Math.floor(rng() * 5), total: 7 } : null, slide: null };
    seat.occ = G;
    return G;
  }
  let lateT = 3, chatT = 4;
  function react(kind) {
    const sitting = aud.filter((G) => G.state === 'sit');
    let spoken = 0;
    for (const G of sitting) {
      if (Math.random() > 0.55) continue;
      G.react = { kind, until: t + 1.4 + Math.random() * 1.4, t0: t };
      if (spoken < 3 && Math.random() < 0.3) { say(G, REACT[kind][(Math.random() * REACT[kind].length) | 0], 2.2); spoken++; }
      if ((kind === 'skratt' || kind === 'oj') && G.pop && Math.random() < 0.5) for (let k = 0; k < 3; k++) kernels.push({ x: G.seat.x + 6, y: G.seat.y - 22, vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 25, age: 0 });
    }
    if (kind === 'skratt' && sitting.length && Math.random() < 0.4) { const G = sitting[(Math.random() * sitting.length) | 0]; setTimeout(() => say(G, 'SCH!', 1.4), 900); }
  }
  const kernels = [];
  function updateAud(dt) {
    for (const G of aud) {
      if (G.state === 'sit') {
        G.eatT -= dt;
        if (G.eating > 0) G.eating -= dt;
        if (G.eatT <= 0 && G.pop && G.pop.left > 0) { G.eating = 0.5; G.eatT = 2.5 + Math.random() * 5; if (Math.random() < 0.3) G.pop.left--; }
        else if (G.eatT <= 0) G.eatT = 4;
        if (G.slide) { G.slide.k += dt * 4; if (G.slide.k >= 1) G.slide = null; }
        if (G.leaveT && t > G.leaveT) {
          G.state = 'leave'; G.seat.occ = null;
          G.w = mkS([G.seat.ax, G.seat.ay]); G.w.speed = 40;
          G.w.walkTo(...SDOOR_SPOT, () => { G.state = 'gone'; sDoorT = t + 0.6; });
        }
      } else if (G.state === 'late') {
        G.w.update(dt);
      } else if (G.state === 'leave') G.w.update(dt);
    }
    aud = aud.filter((G) => G.state !== 'gone');
    // sena gäster kommer in och sätter sig innan filmen börjar
    if (rum === 'salong' && !show && !salon.visad) {
      lateT -= dt;
      if (lateT <= 0 && aud.filter((G) => G.late).length < 3) {
        const free = seats.filter((s) => !s.occ);
        if (free.length) {
          const s = free[(Math.random() * free.length) | 0];
          const look = makeLook(); look.bag = null;
          const G = { look, seat: s, state: 'late', late: true, eatT: 3, eating: 0, react: null, leaveT: 0, pop: Math.random() < 0.6 ? { left: 7, total: 7 } : null, w: mkS(SDOOR_SPOT), slide: null };
          G.w.speed = 42;
          s.occ = G;
          sDoorT = t + 0.6;
          G.w.walkTo(s.ax, s.ay, () => { G.state = 'sit'; G.slide = { fx: G.w.px, fy: G.w.py, k: 0 }; });
          aud.push(G);
        }
        lateT = 6 + Math.random() * 5;
      }
      // småprat före filmen
      chatT -= dt;
      if (chatT <= 0) { const s = aud.filter((G) => G.state === 'sit'); if (s.length) say(s[(Math.random() * s.length) | 0], PRAT[(Math.random() * PRAT.length) | 0], 3); chatT = 4 + Math.random() * 5; }
    }
    for (const k of kernels) { k.age += dt; k.x += k.vx * dt; k.y += k.vy * dt; k.vy += 90 * dt; }
    for (let i = kernels.length - 1; i >= 0; i--) if (kernels[i].age > 0.8) kernels.splice(i, 1);
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].until < t || !aud.includes(bubbles[i].G)) bubbles.splice(i, 1);
  }

  // ---------- personalen ----------
  const kass = { dir: 'down', handT: -9, lookT: 2 };
  const godis = { x: 320, tx: 320, dir: 'down', walking: false, t: 0, order: null, idleT: 2, carry: false };
  const vakt = { ripT: -9, stopT: -9 };
  function updateStaff(dt) {
    kass.lookT -= dt;
    if (kass.lookT <= 0) { kass.dir = ['down', 'down', 'left', 'right', 'down'][(Math.random() * 5) | 0]; kass.lookT = 2 + Math.random() * 4; }
    // Kevin: fyller en bägare vid maskinen och lämnar den på disken
    const K = godis, dx = K.tx - K.x;
    K.walking = Math.abs(dx) > 0.5;
    if (K.walking) { K.x += Math.sign(dx) * Math.min(Math.abs(dx), 50 * dt); K.dir = dx < 0 ? 'left' : 'right'; return; }
    if (K.order) {
      const o = K.order;
      if (!o.phase) { o.phase = 'tomachine'; K.tx = F.MACHINE.x0 + 16; return; }
      if (o.phase === 'tomachine') { K.dir = 'up'; o.phase = 'fill'; o.ft = t; return; }
      if (o.phase === 'fill' && t - o.ft > 1.2) { K.carry = true; o.phase = 'serve'; K.tx = clamp(walker.px, F.CNT.x0 + 12, F.CNT.x1 - 24); return; }
      if (o.phase === 'serve') {
        K.dir = 'down'; K.carry = false; K.order = null;
        me.pop = { left: BIO_EFFEKT.tuggor, total: BIO_EFFEKT.tuggor, settled: !!me.order?.settled };   // redan inräknad (omladdning) = tuggorna ger inget till
        me.order = null;
        if (me.state === 'waitPop') me.state = 'carry';
        talkGodis.say('Varsågod! Håll i bägaren – ät den sittande!', godisAt);
        play('ok');
        if (!me.popHint && rum === 'foaje') { me.popHint = true; setTimeout(() => { if (!talk.active() && rum === 'foaje') talk.say('🍿 Popcornen äter jag i salongen – eller på soffan.', meAt); }, 1400); }
      }
      return;
    }
    K.idleT -= dt;
    if (K.idleT <= 0) { K.tx = [F.CNT.x0 + 16, 300, 330, F.MACHINE.x0 + 16, 350][(Math.random() * 5) | 0]; K.idleT = 3 + Math.random() * 5; K.dir = Math.random() < 0.4 ? 'up' : 'down'; }
  }

  // ---------- besökarna i foajén ----------
  const folk = [];
  const frng = rngOf((g.day | 0) * 4241 + 17);
  for (let k = 0; k < 4; k++) {
    const look = makeLook(frng); look.bag = frng() < 0.3 ? look.bag : null;
    folk.push({ look, w: mkF(DOOR_SPOT), state: 'away', t: 1.5 + k * 6 + frng() * 4, qi: -1, bar: frng() < 0.55, bubble: null, carry: false });
  }
  const queue = [];
  // en del besökare slår sig ner på rundsoffan en stund innan de går in (om det finns plats)
  function toSofa(P) {
    if (Math.random() > 0.4) return false;
    const free = sofaSeats.filter((q) => !q.occ);
    if (!free.length) return false;
    const s = free[(Math.random() * free.length) | 0];
    s.occ = P; P.seat = s; P.state = 'tosofa';
    P.w.walkTo(s.ax, s.ay);
    return true;
  }
  function folkLeave(P) { P.state = 'exit'; P.carry = false; P.w.walkTo(...DOOR_SPOT, () => { P.state = 'away'; P.t = 8 + Math.random() * 14; }); }
  function updateFolk(P, dt) {
    if (P.state === 'away') {
      P.t -= dt;
      if (P.t > 0 || !isOpen()) return;
      P.look = makeLook(); P.look.bag = null; P.bar = Math.random() < 0.55; P.carry = false;
      P.w.px = DOOR_SPOT[0]; P.w.py = DOOR_SPOT[1]; P.w.stop();
      P.state = 'queue'; queue.push(P);
      doorFT = t + 0.8;
      return;
    }
    if (P.state === 'inside') {
      P.t -= dt;
      if (P.t <= 0) { P.state = 'out'; P.w.px = SD_SPOT[0]; P.w.py = SD_SPOT[1] + 2; sdOpenT = t + 0.8; folkLeave(P); }
      return;
    }
    if (P.state === 'queue') {
      const ix = queue.indexOf(P);
      const meAtWin = Math.hypot(walker.px - LUCKA_SPOT[0], walker.py - LUCKA_SPOT[1]) < 12 && rum === 'foaje';
      const [qx, qy] = ix === 0 && !meAtWin ? LUCKA_SPOT : QPOS[Math.min(ix, QPOS.length - 1)];
      if (Math.hypot(P.w.px - qx, P.w.py - qy) > 2 && !P.w.path.length) P.w.walkTo(qx, qy);
      if (ix === 0 && !meAtWin && !P.w.path.length && Math.hypot(P.w.px - qx, P.w.py - qy) < 3) {
        P.w.dir = 'up';
        P.buyT = (P.buyT || 0) + dt;
        if (P.buyT > 0.2 && !P.said) { P.said = true; P.bubble = { text: FOLK_KASSA[(Math.random() * FOLK_KASSA.length) | 0], until: t + 2 }; }
        if (P.buyT > 1.8) {
          P.buyT = 0; P.said = false; kass.handT = t; queue.splice(queue.indexOf(P), 1);
          if (Math.random() < 0.5) talkKass.say(['Varsågod!', 'Salong 1, trevlig film!', 'Tack så mycket!'][(Math.random() * 3) | 0], kassAt);
          if (P.bar) { P.state = 'tobar'; P.w.walkTo(280 + Math.random() * 70, BAR_SPOT[1]); }
          else if (!toSofa(P)) { P.state = 'tosalong'; P.w.walkTo(...SD_SPOT); }
        }
      }
    } else if (P.state === 'tobar' && !P.w.path.length) {
      P.w.dir = 'up'; P.buyT = (P.buyT || 0) + dt;
      if (P.buyT > 0.2 && !P.said) { P.said = true; P.bubble = { text: FOLK_BAR[(Math.random() * FOLK_BAR.length) | 0], until: t + 2 }; }
      if (P.buyT > 2.2) { P.buyT = 0; P.said = false; P.carry = true; if (!toSofa(P)) { P.state = 'tosalong'; P.w.walkTo(...SD_SPOT); } }
    } else if (P.state === 'tosofa' && !P.w.path.length) {
      if (P.seat.occ !== P) { P.seat = null; P.state = 'tosalong'; P.w.walkTo(...SD_SPOT); }
      else { P.state = 'sofa'; P.sitT = 6 + Math.random() * 9; P.eatT = 1; P.eating = 0; }
    } else if (P.state === 'sofa') {
      P.sitT -= dt; P.eatT -= dt;
      if (P.eating > 0) P.eating -= dt;
      if (P.eatT <= 0) { P.eating = P.carry ? 0.5 : 0; P.eatT = 1.6 + Math.random() * 2; }
      if (P.sitT <= 0) { const s = P.seat; s.occ = null; P.seat = null; P.w.px = s.ax; P.w.py = s.ay; P.w.stop(); P.state = 'tosalong'; P.w.walkTo(...SD_SPOT); }
      return;
    } else if (P.state === 'tosalong' && !P.w.path.length) {
      vakt.ripT = t; sdOpenT = t + 0.8;
      P.state = 'inside'; P.t = 25 + Math.random() * 40;
    }
    P.w.update(dt);
  }

  // ---------- figuren ----------
  function updateMe(dt) {
    if (me.state === 'sit') {
      me.sitT += dt;
      if (me.slide) { me.slide.k += dt * 4; if (me.slide.k >= 1) me.slide = null; }
      if (me.eating > 0) me.eating -= dt;
      if (me.pop) {
        if (me.pop.left > 0) {
          me.biteT -= dt;
          if (me.biteT <= 0) {
            bite();
            // under filmen sprids tuggorna över hela visningen, annars som vid ett bord
            me.biteT = show ? Math.max(1.4, (show.total - show.t) / (me.pop.left + 1)) : 1.4;
          }
        } else if (me.pop.doneT && t - me.pop.doneT > 1.1) {
          me.pop = null;
          if (!show) talk.say('😋 MUMS! Popcorn är det bästa som finns.', meAt);
        }
      } else if (!show && me.seat && me.sitT > 16 && !(me.seat.kind === 'salong' && me.biljett)) standUp();
    }
    // mumlar ursäkta när man tränger sig förbi folk i raden
    if (rum === 'salong' && walker.path.length && t - me.ursaktT > 4) {
      const row = S.ROW_Y.findIndex((y) => Math.abs(walker.py - (y - 10)) < 3);
      if (row >= 0 && seats.some((s) => s.row === row && s.occ && s.occ !== 'me' && Math.abs(s.x - walker.px) < 10)) { me.ursaktT = t; talk.say(['Ursäkta, ursäkta!', 'Förlåt, får jag komma förbi?', 'Oj, förlåt – foten!'][(Math.random() * 3) | 0], meAt, 1.8); }
    }
    // säkerhetsnät om gångens callback uteblev
    if (!walker.path.length && !me.seat && me.res && me.res.occ === 'me') {
      if (Math.hypot(walker.px - me.res.ax, walker.py - me.res.ay) < 8) sitDown(me.res); else release();
    }
  }

  // ---------- dörrarna ----------
  let doorF = 0, doorFT = -9, sdOpen = 0, sdOpenT = -9, sDoorT = -9, sDoor = 0;
  function updateDoors(dt) {
    const nearF = (x, y) => x > F.DOOR.x0 - 10 && x < F.DOOR.x1 + 10 && y < F.WALL_Y + 14;
    const any = (rum === 'foaje' && nearF(walker.px, walker.py) && !me.pop && !me.order) || folk.some((P) => (P.state === 'exit' || P.state === 'queue') && nearF(P.w.px, P.w.py)) || t < doorFT;
    doorF += ((any ? 1 : 0) - doorF) * Math.min(1, dt * 6);
    sdOpen += ((t < sdOpenT ? 1 : 0) - sdOpen) * Math.min(1, dt * 7);
    sDoor += ((t < sDoorT ? 1 : 0) - sDoor) * Math.min(1, dt * 7);
  }
  // popcornmaskinen: majskorn som poppar i glasskåpet
  const pops = [];
  let popT = 0;
  function updatePops(dt) {
    popT -= dt;
    if (popT <= 0 && popOpen()) { const M = F.MACHINE; pops.push({ x: M.x0 + 11 + Math.random() * 8, y: M.y0 + 15, vx: (Math.random() - 0.5) * 26, vy: -10 - Math.random() * 20, age: 0 }); popT = 0.08 + Math.random() * 0.16; }
    const M = F.MACHINE;
    for (const p of pops) {
      p.age += dt; p.vy += 80 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < M.x0 + 2) { p.x = M.x0 + 2; p.vx = -p.vx; } if (p.x > M.x1 - 3) { p.x = M.x1 - 3; p.vx = -p.vx; }
      if (p.y > M.y1 - 16) { p.y = M.y1 - 16; p.vy = 0; p.vx *= 0.5; }
    }
    for (let i = pops.length - 1; i >= 0; i--) if (pops[i].age > 1.6) pops.splice(i, 1);
    if (pops.length > 40) pops.splice(0, pops.length - 40);
  }

  // ---------- kameran ----------
  const camTarget = () => {
    if (lockedCam !== null) return lockedCam;
    if (rum === 'salong' && me.state === 'sit') return clamp(288 - VW / 2, 0, W - VW);   // duken mitt i bild
    return clamp(walker.px - VW / 2, 0, W - VW);
  };
  // höjdled (bara när fyll-läget beskär). cam.y > 0 flyttar rummet nedåt, < 0 uppåt.
  //   foajén: helst från skyltarnas överkant (rad 10: BILJETTER, POPCORN, SALONG 1) – affischerna,
  //     luckan, baren och personalens pratbubblor syns – och golvet så långt det räcker;
  //   salongen: helst stolsraderna (remsan ner till rad 200) så att man ser var man kan sitta;
  //     sitter man där under föreställningen ligger i stället HELA duken i bild;
  //   alltid: fötterna och huvudet (med pratbubblan) på den egna figuren.
  const camYTarget = () => {
    const [y0, y1] = safeY();
    if (y0 <= 0 && y1 >= H) return 0;
    if (rum === 'salong' && me.state === 'sit' && me.seat?.kind === 'salong' && show) return clamp(y0 - (S.FRAME.y0 - 2), y1 - H, y0);
    const py = me.seat ? me.seat.y : walker.py;
    const pref = rum === 'salong' ? y1 - 200 : y0 - 10;
    const hi = Math.min(y0, y1 - (py + 8)), lo = Math.max(y1 - H, y0 - (py - 62));
    return clamp(clamp(pref, lo, hi), y1 - H, y0);
  };
  const cam = { x: camTarget(), y: 0 };
  cam.y = camYTarget();

  // ---------- klickbara saker ----------
  const posterSpot = (i) => { const x = F.POSTERS[i]; return { id: 'affisch' + i, r: [x, F.POSTER_Y, x + 30, F.POSTER_Y + 40], go: () => [x + 15, F.WALL_Y + 8], act: () => { const f = FILMER[i]; walker.dir = 'up'; talk.say(`🎬 ${f.titel} – ${f.genre}, ${f.alder}. ${f.blurb}`, meAt, 5); play('click'); } }; };
  const hotF = [
    { id: 'dorr', r: [F.DOOR.x0 - 4, F.DOOR.top - 8, F.DOOR.x1 + 4, F.WALL_Y + 10], go: () => DOOR_SPOT, act: () => leaveBio() },
    { id: 'lucka', r: [F.BOOTH.x0, 10, F.BOOTH.x1, F.WALL_Y + 6], go: () => LUCKA_SPOT, act: () => { walker.dir = 'up'; play('click'); openBiljett(); } },
    { id: 'bar', r: [F.BAR.x0, 10, F.BAR.x1, F.CNT.y + 2], go: () => BAR_SPOT, act: () => { walker.dir = 'up'; play('click'); openPopcorn(); } },
    { id: 'salong', r: [F.SD.x0 - 4, 12, F.SD.x1 + 4, F.WALL_Y + 10], go: () => SD_SPOT, act: () => { walker.dir = 'up'; trySalong(); } },
    { id: 'vakt', r: [F.USHER.x - 8, F.USHER.y - 40, F.USHER.x + 8, F.USHER.y + 2], go: () => [F.USHER.x - 12, F.USHER.y + 6], act: () => { walker.dir = 'right'; trySalong(); } },
    { id: 'kartong', r: [F.STANDEE.x - 18, F.STANDEE.y - 52, F.STANDEE.x + 26, F.STANDEE.y + 2], go: () => [F.STANDEE.x, F.STANDEE.y + 10], act: () => { walker.dir = 'up'; talk.say('😎 PIXELHÄMNAREN i naturlig storlek – han ser nästan levande ut!', meAt); play('click'); } },
    { id: 'klo', r: [F.KLO.x - 13, F.KLO.y - 46, F.KLO.x + 13, F.KLO.y + 2], go: () => [F.KLO.x, F.KLO.y + 9], act: () => { walker.dir = 'up'; talk.say(['🧸 Gripklon! Jag har aldrig sett någon vinna här …', '🧸 Den gula nallen ligger nästan vid luckan. Nästan.', '🧸 Klon är för slapp – den tappar allt.'][(Math.random() * 3) | 0], meAt); play('click'); } },
    ...F.POSTERS.map((_, i) => posterSpot(i)),
    ...easels.map((_, i) => { const [x, y] = F.EASELS[i], f = EASEL_FILMS[i]; return { id: 'staffli' + i, r: [x - 18, y - 58, x + 18, y + 2], go: () => [x, y + 12], act: () => { walker.dir = 'up'; talk.say(`🎬 PREMIÄR! ${f.titel} – ${f.genre}, ${f.alder}. ${f.blurb}`, meAt, 6); play('click'); } }; }),
  ];
  const hotS = [
    { id: 'utgang', r: [S.DOOR.x0 - 4, S.DOOR.top - 16, S.DOOR.x1 + 4, S.WALL_Y + 8], go: () => SDOOR_SPOT, act: () => goFoaje() },
    { id: 'nodutgang', r: [S.NOD.x0 - 4, S.NOD.top - 16, S.NOD.x1 + 4, S.WALL_Y + 8], go: () => [(S.NOD.x0 + S.NOD.x1) >> 1, S.WALL_Y + 6], act: () => { walker.dir = 'up'; talk.say('🚪 NÖDUTGÅNG – den är bara till för nödfall. Utgången är på andra sidan!', meAt); play('click'); } },
    { id: 'duk', r: [S.FRAME.x0, S.FRAME.y0, S.FRAME.x1, S.FRAME.y1], go: () => [288, S.WALL_Y + 8], act: () => { walker.dir = 'up'; talk.say(me.biljett ? '🎬 Filmen börjar när jag satt mig på en plats.' : '🎟️ För att se en film behöver jag en biljett från luckan i foajén.', meAt); } },
  ];
  const hot = () => (rum === 'salong' ? hotS : hotF);
  const spotAt = (x, y) => hot().find((h) => x >= h.r[0] && x <= h.r[2] && y >= h.r[1] && y <= h.r[3]);
  const seatAt = (x, y) => {
    if (rum === 'salong') {
      // klick på stolsryggen eller huvudet som sticker upp ovanför den
      let best = null, bd = 99;
      for (const s of seats) { if (Math.abs(x - s.x) > 7 || y < s.y - 34 || y > s.y + 2) continue; const d = Math.abs(y - (s.y - 10)); if (d < bd) { bd = d; best = s; } }
      return best;
    }
    return sofaSeats.find((s) => Math.abs(x - s.x) < 10 && y > s.y - 30 && y < s.y + 4) || null;
  };

  // ======================= ritning =======================
  function drawClock(ctx) {
    const { x, y } = F.KLOCKA, m = g.min % 60, h = (g.min / 60) % 12;
    const hand = (a, r, col) => { ctx.fillStyle = col; for (let k = 0; k <= r; k++) ctx.fillRect(Math.round(x + Math.sin(a) * k), Math.round(y - Math.cos(a) * k), 1, 1); };
    hand(h / 12 * Math.PI * 2, 3, '#17151a'); hand(m / 60 * Math.PI * 2, 5, '#5a4a3a');
    ctx.fillStyle = '#c8262e'; ctx.fillRect(x, y, 1, 1);
  }
  // ljuskronan: guldring, glödlampor och kristaller som glittrar
  function drawChandelier(ctx, lx) {
    ctx.fillStyle = '#8a6a2a'; ctx.fillRect(lx, 6, 1, 5);
    ctx.fillStyle = '#c8a44a'; ctx.fillRect(lx - 9, 13, 19, 2); ctx.fillStyle = '#f0d890'; ctx.fillRect(lx - 9, 13, 19, 1);
    ctx.fillStyle = '#a8843a'; ctx.fillRect(lx - 4, 11, 9, 2);
    for (let k = -2; k <= 2; k++) { ctx.fillStyle = '#fff4c0'; ctx.fillRect(lx + k * 4, 11, 1, 2); ctx.fillStyle = '#ffd890'; ctx.fillRect(lx + k * 4, 10, 1, 1); }
    for (let k = -4; k <= 4; k++) {
      const len = 3 + ((k + 4) % 3), sp = Math.floor(t * 3 + k * 1.7) % 7 === 0;
      for (let j = 0; j < len; j++) { ctx.fillStyle = j === len - 1 ? (sp ? '#ffffff' : '#bfe8ff') : '#e8f4fa'; ctx.fillRect(lx + k * 2, 15 + j, 1, 1); }
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#ffd890'; for (let r = 14; r > 2; r -= 4) ctx.fillRect(lx - r, 13 - r / 2, r * 2, r);
    ctx.restore();
  }
  function drawBucketHeld(ctx, x, y, dir, pop) {
    if (!pop) return;
    const img = bucketImg(Math.max(0, pop.left), pop.total);
    const bx = dir === 'left' ? x - 11 : dir === 'right' ? x + 3 : x - 4;
    ctx.drawImage(img, Math.round(bx), Math.round(y) - (dir === 'up' ? 24 : 23));
  }
  function seatPos(s, who) {
    const sl = who === 'me' ? me.slide : who?.slide;
    if (!sl) return [s.x, s.y];
    const k = clamp(sl.k, 0, 1);
    return [sl.fx + (s.x - sl.fx) * k, sl.fy + (s.y - sl.fy) * k];
  }
  // andra spelare i samma rum (salongen ligger SALONG_DY längre ner i världen)
  function folksHere() {
    try {
      return WORLD.worldFolksHere(A).filter((f) => (rum === 'salong' ? f.y >= SALONG_DY : f.y < SALONG_DY)).map((f) => ({ ...f, y: rum === 'salong' ? f.y - SALONG_DY : f.y }));
    } catch { return []; }
  }
  function markRemoteSeats(list) {
    for (const s of roomSeats()) if (s.occ?.state === 'remote') s.occ = null;
    for (const f of list) {
      if (!f.sit || f.walking) continue;
      const s = roomSeats().find((q) => !q.occ && Math.abs(q.x - f.x) <= 4 && Math.abs(q.y - f.y) <= 4);
      if (s) s.occ = { state: 'remote', id: f.id };
    }
  }
  function drawFolk(ctx, f) {
    const walking = f.walking;
    drawPerson(ctx, f.x, f.y, f.av.look, f.sit && !walking ? f.sit : 'down', f.sit && !walking ? (f.eat ? 6 : 5) : walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : 0);
    if (!(rum === 'salong' && f.sit)) nameTag(ctx, f.x, f.y - 50, f.av);
    if (f.say) sayBubble(ctx, f.x, capY({ x: f.x, y: f.y - 60 }, f.say, SAY_W, 4).y, f.say, { voice: f.av || f.id, x0: visX0, x1: visX1 });
  }

  function drawFoaje(ctx, cx, vw) {
    const night = isNight(), open = isOpen();
    ctx.drawImage(bgF(), 0, 0);
    drawSlideDoors(ctx, doorF, night);
    // salongsdörrarna och lampan FILM PÅGÅR
    ctx.drawImage(sdFrames[Math.round(clamp(sdOpen, 0, 1) * (sdFrames.length - 1))], F.SD.x0, F.SD.top);
    const inne = folk.some((P) => P.state === 'inside');
    const lampOn = open && inne && Math.sin(t * 2.2) > -0.6;
    const lx = ((F.SD.x0 + F.SD.x1) >> 1) - 20;
    if (lampOn) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctxText(ctx, SMALL, 'FILM PÅGÅR', lx + 1 + ox, 30 + oy, '#7a1414');   // glöden runt bokstäverna
    ctxText(ctx, SMALL, 'FILM PÅGÅR', lx + 1, 30, lampOn ? '#ff5a4a' : '#4a1818');
    drawClock(ctx);
    for (const x of F.LAMPS) drawChandelier(ctx, x);
    // biljettluckan: kassörskan bakom glaset (eller rullgardinen när det är stängt)
    const W0 = F.BOOTH.win;
    if (open) {
      drawPerson(ctx, F.KASS.x, F.KASS.y, GRETA, kass.dir, Math.sin(t * 1.6) > 0.94 ? 4 : 0);
    } else {
      for (let y = W0.y0; y < W0.y1; y++) { ctx.fillStyle = (y - W0.y0) % 3 === 2 ? '#8a6a44' : '#c8a878'; ctx.fillRect(W0.x0, y, W0.x1 - W0.x0, 1); }
    }
    ctx.drawImage(booth.img, booth.ox, booth.oy);
    if (!open) { const s = 'STÄNGT'; ctx.fillStyle = '#1a0a0e'; ctx.fillRect(F.KASS.x - 14, W0.y0 + 8, 28, 9); ctxText(ctx, SMALL, s, F.KASS.x - (textW(SMALL, s) >> 1), W0.y0 + 10, '#f0d890'); }
    // en biljett glider ut ur springan
    if (t - kass.handT < 1.2) { const k = clamp((t - kass.handT) / 0.5, 0, 1); ctx.fillStyle = '#f4ecd8'; ctx.fillRect(F.KASS.x - 3, W0.y1 + 1 + Math.round(k * 3), 7, 3); ctx.fillStyle = '#c8262e'; ctx.fillRect(F.KASS.x - 3, W0.y1 + 2 + Math.round(k * 3), 7, 1); }
    // popcornmaskinen poppar (och lampan i taket på skåpet)
    ctx.save(); ctx.beginPath(); const M = F.MACHINE; ctx.rect(M.x0 + 1, M.y0 + 7, M.x1 - M.x0 - 2, M.y1 - M.y0 - 13); ctx.clip();
    for (const p of pops) { ctx.fillStyle = p.age < 0.15 ? '#fff0a0' : '#fffaf0'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 1); ctx.fillStyle = '#f0d070'; ctx.fillRect(Math.round(p.x), Math.round(p.y) + 1, 1, 1); }
    if (open && Math.sin(t * 5) > 0.3) { const tilt = Math.round(Math.sin(t * 5)); ctx.fillStyle = '#fff6d8'; ctx.fillRect(M.x0 + 12 + tilt, M.y0 + 15, 6, 1); }
    ctx.restore();

    // ---- allt på golvet i djupordning ----
    const items = [];
    const add = (fy, draw) => items.push({ fy, draw });
    add(F.CNT.y, (c) => {
      const kf = godis.walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 1.9) > 0.93 ? 4 : 0);
      if (open) drawPerson(c, Math.round(godis.x), F.GODIS_Y, KEVIN, godis.dir, godis.carry ? (godis.walking ? [7, 9, 8, 9][Math.floor(t * 8.5) % 4] : 9) : kf);
      if (open && godis.carry) c.drawImage(bucketImg(7, 7), Math.round(godis.x) - 4, F.GODIS_Y - 23);
      c.drawImage(counter.img, counter.ox, counter.oy);
      if (!popOpen()) { c.fillStyle = '#1a0a0e'; c.fillRect(300, F.CNT.top - 10, 32, 9); ctxText(c, SMALL, 'STÄNGT', 304, F.CNT.top - 8, '#f0d890'); }
    });
    // kösnörena: bakre stolparna, repet och de främre
    add(F.ROPE.y0, (c) => { for (const x of [F.ROPE.xl, F.ROPE.xr]) c.drawImage(post.img, x - post.ox, F.ROPE.y0 - post.oy); });
    add(F.ROPE.y1, (c) => {
      for (const x of [F.ROPE.xl, F.ROPE.xr]) {
        for (let y = F.ROPE.y0 - 11; y <= F.ROPE.y1 - 11; y++) { const sag = Math.round(Math.sin((y - F.ROPE.y0 + 11) / (F.ROPE.y1 - F.ROPE.y0) * Math.PI) * 3); c.fillStyle = '#a01c2c'; c.fillRect(x, y + sag, 1, 1); c.fillStyle = '#5a0e1a'; c.fillRect(x, y + sag + 1, 1, 1); }
        c.drawImage(post.img, x - post.ox, F.ROPE.y1 - post.oy);
      }
    });
    if (open) add(F.USHER.y, (c) => {
      const rip = t - vakt.ripT < 0.8, stop = t - vakt.stopT < 1.2;
      drawPerson(c, F.USHER.x, F.USHER.y, HARALD, rip ? 'left' : 'down', rip ? 9 : stop ? 4 : (Math.sin(t * 1.3) > 0.95 ? 4 : 0));
      if (rip) { c.fillStyle = '#f4ecd8'; c.fillRect(F.USHER.x - 10, F.USHER.y - 22, 3, 2); c.fillRect(F.USHER.x - 6 + Math.round((t - vakt.ripT) * 6), F.USHER.y - 22, 3, 2); }
      else { c.fillStyle = '#2a2a30'; c.fillRect(F.USHER.x + 5, F.USHER.y - 18, 2, 5); c.fillStyle = '#fff0b0'; c.fillRect(F.USHER.x + 5, F.USHER.y - 13, 2, 1); }   // ficklampan
    });
    add(F.SOFA.y - 14, (c) => c.drawImage(sofa.img, F.SOFA.x - sofa.ox, F.SOFA.y - sofa.oy));
    add(F.KLO.y, (c) => { c.drawImage(klo.img, F.KLO.x - klo.ox, F.KLO.y - klo.oy); const sw = Math.round(Math.sin(t * 1.3) * 5); c.fillStyle = '#9aa0a8'; c.fillRect(F.KLO.x + sw, F.KLO.y - 38, 1, 5); c.fillStyle = '#c8ccd4'; c.fillRect(F.KLO.x + sw - 2, F.KLO.y - 33, 5, 1); c.fillRect(F.KLO.x + sw - 2, F.KLO.y - 32, 1, 2); c.fillRect(F.KLO.x + sw + 2, F.KLO.y - 32, 1, 2); });
    for (const s of sofaSeats) add(s.y, (c) => {
      const o = s.occ;
      if (o === 'me' && me.seat === s) {
        const [x, y] = seatPos(s, 'me');
        drawPerson(c, x, y, A.avatar.look, me.slide ? (s.x < x ? 'left' : 'right') : 'down', me.slide ? WALK_SEQ[Math.floor(t * 8.5) % 4] : me.eating > 0 ? 6 : 5);
        if (me.pop && !me.slide) c.drawImage(bucketImg(me.pop.left, me.pop.total), s.x + 3, s.y - 20);
      } else if (o && o !== 'me' && o.state === 'sofa') {
        drawPerson(c, s.x, s.y, o.look, 'down', o.eating > 0 ? 6 : 5);
        if (o.carry) c.drawImage(bucketImg(5, 7), s.x + 3, s.y - 20);
      }
    });
    add(F.STANDEE.y, (c) => c.drawImage(standee.img, F.STANDEE.x - standee.ox, F.STANDEE.y - standee.oy));
    easels.forEach((e, i) => { const [x, y] = F.EASELS[i]; add(y, (c) => c.drawImage(e.img, x - e.ox, y - e.oy)); });
    add(F.BIN.y, (c) => c.drawImage(bin.img, F.BIN.x - bin.ox, F.BIN.y - bin.oy));
    for (const [px, py] of F.PALMS) add(py, (c) => c.drawImage(palm.img, px - palm.ox, py - palm.oy));
    for (const P of folk) if (P.state !== 'away' && P.state !== 'inside' && P.state !== 'sofa') add(P.w.py, (c) => {
      const walking = P.w.path.length > 0;
      const fr = P.carry ? (walking ? [7, 9, 8, 9][Math.floor(t * 7) % 4] : 9) : walking ? WALK_SEQ[Math.floor(t * 7) % 4] : 0;
      const dir = walking ? P.w.dir : (P.state === 'queue' || P.state === 'tobar' ? 'up' : P.w.dir);
      if (P.carry && dir === 'up') c.drawImage(bucketImg(6, 7), Math.round(P.w.px) - 4, Math.round(P.w.py) - 24);
      drawPerson(c, P.w.px, P.w.py, P.look, dir, fr);
      if (P.carry && dir !== 'up') c.drawImage(bucketImg(6, 7), Math.round(P.w.px) + (dir === 'left' ? -11 : dir === 'right' ? 3 : -4), Math.round(P.w.py) - 23);
    });
    const fl = folksHere();
    markRemoteSeats(fl);
    for (const f of fl) add(f.y, (c) => drawFolk(c, f));
    if (me.state !== 'sit') {
      const carry = !!me.pop;
      const sd = selfDrawable(A, walker, t, { carry, folksHere: fl.length });
      add(walker.py + 0.01, (c) => {
        if (carry && walker.dir === 'up') drawBucketHeld(c, walker.px, walker.py, 'up', me.pop);
        sd.draw(c);
        if (carry && walker.dir !== 'up') drawBucketHeld(c, walker.px, walker.py, walker.dir, me.pop);
      });
    }
    items.sort((a, b) => a.fy - b.fy).forEach((it) => it.draw(ctx));
    // pratbubblorna från foajéns besökare
    for (const P of folk) if (P.bubble && P.bubble.until > t && P.state !== 'inside' && P.state !== 'away') { const [bx, by] = P.state === 'sofa' && P.seat ? [P.seat.x, P.seat.y - 40] : [P.w.px, P.w.py - 44]; sayBubble(ctx, Math.round(bx), Math.round(capY({ x: bx, y: by }, P.bubble.text, SAY_W, 4).y), P.bubble.text, { x0: visX0, x1: visX1, voice: false }); }
    const vis = { x0: visX0, x1: visX1 };
    talkKass.draw(ctx, vis); talkGodis.draw(ctx, vis); talkVakt.draw(ctx, vis);
  }

  // ---------- salongen ----------
  // projektorstrålen: en dithrad ljuskägla från maskinrummet (bakom oss) till duken,
  // tätast i mitten och svagare ut mot kanterna – och dukens sken i filmens färg
  const beam = (() => {
    const P = new Pix(W, H), y0 = S.FILM.y + 80;
    for (let y = y0; y < H; y++) {
      const k = (y - y0) / (H - y0), half = 120 * (1 - k) + 5 * k;
      for (let x = Math.round(288 - half); x < 288 + half; x++) {
        const e = Math.abs(x - 288) / half, dens = (1 - e * e) * 0.34 + 0.04;
        if (bayer(x, y) < dens) P.px(x, y, 0xd8e4ff, 0.09 + 0.06 * (1 - e));
      }
    }
    return P.flush();
  })();
  const spillMask = (() => {
    const P = new Pix(W, H);
    P.ell(288, S.FRAME.y1 + 18, 250, 34, 0xffffff, 0.36, 5);
    P.ell(288, S.FRAME.y1 + 40, 200, 40, 0xffffff, 0.2, 4);
    for (const sx of [S.FILM.x + 8, S.FILM.x + 232]) P.ell(sx, 60, 30, 46, 0xffffff, 0.12, 3);
    return P.flush();
  })();
  const SPILL = new Map();
  function spillFor(col) {
    let c = SPILL.get(col);
    if (c) return c;
    c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.drawImage(spillMask, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = css(mix(col, 0xffffff, 0.25)); x.fillRect(0, 0, W, H);
    if (SPILL.size > 60) SPILL.clear();
    SPILL.set(col, c);
    return c;
  }
  function drawCredits(ctx, u) {
    const { x, y } = S.FILM, f = show.film;
    ctx.fillStyle = '#060406'; ctx.fillRect(x, y, FILM_W, FILM_H);
    const lines = [[f.titel, '#f0cc5a'], ['', ''], ['I ROLLERNA', '#8a7a6a'], ...(ROLLER[f.id] || []).map(([a, b]) => [`${a} ... ${b}`, '#e8e0d0']), ['', ''], ['REGI  ALVA PIXELBERG', '#e8e0d0'], ['MUSIK  BOSSE BLIPP', '#e8e0d0'], ['', ''], ['INSPELAD I PIXELSTADEN', '#8a7a6a'], ['', ''], ['BIO PIXEL', '#f0cc5a']];
    const total = lines.length * 9 + FILM_H, off = Math.round(FILM_H - (u / CRED) * total);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, FILM_W, FILM_H); ctx.clip();
    lines.forEach(([s, col], i) => { if (!s) return; const yy = y + off + i * 9; if (yy < y - 8 || yy > y + FILM_H) return; ctxText(ctx, SMALL, s, x + ((FILM_W - textW(SMALL, s)) >> 1), yy, col); });
    ctx.restore();
  }
  function drawSalong(ctx, cx, vw) {
    ctx.drawImage(bgS(), 0, 0);
    const L = lights(), ph = showPhase();
    // duken: filmen, eftertexterna eller den tomma duken bakom ridån
    if (show && (ph === 'film' || (ph === 'dim' && show.t > 1))) drawFilm(ctx, show.film, filmT(), S.FILM.x, S.FILM.y);
    else if (show && ph === 'slut') drawCredits(ctx, show.t - DIM - show.filmDur);
    drawCurtain(ctx, L.open);
    // utgångsdörren står öppen en stund när någon går igenom
    if (sDoor > 0.05) { const D = S.DOOR, ow = Math.round(sDoor * (D.x1 - D.x0 - 4)); ctx.fillStyle = '#f0d0a0'; ctx.fillRect(D.x0 + 2, D.top + 1, ow, S.WALL_Y - D.top - 1); ctx.fillStyle = '#c89a6a'; ctx.fillRect(D.x0 + 2, S.WALL_Y - 8, ow, 8); }

    // ---- publiken, stolsraderna och de som går ----
    const items = [];
    const add = (fy, draw) => items.push({ fy, draw });
    const fl = folksHere();
    markRemoteSeats(fl);
    S.ROW_Y.forEach((ry, k) => {
      add(ry, (c) => {
        for (const s of seats) {
          if (s.row !== k || !s.occ) continue;
          const o = s.occ;
          if (o === 'me') {
            if (me.seat !== s) continue;
            const [x, y] = seatPos(s, 'me');
            drawPerson(c, x, y, A.avatar.look, me.slide ? (s.x < x ? 'left' : 'right') : 'up', me.slide ? WALK_SEQ[Math.floor(t * 8.5) % 4] : me.eating > 0 ? 6 : 5);
            if (me.pop && !me.slide) c.drawImage(bucketImg(me.pop.left, me.pop.total, true), s.x + 6, ry - 23);
            continue;
          }
          if (o.state === 'remote') continue;
          if (o.state !== 'sit') continue;
          const [x, y] = seatPos(s, o);
          let bob = 0;
          const r = o.react && o.react.until > t ? o.react : null;
          if (r) {
            const u = t - r.t0;
            if (r.kind === 'skratt' || r.kind === 'heja') bob = Math.floor(u * 9) & 1;
            else if (r.kind === 'oj') bob = u < 0.3 ? 2 : 0;
            else if (r.kind === 'grat') bob = Math.floor(u * 3) & 1;
          }
          drawPerson(c, x, y - bob, o.look, o.slide ? 'left' : 'up', o.slide ? WALK_SEQ[Math.floor(t * 8.5) % 4] : o.eating > 0 ? 6 : 5);
          if (r && r.kind === 'grat' && (Math.floor(t * 4) & 1)) { c.fillStyle = '#f4f4f4'; c.fillRect(x + 3, y - 30, 2, 2); }   // näsduken
          if (o.pop && !o.slide) c.drawImage(bucketImg(o.pop.left, o.pop.total, true), s.x + 6, ry - 23);
        }
        for (const f of fl) if (f.sit && !f.walking && Math.abs(f.y - ry) < 3) drawFolk(c, f);
        c.drawImage(rowImgs[k], 0, ry - 20);
      });
    });
    for (const G of aud) if ((G.state === 'late' || G.state === 'leave') && G.w) add(G.w.py, (c) => {
      const walking = G.w.path.length > 0;
      drawPerson(c, G.w.px, G.w.py, G.look, G.w.dir, walking ? WALK_SEQ[Math.floor(t * 7) % 4] : 0);
      if (G.pop && G.state === 'late') c.drawImage(bucketImg(G.pop.left, 7), Math.round(G.w.px) + (G.w.dir === 'left' ? -11 : 3), Math.round(G.w.py) - 23);
    });
    for (const f of fl) if (!(f.sit && !f.walking)) add(f.y, (c) => drawFolk(c, f));
    if (me.state !== 'sit') {
      const carry = !!me.pop;
      const sd = selfDrawable(A, walker, t, { carry, folksHere: fl.length });
      add(walker.py + 0.01, (c) => {
        if (carry && walker.dir === 'up') drawBucketHeld(c, walker.px, walker.py, 'up', me.pop);
        sd.draw(c);
        if (carry && walker.dir !== 'up') drawBucketHeld(c, walker.px, walker.py, walker.dir, me.pop);
      });
    }
    items.sort((a, b) => a.fy - b.fy).forEach((it) => it.draw(ctx));
    // popcorn som flyger när folk skrattar
    for (const k of kernels) { ctx.fillStyle = '#fff6d8'; ctx.fillRect(Math.round(k.x), Math.round(k.y), 1, 1); }

    // ---- ljuset släcks: allt mörknar utom duken ----
    if (L.dark > 0.01) {
      ctx.save();
      ctx.beginPath(); ctx.rect(cx - 2, 0, vw + 4, H); ctx.rect(S.FILM.x, S.FILM.y, FILM_W, FILM_H);
      ctx.clip('evenodd');
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = css(mix(0xffffff, 0x10101c, L.dark));
      ctx.fillRect(cx - 2, 0, vw + 4, H);
      // dukens sken över publiken i filmens färg
      if (show && (ph === 'film' || ph === 'slut')) {
        ctx.globalCompositeOperation = 'lighter';
        const lc = ph === 'film' ? filmLight(show.film, filmT()) : 0x302820, flick = 0.85 + Math.sin(t * 23) * 0.05 + Math.sin(t * 7) * 0.05;
        ctx.globalAlpha = flick * L.dark;
        ctx.drawImage(spillFor(lc), 0, 0);
        ctx.globalAlpha = 0.8 * L.dark;
        ctx.drawImage(beam, 0, 0);
        // dammkorn i strålen
        ctx.globalAlpha = 0.55 * L.dark; ctx.fillStyle = '#e8f0ff';
        for (let n = 0; n < 26; n++) { const k = (hash(n, 1, 7) + t * 0.02 * (1 + hash(n, 2, 7))) % 1, y = S.FILM.y + 80 + k * (H - S.FILM.y - 80), half = 120 * (1 - k) + 6 * k; ctx.fillRect(Math.round(288 + (hash(n, 3, 7) * 2 - 1) * half * 0.9 + Math.sin(t + n) * 2), Math.round(y), 1, 1); }
      }
      ctx.restore();
      // det som lyser i mörkret: utgångsskyltarna, steglamporna, rampljuset
      ctx.save(); ctx.globalAlpha = L.dark;
      for (const [D, label] of [[S.DOOR, 'UTGÅNG'], [S.NOD, 'NÖDUTGÅNG']]) {
        const lw = textW(SMALL, label) + 6, lxx = ((D.x0 + D.x1) >> 1) - (lw >> 1), ly = D.top - 14;
        ctx.fillStyle = '#1a8a3a'; ctx.fillRect(lxx + 1, ly + 1, lw - 2, 7); ctxText(ctx, SMALL, label, lxx + 3, ly + 2, '#f4fff4');
      }
      for (const a of S.AISLES) S.ROW_Y.forEach((y, k) => { const py = k === 0 ? 126 : S.ROW_Y[k - 1] + 5; ctx.fillStyle = '#ffb040'; ctx.fillRect(a - 17, py + 1, 1, 1); ctx.fillRect(a + 17, py + 1, 1, 1); });
      ctx.restore();
    }
    // pratbubblor: publiken (bara där talaren syns) och min egen
    for (const b of bubbles) { const s = b.G.seat; if (!s || s.x < visX0 - 8 || s.x > visX1 + 8) continue; sayBubble(ctx, s.x, capY({ x: s.x, y: s.y - 36 }, b.text, SAY_W, 4).y, b.text, { x0: visX0, x1: visX1, voice: false }); }
  }

  // ---------- panelen i hörnet: biljetten och popcornen ----------
  // ritas nere till vänster, över golvet – skyltarna på väggen syns alltid. Svarar med sin högerkant.
  function drawPanel(ctx) {
    const lines = [];
    if (me.biljett) lines.push(['bilj', `BILJETT: ${filmById(me.biljett)?.titel || ''}`]);
    if (me.pop && !(show && showPhase() === 'film')) lines.push(['pop', `POPCORN ${me.pop.left}/${me.pop.total}`]);
    if (!lines.length) return 0;
    const w = Math.max(...lines.map(([, s]) => textW(SMALL, s))) + 18, h = lines.length * 11 + 3;
    const sx = (A.view?.safe?.x0 ?? 0) + 4, sy = Math.min(H, A.view?.safe?.y1 ?? H) - h - 5;
    ctx.fillStyle = '#17151a'; ctx.fillRect(sx - 1, sy - 1, w + 2, h + 2);
    ctx.fillStyle = '#2a1018'; ctx.fillRect(sx, sy, w, h);
    ctx.fillStyle = '#c8a44a'; ctx.fillRect(sx, sy, w, 1);
    lines.forEach(([k, s], i) => {
      const y = sy + 3 + i * 11;
      if (k === 'bilj') { ctx.fillStyle = '#f4ecd8'; ctx.fillRect(sx + 3, y, 10, 7); ctx.fillStyle = '#c8262e'; ctx.fillRect(sx + 3, y + 2, 10, 1); ctx.fillStyle = '#2a1018'; ctx.fillRect(sx + 8, y + 4, 1, 1); ctx.fillRect(sx + 8, y + 6, 1, 1); }
      else ctx.drawImage(bucketImg(me.pop.left, me.pop.total, true), sx + 5, y);
      ctxText(ctx, SMALL, s, sx + 16, y + 1, '#f4ecd8');
    });
    return sx + w + 2;
  }

  // ======================= uppdatering =======================
  function update(dt) {
    // sidan är undanlagd: scenen står still (provisoriskt inräknat) tills den syns igen
    if (prov) { if (document.visibilityState === 'hidden') return; undoProvisional(); }
    t += dt;
    walker.update(dt);
    if (pendingRoom && t >= pendingRoom.at) { const to = pendingRoom.to; pendingRoom = null; if (to === 'salong') goSalong(); }
    updateMe(dt);
    updateShow(dt);
    updateAud(dt);
    updateStaff(dt);
    for (const P of folk) updateFolk(P, dt);
    updateDoors(dt);
    updatePops(dt);
    const k = lockedCam !== null ? 1 : Math.min(1, dt * 6);
    cam.x += (camTarget() - cam.x) * k;
    const ky = camYTarget() - cam.y;
    cam.y = Math.abs(ky) < 0.3 ? camYTarget() : cam.y + ky * Math.min(1, dt * 5);
  }
  for (let i = 0; i < 40; i++) updatePops(1 / 15);

  function dbg() {
    return {
      rum, me: me.state, seat: me.seat?.id || null, biljett: me.biljett, pop: me.pop ? { left: me.pop.left, total: me.pop.total, settled: !!me.pop.settled } : null, order: !!me.order,
      camY: Math.round(cam.y), prov: !!prov,
      show: show ? { film: show.film.id, phase: showPhase(), t: +show.t.toFixed(2), total: +show.total.toFixed(2), filmT: +filmT().toFixed(2), minEff: show.minEff, startMin: show.startMin, given: show.given } : null,
      lights: lights(), reward: me.reward, sett: [...me.sett],
      money: g.money, hunger: Math.round(g.hunger), energy: Math.round(g.energy), min: Math.round(g.min),
      x: Math.round(walker.px), y: Math.round(walker.py), path: walker.path.length, say: talk.text(), kass: talkKass.text(), godis: talkGodis.text(), vakt: talkVakt.text(),
      aud: aud.length, sitting: aud.filter((G) => G.state === 'sit').length, reacting: aud.filter((G) => G.react && G.react.until > t).length, bubbles: bubbles.map((b) => b.text),
      folk: folk.map((P) => P.state), door: +doorF.toFixed(2), open: isOpen(), tickets: ticketsOpen(), popOpen: popOpen(),
    };
  }
  // pratbubblornas lägen på skärmen (spelpixlar, samma som A.view.safe) – för testerna
  function bubbleBoxes() {
    const out = [], cy = Math.round(cam.y), was = clampOn;
    clampOn = true;
    for (const [who, sp, at] of [['me', talk, meAt], ['kass', talkKass, kassAt], ['godis', talkGodis, godisAt], ['vakt', talkVakt, vaktAt]]) {
      const text = sp.text();
      if (!text) continue;
      const p = at(), h = sayLines(text, 124, 5).reduce((a, l) => a + (l.some((q) => q.emoji) ? 10 : 7), 0) + 4;
      out.push({ who, text, top: p.y - h - 5 + cy, bot: p.y - 1 + cy });
    }
    clampOn = was;
    const [y0, y1] = safeY();
    return { camY: cy, y0, y1, list: out };
  }

  // ---------- gå mitt i filmen ----------
  // Bara via UTGÅNG, och vi frågar först. Popcornen får inte följa med ut: har man kvar i
  // bägaren erbjuds "ät upp snabbt och gå" – resten räknas in (ätregeln: uppäten sittande).
  function askLeave() {
    const pop = !!(me.pop && me.pop.left > 0);
    openModal('🎬 Gå mitt i filmen?', `<p style="font-size:var(--f2);margin-top:0">${esc(show.film.titel)} är inte slut än. Går du nu missar du slutet – och får bara så mycket energi som du hunnit se.${pop ? ' Popcornen får inte följa med ut – den äter du upp innan du går.' : ''}</p>`, [
      { label: '🍿 Stanna kvar', cls: 'btn-go', onClick: closeModal },
      pop
        ? { label: '😋 Ät upp snabbt och gå', onClick: () => { closeModal(); gobble(); leaveShow(); } }
        : { label: '🚪 Gå ut', onClick: () => { closeModal(); leaveShow(); } },
    ]);
  }
  function gobble() {
    if (!me.pop) return;
    settlePop();
    me.pop = null; me.eating = 0;
    g.save();
    play('ok');
    talk.say('😋 GLUFS! Uppätet – nu går jag.', meAt, 2.2);
  }
  function leaveShow() {
    if (me.pop) return;                                   // (kan inte hända: gobble() först)
    standUp();
    walker.walkTo(...SDOOR_SPOT, () => goFoaje());
  }

  return {
    viewMax: { w: W, h: H },
    get worldX() { return me.seat ? me.seat.x : walker.px; },
    get worldY() { return (me.seat ? me.seat.y : walker.py) + (rum === 'salong' ? SALONG_DY : 0); },
    get worldSit() { return me.state === 'sit' && me.seat && !me.slide ? { dir: me.seat.dir, eat: !!me.pop } : null; },
    enter() {
      play('door');
      doorFT = t + 1;
      if (isOpen()) setTimeout(() => talkKass.say(isNight() ? 'God kväll och välkommen till Bio Pixel!' : 'Välkommen till Bio Pixel!', kassAt), 500);
      else talk.say(`🔒 Bion öppnar ${clock(HOURS[0] * 60)}.`, meAt);
    },
    _debug: {
      state: dbg,
      hours: () => ({ hours: HOURS.slice(), open: isOpen(), tickets: ticketsOpen(), sista: SISTA_BILJETT }),
      films: () => FILMER.map((f) => ({ id: f.id, titel: f.titel, langd: +f.langd.toFixed(2), cues: f.cues.length })),
      // skärmläget (spelpixlar) att klicka på; kameran låses i sidled om platsen ligger utanför
      // bild och ställs direkt i höjdled (cam.y), så att klicket träffar
      spot: (id) => {
        cam.y = camYTarget();
        const cy = Math.round(cam.y);
        const h = hot().find((q) => q.id === id);
        if (h) {
          const x = (h.r[0] + h.r[2]) / 2, y = (h.r[1] + h.r[3]) / 2;
          if (x - cam.x < 8 || x - cam.x > VW - 8) { lockedCam = clamp(x - VW / 2, 0, W - VW); cam.x = lockedCam; }
          return { x: x - cam.x, y: y + cy };
        }
        let s = seatById(id);
        if (!s && id === 'plats') s = seats.filter((q) => !q.occ).sort((a, b) => Math.abs(a.x - 288) + a.row * 3 - (Math.abs(b.x - 288) + b.row * 3))[0];
        if (!s && id === 'soffa') s = sofaSeats.find((q) => !q.occ);
        if (!s) return null;
        if (s.x - cam.x < 8 || s.x - cam.x > VW - 8) { lockedCam = clamp(s.x - VW / 2, 0, W - VW); cam.x = lockedCam; }
        return { x: s.x - cam.x, y: s.y - 12 + cy, id: s.id };
      },
      lockCam: (x) => { lockedCam = x === null || x === undefined ? null : clamp(x, 0, W - VW); cam.x = camTarget(); },
      cam: () => cam.x,
      view: () => { const [y0, y1] = safeY(), cy = Math.round(cam.y); return { camY: cy, y0, y1, target: Math.round(camYTarget()), filmTop: S.FILM.y + cy, filmBot: S.FILM.y + FILM_H + cy, meTop: (me.seat ? me.seat.y : walker.py) - 50 + cy, meBot: (me.seat ? me.seat.y : walker.py) + 2 + cy }; },
      bubbles: () => bubbleBoxes(),
      teleport: (x, y) => { if (me.state === 'sit') standUp(); walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); cam.x = camTarget(); cam.y = camYTarget(); },
      tick: (sec) => { for (let i = 0; i < sec * 30; i++) update(1 / 30); return dbg(); },
      buyTicket: (id) => buyTicket(id),
      buyPopcorn: () => { const r = buyPopcorn(); for (let i = 0; i < 450 && !me.pop && me.state === 'waitPop'; i++) update(1 / 30); return r; },
      sit: (id) => { const s = seatById(id); if (!s || s.occ) return false; if (me.state === 'sit') standUp(); goSit(s); for (let i = 0; i < 900 && me.state !== 'sit' && (walker.path.length || me.res); i++) update(1 / 30); return me.state === 'sit'; },
      goSalong: () => { goSalong(); return rum; },
      goFoaje: () => { goFoaje(); return rum; },
      // spola fram föreställningen (i steg om 1/30 s, så att allt händer som vanligt)
      fast: (sec = 999) => { for (let i = 0; i < sec * 30 && show; i++) update(1 / 30); return dbg(); },
      react: (kind) => react(kind),
      leave: () => leaveBio(),
      aud: () => aud.map((G) => ({ state: G.state, seat: G.seat?.id, react: G.react && G.react.until > t ? G.react.kind : null })),
      seats: () => roomSeats().map((s) => ({ id: s.id, x: s.x, y: s.y, occ: s.occ === 'me' ? 'me' : s.occ ? 'npc' : null })),
      walkable: (x, y) => walker.walkable(x, y),
      hideFolk: () => { for (const P of folk) { if (P.seat && P.seat.occ === P) P.seat.occ = null; P.seat = null; P.state = 'away'; P.t = 999; } queue.length = 0; },
      panorama: (which = rum, scale = 1) => {
        const was = rum; rum = which;
        const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.setTransform(scale, 0, 0, scale, 0, 0);
        if (which === 'salong') drawSalong(x, 0, W); else drawFoaje(x, 0, W);
        rum = was;
        return c.toDataURL('image/png');
      },
    },
    update,
    down(sx, sy) {
      const x = sx + cam.x, y = sy - Math.round(cam.y);
      hoverId = null;
      if (me.state === 'waitPop') { if (t - me.msgT > 2) { talkGodis.say('🍿 Jag fyller din bägare – två sekunder!', godisAt); me.msgT = t; } return; }
      const h = spotAt(x, y);
      const midFilm = me.state === 'sit' && me.seat?.kind === 'salong' && show && !show.given;
      // mitt i filmen: ut bara via utgången, och då frågar vi först (popcornen äts upp innan)
      if (midFilm && h && h.id === 'utgang') { askLeave(); return; }
      // sitter och äter: kvar tills bägaren är tom (att prata går bra)
      if (me.state === 'sit' && me.pop) {
        if (h && (h.id === 'dorr')) { nag(MSG_DORR); return; }
        nag(MSG_ATUPP);
        return;
      }
      // mitt i filmen: tyst i salongen
      if (midFilm) {
        if (t - me.msgT > 1.5) { talk.say('🤫 SCH! Filmen pågår.', meAt, 1.6); me.msgT = t; }
        return;
      }
      // med popcorn i händerna (eller på väg från Kevin) kommer man inte ut på gatan
      if ((me.pop || me.order) && h && h.id === 'dorr') { nag(me.pop ? MSG_DORR : MSG_VANTA); return; }
      const s = seatAt(x, y);
      if (s && !s.occ) { if (me.state === 'sit') standUp(); goSit(s); play('click'); return; }
      if (s && s.occ && s.occ !== 'me') {
        if (s.occ.state === 'sit' && t - me.msgT > 1.2) { say(s.occ, ['UPPTAGET!', 'HÄR SITTER JAG.', 'SCH!'][(Math.random() * 3) | 0], 1.6); me.msgT = t; }
        else if (s.occ.state === 'sofa' && t - me.msgT > 1.2) { s.occ.bubble = { text: ['HEJ!', 'VI VÄNTAR PÅ FILMEN.', 'VILL DU HA POPCORN?'][(Math.random() * 3) | 0], until: t + 2.4 }; me.msgT = t; play('click'); }
        else if (t - me.msgT > 1.2) { talk.say('😕 Där sitter någon redan!', meAt); me.msgT = t; }
        return;
      }
      if (me.state === 'sit') standUp();
      release();
      if (h) { const [gx, gy] = h.go(x); walker.walkTo(gx, gy, h.act); return; }
      const top = rum === 'salong' ? S.WALL_Y : F.WALL_Y;
      if (y > top) walker.walkTo(x, y);
    },
    move(sx, sy) { const x = sx + cam.x, y = sy - Math.round(cam.y); hoverId = spotAt(x, y)?.id || (seatAt(x, y)?.id ?? null); hoverT = t; },
    key() {},
    leaveBlock(o) {
      const why = me.pop ? MSG_DORR : me.order ? MSG_VANTA : null;
      if (why && !o?.quiet) nag(why);
      return why;
    },
    exit() {
      filmMusic(null); filmAmb(null);
      for (const [el, ev] of UNLOAD) el.removeEventListener(ev, onPage, true);
      const any = settleAll();                            // popcornen, biljetten tillbaka, delbelöningen
      me.pop = null; me.order = null;
      if (any) g.save();
      talk.clear(); talkKass.clear(); talkGodis.clear(); talkVakt.clear();
    },
    draw(ctx) {
      syncView();
      const cx = Math.round(cam.x), cy = Math.round(cam.y), sf = A.view?.safe;
      visX0 = cx + Math.max(0, sf?.x0 | 0); visX1 = cx + Math.min(VW, sf?.x1 ?? VW);
      if (visX1 - visX0 < 120) { visX0 = cx; visX1 = cx + VW; }
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, cy * A.pxs);
      clampOn = true;
      try {
        if (rum === 'salong') drawSalong(ctx, cx, VW); else drawFoaje(ctx, cx, VW);
        talk.draw(ctx, { x0: visX0, x1: visX1 });
      } finally { clampOn = false; }
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      const panelR = drawPanel(ctx);
      // skylt i nederkanten när man pekar på något klickbart
      const h = hoverId && t - hoverT < 3 ? hoverId : null;
      let label = null;
      if (h) {
        if (h === 'dorr') label = me.pop || me.order ? 'ÄT UPP POPCORNEN FÖRST - SEN KAN DU GÅ UT' : 'GÅ UT PÅ GATAN';
        else if (h === 'lucka') label = ticketsOpen() ? `BILJETTLUCKAN - BILJETT ${BIO_PRIS.biljett} KR` : 'BILJETTLUCKAN - STÄNGD';
        else if (h === 'bar') label = popOpen() ? `POPCORN ${BIO_PRIS.popcorn} KR` : 'GODISBAREN - STÄNGD';
        else if (h === 'salong' || h === 'vakt') label = me.biljett ? 'SALONG 1 - VISA BILJETTEN' : 'SALONG 1 - BARA MED BILJETT';
        else if (h === 'kartong') label = 'PIXELHÄMNAREN 3 - PREMIÄR!';
        else if (h === 'klo') label = 'GRIPKLON';
        else if (h.startsWith('affisch')) { const f = FILMER[+h.slice(7)]; label = `${f.titel} - ${f.genre} ${f.alder}`; }
        else if (h.startsWith('staffli')) { const f = FILMER[F.POSTERS.length + +h.slice(7)]; label = `PREMIÄR! ${f.titel}`; }
        else if (h === 'utgang') label = 'UTGÅNG - TILL FOAJÉN';
        else if (h === 'nodutgang') label = 'NÖDUTGÅNG';
        else if (h === 'duk') label = 'DUKEN';
        else { const s = seatById(h); if (s) label = s.occ && s.occ !== 'me' ? 'UPPTAGEN' : s.kind === 'salong' ? `RAD ${s.row + 1} PLATS ${SEAT_XS.indexOf(s.x) + 1}` : 'SOFFAN - SITT OCH ÄT'; }
      }
      if (label) {
        const w = textW(SMALL, label) + 10, x1 = Math.min(VW, A.view?.safe?.x1 ?? VW), yb = Math.min(H, A.view?.safe?.y1 ?? H);
        const x0 = Math.max(A.view?.safe?.x0 ?? 0, panelR + 2);
        const lx = Math.round(Math.max(x0, (x0 + x1 - w) / 2));
        ctx.fillStyle = '#17151a'; ctx.fillRect(lx, yb - 14, w, 11);
        ctx.fillStyle = '#c8a44a'; ctx.fillRect(lx + 1, yb - 13, w - 2, 1);
        ctxText(ctx, SMALL, label, lx + 5, yb - 10, '#f4f1ea');
      }
    },
  };
}
