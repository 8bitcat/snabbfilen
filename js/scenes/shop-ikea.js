// MÖBELJÄTTEN – varuhuset "som IKEA": man går in genom den blågula entrén,
// följer den gula gångvägen med pilar genom en rad SMÅ INREDDA RUM
// (vardagsrum, kök, kontor, sovrum, barnrum, badrum, hall …), förbi
// restaurangen (KÖTTBULLAR 49:-) och marknadshallen, och ut genom kassan.
//
// Allt är gåbart med den egna figuren och ritas i spelets pixelkorn (heltal,
// sprites i skala 1). Varje möbel man kan köpa står utställd med en gul
// prislapp (namn + pris), lyser upp med en kontur när man står nära eller
// pekar på den, och ett klick = figuren går dit och köpdialogen öppnas
// (openBuy i shop-mobler.js). Sängar, garderober och kylskåp står med som
// inredning men säljs inte här (de ingår i bostaden).
//
// Utställningen byggs UR KATALOGEN: rummen har handplacerade "recept", och
// varje möbelsort i KATALOG ställs ut i sitt rum (k.room om fältet finns,
// annars KIND_ROOM nedan, annars marknadshallen). Nya möbler packas in till
// höger i sitt rum – blir rummet för brett delas det på "VARDAGSRUM 2" osv.
// Varuhuset blir så brett som rummen kräver (två rader rum, gång mellan).
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { openModal, closeModal, toast } from '../core/ui.js';
import * as GAME from '../game.js';
import { play } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables } from './walkable.js';
import { worldFolksHere } from '../net/world.js';
import { FRAMES } from '../data/frames.js';
import * as ROOM from './room.js';
import * as MOB from './shop-mobler.js';
import { drawPerson } from '../core/people.js';

// ---------- geometri (spelpixlar) ----------
const VW = 384, VH = 216;
const TOP = 12;                       // takkanten ovanför bakväggarna
const WH = 58;                        // väggarnas höjd i bild
const FD = 92;                        // rummens djup (golvet)
const AI = 36;                        // gångarnas djup
const PW = 6, OW = 6;                 // mellanvägg / yttervägg
const A_WALL = TOP, A_FLOOR = A_WALL + WH, A_AISLE = A_FLOOR + FD;       // 12 · 70 · 162
const B_WALL = A_AISLE + AI, B_FLOOR = B_WALL + WH, B_AISLE = B_FLOOR + FD; // 198 · 256 · 348
const H = B_AISLE + AI + 4;                                              // 388
const AISLE1 = A_AISLE + AI / 2, AISLE2 = B_AISLE + AI / 2;
const ROWY = { wall: 6, mid: 50, front: 82 }; // möblernas fotlinje i rummet (från golvkanten)
const LOBBY_IW = 170, REST_IW = 178, KASSA_IW = 178, TURN_W = 66;
const MIN_IW = 150, MAX_IW = 280;
const SPEED = 105;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- rumstyperna: tapet, golv, namn ----------
const TYPES = {
  vardagsrum: { name: 'VARDAGSRUM', wall: 0x8ea896, trim: 0x6d8876, paper: 'rand', wains: 14, floor: 'ek', curtain: 0xd8c8a0 },
  kok: { name: 'KÖK', wall: 0xeeebe3, trim: 0x8aa4b4, paper: 'kakel', wains: 0, floor: 'schack' },
  kontor: { name: 'KONTOR', wall: 0x9aaec2, trim: 0x71859a, paper: 'slat', wains: 12, floor: 'filt' },
  sovrum: { name: 'SOVRUM', wall: 0xc6a5b4, trim: 0x9a7c8b, paper: 'prick', wains: 14, floor: 'ljus', curtain: 0xe890b0 },
  barnrum: { name: 'BARNRUM', wall: 0xf2da8e, trim: 0x86b8dc, paper: 'stjarna', wains: 12, floor: 'blamatta', curtain: 0x7fc0e8 },
  badrum: { name: 'BADRUM', wall: 0xb5ddd8, trim: 0x86b6b2, paper: 'kakel', wains: 0, floor: 'mosaik' },
  hall: { name: 'HALL', wall: 0xd6bd92, trim: 0x8d6f4a, paper: 'panel', wains: 24, floor: 'sten' },
  ovrigt: { name: 'MARKNADSHALLEN', wall: 0xe2e0da, trim: 0x1f58a8, paper: 'butik', wains: 0, floor: 'butik' },
};
const REST_STYLE = { name: 'RESTAURANG', wall: 0x9a6a46, trim: 0x5e3c26, paper: 'trapanel', wains: 18, floor: 'terrakotta' };
const KASSA_STYLE = { name: 'KASSA', wall: 0xe2e0da, trim: 0x1f58a8, paper: 'butik', wains: 0, floor: 'butik' };
const EXTRA_STYLES = [
  { wall: 0xa9b8a0, trim: 0x7a8a70, paper: 'rand', wains: 14, floor: 'ljus' },
  { wall: 0xc8b0a0, trim: 0x957a68, paper: 'prick', wains: 14, floor: 'ek' },
  { wall: 0xa0b0c8, trim: 0x70809a, paper: 'slat', wains: 12, floor: 'filt' },
];
const SHOW_ORDER = ['vardagsrum', 'kok', 'kontor', 'sovrum', 'barnrum', 'badrum', 'hall'];

// Var en möbelsort hör hemma när katalogposten saknar k.room.
const KIND_ROOM = {
  soffa: 'vardagsrum', fatolj: 'vardagsrum', bordR: 'vardagsrum', spis: 'vardagsrum', tv: 'vardagsrum',
  lampa: 'vardagsrum', vaxtS: 'vardagsrum', matta: 'vardagsrum', bokhylla: 'vardagsrum',
  bordM: 'kok', stol: 'kok', byra: 'sovrum', spegel: 'hall',
};
// k.room i klartext → rumstyp ("Kök", "VARDAGSRUM", "marknadshallen" …)
const ROOM_ALIAS = { marknadshall: 'ovrigt', marknadshallen: 'ovrigt', ovrigt: 'ovrigt', annat: 'ovrigt', vardagsrummet: 'vardagsrum', koket: 'kok', sovrummet: 'sovrum', badrummet: 'badrum', hallen: 'hall', kontoret: 'kontor', barnrummet: 'barnrum' };
const normRoom = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// Inredning som står med men inte säljs här (ingår i bostaden).
const DECOR = { sang: 'Sängen', garderob: 'Garderoben', kylskap: 'Kylskåpet' };

// ---------- recepten: handplacerade rum ----------
// it: [sort, variant, x, rad | fotlinje, { c: egen färg }]  (x från rummets innerkant)
// rugs: { v, x, y (överkant), tag: [mitt-x, y], c }   fix: [namn, x, bredd]
// deco: [sort, x, y, b, h, extra] – på väggen (y negativt = uppåt från golvkanten)
const RECIPES = {
  vardagsrum: {
    IW: 210,
    items: [['bokhylla', 0, 6, 'wall'], ['spis', 1, 52, 'wall'], ['tv', 1, 100, 'wall'], ['lampa', 0, 142, 'wall'], ['vaxtS', 0, 178, 'wall'],
      ['fatolj', 3, 62, 'mid'], ['soffa', 0, 88, 'mid'], ['bordR', 0, 127, 'mid']],
    rugs: [{ v: 0, x: 60, y: 34, tag: [105, 68] }],
    deco: [['tavla', 9, -48, 28, 16, 'land'], ['fonster', 88, -42, 48, 21], ['tavla', 160, -46, 14, 18, 'abstrakt']],
  },
  kok: {
    IW: 182,
    fix: [['kokbank', 6, 80]],
    items: [['kylskap', 0, 90, 'wall'], ['lampa', 1, 122, 'wall'], ['vaxtS', 0, 152, 'wall'],
      ['stol', 2, 56, 'mid'], ['bordM', 0, 78, 'mid'], ['stol', 3, 136, 'mid']],
    deco: [['klocka', 110, -47, 11, 11]],
  },
  kontor: {
    IW: 182,
    items: [['bokhylla', 1, 8, 'wall'], ['tv', 0, 58, 'wall'], ['byra', 2, 118, 'wall'],
      ['stol', 0, 76, 'mid'], ['lampa', 0, 10, 'front'], ['vaxtS', 0, 152, 'front']],
    deco: [['tavla', 10, -46, 26, 15, 'abstrakt'], ['fonster', 62, -42, 40, 20], ['anslag', 122, -40, 40, 22]],
  },
  sovrum: {
    IW: 208,
    items: [['garderob', 0, 6, 'wall'], ['sang', 2, 50, 32], ['lampa', 0, 94, 'wall'], ['byra', 1, 122, 'wall'], ['spegel', 0, 182, 'wall'],
      ['fatolj', 1, 120, 'mid'], ['vaxtS', 0, 178, 'front']],
    rugs: [{ v: 1, x: 36, y: 34, tag: [70, 58], c: '#9a6386' }],
    deco: [['tavla', 52, -46, 28, 18, 'blomma'], ['fonster', 124, -42, 44, 21]],
  },
  barnrum: {
    IW: 196,
    fix: [['leksaker', 12, 40]],
    items: [['sang', 4, 8, 32], ['bokhylla', 2, 56, 'wall'], ['lampa', 1, 100, 'wall'],
      ['stol', 1, 92, 'mid'], ['bordR', 1, 120, 'mid'], ['fatolj', 2, 160, 'mid']],
    rugs: [{ v: 0, x: 88, y: 34, tag: [133, 68], c: '#e58fb6' }],
    deco: [['affisch', 12, -46, 24, 20], ['fonster', 132, -42, 42, 21]],
  },
  badrum: {
    IW: 172,
    fix: [['badkar', 6, 56], ['toalett', 70, 18], ['handfat', 96, 26]],
    items: [['spegel', 2, 132, 'wall'], ['vaxtS', 0, 142, 'front']],
    rugs: [{ v: 1, x: 36, y: 34, tag: [81, 58], c: '#6fb8c2' }],
    deco: [['fonster', 16, -42, 30, 18], ['handdukar', 150, -40, 16, 16]],
  },
  hall: {
    IW: 168,
    fix: [['ytterdorr', 8, 30], ['hangare', 44, 24]],
    items: [['spegel', 1, 76, 'wall'], ['byra', 3, 106, 'wall'], ['stol', 3, 30, 'mid'], ['lampa', 1, 146, 'front']],
    rugs: [{ v: 1, x: 50, y: 34, tag: [100, 58] }],
    deco: [['tavla', 110, -42, 40, 18, 'land']],
  },
  // marknadshallen: allt som inte har något eget rum + fler färger av sortimentet
  ovrigt: {
    IW: 0,
    // [sort, variant, zon?] – speglar lutar mot väggen
    auto: [['lampa', 0], ['lampa', 1], ['spegel', 0, 'wall'], ['spegel', 1, 'wall'], ['spegel', 2, 'wall'], ['bokhylla', 2], ['spis', 0], ['spis', 2], ['vaxtS', 0],
      ['stol', 0], ['stol', 1], ['stol', 2], ['stol', 3], ['bordR', 2], ['bordR', 3], ['fatolj', 0], ['fatolj', 1], ['soffa', 3], ['soffa', 4]],
  },
};

// ---------- katalogen ----------
const KAT = () => (Array.isArray(GAME.KATALOG) ? GAME.KATALOG : []);
const katOf = (k) => KAT().find((x) => x.kind === k) || null;
const frameOf = (k, v) => FRAMES[k + (v | 0)] || FRAMES[k + '0'] || null;
function dims(k, v) {
  if (k === 'matta') return { w: 90, h: 48 };
  const f = frameOf(k, v);
  return f ? { w: f[2], h: f[3] } : { w: 24, h: 18 }; // ingen sprite än → platt kartong
}
const varOf = (k, v) => {
  const kat = katOf(k);
  let n = Math.max(0, v | 0);
  if (kat?.vars) n = Math.min(kat.vars - 1, n);
  return k === 'matta' || FRAMES[k + n] ? n : 0;
};
const tagName = (k) => String(katOf(k)?.name || k).toUpperCase();
const tagPrice = (k) => `${katOf(k)?.price ?? '?'}:-`;
const tagDims = (k) => ({ w: Math.max(textW(SMALL, tagName(k)), textW(SMALL, tagPrice(k))) + 6, h: 15 });

// ================= planen: vilka rum, vad står var =================
function newRoom(type, rc) {
  const st = TYPES[type];
  const keep = (k) => !!katOf(k) || !!DECOR[k];
  return {
    type, st, name: st.name, IW: rc?.IW || 0,
    items: (rc?.items || []).filter(([k]) => keep(k)).map(([k, v, x, row, o]) => ({ k, v: varOf(k, v), x, row, c: o?.c || null })),
    rugs: katOf('matta') ? (rc?.rugs || []).map((r) => ({ ...r, v: varOf('matta', r.v) })) : [],
    fix: (rc?.fix || []).slice(), deco: (rc?.deco || []).slice(),
  };
}
const shows = (room, k) => room.items.some((it) => it.k === k) || (k === 'matta' && room.rugs.length > 0);

