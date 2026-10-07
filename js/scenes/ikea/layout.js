// MÖBELJÄTTEN – planlösningen för båda planen (bara geometri och data – inget målas här).
//
//  PLAN 1 (entréplanet)
//   rad A →  ENTRÉHALLEN (glasdörrar, info, Småland, kundvagnar, hiss, rulltrappa
//            UPP och rulltrappa NER från plan 2) · MARKNADSHALLENS avdelningar …
//   rad B ←  … LAGRET (pallställ) · KASSORNA · UTGÅNGEN (korvkiosk)
//  PLAN 2 (utställningen)
//   rad A →  ANKOMSTHALLEN (rulltrappan upp, hissen – öppen ner till rad B) · rummen …
//   rad B ←  … rummen · RESTAURANGEN · (hallen igen) rulltrappan NER till plan 1
//
// Blocken (rum, avdelningar, specialytor) läggs i två rader med mellanväggar;
// den öppna svängen längst i öster binder ihop gångarna. Raderna balanseras
// så att varuhuset blir så smalt som möjligt, och den kortare raden sträcks.
import {
  VW, H, WH, FD, PW, OW, A_WALL, A_FLOOR, A_AISLE, B_WALL, B_FLOOR, AISLE1, AISLE2, ROWY, TURN_W, MAX_IW,
  CORE1_W, CORE2_W, REST_W, KASSA_W, EXIT_W, LAGER_MIN, ESC_RUN,
} from './geo.js';
import { buildPlan, DEPTS, DECOR, rowY } from './plan.js';
import { katOf, dims, tagDims, isFlat } from './kat.js';
import { escOff } from './art-transit.js';
import { $t } from '../../core/i18n.js';

export const SPECIAL = {
  core1: { name: $t('ENTRÉHALLEN'), wall: 0x1d51a0, trim: 0x0c2a5c, paper: 'butik', wains: 0, floor: 'entre' },
  core2: { name: $t('RULLTRAPPSHALLEN'), wall: 0xe9e5dc, trim: 0x1f58a8, paper: 'butik', wains: 0, floor: 'sten2' },
  rest: { name: $t('RESTAURANG'), wall: 0x9a6a46, trim: 0x5e3c26, paper: 'trapanel', wains: 18, floor: 'parkett' },
  kassa: { name: $t('KASSOR'), wall: 0xe4e2dc, trim: 0x1f58a8, paper: 'butik', wains: 0, floor: 'butik' },
  exit: { name: $t('UTGÅNG'), wall: 0xe4e2dc, trim: 0x1f58a8, paper: 'butik', wains: 0, floor: 'butik' },
  lager: { name: $t('SJÄLVBETJÄNINGSLAGER'), wall: 0xb4b8be, trim: 0x1f58a8, paper: 'plat', wains: 0, floor: 'betong' },
};
const block = (kind, IW, extra = {}) => ({ kind, name: SPECIAL[kind]?.name || kind, IW, st: SPECIAL[kind], ox: 0, items: [], rugs: [], fix: [], deco: [], ...extra });

// ================= raderna =================
function stretch(list, extra) {
  if (extra <= 0 || !list.length) return;
  let st = list.filter((r) => r.stretch);
  if (!st.length) st = [list[list.length - 1]];
  const each = Math.floor(extra / st.length);
  st.forEach((r, i) => { const add = each + (i === 0 ? extra - each * st.length : 0); r.ox += Math.floor(add / 2); r.IW += add; });
}
const seg = (list) => list.reduce((a, r) => a + r.IW, 0) + Math.max(0, list.length - 1) * PW;
function widths(rowA, rowB, open) {
  const wa = OW + seg(rowA) + OW;
  const wb = OW + (open ? open.IW + PW : 0) + seg(rowB) + PW + TURN_W + OW;
  return { wa, wb, W: Math.max(wa, wb, VW) };
}
// välj hur många av de flyttbara blocken som hamnar i rad A (smalast varuhus)
function split(fixedA, fixedB, movable, open, minK = 1) {
  let best = null;
  for (let k = Math.min(minK, movable.length); k <= movable.length; k++) {
    const rowA = [...fixedA, ...movable.slice(0, k)];
    const rowB = [...fixedB, ...movable.slice(k).reverse()];
    const w = widths(rowA, rowB, open);
    if (!best || w.W <= best.W) best = { k, rowA, rowB, ...w };
  }
  return best;
}
function place(F, rowA, rowB, open) {
  const { wa, wb, W } = widths(rowA, rowB, open);
  for (const r of [...rowA, ...rowB]) r.ox ??= 0;
  stretch(rowA, W - wa);
  stretch(rowB, W - wb);
  const partitions = [];
  const put = (r, band, x, first) => {
    r.band = band; r.fy = band === 'A' ? A_FLOOR : B_FLOOR; r.wy = band === 'A' ? A_WALL : B_WALL;
    r.wl = first ? x - OW : x - PW; r.x0 = x; r.x1 = x + r.IW; r.wr = r.x1 + PW;
  };
  let x = OW;
  rowA.forEach((r, i) => { if (i) { partitions.push({ x, band: 'A' }); x += PW; } put(r, 'A', x, i === 0); x += r.IW; });
  x = OW;
  if (open) { x = open.x1; partitions.push({ x, band: 'B' }); x += PW; }
  rowB.forEach((r, i) => { if (i) { partitions.push({ x, band: 'B' }); x += PW; } put(r, 'B', x, i === 0 && !open); x += r.IW; });
  partitions.push({ x, band: 'B' });
  const turnX0 = x + PW;
  Object.assign(F, { W, rowA, rowB, partitions, turnX0, turnCx: Math.round((turnX0 + W - OW) / 2), open: open || null });
  F.blocks = [...rowA, ...rowB];
}

