// DEN LÖPANDE LÄGENHETEN (Carl 2026-09-30: "jag vill inte ha olika rum som man går in i utan en
// löpande lägenhet"). Bostadens rum ligger i rad i en och samma bild: man går mellan dem genom
// öppningar i mellanväggarna (badrummet har en dörr som står öppen), och kameran följer figuren –
// på telefonen i samma storlek som i staden (main.js PHONE_VIEW_H), utan mörka kanter när
// lägenheten är bredare än skärmen.
//
// Varje rum är samma rum som förut (room.js makeRoom i rumsläget "core"): egna möbler (hem:N i
// sparfilen – oförändrat), husdjur, säng, skyltar, fönster och utsikt. Rummen läggs vänster →
// höger i bostadens ordning (badrummet sist); husvagnen slutar med gården och Ettan med
// trapphuset. Ytterdörren sitter kvar i första rummet. Möblera gäller rummet man trycker i
// (en möbel flyttas mellan rummen via 📦 Förråd). Figuren "är" i ett rum i taget (A.roomSub –
// besökare ser en där); går man till ett annat rum går den genom öppningarna dit.
import { makeRoom, homeRooms, APT } from './room.js';
import { toast } from '../core/ui.js';
import { mix, css } from '../core/floor-pix.js';
import { $t } from '../core/i18n.js';

const FW = 384, FH = 216, WALL_Y = 86;
const NIGHT_DIM = 0.22;
const isNight = (g) => { const h = g.min / 60; return h >= 19.5 || h < 6.5; };

