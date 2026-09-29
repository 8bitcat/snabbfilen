// MÖBELJÄTTEN – varuhuset "som IKEA", i två plan man går runt i.
//
//  PLAN 1 (entréplanet): man kommer in genom de blågula glasdörrarna till
//  entréhallen (info, Småland, kundvagnar) och tar RULLTRAPPAN eller HISSEN upp.
//  PLAN 2 (utställningen): den gula gången slingrar sig genom små inredda rum
//  (vardagsrum, kök, kontor, sovrum, barnrum, badrum, hall …) och förbi
//  RESTAURANGEN (köttbullar med mos och lingonsylt) till rulltrappan ner.
//  Tillbaka på plan 1: MARKNADSHALLEN (textil, matlagning, belysning, krukor,
//  dekoration), SJÄLVBETJÄNINGSLAGRET med pallställ, KASSORNA och utgången med
//  korvkiosken.
//
// Allt ritas i spelets pixelkorn. Varje möbel i katalogen (GAME.KATALOG, läses
// vid körning) står utställd med gul prislapp – klick = figuren går dit och
// köpdialogen öppnas (openBuy i shop-mobler.js). Personal i gula tröjor jobbar
// och pratar, kunder strosar och provsitter, åker rulltrappa och äter.
//
// MATEN (samma regel som i alla matställen): brickan från restaurangen och
// korven/glassen från kiosken bärs i händerna (bär-bildrutorna) tills man satt
// sig vid ett ledigt bord – restaurangens bord på plan 2, bistroborden vid
// kiosken på plan 1. Man äter bit för bit (mättheten och energin kommer med
// varje tugga), reser sig inte förrän allt är uppätet ("ÄT UPP FÖRST! 😋") och
// kommer inte ut ur matsalen med maten i händerna ("DU MÅSTE SÄTTA DIG OCH ÄTA
// UPP!"). När det är uppätet försvinner brickan/tallriken och man kan gå.
//
// Hjälpfilerna ligger i js/scenes/ikea/: geo (mått), kat (katalogen), plan
// (vad som står i vilket rum), layout (planlösningen), furnish (rekvisita,
// hinder, klick), paint (bakgrunden), folk (människorna), resto (menyn),
// art*/food (penslarna).
import { SMALL, ctxText, textW } from '../core/floor-pix.js';
import { openModal, closeModal, toast } from '../core/ui.js';
import { play } from '../core/sound.js';
import { createWalker, WALK_SEQ, emoteBubble, createSpeech } from './walkable.js';
import { drawPerson } from '../core/people.js';
import { worldMyEmote } from '../net/world.js';
import * as ROOM from './room.js';
import * as MOB from './shop-mobler.js';
import { VW, VH, H, OW, A_FLOOR, B_WALL, B_FLOOR, AISLE1, AISLE2, SPEED, clamp, camYFor, syncView } from './ikea/geo.js';
import { KAT, katOf, frameOf, tagName, katSig, isElektronik, elektronikName } from './ikea/kat.js';
import { buildFloors, DECOR } from './ikea/layout.js';
import { furnish } from './ikea/furnish.js';
import { paintFloorBg } from './ikea/paint.js';
import { tagImg, outlineImg, boxImg } from './ikea/art.js';
import { escalatorArt, escPos, pitFrontImg, liftCabImg, liftDoorImg, drawLiftIndicator, LIFT_W, LIFT_H, ESC_PERIOD } from './ikea/art-transit.js';
import { makeFolk, textBubble, TIPS } from './ikea/folk.js';
import { openMenu, openKiosk, menuOf, addBistro, diningZone } from './ikea/resto.js';
import { trayImg, dishImg, drawMenuStrip, TRAY_W } from './ikea/food.js';
import { smalandBackImg } from './ikea/art-props.js';

const RIDE_V = 40;          // rulltrappans fart (px/s längs trappan)
const LIFT_T = { open: 0.5, in: 0.55, close: 0.45, move: 1.5, out: 0.55 };
// samma två repliker som i Kaféet och Burgarbaren: sitter man och äter reser man
// sig inte (ÄT UPP FÖRST), mot utgången/rulltrappan/hissen gäller alltid MSG_DORR
const MSG_ATUPP = 'ÄT UPP FÖRST! 😋';
const MSG_DORR = 'DU MÅSTE SÄTTA DIG OCH ÄTA UPP!';
const DAY_MIN = 24 * 60;    // midnatt i spelminuter (som DAY i game.js)

// ================= varuhuset (byggs en gång, cachas tills katalogen ändras) =================
let STORE = null;
function buildStore() {
  const floors = buildFloors();
  for (const F of floors) {
    furnish(F);
    addBistro(F); // bistroborden vid korvkiosken (plan 1) – före gånghindren
    F.walker = createWalker({ W: F.W, H, left: OW + 2, right: F.W - OW - 2, top: A_FLOOR + 3, bottom: H - 5, spawn: F.spawn });
    F.walker.speed = SPEED;
    F.walker.setObstacles(F.obstacles);
    for (const e of F.esc) e.riders = [];
    F.lift.open = 0; F.lift.car = 1; F.lift.arrow = null;
    F.bg = null; F.folk = null;
  }
  return { sig: katSig(), floors };
}
const bgOf = (F) => (F.bg ||= paintFloorBg(F));
const artOf = (e) => (e.art ||= escalatorArt(e));