// ================= utställda möbler (absoluta koordinater) =================
function exhibitsOf(F) {
  const ex = [];
  for (const r of F.blocks) {
    for (const it of r.items) {
      const kat = katOf(it.k);
      const d = dims(it.k, it.v);
      const x = r.x0 + r.ox + it.x;
      const base = r.fy + rowY(it.row, d.h);
      const top = base - d.h;
      const hang = it.row === 'hang';
      const solidH = it.k === 'sang' ? d.h - 8 : d.h > 26 ? 12 : 9;
      const tag = kat ? (() => { const td = tagDims(it.k); return { x: Math.round(x + d.w / 2 - td.w / 2), y: base + 2, w: td.w, h: td.h }; })() : null;
      const x0 = Math.min(x, tag ? tag.x : x) - 1, x1 = Math.max(x + d.w, tag ? tag.x + tag.w : 0) + 1;
      ex.push({
        k: it.k, v: it.v, c: it.c, buy: !!kat, room: r, floor: F.n, x, base, top, w: d.w, h: d.h, tag, hang,
        solid: hang ? null : [x - 1, base - solidH, x + d.w + 1, base + 1],
        hot: [x0, top - 2, x1, tag ? tag.y + tag.h : base + 3],
        go: [Math.round(x + d.w / 2), hang ? r.fy + 10 : base + 7],
        seat: /soffa|fatolj|stol|pall|bank|kudde/.test(it.k) && !hang && !/^bak|^sido/.test(it.k) ? [Math.round(x + d.w / 2), base - 5] : null,
      });
    }
    for (const rg of r.rugs) {
      const x = r.x0 + r.ox + rg.x, y = r.fy + rg.y, w = rg.w || 90, h = rg.h || 48;
      const td = tagDims(rg.k);
      const tcx = r.x0 + r.ox + rg.tag[0], ty = r.fy + rg.tag[1];
      const tag = { x: Math.round(tcx - td.w / 2), y: ty, w: td.w, h: td.h };
      ex.push({
        k: rg.k, v: rg.v, c: rg.c || null, buy: !!katOf(rg.k), rug: true, room: r, floor: F.n, x, y, w, h, base: ty + 1, top: y, tag,
        solid: null, hot: [x, y, x + w, Math.max(y + h, tag.y + tag.h)], go: [Math.round(tcx), ty + 8],
      });
    }
  }
  return ex;
}

// ================= rulltrappor och hiss =================
// sy -1: rulltrappan stiger mot taket (plan 1), +1: sjunker ner i golvöppningen (plan 2).
// up: åkarna rör sig uppåt (plan 1: d 0→run, plan 2: d run→0).
function escalator(o) {
  const e = { run: ESC_RUN, ...o };
  e.far = [e.lx + e.sx * e.run, e.ly + e.sy * escOff(e.run)];
  e.board = [e.lx - e.sx * 12, e.ly];          // där man kliver på/av
  e.hot = e.sy < 0
    ? [Math.min(e.lx - e.sx * 18, e.lx + e.sx * 90), e.ly - 60, Math.max(e.lx - e.sx * 18, e.lx + e.sx * 90), e.ly + 12]
    : [Math.min(e.lx - e.sx * 18, e.pit[0]), e.pit[2] - 20, Math.max(e.lx - e.sx * 18, e.pit[1]), e.pit[3] + 6];
  return e;
}