// Packa in en möbel till höger i rummet (höga vid väggen, låga på golvet).
function slotW(k, v) { return k === 'matta' ? 96 : Math.max(dims(k, v).w, tagDims(k).w) + 6; }
function packOne(room, e) {
  room._wx ??= room.IW ? room.IW + 2 : 8;
  room._mx ??= room._wx;
  const d = dims(e.k, e.v), sw = slotW(e.k, e.v);
  if (e.k === 'matta') {
    const x = room._mx + 3;
    room.rugs.push({ v: e.v, x, y: 34, tag: [x + 45, 58], c: e.c || null });
    room._mx += sw;
  } else if (e.zone === 'wall' || (d.h > 26 && e.zone !== 'mid')) {
    room.items.push({ k: e.k, v: e.v, x: Math.round(room._wx + (sw - d.w) / 2), row: 'wall', c: e.c || null });
    room._wx += sw;
  } else {
    room.items.push({ k: e.k, v: e.v, x: Math.round(room._mx + (sw - d.w) / 2), row: 'mid', c: e.c || null });
    room._mx += sw;
  }
  room.IW = Math.max(room.IW, room._wx + 4, room._mx + 4, MIN_IW);
}
function wouldFit(room, e) {
  if (room.type === 'ovrigt') return true;
  const wx = room._wx ?? (room.IW ? room.IW + 2 : 8), mx = room._mx ?? wx;
  const tall = e.k !== 'matta' && (e.zone === 'wall' || (dims(e.k, e.v).h > 26 && e.zone !== 'mid'));
  return (tall ? wx : mx) + slotW(e.k, e.v) + 4 <= MAX_IW;
}

// Rum utan recept får fönster/tavlor där väggen är fri (ovanför låga möbler).
function autoDeco(room) {
  const busy = room.items.filter((it) => (typeof it.row === 'number' ? it.row : ROWY[it.row]) <= ROWY.wall + 30)
    .map((it) => { const d = dims(it.k, it.v); return [it.x - 3, it.x + d.w + 3, d.h]; });
  const free = [];
  let x = 6;
  const blocks = busy.filter((b) => b[2] > 20).sort((a, b) => a[0] - b[0]);
  for (const b of blocks) { if (b[0] - x > 0) free.push([x, b[0]]); x = Math.max(x, b[1]); }
  if (room.IW - 6 - x > 0) free.push([x, room.IW - 6]);
  free.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
  const out = [];
  const signL = room.IW / 2 - 40, signR = room.IW / 2 + 40;
  for (const [a, b] of free) {
    const w = b - a;
    if (w >= 44 && !out.some((d) => d[0] === 'fonster')) { const ww = Math.min(52, w - 8); out.push(['fonster', Math.round(a + (w - ww) / 2), -42, ww, 21]); }
    else if (w >= 22 && out.length < 3) { const ww = Math.min(30, w - 6), px = Math.round(a + (w - ww) / 2); if (px + ww < signL || px > signR) out.push(['tavla', px, -48, ww, 16, out.length % 2 ? 'abstrakt' : 'land']); }
  }
  return out;
}

function buildPlan() {
  const rooms = [];
  const byType = {};
  for (const type of SHOW_ORDER) {
    const r = newRoom(type, RECIPES[type]);
    rooms.push(r); byType[type] = [r];
  }
  const market = newRoom('ovrigt', RECIPES.ovrigt);
  byType.ovrigt = [market];

  // varje möbelsort i sitt rum (k.room → tabellen → marknadshallen)
  const extras = new Map(); // rumstyp → [{k, v}]
  let custom = 0;
  for (const kat of KAT()) {
    let type = KIND_ROOM[kat.kind] || 'ovrigt';
    const raw = Array.isArray(kat.room) ? kat.room[0] : kat.room;
    if (raw) {
      const n = normRoom(raw);
      type = ROOM_ALIAS[n] || n || type;
      if (!TYPES[type]) { // ett helt nytt rum, t.ex. "Trädgård"
        TYPES[type] = { ...EXTRA_STYLES[custom++ % EXTRA_STYLES.length], name: String(raw).toUpperCase().slice(0, 16) };
      }
      if (!byType[type]) { const r = newRoom(type, null); rooms.push(r); byType[type] = [r]; }
    }
    if (byType[type].some((r) => shows(r, kat.kind))) continue;
    if (!extras.has(type)) extras.set(type, []);
    extras.get(type).push({ k: kat.kind, v: 0 });
  }
  // marknadshallen: först det som saknar rum, sedan färgväggen
  const mExtra = extras.get('ovrigt') || [];
  extras.delete('ovrigt');
  for (const [k, v, zone] of RECIPES.ovrigt.auto) if (katOf(k)) mExtra.push({ k, v: varOf(k, v), zone });
  for (const e of mExtra) packOne(market, e);
  if (!market.items.length && !market.rugs.length) market.IW = MIN_IW;

  // de övriga: packas in i sitt rum, flyttar till "NAMN 2" när det blir för trångt
  for (const [type, list] of extras) {
    for (const e of list) {
      const arr = byType[type];
      let room = arr[arr.length - 1];
      if (!wouldFit(room, e) && (room.items.length || room.rugs.length)) {
        const extra = newRoom(type, null);
        extra.name = `${TYPES[type].name} ${arr.length + 1}`;
        rooms.splice(rooms.indexOf(room) + 1, 0, extra);
        arr.push(extra);
        room = extra;
      }
      packOne(room, e);
    }
  }
  for (const r of rooms) { r.IW = Math.max(r.IW, MIN_IW); if (!r.deco.length) r.deco = autoDeco(r); }
  rooms.forEach((r, i) => { r.num = i + 1; });
  market.num = rooms.length + 1;
  return { rooms, market };
}

// ================= planlösningen =================
// Rad A (överst): entrén + första rummen, gången går österut.
// Rad B: restaurangen (efter svängen), resten av rummen, marknadshallen och
// kassan – gången går västerut och slutar vid utgången under entrén.
function layoutStore(plan) {
  const lobby = { special: 'lobby', name: 'MÖBELJÄTTEN', IW: LOBBY_IW, st: TYPES.ovrigt };
  const rest = { special: 'rest', name: 'RESTAURANG', IW: REST_IW, st: REST_STYLE };
  const kassa = { special: 'kassa', name: 'KASSA', IW: KASSA_IW, st: KASSA_STYLE };
  const market = plan.market;
  const seg = (list) => list.reduce((a, r) => a + r.IW + PW, 0);
  const R = plan.rooms;
  let best = null;
  for (let k = 1; k < R.length; k++) {
    const wa = OW + lobby.IW + seg(R.slice(0, k)) + OW;
    const wb = OW + kassa.IW + seg([market, ...R.slice(k), rest]) + PW + TURN_W + OW;
    const W = Math.max(wa, wb);
    if (!best || W < best.W) best = { k, wa, wb, W };
  }
  if (!best) best = { k: R.length, wa: OW + lobby.IW + seg(R) + OW, wb: OW + kassa.IW + seg([market, rest]) + PW + TURN_W + OW };
  best.W = Math.max(best.wa, best.wb, VW);
  const W = best.W;
  const rowA = R.slice(0, best.k), rowB = R.slice(best.k);
  // överskottet fördelas på rummen i den kortare raden (innehållet centreras)
  const stretch = (list, extra) => {
    if (!list.length || extra <= 0) return;
    const each = Math.floor(extra / list.length);
    list.forEach((r, i) => { const add = each + (i === 0 ? extra - each * list.length : 0); r.ox = Math.floor(add / 2); r.IW += add; });
  };
  for (const r of [lobby, rest, kassa, market, ...R]) r.ox = 0;
  stretch(rowA.length ? rowA : [lobby], W - best.wa);
  stretch([market, ...rowB], W - best.wb);

  const partitions = [];
  // rad A: vänster → höger
  let x = OW;
  const place = (r, band, hasLeft) => {
    if (hasLeft) { partitions.push({ x, band }); x += PW; }
    r.band = band; r.fy = band === 'A' ? A_FLOOR : B_FLOOR; r.wy = band === 'A' ? A_WALL : B_WALL;
    r.wl = hasLeft ? x - PW : x - OW; r.x0 = x; r.x1 = x + r.IW; r.wr = r.x1 + PW;
    x += r.IW;
  };
  place(lobby, 'A', false);
  for (const r of rowA) place(r, 'A', true);
  // rad B: kassan längst till vänster, sedan marknaden, rummen baklänges, restaurangen
  x = OW;
  place(kassa, 'B', false);
  place(market, 'B', true);
  for (const r of [...rowB].reverse()) place(r, 'B', true);
  place(rest, 'B', true);
  partitions.push({ x, band: 'B' }); // restaurangens högra vägg mot svängen
  const turnX0 = x + PW;

  const showrooms = [...rowA, ...rowB, market];
  const all = [lobby, ...rowA, kassa, market, ...rowB, rest];
  return { W, lobby, rest, kassa, market, rowA, rowB, showrooms, all, partitions, turnX0, turnCx: Math.round((turnX0 + W - OW) / 2) };
}

// ================= utställningen (absoluta koordinater) =================
function buildExhibits(L) {
  const ex = [];
  for (const r of L.showrooms) {
    for (const it of r.items) {
      const kat = katOf(it.k);
      const d = dims(it.k, it.v);
      const x = r.x0 + r.ox + it.x;
      const base = r.fy + (typeof it.row === 'number' ? it.row : ROWY[it.row]);
      const top = base - d.h;
      const solidH = it.k === 'sang' ? d.h - 8 : d.h > 26 ? 12 : 9;
      const tag = kat ? (() => { const td = tagDims(it.k); return { x: Math.round(x + d.w / 2 - td.w / 2), y: base + 2, w: td.w, h: td.h }; })() : null;
      const x0 = Math.min(x, tag ? tag.x : x) - 1, x1 = Math.max(x + d.w, tag ? tag.x + tag.w : 0) + 1;
      ex.push({
        k: it.k, v: it.v, c: it.c, buy: !!kat, room: r, x, base, top, w: d.w, h: d.h, tag,
        solid: [x - 1, base - solidH, x + d.w + 1, base + 1],
        hot: [x0, top - 2, x1, tag ? tag.y + tag.h : base + 3],
        go: [Math.round(x + d.w / 2), base + 7],
      });
    }
    for (const rg of r.rugs) {
      const x = r.x0 + r.ox + rg.x, y = r.fy + rg.y;
      const td = tagDims('matta');
      const tcx = r.x0 + r.ox + rg.tag[0], ty = r.fy + rg.tag[1];
      const tag = { x: Math.round(tcx - td.w / 2), y: ty, w: td.w, h: td.h };
      ex.push({
        k: 'matta', v: rg.v, c: rg.c || null, buy: true, rug: true, room: r, x, y, w: 90, h: 48, base: ty + 1, top: y, tag,
        solid: null, hot: [x, y, x + 90, Math.max(y + 48, tag.y + tag.h)], go: [Math.round(tcx), ty + 8],
      });
    }
  }
  return ex;
}

// ================= små sprites (prislappar, konturer, rekvisita) =================
const TAGS = new Map();
function tagImg(k, hot) {
  const key = k + (hot ? '*' : '');
  if (TAGS.has(key)) return TAGS.get(key);
  const name = tagName(k), price = tagPrice(k);
  const { w, h } = tagDims(k);
  const P = new Pix(w, h + 1);
  const edge = hot ? 0xffffff : 0x7a5a0c, fill = hot ? 0xffe45c : 0xf5cd2e, hi = hot ? 0xfff6c0 : 0xfbe27a;
  P.rect(1, 0, w - 2, h, edge); P.rect(0, 1, w, h - 2, edge);
  P.rect(1, 1, w - 2, h - 2, fill);
  P.hl(1, 1, w - 2, hi);
  P.hl(1, 7, w - 2, mix(fill, 0x7a5a0c, 0.18));
  P.hl(1, h, w - 2, 0x1a1020, 0.3);
  text(P, SMALL, name, Math.floor((w - textW(SMALL, name)) / 2), 2, 0x17336e);
  text(P, SMALL, price, Math.floor((w - textW(SMALL, price)) / 2), 8, 0x141414);
  const img = P.flush();
  TAGS.set(key, img);
  return img;
}
// möbelns kontur (1 px runt siluetten) – när man står nära eller pekar
const OUTLINES = new Map();
function outlineImg(e, col) {
  const key = `${e.k}${e.v}|${e.c || ''}|${col}`;
  if (OUTLINES.has(key)) return OUTLINES.get(key);
  const art = ROOM.furnArt?.(e.k, e.v, e.c);
  if (!art) return null;
  const w = art.sw + 2, h = art.sh + 2;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(art.img, art.sx, art.sy, art.sw, art.sh, 1, 1, art.sw, art.sh);
  let d;
  try { d = x.getImageData(0, 0, w, h).data; } catch { OUTLINES.set(key, null); return null; }
  const out = x.createImageData(w, h), o = out.data;
  const r = (col >> 16) & 255, gg = (col >> 8) & 255, b = col & 255;
  const solid = (i, j) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] > 40;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (solid(i, j)) continue;
    if (!(solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1))) continue;
    const q = (j * w + i) * 4;
    o[q] = r; o[q + 1] = gg; o[q + 2] = b; o[q + 3] = 255;
  }
  x.clearRect(0, 0, w, h);
  x.putImageData(out, 0, 0);
  OUTLINES.set(key, c);
  return c;
}
// platt kartong för möbler som saknar sprite i atlasen
let BOX = null;
function boxImg() {
  if (BOX) return BOX;
  const P = new Pix(24, 18);
  P.rect(0, 2, 24, 16, 0xc49a62); P.rect(0, 0, 24, 3, 0xd8b27a);
  P.box(0, 0, 24, 18, 0x6e5230);
  P.vl(15, 0, 18, 0xe6d6aa); P.vl(16, 0, 18, 0xd2c296);
  text(P, SMALL, 'NY', 3, 8, 0x1f58a8);
  BOX = P.flush();
  return BOX;
}

// ---------- rekvisita som ritas y-sorterat (målas en gång) ----------
function spriteOf(w, h, paint) { const P = new Pix(w, h); paint(P); return P.flush(); }

