// ✂️ DJURENS FRISYRER (djurtrimmaren i Tassbacken, js/scenes/shop-trimmare.js – Carl 2026-10-12:
// "kan vi ha olika frisyrer för våra katter och ha kattutställning?").
//
// Frisyren läggs på djurets bildruta EFTER att kroppen är målad men före den yttre konturen
// (pet-art.js paintPet → trimma). Den jobbar på pixelbufferten med grupperna (G.head, G.body …):
//   fluff   – fönad: pälsen växer 1 px runt kropp, hals och svans (färgen ger en pastellton)
//   lejon   – lejonklipp: kroppen och benen rakade, stor man runt huvudet, tofs på svansen, "stövlar"
//   pudel   – pompomklipp: rakade ben med pompoms vid tassarna, pompom på svansen och en topp
//   tupp    – tuppkam: en kam rakt upp över huvudet (och lite längs nacken)
//   rosett  – en rosett mitt på huvudet
//   slingor – färgslingor: ränder i svansen, färgade öron och en slinga på hjässan
// pet.frisyr = { s: stil, f: färg ('natur' | FARGER-id), d: dagen den gjordes }.
// Allt är deterministiskt (hash per pixel) så att bildrutorna inte flimrar.
import { BW, BH, G, AX, GY } from './pet-canvas.js';
import { mix, mul, hash } from '../core/floor-pix.js';
import { $t } from '../core/i18n.js';

export const FRISYRER = [
  { id: 'fluff', namn: $t('Fönad och fluffig'), icon: '☁️', pris: 180, farg: true, text: $t('Bad, fön och borste – pälsen blir dubbelt så yvig.') },
  { id: 'lejon', namn: $t('Lejonklipp'), icon: '🦁', pris: 260, farg: true, text: $t('Kort på kroppen, stor man runt huvudet och en tofs på svansen.') },
  { id: 'pudel', namn: $t('Pompomklipp'), icon: '🎀', pris: 280, farg: true, text: $t('Pompoms vid tassarna och på svansen – och en topp på huvudet.') },
  { id: 'tupp', namn: $t('Tuppkam'), icon: '🤘', pris: 220, farg: true, text: $t('En kam rakt upp över huvudet. Rock!') },
  { id: 'rosett', namn: $t('Rosett'), icon: '🎀', pris: 120, farg: true, text: $t('En söt rosett mitt på huvudet.') },
  { id: 'slingor', namn: $t('Färgslingor'), icon: '🌈', pris: 240, farg: true, maste: true, text: $t('Färgade ränder i svansen, färgade öron och en slinga på hjässan.') },
];
export const FARGER = [
  { id: 'natur', namn: $t('Naturlig'), c: null },
  { id: 'rosa', namn: $t('Rosa'), c: 0xf07ab8 },
  { id: 'bla', namn: $t('Himmelsblå'), c: 0x6ab4f0 },
  { id: 'mint', namn: $t('Mintgrön'), c: 0x62dca8 },
  { id: 'lila', namn: $t('Lila'), c: 0xa87ae8 },
  { id: 'guld', namn: $t('Guld'), c: 0xf0c040 },
  { id: 'rod', namn: $t('Röd'), c: 0xe0484a },
];
export const FARG_PRIS = 80;          // färgen kostar lite extra (utom Naturlig)
export const NATUR_PRIS = 90;         // "tillbaka till naturlig": klipp och borste
export const frisyrById = (id) => FRISYRER.find((f) => f.id === id) || null;
export const fargById = (id) => FARGER.find((f) => f.id === id) || FARGER[0];
// frisyrens nyckel (sprites.js cachar bildrutorna per utseende)
export const frisyrKey = (pet) => (pet?.frisyr?.s ? pet.frisyr.s + ':' + (pet.frisyr.f || 'natur') : '');
// sparfilens frisyr (sim.js load): bara kända stilar och färger följer med
export function rensaFrisyr(q) {
  if (!q || typeof q !== 'object' || !frisyrById(q.s)) return null;
  const f = FARGER.some((x) => x.id === q.f) ? q.f : 'natur';
  return { s: q.s, f: frisyrById(q.s).maste && f === 'natur' ? 'rosa' : f, d: Math.max(0, q.d | 0) };
}
// pris för stil + färg
export const trimPris = (s, f) => (frisyrById(s)?.pris || NATUR_PRIS) + (f && f !== 'natur' ? FARG_PRIS : 0);