// ================= plan 1 =================
function floor1(plan) {
  const F = { n: 1, name: $t('ENTRÉPLAN'), sub: $t('MARKNADSHALL · LAGER · KASSOR') };
  const core = block('core1', CORE1_W);
  const exit = block('exit', EXIT_W);
  const kassa = block('kassa', KASSA_W);
  const bays = Math.max(8, Math.min(16, plan.lager.length));
  const lager = block('lager', Math.max(LAGER_MIN, bays * 40 + 40), { stretch: true, cartons: plan.lager.slice(0, bays) });
  const depts = plan.depts.map((d) => Object.assign(d, { kind: 'dept', stretch: true }));
  const s = split([core], [exit, kassa, lager], depts, null, depts.length);
  const s2 = split([core], [exit, kassa, lager], depts, null, 1);
  // helst hela marknadshallen i rad A (direkt från rulltrappan) – om det inte blir mycket bredare
  const pick = s.W <= s2.W * 1.12 ? s : s2;
  place(F, pick.rowA, pick.rowB, null);
  Object.assign(F, { core, exit, kassa, lager, depts });
  F.num = 0;

  const bx = core.x0;
  // entréhallen
  F.door = { x0: bx + 14, x1: bx + 62, y0: 35 };
  F.lift = { x: bx + 206, fy: A_FLOOR, n: 1 };
  F.esc = [
    escalator({ id: 'upp', n: 1, lx: bx + 268, ly: A_FLOOR + 30, sx: 1, sy: -1, clip: 44, up: true, to: 2 }),
    escalator({ id: 'ner', n: 1, lx: bx + 572, ly: A_FLOOR + 30, sx: -1, sy: -1, clip: 44, up: false, to: 2 }),
  ];
  F.slab = { x0: bx + 326, x1: bx + 520, y: 44 };
  const [eu, en] = F.esc;
  F.paths = [
    [[bx + 38, A_FLOOR + 22], [bx + 38, A_FLOOR + 62], [eu.board[0] - 22, A_FLOOR + 62], [eu.board[0] - 22, eu.ly], [eu.board[0] - 4, eu.ly]],
    [[en.board[0], en.ly + 6], [en.board[0], AISLE1], [F.turnCx, AISLE1], [F.turnCx, AISLE2], [exit.x0 + 126, AISLE2], [exit.x0 + 126, B_FLOOR + 16]],
  ];
  F.exitDoor = { x0: exit.x0 + 100, x1: exit.x0 + 152 };
  F.spawn = [bx + 38, A_FLOOR + 22];
  F.arrive = { upp: null, ner: en.board, hiss: [F.lift.x + 13, A_FLOOR + 12] };
  return F;
}

// ================= plan 2 =================
function floor2(plan) {
  const F = { n: 2, name: $t('UTSTÄLLNING'), sub: $t('INREDDA RUM · RESTAURANG') };

  const core = block('core2', CORE2_W, { open: true });
  const rest = block('rest', REST_W);
  const rooms = plan.rooms.map((r) => Object.assign(r, { kind: 'room', stretch: true }));
  const s = split([core], [rest], rooms, core, 1);
  place(F, s.rowA, s.rowB, core);
  Object.assign(F, { core, rest, rooms });

  const bx = core.x0;
  F.lift = { x: bx + 236, fy: A_FLOOR, n: 2 };
  // rulltrappan UPP kommer upp ur golvöppningen och man kliver av åt öster
  const up = { lx: bx + 178, ly: A_FLOOR + 42 };
  const dn = { lx: bx + 204, ly: B_FLOOR + 30 };
  F.esc = [
    escalator({ id: 'upp', n: 2, ...up, sx: -1, sy: 1, clip: up.ly + 14, up: true, to: 1, pit: [bx + 38, up.lx - 8, up.ly - 16, up.ly + 14] }),
    escalator({ id: 'ner', n: 2, ...dn, sx: -1, sy: 1, clip: dn.ly + 14, up: false, to: 1, pit: [bx + 64, dn.lx - 8, dn.ly - 16, dn.ly + 14] }),
  ];
  const [eu, en] = F.esc;
  F.paths = [[[eu.board[0] + 2, eu.ly], [eu.board[0] + 2, AISLE1], [F.turnCx, AISLE1], [F.turnCx, AISLE2], [en.board[0] + 14, AISLE2], [en.board[0] + 14, en.ly], [en.board[0] + 4, en.ly]]];
  F.spawn = eu.board;
  F.arrive = { upp: eu.board, ner: null, hiss: [F.lift.x + 13, A_FLOOR + 12] };
  return F;
}

export function buildFloors() {
  const plan = buildPlan();
  // rummen numreras i gångordning, marknadshallens avdelningar fortsätter räkningen
  plan.rooms.forEach((r, i) => { r.num = i + 1; });
  plan.depts.forEach((r, i) => { r.num = plan.rooms.length + i + 1; });
  const f2 = floor2(plan);
  const f1 = floor1(plan);
  for (const F of [f1, f2]) F.ex = exhibitsOf(F);
  return [f1, f2];
}
export { DECOR };