function cartsImg() {
  return spriteOf(40, 24, (P) => {
    for (let n = 2; n >= 0; n--) {
      const ox = n * 6, oy = 2;
      // korg (trådnät)
      for (let y = oy + 4; y < oy + 14; y++) for (let x = ox + 4; x < ox + 26; x++) {
        const edge = x === ox + 4 || x === ox + 25 || y === oy + 4 || y === oy + 13;
        if (edge) P.px(x, y, 0x8a9098);
        else if ((x + y) % 3 === 0) P.px(x, y, 0xb8bec6, 0.9);
        else P.px(x, y, 0x2a2e36, 0.12);
      }
      P.hl(ox + 4, oy + 4, 22, 0xd8dce2);
      // handtag (blått med gult grepp)
      P.vl(ox + 26, oy + 1, 5, 0x8a9098); P.hl(ox + 24, oy, 6, 0x1f58a8); P.hl(ox + 24, oy + 1, 6, 0xf2c230);
      // chassi + hjul
      P.hl(ox + 5, oy + 16, 20, 0x6a7078); P.vl(ox + 6, oy + 14, 3, 0x6a7078); P.vl(ox + 23, oy + 14, 3, 0x6a7078);
      P.rect(ox + 5, oy + 18, 3, 3, 0x1c1c22); P.rect(ox + 22, oy + 18, 3, 3, 0x1c1c22);
      P.px(ox + 6, oy + 19, 0x5a5a64); P.px(ox + 23, oy + 19, 0x5a5a64);
    }
  });
}
function bagStandImg() {
  return spriteOf(18, 30, (P) => {
    P.vl(8, 2, 26, 0x6a7078); P.vl(9, 2, 26, 0x9aa0a8); P.rect(4, 27, 10, 2, 0x3a3e46);
    P.hl(3, 3, 12, 0x6a7078);
    // gula kassar (blå handtag) på krokar, en blå
    const bag = (x, y, col, hand) => {
      P.rect(x, y + 3, 7, 10, col); P.box(x, y + 3, 7, 10, mul(col, 0.7));
      P.hl(x + 1, y + 4, 5, mix(col, 0xffffff, 0.3));
      P.vl(x + 1, y, 3, hand); P.vl(x + 5, y, 3, hand); P.hl(x + 2, y, 3, hand);
    };
    bag(1, 4, 0xf6cf2a, 0x1f58a8); bag(10, 4, 0xf6cf2a, 0x1f58a8); bag(1, 15, 0x2c62b8, 0xf2c230); bag(10, 15, 0xf6cf2a, 0x1f58a8);
  });
}
function kassaCounterImg() {
  return spriteOf(48, 24, (P) => {
    // disken: vit front med blå rand och gul linje
    P.rect(0, 8, 48, 16, 0xe8e6e0); P.box(0, 8, 48, 16, 0x6a6a72);
    P.rect(1, 15, 46, 3, 0x1f58a8); P.hl(1, 18, 46, 0xf2c230);
    P.hl(1, 22, 46, 0x9a9aa2);
    // bandet
    P.rect(1, 5, 32, 4, 0x2a2a32); for (let x = 3; x < 32; x += 4) P.vl(x, 5, 4, 0x3e3e48);
    P.hl(1, 5, 32, 0x4a4a54);
    P.rect(33, 5, 14, 4, 0xc8c6c0); P.box(33, 5, 14, 4, 0x8a8a92);
    // kassaapparat + skärm
    P.rect(36, 0, 10, 6, 0x2a2a32); P.rect(37, 1, 8, 3, 0x5fd08a); P.hl(37, 1, 8, 0x9ff0b8);
    P.rect(26, 2, 5, 4, 0x3a3a44); P.rect(27, 3, 3, 1, 0x7fd0ff); // kortläsare
    // varor på bandet
    P.rect(6, 2, 6, 4, 0xc49a62); P.box(6, 2, 6, 4, 0x7a5a30); P.rect(15, 3, 4, 3, 0xf6cf2a); P.rect(21, 1, 3, 5, 0x3a8ad0);
  });
}
function restCounterImg(w) {
  return spriteOf(w, 30, (P) => {
    // rostfri front
    for (let y = 12; y < 30; y++) for (let x = 0; x < w; x++) {
      let c = mix(0xb4bac2, 0x9aa0a8, (y - 12) / 18);
      if (x % 7 === 0) c = mul(c, 0.94);
      P.px(x, y, c);
    }
    P.box(0, 12, w, 18, 0x5a6068);
    // brickrännan
    P.rect(0, 12, w, 2, 0xd8dce2); P.hl(0, 15, w, 0x7a8088);
    // disken med mat (köttbullar, mos, lingon, sås)
    P.rect(1, 7, w - 2, 5, 0x3a3e46);
    for (let x = 3; x < w - 8; x += 12) {
      const kind = (x / 12 | 0) % 4;
      P.rect(x, 8, 10, 3, 0xe8e8ec);
      if (kind === 0) for (let i = 0; i < 4; i++) { P.px(x + 1 + i * 2, 9, 0x7a4a26); P.px(x + 2 + i * 2, 9, 0x5a3418); P.px(x + 1 + i * 2, 8, 0x9a6232); }
      if (kind === 1) { P.rect(x + 1, 8, 8, 2, 0xf0e2b0); P.hl(x + 2, 8, 5, 0xfff4d0); }
      if (kind === 2) for (let i = 0; i < 8; i += 2) P.px(x + 1 + i, 9, 0xc81e3a);
      if (kind === 3) { P.rect(x + 1, 8, 8, 2, 0x8a5a2a); P.hl(x + 2, 8, 4, 0xa87038); }
    }
    // glasskärm
    for (let x = 1; x < w - 1; x++) { P.px(x, 1, 0xd8f0ff, 0.9); for (let y = 2; y < 7; y++) P.px(x, y, 0xbfe4f4, 0.28); }
    P.vl(0, 1, 11, 0x8a9098); P.vl(w - 1, 1, 11, 0x8a9098);
    for (let x = 6; x < w; x += 22) P.line(x, 6, x + 4, 2, 0xffffff, 0.6);
  });
}
// Lekland – bollhavet i entrén
function playpenImg() {
  return spriteOf(48, 34, (P) => {
    // skylt på stolpe
    P.vl(3, 0, 16, 0x6a7078); P.rect(0, 0, 34, 9, 0xf6cf2a); P.box(0, 0, 34, 9, 0x9a7a10);
    text(P, SMALL, 'LEKLAND', 3, 2, 0x1d51a0);
    // bollhavet (lågt staket runt)
    const y0 = 14;
    P.rect(2, y0, 44, 18, 0x1d51a0); P.box(2, y0, 44, 18, 0x0c2a5c);
    P.rect(4, y0 + 2, 40, 10, 0x2a3a6a);
    const cols = [0xd8433b, 0xf2c230, 0x2c9a4c, 0x4aa8e8, 0xf07aa8, 0xffffff];
    for (let i = 0; i < 70; i++) {
      const bx = 4 + ((hash(i, 1, 90) * 39) | 0), by = y0 + 2 + ((hash(i, 2, 90) * 9) | 0);
      const c = cols[(hash(i, 3, 90) * cols.length) | 0];
      P.px(bx, by, c); P.px(bx + 1, by, c); P.px(bx, by + 1, mul(c, 0.8)); P.px(bx + 1, by + 1, mul(c, 0.7));
    }
    P.rect(2, y0 + 12, 44, 6, 0xf6cf2a); P.box(2, y0 + 12, 44, 6, 0x9a7a10);
    for (let x = 6; x < 44; x += 6) P.vl(x, y0 + 13, 4, 0xd8ae18);
    for (const x of [2, 45]) P.vl(x, y0 - 4, 4, 0x0c2a5c);
    P.hl(2, y0 - 4, 44, 0x0c2a5c, 0.6);
  });
}
// korvkiosken efter kassan
function hotdogImg() {
  return spriteOf(44, 34, (P) => {
    // parasoll
    for (let y = 0; y < 8; y++) for (let x = 0; x < 44; x++) {
      const hw = 7 + y * 2.6;
      if (Math.abs(x - 21.5) > hw) continue;
      P.px(x, y, ((x / 5) | 0) % 2 ? 0xf6cf2a : 0x1d51a0);
    }
    P.hl(1, 8, 42, 0x0c2a5c);
    P.vl(21, 8, 8, 0x6a7078);
    // disken med skylt
    P.rect(3, 16, 38, 16, 0xe8e6e0); P.box(3, 16, 38, 16, 0x6a6a72);
    text(P, SMALL, 'KORV 10:-', 6, 19, 0xd8231e);
    P.rect(4, 26, 36, 3, 0x1d51a0); P.hl(4, 29, 36, 0xf2c230);
    P.rect(2, 14, 40, 3, 0xc8ccd2); P.hl(2, 14, 40, 0xe8ecf0);
    // korvar i bröd på disken + senap/ketchup
    for (const kx of [7, 17]) { P.rect(kx, 11, 9, 3, 0xe0b070); P.hl(kx + 1, 11, 7, 0xb8452a); P.px(kx + 4, 11, 0xf2c230); }
    P.rect(30, 9, 3, 5, 0xf2c230); P.rect(34, 9, 3, 5, 0xd8231e);
    P.rect(6, 32, 3, 2, 0x2a2a30); P.rect(35, 32, 3, 2, 0x2a2a30);
  });
}
function tableSetImg(seed) {
  return spriteOf(34, 26, (P) => {
    const wood = 0xb07a48;
    const chair = (x) => {
      P.rect(x, 4, 6, 10, wood); P.box(x, 4, 6, 10, mul(wood, 0.6)); P.hl(x + 1, 5, 4, mix(wood, 0xffffff, 0.25));
      P.rect(x - 1, 14, 8, 3, mul(wood, 1.1)); P.box(x - 1, 14, 8, 3, mul(wood, 0.6));
      P.vl(x, 17, 8, mul(wood, 0.55)); P.vl(x + 5, 17, 8, mul(wood, 0.55));
    };
    chair(1); chair(27);
    // bordet: vit skiva på fot
    for (let y = 0; y < 8; y++) for (let x = 0; x < 20; x++) {
      const t = Math.hypot((x - 9.5) / 10, (y - 3.5) / 4);
      if (t < 1) P.px(x + 7, y + 8, t > 0.82 ? 0xb8b4ac : y < 3 ? 0xffffff : 0xf0ece4);
    }
    P.rect(16, 16, 2, 8, 0x5a5a62); P.rect(12, 24, 10, 2, 0x3a3a42);
    // tallrikar med köttbullar
    const plate = (x, y) => { P.rect(x, y, 5, 2, 0xffffff); P.hl(x, y + 2, 5, 0xc8c8cc); P.px(x + 1, y, 0x7a4a26); P.px(x + 3, y, 0x7a4a26); P.px(x + 2, y + 1, 0xc81e3a); };
    plate(9, 10); if (seed % 2 === 0) plate(19, 11);
  });
}

