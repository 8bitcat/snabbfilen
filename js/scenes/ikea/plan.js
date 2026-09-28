// MÖBELJÄTTEN – vad som står var. Allt byggs UR KATALOGEN vid körning:
//  • Plan 2 (utställningen): små inredda rum. Rummen har handplacerade
//    "recept"; varje möbelsort i KATALOG ställs ut i sitt rum (k.room om fältet
//    finns, annars KIND_ROOM, annars marknadshallen). Nya sorter packas in till
//    höger i sitt rum – blir rummet för brett delas det ("VARDAGSRUM 2" …).
//    Väggsaker (k.wall) hängs på väggen.
//  • Plan 1 (marknadshallen): avdelningar (textil, matlagning, belysning,
//    krukor & växter, dekoration) med egna hyllor och korgar + katalogens
//    småsaker och "allt i fler färger".
//  • Lagret: kartonger med de större möblerna.
import { KAT, katOf, dims, varOf, tagDims, isWallKind, isFlat } from './kat.js';
import { ROWY, MIN_IW, MAX_IW } from './geo.js';

// ---------- rumstyperna: tapet, golv, namn ----------
export const TYPES = {
  vardagsrum: { name: 'VARDAGSRUM', wall: 0x8ea896, trim: 0x6d8876, paper: 'rand', wains: 14, floor: 'ek', curtain: 0xd8c8a0 },
  kok: { name: 'KÖK', wall: 0xeeebe3, trim: 0x8aa4b4, paper: 'kakel', wains: 0, floor: 'schack' },
  kontor: { name: 'KONTOR', wall: 0x9aaec2, trim: 0x71859a, paper: 'slat', wains: 12, floor: 'filt' },
  sovrum: { name: 'SOVRUM', wall: 0xc6a5b4, trim: 0x9a7c8b, paper: 'prick', wains: 14, floor: 'ljus', curtain: 0xe890b0 },
  barnrum: { name: 'BARNRUM', wall: 0xf2da8e, trim: 0x86b8dc, paper: 'stjarna', wains: 12, floor: 'blamatta', curtain: 0x7fc0e8 },
  badrum: { name: 'BADRUM', wall: 0xb5ddd8, trim: 0x86b6b2, paper: 'kakel', wains: 0, floor: 'mosaik' },
  hall: { name: 'HALL', wall: 0xd6bd92, trim: 0x8d6f4a, paper: 'panel', wains: 24, floor: 'sten' },
  ovrigt: { name: 'MARKNADSHALLEN', wall: 0xe2e0da, trim: 0x1f58a8, paper: 'butik', wains: 0, floor: 'vinyl' },
};
const EXTRA_STYLES = [
  { wall: 0xa9b8a0, trim: 0x7a8a70, paper: 'rand', wains: 14, floor: 'ljus' },
  { wall: 0xc8b0a0, trim: 0x957a68, paper: 'prick', wains: 14, floor: 'ek' },
  { wall: 0xa0b0c8, trim: 0x70809a, paper: 'slat', wains: 12, floor: 'filt' },
];
export const SHOW_ORDER = ['vardagsrum', 'kok', 'kontor', 'sovrum', 'barnrum', 'badrum', 'hall'];

