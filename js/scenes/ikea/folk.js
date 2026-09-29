// MÖBELJÄTTEN – människorna: personal i gula tröjor som jobbar (fyller på
// hyllor, bär kartonger, kör vagn och truck, sitter i kassorna, står i infon
// och i restaurangen, hjälper kunder med pratbubblor) och kunder som strosar
// längs gula gången, tittar på möblerna, provsitter soffor, åker rulltrappa
// och äter i restaurangen. Barnen leker i Småland.
//
// Bara planet man står på simuleras; det andra står still tills man kommer dit.
import { drawPerson, makeLook } from '../../core/people.js';
import { SMALL, textW, ctxText } from '../../core/floor-pix.js';
import { cartonImg, pushCartImg, rollCageImg, forkliftImg, flatCartImg, bagImg } from './art-props.js';
import { trayImg, dishImg, MENU } from './food.js';
import { B_WALL, B_FLOOR, A_FLOOR, AISLE1, AISLE2, FD } from './geo.js';
import { escPos } from './art-transit.js';

const WALK_SEQ = [1, 3, 2, 3];
export const TIPS = [
  'Följ den gula gången – den leder dig genom hela varuhuset.',
  'Soffor och fåtöljer hittar du i VARDAGSRUMMET på plan 2.',
  'Köttbullar med mos och lingonsylt finns i restaurangen på plan 2!',
  'Hissen står bredvid rulltrapporna – klicka på den så åker du.',
  'Allt du köper hamnar i förrådet hemma. Möblera med 🛋️-knappen!',
  'Korv med bröd för 10 kr hittar du efter kassorna vid utgången.',
  'Klicka på en prislapp så ser du möbeln i stort och kan välja färg.',
  'I lagret på plan 1 står de stora möblerna i platta kartonger.',
  'Kaffe med påtår ingår – ta en paus i restaurangen.',
  'Barnen kan leka i Småland medan du handlar.',
  'TV, datorer och spelkonsoler säljer vi inte längre – de finns på BLIXT ELEKTRONIK i Downtown!',
];
const HELP_LINES = ['KAN JAG HJÄLPA TILL?', 'SOFFOR FINNS PÅ PLAN 2!', 'FÖLJ PILARNA!', 'HAR DU HITTAT RÄTT?', 'PROVSITT GÄRNA!'];

// ---------- utseenden ----------
export function staffLook(rng, o = {}) {
  const b = makeLook(rng);
  return {
    skin: b.skin, hair: b.hair, style: b.style, glasses: b.glasses, beard: b.beard, blush: b.blush,
    top: 'polo', shirt: '#f2c230', accent: '#1d51a0', bottom: 'pants', pants: '#1f3a78', shoes: '#1c1c1c',
    hat: null, cap: '#1d51a0', bag: null, phones: false, neck: 'lanyard', neckColor: '#1d51a0',
    build: [4, 5, 5, 6][(rng() * 4) | 0], kid: false, ...o,
  };
}
const kundLook = (rng) => { const L = makeLook(rng); if (L.kid) { L.kid = false; L.build = 5; } if (L.shirt === '#f0b429') L.shirt = '#3a7bd5'; return L; };
const kidLook = (rng) => ({ ...makeLook(rng), kid: true, build: 4, bag: null });

// ---------- pratbubbla med text ----------
export function textBubble(ctx, cx, tip, msg, hot = false) {
  cx = Math.round(cx); tip = Math.round(tip);
  const w = textW(SMALL, msg) + 8, h = 11, x0 = Math.round(cx - w / 2), y0 = tip - 2 - h;
  ctx.fillStyle = hot ? '#e8b230' : '#17151a';
  ctx.fillRect(x0 + 1, y0, w - 2, h); ctx.fillRect(x0, y0 + 1, w, h - 2);
  ctx.fillRect(cx - 1, tip - 2, 3, 2); ctx.fillRect(cx, tip, 1, 1);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x0 + 1, y0 + 1, w - 2, h - 2); ctx.fillRect(cx, tip - 2, 1, 2);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + 2, y0 + 1, w - 5, 1);
  ctx.fillStyle = '#d9d0bc'; ctx.fillRect(x0 + 1, y0 + h - 2, w - 2, 1);
  ctxText(ctx, SMALL, msg, x0 + 4, y0 + 3, '#17336e');
}

