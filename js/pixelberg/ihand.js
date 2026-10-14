// 🧇 MATEN I HANDEN (v0.136, Carl 2026-10-14: "när man köper något – våfflor, churros – så ska man gå runt med det i
// sin hand"). Det man köper i matstånden och tältstånden hålls i handen och äts upp i tre tuggor medan man går
// vidare (en tugga var sjunde sekund) – sedan är det slut. Små bilder (origo = nederkantens mitt) som ritas i
// handen bredvid figuren. Tuggorna tas uppifrån (våfflan, glassen …) eller från sidan man vänder sig åt (korven,
// hamburgaren); det som hålls i (struten, pinnen, muggen) äts inte. Drycker har egna steg: muggen töms.
import { bild, put, spr } from '../core/pennor.js';

export const TUGGOR = 3, TUGGTID = 7;   // tuggor tills det är slut, sekunder per tugga

const VAFFLA = { g: 0xe8b860, c: 0xc88a3a, w: 0xfffaf0, r: 0xe04848, p: 0xf4f1ea, k: 0xf8c0d0, h: 0xfff0f4 };
const CHURRO = { c: 0xc8803a, e: 0xe8a860, s: 0xfff0c0, p: 0xfff4d0, q: 0xee8a2a, d: 0x4a2410 };
const KORV = { r: 0xb05a3a, u: 0xd8805a, m: 0xf0c030, b: 0xe8c080, p: 0xf4f1ea, n: 0xfff0c8 };
const GLASS = { n: 0xd8a860, x: 0xb88040, w: 0xfff8e8, a: 0xe04848, b: 0x3a7bd5, j: 0xf06aa0, h: 0xffb8d8, o: 0x6a3a1e, l: 0x8a5a3a };
const SOCKER = { s: 0xf4f1ea, r: 0xe04848, w: 0xffffff };
const POP = { o: 0xfff6d8, y: 0xf0d060, r: 0xe04848, w: 0xf4f1ea };
const BURG = { b: 0xe8b060, s: 0xfff4d0, g: 0x46a35a, m: 0x6a3a1e, c: 0xf0c030, t: 0xe04848 };
const GODIS = { p: 0xf4e8d8, q: 0xe0d0b8, a: 0xe04848, b: 0x3a7bd5, c: 0x46a35a, d: 0xf0c030 };
const BAND = { r: 0xe04848, o: 0xf08a2a, y: 0xf0c030, g: 0x46a35a, b: 0x3a7bd5, p: 0xd060a0 };
const mugg = (L) => ({ s: 0xe04848, c: 0xf4f1ea, k: 0xd8d4cc, L, e: 0xdce8f0 });
// en mugg med sugrör i tre steg: full, halv, nästan tom
const dryck = (L) => ({ pal: mugg(L), steg: [
  ['....s.', '...s..', 'cccccc', 'cLLLLk', 'cLLLLk', 'cLLLLk', '.cLLk.', '.cckk.'],
  ['....s.', '...s..', 'cccccc', 'ceeeek', 'cLLLLk', 'cLLLLk', '.cLLk.', '.cckk.'],
  ['....s.', '...s..', 'cccccc', 'ceeeek', 'ceeeek', 'cLLLLk', '.cLLk.', '.cckk.'],
] });