// ================= bakgrunden (målas en gång per varuhus) =================
function storeFloorPx(x, y) {
  const tx = Math.floor(x / 40), ty = Math.floor(y / 26), lx = x - tx * 40, ly = y - ty * 26;
  let c = mix(0xdcd8cd, 0xd0cabf, hash(tx, ty, 71) * 0.6);
  const n = hash(x, y, 72);
  if (n > 0.965) c = mul(c, 0.94); else if (n < 0.025) c = mix(c, 0xffffff, 0.3);
  if (lx === 0 || ly === 0) c = mul(c, 0.9);
  else if (lx === 1 || ly === 1) c = mix(c, 0xffffff, 0.2);
  return c;
}
function floorPx(kind, lx, ly, x, y) {
  switch (kind) {
    case 'ek': case 'ljus': {
      const [a, b] = kind === 'ek' ? [0xca9d63, 0xad8050] : [0xe2cca4, 0xccb187];
      const row = (ly / 5) | 0, py = ly % 5;
      const off = (hash(row, 3, 31) * 34) | 0;
      const col = ((lx + off) / 34) | 0, px = (lx + off) % 34;
      let c = mix(a, b, hash(col, row, 32) * 0.8);
      if (hash(x >> 1, y, 33) > 0.9) c = mul(c, 0.93);
      if (py === 4) c = mul(c, 0.8); else if (py === 0) c = mix(c, 0xffffff, 0.12);
      if (px === 0) c = mul(c, 0.82);
      return c;
    }
    case 'schack': {
      const tx = (lx / 11) | 0, ty = (ly / 8) | 0, px = lx % 11, py = ly % 8;
      let c = (tx + ty) & 1 ? 0x464a58 : 0xebe7de;
      if (px === 0 || py === 0) c = mix(c, 0x9a968e, 0.55);
      else if (px === 1 || py === 1) c = mix(c, 0xffffff, 0.15);
      if (hash(x, y, 34) > 0.975) c = mix(c, 0xffffff, 0.25);
      return c;
    }
    case 'mosaik': {
      const tx = (lx / 5) | 0, ty = (ly / 4) | 0, px = lx % 5, py = ly % 4;
      let c = mix(0xe8eeee, 0xcad6d8, hash(tx, ty, 35));
      if (hash(tx, ty, 36) > 0.9) c = 0x86b8c0;
      if (px === 0 || py === 0) c = 0xa9b6b8;
      return c;
    }
    case 'filt': {
      let c = mix(0x80858f, 0x70757f, hash(x, y, 37));
      if (((x + y) & 3) === 0) c = mul(c, 0.95);
      return c;
    }
    case 'blamatta': {
      let c = mix(0xa6cbe8, 0x96bedd, hash(x, y, 38));
      const cx = lx % 16, cy = ly % 12;
      if ((cx === 8 && cy === 6) || (cx === 0 && cy === 0)) c = 0xf4f1ea;
      return c;
    }
    case 'sten': {
      const row = (ly / 12) | 0, off = (row & 1) * 9;
      const tx = ((lx + off) / 18) | 0, px = (lx + off) % 18, py = ly % 12;
      let c = mix(0x7a756f, 0x66615c, hash(tx, row, 39));
      if (hash(x, y, 40) > 0.93) c = mix(c, 0xffffff, 0.12);
      if (px === 0 || py === 0) c = 0x4a4642; else if (px === 1 || py === 1) c = mix(c, 0xffffff, 0.12);
      return c;
    }
    case 'terrakotta': {
      const tx = (lx / 10) | 0, ty = (ly / 8) | 0, px = lx % 10, py = ly % 8;
      let c = mix(0xc4764e, 0xac623e, hash(tx, ty, 41));
      if (px === 0 || py === 0) c = 0xe2d4bc; else if (px === 1 || py === 1) c = mix(c, 0xffffff, 0.12);
      return c;
    }
    default: return storeFloorPx(x, y);
  }
}
function paintFloor(P, x0, y0, x1, y1, kind) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) P.px(x, y, floorPx(kind, x - x0, y - y0, x, y));
}
function wallPx(st, lx, ry, fb, x, y) {
  let c = st.wall;
  switch (st.paper) {
    case 'rand': if (lx % 12 < 6) c = mix(c, 0xffffff, 0.07); if (lx % 12 === 0) c = mul(c, 0.95); break;
    case 'prick': if ((lx % 8 === 2 && ry % 8 === 3) || (lx % 8 === 6 && ry % 8 === 7)) c = mix(c, 0xffffff, 0.35); break;
    case 'kakel': {
      const row = (ry / 6) | 0, tx = (lx + (row & 1) * 4) % 8, ty = ry % 6;
      if (tx === 0 || ty === 0) c = mul(c, 0.85);
      else if (tx === 1 || ty === 1) c = mix(c, 0xffffff, 0.32);
      else if (hash(((lx + (row & 1) * 4) / 8) | 0, row, 5) > 0.82) c = mul(c, 0.97);
      break;
    }
    case 'slat': if (lx % 6 === 0) c = mul(c, 0.88); else if (lx % 6 === 1) c = mix(c, 0xffffff, 0.08); break;
    case 'stjarna': {
      const cx = lx % 14, cy = ry % 12, cell = hash((lx / 14) | 0, (ry / 12) | 0, 9);
      if (cell > 0.45 && ((cx === 7 && cy >= 5 && cy <= 7) || (cy === 6 && cx >= 6 && cx <= 8))) c = cell > 0.75 ? 0xffffff : 0xfff3b8;
      break;
    }
    case 'trapanel': { const px = lx % 9; if (px === 0) c = mul(c, 0.78); else if (px === 1) c = mix(c, 0xffffff, 0.12); else c = mix(c, mul(c, 0.9), hash(lx / 9 | 0, ry >> 3, 6)); break; }
    case 'butik': if (ry < 6) c = 0x1f58a8; else if (ry < 8) c = 0xf2c230; else if (ry === 8) c = mul(st.wall, 0.9); break;
    default: break;
  }
  c = mix(mul(c, 0.86), c, Math.min(1, ry / 14) + (bayer(x, y) - 0.5) * 0.1);
  if (st.wains && fb < st.wains && fb >= 3) {
    const by = st.wains - 1 - fb, bx = lx % 22;
    let w = st.trim;
    if (st.paper === 'panel') { if (lx % 5 === 0) w = mul(w, 0.84); else if (lx % 5 === 1) w = mix(w, 0xffffff, 0.12); }
    else if (bx === 2 || by === 2) w = mix(w, 0xffffff, 0.14); else if (bx === 20 || fb === 4) w = mul(w, 0.82);
    if (by === 0) w = mul(w, 0.68); else if (by === 1) w = mix(w, 0xffffff, 0.25);
    c = mix(w, mul(w, 0.92), (bayer(x, y) - 0.5) * 0.3 + 0.2);
  }
  if (fb < 3) c = fb === 2 ? 0xf4f1ea : fb === 1 ? 0xdcd6ca : 0x8e887c;
  return c;
}
function paintWall(P, x0, x1, yTop, yBot, st) {
  for (let y = yTop; y < yBot; y++) for (let x = x0; x < x1; x++) P.px(x, y, wallPx(st, x - x0, y - yTop, yBot - 1 - y, x, y));
}
function wallCap(P, x0, x1, y) {
  P.hl(x0, y - 3, x1 - x0, 0x2a2630); P.hl(x0, y - 2, x1 - x0, 0xe8e4dc); P.hl(x0, y - 1, x1 - x0, 0xc8c2b8);
}

// ---------- skyltar ----------
function roomSign(P, cx, y, num, name) {
  const nw = num ? textW(SMALL, String(num)) + 6 : 0;
  const tw = textW(SMALL, name), w = nw + tw + 10, x = Math.round(cx - w / 2);
  P.rect(x + 1, y + 11, w, 1, 0x000000, 0.25);
  P.rect(x, y, w, 11, 0x1d51a0); P.box(x, y, w, 11, 0x0c2a5c); P.hl(x + 1, y + 1, w - 2, 0x3f76c8);
  if (num) { P.rect(x + 1, y + 1, nw, 9, 0xf6cf2a); P.vl(x + nw + 1, y + 1, 9, 0x0c2a5c); text(P, SMALL, String(num), x + 4, y + 3, 0x0c2a5c); }
  text(P, SMALL, name, x + nw + 5, y + 3, 0xf6d02f);
}
function exitSign(P, cx, y, label) {
  const tw = textW(SMALL, label), w = tw + 16, x = Math.round(cx - w / 2);
  P.ell(cx, y + 5, w * 0.8, 10, 0x9fffc0, 0.12, 4);
  P.rect(x, y, w, 11, 0x169a4a); P.box(x, y, w, 11, 0x0a5a28); P.hl(x + 1, y + 1, w - 2, 0x4fd080);
  text(P, SMALL, label, x + 4, y + 3, 0xffffff);
  // pil
  const ax = x + w - 8;
  P.hl(ax, y + 5, 4, 0xffffff); P.px(ax + 2, y + 4, 0xffffff); P.px(ax + 2, y + 6, 0xffffff); P.px(ax + 1, y + 3, 0xffffff); P.px(ax + 1, y + 7, 0xffffff);
}
function bigSign(P, cx, y, label) {
  const tw = textW(BIG, label, 2), w = tw + 18, h = 26, x = Math.round(cx - w / 2);
  P.rect(x + 2, y + h, w, 2, 0x000000, 0.3);
  P.rect(x, y, w, h, 0xf6cf2a); P.box(x, y, w, h, 0x9a7a10); P.hl(x + 1, y + 1, w - 2, 0xfff08a); P.hl(x + 1, y + h - 2, w - 2, 0xd8ae18);
  text(P, BIG, label, x + 10, y + 9, 0x0c2a5c, 1, 2);
  text(P, BIG, label, x + 9, y + 8, 0x1d51a0, 1, 2);
}

// ---------- väggdekor ----------
function paintWindow(P, x, y, w, h, curtain) {
  P.rect(x - 2, y - 2, w + 4, h + 4, 0xf4f1ea); P.box(x - 2, y - 2, w + 4, h + 4, 0x7a746a);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    let c = mix(0x86c8ea, 0xd2eef8, (yy - y) / h + (bayer(xx, yy) - 0.5) * 0.08);
    if (hash(xx >> 2, yy >> 1, 11) > 0.9 && yy < y + h * 0.6) c = mix(c, 0xffffff, 0.55);
    const hill = y + h * 0.72 + Math.sin(xx * 0.35) * 1.6 + Math.sin(xx * 0.11) * 1.5;
    if (yy > hill) c = mix(0x5f9a5a, 0x4a8048, hash(xx, yy, 3) * 0.8);
    P.px(xx, yy, c);
  }
  P.rect(x, y + Math.round(h * 0.42), w, 1, 0xf4f1ea);
  P.rect(x + (w >> 1), y, 1, h, 0xf4f1ea);
  for (let i = 0; i < 5; i++) P.px(x + 3 + i, y + 2 + i, 0xffffff, 0.5);
  P.rect(x - 3, y + h + 2, w + 6, 2, 0xffffff); P.hl(x - 3, y + h + 4, w + 6, 0x000000, 0.18);
  if (curtain) {
    P.hl(x - 7, y - 5, w + 14, 0x5a4a3a);
    for (const sx of [x - 7, x + w + 2]) for (let yy = y - 4; yy < y + h + 5; yy++) for (let xx = sx; xx < sx + 5; xx++) {
      const f = (xx - sx) % 2 ? 0.86 : 1.04;
      P.px(xx, yy, mul(curtain, f));
    }
  }
}
function paintPicture(P, x, y, w, h, kind, seed = 0) {
  const frame = [0x3a2a1c, 0x1e1e24, 0xc8a24a][seed % 3];
  P.rect(x, y, w, h, frame); P.box(x, y, w, h, mul(frame, 0.6));
  const ix = x + 2, iy = y + 2, iw = w - 4, ih = h - 4;
  P.rect(ix - 1, iy - 1, iw + 2, ih + 2, 0xf4f1ea);
  if (kind === 'land') {
    for (let yy = 0; yy < ih; yy++) for (let xx = 0; xx < iw; xx++) {
      let c = mix(0x9fd4ee, 0xf4e2b0, yy / ih);
      if (yy > ih * 0.55 + Math.sin((xx + seed) * 0.5) * 2) c = mix(0x6aa860, 0x4a8a48, yy / ih);
      P.px(ix + xx, iy + yy, c);
    }
    P.rect(ix + iw - 6, iy + 2, 3, 3, 0xffe070);
  } else if (kind === 'abstrakt') {
    P.rect(ix, iy, iw, ih, 0xf2ede2);
    P.rect(ix + 1, iy + 1, iw >> 1, ih >> 1, 0xd8433b);
    P.rect(ix + (iw >> 1), iy + (ih >> 1) - 1, (iw >> 1) - 1, (ih >> 1), 0x2c5fc0);
    P.rect(ix + 2, iy + ih - 3, iw >> 2, 2, 0xf2c230);
  } else if (kind === 'blomma') {
    P.rect(ix, iy, iw, ih, 0xeae4f0);
    const cx = ix + (iw >> 1);
    P.rect(cx - 2, iy + ih - 5, 5, 5, 0x5a7ab0);
    P.vl(cx, iy + 4, ih - 9, 0x3a8a48);
    for (const [dx, dy, c] of [[-3, 3, 0xe85a8a], [3, 4, 0xf2c230], [0, 1, 0xd8433b], [-2, 6, 0x9a6ad0], [3, 8, 0xe85a8a]]) { P.px(cx + dx, iy + dy, c); P.px(cx + dx + 1, iy + dy, c); P.px(cx + dx, iy + dy + 1, mul(c, 0.8)); }
  }
  P.hl(x + 1, y + h, w, 0x000000, 0.2); P.vl(x + w, y + 1, h, 0x000000, 0.2);
}
function paintPoster(P, x, y, w, h) {
  P.rect(x, y, w, h, 0x243a78); P.box(x, y, w, h, 0xf4f1ea);
  for (let i = 0; i < 9; i++) P.px(x + 2 + ((hash(i, 1, 60) * (w - 4)) | 0), y + 2 + ((hash(i, 2, 60) * (h - 4)) | 0), 0xfff3b8);
  const cx = x + (w >> 1);
  P.rect(cx - 2, y + 5, 5, 9, 0xe8e8ec); P.rect(cx - 1, y + 3, 3, 2, 0xd8433b); P.px(cx, y + 2, 0xd8433b);
  P.px(cx, y + 8, 0x4aa8e8);
  P.rect(cx - 4, y + 11, 2, 4, 0xd8433b); P.rect(cx + 3, y + 11, 2, 4, 0xd8433b);
  P.rect(cx - 1, y + 14, 3, 2, 0xf2a030); P.px(cx, y + 16, 0xf2c230);
  P.hl(x + 1, y + h, w, 0x000000, 0.2);
}
function paintClock(P, x, y, s) {
  const r = s / 2, cx = x + r, cy = y + r;
  for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) {
    const d = Math.hypot(xx + 0.5 - r, yy + 0.5 - r);
    if (d < r) P.px(x + xx, y + yy, d > r - 1.3 ? 0x2a2a32 : 0xfafaf6);
  }
  P.vl(Math.floor(cx), Math.floor(cy) - 3, 3, 0x1a1a20); P.hl(Math.floor(cx), Math.floor(cy), 3, 0x1a1a20);
  P.px(Math.floor(cx), y + 1, 0x1a1a20); P.px(x + 1, Math.floor(cy), 0x1a1a20); P.px(x + s - 2, Math.floor(cy), 0x1a1a20); P.px(Math.floor(cx), y + s - 2, 0x1a1a20);
}
function paintCork(P, x, y, w, h) {
  P.rect(x, y, w, h, 0x8a6440); P.rect(x + 1, y + 1, w - 2, h - 2, 0xc89a62);
  for (let yy = y + 1; yy < y + h - 1; yy++) for (let xx = x + 1; xx < x + w - 1; xx++) if (hash(xx, yy, 61) > 0.8) P.px(xx, yy, 0xb0824e);
  const notes = [[3, 3, 0xfff08a], [12, 5, 0xffffff], [22, 2, 0x9fe0ff], [30, 6, 0xffb8d0], [6, 12, 0xffffff], [18, 13, 0xfff08a]];
  for (const [nx, ny, c] of notes) {
    if (nx + 8 > w - 1 || ny + 7 > h - 1) continue;
    P.rect(x + nx, y + ny, 7, 6, c); P.hl(x + nx + 1, y + ny + 2, 5, 0x9a9aa2); P.hl(x + nx + 1, y + ny + 4, 3, 0x9a9aa2);
    P.px(x + nx + 3, y + ny, 0xd8433b);
  }
  P.hl(x + 1, y + h, w, 0x000000, 0.2);
}
function paintTowels(P, x, y, w) {
  P.hl(x, y, w, 0xc8ccd2); P.px(x, y + 1, 0x8a9098); P.px(x + w - 1, y + 1, 0x8a9098);
  P.rect(x + 1, y + 1, 6, 12, 0xf4f1ea); P.hl(x + 1, y + 10, 6, 0x6fb8c2); P.vl(x + 6, y + 1, 12, 0xd2cec4);
  P.rect(x + 8, y + 1, 6, 10, 0xe8a0b8); P.hl(x + 8, y + 8, 6, 0xffffff); P.vl(x + 13, y + 1, 10, 0xc8809a);
}
function paintDeco(P, d, bx, fy) {
  const [kind, dx, dy, w, h, extra] = d;
  const x = bx + dx, y = fy + dy;
  if (kind === 'fonster') return; // målas i ett eget pass (efter tapeten)
  if (kind === 'tavla') paintPicture(P, x, y, w, h, extra || 'land', (dx + dy) & 3);
  else if (kind === 'affisch') paintPoster(P, x, y, w, h);
  else if (kind === 'klocka') paintClock(P, x, y, w);
  else if (kind === 'anslag') paintCork(P, x, y, w, h);
  else if (kind === 'handdukar') paintTowels(P, x, y, w);
}