// sprite speglad i x
function drawFlip(ctx, img, x, y, flip) {
  if (!flip) { ctx.drawImage(img, Math.round(x), Math.round(y)); return; }
  ctx.save(); ctx.translate(Math.round(x) + img.width, Math.round(y)); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore();
}

// ================= folket på ett plan =================
export function makeFolk(F, rng) {
  const list = [];
  let seq = 0;
  const A = (o) => { const a = { id: seq++, x: 0, y: 0, dir: 'down', path: [], speed: 30, walking: false, frame: 0, bubble: null, t: 0, wait: 0, ...o }; if (a.pts && o.x === undefined) { a.x = a.pts[0][0]; a.y = a.pts[0][1] + 2; } list.push(a); return a; };
  const say = (a, msg, s = 3) => { a.bubble = { msg, until: s }; };
  const nav = (a, x, y) => { a.path = F.walker.findPath(a.x, a.y, x, y).map((p) => [p[0], p[1]]); if (!a.path.length) a.path = [[x, y]]; };
  const routes = F.paths.map(densify);
  const cap = F.n === 2 ? 10 : 9;
  const kunder = () => list.filter((a) => a.role === 'kund' || a.role === 'gast').length;

  // ---------- personal ----------
  const an = F.anchors;
  if (F.n === 1) {
    A({ role: 'staff', mode: 'still', look: staffLook(rng, { style: 'bun' }), x: an.info[0], y: an.info[1], lines: ['VÄLKOMMEN!', 'KAN JAG HJÄLPA TILL?', 'SOFFOR FINNS PÅ PLAN 2!', 'KARTAN FINNS HÄR!'], tip: 1 });
    an.kassor.forEach((k, i) => A({ role: 'staff', mode: 'still', look: staffLook(rng), x: k.cashier[0], y: k.cashier[1], frame: 5, lines: ['HEJ HEJ!', 'VILL DU HA EN KASSE?', 'NÄSTA, TACK!', 'KVITTOT?'], tip: 4 + i }));
    A({ role: 'staff', mode: 'still', look: staffLook(rng, { hat: 'cap', cap: '#f4f1ea' }), x: an.korv[0], y: an.korv[1], dir: 'left', lines: ['KORV, 10 KRONOR!', 'MED SENAP?', 'GLASS, 5 KRONOR!'], tip: 5 });
    // truckföraren i lagret
    const lg = an.lager;
    A({ role: 'staff', mode: 'truck', look: staffLook(rng, { hat: 'cap', cap: '#f2c230', top: 'hiVis', shirt: '#f2c230' }), x: lg.x0 + 40, y: lg.y, x0: lg.x0 + 10, x1: lg.x1 - 40, speed: 32, dirX: 1, lines: ['SE UPP, TRUCK!', 'PIP PIP!'], tip: 7 });
    // påfyllare i lagret och i marknadshallen, vagnkörare
    const shelves = F.bays.slice(1, 7).map((bx) => [bx + 40, F.lager.fy + 50, 'fyll']);
    if (shelves.length) A({ role: 'staff', mode: 'patrol', look: staffLook(rng), pts: shelves, carry: 'carton', speed: 28, lines: ['FYLLER PÅ!', 'NYA KARTONGER!'], tip: 7 });
    // påfyllaren står på golvet framför vägghyllan (inte inne i den)
    const deptPts = F.depts.slice(0, 6).map((r) => [...F.walker.nearestFree(r.x0 + 40, r.fy + 40), 'fyll']);
    if (deptPts.length) A({ role: 'staff', mode: 'patrol', look: staffLook(rng, { style: 'ponytail' }), pts: deptPts, carry: 'carton', speed: 30, lines: ['FYLLER PÅ!', 'KAN JAG HJÄLPA TILL?'], tip: 0 });
    const cageLane = [[F.depts[0]?.x0 ?? 700, AISLE1 + 2, 'stå'], [F.turnCx - 20, AISLE1 + 2, 'stå'], [F.turnCx - 20, AISLE2 - 2, 'stå'], [F.kassa.x1 + 20, AISLE2 - 2, 'stå']];
    A({ role: 'staff', mode: 'patrol', look: staffLook(rng, { style: 'buzz' }), pts: cageLane, push: 'cage', speed: 26, lines: ['SE UPP BAKOM!', 'HEJ!'], tip: 8 });
    A({ role: 'staff', mode: 'patrol', look: staffLook(rng), pts: [[lg.x0 + 60, lg.cart, 'stå'], [lg.x1 - 110, lg.cart, 'stå']], push: 'flat', speed: 24, lines: ['PLATTA PAKET!', 'TUNGT!'], tip: 7 });
    // barnen i Småland
    const sm = an.smaland;
    for (let i = 0; i < 3; i++) A({ role: 'barn', mode: 'kid', look: kidLook(rng), x: sm.x0 + 8 + i * 22, y: sm.y, hx: sm.x0 + 8 + i * 22, ph: rng() * 6 });
    // kunder vid kassorna
    an.kassor.forEach((k, i) => { if (i !== 1) A({ role: 'kund', mode: 'still', look: kundLook(rng), x: k.queue[0], y: k.queue[1], dir: 'left', push: 'cart', load: 1 + (i & 1) }); });
    // korvätare vid ståborden
    for (const [hx, hy] of an.hightables) A({ role: 'kund', mode: 'still', look: kundLook(rng), x: hx, y: hy, dir: hx > an.korv[0] + 130 ? 'left' : 'right', frame: 9, holding: 'korv' });
  } else {
    // restaurangen: kocken, kassörskan
    A({ role: 'staff', mode: 'still', look: staffLook(rng, { hat: 'cap', cap: '#f4f1ea', top: 'chef', shirt: '#f4f1ea', accent: '#f2c230' }), x: an.cook[0], y: an.cook[1], lines: ['KÖTTBULLAR, VARSÅGOD!', 'LINGON?', 'MOS ELLER POTATIS?'], tip: 2 });
    A({ role: 'staff', mode: 'still', look: staffLook(rng, { style: 'bob' }), x: an.cashierR[0], y: an.cashierR[1], lines: ['NÄSTA, TACK!', 'PÅTÅR INGÅR!', 'SMAKLIG MÅLTID!'], tip: 8 });
    // hjälpsamma säljare i utställningen
    const rooms = F.rooms;
    const stops = (a, b) => rooms.slice(a, b).map((r) => [r.x1 - 14, r.fy + FD - 6, 'hjälp']);
    const nA = F.rowA.length - 1;
    A({ role: 'staff', mode: 'patrol', look: staffLook(rng, { style: 'long' }), pts: stops(0, Math.min(nA, 5)), speed: 26, lines: HELP_LINES, tip: 1 });
    if (rooms.length > nA) A({ role: 'staff', mode: 'patrol', look: staffLook(rng, { style: 'short', glasses: 'square' }), pts: stops(nA, Math.min(rooms.length, nA + 5)), speed: 26, lines: HELP_LINES, tip: 6 });
    // påfyllaren står mellan väggraden och mittraden, vänd mot väggen
    if (rooms.length > 2) A({ role: 'staff', mode: 'patrol', look: staffLook(rng, { style: 'curly' }), pts: rooms.slice(1, 5).map((r) => [...F.walker.nearestFree(r.x0 + 24, r.fy + 36), 'fyll']), carry: 'carton', speed: 28, lines: ['FYLLER PÅ!', 'NYA PRISLAPPAR!'], tip: 0 });
    // gäster som redan sitter och äter
    const free = F.seats.slice();
    for (let i = 0; i < 7 && free.length; i++) {
      const s = free.splice((rng() * free.length) | 0, 1)[0];
      seatGuest(A({ role: 'gast', mode: 'gast', look: kundLook(rng) }), s, 20 + rng() * 60);
    }
  }
  // kunder som strosar längs gången
  const nWalk = F.n === 2 ? 6 : 4;
  for (let i = 0; i < nWalk; i++) {
    const ri = F.n === 1 ? (i === 0 ? 0 : 1) : 0;
    const R = routes[ri];
    const k = Math.floor((i + 0.5) / nWalk * (R.length - 2));
    newKund(ri, k, rng() < 0.35 && F.n === 1 ? 'cart' : null);
  }

  function newKund(ri, k = 0, push = null) {
    const R = routes[ri];
    const a = A({ role: 'kund', mode: 'route', look: kundLook(rng), ri, k, x: R[k][0], y: R[k][1], speed: 22 + rng() * 10, push, load: 1 + ((rng() * 2) | 0), stopIn: 3 + rng() * 8 });
    if (!push && rng() < 0.4) a.holding = 'bag';
    return a;
  }
  function seatGuest(a, s, stay) {
    s.occ = a; a.seat = s; a.x = s.x; a.y = s.y; a.state = 'sit'; a.dir = 'down'; a.stay = stay;
    const pick = () => MENU[(rng() * MENU.length) | 0].id;
    a.tray = { items: ['kottbullar', pick(), ...(rng() < 0.5 ? [pick()] : [])].slice(0, 3), left: 2, t: 0 };
    s.tray = a.tray;
  }
  // en rulltrappsåkare som blir kund när hen kliver av (plan 2 upp, plan 1 ner)
  function spawnRider() {
    if (kunder() >= cap) return;
    if (F.n === 1 && rng() < 0.5) { newKund(0, 0, null); return; } // in genom glasdörrarna
    const e = F.esc.find((x) => (F.n === 2 ? x.id === 'upp' : x.id === 'ner'));
    if (!e) return;
    e.riders.push({ look: kundLook(rng), d: e.run, v: -38, onDone: (r) => { const a = newKund(F.n === 1 ? 1 : 0, 0); a.look = r.look; a.x = e.board[0]; a.y = e.board[1]; } });
  }
  function toRider(a, e) { // kunden kliver på rulltrappan och försvinner från planet
    e.riders.push({ look: a.look, d: 0, v: 38 });
    list.splice(list.indexOf(a), 1);
  }
  // restauranggäst: från gången till brickorna, längs disken, kassan, ett ledigt bord
  function spawnGuest() {
    if (F.n !== 2 || kunder() >= cap + 2) return;
    const s = F.seats.filter((x) => !x.occ);
    if (!s.length) return;
    const r = F.rest;
    const a = A({ role: 'gast', mode: 'gast', look: kundLook(rng), x: r.x1 - 30, y: AISLE2, state: 'in', speed: 28 });
    nav(a, ...F.restLine.start);
  }

  let riderIn = 2, guestIn = 6;
  // ---------- uppdatering ----------
  function update(dt, t, env) {
    for (const e of F.esc) for (const r of e.riders) { r.d += r.v * dt; }
    for (const e of F.esc) {
      e.riders = e.riders.filter((r) => { const done = r.v > 0 ? r.d >= e.run : r.d <= 0; if (done) r.onDone?.(r); return !done; });
    }
    riderIn -= dt;
    if (riderIn <= 0) { riderIn = 7 + rng() * 9; spawnRider(); }
    guestIn -= dt;
    if (guestIn <= 0) { guestIn = 14 + rng() * 14; spawnGuest(); }
    for (const a of [...list]) {
      a.t += dt;
      if (a.bubble) { a.bubble.until -= dt; if (a.bubble.until <= 0) a.bubble = null; }
      a.walking = false;
      const near = Math.hypot(env.px - a.x, env.py - a.y) < 70;
      if (a.lines && !a.bubble && a.role === 'staff') {
        a.chat = (a.chat ?? 4 + rng() * 10) - dt * (near ? 3 : 1);
        if (a.chat <= 0) { a.chat = 9 + rng() * 12; say(a, a.lines[(rng() * a.lines.length) | 0], 3); }
      }
      if (a.mode === 'route') routeStep(a, dt, t);
      else if (a.mode === 'patrol') patrolStep(a, dt, near);
      else if (a.mode === 'truck') truckStep(a, dt);
      else if (a.mode === 'gast') guestStep(a, dt);
    }
  }
  function move(a, dt) {
    const wp = a.path[0];
    if (!wp) return false;
    const dx = wp[0] - a.x, dy = wp[1] - a.y, d = Math.hypot(dx, dy), st = a.speed * dt;
    a.dir = Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    if (d <= st) { a.x = wp[0]; a.y = wp[1]; a.path.shift(); } else { a.x += dx / d * st; a.y += dy / d * st; }
    a.walking = true;
    return true;
  }
  function routeStep(a, dt) {
    const R = routes[a.ri];
    if (a.state === 'look' || a.state === 'sit') {
      a.wait -= dt;
      if (a.wait <= 0) {
        if (a.state === 'sit') { a.x = a.ex.go[0]; a.y = a.ex.go[1]; a.frame = 0; a.sortY = null; }
        a.state = 'back'; nav(a, R[a.k][0], R[a.k][1]);
      }
      return;
    }
    if (a.state === 'detour' || a.state === 'back') {
      if (!move(a, dt)) {
        if (a.state === 'detour') {
          a.dir = 'up'; a.state = 'look'; a.wait = 2 + rng() * 3;
          if (a.ex.seat && rng() < 0.65) { a.state = 'sit'; a.x = a.ex.seat[0]; a.y = a.ex.seat[1]; a.sortY = a.ex.base + 0.5; a.dir = 'down'; a.frame = 5; a.wait = 3 + rng() * 4; if (rng() < 0.5) say(a, ['SKÖN!', 'MJUK!', 'DEN HÄR!', 'HMM...'][(rng() * 4) | 0], 2.5); }
        } else a.state = null;
      }
      return;
    }
    // längs gången
    if (!a.path.length) {
      a.k++;
      if (a.k >= R.length) { // slutet: rulltrappan eller utgången
        const e = F.esc.find((x) => Math.hypot(x.board[0] - a.x, x.board[1] - a.y) < 30);
        if (e) toRider(a, e); else list.splice(list.indexOf(a), 1);
        return;
      }
      a.path = [R[a.k]];
    }
    move(a, dt);
    a.stopIn -= dt;
    if (a.stopIn <= 0 && !a.push) {
      a.stopIn = 6 + rng() * 10;
      const cand = F.ex.filter((e) => !e.hang && !e.rug && Math.abs(e.go[0] - a.x) < 70 && e.go[1] < a.y && a.y - e.go[1] < 130 && e.room.band === (a.y < B_WALL ? 'A' : 'B'));
      if (cand.length) {
        a.ex = cand[(rng() * cand.length) | 0];
        a.state = 'detour'; nav(a, a.ex.go[0], a.ex.go[1]);
      }
    } else if (a.stopIn <= 0) { a.stopIn = 8 + rng() * 8; a.state = 'look'; a.dir = a.y < B_WALL ? 'up' : 'up'; a.wait = 1.5 + rng() * 2; a.ex = { go: [a.x, a.y] }; }
  }
  function patrolStep(a, dt, near) {
    if (a.wait > 0) {
      a.wait -= dt;
      const p = a.pts[a.pi ?? 0];
      if (p[2] === 'fyll') { a.dir = 'up'; a.frame = a.wait > 1.5 ? 9 : 0; if (a.wait < 1.5) a.hands = null; }
      else if (p[2] === 'hjälp') { a.dir = 'down'; a.frame = 0; if (near && !a.bubble && (a.helped ?? 0) <= 0) { say(a, 'KAN JAG HJÄLPA TILL?', 3); a.helped = 12; } }
      if (a.wait <= 0) { a.pi = ((a.pi ?? 0) + 1) % a.pts.length; nav(a, a.pts[a.pi][0], a.pts[a.pi][1]); a.hands = a.carry || null; a.frame = 0; }
      return;
    }
    a.helped = (a.helped ?? 0) - dt;
    a.hands ??= a.carry || null;
    if (!a.path.length && !a.started) { a.started = true; a.pi = 0; nav(a, a.pts[0][0], a.pts[0][1]); }
    if (!move(a, dt)) a.wait = a.pts[a.pi ?? 0][2] === 'stå' ? 1 + rng() * 2 : 4 + rng() * 3;
  }
  function truckStep(a, dt) {
    if (a.wait > 0) { a.wait -= dt; return; }
    a.x += a.dirX * a.speed * dt; a.walking = true;
    if (a.x > a.x1) { a.x = a.x1; a.dirX = -1; a.wait = 2.5; }
    if (a.x < a.x0) { a.x = a.x0; a.dirX = 1; a.wait = 2.5; }
  }
  function guestStep(a, dt) {
    const L = F.restLine;
    if (a.state === 'in') { if (!move(a, dt)) { a.state = 'line'; a.hands = 'tray'; a.tray = { items: ['kottbullar', MENU[1 + ((rng() * 4) | 0)].id], left: 2 }; a.path = [[L.pay[0], L.pay[1]]]; a.speed = 9; } }
    else if (a.state === 'line') { if (!move(a, dt)) { a.state = 'pay'; a.wait = 2; a.dir = 'up'; } else a.dir = 'right'; }
    else if (a.state === 'pay') { a.wait -= dt; if (a.wait <= 0) { const s = F.seats.filter((x) => !x.occ).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0]; if (!s) { a.state = 'out'; nav(a, F.rest.x1 - 20, AISLE2); } else { s.occ = a; a.seat = s; a.state = 'toSeat'; a.speed = 28; nav(a, ...s.approach); } } }
    else if (a.state === 'toSeat') { if (!move(a, dt)) { const s = a.seat; a.x = s.x; a.y = s.y; a.state = 'sit'; a.dir = 'down'; a.hands = null; s.tray = a.tray; a.stay = 25 + rng() * 30; } }
    else if (a.state === 'sit') {
      a.stay -= dt;
      const tr = a.tray; tr.t = (tr.t || 0) + dt;
      tr.left = a.stay > 16 ? 2 : a.stay > 6 ? 1 : 0;
      a.frame = tr.left > 0 ? (Math.floor(tr.t * 1.3) % 3 === 0 ? 5 : 6) : 5;
      if (a.stay <= 0) { const s = a.seat; s.occ = null; s.tray = null; a.seat = null; a.x = s.approach[0]; a.y = s.approach[1]; a.frame = 0; a.state = 'out'; a.hands = 'tray'; a.tray = { items: tr.items, left: 0 }; nav(a, F.rest.x1 - 40, F.rest.fy + 40); }
    } else if (a.state === 'out') {
      if (!move(a, dt)) {
        if (a.hands) { a.hands = null; a.state = 'leave'; const en = F.esc.find((x) => x.id === 'ner'); nav(a, en.board[0] + 14, AISLE2); a.path.push([en.board[0], en.board[1]]); }
      }
    } else if (a.state === 'leave') {
      if (!move(a, dt)) { const e = F.esc.find((x) => x.id === 'ner'); toRider(a, e); }
    }
  }

  // ---------- ritning ----------
  function drawables(ctx, t, inView) {
    const out = [];
    for (const a of list) {
      if (!inView(a.x - 30, a.y - 44, a.x + 30, a.y + 4)) continue;
      out.push({ fy: a.sortY ?? a.y, draw: () => drawAgent(ctx, a, t) });
    }
    return out;
  }
  function drawAgent(ctx, a, t) {
    if (a.mode === 'truck') return drawTruck(ctx, a, t);
    let frame = a.walking ? WALK_SEQ[Math.floor(t * 8 + a.id * 0.37) % 4] : a.frame || (Math.sin(t * 2 + a.id) > 0.93 ? 4 : 0);
    let y = a.y;
    if (a.mode === 'kid') { const j = Math.sin(t * 5 + a.ph); y = a.y - (j > 0.3 ? Math.round((j - 0.3) * 4) : 0); frame = j > 0.3 ? 3 : 0; a.dir = Math.sin(t * 0.7 + a.ph) > 0 ? 'down' : Math.sin(t * 0.5 + a.ph) > 0 ? 'left' : 'right'; }
    const carrying = a.hands === 'carton' || a.hands === 'tray';
    if (carrying) frame = a.walking ? [7, 9, 8, 9][Math.floor(t * 8) % 4] : 9;
    // vagnen: bakom när man går uppåt
    const push = a.push && drawPush(ctx, a, t, true);
    drawPerson(ctx, a.x, y, a.look, a.dir, frame);
    if (push) drawPush(ctx, a, t, false);
    if (carrying) {
      const img = a.hands === 'tray' ? trayImg(a.tray?.items || ['kottbullar'], a.tray?.left ?? 2) : cartonImg();
      const tray = a.hands === 'tray', ox = a.dir === 'left' ? (tray ? -9 : -6) : a.dir === 'right' ? (tray ? 9 : 6) : 0;
      if (a.dir !== 'up') ctx.drawImage(img, Math.round(a.x + ox - img.width / 2), Math.round(y - (tray ? 7 : 12) - img.height));
    }
    if (a.holding === 'bag' && !carrying) ctx.drawImage(bagImg(), Math.round(a.x + (a.dir === 'left' ? -9 : 4)), Math.round(y - 17));
    if (a.holding === 'korv') { const d = dishImg('korv', Math.sin(t * 0.3 + a.id) > 0 ? 2 : 1); ctx.drawImage(d, Math.round(a.x + (a.dir === 'left' ? -14 : -6)), Math.round(y - 26)); }
  }
  function drawPush(ctx, a, t, behind) {
    const img = a.push === 'cage' ? rollCageImg() : a.push === 'flat' ? flatCartImg(true) : pushCartImg(a.load || 0);
    const d = a.dir;
    const isBehind = d === 'up';
    if (behind !== isBehind) return true;
    if (d === 'left') drawFlip(ctx, img, a.x - 8 - img.width, a.y - img.height + 2, a.push !== 'flat');
    else if (d === 'right') drawFlip(ctx, img, a.x + 8, a.y - img.height + 2, a.push === 'flat');
    else if (d === 'up') ctx.drawImage(img, Math.round(a.x - img.width / 2), Math.round(a.y - 16 - img.height));
    else ctx.drawImage(img, Math.round(a.x - img.width / 2), Math.round(a.y + 4 - img.height + 10));
    return true;
  }
  function drawTruck(ctx, a, t) {
    const img = forkliftImg(), flip = a.dirX < 0;
    const x = Math.round(a.x), y = Math.round(a.y - img.height + 4);
    drawFlip(ctx, img, x, y, flip);
    // föraren sitter i hytten
    const sx = flip ? x + img.width - 22 : x + 22;
    drawPerson(ctx, sx, y + 30, a.look, flip ? 'left' : 'right', 5);
    // karossen framför benen
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y + 22, img.width, img.height - 22); ctx.clip();
    drawFlip(ctx, img, x, y, flip);
    ctx.restore();
    if (a.walking && Math.floor(t * 4) % 2) { ctx.fillStyle = '#ffb030'; ctx.fillRect(x + (flip ? img.width - 25 : 22), y + 2, 3, 2); }
  }
  function bubbles(ctx, inView) {
    for (const a of list) {
      if (!a.bubble || !inView(a.x - 40, a.y - 60, a.x + 40, a.y)) continue;
      const head = a.mode === 'truck' ? a.y - 44 : a.frame === 5 || a.frame === 6 ? a.y - 38 : a.y - 42;
      textBubble(ctx, a.x, head, a.bubble.msg, a.role === 'staff');
    }
  }
  // klick på personal (kunder går inte att klicka på)
  function staffAt(x, y) {
    let best = null;
    for (const a of list) {
      if (a.role !== 'staff') continue;
      const w = a.mode === 'truck' ? 26 : 8;
      const cx = a.mode === 'truck' ? a.x + 23 : a.x;
      if (x >= cx - w && x <= cx + w && y >= a.y - 40 && y <= a.y + 3 && (!best || a.y > best.y)) best = a;
    }
    return best;
  }
  // för förhandsvisningar: en kund provsitter närmaste soffa/fåtölj
  function forceSit(px, py) {
    const ex = F.ex.filter((e) => e.seat).sort((p, q) => Math.hypot(p.x - px, p.base - py) - Math.hypot(q.x - px, q.base - py))[0];
    const a = list.find((x) => x.mode === 'route' && !x.push);
    if (!ex || !a) return false;
    a.ex = ex; a.state = 'sit'; a.x = ex.seat[0]; a.y = ex.seat[1]; a.sortY = ex.base + 0.5; a.dir = 'down'; a.frame = 5; a.wait = 8; a.path = [];
    say(a, 'SKÖN!', 4);
    return true;
  }
  return { list, update, drawables, bubbles, staffAt, say, forceSit, riders: () => F.esc.flatMap((e) => e.riders) };
}

// gula gångens hörnpunkter → täta punkter var 40:e px (kundernas väg)
function densify(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 40));
    for (let j = 0; j < n; j++) out.push([Math.round(ax + (bx - ax) * j / n), Math.round(ay + (by - ay) * j / n)]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
export { escPos };