export function makeApartment(A, { visit = false } = {}) {
  const g = A.game;
  const info = homeRooms(A, visit);
  const n = info.rooms.length;
  // rummens platser i lägenheten (spelpixlar från vänster)
  let x = 0;
  const slots = info.rooms.map((r, i) => { const s = { ...r, ox: x }; x += r.w + (i < n - 1 ? APT.WALLW : 0); return s; });
  const last = slots[n - 1];
  const tailW = last.outside ? FW - last.w : 0; // husvagnens gård / Ettans trapphus efter sista rummet
  const W = x + tailW;
  let active = Math.max(0, Math.min(n - 1, A.roomSub | 0));
  A.roomSub = active;
  let camX = 0;

  const cores = slots.map((s, i) => makeRoom(A, { visit, sub: i, core: {
    hopped: i > 0, // (bara första rummet synkar husdjuren vid hemkomsten)
    sides: [...(i > 0 ? [{ side: 'L', y0: APT.DY0, y1: APT.DY1 }] : []), ...(i < n - 1 ? [{ side: 'R', y0: APT.DY0, y1: APT.DY1 }] : [])],
    active: () => active === i,
    dx: () => s.ox - camX,
    sleepOf: () => sleepSt(),
    brisk: () => !!route,
  } }));
  // sömnen i något av rummen (hela lägenheten mörknar och ljusnar med den)
  const sleepSt = () => { for (const c of cores) { const st = c.core.sleepSt(); if (st) return st; } return null; };
  const C = (i) => cores[i].core;

  // ---------- kameran ----------
  const playerWorld = () => { const p = C(active).player(); return { x: slots[active].ox + p.x, y: p.y }; };
  // Kameran utgår från den SYNLIGA delen av canvasen (A.view.safe – på datorn i fyll-läget
  // förstoras bilden och sidorna beskärs): figuren i mitten av det man ser, lägenhetens kanter
  // mot de synliga kanterna, och är lägenheten smalare än det synliga står den i mitten.
  const seen = () => { const sf = A.view?.safe; const x0 = sf ? sf.x0 : 0, x1 = sf ? sf.x1 : (A.W || FW); return x1 > x0 ? [x0, x1] : [0, A.W || FW]; };
  const camTarget = () => {
    const [x0, x1] = seen(), vis = x1 - x0;
    if (W <= vis) return -(x0 + (vis - W) / 2);
    return Math.max(-x0, Math.min(W - x1, playerWorld().x - (x0 + vis / 2)));
  };
  camX = camTarget();

  // vilket rum en världs-x hör till (mellanväggen räknas till rummet till vänster)
  const roomAt = (wx) => { for (let i = n - 1; i >= 0; i--) if (wx >= slots[i].ox) return i; return 0; };

  // ---------- att gå till ett annat rum ----------
  // Figuren går till öppningen åt rätt håll, kliver igenom (in i nästa rum) och fortsätter tills den
  // är i målrummet – där tar rummet över klicket (gå dit, använd möbeln …).
  let route = null; // { to, x, y }
  function step() {
    if (!route) return;
    if (active === route.to) { const r = route; route = null; cores[active].down(r.x, r.y); return; }
    const dir = route.to > active ? 1 : -1, s = slots[active];
    C(active).walkTo(dir > 0 ? s.w - 9 : 9, APT.GO_Y, () => cross(dir));
  }
  function cross(dir) {
    if (!route) return;
    const from = active;
    active += dir;
    A.roomSub = active;
    const s = slots[active];
    C(from).stop();
    C(active).place(dir > 0 ? 9 : s.w - 9, APT.GO_Y, dir > 0 ? 'right' : 'left');
    C(from).hopPets(active, dir > 0 ? 22 : s.w - 22, APT.GO_Y);
    step();
  }
  function goTo(j, lx, ly) {
    route = { to: j, x: lx, y: ly };
    step();
  }

  // ---------- Möblera: rummet man trycker i ----------
  const decorRoom = () => { for (let i = 0; i < n; i++) if (C(i).decorOn()) return i; return -1; };
  function toggleDecor(force) {
    const on = force !== undefined ? !!force : decorRoom() < 0;
    const cur = decorRoom();
    if (!on) { if (cur >= 0) cores[cur].toggleDecor(false); return; }
    if (cur < 0) cores[active].toggleDecor(true);
  }

  // ---------- mellanväggarna ----------
  // En vägg som går från bakväggen rakt ut mot oss: uppe gaveln mot bakväggen, nere väggens krön
  // (ljust) med mörka kanter, och öppningen på golvets höjd med tröskel och karm. Till badrummet
  // en dörr som står uppslagen in mot badrummet.
  function drawWall(ctx, L, R) {
    const x0 = Math.round(R.ox - APT.WALLW - camX), w = APT.WALLW;
    if (x0 > (A.W || FW) || x0 + w < 0) return;
    const face = mix(L.wallDk, R.wallDk, 0.5), cap = mix(mix(L.wall, R.wall, 0.5), 0xf4f0e6, 0.45), edge = 0x1c1a20;
    const f = (c, a, b, cw, ch) => { ctx.fillStyle = css(c); ctx.fillRect(a, b, cw, ch); };
    // gaveln mot bakväggen
    f(face, x0, 0, w, WALL_Y);
    f(mix(face, 0xffffff, 0.18), x0 + 1, 0, 1, WALL_Y);
    f(mix(face, 0x000000, 0.25), x0 + w - 2, 0, 1, WALL_Y);
    // krönet ut över golvet (med öppningen)
    const seg = (a, b) => { f(cap, x0, a, w, b - a); f(edge, x0, a, 1, b - a); f(edge, x0 + w - 1, a, 1, b - a); f(mix(cap, 0x000000, 0.12), x0 + 1, b - 2, w - 2, 2); };
    seg(WALL_Y, APT.DY0);
    seg(APT.DY1, FH);
    // öppningen: tröskel mellan rummens golv, karmarna uppe och nere
    f(mix(L.floorA, R.floorA, 0.5), x0, APT.DY0, w, APT.DY1 - APT.DY0);
    f(mix(mix(L.floorB, R.floorB, 0.5), 0x000000, 0.1), x0 + 2, APT.DY0, w - 4, APT.DY1 - APT.DY0);
    f(0x6a4a2a, x0, APT.DY0 - 2, w, 2);
    f(0x6a4a2a, x0, APT.DY1, w, 2);
    // skuggan på golvet längs väggen (båda sidor)
    ctx.fillStyle = 'rgba(20,12,28,0.18)';
    ctx.fillRect(x0 - 2, WALL_Y, 2, APT.DY0 - 2 - WALL_Y); ctx.fillRect(x0 + w, WALL_Y, 2, APT.DY0 - 2 - WALL_Y);
    ctx.fillRect(x0 - 2, APT.DY1 + 2, 2, FH - APT.DY1 - 2); ctx.fillRect(x0 + w, APT.DY1 + 2, 2, FH - APT.DY1 - 2);
    // badrumsdörren: uppslagen in i badrummet (en bräda längs karmen uppe)
    if (R.bath) {
      const dx = x0 + w, dy = APT.DY0 - 2;
      f(0x1c1a20, dx, dy - 1, 20, 5);
      f(0xb08a5a, dx, dy, 19, 3);
      f(0xd0aa74, dx, dy, 19, 1);
      f(0xe8c070, dx + 15, dy + 1, 2, 1); // handtaget
    }
  }

  const scene = {
    // fit() i main.js: lägenheten är så bred som rummen (+ gården/trapphuset) – kameran följer
    get viewMax() { return { w: W, h: FH }; },
    get worldX() { return C(active).player().x; },
    get worldY() { return C(active).player().y; },
    get asleep() { return cores.some((c) => c.asleep); },
    toggleDecor,
    bedtime: (onWake) => cores[active].bedtime(onWake),
    update(dt) {
      for (const c of cores) c.update(dt);
      const tg = camTarget();
      camX += (tg - camX) * Math.min(1, dt * 8);
      if (Math.abs(tg - camX) < 0.3) camX = tg;
    },
    down(sx, sy) {
      const wx = sx + camX, j = Math.min(roomAt(wx), n - 1), lx = Math.min(wx - slots[j].ox, slots[j].w - 6);
      if (scene.asleep) { cores[active].down(lx, sy); return; } // klick under sömnen spolar fram
      const dr = decorRoom();
      if (dr >= 0) {
        if (j === dr) { cores[j].down(lx, sy); return; }
        if (C(dr).carrying()) { toast($t('📦 Den står kvar i det här rummet – lägg den i förrådet, så kan du ställa ut den i ett annat rum.')); return; }
        cores[dr].toggleDecor(false); cores[j].toggleDecor(true);
        cores[j].down(lx, sy);
        return;
      }
      if (j === active) { route = null; cores[j].down(lx, sy); return; }
      goTo(j, Math.max(6, lx), sy);
    },
    move(sx, sy) { const wx = sx + camX, dr = decorRoom(), k = dr >= 0 ? dr : active; cores[k].move(wx - slots[k].ox, sy); },
    up(sx, sy) { const wx = sx + camX, dr = decorRoom(), k = dr >= 0 ? dr : active; cores[k].up(wx - slots[k].ox, sy); },
    key(k) { const dr = decorRoom(); cores[dr >= 0 ? dr : active].key(k); },
    exit() { route = null; for (const c of cores) c.exit(); },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.fillStyle = '#17151a'; ctx.fillRect(0, 0, A.W, A.H);
      const vw = A.W || FW;
      slots.forEach((s, i) => {
        const x0 = s.ox - camX, w = s.w + (i === n - 1 ? tailW : 0);
        if (x0 >= vw || x0 + w <= 0) return;
        ctx.save();
        ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
        ctx.beginPath(); ctx.rect(Math.round(x0), 0, w, FH); ctx.clip();
        cores[i].draw(ctx);
        ctx.restore();
      });
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      for (let i = 0; i < n - 1; i++) drawWall(ctx, slots[i], slots[i + 1]);
      // mellanväggarna mörknar som rummen (kvällen, och sömnens mörker och gryning)
      const st = sleepSt();
      const shades = [];
      if (st ? st.bg === 'dark' || (st.bg === 'now' && isNight(g)) : isNight(g)) shades.push(`rgba(10,12,40,${NIGHT_DIM})`);
      if (st?.dim > 0) shades.push(`rgba(8,10,34,${st.dim.toFixed(3)})`);
      if (st?.warm > 0) shades.push(`rgba(255,164,96,${st.warm.toFixed(3)})`);
      for (const c of shades) {
        ctx.fillStyle = c;
        for (let i = 0; i < n - 1; i++) ctx.fillRect(Math.round(slots[i + 1].ox - APT.WALLW - camX), 0, APT.WALLW, FH);
      }
    },
  };
  // testerna: lägenhetens läge + allt som rummet man står i har (_debug i room.js)
  const extra = {
    apt: () => ({ active, camX, W, seen: seen(), decorRoom: decorRoom(), route: route && { ...route }, rooms: slots.map((s) => ({ name: s.name, ox: s.ox, w: s.w, bath: s.bath })) }),
    room: (i) => cores[i]._debug,
    goRoom: (j, x = 60, y = APT.GO_Y) => { goTo(j, x, y); return true; },
    wme: () => { const p = C(active).player(); return { ...p, room: active, wx: slots[active].ox + p.x }; },
    // klickpunkter i rummet man står i → på skärmen (lägenheten har en kamera)
    spot: (id) => { const s = cores[active]._debug.spot(id); return s ? { x: s.x + slots[active].ox - camX, y: s.y } : null; },
    tile: (a, b) => { const s = cores[active]._debug.tile(a, b); return { x: s.x + slots[active].ox - camX, y: s.y }; },
    toScreen: (lx, room = active) => lx + slots[room].ox - camX,
  };
  scene._debug = new Proxy(extra, { get: (t, k) => (k in t ? t[k] : cores[active]._debug[k]), has: (t, k) => k in t || k in cores[active]._debug });
  return scene;
}