// ---------- fasta inredningar (målade på väggen och golvet) ----------
function paintKitchen(P, x, fy, w) {
  // överskåp
  const uy = fy - 42, uh = 14;
  P.rect(x, uy, w, uh, 0xf2f0ea); P.box(x, uy, w, uh, 0x8e8a84);
  for (let dx = 16; dx < w; dx += 16) P.vl(x + dx, uy + 1, uh - 2, 0xb0aca4);
  for (let dx = 0; dx < w; dx += 16) P.rect(x + dx + 7, uy + uh - 4, 3, 1, 0x5a5a62);
  P.hl(x, uy + uh, w, 0x000000, 0.18);
  // fläkt över spisen
  const sx = x + 44;
  P.rect(sx - 1, uy + uh, 22, 4, 0xb8bcc2); P.hl(sx - 1, uy + uh + 3, 22, 0x6e7278); P.hl(sx - 1, uy + uh, 22, 0xd8dce2);
  // bänkskiva
  P.rect(x - 1, fy - 17, w + 2, 3, 0x4a4a54); P.hl(x - 1, fy - 17, w + 2, 0x70707c);
  // underskåp
  P.rect(x, fy - 14, w, 18, 0x6f8ea4);
  for (let dx = 16; dx < w; dx += 16) P.vl(x + dx, fy - 14, 18, 0x4a6478);
  for (let dx = 0; dx < w; dx += 16) if (dx !== 48 - 4 && !(dx >= 44 && dx < 64)) P.hl(x + dx + 6, fy - 11, 4, 0xdce0e4);
  P.hl(x, fy - 14, w, 0x8fb0c4);
  P.rect(x, fy + 4, w, 2, 0x2a2a30);
  P.box(x - 1, fy - 14, w + 2, 20, 0x34475a);
  // diskho + kran
  P.rect(x + 10, fy - 17, 16, 2, 0x9aa0a8); P.hl(x + 11, fy - 16, 14, 0x6e747c);
  P.vl(x + 18, fy - 23, 6, 0xc8ccd2); P.hl(x + 18, fy - 23, 4, 0xc8ccd2); P.px(x + 21, fy - 22, 0xa0a4aa);
  // spis: plattor + ugnslucka
  P.hl(sx + 2, fy - 17, 6, 0x16161a); P.hl(sx + 12, fy - 17, 6, 0x16161a); P.hl(sx + 3, fy - 16, 4, 0x2e2e34); P.hl(sx + 13, fy - 16, 4, 0x2e2e34);
  P.rect(sx + 1, fy - 13, 18, 14, 0x2c2e34); P.box(sx + 1, fy - 13, 18, 14, 0x16161a);
  P.rect(sx + 4, fy - 9, 12, 6, 0x5a3a24); P.hl(sx + 4, fy - 9, 12, 0x8a5a30);
  P.hl(sx + 3, fy - 12, 14, 0xc8ccd2);
  // saker på bänken
  P.rect(x + 30, fy - 19, 9, 2, 0xc89a5a); P.hl(x + 30, fy - 19, 9, 0xe0b878);
  P.rect(x + 68, fy - 21, 3, 4, 0xe8d8b0); P.rect(x + 72, fy - 22, 3, 5, 0xd8433b); P.rect(x + 76, fy - 20, 2, 3, 0x3a8a48);
  P.rect(x + 3, fy - 23, 5, 6, 0x3a8a48); P.rect(x + 3, fy - 21, 5, 4, 0xc49a62); // liten kryddkruka
  P.hl(x, fy + 6, w, 0x000000, 0.18);
}
function paintBathtub(P, x, fy, w) {
  // dusch + draperi
  P.vl(x + w - 6, fy - 46, 30, 0xc8ccd2); P.rect(x + w - 9, fy - 47, 7, 2, 0xb4b8be);
  P.hl(x, fy - 48, w, 0x9aa0a8);
  for (let yy = fy - 47; yy < fy - 15; yy++) for (let xx = x + 1; xx < x + 11; xx++) P.px(xx, yy, (xx - x) % 3 === 0 ? 0x5a9aa2 : (xx - x) % 3 === 1 ? 0xf4f6f6 : 0xd4e8ea);
  // karet
  P.rect(x, fy - 15, w, 6, 0xf6f6f2); P.rect(x + 3, fy - 14, w - 6, 3, 0x9ad4e4); P.hl(x + 3, fy - 14, w - 6, 0xc8ecf4);
  for (let yy = fy - 9; yy < fy + 6; yy++) P.hl(x, yy, w, mix(0xf0f0ec, 0xc8ccd0, (yy - fy + 9) / 15));
  P.box(x, fy - 15, w, 21, 0x8a969a); P.hl(x + 1, fy - 9, w - 2, 0xd8dcde);
  P.rect(x + w - 14, fy - 20, 6, 2, 0xc8ccd2); P.vl(x + w - 12, fy - 18, 3, 0xc8ccd2);
  P.hl(x, fy + 6, w, 0x000000, 0.18);
}
function paintToilet(P, x, fy) {
  P.rect(x + 2, fy - 25, 14, 11, 0xf6f6f2); P.box(x + 2, fy - 25, 14, 11, 0x8a969a); P.rect(x + 7, fy - 24, 4, 2, 0xc8ccd2);
  for (let yy = 0; yy < 6; yy++) for (let xx = 0; xx < 16; xx++) {
    const t = Math.hypot((xx - 7.5) / 8, (yy - 2.5) / 3);
    if (t < 1) P.px(x + 1 + xx, fy - 14 + yy, t > 0.78 ? 0x9aa4a8 : yy < 2 ? 0xffffff : 0xeef0f0);
  }
  P.rect(x + 4, fy - 8, 10, 12, 0xeeeeea); P.box(x + 4, fy - 8, 10, 12, 0x8a969a); P.vl(x + 12, fy - 7, 10, 0xc8ccd0);
  P.hl(x + 3, fy + 4, 12, 0x000000, 0.2);
}
function paintSink(P, x, fy, w) {
  P.rect(x, fy - 12, w, 18, 0xa8784a); P.box(x, fy - 12, w, 18, 0x5a3a20);
  P.vl(x + (w >> 1), fy - 11, 16, 0x6a4628); P.hl(x + 4, fy - 6, 5, 0xe0c090); P.hl(x + w - 9, fy - 6, 5, 0xe0c090);
  P.rect(x - 1, fy - 15, w + 2, 3, 0xf6f6f2); P.rect(x + 5, fy - 15, w - 10, 2, 0xc8dce0);
  P.vl(x + (w >> 1), fy - 20, 5, 0xc8ccd2); P.hl(x + (w >> 1), fy - 20, 3, 0xc8ccd2);
  P.hl(x, fy + 6, w, 0x000000, 0.18);
}
function paintHomeDoor(P, x, fy, w) {
  P.rect(x - 2, fy - 48, w + 4, 48, 0xf4f1ea); P.box(x - 2, fy - 48, w + 4, 48, 0x8a8478);
  for (let yy = fy - 46; yy < fy; yy++) for (let xx = x; xx < x + w; xx++) {
    let c = mix(0x6a4630, 0x7a5436, hash(xx >> 1, yy >> 2, 7) * 0.5 + (bayer(xx, yy) - 0.5) * 0.1);
    const lx = xx - x, ly = yy - (fy - 46);
    if ((lx === 3 || lx === w - 4) && ly > 14 && ly < 42) c = mul(c, 0.72);
    if ((ly === 14 || ly === 42) && lx > 3 && lx < w - 4) c = mul(c, 0.72);
    P.px(xx, yy, c);
  }
  P.rect(x + 6, fy - 43, w - 12, 8, 0xbfe4f4); P.box(x + 6, fy - 43, w - 12, 8, 0x3a2a1c); P.hl(x + 7, fy - 42, 4, 0xffffff);
  P.rect(x + w - 6, fy - 24, 3, 2, 0xd8b24a);
  P.rect(x + (w >> 1) - 4, fy - 32, 9, 5, 0xf4f1ea); text(P, SMALL, '12', x + (w >> 1) - 3, fy - 32, 0x1a1a20);
  // dörrmatta
  P.rect(x - 1, fy + 1, w + 2, 7, 0x5e4c38); P.box(x - 1, fy + 1, w + 2, 7, 0x3a2e22);
  for (let xx = x + 1; xx < x + w; xx += 2) P.px(xx, fy + 4, 0x7a664e);
}
function paintCoatRack(P, x, fy, w) {
  P.rect(x, fy - 47, w, 2, 0x8a5a30); P.hl(x, fy - 45, w, 0x000000, 0.2);
  const coats = [[x + 1, 0xb83a3a], [x + 8, 0x2a3e6a], [x + 15, 0xc8a878]];
  for (const [cx, col] of coats) {
    P.px(cx + 3, fy - 44, 0x3a3a40);
    for (let yy = 0; yy < 22; yy++) { const hw = Math.min(3, 1 + (yy >> 2)); P.hl(cx + 3 - hw, fy - 43 + yy, hw * 2 + 1, yy === 0 ? mul(col, 0.8) : (yy & 3) === 3 ? mul(col, 0.85) : col); }
    P.vl(cx + 3, fy - 40, 18, mul(col, 0.7));
  }
  P.rect(x - 1, fy - 10, w + 2, 3, 0xb07a48); P.hl(x - 1, fy - 10, w + 2, 0xd09a60);
  P.vl(x, fy - 7, 12, 0x6a4628); P.vl(x + w - 1, fy - 7, 12, 0x6a4628);
  P.rect(x + 3, fy + 1, 5, 3, 0x2a2a30); P.rect(x + 10, fy + 1, 5, 3, 0xc8433b); P.rect(x + 16, fy + 1, 4, 3, 0xf4f1ea);
  P.hl(x, fy + 6, w, 0x000000, 0.18);
}
function paintToys(P, x, y) {
  const block = (bx, by, c) => { P.rect(bx, by, 6, 6, c); P.box(bx, by, 6, 6, mul(c, 0.6)); P.hl(bx + 1, by + 1, 4, mix(c, 0xffffff, 0.35)); };
  block(x, y + 8, 0xd8433b); block(x + 7, y + 8, 0x2c5fc0); block(x + 3, y + 2, 0xf2c230);
  // nalle
  const tx = x + 18, ty = y + 2;
  P.rect(tx, ty + 5, 9, 9, 0x9a6232); P.rect(tx + 1, ty, 7, 6, 0xa86e3a);
  P.px(tx, ty, 0x7a4a26); P.px(tx + 8, ty, 0x7a4a26);
  P.px(tx + 2, ty + 2, 0x1a1a20); P.px(tx + 6, ty + 2, 0x1a1a20); P.rect(tx + 3, ty + 3, 3, 2, 0xe0b890); P.px(tx + 4, ty + 3, 0x1a1a20);
  P.rect(tx + 2, ty + 8, 5, 4, 0xc08850);
  // boll
  for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < 7; xx++) {
    const d = Math.hypot(xx - 3, yy - 3);
    if (d < 3.5) P.px(x + 31 + xx, y + 7 + yy, yy === 3 ? 0xffffff : d > 2.6 ? 0xa82a2a : 0xe8433b);
  }
  P.ell(x + 20, y + 15, 20, 3, 0x140c1c, 0.18, 3);
}
function paintFix(P, f, bx, fy) {
  const [kind, dx, w] = f, x = bx + dx;
  if (kind === 'kokbank') paintKitchen(P, x, fy, w);
  else if (kind === 'badkar') paintBathtub(P, x, fy, w);
  else if (kind === 'toalett') paintToilet(P, x, fy);
  else if (kind === 'handfat') paintSink(P, x, fy, w);
  else if (kind === 'ytterdorr') paintHomeDoor(P, x, fy, w);
  else if (kind === 'hangare') paintCoatRack(P, x, fy, w);
  else if (kind === 'leksaker') paintToys(P, x, fy + 60);
}
function fixSolid(f, bx, fy) {
  const [kind, dx, w] = f, x = bx + dx;
  if (kind === 'ytterdorr') return null;
  if (kind === 'leksaker') return [x, fy + 66, x + 40, fy + 77];
  return [x - 1, fy - 4, x + w + 1, fy + 8];
}