// rader: bilden (. = inget) · pal: färgerna · hall: så många rader nederst som inte äts · at: 'sida' = tuggorna tas från sidan
export const MAT_I_HAND = {
  vaffla: { pal: VAFFLA, hall: 2, rader: ['...ww....', '..rwwr...', '.gcgcgcg.', 'gcgcgcgcg', 'gcgcgcgcg', '.gcgcgcg.', 'ppppppppp', '.ppppppp.'] },
  'vaffla-glass': { pal: VAFFLA, hall: 2, rader: ['..kkhk...', '.kkkkkk..', '.gcgcgcg.', 'gcgcgcgcg', 'gcgcgcgcg', '.gcgcgcg.', 'ppppppppp', '.ppppppp.'] },
  churros: { pal: CHURRO, hall: 4, rader: ['.s.s.s.', '.c.e.c.', '.c.e.c.', '.c.e.c.', 'pqpqpqp', '.pqpqp.', '..pqp..', '...p...'] },
  'churros-choklad': { pal: CHURRO, hall: 4, rader: ['.d.d.d.', '.d.d.d.', '.c.e.c.', '.c.e.c.', 'pqpqpqp', '.pqpqp.', '..pqp..', '...p...'] },
  korv: { pal: KORV, at: 'sida', rader: ['.ruuuuur.', 'bmmmmmmmb', 'bbbbbbbbb', '.bbbbbbb.', '..ppppp..'] },
  'korv-mos': { pal: KORV, hall: 1, rader: ['.ruuuuur.', 'nnnnnnnnn', 'pnnnnnnnp', 'ppppppppp'] },
  hallonsaft: dryck(0xd8405a), lemonad: dryck(0xf0d860), lask: dryck(0x5a3a2a),
  smagodis: { pal: GODIS, rader: ['.qqqqq.', 'ppppppp', 'papbpcp', 'pppdppp', 'pbpppap', 'ppcpdpp', 'ppppppp', 'qpppppq'] },
  godisband: { pal: BAND, rader: ['rrr', 'ooo', 'yyy', 'ggg', 'bbb', 'ppp', 'rrr', 'ooo', 'yyy', 'ggg'] },
  'glass-jordgubb': { pal: GLASS, hall: 1, rader: ['..jhj..', '.jjjjj.', '.jjjjj.', '..nxn..', '..xnx..', '...n...', '...n...'] },
  'glass-choklad': { pal: GLASS, hall: 1, rader: ['..olo..', '.ooooo.', '.ooooo.', '..nxn..', '..xnx..', '...n...', '...n...'] },
  mjukglass: { pal: GLASS, hall: 1, rader: ['...w...', '..www..', '.wawbw.', '..wbw..', '.wwaww.', '..nxn..', '..xnx..', '...n...'] },
  'tva-kulor': { pal: GLASS, hall: 1, rader: ['..jhj..', '.jjjjj.', '..ooo..', '.ooooo.', '..nxn..', '..xnx..', '...n...', '...n...'] },
  sockervadd: { pal: { ...SOCKER, k: 0xf8a8d0, h: 0xffe0f0 }, hall: 4, rader: ['..kkkk..', '.kkhkkk.', 'kkkkkkkk', 'kkkkkkkk', '.kkkkkk.', '..kkkk..', '...kk...', '...ss...', '...ss...', '...ss...', '...ss...'] },
  'sockervadd-bla': { pal: { ...SOCKER, k: 0x8ad0f0, h: 0xd8f0ff }, hall: 4, rader: ['..kkkk..', '.kkhkkk.', 'kkkkkkkk', 'kkkkkkkk', '.kkkkkk.', '..kkkk..', '...kk...', '...ss...', '...ss...', '...ss...', '...ss...'] },
  klubba: { pal: SOCKER, hall: 4, rader: ['.rrr.', 'rwrwr', 'rrwrr', 'rwrwr', '.rrr.', '..s..', '..s..', '..s..', '..s..'] },
  popcorn: { pal: POP, hall: 5, rader: ['.oyo.o.', 'oyoyoyo', '.oyoyo.', 'rwrwrwr', 'rwrwrwr', 'rwrwrwr', 'rwrwrwr', '.rwrwr.'] },
  'popcorn-stor': { pal: POP, hall: 5, rader: ['.oyo.oyo.', 'oyoyoyoyo', 'oyoyoyoyo', '.oyoyoyo.', 'rwrwrwrwr', 'rwrwrwrwr', 'rwrwrwrwr', 'rwrwrwrwr', '.rwrwrwr.'] },
  hamburgare: { pal: BURG, at: 'sida', rader: ['..bbbbb..', '.bsbbsbb.', 'bbbbbbbbb', 'ggggggggg', 'mmmmmmmmm', 'bbbbbbbbb', '.bbbbbbb.'] },
  ostburgare: { pal: BURG, at: 'sida', rader: ['..bbbbb..', '.bsbbsbb.', 'bbbbbbbbb', 'ggggggggg', 'ccccccccc', 'mmmmmmmmm', 'bbbbbbbbb', '.bbbbbbb.'] },
  pommes: { pal: POP, hall: 4, rader: ['.y.y.y.', 'y.y.y.y', 'yyyyyyy', 'yyyyyyy', '.rrrrr.', '.rwrwr.', '.rrrrr.', '.rrrrr.'] },
};

// raderna som är kvar efter `bit` tuggor (0–2) – dir = åt vilket håll figuren tittar (sidotuggorna tas framtill)
function kvar(def, bit, dir) {
  if (def.steg) return def.steg[Math.min(bit, def.steg.length - 1)];
  let rows = def.rader;
  if (bit <= 0) return rows;
  if (def.at === 'sida') { const n = rows[0].length, bort = Math.round(n * bit / TUGGOR); return rows.map((r) => (dir === 'left' ? r.slice(bort) : r.slice(0, n - bort))); }
  const n = rows.length - (def.hall || 0), bort = Math.round(n * bit / TUGGOR);
  return rows.slice(bort);
}
export function ritaIHand(ctx, x, y, id, bit, dir) {
  const def = MAT_I_HAND[id] || MAT_I_HAND.smagodis;
  const rows = kvar(def, bit, dir);
  if (!rows.length || !rows[0].length) return;
  const w = rows[0].length, h = rows.length;
  put(ctx, bild(`ihand|${id}|${bit}|${dir === 'left' ? 'v' : 'h'}`, w + 4, h + 4, (w >> 1) + 2, h + 2, (P) => spr(P, -(w >> 1), -h, rows, def.pal)), x, y);
}