// ================= scenen =================
export function makeShopIkea(A, opts = {}) {
  if (!STORE || STORE.sig !== katSig()) STORE = buildStore();
  const S = STORE, g = A.game;
  let rng = mulberry(g.day * 977 + 13);
  let F = S.floors[0];
  let t = 0, lockedCam = null, hover = null, near = null, fade = 0;
  let ride = null;   // { kind: 'esc'|'lift', … } – medan man åker
  let meal = null;   // maten: restaurangbrickan (plan 2) eller korven/glassen från kiosken (plan 1)
  let myBubble = null;                 // rulltrappans korta rop
  const talk = createSpeech();         // mina repliker om maten (ÄT UPP FÖRST! …)
  const cam = { x: 0, y: 0 };
  const W = () => F.W;
  const walker = () => F.walker;
  const folkOf = (fl) => (fl.folk ||= makeFolk(fl, rng));

  // start: vid entrédörren (eller där opts säger)
  const start = opts.floor === 2 ? S.floors[1] : S.floors[0];
  enterFloor(start, start.spawn);

  function enterFloor(fl, at) {
    F = fl;
    const w = F.walker;
    w.stop(); w.px = at[0]; w.py = at[1]; w.snapFree(); w.dir = 'down';
    folkOf(F);
    bgOf(F);
    hover = null; near = null;
    Object.assign(cam, camTarget());
  }
  function camTarget() {
    if (lockedCam) return lockedCam;
    const [px, py] = playerPos();
    return { x: clamp(px - VW / 2, 0, W() - VW), y: camYFor(py) };
  }
  function playerPos() {
    if (ride?.kind === 'esc') return escPos(ride.e, Math.max(0, ride.d));
    if (ride?.kind === 'lift') return ride.pos;
    if (meal?.seat && (meal.st === 'sit' || meal.st === 'eat' || meal.st === 'done')) return [meal.seat.x, meal.seat.y];
    return [walker().px, walker().py];
  }

  // ---------- klick ----------
  const hitAt = (x, y) => F.clicks.find((c) => x >= c.hot[0] && x <= c.hot[2] && y >= c.hot[1] && y <= c.hot[3]) || null;
  // ett vänligt "vänta lite" när klick inte går att göra något med (högst ett per sekund)
  let nagAt = -9;
  const nag = (msg) => { if (t - nagAt > 1.2) { nagAt = t; toast(msg); } };
  const arrivalInfo = () => {
    play('chirp');
    toast(F.n === 2
      ? '↗️ Den här rulltrappan kommer bara UPP hit från plan 1. Rulltrappan NER står längre fram i hallen – efter restaurangen.'
      : '↘️ Den här rulltrappan kommer bara NER hit från plan 2. Rulltrappan UPP står vid entrén, bredvid hissen.');
  };
  function act(c) {
    if (c.kind === 'buy') {
      play('click');
      if (typeof MOB.openBuy === 'function') MOB.openBuy(A, c.ex.k);
      else toast('Köpdialogen laddas – försök igen om en stund.');
    } else if (c.kind === 'decor' && isElektronik(c.ex.k)) { play('chirp'); toast(`📺 ${elektronikName(c.ex.k, c.ex.v)} är bara utställd – TV, datorer och spelkonsoler köper du på BLIXT ELEKTRONIK i Downtown!`); }
    else if (c.kind === 'decor') toast(`${DECOR[c.ex.k] || 'Den'} är bara utställd – den ingår i bostaden och säljs inte här.`);
    else if (c.kind === 'door') { play('door'); A.go('city'); }
    else if (c.kind === 'exit') { play('door'); toast('🛍️ Tack för besöket på MÖBELJÄTTEN – välkommen åter!', 'good'); A.go('city'); }
    else if (c.kind === 'esc') startEsc(c.esc);
    else if (c.kind === 'escArr') arrivalInfo();
    else if (c.kind === 'lift') startLift();
    else if (c.kind === 'rest') openRestMenu();
    else if (c.kind === 'table') sitAtTable(c.table);
    else if (c.kind === 'food') openKiosk(A, { onBuy: buySnack });
    else if (c.kind === 'info') openGuide();
    else if (c.kind === 'kassa') { play('chirp'); toast('🧾 Möblerna betalar du direkt vid prislappen – här säger vi bara hej då. Kasse? Ta en blå!'); }
    else if (c.kind === 'play') { play('chirp'); toast('🎈 Småland är för barn upp till 1,20 m – du får titta på bollhavet!'); }
  }
  function clickWorld(x, y) {
    if (ride) { nag(ride.kind === 'lift' ? '🛗 Vänta tills hissen är framme!' : '↕️ Vänta tills du klivit av rulltrappan!'); return; }
    if (meal && mealClick(x, y)) return;
    // personal först (bara om man träffar figuren)
    const s = F.folk.staffAt(x, y);
    if (s) {
      const w = walker(), sx = walker().px < s.x ? -14 : 14;
      const cand = s.mode === 'truck' ? [[s.x + 23, s.y + 18]] : [[s.x + sx, s.y + 6], [s.x - sx, s.y + 6], [s.x, s.y + 24], [s.x, s.y + 34], [s.x, s.y + 46]];
      const side = cand.find(([cx, cy]) => w.walkable(cx, cy)) || cand[0];
      w.walkTo(side[0], side[1], () => talkTo(s));
      return;
    }
    const c = hitAt(x, y);
    if (c?.kind === 'escArr') { arrivalInfo(); return; } // ankomständen – bara en upplysning, ingen promenad
    if (c) { walker().walkTo(c.go[0], c.go[1], () => act(c)); return; }
    walker().walkTo(x, y);
  }
  // Maten styr klicket (true = hanterat): sitter man och äter reser man sig inte,
  // med maten i händerna kommer man inte ut ur matsalen, uppätet = man får gå.
  const LEAVE = new Set(['door', 'exit', 'esc', 'lift']);
  function mealClick(x, y) {
    const c = hitAt(x, y), leave = !!c && LEAVE.has(c.kind), st = meal.st;
    if (st === 'sit' || st === 'eat') {
      sayMe(leave ? MSG_DORR : MSG_ATUPP);
      return true;
    }
    if (st === 'line') { sayMe(leave ? MSG_DORR : 'FÖRST KASSAN, SEN ETT BORD!'); return true; }
    if (st === 'carry' || st === 'toSeat') {
      if (c?.kind === 'table') { sitAtTable(c.table); return true; }
      if (leave || !inDining(x, y)) { sayMe(MSG_DORR); return true; }
      if (c && (c.kind === 'rest' || c.kind === 'food' || c.kind === 'buy')) { sayMe('JAG ÄTER UPP DET HÄR FÖRST!'); return true; }
      // en bit bort inne i matsalen – med maten i händerna, reservationen släpps
      releaseSeat();
      meal.st = 'carry'; meal.waitSeat = false;
      walker().walkTo(x, y);
      return true;
    }
    if (st === 'done') standUp(); // uppätet: man reser sig och klicket gäller som vanligt
    return false;
  }
  function inDining(x, y) {
    const z = diningZone(F);
    return !!z && x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1;
  }
  // mina repliker om maten, ovanför huvudet (sittande en bit lägre)
  const meAt = () => { const [x, y] = playerPos(); return { x, y: y - (isSeated() ? 38 : 44) }; };
  let saidTxt = '', saidAt = -9;
  function sayMe(msg, secs = 2.6) {
    if (msg === saidTxt && t - saidAt < 0.9 && talk.active()) return; // dubbelklick = samma bubbla
    saidTxt = msg; saidAt = t;
    myBubble = null;
    talk.say(msg, meAt, secs, { self: true });
  }
  function talkTo(s) {
    walker().dir = walker().px < s.x ? 'right' : 'left';
    s.dir = walker().px < s.x ? 'left' : 'right';
    if (s.mode === 'truck') { F.folk.say(s, 'SE UPP, TRUCK!', 3); toast('🚜 "Håll dig bakom de gula strecken när trucken kör – annars är lagret fritt fram!"'); return; }
    const tip = TIPS[(s.tip ?? 0) % TIPS.length];
    F.folk.say(s, ['HEJ! VARSÅGOD!', 'KUL ATT DU FRÅGAR!', 'KAN JAG HJÄLPA TILL?'][(s.id + Math.floor(t)) % 3], 3.5);
    s.tip = (s.tip ?? 0) + 1;
    play('chirp');
    toast(`💬 ${tip}`);
  }
  // den punkt på en klickyta som säkert träffar den (prislappen först)
  function spotOf(c) {
    const cand = [];
    if (c.ex?.tag) cand.push([c.ex.tag.x + c.ex.tag.w / 2, c.ex.tag.y + c.ex.tag.h / 2]);
    if (c.ex && !c.ex.rug) cand.push([c.ex.x + c.ex.w / 2, c.ex.top + c.ex.h / 2]);
    cand.push([(c.hot[0] + c.hot[2]) / 2, (c.hot[1] + c.hot[3]) / 2]);
    for (let yy = c.hot[1] + 1; yy < c.hot[3]; yy += 3) for (let xx = c.hot[0] + 1; xx < c.hot[2]; xx += 3) cand.push([xx, yy]);
    return cand.find(([x, y]) => hitAt(x, y) === c && !F.folk?.staffAt(x, y)) || cand[0];
  }

  // ---------- rulltrappan ----------
  function startEsc(e) {
    if (meal) { sayMe(MSG_DORR); return; }
    talk.clear();
    if (e.arrive || e.up !== (F.n === 1)) { arrivalInfo(); return; } // ankomständen går inte att åka från
    ride = { kind: 'esc', e, d: -12, v: RIDE_V, leg: 1 };
    walker().stop();
    play('slide');
    myBubble = { msg: e.up ? `UPP TILL PLAN ${e.to}!` : `NER TILL PLAN ${e.to}!`, until: 2 };
  }
  function escStep(dt) {
    ride.d += ride.v * dt;
    if (ride.leg === 1 && ride.d >= ride.e.run) {
      // byt plan: samma rulltrappa på andra planet, åk sista biten
      const other = S.floors[ride.e.to - 1];
      const e2 = other.esc.find((x) => x.id === ride.e.id);
      enterFloor(other, e2.board);
      ride = { kind: 'esc', e: e2, d: e2.run, v: -RIDE_V, leg: 2 };
      fade = 0.9;
    } else if (ride.leg === 2 && ride.d <= -12) {
      const e = ride.e;
      ride = null;
      walker().px = e.board[0]; walker().py = e.board[1]; walker().snapFree();
      walker().dir = e.sx > 0 ? 'left' : 'right';
      toast(F.n === 2 ? '🛋️ PLAN 2 – UTSTÄLLNINGEN. Följ den gula gången!' : '🏷️ PLAN 1 – MARKNADSHALLEN, LAGRET OCH KASSORNA.', 'good');
      // kliv av en bit
      const off = F.n === 2 ? [e.board[0] + 8, e.board[1] + 16] : [e.board[0], e.board[1] + 18];
      walker().walkTo(off[0], off[1]);
    }
  }

  // ---------- hissen ----------
  function startLift() {
    if (meal) { sayMe(MSG_DORR); return; }
    talk.clear();
    const L = F.lift;
    ride = { kind: 'lift', st: 'open', t: 0, pos: [L.x + 13, L.fy + 8], inCab: false, to: F.n === 1 ? 2 : 1 };
    walker().stop();
    play('ok');
  }
  function liftStep(dt) {
    const L = F.lift, r = ride;
    r.t += dt;
    const k = Math.min(1, r.t / (LIFT_T[r.st === 'open2' ? 'open' : r.st === 'close2' ? 'close' : r.st] || 0.5));
    const cx = L.x + 13;
    if (r.st === 'open') { L.open = k; if (k >= 1) next('in'); }
    else if (r.st === 'in') { r.inCab = true; r.pos = [cx, L.fy + 8 - 9 * k]; r.dir = 'up'; if (k >= 1) { r.dir = 'down'; next('close'); } }
    else if (r.st === 'close') { L.open = 1 - k; if (k >= 1) { next('move'); play('slide'); } }
    else if (r.st === 'move') {
      L.arrow = r.to > F.n ? 'U' : 'D';
      if (k >= 1) {
        L.arrow = null;
        const other = S.floors[r.to - 1];
        enterFloor(other, [other.lift.x + 13, other.lift.fy + 12]);
        other.lift.open = 0; other.lift.arrow = null;
        ride = { kind: 'lift', st: 'open2', t: 0, pos: [other.lift.x + 13, other.lift.fy - 1], inCab: true, dir: 'down', to: other.n };
        fade = 0.6;
        play('ok');
        return;
      }
    }
    else if (r.st === 'open2') { L.open = k; if (k >= 1) next('out'); }
    else if (r.st === 'out') { r.pos = [cx, L.fy - 1 + 13 * k]; r.inCab = k < 0.5; if (k >= 1) next('close2'); }
    else if (r.st === 'close2') {
      L.open = 1 - k;
      if (k >= 1) { ride = null; walker().px = cx; walker().py = L.fy + 12; walker().snapFree(); toast(F.n === 2 ? '🛗 PLAN 2 – UTSTÄLLNINGEN' : '🛗 PLAN 1 – ENTRÉN', 'good'); }
    }
    function next(st) { r.st = st; r.t = 0; }
  }

  // ---------- maten: restaurangen (plan 2) och korvkiosken (plan 1) ----------
  // meal = { kind: 'rest'|'kiosk', items: [{ id, fill, energy, stage }], st, seat, … }
  //   st: line (brickan till kassan) → carry/toSeat (maten i händerna) → sit → eat
  //   (bit för bit) → done (uppätet, brickan försvinner, man får gå).
  //   stage per rätt: 0 hel · 1 halväten · 2 uppäten (bilderna: left = 2 − stage).
  const HOLD = new Set(['line', 'carry', 'toSeat']), SEATED = new Set(['sit', 'eat', 'done']);
  const isHolding = () => !!meal && HOLD.has(meal.st);
  const isSeated = () => !!meal?.seat && SEATED.has(meal.st);
  const leftOf = (it) => 2 - it.stage;
  const EAT_SECS = { rest: 7, kiosk: 4 }; // så länge ätandet tar (som förut), speltiden nedan
  const MINUTES = { rest: 15, kiosk: 5 };  // g.passTime när maten är uppäten (som förut)
  function newMeal(kind, items, sum) {
    return { kind, sum, day: g.day, st: 'carry', t: 0, seat: null, biteT: 0, eating: 0, got: { fill: 0, energy: 0 },
      items: items.map((m) => ({ id: m.id, fill: m.fill || 0, energy: m.energy || 0, stage: 0 })) };
  }
  function openRestMenu() {
    if (meal) return;
    const w = walker();
    w.dir = 'up';
    openMenu(A, {
      onPay: (ids, sum) => {
        meal = newMeal('rest', ids.map(menuOf).filter(Boolean), sum);
        meal.st = 'line';
        w.speed = 44;
        w.walkTo(F.restLine.pay[0], F.restLine.pay[1], () => {
          w.speed = SPEED;
          w.dir = 'up';
          if (!meal) return;
          if (g.money < sum) { toast('Du har inte råd – brickan får stå kvar. Dags att jobba ett pass!', 'bad'); play('fel'); meal = null; return; }
          g.money -= sum; // betala i restaurangkassan
          play('coin');
          g.save?.();
          const kass = F.folk.list.find((a) => a.lines?.includes('SMAKLIG MÅLTID!'));
          if (kass) F.folk.say(kass, 'SMAKLIG MÅLTID!', 3);
          toast(`🧾 Betalt ${sum} kr i kassan. Sätt dig vid ett ledigt bord och ät!`, 'good');
          meal.st = 'carry';
          const s = freeSeatNear(w.px, w.py);
          if (s) goToSeat(s);
          else { meal.waitSeat = true; sayMe('ALLA BORD ÄR UPPTAGNA – JAG VÄNTAR PÅ ETT LEDIGT!', 3.5); }
        });
      },
    });
  }
  function buySnack(k) {
    if (meal) return;
    g.money -= k.price; // betala i kiosken – mättheten kommer medan man äter
    g.save?.();
    play('coin');
    meal = newMeal('kiosk', [k], k.price);
    const kiosk = F.folk.list.find((a) => a.lines?.includes('MED SENAP?'));
    if (kiosk) F.folk.say(kiosk, k.id === 'korv' ? 'VARSÅGOD, EN KORV!' : 'VARSÅGOD!', 3);
    toast(`${k.icon} ${k.name} – sätt dig vid bistroborden och ät!`, 'good');
    const w = walker();
    const s = freeSeatNear(w.px, w.py);
    if (s) goToSeat(s);
    else { meal.waitSeat = true; sayMe('ALLA BORD ÄR UPPTAGNA – JAG VÄNTAR PÅ ETT LEDIGT!', 3.5); }
  }
  const freeSeatNear = (x, y) => F.seats.filter((s) => !s.occ).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0] || null;
  function sitAtTable(tb) {
    if (!meal) {
      toast(tb.bistro ? '🌭 Köp en korv eller en glass i kiosken först – sedan sätter du dig här och äter!' : 'Hämta en bricka med mat vid disken först – menyn hittar du vid brickorna!');
      return;
    }
    if (meal.st !== 'carry' && meal.st !== 'toSeat') return;
    const s = meal.seat?.table === tb ? meal.seat : F.seats.find((x) => x.table === tb && !x.occ) || null;
    if (!s) { sayMe('DET BORDET ÄR UPPTAGET!'); return; }
    goToSeat(s);
  }
  // släpp en bordsreservation (bara medan man bär maten – inte när man sitter)
  function releaseSeat() {
    if (!meal?.seat || SEATED.has(meal.st)) return;
    if (meal.seat.occ === 'me') meal.seat.occ = null;
    meal.seat = null;
  }
  function goToSeat(s) {
    if (meal.seat !== s) releaseSeat();
    meal.seat = s; s.occ = 'me'; meal.st = 'toSeat';
    walker().walkTo(s.approach[0], s.approach[1], () => { if (meal?.seat === s && meal.st === 'toSeat') sitDown(); });
  }
  function sitDown() {
    const s = meal.seat;
    meal.st = 'sit'; meal.t = 0;
    walker().stop();
    s.tray = { kind: meal.kind, items: meal.items.map((i) => i.id), left: meal.items.map(leftOf), mine: true };
    play('click');
  }
  function mealStep(dt) {
    meal.t += dt;
    if (meal.eating > 0) meal.eating -= dt;
    const w = walker();
    // säkerhetsnät om gång-callbacken uteblev: sätt dig bara om figuren står vid stolen
    if (meal.st === 'toSeat' && !w.path.length) {
      const [ax, ay] = meal.seat.approach;
      if (Math.hypot(w.px - ax, w.py - ay) < 8) sitDown();
      else { releaseSeat(); meal.st = 'carry'; }
    }
    // alla bord var upptagna: första plats som blir ledig är min
    if (meal.st === 'carry' && meal.waitSeat && !w.path.length) {
      const s = freeSeatNear(w.px, w.py);
      if (s) { meal.waitSeat = false; goToSeat(s); }
    }
    if (meal.st === 'sit' && meal.t > 0.6) {
      meal.st = 'eat'; meal.t = 0; meal.biteT = biteGap() / 2;
      sayMe(meal.kind === 'kiosk' ? (meal.items[0].id === 'glass' ? 'MUMS! 🍦' : 'MUMS! 🌭') : 'MUMS! 😋', 2);
    } else if (meal.st === 'eat') {
      meal.biteT -= dt;
      if (meal.biteT <= 0) { meal.biteT = biteGap(); bite(); }
    } else if (meal.st === 'done') {
      if (meal.seat?.tray && meal.t > 1) meal.seat.tray = null; // uppätet: brickan/tallriken försvinner
      if (meal.t > 2.4) standUp();
    }
  }
  // tuggorna fördelas jämnt över ätandet: två tuggor per rätt
  const biteGap = () => EAT_SECS[meal.kind] / (meal.items.length * 2 - 0.5);
  function bite() {
    const it = meal.items.find((i) => i.stage < 2);
    if (!it) { finishMeal(); return; }
    it.stage++;
    meal.eating = 0.6;
    // HÄR – och bara här – kommer mättheten och energin: vid bordet, en tugga i taget
    // (halva rätten per tugga, heltal som tillsammans blir exakt rättens värde)
    const half = (v) => (it.stage === 1 ? Math.floor(v / 2) : v - Math.floor(v / 2));
    const f = half(it.fill), e = half(it.energy);
    if (f) g.hunger = Math.min(100, Math.round(g.hunger + f));
    if (e) g.energy = Math.min(100, Math.round(g.energy + e));
    meal.got.fill += f; meal.got.energy += e;
    if (meal.seat?.tray) meal.seat.tray.left = meal.items.map(leftOf);
    if (meal.items.every((i) => i.stage >= 2)) finishMeal();
  }
  function finishMeal() {
    const { fill, energy } = meal.got;
    g.passTime?.(MINUTES[meal.kind]);
    g.save?.();
    play('ok');
    const first = meal.kind === 'rest' ? menuOf(meal.items[0].id) : null;
    const what = meal.kind === 'kiosk' ? (meal.items[0].id === 'glass' ? '🍦 Mjukglassen var god' : '🌭 Korv med bröd – det smakade')
      : !first ? 'Maten'
      : first.id === 'kottbullar' ? 'Köttbullar med mos och lingonsylt smakar alltid'
      : `${first.name.replace(/\s*\(.*\)/, '')}${meal.items.length > 1 ? ' med mera' : ''} – det smakade`;
    toast(`😋 Mums! ${what}. +${fill} mätthet${energy ? `, +${energy} energi` : ''}`, 'good');
    meal.st = 'done'; meal.t = 0;
    sayMe('GOTT! NU ÄR DET UPPÄTET. 😋', 2.2);
  }
  function standUp() {
    const s = meal?.seat;
    const w = walker();
    if (s) { if (s.occ === 'me') s.occ = null; s.tray = null; w.px = s.approach[0]; w.py = s.approach[1]; w.snapFree(); }
    meal = null;
  }
  // Scenen byts mitt i maten (somnade vid midnatt, 👥 Gå dit/Åk hem till, jobbinbjudan …):
  // betald mat går aldrig förlorad – resten av mättheten/energin räknas in (samma
  // halv-per-tugga-heltal som bite(), så summan blir exakt rättens värde) och tiden
  // går som om man ätit klart. En obetald bricka (på väg till kassan) släpps bara.
  function settleMeal() {
    if (!meal || meal.st === 'line' || meal.st === 'done') return false;
    for (const it of meal.items) {
      const given = (v) => (it.stage >= 2 ? v : it.stage === 1 ? Math.floor(v / 2) : 0);
      const f = it.fill - given(it.fill), e = it.energy - given(it.energy);
      if (f) g.hunger = Math.min(100, Math.round(g.hunger + f));
      if (e) g.energy = Math.min(100, Math.round(g.energy + e));
      meal.got.fill += f; meal.got.energy += e;
      it.stage = 2;
    }
    // tiden: bara samma dag (har man redan somnat vid midnatt är den förbi) och
    // aldrig över midnatt mitt i ett scenbyte – då somnar man hellre på vanligt sätt
    const mins = Math.min(MINUTES[meal.kind], DAY_MIN - 1 - (g.min ?? 0));
    if (meal.day === g.day && mins > 0) g.passTime?.(mins);
    g.save?.();
    return true;
  }
  // Får man lämna varuhuset just nu? null = ja, annars repliken (som figuren också säger).
  // Samma kontrakt som Kaféet och Burgarbaren – för huvudprogrammets knappar som byter scen.
  function leaveBlock() {
    if (!meal || meal.st === 'done') return null;
    sayMe(MSG_DORR);
    return MSG_DORR;
  }

  // ---------- informationen ----------
  function openGuide() {
    const [f1, f2] = S.floors;
    const li = (arr) => arr.map((x) => `<li>${x}</li>`).join('');
    const rooms2 = [...new Set(f2.rooms.map((r) => r.name.replace(/ \d+$/, '')))];
    const depts = [...new Set(f1.depts.map((r) => r.name.replace(/ \d+$/, '')))];
    openModal('ℹ️ Varuhusguide – MÖBELJÄTTEN', `
      <p style="font-size:var(--f2);margin-top:0">Följ den gula gången – den tar dig genom hela varuhuset. Rulltrapporna och hissen går mellan planen.</p>
      <div style="display:flex;gap:18px;flex-wrap:wrap;font-size:var(--f2)">
        <div><b>🛋️ PLAN 2 · UTSTÄLLNING</b><ul>${li(rooms2)}<li>🍽️ Restaurang</li></ul></div>
        <div><b>🏷️ PLAN 1 · ENTRÉPLAN</b><ul>${li(depts)}<li>📦 Självbetjäningslager</li><li>🧾 Kassor</li><li>🌭 Bistro</li><li>🎈 Småland</li></ul></div>
      </div>
      <p class="sp">Klicka på en prislapp för att köpa – möbeln hamnar i förrådet hemma. ${KAT().length} möbler finns utställda.</p>`,
    [{ label: 'Tack!', cls: 'btn-go', onClick: closeModal }]);
    play('chirp');
  }

  // ---------- ritningen ----------
  function drawExhibit(ctx, e, hl) {
    const pulse = Math.floor(t * 3) % 2 ? 0xffffff : 0xffd23f;
    if (e.carton) {
      ctx.drawImage(e.img, e.x, e.top);
      if (hl) { ctx.fillStyle = Math.floor(t * 3) % 2 ? '#ffffff' : '#ffd23f'; ctx.fillRect(e.x - 1, e.top - 1, e.w + 2, 1); ctx.fillRect(e.x - 1, e.base, e.w + 2, 1); ctx.fillRect(e.x - 1, e.top, 1, e.h); ctx.fillRect(e.x + e.w, e.top, 1, e.h); }
    } else if (!e.rug) {
      if (!e.hang) {
        ctx.fillStyle = 'rgba(20,12,28,0.22)';
        ctx.fillRect(e.x + 1, e.base - 1, e.w - 2, 2);
        ctx.fillRect(e.x + 3, e.base + 1, Math.max(1, e.w - 6), 1);
      } else { ctx.fillStyle = 'rgba(20,12,28,0.18)'; ctx.fillRect(e.x + 1, e.top + 1, e.w, e.h); }
      if (hl) { const o = outlineImg(e, pulse); if (o) ctx.drawImage(o, e.x - 1, e.top - 1); }
      const f = frameOf(e.k, e.v);
      const art = f && typeof ROOM.furnArt === 'function' ? ROOM.furnArt(e.k, e.v, e.c) : null;
      if (art) ctx.drawImage(art.img, art.sx, art.sy, art.sw, art.sh, e.x, e.top, art.sw, art.sh);
      else if (f && ROOM.ATLAS?.complete) ctx.drawImage(ROOM.ATLAS, f[0], f[1], f[2], f[3], e.x, e.top, f[2], f[3]);
      else if (!f) ctx.drawImage(boxImg(), e.x, e.top);
    }
    if (e.tag) ctx.drawImage(tagImg(e.k, hl), e.tag.x, e.tag.y);
  }
  function drawRug(ctx, e) {
    const art = ROOM.furnArt?.(e.k, e.v, e.c);
    if (art) ctx.drawImage(art.img, art.sx, art.sy, art.sw, art.sh, e.x, e.y, art.sw, art.sh);
    else if (e.k === 'matta') { ctx.fillStyle = '#8a2a32'; ctx.fillRect(e.x, e.y, e.w, e.h); }
  }
  // maten på bordet framför en plats: brickan (restaurangen) eller korven/glassen
  // på sin servett (bistroborden) – bilden visar hur mycket som är kvar
  function drawTray(ctx, s) {
    const tr = s.tray;
    if (!tr) return;
    if (tr.kind === 'kiosk') {
      const d = dishImg(tr.items[0], tr.left[0]);
      ctx.drawImage(d, Math.round(s.x - d.width / 2), s.table.base - 13 - d.height + 1);
      return;
    }
    const img = trayImg(tr.items, tr.left);
    ctx.drawImage(img, Math.round(s.x - TRAY_W / 2), s.table.base - 18 - img.height + 11);
  }
  // maten i händerna (bär-bildrutorna): brickan, eller korven/glassen på servetten
  function drawHeld(ctx, px, py, dir) {
    const ox = dir === 'left' ? -9 : dir === 'right' ? 9 : 0;
    if (meal.kind === 'kiosk') {
      // servetten i händerna framför magen (glassbägaren är högre än korven – lite lägre)
      const id = meal.items[0].id, d = dishImg(id, 2);
      ctx.drawImage(d, Math.round(px + ox - d.width / 2), Math.round(py - (id === 'glass' ? 22 : 25)));
      return;
    }
    const img = trayImg(meal.items.map((i) => i.id), 2);
    ctx.drawImage(img, Math.round(px + ox - img.width / 2), Math.round(py - 7 - img.height));
  }
  function drawRider(ctx, e, d, look, dir) {
    const [x, y] = escPos(e, d);
    drawPerson(ctx, x, y, look, dir, 0);
  }
  function escGroup(ctx, e) {
    const art = artOf(e);
    const forward = (e.sy < 0) === e.up;
    const ph = Math.floor(t * RIDE_V) % ESC_PERIOD;
    const tread = art.treads[forward ? ph : (ESC_PERIOD - ph) % ESC_PERIOD];
    ctx.drawImage(art.back, art.x, art.y);
    ctx.drawImage(tread, art.x, art.y);
    // åkarna (klippta vid taket / golvkanten)
    ctx.save();
    ctx.beginPath();
    if (e.sy < 0) ctx.rect(art.x - 20, e.clip, art.w + 40, 400); else ctx.rect(art.x - 20, e.clip - 400, art.w + 40, 400);
    ctx.clip();
    const faceDir = (v) => ((v > 0 ? e.sx : -e.sx) > 0 ? 'right' : 'left');
    const rs = e.riders.map((r) => ({ d: r.d, look: r.look, dir: faceDir(r.v) }));
    if (ride?.kind === 'esc' && ride.e === e) rs.push({ d: Math.max(-12, ride.d), look: A.avatar.look, dir: faceDir(ride.v), me: true });
    rs.sort((a, b) => escPos(e, a.d)[1] - escPos(e, b.d)[1]);
    for (const r of rs) {
      if (r.d < 0) { const x = e.lx + e.sx * r.d; drawPerson(ctx, x, e.ly, r.look, r.dir, WALK_SEQ[Math.floor(t * 8) % 4]); }
      else drawRider(ctx, e, r.d, r.look, r.dir);
    }
    ctx.restore();
    ctx.drawImage(art.front, art.x, art.y);
    if (e.sy > 0) { e.pf ||= pitFrontImg(e.pit[1] - e.pit[0] + 2); ctx.drawImage(e.pf, e.pit[0] - 1, e.pit[3] - 1); }
  }
  function drawLift(ctx) {
    const L = F.lift, x = L.x, y = L.fy - LIFT_H;
    if (L.open > 0 || ride?.kind === 'lift') {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, LIFT_W, LIFT_H); ctx.clip();
      L.cab ||= liftCabImg();
      ctx.drawImage(L.cab, x, y);
      if (ride?.kind === 'lift' && ride.inCab) drawPerson(ctx, ride.pos[0], ride.pos[1], A.avatar.look, ride.dir || 'down', ride.st === 'in' || ride.st === 'out' ? WALK_SEQ[Math.floor(t * 8) % 4] : 0);
      L.door ||= liftDoorImg();
      const o = Math.round(L.open * 13);
      ctx.drawImage(L.door, x - o, y);
      ctx.save(); ctx.translate(x + LIFT_W + o, y); ctx.scale(-1, 1); ctx.drawImage(L.door, 0, 0); ctx.restore();
      ctx.restore();
    } else {
      L.door ||= liftDoorImg();
      ctx.drawImage(L.door, x, y);
      ctx.save(); ctx.translate(x + LIFT_W, y); ctx.scale(-1, 1); ctx.drawImage(L.door, 0, 0); ctx.restore();
    }
    // knappen lyser medan hissen är beställd
    if (ride?.kind === 'lift' && ['open', 'in', 'close', 'move'].includes(ride.st)) {
      const px = x + LIFT_W + 6, up = ride.to > F.n;
      ctx.fillStyle = Math.floor(t * 4) % 2 ? '#ffd23f' : '#ffb000';
      ctx.fillRect(px + 2, L.fy - (up ? 23 : 18), 3, 3);
    }
    const lit = !!L.arrow || (ride?.kind === 'lift');
    drawLiftIndicator(ctx, x, L.fy, ride?.kind === 'lift' && ride.st === 'move' && ride.t > LIFT_T.move / 2 ? ride.to : F.n, L.arrow, lit);
  }
  function drawWorld(ctx, vx, vy, vw, vh) {
    ctx.drawImage(bgOf(F), vx, vy, vw, vh, vx, vy, vw, vh);
    // kväll: mörkt ute bakom glasdörrarna
    const hour = (g?.min ?? 720) / 60;
    if (F.n === 1 && (hour >= 20 || hour < 6.5)) {
      ctx.fillStyle = 'rgba(10,14,44,0.62)';
      ctx.fillRect(F.door.x0, F.door.y0, F.door.x1 - F.door.x0, A_FLOOR - F.door.y0);
      ctx.fillRect(F.exitDoor.x0, B_FLOOR - 44, F.exitDoor.x1 - F.exitDoor.x0, 44);
    }
    // restaurangens meny (rätterna är små målningar)
    if (F.menuBoard) drawMenuBoard(ctx);
    drawLift(ctx);
    const inView = (x0, y0, x1, y1) => x1 >= vx - 8 && x0 <= vx + vw + 8 && y1 >= vy - 8 && y0 <= vy + vh + 60;
    const hl = hover || near;
    // mattor på golvet
    for (const e of F.ex) if (e.rug && inView(e.x, e.y, e.x + e.w, e.y + e.h + 16)) {
      drawRug(ctx, e);
      if (hl?.ex === e) { ctx.fillStyle = Math.floor(t * 3) % 2 ? '#ffffff' : '#ffd23f'; ctx.fillRect(e.x - 1, e.y - 1, e.w + 2, 1); ctx.fillRect(e.x - 1, e.y + e.h, e.w + 2, 1); ctx.fillRect(e.x - 1, e.y, 1, e.h); ctx.fillRect(e.x + e.w, e.y, 1, e.h); }
      ctx.drawImage(tagImg(e.k, hl?.ex === e), e.tag.x, e.tag.y);
    }
    const items = [];
    for (const e of [...F.ex, ...(F.cartons || [])]) {
      if (e.rug || !inView(Math.min(e.x, e.tag ? e.tag.x : e.x), e.top, e.x + Math.max(e.w, 50), e.tag ? e.tag.y + e.tag.h : e.base)) continue;
      const isHl = hl?.ex === e;
      items.push({ fy: e.hang ? e.room.fy - 30 : e.base, draw: () => drawExhibit(ctx, e, isHl) });
    }
    for (const p of F.props) {
      if (!inView(p.x, p.y, p.x + p.img.width, p.fy)) continue;
      if (p.table) items.push({ fy: p.fy, draw: () => { ctx.drawImage(p.img, p.x, p.y); for (const s of F.seats) if (s.table === p.table) drawTray(ctx, s); } });
      else items.push({ fy: p.fy, draw: () => ctx.drawImage(p.img, p.x, p.y) });
      if (p.id === 'lekland') { const bk = smalandBackImg(); items.push({ fy: p.y + 38.5, draw: () => ctx.drawImage(bk, 3, 29, 70, 12, p.x + 3, p.y + 29, 70, 12) }); }
    }
    for (const w of F.walls) if (inView(w.x, w.y, w.x + w.img.width, w.fy)) items.push({ fy: w.fy, draw: () => ctx.drawImage(w.img, w.x, w.y) });
    for (const d of F.furn) if (inView(d.x, d.base - d.h, d.x + d.w, d.base)) items.push({ fy: d.base, draw: () => { const a = ROOM.furnArt?.(d.k, d.v); if (a) { ctx.fillStyle = 'rgba(20,12,28,0.2)'; ctx.fillRect(d.x + 1, d.base - 1, d.w - 2, 2); ctx.drawImage(a.img, a.sx, a.sy, a.sw, a.sh, d.x, d.base - d.h, a.sw, a.sh); } } });
    for (const e of F.esc) {
      const art = artOf(e);
      if (!inView(art.x, art.y, art.x + art.w, art.y + art.h)) continue;
      items.push({ fy: e.sy < 0 ? e.ly + 5 : e.pit[3] + 3, draw: () => escGroup(ctx, e) });
    }
    items.push(...F.folk.drawables(ctx, t, inView));
    // jag
    if (!ride) {
      const [px, py] = playerPos();
      const sitting = isSeated();
      items.push({ fy: py + 0.01, draw: () => drawMe(ctx, px, py, sitting) });
    }
    items.sort((a, b) => a.fy - b.fy);
    for (const it of items) it.draw();
    // pil ovanför det man pekar på
    if (hover?.ex) {
      const e = hover.ex, ax = Math.round(e.rug ? e.tag.x + e.tag.w / 2 : e.x + e.w / 2), ay = Math.round((e.rug ? e.tag.y : e.top) - 8 + Math.sin(t * 6) * 1.5);
      ctx.fillStyle = '#17151a';
      ctx.fillRect(ax - 4, ay - 1, 9, 1); ctx.fillRect(ax - 5, ay, 11, 2); ctx.fillRect(ax - 4, ay + 2, 9, 1); ctx.fillRect(ax - 3, ay + 3, 7, 1); ctx.fillRect(ax - 2, ay + 4, 5, 1); ctx.fillRect(ax - 1, ay + 5, 3, 1);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(ax - 4, ay, 9, 1); ctx.fillRect(ax - 3, ay + 1, 7, 1); ctx.fillRect(ax - 2, ay + 2, 5, 1); ctx.fillRect(ax - 1, ay + 3, 3, 1); ctx.fillRect(ax, ay + 4, 1, 1);
    }
    F.folk.bubbles(ctx, inView);
    if (myBubble && !(ride?.kind === 'esc' && (ride.d > 60 || ride.leg === 2)) && !(ride?.kind === 'lift')) { const [px, py] = playerPos(); textBubble(ctx, px, py - (isSeated() ? 38 : 42), myBubble.msg); }
    if (!ride) talk.draw(ctx, { x0: vx, x1: vx + vw });
  }
  function drawMe(ctx, px, py, sitting) {
    const w = walker(), look = A.avatar.look;
    const walking = w.path.length > 0;
    if (sitting) {
      // tuggar: handen till munnen vid varje tugga (och då och då emellan)
      const f = meal.st === 'eat' && (meal.eating > 0 || Math.floor(meal.t * 1.6) % 3 === 1) ? 6 : 5;
      drawPerson(ctx, px, py, look, 'down', f);
    } else if (isHolding()) {
      drawPerson(ctx, px, py, look, w.dir, walking ? [7, 9, 8, 9][Math.floor(t * 8.5) % 4] : 9);
      if (w.dir !== 'up') drawHeld(ctx, px, py, w.dir);
    } else {
      const frame = walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2) > 0.9 ? 4 : 0);
      drawPerson(ctx, px, py, look, w.dir, frame);
    }
    const em = worldMyEmote();
    if (em) emoteBubble(ctx, px, py - 60, em);
  }
  function drawMenuBoard(ctx) {
    const M = F.menuBoard;
    if (!(M.x + M.w >= cam.x && M.x <= cam.x + VW)) return;
    ctx.save(); ctx.beginPath(); ctx.rect(M.x, M.y, M.w, M.h); ctx.clip();
    drawMenuStrip(ctx, M.x, M.y, M.w, ctxText);
    ctx.restore();
  }
  function zoneAt(x, y) { return F.zones.find((z) => x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1)?.r || null; }
  function drawHud(ctx) {
    ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
    // planet och rummet man står i: en rad i takbandet uppe till höger, så att
    // varuhusets egna takskyltar (från y 13) inte skyms
    {
      const [px, py] = playerPos();
      const r = zoneAt(px, py);
      const pl = `PLAN ${F.n}`, lbl = r ? (r.num ? `${r.num} ${r.name}` : r.name) : F.name;
      const pw = textW(SMALL, pl) + 7, w = pw + textW(SMALL, lbl) + 9, x = VW - w - 3, y = 1;
      ctx.fillStyle = 'rgba(12,30,70,0.9)'; ctx.fillRect(x, y, w, 11);
      ctx.fillStyle = '#f6cf2a'; ctx.fillRect(x, y, pw, 11); ctx.fillRect(x + pw, y + 10, w - pw, 1);
      ctxText(ctx, SMALL, pl, x + 3, y + 3, '#0c2a5c');
      ctxText(ctx, SMALL, lbl, x + pw + 4, y + 3, '#f6d02f');
    }
    const hl = hover || near;
    let msg = null, sub = null;
    if (ride?.kind === 'esc') { msg = `RULLTRAPPA ${ride.e.up ? 'UPP' : 'NER'}`; sub = `TILL PLAN ${ride.leg === 1 ? ride.e.to : F.n}`; }
    else if (ride?.kind === 'lift') { msg = 'HISSEN'; sub = `TILL PLAN ${ride.to}`; }
    else if (meal?.st === 'line') { msg = 'MED BRICKAN'; sub = 'TILL KASSAN...'; }
    else if (meal?.st === 'carry' || meal?.st === 'toSeat') { msg = 'SÄTT DIG OCH ÄT'; sub = meal.st === 'toSeat' ? 'TILL BORDET...' : 'KLICKA PÅ ETT LEDIGT BORD'; }
    else if (meal?.st === 'sit' || meal?.st === 'eat') {
      const n = meal.items.length * 2, done = meal.items.reduce((a, i) => a + i.stage, 0);
      msg = 'SMAKLIG MÅLTID!'; sub = `DU ÄTER... ${done}/${n}`;
    }
    else if (meal?.st === 'done') { msg = 'UPPÄTET!'; sub = 'KLICKA FÖR ATT GÅ VIDARE'; }
    else if (hl?.ex?.buy) { const kat = katOf(hl.ex.k); msg = `${tagName(hl.ex.k)}  ${kat?.price ?? '?'} KR`; sub = hover ? 'KLICKA FÖR ATT KÖPA' : 'KLICKA PÅ MÖBELN FÖR ATT KÖPA'; }
    else if (hl?.ex && isElektronik(hl.ex.k)) { msg = `${elektronikName(hl.ex.k, hl.ex.v).toUpperCase()} ÄR BARA UTSTÄLLD`; sub = 'ELEKTRONIK FINNS PÅ BLIXT I DOWNTOWN'; }
    else if (hl?.ex) { msg = `${(DECOR[hl.ex.k] || '').toUpperCase()} INGÅR I BOSTADEN`; sub = 'SÄLJS INTE HÄR'; }
    else if (hl?.kind === 'esc') { msg = `RULLTRAPPA ${hl.esc.up ? 'UPP' : 'NER'}`; sub = `KLICKA - TILL PLAN ${hl.esc.to}`; }
    else if (hl?.kind === 'escArr') { msg = `RULLTRAPPA FRÅN PLAN ${hl.esc.to}`; sub = F.n === 2 ? 'BARA ANKOMST - ÅK NER EFTER RESTAURANGEN' : 'BARA ANKOMST - ÅK UPP VID ENTRÉN'; }
    else if (hl?.kind === 'lift') { msg = 'HISS'; sub = `KLICKA - TILL PLAN ${F.n === 1 ? 2 : 1}`; }
    else if (hl?.kind === 'rest') { msg = 'RESTAURANGEN'; sub = 'KLICKA - TA EN BRICKA'; }
    else if (hl?.kind === 'table') { msg = hl.table?.bistro ? 'BISTROBORD' : 'BORD FÖR TVÅ'; sub = hl.table?.bistro ? 'KÖP EN KORV FÖRST - SEN SÄTTER DU DIG HÄR' : 'HÄMTA MAT FÖRST'; }
    else if (hl?.kind === 'food') { msg = 'KORV 10 KR'; sub = 'KLICKA FÖR ATT KÖPA'; }
    else if (hl?.kind === 'info') { msg = 'INFORMATION'; sub = 'KLICKA FÖR VARUHUSGUIDEN'; }
    else if (hl?.kind === 'kassa') { msg = 'KASSA'; sub = 'ALLT ÄR REDAN BETALT'; }
    else if (hl?.kind === 'play') { msg = 'SMÅLAND'; sub = 'BOLLHAV FÖR BARN'; }
    else if (hl?.kind === 'door') { msg = 'UT TILL STADEN'; sub = 'KLICKA PÅ DÖRREN'; }
    else if (hl?.kind === 'exit') { msg = 'UTGÅNG'; sub = 'KLICKA FÖR ATT GÅ UT'; }
    else if (hoverStaff) { msg = 'PERSONAL'; sub = 'KLICKA FÖR ETT TIPS'; }
    else if (t < 7 && F.n === 1) { msg = 'VÄLKOMMEN!'; sub = 'RULLTRAPPAN UPP TILL UTSTÄLLNINGEN - FÖLJ GULA GÅNGEN'; }
    if (msg) {
      const w = textW(SMALL, msg) + textW(SMALL, sub) + 22;
      const x = Math.round(VW / 2 - w / 2), y = VH - 16;
      ctx.fillStyle = 'rgba(12,12,20,0.84)'; ctx.fillRect(x, y, w, 12);
      ctx.fillStyle = '#f6cf2a'; ctx.fillRect(x, y, w, 1);
      ctxText(ctx, SMALL, msg, x + 6, y + 4, '#ffd23f');
      ctxText(ctx, SMALL, sub, x + 16 + textW(SMALL, msg), y + 4, '#f4f1ea');
    }
    if (fade > 0) { ctx.fillStyle = `rgba(10,8,16,${Math.min(1, fade).toFixed(3)})`; ctx.fillRect(0, 0, VW, VH); }
  }
  let hoverStaff = null;

  // ---------- test-/förhandsvisningskrokar ----------
  function switchTo(n, at) {
    const fl = S.floors[n - 1];
    ride = null; if (meal) { if (meal.seat) { if (meal.seat.occ === 'me') meal.seat.occ = null; meal.seat.tray = null; } meal = null; }
    enterFloor(fl, at || fl.arrive.hiss);
  }
  const routeIdx = (c, fl) => (c.ex ? (fl.n === 2 ? 0 : 1e7) + fl.blocks.indexOf(c.ex.room) * 10000 + (c.ex.rug ? 5000 : 0) + c.ex.x : 2e7);
  function findClick(id) {
    const cand = [];
    for (const fl of S.floors) for (const c of fl.clicks) if (c.id === id) cand.push({ c, fl });
    cand.sort((a, b) => (a.c.ex || b.c.ex ? routeIdx(a.c, a.fl) - routeIdx(b.c, b.fl) : (a.fl === F ? 0 : 1) - (b.fl === F ? 0 : 1)));
    return cand[0] || null;
  }

  return {
    get worldX() { return playerPos()[0]; },
    get worldY() { return playerPos()[1]; },
    get worldSit() { return isSeated() ? { dir: 'down', eat: meal?.st === 'eat' } : null; }, // andra ser mig sitta och äta i restaurangen
    get floor() { return F.n; },
    _debug: {
      // skärmkoordinater till den första utställda möbeln av sorten – byter plan
      // vid behov, och ställer figuren i gången framför möbeln om den ligger utanför bild
      spot: (id) => {
        const hit = findClick(id);
        if (!hit) return null;
        const { c, fl } = hit;
        const at = fl.walker.nearestFree(c.go[0], c.ex ? Math.min(c.go[1] + 30, c.ex.room.band === 'A' ? AISLE1 : AISLE2) : c.go[1]);
        if (fl !== F) switchTo(fl.n, at);
        else {
          Object.assign(cam, camTarget());
          const [x, y] = spotOf(c);
          const sx = x - cam.x, sy = y - cam.y;
          if (sx < 0 || sx >= VW || sy < 0 || sy >= VH) switchTo(F.n, at);
        }
        Object.assign(cam, camTarget());
        const [x, y] = spotOf(c);
        return { x: x - cam.x, y: y - cam.y };
      },
      floor: (n) => { switchTo(n); return F.n; },
      ride: (id = 'upp') => { // åk rulltrappan (upp från plan 1 / ner från plan 2) eller hissen härifrån
        if (id === 'hiss') { const L = F.lift; walker().px = L.x + 13; walker().py = L.fy + 8; startLift(); return true; }
        const e = F.esc.find((x) => x.id === id && !x.arrive);
        if (!e) return false;
        walker().px = e.board[0]; walker().py = e.board[1]; startEsc(e); return true;
      },
      rideState: () => (ride ? { kind: ride.kind, d: ride.d, st: ride.st, leg: ride.leg, floor: F.n } : null),
      eat: (items = ['kottbullar', 'saft', 'bulle']) => { // sätt dig direkt vid ett bord med en bricka
        switchTo(2);
        const s = F.seats.filter((x) => !x.occ).sort((a, b) => a.x - b.x)[0];
        if (!s) return false;
        meal = newMeal('rest', items.map(menuOf).filter(Boolean), 0);
        walker().px = s.approach[0]; walker().py = s.approach[1];
        goToSeat(s);
        return true;
      },
      // maten just nu: left 2/1/0 för hela måltiden, stages per rätt, got = mätthet/energi hittills
      meal: () => (meal ? {
        kind: meal.kind, st: meal.st, seat: meal.seat?.id ?? null, items: meal.items.map((i) => i.id), stages: meal.items.map((i) => i.stage),
        left: meal.items.every((i) => i.stage >= 2) ? 0 : meal.items.some((i) => i.stage > 0) ? 1 : 2, got: { ...meal.got },
        held: isHolding(), seated: isSeated(), tray: !!meal.seat?.tray,
      } : null),
      speech: () => talk.text(),       // min pratbubbla just nu (eller null)
      pos: () => { const [x, y] = playerPos(); return { x, y, walking: walker().path.length > 0, cam: { ...cam } }; },
      // skärmkoordinater för en klickyta på DETTA plan utan att flytta figuren (null = utanför bild)
      screen: (id, i = 0) => {
        const cs = F.clicks.filter((c) => c.id === id);
        const vis = cs.map((c) => { const [x, y] = spotOf(c); return { x: x - cam.x, y: y - cam.y }; }).filter((p) => p.x >= 0 && p.x < VW && p.y >= 0 && p.y < VH);
        return vis[i] || null;
      },
      toScreen: (x, y) => ({ x: x - cam.x, y: y - cam.y }),
      seats: () => F.seats.map((s) => ({ id: s.id, x: s.x, y: s.y, bistro: !!s.bistro, occ: s.occ === 'me' ? 'me' : s.occ ? 'npc' : null, tray: s.tray ? { kind: s.tray.kind || 'rest', left: s.tray.left } : null })),
      dining: () => diningZone(F),
      // testkrok: alla lediga platser på planet upptagna (true) eller lediga igen (false)
      fullHouse: (on = true) => { let n = 0; for (const s of F.seats) { if (on && !s.occ) { s.occ = { test: true }; n++; } else if (!on && s.occ?.test) { s.occ = null; n++; } } return n; },
      provsitt: () => F.folk.forceSit(walker().px, walker().py),
      lockCam: (x, y) => { lockedCam = x === null || x === undefined ? null : { x: clamp(x, 0, W() - VW), y: clamp(y ?? cam.y, 0, H - VH) }; if (lockedCam) Object.assign(cam, lockedCam); },
      teleport: (x, y) => { const w = walker(); w.px = x; w.py = y; w.stop(); w.snapFree(); Object.assign(cam, camTarget()); },
      cam: () => ({ ...cam }),
      size: () => ({ W: W(), H, floors: S.floors.map((f) => f.W) }),
      hover: (id) => { hover = id ? F.clicks.find((c) => c.id === id) || null : null; },
      clicks: () => F.clicks.filter((c) => !c.ex).map((c) => ({ id: c.id, kind: c.kind, hot: c.hot, go: c.go })),
      folk: () => F.folk.list.map((a) => ({ role: a.role, mode: a.mode, x: Math.round(a.x), y: Math.round(a.y), state: a.state || null })),
      rooms: () => S.floors.flatMap((fl) => fl.blocks.map((r) => ({ floor: fl.n, name: r.num ? `${r.num} ${r.name}` : r.name, kind: r.kind, x0: r.x0, x1: r.x1, band: r.band, items: [...fl.ex, ...(fl.cartons || [])].filter((e) => e.room === r).map((e) => `${e.k}${e.v}`) }))),
      exhibits: () => S.floors.flatMap((fl) => fl.ex.map((e) => ({ floor: fl.n, k: e.k, v: e.v, buy: e.buy, room: e.room.name, x: e.x, base: e.base }))),
      check: () => { // prislappar som krockar, möbler som inte går att nå/klicka, sorter som saknas
        const out = [];
        const ov = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
        for (const fl of S.floors) {
          const tags = [...fl.ex, ...(fl.cartons || [])].filter((e) => e.tag).map((e) => ({ e, r: [e.tag.x, e.tag.y, e.tag.x + e.tag.w, e.tag.y + e.tag.h] }));
          for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) if (ov(tags[i].r, tags[j].r)) out.push(`P${fl.n}: lapp ${tags[i].e.k} ↔ lapp ${tags[j].e.k} (${tags[i].e.room.name})`);
          for (const tg of tags) for (const e of fl.ex) {
            if (e === tg.e || e.rug || e.hang || e.base <= tg.e.base) continue;
            if (ov(tg.r, [e.x, e.top, e.x + e.w, e.base])) out.push(`P${fl.n}: lapp ${tg.e.k} skyms av ${e.k} (${e.room.name})`);
          }
          // en matta som döljs av sin egen lapp (mindre än 16 px av mattan kvar att se)
          for (const e of fl.ex) if (e.rug && e.tag) {
            const covered = Math.max(0, Math.min(e.y + e.h, e.tag.y + e.tag.h) - Math.max(e.y, e.tag.y));
            if (covered > 0 && e.h - covered < 16) out.push(`P${fl.n}: lappen täcker mattan ${e.k} (${e.room.name})`);
          }
          const w = fl.walker, sp = fl.spawn;
          for (const c of fl.clicks) {
            const p = w.findPath(sp[0], sp[1], c.go[0], c.go[1]); const last = p[p.length - 1];
            if (!last || Math.hypot(last[0] - c.go[0], last[1] - c.go[1]) > 6) out.push(`P${fl.n}: ${c.id}${c.ex ? ' i ' + c.ex.room.name : ''} går inte att nå`);
          }
        }
        const kinds = new Set(S.floors.flatMap((fl) => fl.ex.filter((e) => e.buy).map((e) => e.k)));
        for (const k of KAT()) if (!kinds.has(k.kind)) out.push(`${k.kind} saknas i utställningen`);
        const cur = F;
        for (const fl of S.floors) { F = fl; folkOf(F); for (const c of fl.clicks) if (c.ex) { const [x, y] = spotOf(c); if (hitAt(x, y) !== c) out.push(`P${fl.n}: ${c.id} i ${c.ex.room.name} går inte att klicka på`); } }
        F = cur;
        return out;
      },
      panorama: (scale = 1, n = F.n) => {
        const cur = F; F = S.floors[n - 1]; folkOf(F);
        const c = document.createElement('canvas'); c.width = F.W * scale; c.height = H * scale;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        x.setTransform(scale, 0, 0, scale, 0, 0);
        drawWorld(x, 0, 0, F.W, H);
        F = cur;
        return c.toDataURL('image/png');
      },
    },

    update(dt) {
      t += dt;
      if (fade > 0) fade = Math.max(0, fade - dt * 2.2);
      if (myBubble) { myBubble.until -= dt; if (myBubble.until <= 0) myBubble = null; }
      if (ride?.kind === 'esc') escStep(dt);
      else if (ride?.kind === 'lift') liftStep(dt);
      else walker().update(dt);
      if (meal) mealStep(dt);
      const [px, py] = playerPos();
      F.folk.update(dt, t, { px, py });
      // närmaste möbel (när man står vid den)
      near = null;
      if (!ride && !meal) {
        let bestD = 20;
        for (const c of F.clicks) {
          if (c.kind === 'door' || c.kind === 'exit' || c.kind === 'table' || c.kind === 'escArr') continue;
          const d = Math.hypot(c.go[0] - px, c.go[1] - py);
          if (d < bestD) { bestD = d; near = c; }
        }
      }
      const tg = camTarget(), k = lockedCam ? 1 : Math.min(1, dt * 6);
      cam.x += (tg.x - cam.x) * k; cam.y += (tg.y - cam.y) * k;
    },
    move(sx, sy) {
      const x = sx + cam.x, y = sy + cam.y;
      hoverStaff = F.folk.staffAt(x, y);
      hover = hoverStaff ? null : hitAt(x, y);
    },
    down(sx, sy) { clickWorld(sx + cam.x, sy + cam.y); },
    key(k) { if (k === 'Escape' && meal?.st === 'done') standUp(); },
    exit() {
      settleMeal(); // betald mat som inte hann ätas upp räknas in – den går aldrig förlorad
      // varuhuset (bord och stolar) är cachat mellan besöken – lämna ingen plats upptagen
      if (meal?.seat) { if (meal.seat.occ === 'me') meal.seat.occ = null; meal.seat.tray = null; }
      meal = null;
      for (const fl of S.floors) for (const s of fl.seats) if (s.occ?.test) s.occ = null; // testkrokens platser
      talk.clear();
    },
    // Får man lämna varuhuset just nu? null = ja, annars repliken "DU MÅSTE SÄTTA DIG OCH
    // ÄTA UPP!" (som figuren också säger). Samma kontrakt som Kaféet och Burgarbaren.
    leaveBlock,
    // äldre namn för samma sak (true = man får gå)
    canLeave() { return leaveBlock() === null; },
    get eating() { return !!meal && meal.st !== 'done'; },
    // mobilfyllningen: motorn får ge oss en bredare vy, klampad till våningens bredd
    viewMax: { get w() { return W(); }, h: H },
    draw(ctx) {
      syncView(A, W()); // skärmen kan ha ändrat storlek – vyn följer med
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, -cy * A.pxs);
      drawWorld(ctx, cx, cy, VW, VH);
      drawHud(ctx);
    },
  };
}

function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