// glasdörrar (entrén och utgången) – med utsikt över gatan
function paintGlassDoors(P, x, yTop, w, yBot) {
  P.rect(x - 3, yTop - 3, w + 6, yBot - yTop + 3, 0x3a3f4a); P.hl(x - 3, yTop - 3, w + 6, 0x5a606c);
  for (let y = yTop; y < yBot; y++) for (let xx = x; xx < x + w; xx++) {
    const t = (y - yTop) / (yBot - yTop);
    let c = t < 0.55 ? mix(0x8cc8e8, 0xc8eaf6, t / 0.55) : t < 0.7 ? mix(0x5a9a58, 0x4a8448, hash(xx, y, 3)) : mix(0xb4b0a8, 0x9a968e, hash(xx >> 2, y, 4) * 0.5);
    if (t < 0.55 && hash(xx >> 2, y >> 1, 12) > 0.92) c = mix(c, 0xffffff, 0.5);
    P.px(xx, y, mix(c, 0xe8f6ff, 0.18));
  }
  const mid = x + (w >> 1);
  P.vl(mid - 1, yTop, yBot - yTop, 0x3a3f4a); P.vl(mid, yTop, yBot - yTop, 0x6a707c);
  for (let i = 0; i < 12; i++) { P.px(x + 3 + i, yTop + 16 - i, 0xffffff, 0.45); P.px(mid + 4 + i, yTop + 22 - i, 0xffffff, 0.35); }
  P.rect(mid - 5, yTop + 18, 2, 8, 0xc8ccd2); P.rect(mid + 3, yTop + 18, 2, 8, 0xc8ccd2);
  P.rect(mid - 3, yTop - 2, 6, 2, 0x1a1a20); P.px(mid, yTop - 2, 0xd83a3a);
}
// karta över varuhuset (på skylten i entrén)
function paintMap(P, x, y, w, h, L) {
  P.rect(x, y, w, h, 0xf4f1ea); P.box(x, y, w, h, 0x3a3f4a); P.box(x + 1, y + 1, w - 2, h - 2, 0xc8c2b8);
  text(P, SMALL, 'KARTA', x + 3, y + 3, 0x1d51a0);
  const mx = x + 3, my = y + 10, mw = w - 6, mh = h - 13;
  const sx = mw / L.W, sy = mh / H;
  P.rect(mx, my, mw, mh, 0xdcd8cd);
  for (const r of L.all) {
    const col = r.special === 'rest' ? 0xc4764e : r.special ? 0xf6cf2a : r.st.wall;
    const x0 = Math.round(mx + r.x0 * sx), x1 = Math.max(x0 + 1, Math.round(mx + r.x1 * sx) - 1);
    const y0 = Math.round(my + r.fy * sy), y1 = Math.round(my + (r.fy + FD) * sy);
    P.rect(x0, y0, x1 - x0, y1 - y0, col);
  }
  const yy1 = Math.round(my + AISLE1 * sy), yy2 = Math.round(my + AISLE2 * sy);
  const lx = Math.round(mx + (L.lobby.x0 + 42) * sx), tx = Math.round(mx + L.turnCx * sx), kx = Math.round(mx + (L.kassa.x0 + (L.kassa.IW >> 1)) * sx);
  P.hl(lx, yy1, tx - lx, 0xe0a810); P.vl(tx, yy1, yy2 - yy1, 0xe0a810); P.hl(kx, yy2, tx - kx, 0xe0a810);
  P.px(lx, Math.round(my + (A_FLOOR + 20) * sy), 0xd8231e); P.px(lx + 1, Math.round(my + (A_FLOOR + 20) * sy), 0xd8231e);
}

// ---------- gula gångvägen ----------
function arrowPx(dir, fn) { // 11×9, spetsen åt dir
  for (let c = 0; c <= 10; c++) for (let r = 0; r < 9; r++) {
    const on = c <= 5 ? r >= 3 && r <= 5 : Math.abs(r - 4) <= 10 - c;
    if (!on) continue;
    if (dir === 'E') fn(c - 5, r - 4); else if (dir === 'W') fn(5 - c, r - 4);
    else if (dir === 'S') fn(r - 4, c - 5); else fn(r - 4, 5 - c);
  }
}
function paintPath(P, W, pts) {
  const HW = 8;
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    for (let y = Math.min(ay, by) - HW; y < Math.max(ay, by) + HW; y++) for (let x = Math.min(ax, bx) - HW; x < Math.max(ax, bx) + HW; x++) if (x >= 0 && y >= 0 && x < W && y < H) mask[y * W + x] = 1;
  }
  const m = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!mask[y * W + x]) continue;
    const e1 = !m(x - 1, y) || !m(x + 1, y) || !m(x, y - 1) || !m(x, y + 1);
    const e2 = !e1 && (!m(x - 2, y) || !m(x + 2, y) || !m(x, y - 2) || !m(x, y + 2));
    const base = P.get(x, y);
    P.px(x, y, e1 ? 0xd9a414 : e2 ? mix(base, 0xf6d24a, 0.75) : mix(base, 0xf8d64c, 0.3 + (bayer(x, y) - 0.5) * 0.06));
  }
  // pilar i gångriktningen
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dir = bx > ax ? 'E' : bx < ax ? 'W' : by > ay ? 'S' : 'N';
    const len = Math.abs(bx - ax) + Math.abs(by - ay);
    for (let d = 18; d < len - 14; d += 46) {
      const cx = ax + Math.sign(bx - ax) * d, cy = ay + Math.sign(by - ay) * d;
      arrowPx(dir, (dx, dy) => P.px(cx + dx, cy + dy + 1, 0x9a7a10, 0.35));
      arrowPx(dir, (dx, dy) => P.px(cx + dx, cy + dy, 0xfffbea));
    }
  }
}

// ---------- ljus ----------
function trackLights(P, x0, x1, wy) {
  const n = Math.max(2, Math.round((x1 - x0) / 90));
  for (let i = 0; i < n; i++) {
    const cx = Math.round(x0 + (x1 - x0) * (i + 0.5) / n + (i < n / 2 ? -12 : 12));
    P.rect(cx - 2, wy - 1, 5, 3, 0x2a2a32); P.px(cx, wy + 1, 0xfff4d0);
    for (let dy = 2; dy < 26; dy++) {
      const hw = 1 + dy * 0.45, a = 0.16 * (1 - dy / 26);
      for (let dx = -Math.floor(hw); dx <= hw; dx++) if (bayer(cx + dx, wy + dy) < 0.8) P.px(cx + dx, wy + dy, 0xfff6e0, a);
    }
  }
}
function floorAO(P, x0, x1, fy) {
  for (let y = fy; y < fy + 5; y++) for (let x = x0; x < x1; x++) if (bayer(x, y) < 1 - (y - fy) / 5) P.px(x, y, 0x1a1426, 0.2);
}

function paintStore(L, ex) {
  const W = L.W;
  const P = new Pix(W, H);
  P.rect(0, 0, W, H, 0x17151d);
  // 1) golv: butiksgolv överallt, rummens egna golv ovanpå
  for (let y = A_FLOOR; y < H - 2; y++) for (let x = 0; x < W; x++) P.px(x, y, storeFloorPx(x, y));
  for (const r of L.all) {
    const kind = r.special === 'rest' ? 'terrakotta' : r.special ? null : r.st.floor;
    if (kind && kind !== 'butik') paintFloor(P, r.x0, r.fy, r.x1, r.fy + FD, kind);
  }
  // marknadshallens låga podier under golvraden
  for (const e of ex) if (e.room === L.market && !e.rug && e.base === L.market.fy + ROWY.mid) {
    P.rect(e.x - 4, e.base - 8, e.w + 8, 9, 0xe8dcc0); P.hl(e.x - 4, e.base - 8, e.w + 8, 0xf6eed8);
    P.rect(e.x - 4, e.base + 1, e.w + 8, 2, 0xb4a47e); P.hl(e.x - 4, e.base + 3, e.w + 8, 0x000000, 0.15);
  }

  // 2) väggar
  for (let y = 2; y < A_FLOOR; y++) for (let x = L.lobby.wl; x < L.lobby.wr; x++) { // entréns höga blå vägg
    let c = mix(0x1d51a0, 0x2862b4, (bayer(x, y) - 0.5) * 0.2 + 0.5 + (y < 20 ? -0.3 : 0));
    if ((x - L.lobby.x0) % 30 === 0) c = mul(c, 0.88);
    if (y >= 29 && y < 31) c = 0xf6cf2a;
    if (A_FLOOR - 1 - y < 3) c = A_FLOOR - 1 - y === 2 ? 0xf6cf2a : 0x13396e;
    P.px(x, y, c);
  }
  P.hl(L.lobby.wl, 2, L.lobby.wr - L.lobby.wl, 0x0c2a5c);
  for (const r of L.all) if (r !== L.lobby) paintWall(P, r.wl, r.wr, r.wy, r.fy, r.st);
  wallCap(P, L.lobby.wr, W, A_WALL);
  wallCap(P, 0, L.turnX0, B_WALL);
  P.vl(L.turnX0 - 1, B_WALL - 3, WH + 3, 0x2a2630);

  // 3) fönster, tavlor, fasta möbler, skyltar
  for (const r of L.showrooms) {
    const bx = r.x0 + r.ox;
    for (const d of r.deco) if (d[0] === 'fonster') paintWindow(P, bx + d[1], r.fy + d[2], d[3], d[4], r.st.curtain);
    for (const d of r.deco) paintDeco(P, d, bx, r.fy);
    for (const f of r.fix) paintFix(P, f, bx, r.fy);
    trackLights(P, r.x0, r.x1, r.wy);
    roomSign(P, Math.round(r.x0 + r.IW / 2), r.wy + 2, r.num, r.name);
  }
  // marknadshallen: stor text på väggen
  {
    const m = L.market;
    const t = 'ALLT I FLER FÄRGER';
    if (m.IW > textW(SMALL, t) + 20) text(P, SMALL, t, Math.round(m.x0 + m.IW / 2 - textW(SMALL, t) / 2), m.wy + 18, 0x1d51a0);
  }
  // entrén
  {
    const lb = L.lobby, cx = Math.round(lb.x0 + lb.IW / 2);
    bigSign(P, cx, 3, 'MÖBELJÄTTEN');
    L.door = { x0: lb.x0 + 14, x1: lb.x0 + 62 };
    paintGlassDoors(P, L.door.x0, 35, L.door.x1 - L.door.x0, A_FLOOR);
    exitSign(P, lb.x0 + 86, 36, 'IN / UT');
    paintMap(P, lb.x0 + 110, 36, 52, 30, L);
    // entrématta
    const mx0 = L.door.x0 - 6, mx1 = L.door.x1 + 6;
    for (let y = A_FLOOR; y < A_FLOOR + 16; y++) for (let x = mx0; x < mx1; x++) {
      const b = Math.min(x - mx0, mx1 - 1 - x, y - A_FLOOR, A_FLOOR + 15 - y);
      P.px(x, y, b === 0 ? 0x2a2a30 : b === 1 ? 0xf6cf2a : ((x + y) & 1 ? 0x3a3e48 : 0x444854));
    }
  }
  // restaurangen: meny på väggen
  {
    const r = L.rest, bx = r.x0 + r.ox;
    roomSign(P, Math.round(r.x0 + r.IW / 2), r.wy + 2, 0, 'RESTAURANG');
    const mx = bx + 50, my = r.fy - 43, mw = 96, mh = 24;
    P.rect(mx, my, mw, mh, 0x1c2a22); P.box(mx, my, mw, mh, 0x6a4a2a); P.box(mx + 1, my + 1, mw - 2, mh - 2, 0x2e3e34);
    const t1 = 'KÖTTBULLAR 49:-';
    text(P, BIG, t1, mx + Math.round((mw - textW(BIG, t1)) / 2), my + 5, 0xf6cf2a);
    text(P, SMALL, 'MED MOS OCH LINGON', mx + Math.round((mw - textW(SMALL, 'MED MOS OCH LINGON')) / 2), my + 15, 0xe8e4dc);
    trackLights(P, r.x0, r.x1, r.wy);
  }
  // kassan: skylt, utgång
  {
    const r = L.kassa, bx = r.x0 + r.ox;
    const dx0 = Math.round(r.x0 + r.IW / 2 - 26);
    L.exitDoor = { x0: dx0, x1: dx0 + 52 };
    paintGlassDoors(P, dx0, r.fy - 44, 52, r.fy);
    exitSign(P, dx0 + 26, r.fy - 57, 'UTGÅNG');
    roomSign(P, bx + 28, r.wy + 14, 0, 'KASSA');
    text(P, SMALL, 'TACK FÖR', bx + r.IW - 44, r.wy + 16, 0x1d51a0);
    text(P, SMALL, 'BESÖKET!', bx + r.IW - 44, r.wy + 23, 0x1d51a0);
    for (let y = r.fy; y < r.fy + 14; y++) for (let x = dx0 - 4; x < dx0 + 56; x++) {
      const b = Math.min(x - dx0 + 4, dx0 + 55 - x, y - r.fy, r.fy + 13 - y);
      P.px(x, y, b === 0 ? 0x2a2a30 : b === 1 ? 0xf6cf2a : ((x + y) & 1 ? 0x3a3e48 : 0x444854));
    }
  }

  // 4) gula gången
  const doorCx = Math.round((L.door.x0 + L.door.x1) / 2);
  const kassaCx = Math.round(L.kassa.x0 + L.kassa.IW / 2);
  L.pathPts = [[doorCx, A_FLOOR + 28], [doorCx, AISLE1], [L.turnCx, AISLE1], [L.turnCx, AISLE2], [kassaCx, AISLE2], [kassaCx, B_FLOOR + 26]];
  paintPath(P, W, L.pathPts);

  // 5) ljuset: glans på golvet, skugga under väggarna
  for (let x = 40; x < W - 20; x += 76) { P.ell(x, AISLE1 + 2, 30, 9, 0xfffbe8, 0.14, 4); P.ell(x + 38, AISLE2 + 2, 30, 9, 0xfffbe8, 0.14, 4); }
  for (const r of L.all) {
    P.ell(Math.round(r.x0 + r.IW / 2), r.fy + 44, Math.round(r.IW * 0.42), 30, 0xfff2d6, 0.1, 5);
    floorAO(P, r.x0, r.x1, r.fy);
  }
  P.hl(0, H - 2, W, 0x0e0d12); P.hl(0, H - 1, W, 0x0e0d12);

  const cv = P.flush();
  // mattorna (ur möbelatlasens mattritare, i egen färg)
  const x = cv.getContext('2d');
  for (const e of ex) if (e.rug) {
    const art = ROOM.furnArt?.('matta', e.v, e.c);
    if (art) x.drawImage(art.img, art.sx, art.sy, art.sw, art.sh, e.x, e.y, art.sw, art.sh);
    else { x.fillStyle = '#8a2a32'; x.fillRect(e.x, e.y, 90, 48); }
  }
  return cv;
}