// Marknadshallens avdelningar (plan 1)
export const DEPTS = {
  textil: { name: 'TEXTILIER', fixW: 150, wall: 0xe6dfe8, trim: 0x1f58a8, paper: 'butik', wains: 0, floor: 'vinyl',
    props: [['bin', 'kuddar', '49:-', 8, 'mid'], ['bin', 'hajar', '149:-', 52, 'front'], ['table', 'textil', '99:-', 96, 'mid'], ['bin', 'handdukar', '39:-', 104, 'front']] },
  kok: { name: 'MATLAGNING', fixW: 168, wall: 0xe8eee8, trim: 0x1f58a8, paper: 'butik', wains: 0, floor: 'vinyl',
    props: [['table', 'kok', '29:-', 10, 'mid'], ['bin', 'ovrigt', '19:-', 66, 'front'], ['table', 'kok', '9:90', 112, 'mid'], ['bin', 'ljus', '9:90', 118, 'front']] },
  ljus: { name: 'BELYSNING', fixW: 140, wall: 0xdcdcd4, trim: 0x1f58a8, paper: 'butik', wains: 0, floor: 'vinyl',
    props: [['table', 'ljus', '79:-', 8, 'mid'], ['bin', 'ljus', '5:-', 62, 'front'], ['table', 'ljus', '149:-', 96, 'front'], ['bin', 'ljus', '19:-', 10, 'front']] },
  vaxt: { name: 'KRUKOR OCH VÄXTER', fixW: 164, wall: 0xe2ecdc, trim: 0x2c7a3c, paper: 'butik', wains: 0, floor: 'vinyl',
    props: [['stand', 0, '', 6, 'mid'], ['bin', 'blommor', '29:-', 58, 'front'], ['stand', 1, '', 104, 'mid'], ['bin', 'blommor', '19:-', 112, 'front']] },
  dekor: { name: 'DEKORATION', fixW: 178, wall: 0xece4d8, trim: 0x1f58a8, paper: 'butik', wains: 0, floor: 'vinyl',
    props: [['bin', 'ljus', '9:-', 8, 'front'], ['table', 'dekor', '39:-', 52, 'mid'], ['bin', 'kuddar', '49:-', 110, 'front'], ['table', 'dekor', '59:-', 122, 'mid']] },
};
export const DEPT_ORDER = ['textil', 'kok', 'ljus', 'vaxt', 'dekor'];
// vilken avdelning en sort hör till i marknadshallen
export function deptOf(kind) {
  const kat = katOf(kind);
  const s = `${kind} ${kat?.name || ''}`.toLowerCase();
  if (kind === 'matta' || /matta|kudde|pläd|plad|gardin|handduk|textil|filt|överkast|lakan/.test(s)) return 'textil';
  if (/lamp|ljus|belys|stake|glob/.test(s)) return 'ljus';
  if (/växt|vaxt|kruka|blom|kaktus|palm|ficus/.test(s)) return 'vaxt';
  if (/kastrull|panna|tallrik|glas|mugg|kök|kok|bestick|skål|skal|kanna/.test(s)) return 'kok';
  return 'dekor';
}

// Var en möbelsort hör hemma när katalogposten saknar k.room.
const KIND_ROOM = {
  soffa: 'vardagsrum', fatolj: 'vardagsrum', bordR: 'vardagsrum', spis: 'vardagsrum', tv: 'vardagsrum',
  lampa: 'vardagsrum', vaxtS: 'vardagsrum', matta: 'vardagsrum', bokhylla: 'vardagsrum',
  bordM: 'kok', stol: 'kok', byra: 'sovrum', spegel: 'hall',
};
const ROOM_ALIAS = { marknadshall: 'ovrigt', marknadshallen: 'ovrigt', ovrigt: 'ovrigt', annat: 'ovrigt', vardagsrummet: 'vardagsrum', koket: 'kok', sovrummet: 'sovrum', badrummet: 'badrum', hallen: 'hall', kontoret: 'kontor', barnrummet: 'barnrum', sovrumochvardagsrum: 'sovrum' };
const normRoom = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
function roomTypeOf(raw, fallback) {
  if (!raw) return fallback;
  const n = normRoom(raw);
  if (!n) return fallback;
  if (n.startsWith('dekor') || n.includes('allarum') || n.startsWith('ovrig')) return 'ovrigt';
  if (ROOM_ALIAS[n]) return ROOM_ALIAS[n];
  for (const t of Object.keys(TYPES)) if (n.startsWith(t)) return t;
  return n;
}

// Inredning som står med men inte säljs här (ingår i bostaden).
export const DECOR = { sang: 'Sängen', garderob: 'Garderoben', kylskap: 'Kylskåpet' };