// ---------------------------------------------------------------- ritningen
const SKIN = 0xf0c4b4;   // rakad hud skymtar igenom
const HEADG = new Set([G.head, G.ear, G.earFar, G.snout, G.face]);
const BODYG = new Set([G.body, G.thigh, G.neck, G.mane]);
const TAILG = new Set([G.tail, G.tailNear]);
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], N8 = [...N4, [1, 1], [-1, 1], [1, -1], [-1, -1]];
const inb = (i, j) => i >= 0 && j >= 0 && i < BW && j < BH;

export function trimma(B, R, fr, view) {
  if (!fr?.s) return;
  const dye = fargById(fr.f).c;
  const col = B.col, grp = B.grp;
  const at = (i, j) => j * BW + i;
  const cells = (set) => { const o = []; for (let k = 0; k < col.length; k++) if (col[k] >= 0 && set.has(grp[k])) o.push(k); return o; };
  const head = cells(new Set([G.head])), heads = cells(HEADG), body = cells(BODYG), tail = cells(TAILG);
  const legs = cells(new Set([G.leg])), paws = cells(new Set([G.paw]));
  if (!head.length) return;
  const ij = (k) => [k % BW, (k / BW) | 0];
  const mean = (ks) => { let x = 0, y = 0; for (const k of ks) { const [i, j] = ij(k); x += i; y += j; } return [x / Math.max(1, ks.length), y / Math.max(1, ks.length)]; };
  const [bx, by] = body.length ? mean(body) : [AX, GY - 6];
  const [hx] = mean(head);
  const coat = R.C?.c ?? 0x9a7650;
  // svansspetsen: de svanspixlar som ligger längst från kroppens mitt
  const tip = (share) => { if (!tail.length) return []; const d = tail.map((k) => { const [i, j] = ij(k); return [k, Math.hypot(i - bx, j - by)]; }).sort((a, b) => b[1] - a[1]); return d.slice(0, Math.max(1, Math.round(d.length * share))).map((x) => x[0]); };
  // väx ut: tomma grannar till pixlarna ks får färgen fn(grannens färg, avstånd) med sannolikheten p
  const grow = (ks, steps, p, fn, g = null, n = N8) => {
    let front = new Set(ks);
    for (let s = 1; s <= steps; s++) {
      const add = new Map();
      for (const k of front) {
        const [i, j] = ij(k);
        for (const [dx, dy] of n) {
          const x = i + dx, y = j + dy;
          if (!inb(x, y) || y > GY) continue;
          const q = at(x, y);
          if (col[q] >= 0 || add.has(q)) continue;
          if (hash(x, y, 40 + s) > (typeof p === 'function' ? p(s) : p)) continue;
          add.set(q, [fn(col[k], s, x, y), g ?? grp[k]]);
        }
      }
      for (const [q, [c, gg]] of add) { col[q] = c; grp[q] = gg; }
      front = new Set(add.keys());
    }
  };
  const tint = (ks, amt, c) => { if (c == null) return; for (const k of ks) col[k] = mix(col[k], c, amt); };
  const shave = (ks, amt = 0.38) => { for (const k of ks) col[k] = mix(col[k], SKIN, amt); };
  const fluffy = (c, s, x, y) => { const v = mix(c, 0xffffff, 0.12); return hash(x, y, 9) < 0.3 ? mul(v, 0.9) : v; };
  // huvudets översta rad och mitt (där rosetten, toppen och kammen sitter)
  let top = BH; for (const k of head) top = Math.min(top, ij(k)[1]);
  const topRow = head.filter((k) => ij(k)[1] <= top + 1).map((k) => ij(k)[0]);
  const cx = Math.round(topRow.length ? (Math.min(...topRow) + Math.max(...topRow)) / 2 : hx);
  const stamp = (rows, x0, y0, pal, g = G.mane) => rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c == null || !inb(x0 + i, y0 + j)) continue; col[at(x0 + i, y0 + j)] = c; grp[at(x0 + i, y0 + j)] = g; } });

  switch (fr.s) {
    case 'fluff': {
      grow([...body, ...tail], 1, 0.8, fluffy);
      grow(heads.filter((k) => grp[k] === G.head), 1, 0.35, fluffy);
      if (dye != null) tint(cells(new Set([...BODYG, ...TAILG, G.head, G.ear, G.earFar, G.thigh, G.leg, G.paw])), 0.32, dye);
      break;
    }
    case 'lejon': {
      shave([...body.filter((k) => grp[k] !== G.neck && grp[k] !== G.mane), ...legs]);
      const tt = new Set(tip(0.3));
      shave(tail.filter((k) => !tt.has(k)));
      // manen: två varv runt huvudet och halsen, lite yvig
      const mc = dye != null ? mix(coat, dye, 0.55) : mix(coat, 0xf8e8c8, 0.18);
      const neck = body.filter((k) => grp[k] === G.neck || grp[k] === G.mane);
      for (const k of neck) col[k] = mix(col[k], mc, 0.6);
      grow([...head, ...neck], 2, (s) => (s === 1 ? 0.92 : 0.5), (c, s, x, y) => (hash(x, y, 7) < 0.35 ? mul(mc, 0.86) : s === 2 ? mul(mc, 0.94) : mc), G.mane, N4);
      grow([...tt], 1, 0.9, () => mc, G.tail);
      grow(paws, 1, 0.55, (c) => mix(c, 0xffffff, 0.08), G.paw, [[1, 0], [-1, 0]]);
      break;
    }
    case 'pudel': {
      shave(legs, 0.3);
      const pc = dye != null ? mix(0xfaf6f0, dye, 0.6) : mix(coat, 0xffffff, 0.2);
      const pom = (c, s, x, y) => (hash(x, y, 3) < 0.3 ? mul(pc, 0.9) : pc);
      for (const k of paws) col[k] = pc;
      grow(paws, 1, 0.95, pom, G.paw);
      const tt = tip(0.3);
      for (const k of tt) col[k] = pc;
      grow(tt, 2, (s) => (s === 1 ? 0.95 : 0.45), pom, G.tail, N4);
      // toppen på huvudet: en rund pompom
      const r = R.age === 0 ? ['.ab.', 'abba'] : ['.aba.', 'abbba', '.bbb.'];
      stamp(r, cx - (r[0].length >> 1), top - r.length + 1, { a: pc, b: mul(pc, 0.92) });
      break;
    }
    case 'tupp': {
      const kc = dye ?? mul(coat, 0.72), kc2 = mix(kc, 0xffffff, 0.3);
      const side = view === 'side';
      // kolumnerna överst på huvudet: framifrån/bakifrån en smal kam i mitten, från sidan längs hela hjässan
      const cols = new Map();
      for (const k of head) { const [i, j] = ij(k); if (!cols.has(i) || cols.get(i) > j) cols.set(i, j); }
      for (const [i, j] of cols) {
        if (!side && Math.abs(i - cx) > 0) continue;
        const hgt = side ? 2 + ((i & 1) ? 1 : 0) : 3 + (R.age === 2 ? 1 : 0);
        for (let y = 1; y <= hgt; y++) { if (!inb(i, j - y)) continue; const q = at(i, j - y); if (col[q] >= 0 && HEADG.has(grp[q]) && grp[q] !== G.head) continue; col[q] = y === hgt ? kc2 : kc; grp[q] = G.mane; }
      }
      // en låg kam längs nacken (från sidan)
      if (side) for (const k of body) { const [i, j] = ij(k); if (grp[k] !== G.neck && grp[k] !== G.mane) continue; if (inb(i, j - 1) && col[at(i, j - 1)] < 0) { col[at(i, j - 1)] = kc; grp[at(i, j - 1)] = G.mane; } }
      break;
    }
    case 'rosett': {
      const rc = dye ?? 0xe0484a, rk = mul(rc, 0.7), rl = mix(rc, 0xffffff, 0.35);
      const rows = R.age === 0 ? ['a.a', 'aka', 'a.a'] : ['ab.ba', 'aakaa', 'ab.ba'];
      // från sidan sitter den lite bakåt på hjässan (mellan öronen)
      const x0 = cx - (rows[0].length >> 1) - (view === 'side' ? 1 : 0);
      stamp(rows, x0, top - 2, { a: rc, b: rl, k: rk });
      break;
    }
    case 'slingor': {
      const sc = dye ?? 0xf07ab8;
      // svansen: ränder (var tredje "ring" från kroppen)
      for (const k of tail) { const [i, j] = ij(k); if ((Math.round(Math.hypot(i - bx, j - by)) % 3) === 0) col[k] = mix(col[k], sc, 0.75); }
      tint(heads.filter((k) => grp[k] === G.ear || grp[k] === G.earFar), 0.65, sc);
      // en slinga på hjässan
      for (const k of head) { const [i, j] = ij(k); if (j <= top + 1 && Math.abs(i - cx) <= 1) col[k] = mix(col[k], sc, 0.7); }
      break;
    }
  }
}