// ---------- väggar som ritas y-sorterat (så de skymmer rätt) ----------
function partitionImg() {
  return spriteOf(PW, WH + FD, (P) => {
    const topLen = FD;
    for (let y = 0; y < WH + FD; y++) for (let x = 0; x < PW; x++) {
      let c;
      if (y < topLen) c = x === 0 ? 0x4a4650 : x === PW - 1 ? 0x6a6670 : x === 1 ? 0xf2eee6 : 0xe2ded6;
      else {
        const fb = WH + FD - 1 - y;
        c = mix(0xdcd6ca, 0xc4beb2, (y - topLen) / WH);
        if (x === 0) c = mix(c, 0xffffff, 0.2); else if (x === PW - 1) c = mul(c, 0.8);
        if (fb < 3) c = fb === 2 ? 0xf4f1ea : 0x8e887c;
      }
      P.px(x, y, c);
    }
    P.hl(0, 0, PW, 0x2a2630);
    P.hl(0, FD, PW, 0x8a8478);
  });
}
function outerWallImg(len) {
  return spriteOf(OW, len, (P) => {
    for (let y = 0; y < len; y++) for (let x = 0; x < OW; x++) P.px(x, y, x === 0 || x === OW - 1 ? 0x3a3640 : x === 1 ? 0xeae6de : 0xd8d4cc);
  });
}

// ================= varuhuset (byggs en gång, cachas) =================
let STORE = null;
function buildStore() {
  const plan = buildPlan();
  const L = layoutStore(plan);
  const ex = buildExhibits(L);
  const bg = paintStore(L, ex);
  const W = L.W;

  // rekvisita + personal
  const props = [];
  const lb = L.lobby, rs = L.rest, ks = L.kassa;
  props.push({ img: cartsImg(), x: lb.x0 + 116, y: A_FLOOR + 50, solid: [lb.x0 + 118, A_FLOOR + 64, lb.x0 + 152, A_FLOOR + 74] });
  props.push({ img: bagStandImg(), x: lb.x0 + 150, y: A_FLOOR + 14, solid: [lb.x0 + 151, A_FLOOR + 38, lb.x0 + 167, A_FLOOR + 44] });
  const rcw = 92;
  props.push({ img: restCounterImg(rcw), x: rs.x0 + rs.ox + 8, y: rs.fy - 12, solid: [rs.x0 + rs.ox + 7, rs.fy - 2, rs.x0 + rs.ox + 8 + rcw + 1, rs.fy + 19], id: 'restaurang' });
  const tables = [[112, 'mid'], [146, 'mid'], [22, 'front'], [64, 'front'], [106, 'front']];
  tables.forEach(([tx, row], i) => {
    const x = rs.x0 + rs.ox + tx, base = rs.fy + ROWY[row];
    props.push({ img: tableSetImg(i), x, y: base - 26, solid: [x + 1, base - 9, x + 33, base + 1] });
  });
  const kc = [ks.x0 + ks.ox + 12, ks.x0 + ks.ox + ks.IW - 60];
  for (const x of kc) props.push({ img: kassaCounterImg(), x, y: ks.fy + ROWY.mid - 24, solid: [x - 1, ks.fy + ROWY.mid - 12, x + 49, ks.fy + ROWY.mid + 1], id: 'kassadisk' });
  { const x = lb.x0 + 54, y = A_FLOOR + 52; props.push({ img: playpenImg(), x, y, solid: [x + 1, y + 20, x + 47, y + 33], id: 'lekland' }); }
  { const x = ks.x0 + ks.ox + ks.IW - 54, y = ks.fy + 52; props.push({ img: hotdogImg(), x, y, solid: [x + 2, y + 24, x + 42, y + 34], id: 'korv' }); }
  for (const p of props) { p.fy = p.y + p.img.height; }

  const staffLook = (o) => ({
    skin: '#e0a97f', hair: '#3b2619', style: 'short', top: 'tee', shirt: '#f2c230', accent: '#1f58a8', bottom: 'pants', pants: '#2d3a5c',
    shoes: '#1c1c1c', hat: null, cap: '#1f58a8', glasses: false, beard: false, phones: false, bag: null, build: 5, blush: false, kid: false, ...o,
  });
  const staff = [
    { x: lb.x0 + 96, y: A_FLOOR + 36, look: staffLook({ skin: '#c68a5c', hair: '#1d1714', style: 'bun', bottom: 'skirt', blush: true, build: 4 }) },
    { x: rs.x0 + rs.ox + 26, y: rs.fy + 3, look: staffLook({ shirt: '#f4f1ea', accent: '#f4f1ea', style: 'buzz', hair: '#a5692f', hat: 'beanie', cap: '#f4f1ea' }) },
    { x: kc[0] + 30, y: ks.fy + ROWY.mid - 9, look: staffLook({ skin: '#f6d7bf', hair: '#d9a95c', style: 'ponytail', blush: true, build: 4 }) },
    { x: kc[1] + 30, y: ks.fy + ROWY.mid - 9, look: staffLook({ skin: '#744a2d', hair: '#1d1714', style: 'afro' }) },
  ];

  // hinder för gången
  const obstacles = [];
  for (const p of L.partitions) {
    const fy = p.band === 'A' ? A_FLOOR : B_FLOOR;
    obstacles.push([p.x, fy - 4, p.x + PW, fy + FD + 1]);
  }
  obstacles.push([0, B_WALL - 4, L.turnX0, B_FLOOR + 2]); // rad B:s bakvägg (ingen vägg i svängen)
  for (const e of ex) if (e.solid) obstacles.push(e.solid);
  for (const r of L.showrooms) for (const f of r.fix) { const s = fixSolid(f, r.x0 + r.ox, r.fy); if (s) obstacles.push(s); }
  for (const p of props) obstacles.push(p.solid);
  for (const s of staff) obstacles.push([s.x - 5, s.y - 4, s.x + 5, s.y + 2]);

  // väggar som ritas i y-ordning
  const walls = [];
  const pimg = partitionImg();
  for (const p of L.partitions) { const fy = p.band === 'A' ? A_FLOOR : B_FLOOR; walls.push({ img: pimg, x: p.x, y: fy - WH, fy: fy + FD }); }
  walls.push({ img: outerWallImg(H - 2), x: 0, y: 0, fy: H + 1 });
  walls.push({ img: outerWallImg(H - A_WALL - 2), x: W - OW, y: A_WALL - 3, fy: H + 1 });

  // klickbart: möbler (främst först), dörrar, restaurangen, mattor sist
  const clicks = [];
  const solidEx = ex.filter((e) => !e.rug).sort((a, b) => b.base - a.base);
  for (const e of solidEx) clicks.push({ id: e.k, kind: e.buy ? 'buy' : 'decor', ex: e, hot: e.hot, go: e.go });
  const dcx = Math.round((L.door.x0 + L.door.x1) / 2);
  clicks.push({ id: 'dorr', kind: 'door', hot: [L.door.x0 - 3, 30, L.door.x1 + 3, A_FLOOR + 10], go: [dcx, A_FLOOR + 8] });
  const ecx = Math.round((L.exitDoor.x0 + L.exitDoor.x1) / 2);
  clicks.push({ id: 'utgang', kind: 'exit', hot: [L.exitDoor.x0 - 3, B_FLOOR - 58, L.exitDoor.x1 + 3, B_FLOOR + 12], go: [ecx, B_FLOOR + 8] });
  const rcp = props.find((p) => p.id === 'restaurang');
  clicks.push({ id: 'restaurang', kind: 'food', food: 'kottbullar', hot: [rcp.x - 2, rs.fy - 46, rcp.x + rcw + 2, rs.fy + 20], go: [rcp.x + 58, rs.fy + 26] });
  const kp = props.find((p) => p.id === 'korv');
  clicks.push({ id: 'korv', kind: 'food', food: 'korv', hot: [kp.x, kp.y, kp.x + 44, kp.fy + 1], go: [kp.x + 22, kp.fy + 6] });
  const lp = props.find((p) => p.id === 'lekland');
  clicks.push({ id: 'lekland', kind: 'play', hot: [lp.x, lp.y, lp.x + 48, lp.fy + 1], go: [lp.x + 24, lp.fy + 5] });
  for (const p of props) if (p.id === 'kassadisk') clicks.push({ id: 'kassa', kind: 'exit', hot: [p.x, p.y, p.x + 48, p.fy + 2], go: [ecx, B_FLOOR + 8] });
  for (const e of ex) if (e.rug) clicks.push({ id: 'matta', kind: 'buy', ex: e, hot: e.hot, go: e.go });

  // rummens golvytor (för rumsnamnet i hörnet)
  const zones = [...L.showrooms, L.rest, L.kassa, L.lobby].map((r) => ({ r, x0: r.x0, x1: r.x1, y0: r.fy - 4, y1: r.fy + FD }));

  const glass = [[L.door.x0, 35, L.door.x1 - L.door.x0, A_FLOOR - 35], [L.exitDoor.x0, B_FLOOR - 44, L.exitDoor.x1 - L.exitDoor.x0, 44]];
  return { L, W, ex, bg, props, staff, walls, obstacles, clicks, zones, glass, spawn: [dcx, A_FLOOR + 24] };
}

// ================= restaurangen och korvkiosken =================
const FOODS = {
  kottbullar: { icon: '🍽️', label: 'KÖTTBULLAR', title: 'Restaurangen', text: 'Köttbullar med potatismos, gräddsås och lingon.', price: 49, fill: 45, min: 15, took: 'tar en kvart', done: 'Mums! Köttbullar med lingon.' },
  korv: { icon: '🌭', label: 'KORV MED BRÖD', title: 'Korvkiosken', text: 'Korv med bröd – med senap eller ketchup?', price: 10, fill: 15, min: 5, took: 'tar fem minuter', done: 'Mums! En korv för vägen.' },
};
function openFood(A, id) {
  const g = A.game, f = FOODS[id];
  if (!f) return;
  const money = GAME.fmt ? GAME.fmt(g.money) : Math.round(g.money) + ' kr';
  openModal(`${f.icon} ${f.title}`, `<p style="font-size:20px;margin-top:0">${f.text}</p>
    <p style="font-size:18px">💰 ${f.price} kr · 🍔 +${f.fill} mätthet · ${f.took}</p>
    <p class="sp">Du har ${money} · Mätthet ${Math.round(g.hunger)}/100</p>`, [
    { label: 'Nej tack', onClick: closeModal },
    { label: `${f.icon} Ät (${f.price} kr)`, cls: 'btn-go', onClick: () => {
      if (g.money < f.price) { toast('Du har inte råd – dags att jobba ett pass!', 'bad'); play('fel'); return; }
      g.money -= f.price;
      g.hunger = Math.min(100, Math.round(g.hunger + f.fill));
      g.passTime?.(f.min);
      g.save?.();
      play('ok');
      toast(`${f.icon} ${f.done} +${f.fill} mätthet`, 'good');
      closeModal();
    } },
  ]);
}