// ---------- recepten: handplacerade rum ----------
// it: [sort, variant, x, rad | fotlinje, { c: egen färg }]  (x från rummets innerkant)
//     sort kan vara en lista av alternativ – den första som finns i katalogen används
//     (barnrummets säng: enkelsängen om den finns, annars dubbelsängen)
// rugs: { v, x, y (överkant), tag: [mitt-x, y], c }   fix: [namn, x, bredd]
// deco: [sort, x, y, b, h, extra] – på väggen (y negativt = uppåt från golvkanten)
export const RECIPES = {
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
    items: [[['enkelsang', 'sang'], 4, 8, 32], ['bokhylla', 2, 56, 'wall'], ['lampa', 1, 100, 'wall'],
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
};
// marknadshallens "allt i fler färger": fler varianter av sortimentet
const COLOR_WALL = [['lampa', 0], ['lampa', 1], ['spegel', 0, 'wall'], ['spegel', 1, 'wall'], ['spegel', 2, 'wall'], ['vaxtS', 0],
  ['stol', 0], ['stol', 1], ['stol', 2], ['stol', 3], ['bordR', 2], ['bordR', 3], ['fatolj', 0], ['fatolj', 1]];

// ================= rummen =================
function newRoom(type, rc, st) {
  st = st || TYPES[type];
  const keep = (k) => !!katOf(k) || !!DECOR[k];
  const pick = (k) => (Array.isArray(k) ? k.find(keep) || null : keep(k) ? k : null);
  return {
    type, st, name: st.name, IW: rc?.IW || 0,
    items: (rc?.items || []).map(([k, v, x, row, o]) => [pick(k), v, x, row, o]).filter(([k]) => k).map(([k, v, x, row, o]) => ({ k, v: varOf(k, v), x, row, c: o?.c || null })),
    rugs: katOf('matta') ? (rc?.rugs || []).map((r) => ({ k: 'matta', w: 90, h: 48, ...r, v: varOf('matta', r.v) })) : [],
    fix: (rc?.fix || []).slice(), deco: (rc?.deco || []).slice(),
  };
}
const shows = (room, k) => room.items.some((it) => it.k === k) || room.rugs.some((r) => r.k === k);

// Packa in en möbel till höger i rummet: höga vid väggen, mellanstora mitt på
// golvet, små längst fram, mattor på golvet och väggsaker på väggen.
function slotW(k, v) { return Math.max(dims(k, v).w, tagDims(k).w) + (isFlat(k) ? 6 : 6); }
const zoneOf = (e) => {
  const d = dims(e.k, e.v);
  if (isFlat(e.k)) return 'rug';
  if (isWallKind(e.k)) return 'hang';
  if (e.zone) return e.zone;
  if (d.h > 26) return 'wall';
  if (d.h <= 15 && d.w <= 30) return 'front';
  return 'mid';
};
function cursors(room) {
  room._wx ??= room.IW ? room.IW + 2 : 8;
  room._mx ??= room._wx;
  room._fx ??= room._wx;
}
function packOne(room, e) {
  cursors(room);
  const d = dims(e.k, e.v), sw = slotW(e.k, e.v), z = zoneOf(e);
  if (z === 'rug') {
    // mattan tar plats i både mitt- och främre raden så att ingen småmöbel hamnar på den eller dess lapp
    const rw = d.w, rh = Math.min(d.h, 48), slot = Math.max(sw, rw + 6), x0 = Math.max(room._mx, room._fx), x = Math.round(x0 + (slot - rw) / 2);
    const y = Math.max(20, 58 - rh); // mattan ligger mitt på golvet
    // lappen: på stora mattor nere i kanten, på små (dörrmattor …) strax nedanför så mattan syns
    const ty = rh >= 30 ? y + rh - 12 : y + rh + 2;
    room.rugs.push({ k: e.k, v: e.v, x, y, w: rw, h: rh, tag: [x + (rw >> 1), ty], c: e.c || null });
    room._mx = room._fx = x0 + slot;
  } else if (z === 'hang') {
    room.items.push({ k: e.k, v: e.v, x: Math.round(room._wx + (sw - d.w) / 2), row: 'hang', c: e.c || null });
    room._wx += sw;
  } else if (z === 'wall') {
    room.items.push({ k: e.k, v: e.v, x: Math.round(room._wx + (sw - d.w) / 2), row: 'wall', c: e.c || null });
    room._wx += sw;
  } else if (z === 'front') {
    room.items.push({ k: e.k, v: e.v, x: Math.round(room._fx + (sw - d.w) / 2), row: 'front', c: e.c || null });
    room._fx += sw;
  } else {
    room.items.push({ k: e.k, v: e.v, x: Math.round(room._mx + (sw - d.w) / 2), row: 'mid', c: e.c || null });
    room._mx += sw;
  }
  room.IW = Math.max(room.IW, room._wx + 4, room._mx + 4, room._fx + 4, MIN_IW);
}
// var nästa möbel i raden hamnar (mattor: efter både mitt- och främre raden)
function cursorOf(room, z) {
  cursors(room);
  return z === 'hang' || z === 'wall' ? room._wx : z === 'front' ? room._fx : z === 'rug' ? Math.max(room._mx, room._fx) : room._mx;
}
function wouldFit(room, e, max = MAX_IW) {
  return cursorOf(room, zoneOf(e)) + slotW(e.k, e.v) + 4 <= max;
}
// fotlinjen (från golvkanten) för en rad; väggsaker hänger på väggen
export const rowY = (row, h = 16) => (row === 'hang' ? -Math.max(6, Math.min(14, 44 - h)) : typeof row === 'number' ? row : ROWY[row]);

// Rum utan recept får fönster/tavlor där väggen är fri (ovanför låga möbler).
function autoDeco(room) {
  const busy = room.items.filter((it) => it.row === 'hang' || rowY(it.row) <= ROWY.wall + 30)
    .map((it) => { const d = dims(it.k, it.v); return [it.x - 3, it.x + d.w + 3, it.row === 'hang' ? 99 : d.h]; });
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

// ================= planen =================
// Packa en grupps möbler: först i första rummet (receptet), sedan i nya rum
// ("KÖK 2" …) när det blir för trångt.
function packGroup(makeFirst, makeExtra, list, max) {
  const arr = [makeFirst()];
  for (const e of list) {
    let room = arr[arr.length - 1];
    if (!wouldFit(room, e, max) && (room.items.length || room.rugs.length)) { room = makeExtra(arr.length + 1); arr.push(room); }
    packOne(room, e);
  }
  return arr;
}
// …och jämna ut: möblerna delas ut över så få rum som möjligt så att varje rum
// och varje rad (vägg, mitt, fram) blir ungefär lika full – inga halvtomma rum.
function dealInto(makeFirst, makeExtra, list, max, m, grow) {
  const arr = [makeFirst()];
  while (arr.length < m) arr.push(makeExtra(arr.length + 1));
  for (const e of list) {
    const z = zoneOf(e);
    let best = null;
    for (const room of arr) if (wouldFit(room, e, max) && (!best || cursorOf(room, z) < cursorOf(best, z))) best = room;
    if (!best) { if (!grow) return null; best = makeExtra(arr.length + 1); arr.push(best); }
    packOne(best, e);
  }
  return arr;
}
function packBalanced(makeFirst, makeExtra, list, max) {
  if (!list.length) return [makeFirst()];
  const nMax = packGroup(makeFirst, makeExtra, list, max).length;
  for (let m = 1; m <= nMax; m++) { const arr = dealInto(makeFirst, makeExtra, list, max, m, false); if (arr) return arr; }
  return dealInto(makeFirst, makeExtra, list, max, nMax, true);
}

// → { rooms (plan 2, i gångordning), depts (plan 1), lager: [sort …] }
export function buildPlan() {
  const order = SHOW_ORDER.slice();
  let custom = 0;
  // varje möbelsort till sitt rum (k.room → tabellen → marknadshallen)
  const extras = new Map(order.map((t) => [t, []])); // rumstyp → [{k, v}]
  const market = []; // {k, v, zone}
  const inRecipe = (type, k) => (RECIPES[type]?.items || []).some((it) => (Array.isArray(it[0]) ? it[0].includes(k) : it[0] === k)) || (k === 'matta' && (RECIPES[type]?.rugs || []).length > 0);
  for (const kat of KAT()) {
    const raw = Array.isArray(kat.room) ? kat.room[0] : kat.room;
    const type = roomTypeOf(raw, KIND_ROOM[kat.kind] || 'ovrigt');
    if (type === 'ovrigt') { market.push({ k: kat.kind, v: 0 }); continue; }
    if (!TYPES[type]) { // ett helt nytt rum, t.ex. "Trädgård"
      TYPES[type] = { ...EXTRA_STYLES[custom++ % EXTRA_STYLES.length], name: String(raw).toUpperCase().slice(0, 16) };
    }
    if (!extras.has(type)) { extras.set(type, []); order.push(type); }
    if (inRecipe(type, kat.kind)) continue;
    extras.get(type).push({ k: kat.kind, v: 0 });
  }
  const rooms = [];
  for (const type of order) {
    const name = TYPES[type].name;
    rooms.push(...packBalanced(() => newRoom(type, RECIPES[type] || null), (i) => Object.assign(newRoom(type, null), { name: `${name} ${i}` }), extras.get(type), MAX_IW));
  }
  for (const r of rooms) { r.IW = Math.max(r.IW, MIN_IW); if (!r.deco.length) r.deco = autoDeco(r); }
  rooms.forEach((r, i) => { r.num = i + 1; });

  // marknadshallen: avdelningar med egna hyllor + katalogens småsaker + fler färger
  for (const [k, v, zone] of COLOR_WALL) if (katOf(k)) market.push({ k, v: varOf(k, v), zone, extra: true });
  const byDept = Object.fromEntries(DEPT_ORDER.map((id) => [id, []]));
  for (const e of market) byDept[deptOf(e.k)].push(e);
  const deptRooms = [];
  for (const id of DEPT_ORDER) {
    const D = DEPTS[id];
    const first = () => Object.assign(newRoom('m_' + id, null, D), { dept: id, IW: D.fixW, props: D.props });
    const extra = (i) => Object.assign(newRoom('m_' + id, null, D), { dept: id, IW: 0, props: [], name: `${D.name} ${i}` });
    deptRooms.push(...packBalanced(first, extra, byDept[id], MAX_IW + 60));
  }
  for (const r of deptRooms) r.IW = Math.max(r.IW, MIN_IW);

  // lagret: de större möblerna i kartong
  const lager = KAT().filter((k) => !isFlat(k.kind) && !k.wall && (k.price ?? 0) >= 400).sort((a, b) => b.price - a.price).map((k) => k.kind);
  return { rooms, depts: deptRooms, lager };
}