// ================= scenen =================
export function makeShopIkea(A) {
  if (!STORE) STORE = buildStore();
  const S = STORE, W = S.W, g = A.game;
  const walker = createWalker({ W, H, left: OW + 2, right: W - OW - 2, top: A_FLOOR + 3, bottom: H - 5, spawn: S.spawn });
  walker.speed = SPEED;
  walker.setObstacles(S.obstacles);
  walker.snapFree();

  let t = 0, lockedCam = null, hover = null, near = null;
  const cam = { x: 0, y: 0 };
  // kameran visar alltid en hel rad rum: övre raden (med gången) eller nedre
  const camTarget = () => lockedCam || {
    x: clamp(walker.px - VW / 2, 0, W - VW),
    y: walker.py < B_WALL ? 0 : H - VH,
  };
  Object.assign(cam, camTarget());

  const hitAt = (x, y) => S.clicks.find((c) => x >= c.hot[0] && x <= c.hot[2] && y >= c.hot[1] && y <= c.hot[3]) || null;
  const routeIdx = (c) => (c.ex ? S.L.showrooms.indexOf(c.ex.room) * 10000 + (c.ex.rug ? 5000 : 0) + c.ex.x : 1e9);
  function act(c) {
    if (c.kind === 'buy') {
      play('click');
      if (typeof MOB.openBuy === 'function') MOB.openBuy(A, c.ex.k);
      else toast('Köpdialogen laddas – försök igen om en stund.');
    } else if (c.kind === 'decor') {
      toast(`${DECOR[c.ex.k] || 'Den'} är bara utställd – den ingår i bostaden och säljs inte här.`);
    } else if (c.kind === 'door') {
      play('door'); A.go('city');
    } else if (c.kind === 'exit') {
      play('door'); toast('🛍️ Tack för besöket på MÖBELJÄTTEN!', 'good'); A.go('city');
    } else if (c.kind === 'food') openFood(A, c.food);
    else if (c.kind === 'play') { play('chirp'); toast('🎈 Lekland är för barn upp till 1,20 m – du får titta på bollhavet!'); }
  }
  function clickWorld(x, y) {
    const c = hitAt(x, y);
    if (c) { walker.walkTo(c.go[0], c.go[1], () => act(c)); return; }
    walker.walkTo(x, y);
  }
  // den punkt på en möbel som ett klick säkert träffar (prislappen först)
  function spotOf(c) {
    const cand = [];
    if (c.ex?.tag) cand.push([c.ex.tag.x + c.ex.tag.w / 2, c.ex.tag.y + c.ex.tag.h / 2]);
    if (c.ex && !c.ex.rug) cand.push([c.ex.x + c.ex.w / 2, c.ex.top + c.ex.h / 2]);
    cand.push([(c.hot[0] + c.hot[2]) / 2, (c.hot[1] + c.hot[3]) / 2]);
    for (let yy = c.hot[1] + 1; yy < c.hot[3]; yy += 3) for (let xx = c.hot[0] + 1; xx < c.hot[2]; xx += 3) cand.push([xx, yy]);
    return cand.find(([x, y]) => hitAt(x, y) === c) || cand[0];
  }

  // ---------- ritningen ----------
  function drawExhibit(ctx, e, hl) {
    const pulse = Math.floor(t * 3) % 2 ? 0xffffff : 0xffd23f;
    if (!e.rug) {
      ctx.fillStyle = 'rgba(20,12,28,0.22)';
      ctx.fillRect(e.x + 1, e.base - 1, e.w - 2, 2);
      ctx.fillRect(e.x + 3, e.base + 1, Math.max(1, e.w - 6), 1);
      if (hl) { const o = outlineImg(e, pulse); if (o) ctx.drawImage(o, e.x - 1, e.top - 1); }
      const f = frameOf(e.k, e.v);
      const art = f && typeof ROOM.furnArt === 'function' ? ROOM.furnArt(e.k, e.v, e.c) : null;
      if (art) ctx.drawImage(art.img, art.sx, art.sy, art.sw, art.sh, e.x, e.top, art.sw, art.sh);
      else if (f && ROOM.ATLAS?.complete) ctx.drawImage(ROOM.ATLAS, f[0], f[1], f[2], f[3], e.x, e.top, f[2], f[3]);
      else if (!f) ctx.drawImage(boxImg(), e.x, e.top);
    }
    if (e.tag) ctx.drawImage(tagImg(e.k, hl), e.tag.x, e.tag.y);
  }
  function drawWorld(ctx, vx, vy, vw, vh) {
    ctx.drawImage(S.bg, vx, vy, vw, vh, vx, vy, vw, vh);
    // kväll: mörkt ute bakom glasdörrarna (fönstren i rummen är ljuspaneler)
    const hour = (g?.min ?? 720) / 60;
    if (hour >= 20 || hour < 6.5) {
      ctx.fillStyle = 'rgba(10,14,44,0.62)';
      for (const d of S.glass) ctx.fillRect(d[0], d[1], d[2], d[3]);
    }
    const hl = hover || near;
    // markerad matta: ram runt den
    if (hl?.ex?.rug) {
      const e = hl.ex, col = Math.floor(t * 3) % 2 ? '#ffffff' : '#ffd23f';
      ctx.fillStyle = col;
      ctx.fillRect(e.x - 1, e.y - 1, 92, 1); ctx.fillRect(e.x - 1, e.y + 48, 92, 1);
      ctx.fillRect(e.x - 1, e.y, 1, 48); ctx.fillRect(e.x + 90, e.y, 1, 48);
    }
    const inView = (x0, y0, x1, y1) => x1 >= vx - 8 && x0 <= vx + vw + 8 && y1 >= vy - 8 && y0 <= vy + vh + 60;
    const items = [];
    for (const e of S.ex) {
      if (!inView(Math.min(e.x, e.tag ? e.tag.x : e.x), e.top, e.x + Math.max(e.w, 50), e.tag ? e.tag.y + e.tag.h : e.base)) continue;
      const isHl = hl?.ex === e;
      items.push({ fy: e.rug ? e.tag.y - 10 : e.base, draw: () => drawExhibit(ctx, e, isHl) });
    }
    for (const p of S.props) if (inView(p.x, p.y, p.x + p.img.width, p.fy)) items.push({ fy: p.fy, draw: () => ctx.drawImage(p.img, p.x, p.y) });
    for (const s of S.staff) if (inView(s.x - 12, s.y - 40, s.x + 12, s.y)) items.push({ fy: s.y, draw: () => drawPerson(ctx, s.x, s.y, s.look, 'down', Math.sin(t * 2 + s.x) > 0.93 ? 4 : 0) });
    for (const w of S.walls) if (inView(w.x, w.y, w.x + w.img.width, w.fy)) items.push({ fy: w.fy, draw: () => ctx.drawImage(w.img, w.x, w.y) });
    for (const d of folkDrawables(A, t)) items.push({ fy: d.fy, draw: () => d.draw(ctx) });
    const me = selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length });
    items.push({ fy: me.fy + 0.01, draw: () => me.draw(ctx) });
    items.sort((a, b) => a.fy - b.fy);
    for (const it of items) it.draw();
    // pil ovanför möbeln man pekar på
    if (hover?.ex) {
      const e = hover.ex, ax = Math.round(e.rug ? e.tag.x + e.tag.w / 2 : e.x + e.w / 2), ay = Math.round((e.rug ? e.tag.y : e.top) - 8 + Math.sin(t * 6) * 1.5);
      ctx.fillStyle = '#17151a';
      ctx.fillRect(ax - 4, ay - 1, 9, 1); ctx.fillRect(ax - 5, ay, 11, 2); ctx.fillRect(ax - 4, ay + 2, 9, 1); ctx.fillRect(ax - 3, ay + 3, 7, 1); ctx.fillRect(ax - 2, ay + 4, 5, 1); ctx.fillRect(ax - 1, ay + 5, 3, 1);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(ax - 4, ay, 9, 1); ctx.fillRect(ax - 3, ay + 1, 7, 1); ctx.fillRect(ax - 2, ay + 2, 5, 1); ctx.fillRect(ax - 1, ay + 3, 3, 1); ctx.fillRect(ax, ay + 4, 1, 1);
    }
  }
  function zoneAt(x, y) { return S.zones.find((z) => x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1)?.r || null; }
  function drawHud(ctx) {
    ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
    // rummet man står i (inte i entrén – där sitter den stora skylten)
    const r = zoneAt(walker.px, walker.py);
    if (r && !r.special || r?.special === 'rest' || r?.special === 'kassa') {
      const label = r.num ? `${r.num} ${r.name}` : r.name;
      const lw = textW(SMALL, label) + 8;
      ctx.fillStyle = 'rgba(12,30,70,0.82)'; ctx.fillRect(4, 4, lw, 11);
      ctx.fillStyle = '#f6cf2a'; ctx.fillRect(4, 14, lw, 1);
      ctxText(ctx, SMALL, label, 8, 7, '#f6d02f');
    }
    // vad man pekar på / står vid
    const hl = hover || near;
    let msg = null, sub = null;
    if (hl?.ex?.buy) { const kat = katOf(hl.ex.k); msg = `${tagName(hl.ex.k)}  ${kat?.price ?? '?'} KR`; sub = hover ? 'KLICKA FÖR ATT KÖPA' : 'KLICKA PÅ MÖBELN FÖR ATT KÖPA'; }
    else if (hl?.ex) { msg = `${(DECOR[hl.ex.k] || '').toUpperCase()} INGÅR I BOSTADEN`; sub = 'SÄLJS INTE HÄR'; }
    else if (hl?.kind === 'food') { const f = FOODS[hl.food]; msg = `${f.label} ${f.price} KR`; sub = 'KLICKA FÖR ATT ÄTA'; }
    else if (hl?.kind === 'play') { msg = 'LEKLAND'; sub = 'BOLLHAV FÖR BARN'; }
    else if (hl?.kind === 'door') { msg = 'UT TILL STADEN'; sub = 'KLICKA PÅ DÖRREN'; }
    else if (hl?.kind === 'exit') { msg = 'UTGÅNG'; sub = 'KLICKA FÖR ATT GÅ UT'; }
    else if (t < 7) { msg = 'VÄLKOMMEN!'; sub = 'FÖLJ DEN GULA GÅNGEN - KLICKA PÅ EN MÖBEL FÖR ATT KÖPA'; }
    if (msg) {
      const w = textW(SMALL, msg) + textW(SMALL, sub) + 22;
      const x = Math.round(VW / 2 - w / 2), y = VH - 16;
      ctx.fillStyle = 'rgba(12,12,20,0.84)'; ctx.fillRect(x, y, w, 12);
      ctx.fillStyle = '#f6cf2a'; ctx.fillRect(x, y, w, 1);
      ctxText(ctx, SMALL, msg, x + 6, y + 4, '#ffd23f');
      ctxText(ctx, SMALL, sub, x + 16 + textW(SMALL, msg), y + 4, '#f4f1ea');
    }
  }

  return {
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    _debug: {
      spot: (id) => { // första i gångordningen (vardagsrummet före marknadshallen)
        const c = S.clicks.filter((c) => c.id === id).sort((a, b) => routeIdx(a) - routeIdx(b))[0];
        if (!c) return null;
        const [x, y] = spotOf(c);
        return { x: x - cam.x, y: y - cam.y };
      },
      lockCam: (x, y) => { lockedCam = x === null || x === undefined ? null : { x: clamp(x, 0, W - VW), y: clamp(y ?? cam.y, 0, H - VH) }; if (lockedCam) Object.assign(cam, lockedCam); },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); Object.assign(cam, camTarget()); },
      cam: () => ({ ...cam }),
      size: () => ({ W, H }),
      hover: (id) => { hover = id ? S.clicks.find((c) => c.id === id) || null : null; },
      rooms: () => S.L.all.map((r) => ({ name: r.num ? `${r.num} ${r.name}` : r.name, x0: r.x0, x1: r.x1, fy: r.fy, band: r.band, items: S.ex.filter((e) => e.room === r).map((e) => `${e.k}${e.v}${e.c ? e.c : ''}`) })),
      exhibits: () => S.ex.map((e) => ({ k: e.k, v: e.v, buy: e.buy, room: e.room.name, x: e.x, base: e.base })),
      check: () => { // prislappar som krockar med varandra eller med möbler
        const out = [];
        const ov = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
        const tags = S.ex.filter((e) => e.tag).map((e) => ({ e, r: [e.tag.x, e.tag.y, e.tag.x + e.tag.w, e.tag.y + e.tag.h] }));
        for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) if (ov(tags[i].r, tags[j].r)) out.push(`lapp ${tags[i].e.k} ↔ lapp ${tags[j].e.k} (${tags[i].e.room.name})`);
        for (const tg of tags) for (const e of S.ex) {
          if (e === tg.e || e.rug) continue;
          if (e.base <= tg.e.base) continue; // bara det som står framför skymmer
          if (ov(tg.r, [e.x, e.top, e.x + e.w, e.base])) out.push(`lapp ${tg.e.k} skyms av ${e.k} (${e.room.name})`);
        }
        for (const c of S.clicks) if (c.ex) { const [x, y] = spotOf(c); if (hitAt(x, y) !== c) out.push(`${c.id} i ${c.ex.room.name} går inte att klicka på`); }
        const bad = S.clicks.filter((c) => { const p = walker.findPath(S.spawn[0], S.spawn[1], c.go[0], c.go[1]); const last = p[p.length - 1]; return !last || Math.hypot(last[0] - c.go[0], last[1] - c.go[1]) > 6; });
        for (const c of bad) out.push(`${c.id}${c.ex ? ' i ' + c.ex.room.name : ''} går inte att nå`);
        const kinds = new Set(S.ex.filter((e) => e.buy).map((e) => e.k));
        for (const k of KAT()) if (!kinds.has(k.kind)) out.push(`${k.kind} saknas i utställningen`);
        return out;
      },
      panorama: (scale = 1) => {
        const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        x.setTransform(scale, 0, 0, scale, 0, 0);
        drawWorld(x, 0, 0, W, H);
        return c.toDataURL('image/png');
      },
    },

    update(dt) {
      t += dt;
      walker.update(dt);
      // närmaste möbel (när man står vid den)
      near = null;
      let bestD = 20;
      for (const c of S.clicks) {
        if (c.kind === 'door' || c.kind === 'exit') continue; // dörrarna visas bara när man pekar
        const d = Math.hypot(c.go[0] - walker.px, c.go[1] - walker.py);
        if (d < bestD) { bestD = d; near = c; }
      }
      const tg = camTarget(), k = lockedCam ? 1 : Math.min(1, dt * 6);
      cam.x += (tg.x - cam.x) * k; cam.y += (tg.y - cam.y) * k;
    },
    move(sx, sy) { hover = hitAt(sx + cam.x, sy + cam.y); },
    down(sx, sy) { clickWorld(sx + cam.x, sy + cam.y); },
    draw(ctx) {
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, -cy * A.pxs);
      drawWorld(ctx, cx, cy, VW, VH);
      drawHud(ctx);
    },
  };
}
