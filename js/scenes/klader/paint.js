// KLÄDER – förmålade bilder: båda våningarnas väggar och golv, trappan, hyllorna, disken,
// klädställningarna, lagfotot och fotbollsskorna. Allt målas en gång med Pix (floor-pix.js)
// i spelets pixelkorn; det som ändrar sig (plaggen, lapparna, figurerna) ritas levande.
import { Pix, SMALL, BIG, textW, text, mix, mul, hash, bayer } from '../../core/floor-pix.js';
import { $t } from '../../core/i18n.js';
import {
  H, WALL_Y, W1, W2, MID0, MID1, DOOR, DESK, GOND, HATS, COLS, ROW_Y, MOD_X, MOD_W, RACK_W, STAIR, STAIRS1, STAIRS2, STAIRS2UP, JULHALL_X0,
  KUNGS_X1, LAG_X0, PHOTO, SHOEWALL, PITCH, DEPT, CLEATS, SPORT_MOD_X, KUNGS_POS, TEAM_POS,
} from './data.js';

// ================= hjälpare =================
export function disc(P, cx, cy, rx, ry, c, a = 1) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) P.px(x, y, c, a);
  }
}
export function glowText(P, F, s, x, y, c, glow, scale = 1) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) text(P, F, s, x + dx, y + dy, glow, 0.35, scale);
  text(P, F, s, x, y, c, 1, scale);
}
export function plank(x, y, base, seed, ph = 7, L = 36) {
  const row = ((y - WALL_Y) / ph) | 0, yy = (y - WALL_Y) % ph;
  const off = (hash(row, 1, seed) * L) | 0;
  const px = x + off, pi = (px / L) | 0, pin = px % L;
  let c = mul(base, 0.93 + hash(pi, row, seed) * 0.12);
  if (yy === ph - 1) c = mul(c, 0.8);
  else if (pin === 0) c = mul(c, 0.84);
  else if (yy === 0) c = mix(c, 0xffffff, 0.1);
  else if (hash(px >> 3, y, seed + 1) > 0.9) c = mul(c, 0.96);
  return c;
}
export function rug(P, x0, y0, w, h, base, border, dots, seed) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const ex = Math.min(x - x0, x0 + w - 1 - x), ey = Math.min(y - y0, y0 + h - 1 - y), e = Math.min(ex, ey);
    let c = base;
    if (e < 3) c = border;
    else if (e === 3) c = mix(border, 0xffffff, 0.3);
    else if (e === 6) c = mix(base, border, 0.5);
    else if ((x + y) % 12 === 0 || (x - y + 1200) % 12 === 0) c = mix(base, dots, 0.45);
    c = mix(c, 0x000000, (bayer(x, y) - 0.5) * 0.06 + (hash(x >> 1, y >> 1, seed) - 0.5) * 0.04);
    P.px(x, y, c);
  }
  for (let x = x0 + 2; x < x0 + w - 2; x += 2) { P.px(x, y0 - 1, mix(border, 0xffffff, 0.4)); P.px(x, y0 + h, mix(border, 0xffffff, 0.4)); }
}
// konstgräs med klippränder och vita linjer (lines = [[x0, y0, x1, y1], …])
function turf(P, x0, y0, w, h, seed, lines = []) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const band = (((x - x0) / 12) | 0) % 2;
    let c = band ? 0x3f9a4a : 0x46a652;
    const r = hash(x, y, seed);
    if (r > 0.86) c = mix(c, 0x6fc070, 0.5); else if (r < 0.1) c = mul(c, 0.88);
    c = mix(c, 0x000000, (bayer(x, y) - 0.5) * 0.05);
    P.px(x, y, c);
  }
  for (const [a, b, c, d] of lines) P.line(a, b, c, d, 0xf2f6ee, 0.85);
  // kant (gummilist)
  P.box(x0 - 1, y0 - 1, w + 2, h + 2, 0x24502c);
}
export function sign(P, cx, y, lbl, board, trim, fg, F = SMALL) {
  const tw = textW(F, lbl), w = tw + 8, h = F === BIG ? 11 : 9, x0 = Math.round(cx - w / 2);
  P.rect(x0 + 1, y + h, w, 1, 0x000000, 0.25);
  P.rect(x0, y, w, h, board); P.box(x0, y, w, h, trim);
  text(P, F, lbl, x0 + 4, y + 2, fg);
  return [x0, x0 + w];
}
function deptSign(P, key, cx, y) {
  const th = DEPT[key];
  const dots = /[ÅÄÖÁÀÂÃÉÈÊËÍÌÎÏÑŃÓÒÔÕŚŹŻÚÙÛÜŸÝ]/.test(th.name) ? 3 : 0; // prickarna/ringen över versalen behöver luft
  const tw = textW(BIG, th.name, 2), w = tw + 30, x0 = Math.round(cx - w / 2), h = 22 + dots;
  P.ell(cx, y + h / 2, w * 0.7, h, th.glow, 0.2, 5);
  P.rect(x0, y, w, h, th.board);
  P.box(x0, y, w, h, mul(th.trim, 0.6));
  P.box(x0 + 1, y + 1, w - 2, h - 2, th.trim);
  glowText(P, BIG, th.name, x0 + 15, y + 4 + dots, th.neon, th.glow, 2);
  const ICONS = {
    tjej: ['.#.#.', '#####', '#####', '.###.', '..#..'],
    kille: ['..#..', '.###.', '#####', '..#..', '.#.#.'],
    kungs: ['.###.', '#.#.#', '###.#', '#.###', '.###.'],
    lag: ['.###.', '#.#.#', '###.#', '#.###', '.###.'],
  };
  const ic = ICONS[key] || ICONS.tjej;
  for (const ox of [x0 + 5, x0 + w - 10]) ic.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') P.px(ox + i, y + 8 + dots + j, th.neon); });
  P.vl(x0 + 8, 2, y - 2, 0x8a8e9a); P.vl(x0 + w - 9, 2, y - 2, 0x8a8e9a);
}
function fittingRooms(P, x0, cur, curLo, frame) {
  const lbl = $t('PROVHYTT');
  const lw = textW(SMALL, lbl) + 8;
  P.rect(x0 + 38 - lw / 2, 8, lw, 9, 0x17151a); text(P, SMALL, lbl, x0 + 38 - lw / 2 + 4, 10, 0xffffff);
  for (let k = 0; k < 2; k++) {
    const x = x0 + k * 40, w = 36, y = 20;
    P.rect(x, y, w, WALL_Y - y, frame);
    P.rect(x + 3, y + 4, w - 6, WALL_Y - y - 4, 0x3a2e3a);
    P.rect(x + 3, y + 4, w - 6, 2, 0x241c26);
    P.rect(x + 22, y + 8, 7, 22, 0xb8d4e0); P.box(x + 21, y + 7, 9, 24, 0xd8b24a); P.px(x + 23, y + 10, 0xffffff); P.px(x + 24, y + 11, 0xffffff);
    P.rect(x + 22, WALL_Y - 8, 8, 6, 0x6b4a33); P.hl(x + 22, WALL_Y - 8, 8, 0x8a6446);
    P.rect(x + 1, y + 3, w - 2, 1, 0xc9ccd6);
    const cw = k === 0 ? 20 : 26;
    for (let yy = y + 4; yy < WALL_Y - 1; yy++) for (let xx = x + 3; xx < x + 3 + cw; xx++) {
      const f = (xx - x) % 4;
      let c = f === 0 ? curLo : f === 1 ? mix(cur, 0xffffff, 0.18) : cur;
      if (yy === WALL_Y - 2 && (xx % 3 === 0)) c = curLo;
      P.px(xx, yy, c);
    }
    for (let xx = x + 3; xx < x + 3 + cw; xx += 3) P.px(xx, y + 4, 0xe8e8ee);
    P.box(x, y, w, WALL_Y - y, mul(frame, 0.7));
  }
}
function mirror(P, x, frame) {
  const y = 20, w = 20, h = WALL_Y - 22;
  P.rect(x, y, w, h, frame); P.box(x, y, w, h, mul(frame, 0.6));
  for (let yy = y + 2; yy < y + h - 2; yy++) for (let xx = x + 2; xx < x + w - 2; xx++) {
    let c = mix(0xd4e8f0, 0x9cbccc, (yy - y) / h);
    const d = (xx - x) + (yy - y) * 0.6;
    if (d % 22 < 2 || d % 22 > 20.5) c = mix(c, 0xffffff, 0.5);
    P.px(xx, yy, c);
  }
  P.hl(x + 1, y + 1, w - 2, mix(frame, 0xffffff, 0.4));
}
export function pillar(P, px) {
  P.rect(px - 5, 0, 10, WALL_Y, 0xdcd4c8);
  P.vl(px - 5, 0, WALL_Y, 0xf2ece2); P.vl(px - 4, 0, WALL_Y, 0xe8e0d4);
  P.vl(px + 3, 0, WALL_Y, 0xb8ae9e); P.vl(px + 4, 0, WALL_Y, 0x8a8070);
  P.rect(px - 6, 3, 12, 3, 0xc9bfae); P.rect(px - 6, WALL_Y - 4, 12, 4, 0xa89e8c);
}
export function spots(P, x0, x1, skip = []) {
  P.rect(x0, 0, x1 - x0, 3, 0x2a2430); P.hl(x0, 2, x1 - x0, 0x4a4450);
  for (let x = x0 + 20; x < x1; x += 44) {
    if (skip.some(([a, b]) => x > a && x < b)) continue;
    P.ell(x, 20, 16, 26, 0xfff4dc, 0.22, 5);
    P.rect(x - 2, 3, 5, 3, 0x1d1822); P.hl(x - 1, 5, 3, 0xfff6c8);
  }
}
// bröstpanel längst ner på väggen, zon för zon: [x0, x1, bas, list]
export function wainscot(P, zones) {
  for (const [x0, x1, base, trim] of zones) for (let x = x0; x < x1; x++) for (let y = WALL_Y - 12; y < WALL_Y; y++) {
    let c = base;
    if (y === WALL_Y - 12) c = trim;
    else if (y === WALL_Y - 11) c = mix(trim, 0xffffff, 0.35);
    else if (y >= WALL_Y - 2) c = mul(trim, 0.7);
    else if (x % 24 === 0) c = mul(base, 0.88);
    else if (x % 24 === 1) c = mix(base, 0xffffff, 0.25);
    P.px(x, y, c);
  }
}
// Väggmodul: panel med skylt och en klädstång (plaggen hänger levande från stången vid y = 40)
export const MOD_RAIL = 40;
export function wallModule(P, x0, key, lbl) {
  const th = DEPT[key], w = MOD_W;
  const panel = key === 'tjej' ? 0xf6e4ee : key === 'kille' ? 0x2c4a70 : 0x2a2a34;
  const edge = key === 'tjej' ? 0xd98fb4 : key === 'kille' ? 0x1a2c4c : 0x14141a;
  P.rect(x0, 27, w, WALL_Y - 12 - 27, panel);
  for (let y = 40; y < WALL_Y - 12; y += 5) P.hl(x0 + 2, y, w - 4, mix(panel, key === 'tjej' ? 0xd9a5c0 : 0x0e1a2c, 0.5), 0.6);
  P.box(x0, 27, w, WALL_Y - 12 - 27, edge);
  // skylt
  P.rect(x0 + 2, 28, w - 4, 9, th.board); P.hl(x0 + 2, 36, w - 4, th.trim);
  const tw = textW(SMALL, lbl);
  text(P, SMALL, lbl, x0 + Math.round((w - tw) / 2), 30, key === 'tjej' ? 0xffd6ea : 0xd6f2ff);
  // stången + fästen
  P.rect(x0 + 2, MOD_RAIL, w - 4, 1, 0xe8eaf0); P.hl(x0 + 2, MOD_RAIL + 1, w - 4, 0x6d717c);
  P.rect(x0 + 1, MOD_RAIL - 2, 2, 4, 0x8a8e9a); P.rect(x0 + w - 3, MOD_RAIL - 2, 2, 4, 0x8a8e9a);
}

// ================= plan 1: MODE =================
export function paintFloor1() {
  const W = W1, P = new Pix(W, H);
  const HEART = ['.#.#.', '#####', '.###.', '..#..'];
  // tjejer: rosa randig tapet med hjärtan
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < MID0; x++) {
    let c = ((x / 8) | 0) % 2 ? 0xeeb6d2 : 0xe3a0c4;
    P.px(x, y, mix(c, 0xffffff, (bayer(x, y) - 0.5) * 0.05));
  }
  for (let y = 8; y < 54; y += 12) for (let x = 2; x < MID0 - 6; x += 16) {
    const ox = x + (((y / 12) | 0) % 2 ? 8 : 0) + 1;
    HEART.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') P.px(ox + i, y + j, 0xfff0f7, 0.55); });
  }
  // killar: blå panelvägg
  for (let y = 0; y < WALL_Y; y++) for (let x = MID1; x < W; x++) {
    const r = y % 6;
    let c = r === 5 ? 0x1f3350 : r === 0 ? 0x4a70a2 : 0x3a5f8f;
    c = mix(c, 0x000000, (bayer(x, y) - 0.5) * 0.06 + (hash((x / 48) | 0, (y / 6) | 0, 3) - 0.5) * 0.06);
    P.px(x, y, c);
  }
  // mitten: varm puts
  for (let y = 0; y < WALL_Y; y++) for (let x = MID0; x < MID1; x++) P.px(x, y, mix(0xefe5d2, 0xe4d8c0, hash(x >> 1, y >> 1, 9) * 0.35 + (bayer(x, y) - 0.5) * 0.15));
  wainscot(P, [[0, MID0, 0xf8eef3, 0xd98fb4], [MID0, MID1, 0xb98a5e, 0x8a6440], [MID1, W, 0x2f6b58, 0x4f9c82]]);
  const [s0, s1] = STAIRS1.slab;
  spots(P, 0, W, [[DOOR.x0 - 16, DOOR.x1 + 16], [s0 - 30, s1 + 10]]);
  for (const px of [MID0, MID1]) pillar(P, px);

  // ===== dörren + skylten KLÄDER =====
  const dc = (DOOR.x0 + DOOR.x1) / 2;
  const lw = textW(BIG, $t('KLÄDER'), 2) + 16;
  P.rect(dc - lw / 2, 5, lw, 20, 0x17151a); P.box(dc - lw / 2, 5, lw, 20, 0xe8b230);
  P.box(dc - lw / 2 + 2, 7, lw - 4, 16, 0x5a4a20);
  glowText(P, BIG, $t('KLÄDER'), dc - textW(BIG, $t('KLÄDER'), 2) / 2, 9, 0xffe070, 0xe8b230, 2);
  P.rect(DOOR.x0 - 2, 28, DOOR.x1 - DOOR.x0 + 4, WALL_Y - 28, 0x2a2430);
  for (let i = 0; i < 2; i++) {
    const gx = DOOR.x0 + 1 + i * 16;
    for (let y = 30; y < WALL_Y - 1; y++) for (let x = gx; x < gx + 14; x++) {
      let c = mix(0xa8d4e6, 0x6f9fb8, (y - 30) / 40);
      if ((x - y + 400) % 17 < 2) c = mix(c, 0xffffff, 0.35);
      P.px(x, y, c);
    }
    P.rect(gx + 2, 50, 10, 2, 0xc9c9d4); P.hl(gx + 2, 50, 10, 0xf2f2f6);
  }
  P.rect(DOOR.x0 + 5, 32, 22, 9, 0x1d2b1f); text(P, SMALL, $t('UT'), DOOR.x0 + 12, 34, 0x6fe08a);
  P.rect(DOOR.x0 - 4, WALL_Y, DOOR.x1 - DOOR.x0 + 8, 10, 0x3a3640);
  P.box(DOOR.x0 - 4, WALL_Y, DOOR.x1 - DOOR.x0 + 8, 10, 0x5a5460);
  for (let x = DOOR.x0 - 2; x < DOOR.x1 + 2; x += 2) P.vl(x, WALL_Y + 2, 6, 0x2e2a34);
  // affischramen (figurerna ritas levande)
  P.rect(MID0 + 10, 29, 52, 37, 0x17151a);
  P.rect(MID0 + 12, 31, 48, 33, 0xfbe3ef); P.rect(MID0 + 36, 31, 24, 33, 0xe0ebf8);
  for (let y = 31; y < 64; y++) for (let x = MID0 + 12; x < MID0 + 60; x++) if ((x + y) % 7 === 0) P.px(x, y, 0xffffff, 0.5);
  // KASSA-skylt
  const kx = DESK.x + DESK.w / 2, kw = textW(SMALL, $t('KASSA')) + 10;
  P.rect(kx - kw / 2, 30, kw, 10, 0x17151a); P.box(kx - kw / 2, 30, kw, 10, 0xe8b230);
  text(P, SMALL, $t('KASSA'), kx - kw / 2 + 5, 33, 0xf0d048);

  // ===== avdelningarna =====
  deptSign(P, 'tjej', 280, 4);
  deptSign(P, 'kille', W - 280, 4);
  fittingRooms(P, 8, 0xc65fa0, 0x8a3a70, 0xf7eef3);
  fittingRooms(P, W - 84, 0x2d4a78, 0x1a2c4c, 0xdfe8f4);
  mirror(P, 92, 0xd8b24a);
  mirror(P, W - 112, 0xc9ccd6);

  // ===== trapphallen: taket (plan 2:s golvkant) med räcke, och plan 2 som skymtar ovanför =====
  paintSlab(P, s0, s1, STAIRS1.clip);

  // ===== golv =====
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    let c;
    if (x < MID0) c = plank(x, y, 0xe2bcc6, 11);
    else if (x >= MID1) c = plank(x, y, 0x98a6b8, 23);
    else {
      const tx = ((x - MID0) / 16) | 0, ty = ((y - WALL_Y) / 16) | 0;
      c = (tx + ty) % 2 ? 0xeee6d8 : 0xe0d5c2;
      c = mix(c, 0xd0c4ae, hash(x >> 2, y >> 2, 17) * 0.25);
      if ((x - MID0) % 16 === 0 || (y - WALL_Y) % 16 === 0) c = 0xc9bca4;
      if (hash(x, y, 4) > 0.985) c = mul(c, 0.94);
    }
    P.px(x, y, c);
  }
  rug(P, 10, 88, 276, 108, 0xc9a0dc, 0xf28bb3, 0xfbe3ef, 31);
  rug(P, W - 286, 88, 276, 108, 0x34507a, 0x3fc4ff, 0x7fb8e8, 37);
  for (const px of [MID0, MID1]) { P.rect(px - 1, WALL_Y, 2, H - WALL_Y, 0xd8b24a); P.vl(px - 1, WALL_Y, H - WALL_Y, 0xf0d890); }
  for (let i = 0; i < 5; i++) P.darken(0, WALL_Y + i, W, 1, 0.8 + i * 0.04);
  // ljuspölar under dockorna och framför hyllorna
  for (const dx of COLS) for (const y of ROW_Y) { P.ell(dx, y + 1, 18, 7, 0xfff6e0, 0.28, 4); P.ell(W - dx, y + 1, 18, 7, 0xfff6e0, 0.28, 4); }
  P.ell(GOND.x + GOND.w / 2, GOND.y + GOND.h, 64, 10, 0xfff6e0, 0.2, 4);
  P.ell(HATS.x + HATS.w / 2, HATS.y + HATS.h, 60, 9, 0xfff6e0, 0.2, 4);
  // trappans skugga på golvet
  P.ell(STAIRS1.lx + 70, STAIRS1.ly + 5, 80, 5, 0x1a1426, 0.18, 4);
  P.box(0, 0, W, H, 0x0e0d12);
  return P.flush();
}
// Väggmodulerna målas ovanpå bakgrunden när kategorierna är kända (scenen skickar etiketterna)
export function paintModules(bg, mods) {
  const P = new Pix(bg.width, bg.height);
  for (const m of mods) wallModule(P, m.x, m.key, m.sign);
  const c = bg.getContext('2d');
  c.drawImage(P.flush(), 0, 0);
  return bg;
}

// Taket över trappan på plan 1: räcket på plan 2, bjälken med skylt, skugga under
export function paintSlab(P, x0, x1, yBot, jul = false) {
  const yTop = yBot - 10;
  // plan 2 (eller julvåningen) skymtar: tak, en hängande banderoll bakom räcket
  for (let y = 0; y < yTop; y++) for (let x = x0; x < x1; x++) {
    let c = jul ? mix(0x2a4a34, 0x3a5e44, y / yTop) : mix(0x4a4658, 0x6a6478, y / yTop);
    if (y < 3) c = 0x2a2430;
    P.px(x, y, mix(c, 0x000000, (bayer(x, y) - 0.5) * 0.08));
  }
  // lampor i plan 2:s tak
  for (let x = x0 + 16; x < x1 - 8; x += 36) { P.rect(x - 3, 3, 7, 2, 0x1d1822); P.hl(x - 2, 4, 5, 0xfff6c8); P.ell(x, 10, 12, 10, 0xfff4dc, 0.18, 4); }
  // banderoll SPORT & FOTBOLL – eller GOD JUL med en girlang och ljus
  const lbl = jul ? $t('GOD JUL') : $t('SPORT + FOTBOLL');
  const bw = textW(SMALL, lbl) + 22, bx = Math.round((x0 + x1) / 2 - bw / 2);
  P.vl(bx + 3, 3, 5, 0x8a8e9a); P.vl(bx + bw - 4, 3, 5, 0x8a8e9a);
  const [bc, bd, bh] = jul ? [0x2f8f46, 0x173a24, 0x6fd08a] : [0xd9434b, 0x7a1f2e, 0xff7a82];
  P.rect(bx, 8, bw, 10, bc); P.box(bx, 8, bw, 10, bd); P.hl(bx + 1, 9, bw - 2, bh);
  text(P, SMALL, lbl, bx + 11, 11, 0xffffff);
  if (jul) {
    for (const sx of [bx + 3, bx + bw - 8]) { P.rect(sx + 1, 10, 3, 5, 0xffd23f); P.hl(sx, 12, 5, 0xffd23f); P.px(sx + 2, 9, 0xfff0b0); }
    for (let x = x0 + 2; x < x1 - 2; x++) { const yy = 3 + Math.round(Math.abs(Math.sin((x - x0) / 9)) * 3); P.px(x, yy, 0x1e5a32); P.px(x, yy + 1, 0x2f8f46); if ((x - x0) % 7 === 3) P.px(x, yy + 2, [0xd9433b, 0xffd23f, 0x3a7bd5][((x - x0) / 7 | 0) % 3]); }
  } else { ball5(P, bx + 3, 10); ball5(P, bx + bw - 8, 10); }
  // räcket på plan 2 (glas + ledstång)
  for (let y = yTop - 12; y < yTop; y++) for (let x = x0 + 2; x < x1; x++) P.px(x, y, 0xcfe8f0, 0.3);
  P.hl(x0 + 2, yTop - 13, x1 - x0 - 2, 0x2a2a30); P.hl(x0 + 2, yTop - 12, x1 - x0 - 2, 0xc9a86a);
  for (let x = x0 + 4; x < x1; x += 20) P.vl(x, yTop - 11, 11, 0x9aa0a8);
  // bjälken (vit med guldlist) + skylt
  for (let y = yTop; y < yBot; y++) for (let x = x0; x < x1; x++) {
    let c = y === yTop ? 0xfbf8f0 : y === yBot - 1 ? 0x6a6660 : mix(0xefe9dc, 0xd6cfc0, (y - yTop) / 10);
    if (y === yTop + 2 || y === yTop + 8) c = 0xd8b24a;
    P.px(x, y, c);
  }
  P.vl(x0, yTop, 10, 0x4a4650);
  const t2 = jul ? $t('PLAN 3') : $t('PLAN 2');
  text(P, SMALL, t2, x0 + 8, yTop + 3, 0x6d4a10);
  arrowUp(P, x0 + 8 + textW(SMALL, t2) + 5, yTop + 5, 0xd9434b);
  // skugga på väggen under bjälken
  for (let y = yBot; y < yBot + 8; y++) for (let x = x0; x < x1; x++) if (bayer(x, y) < 1 - (y - yBot) / 8) P.px(x, y, 0x1a1426, 0.28);
}
// pilar 5×5 (mitt i cx, cy)
const ARROW_UP = ['..#..', '.###.', '#.#.#', '..#..', '..#..'];
export function arrowUp(P, cx, cy, c) { ARROW_UP.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') P.px(cx - 2 + i, cy - 2 + j, c); }); }
export function arrowDown(P, cx, cy, c) { ARROW_UP.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') P.px(cx - 2 + i, cy + 2 - j, c); }); }
// liten fotboll 5×5
function ball5(P, x, y) {
  ['.www.', 'wkwkw', 'wwkww', 'wkwkw', '.www.'].forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] !== '.') P.px(x + i, y + j, r[i] === 'k' ? 0x26242c : 0xf4f1ea); });
}

// ================= trappan =================
// stegets nummer vid d (0 = det plana första steget) och fötternas y
export const stepOf = (d) => (d < STAIR.FLAT ? 0 : 1 + Math.floor((d - STAIR.FLAT) / STAIR.STEP));
export function stairPos(e, d) {
  const dd = Math.max(0, d);
  return [e.lx + e.sx * d, e.ly + e.sy * STAIR.RISE * stepOf(dd)];
}
const visibleAt = (e, y) => (e.sy < 0 ? y >= e.clip : y < e.clip);
// Räckets/vangstyckets jämna linje genom stegens framkanter (ingen trappstegsform)
export function stairLine(e, d) {
  return e.ly + e.sy * STAIR.RISE * Math.max(0, (d - STAIR.FLAT + STAIR.STEP) / STAIR.STEP);
}
// Trappan i tre lager: vägglisten bakom, stegen (ek, vita sättsteg) och framsidan – vangstycket
// med glasräcke och mässingsledstång, och på plan 1 beklädnaden ner till golvet med en liten
// förrådsdörr under trappan. Figurerna i trappan ritas mellan stegen och framsidan.
export function stairArt(e) {
  const xs = [e.lx - e.sx * 14, e.lx + e.sx * (e.run + 2)];
  const x0 = Math.min(...xs) - 2, x1 = Math.max(...xs) + 2;
  const far = stairPos(e, e.run);
  const yTop = Math.floor(Math.min(e.ly, far[1]) - 24), yBot = Math.ceil(Math.max(e.ly, far[1]) + 14);
  const W = x1 - x0, Hh = yBot - yTop;
  const mk = () => new Pix(W, Hh, x0, yTop);
  const back = mk(), steps = mk(), front = mk();
  const put = (P, x, y, c, a = 1) => { if (visibleAt(e, y)) P.px(x, y, c, a); };
  const floorLine = e.ly + 3;
  const OAK = 0xdcae70, OAK_HI = 0xf0cc94, OAK_LO = 0xb07e46, RISER = e.sy < 0 ? 0xf4eee2 : 0xb89a78;
  const door = e.sy < 0 ? [92, 104] : null; // förrådsdörren under trappan (d-intervall)
  for (let d = -3; d <= e.run; d++) {
    const x = Math.round(e.lx + e.sx * d);
    const k = stepOf(Math.max(0, d)), y = e.ly + e.sy * STAIR.RISE * k;
    const yNext = e.ly + e.sy * STAIR.RISE * stepOf(Math.max(0, d + 1));
    const line = Math.round(stairLine(e, d));
    const inStep = d < STAIR.FLAT ? d - STAIR.FLAT : (d - STAIR.FLAT) % STAIR.STEP;
    // vägglisten bakom stegen
    if (d >= 0) { put(back, x, y - 7, 0x6a4a2a); put(back, x, y - 8, 0x8a6a44); }
    // stegets ovansida: bakkant mörk, framkant (nosen) ljus – ådring här och där
    for (let yy = y - 6; yy <= y + 2; yy++) {
      let c = yy === y - 6 ? OAK_LO : yy >= y + 1 ? OAK_HI : OAK;
      if (yy > y - 6 && yy < y + 1 && hash(x >> 1, yy, 5) > 0.86) c = mul(c, 0.94);
      if (inStep === 0 && d >= STAIR.FLAT && yy > y - 6) c = mix(c, OAK_HI, 0.5);
      put(steps, x, yy, c);
    }
    // sättsteget där nästa steg ligger högre/lägre
    if (yNext !== y) {
      const a = Math.min(y, yNext), b = Math.max(y, yNext);
      for (let yy = a - 6; yy < b - 6; yy++) put(steps, x, yy, RISER);
      put(steps, x, b - 7, mul(RISER, 0.8));
    }
    if (d < 0) continue;
    // räcket: glas, stolpar och ledstång i mässing längs den jämna linjen
    for (let yy = line - 12; yy <= line; yy++) put(front, x, yy, 0xd8eef6, 0.16);
    if (d % 12 === 4) for (let yy = line - 12; yy <= line; yy++) put(front, x, yy, 0x9aa0a8);
    put(front, x, line - 14, 0x3a2a14); put(front, x, line - 13, 0xe8c25a);
    // vangstycket (framsidan) – en rak ljus list
    put(front, x, line + 1, 0xfbf8f0); put(front, x, line + 2, 0xd8cfbe); put(front, x, line + 3, 0x7a6a58);
    if (e.sy < 0) {
      // beklädnaden under trappan ner till golvet: paneler, mörkare in mot taket
      for (let yy = line + 4; yy < floorLine; yy++) {
        let c = mix(0xeee4d0, 0xd2c4aa, (yy - line) / 70 + d / 400 + (bayer(x, yy) - 0.5) * 0.08);
        if (((x - e.lx) % 20 + 20) % 20 === 0) c = mul(c, 0.9);
        else if (((x - e.lx) % 20 + 20) % 20 === 1) c = mix(c, 0xffffff, 0.2);
        if (yy === floorLine - 3) c = mul(c, 0.86);
        if (door && d >= door[0] && d <= door[1] && yy >= floorLine - 25) {
          const dx = d - door[0], dy = yy - (floorLine - 25);
          c = dx === 0 || dx === door[1] - door[0] || dy === 0 ? 0x5a3e24 : mix(0x9a6a3e, 0x7a5230, dy / 25);
          if (dx === door[1] - door[0] - 2 && dy === 13) c = 0xe8c25a; // handtaget
          if ((dx === 3 || dx === 9) && dy > 3 && dy < 22) c = mul(c, 0.9);
        }
        put(front, x, yy, c);
      }
      put(front, x, floorLine, 0x000000, 0.25);
    }
  }
  // gavelns kant där trappan når taket (plan 1)
  if (e.sy < 0) { const xe = Math.round(e.lx + e.sx * e.run); for (let yy = e.clip; yy < floorLine; yy++) { put(front, xe, yy, 0x9a8e7a); put(front, xe + e.sx, yy, 0x6a5e4e); } }
  // skylt på beklädnaden (plan 1): TRAPPA UPP · PLAN 2 (under trappans höga del, före förrådsdörren)
  if (e.sy < 0) {
    const lbl1 = $t('TRAPPA UPP'), lbl2 = e.sign === 'jul' ? $t('PLAN 3 - JUL') : e.n === 1 ? $t('PLAN 2 + JUL') : $t`PLAN ${e.to || 2}`;
    const w = Math.max(textW(SMALL, lbl1), textW(SMALL, lbl2) + 8) + 10, cx = Math.round(e.lx + e.sx * 68), y0 = e.ly - 19;
    const [bg, dk, hi, fg] = e.sign === 'jul' ? [0x1e5a32, 0x0e2a18, 0xd9433b, 0xffe070] : [0x7a1f2e, 0x3a0d16, 0xd9434b, 0xffd0d8];
    front.rect(cx - w / 2 + 1, y0 + 1, w, 18, 0x000000, 0.2);
    front.rect(cx - w / 2, y0, w, 18, bg); front.box(cx - w / 2, y0, w, 18, dk); front.hl(cx - w / 2 + 1, y0 + 1, w - 2, hi);
    text(front, SMALL, lbl1, cx - textW(SMALL, lbl1) / 2, y0 + 3, 0xffffff);
    text(front, SMALL, lbl2, cx - textW(SMALL, lbl2) / 2 + 4, y0 + 10, fg);
    arrowUp(front, cx - textW(SMALL, lbl2) / 2 - 3, y0 + 12, fg);
  }
  return { x: x0, y: yTop, w: W, h: Hh, back: back.flush(), steps: steps.flush(), front: front.flush() };
}
// främre räcket vid schaktets framkant på plan 2 (ritas framför dem som går ner)
export function pitFrontImg(w) {
  const P = new Pix(w, 16);
  for (let y = 1; y < 13; y++) for (let x = 0; x < w; x++) P.px(x, y, 0xd8eef6, 0.22);
  for (let x = 0; x < w; x += 20) P.vl(x, 1, 12, 0x9aa0a8);
  P.vl(w - 1, 1, 12, 0x9aa0a8);
  P.hl(0, 0, w, 0x3a2a14); P.hl(0, 1, w, 0xd8b24a);
  P.hl(0, 13, w, 0xfbf8f0); P.hl(0, 14, w, 0x9a968e); P.hl(0, 15, w, 0x000000, 0.2);
  return P.flush();
}
// Schaktet i golvet på plan 2 (målas på bakgrunden): schaktets vägg som mörknar nedåt, nedre
// trapploppet som en skuggad siluett, en ledstång på väggen, plan 1:s rosa golv längst ner och
// räcken bak och till vänster
export function paintPit(P, x0, x1, yb, yl) {
  for (let y = yb; y < yl; y++) for (let x = x0; x < x1; x++) {
    const t = (y - yb) / (yl - yb);
    let c = mix(0xdccfb8, 0x4a3e44, Math.min(1, t * 1.2));
    if (((x - x0) % 24) === 0) c = mul(c, 0.9);
    // nedre trapploppet: steg som sjunker åt vänster, längre ner i schaktet
    const u = x1 - x, st = yb + 9 + Math.floor(u / 6) * 2;
    if (y >= st) {
      c = mix(c, (y - st) < 1 ? 0xb08a60 : 0x3a2e30, (y - st) < 1 ? 0.6 : 0.5);
      if (u % 6 === 0 && y < st + 3) c = mul(c, 0.8);
    }
    // ledstången på schaktets vägg
    if (y === yb + 5 + Math.floor(u / 6) * 2 - 6 && y > yb + 2) c = 0xd8b24a;
    if (t > 0.78) c = mix(c, hash(x >> 3, y >> 2, 77) > 0.5 ? 0xd9b0bc : 0xc8a0ae, 0.4); // plan 1:s rosa golv därnere
    if (y < yb + 2) c = y === yb ? 0xfbf8f0 : 0x7a6a58;
    P.px(x, y, c);
  }
  for (let y = yb - 12; y < yb; y++) for (let x = x0; x < x1; x++) P.px(x, y, 0xcfe8f0, 0.26);
  P.hl(x0, yb - 13, x1 - x0, 0x3a2a14); P.hl(x0, yb - 12, x1 - x0, 0xd8b24a);
  for (let x = x0; x < x1; x += 20) P.vl(x, yb - 11, 11, 0x9aa0a8);
  for (let y = yb - 12; y < yl; y++) P.px(x0 - 1, y, 0x9aa0a8);
  for (let y = yb; y < yl; y++) { P.px(x0, y, 0xd8d4cc); P.px(x0 + 1, y, 0xb8b4ac); }
}

// ================= plan 2: SPORT & FOTBOLL =================
export function paintFloor2() {
  const W = W2, P = new Pix(W, H);
  // Kungsladugård: vinröd vägg med tunna ljusa ränder
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < KUNGS_X1; x++) {
    let c = x % 10 === 0 ? 0x86283a : 0x6e1a28;
    if (x % 10 === 1) c = 0x5e1622;
    P.px(x, y, mix(c, 0x000000, (bayer(x, y) - 0.5) * 0.08));
  }
  // trapphallen: ljus betong
  for (let y = 0; y < WALL_Y; y++) for (let x = KUNGS_X1; x < LAG_X0; x++) {
    let c = mix(0xd8d4cc, 0xc8c2b8, hash(x >> 2, y >> 2, 51) * 0.5 + (bayer(x, y) - 0.5) * 0.2);
    if ((y % 22) === 21 || ((x - KUNGS_X1) % 44) === 43) c = mul(c, 0.9);
    P.px(x, y, c);
  }
  // kända lag: läktarmålning (publik, strålkastare) ovanför en grön list
  paintStadium(P, LAG_X0, SPORT_MOD_X[0] - 6);
  for (let y = 0; y < WALL_Y; y++) for (let x = SPORT_MOD_X[0] - 6; x < W; x++) {
    const r = y % 6;
    let c = r === 5 ? 0x22262e : r === 0 ? 0x4a505c : 0x3a3f4a;
    P.px(x, y, mix(c, 0x000000, (bayer(x, y) - 0.5) * 0.06));
  }
  wainscot(P, [[0, KUNGS_X1, 0xf4ece6, 0xd9434b], [KUNGS_X1, LAG_X0, 0x5a5a64, 0x3a3a44], [LAG_X0, W, 0x2e6b40, 0x6fd08a]]);
  spots(P, 0, W, [[STAIRS2.pit[0] - 10, STAIRS2.pit[1] + 10]]);
  for (const px of [KUNGS_X1, LAG_X0]) pillar(P, px);

  // ===== Kungsladugård: lagfotot, skylten, matchtröjan, halsdukar, fotbollsskorna =====
  paintTeamPhoto(P, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
  const lp = $t('LAGET 2026'), lpw = textW(SMALL, lp) + 8, lpx = Math.round(PHOTO.x + PHOTO.w / 2 - lpw / 2);
  P.rect(lpx, PHOTO.y + PHOTO.h + 1, lpw, 9, 0xd8b24a); P.box(lpx, PHOTO.y + PHOTO.h + 1, lpw, 9, 0x8a6a1a); P.hl(lpx + 1, PHOTO.y + PHOTO.h + 2, lpw - 2, 0xf0d890);
  text(P, SMALL, lp, lpx + 4, PHOTO.y + PHOTO.h + 3, 0x3a2a08);
  deptSign(P, 'kungs', 286, 4);
  paintFlatJersey(P, 150, 25, 0x7a1f2e, 0xd9434b);
  paintScarf(P, 206, 38, 164, $t('HEJA KUNGSLADUGÅRD'));
  paintPennant(P, 392, 30);
  paintShoeWall(P, SHOEWALL.x, SHOEWALL.w);
  // ===== trapphallen =====
  const hc = (KUNGS_X1 + LAG_X0) / 2;
  const t1 = $t('PLAN 2');
  P.rect(hc - 36, 8, 72, 18, 0x2a2a34); P.box(hc - 36, 8, 72, 18, 0xffd23f);
  glowText(P, BIG, t1, hc - textW(BIG, t1) / 2, 14, 0xffd23f, 0xe07a2e);
  const t2 = $t('TRAPPA NER');
  const [ax0] = sign(P, (STAIRS2.pit[0] + STAIRS2.pit[1]) / 2, 36, t2, 0x17151a, 0xd9434b, 0xffffff);
  arrowDown(P, ax0 - 5, 40, 0xd9434b);
  // en hylla med pokaler
  paintTrophies(P, 580, 34);
  // ===== kända lag =====
  deptSign(P, 'lag', 990, 4);
  // ===== golv =====
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    let c;
    if (x < KUNGS_X1) c = mix(0x5a5a64, 0x50505a, hash(x >> 1, y >> 1, 61) * 0.6 + (bayer(x, y) - 0.5) * 0.2); // gummigolv
    else if (x < LAG_X0) {
      c = mix(0x6f8fa8, 0x668aa2, hash(x >> 1, y >> 1, 63) * 0.5 + (bayer(x, y) - 0.5) * 0.15);
      if (y === 196 || (x === 700 && y > 150)) c = 0xf0f0e8;
    } else {
      c = plank(x, y, 0xe0b878, 71, 6, 48); // sporthallens lönngolv
      if (y === 196 || y === 90 || (x === 1060 && y > 90)) c = x % 4 < 3 ? 0x3a7bd5 : c;
    }
    P.px(x, y, c);
  }
  // konstgräset under laget, med hörnet av en planhalva
  turf(P, 8, 84, 540, 118, 81, [[8, 190, 548, 190], [470, 84, 470, 190], [400, 84, 400, 130], [400, 130, 470, 130]]);
  // läktarsteg under dockraderna
  for (const [yy, n, x0] of [[104, 10, 12], [166, 9, 31]]) {
    P.rect(x0, yy - 4, n * 38, 10, 0x7a1f2e); P.hl(x0, yy - 4, n * 38, 0xa3485a); P.hl(x0, yy + 5, n * 38, 0x3a0d16);
    for (let x = x0 + 4; x < x0 + n * 38; x += 38) P.hl(x, yy - 2, 30, 0x8a2a3a, 0.5);
  }
  // lilla provplanen med målet
  turf(P, PITCH.x0, PITCH.y0, PITCH.x1 - PITCH.x0, PITCH.y1 - PITCH.y0, 83, [[PITCH.x0 + 4, PITCH.y0 + 30, PITCH.x1 - 4, PITCH.y0 + 30]]);
  // schaktet för trappan
  const [p0, p1, pb, pl] = STAIRS2.pit;
  paintPit(P, p0, p1, pb, pl);
  paintJulHall(P, JULHALL_X0, W);
  // skugga längs väggen + ljuspölar
  for (let i = 0; i < 5; i++) P.darken(0, WALL_Y + i, W, 1, 0.8 + i * 0.04);
  for (const p of KUNGS_POS) P.ell(p.x, p.y + 1, 16, 6, 0xfff6e0, 0.2, 4);
  for (const p of TEAM_POS) P.ell(p.x, p.y + 1, 16, 6, 0xfff6e0, 0.24, 4);
  for (const px of [KUNGS_X1, LAG_X0, JULHALL_X0]) { P.rect(px - 1, WALL_Y, 2, H - WALL_Y, 0xd8b24a); P.vl(px - 1, WALL_Y, H - WALL_Y, 0xf0d890); }
  P.box(0, 0, W, H, 0x0e0d12);
  return P.flush();
}
// Trapphallen upp till julvåningen (plan 2, x0–x1): mörkgrön vägg med guldstjärnor, en girlang
// längs taket, takkanten med plan 3 som skymtar, en röd löpare fram till trappan och två små granar
export function paintJulHall(P, x0, x1) {
  const STAR = ['..#..', '.###.', '#####', '.#.#.'];
  for (let y = 0; y < WALL_Y; y++) for (let x = x0; x < x1; x++) P.px(x, y, mix(0x1e4a2e, 0x173d26, hash(x >> 2, y >> 2, 91) * 0.5 + (bayer(x, y) - 0.5) * 0.2));
  for (let y = 10; y < 56; y += 14) for (let x = x0 + 6; x < x1 - 6; x += 18) {
    const ox = x + (((y / 14) | 0) % 2 ? 9 : 0);
    STAR.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') P.px(ox + i, y + j, 0xe8c25a, 0.55); });
  }
  wainscot(P, [[x0, x1, 0x6a3a22, 0xc9a24a]]);
  pillar(P, x0);
  const [s0, s1] = STAIRS2UP.slab;
  paintSlab(P, s0, s1, STAIRS2UP.clip, true);
  // girlangen längs taket (utanför takkanten)
  for (let x = x0 + 6; x < s0 - 2; x++) { const yy = 6 + Math.round(Math.abs(Math.sin((x - x0) / 8)) * 3); P.px(x, yy, 0x1e5a32); P.px(x, yy + 1, 0x2f8f46); P.px(x, yy + 2, 0x1e5a32, 0.6); }
  // golvet: mörkt trä med en röd löpare fram till trappan
  for (let y = WALL_Y; y < H; y++) for (let x = x0; x < x1; x++) {
    let c = plank(x, y, 0x8a5a3a, 93, 6, 40);
    const inRun = x >= STAIRS2UP.lx - 24 && x < STAIRS2UP.lx + 4 && y > STAIRS2UP.ly;
    if (inRun) c = (x === STAIRS2UP.lx - 24 || x === STAIRS2UP.lx + 3) ? 0xe8c25a : mix(0xb02a30, 0x8a1e26, hash(x >> 1, y >> 1, 95) * 0.6);
    P.px(x, y, c);
  }
  // två små granar i krukor framme vid kanten
  for (const gx of [x0 + 40, x1 - 22]) {
    for (let j = 0; j < 22; j++) { const w = Math.round(j * 0.45) + 1; for (let i = -w; i <= w; i++) P.px(gx + i, 178 + j, (i + j) % 5 === 0 ? 0x2f8f46 : i < 0 ? 0x1e6a3a : 0x17502c); }
    P.px(gx, 176, 0xffd23f); P.px(gx - 1, 177, 0xffd23f); P.px(gx + 1, 177, 0xffd23f); P.px(gx, 177, 0xfff0b0);
    P.rect(gx - 5, 200, 11, 8, 0xc9323a); P.hl(gx - 5, 200, 11, 0xff7a6b); P.hl(gx - 5, 207, 11, 0x5e0c0c);
  }
}

// Läktarmålningen: tre bänkrader publik i lagfärger, strålkastare och en grön planlist
function paintStadium(P, x0, x1) {
  for (let y = 0; y < WALL_Y; y++) for (let x = x0; x < x1; x++) {
    let c;
    if (y < 14) c = mix(0x1a2240, 0x2a3a64, y / 14);
    else if (y < 50) {
      const row = ((y - 14) / 6) | 0, ry = (y - 14) % 6;
      c = ry === 5 ? 0x3a3f4a : 0x565c68;
      // publiken: små huvuden och tröjor
      const col = ((x + row * 3) / 4) | 0, px = (x + row * 3) % 4;
      const h = hash(col, row, 91);
      if (ry >= 1 && ry <= 4 && px < 3 && h > 0.18) {
        const shirts = [0xd9434b, 0xf4f1ea, 0x3a7bd5, 0xf0c93a, 0x46a35a, 0x1d1d22, 0x7a1f2e, 0x8ec8ef];
        const skins = [0xf6d7bf, 0xe0a97f, 0xc68a5c, 0x744a2d];
        c = ry <= 2 ? (px === 1 || ry === 2 ? skins[(h * 97 | 0) % 4] : [0x3b2619, 0x1d1714, 0xd9a95c][(h * 31 | 0) % 3]) : shirts[(h * 53 | 0) % shirts.length];
        if (ry === 1 && px !== 1) c = [0x3b2619, 0x1d1714, 0xd9a95c, 0x6b4226][(h * 13 | 0) % 4];
      }
    } else c = y < 53 ? 0xf4f1ea : mix(0x3f9a4a, 0x46a652, ((x / 10) | 0) % 2);
    P.px(x, y, c);
  }
  // strålkastarmaster
  for (const lx of [x0 + 26, x1 - 30]) {
    P.vl(lx, 4, 10, 0x8a8e9a);
    P.rect(lx - 6, 1, 13, 5, 0x2a2a34);
    for (let i = 0; i < 4; i++) P.rect(lx - 5 + i * 3, 2, 2, 3, 0xfff6c8);
    P.ell(lx, 6, 22, 12, 0xfff6dc, 0.14, 4);
  }
}

// Pixel-lagfotot: tjejerna i två rader (stående bak, sittande på bänken fram) på konstgräs,
// med mål och träd bakom. Små figurer – nummer och namn syns inte, bara glädjen.
function paintTeamPhoto(P, x0, y0, w, h) {
  // ram
  P.rect(x0, y0, w, h, 0x2a1a10); P.box(x0 + 1, y0 + 1, w - 2, h - 2, 0xd8b24a); P.box(x0 + 2, y0 + 2, w - 4, h - 4, 0x6b4a28);
  const ix = x0 + 3, iy = y0 + 3, iw = w - 6, ih = h - 6;
  P.clip(ix, iy, ix + iw, iy + ih);
  for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
    let c;
    if (y < 14) c = mix(0x9cc8e8, 0xd8ecf4, y / 14);
    else c = mix(((x / 7) | 0) % 2 ? 0x3f9a4a : 0x49a655, 0x2f7a3a, (y - 14) / (ih - 14) * 0.3);
    P.px(ix + x, iy + y, c);
  }
  // träd bakom
  for (let i = 0; i < 9; i++) {
    const tx = ix + 4 + i * 13 + ((hash(i, 2, 7) * 6) | 0), ty = iy + 9 + ((hash(i, 3, 7) * 3) | 0), r = 5 + ((hash(i, 4, 7) * 3) | 0);
    disc(P, tx, ty, r, r - 1, i % 2 ? 0x2f6a34 : 0x3a7a3e);
    disc(P, tx - 1, ty - 1, r - 2, r - 3, 0x4f9150);
  }
  P.hl(ix, iy + 14, iw, 0x2a5a30);
  // målet (vita stolpar + nät)
  const gx0 = ix + 22, gx1 = ix + iw - 22, gy0 = iy + 8, gy1 = iy + 22;
  for (let y = gy0 + 1; y < gy1; y++) for (let x = gx0 + 1; x < gx1; x++) if ((x - gx0) % 3 === 0 || (y - gy0) % 3 === 0) P.px(x, y, 0xe8ecef, 0.55);
  P.hl(gx0, gy0, gx1 - gx0 + 1, 0xffffff); P.vl(gx0, gy0, gy1 - gy0, 0xffffff); P.vl(gx1, gy0, gy1 - gy0, 0xffffff);
  // bänken
  const by = iy + 36;
  P.rect(ix + 6, by, iw - 12, 2, 0x9a6a3a); P.hl(ix + 6, by, iw - 12, 0xc08a50); P.rect(ix + 6, by + 2, iw - 12, 1, 0x5a3a1e);
  for (const lx of [ix + 8, ix + iw / 2, ix + iw - 10]) P.vl(lx, by + 3, 5, 0x5a3a1e);
  // tjejerna
  const SK = [0xf6d7bf, 0xeec3a0, 0xe0a97f, 0xc68a5c, 0xa06a43, 0x744a2d];
  const HR = [0x3b2619, 0xd9a95c, 0x1d1714, 0x6b4226, 0xecd489, 0xa5692f];
  const SHOE = CLEATS.map((c) => parseInt(c.shoes.slice(1), 16));
  const kid = (cx, top, sit, i) => {
    const sk = SK[(hash(i, 1, 13) * SK.length) | 0], hr = HR[(hash(i, 2, 13) * HR.length) | 0];
    // hår + huvud (3×3), hästsvans åt sidan ibland
    P.rect(cx - 1, top, 3, 1, hr); P.rect(cx - 1, top + 1, 3, 2, sk); P.px(cx - 1, top + 1, hr); P.px(cx + 1, top + 1, hr);
    if (hash(i, 3, 13) > 0.5) P.px(cx + 2, top + 1, hr); else P.px(cx - 2, top + 1, hr);
    // tröjan (vinröd, ljusröda ärmslut)
    P.rect(cx - 2, top + 3, 5, 4, 0x7a1f2e); P.px(cx - 2, top + 5, 0xd9434b); P.px(cx + 2, top + 5, 0xd9434b);
    P.px(cx, top + 3, 0xd9434b);
    if (sit) {
      P.rect(cx - 2, top + 7, 5, 1, 0x1d1d22); // shorts på bänken
      P.px(cx - 1, top + 8, sk); P.px(cx + 1, top + 8, sk);
      P.rect(cx - 1, top + 9, 1, 2, 0x1d1d22); P.rect(cx + 1, top + 9, 1, 2, 0x1d1d22); P.px(cx - 1, top + 9, 0xf4f1ea); P.px(cx + 1, top + 9, 0xf4f1ea);
      const s = SHOE[(hash(i, 4, 13) * SHOE.length) | 0];
      P.px(cx - 1, top + 11, s); P.px(cx + 1, top + 11, s); P.px(cx - 2, top + 11, s); P.px(cx + 2, top + 11, s);
    } else {
      P.rect(cx - 2, top + 7, 5, 2, 0x1d1d22);
      P.px(cx - 1, top + 9, sk); P.px(cx + 1, top + 9, sk);
    }
  };
  // hela laget: 19 spelare (KUNGS_PLAYERS) – tio står bak, nio sitter på bänken, förskjutna en halv plats
  for (let i = 0; i < 10; i++) kid(ix + 11 + i * 10, iy + 17, false, i);         // bakre raden står
  for (let i = 0; i < 9; i++) kid(ix + 16 + i * 10, iy + 28, true, i + 20);      // främre raden sitter på bänken
  // en boll framför laget
  P.rect(ix + iw / 2 - 1, iy + ih - 4, 3, 3, 0xf4f1ea); P.px(ix + iw / 2, iy + ih - 3, 0x26242c);
  // blänk i glaset
  for (let i = 0; i < 10; i++) P.px(ix + 4 + i, iy + 2 + i, 0xffffff, 0.25);
  P.clip();
}

// En platt matchtröja i ram (framifrån): tröjfärg c, ärmslut/krage a, litet generiskt märke
function paintFlatJersey(P, x, y, c, a) {
  const w = 44, h = 32;
  P.rect(x, y, w, h, 0x17151a); P.rect(x + 1, y + 1, w - 2, h - 2, 0xf4ece6);
  const cx = x + w / 2;
  const hi = mix(c, 0xffffff, 0.18), lo = mul(c, 0.78), ink = 0x2a0a12;
  // ärmar
  for (let j = 0; j < 8; j++) { P.hl(cx - 16 + j * 0, y + 6 + j, 6, j > 5 ? a : c); P.hl(cx + 10, y + 6 + j, 6, j > 5 ? a : lo); }
  // bål
  P.rect(cx - 10, y + 5, 20, 22, c); P.vl(cx - 10, y + 5, 22, hi); P.vl(cx + 9, y + 5, 22, lo);
  // v-krage i detaljfärgen
  for (let j = 0; j < 4; j++) { P.px(cx - 3 + j, y + 5 + j, a); P.px(cx + 2 - j, y + 5 + j, a); }
  P.rect(cx - 2, y + 5, 4, 1, 0xf4ece6);
  // litet sköldmärke (gult/rött, inget riktigt klubbmärke)
  P.rect(cx + 3, y + 10, 4, 4, 0xf0c93a); P.px(cx + 4, y + 11, 0xd9434b); P.px(cx + 5, y + 12, 0xd9434b); P.px(cx + 3, y + 13, c); P.px(cx + 6, y + 13, c);
  // konturer
  P.hl(cx - 16, y + 5, 6, ink); P.hl(cx + 10, y + 5, 6, ink); P.vl(cx - 17, y + 6, 8, ink); P.vl(cx + 16, y + 6, 8, ink);
  P.hl(cx - 10, y + 27, 20, ink);
  // hängare i ramens överkant
  P.hl(cx - 6, y + 3, 12, 0x8a8e9a); P.vl(cx, y + 1, 2, 0x8a8e9a);
}
// Halsduk uppspänd på väggen: vinröda och vita block, text i mitten, fransar i ändarna
function paintScarf(P, x, y, w, lbl) {
  const h = 9;
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
    const end = i < 14 || i >= w - 14, band = ((i < 14 ? i : w - 1 - i) / 5 | 0) % 2;
    let c = end ? (band ? 0xf4f1ea : 0x7a1f2e) : 0x7a1f2e;
    if (j === 0 || j === h - 1) c = end ? mul(c, 0.85) : 0xd9434b;
    if (!end && (j === 1 || j === h - 2)) c = 0x5e1622;
    P.px(x + i, y + j + (i % 30 < 15 ? 0 : 0), c);
  }
  for (let j = 0; j < h; j += 2) { P.hl(x - 3, y + j, 3, 0xf4f1ea); P.hl(x + w, y + j, 3, 0xf4f1ea); }
  // krokar som håller halsduken
  for (const hx of [x + 16, x + w - 17]) { P.px(hx, y - 2, 0x8a8e9a); P.px(hx, y - 1, 0x8a8e9a); }
  text(P, SMALL, lbl, x + Math.round((w - textW(SMALL, lbl)) / 2), y + 2, 0xffffff);
}
// Vimpel (triangel) på en pinne: vinröd med vit kant och en boll
function paintPennant(P, x, y) {
  P.hl(x - 2, y, 30, 0x6b4a28); P.hl(x - 2, y + 1, 30, 0x4a3018);
  for (let j = 0; j < 26; j++) {
    const w = Math.max(1, 26 - j);
    for (let i = 0; i < w; i++) {
      const edge = i === 0 || i === w - 1 || j === 0;
      P.px(x + 1 + Math.floor((26 - w) / 2) + i, y + 2 + j, edge ? 0xf4f1ea : j < 4 ? 0xd9434b : 0x7a1f2e);
    }
  }
  ball5(P, x + 12, y + 8);
}
// Pokalhyllan i trapphallen
function paintTrophies(P, x, y) {
  P.rect(x, y + 20, 60, 2, 0xc9a06b); P.hl(x, y + 20, 60, 0xe8c890); P.hl(x, y + 22, 60, 0x7a5a38);
  const cups = [[x + 8, 12], [x + 24, 18], [x + 42, 14]];
  for (const [cx, hh] of cups) {
    const top = y + 20 - hh;
    P.rect(cx - 3, y + 17, 7, 3, 0x5a4020); P.hl(cx - 3, y + 17, 7, 0x8a6a40);
    P.vl(cx, top + 7, y + 17 - top - 7, 0xd8b24a);
    P.rect(cx - 3, top, 7, 7, 0xe8c24a); P.vl(cx - 3, top, 7, 0xfff0a0); P.vl(cx + 3, top, 7, 0xa87a1a);
    P.px(cx - 4, top + 1, 0xd8b24a); P.px(cx - 5, top + 2, 0xd8b24a); P.px(cx + 4, top + 1, 0xd8b24a); P.px(cx + 5, top + 2, 0xd8b24a);
  }
}

// Fotbollsskoväggen: skylt och två snedställda hyllor (skorna ritas levande ovanpå)
export const SHOE_SPOTS = CLEATS.map((c, i) => ({ c, x: SHOEWALL.x + 14 + (i < 3 ? i * 36 : 18 + (i - 3) * 36), y: i < 3 ? 34 : 54 }));
function paintShoeWall(P, x, w) {
  P.rect(x, 6, w, WALL_Y - 12 - 6, 0x3a2a30); P.box(x, 6, w, WALL_Y - 12 - 6, 0x1d1418);
  for (let y = 9; y < WALL_Y - 13; y += 4) for (let xx = x + 3; xx < x + w - 2; xx += 4) P.px(xx, y, 0x2a1e22);
  const lbl = $t('FOTBOLLSSKOR');
  P.rect(x + 4, 8, w - 8, 10, 0x17151a); P.hl(x + 4, 17, w - 8, 0xd9434b);
  text(P, SMALL, lbl, x + Math.round((w - textW(SMALL, lbl)) / 2), 10, 0xffd23f);
  for (const yy of [35, 55]) { P.rect(x + 4, yy, w - 8, 2, 0xc9ccd6); P.hl(x + 4, yy, w - 8, 0xf2f2f6); P.hl(x + 4, yy + 2, w - 8, 0x6d717c); }
}
// En fotbollssko i profil (16×9): b färg, h glans, s rand/snören (shoes2), d sula, m dobbar, k kontur
const CLEAT = [
  '........kkkkk...',
  '.......khhbbbk..',
  '......khbsbsbbk.',
  'kkkkkkkbbbbbbbk.',
  'khhhhbbbbbbbbbbk',
  'kbbbbbsssbbbbbbk',
  'kbbbbbbbbbbbbbbk',
  'kddddddddddddddk',
  '.mm..mm...mm..m.',
];
const cleatCache = new Map();
export function cleatImg(c) {
  if (cleatCache.has(c.id)) return cleatCache.get(c.id);
  const b = parseInt(c.shoes.slice(1), 16), s = parseInt(c.shoes2.slice(1), 16);
  const pal = { k: 0x1d1822, b, h: mix(b, 0xffffff, 0.35), s, d: mul(b, 0.45), m: 0xb8bcc6 };
  if (b < 0x303030) { pal.h = 0x4a4852; pal.d = 0x111016; }
  const P = new Pix(16, 9);
  CLEAT.forEach((row, j) => { for (let i = 0; i < 16; i++) if (row[i] !== '.') P.px(i, j, pal[row[i]]); });
  const img = P.flush();
  cleatCache.set(c.id, img);
  return img;
}

// ================= fristående bilder =================
export function podiumImg(key) {
  const P = new Pix(24, 12);
  const top = { tjej: 0xf7eef3, kille: 0x4a5568, kungs: 0x8a2a3a, lag: 0x2e6b40, jul: 0xf4f1ea }[key] ?? 0xf7eef3;
  const side = { tjej: 0xe7a9c8, kille: 0x2c3444, kungs: 0x5a1622, lag: 0x1e4a2c, jul: 0xc9323a }[key] ?? 0xe7a9c8;
  const trim = { tjej: 0xc65fa0, kille: 0x3fc4ff, kungs: 0xd9434b, lag: 0x9fe88a, jul: 0xe8c25a }[key] ?? 0xc65fa0;
  for (let x = 0; x < 24; x++) {
    const dx = (x + 0.5 - 12) / 11.5;
    if (Math.abs(dx) >= 1) continue;
    const e = Math.sqrt(1 - dx * dx) * 3.5;
    const y0 = Math.round(3.5 - e), y1 = Math.round(3.5 + e);
    for (let y = y0; y <= y1 + 5; y++) {
      let c;
      if (y <= y1) c = y === y0 ? mix(top, 0xffffff, 0.35) : top;
      else if (y === y1 + 1) c = trim;
      else c = mix(side, 0x000000, (y - y1) * 0.04 + (dx > 0.4 ? 0.12 : dx < -0.6 ? -0.05 : 0));
      if (y === y1 + 5) c = mul(side, 0.6);
      P.px(x, y, c);
    }
  }
  P.hl(6, 2, 4, mix(top, 0xffffff, 0.6));
  return P.flush();
}
export function glowImg() { const P = new Pix(40, 16); P.ell(20, 8, 19, 7, 0xfff0a0, 0.8, 4); return P.flush(); }
export function plantImg() {
  const P = new Pix(22, 32);
  const leaves = [[11, 8, 6, 5, 0x2f7a3e], [6, 13, 5, 4, 0x3a8f48], [16, 13, 5, 4, 0x2f7a3e], [9, 17, 5, 4, 0x46a35a], [14, 18, 5, 3, 0x3a8f48], [11, 12, 4, 4, 0x56b866], [4, 19, 4, 3, 0x2f7a3e], [18, 19, 4, 3, 0x46a35a]];
  for (const [x, y, rx, ry] of leaves) disc(P, x, y, rx + 0.6, ry + 0.6, 0x173d22);
  for (const [x, y, rx, ry, c] of leaves) { disc(P, x, y, rx, ry, c); P.hl(x - rx + 2, y - ry + 1, Math.max(1, rx - 1), mix(c, 0xffffff, 0.3)); P.vl(x, y - ry + 1, ry * 2 - 1, mul(c, 0.8)); }
  P.vl(11, 18, 5, 0x2a5a2e); P.vl(9, 20, 3, 0x2a5a2e); P.vl(13, 20, 3, 0x2a5a2e);
  P.rect(6, 22, 10, 9, 0xf4f1ea); P.rect(5, 22, 12, 2, 0xffffff); P.vl(15, 24, 7, 0xcfc8b8); P.vl(6, 24, 7, 0xfbfaf6);
  P.box(5, 22, 12, 2, 0x5a5048); P.vl(5, 24, 7, 0x5a5048); P.vl(16, 24, 7, 0x5a5048); P.hl(6, 31, 10, 0x5a5048);
  P.hl(7, 26, 8, 0xe8b230);
  return P.flush();
}
export const GTOP = GOND.y + 34, GBOT = GOND.y + 61; // accessoarhyllans hyllplan
export function gondolaImg() {
  const { w, h } = GOND;
  const P = new Pix(w, h);
  const ink = 0x1d1822, wood = 0xc9a06b, woodLo = 0x9a7448, back = 0xefe6d6;
  P.rect(2, 9, w - 4, h - 17, back);
  for (let y = 12; y < h - 10; y += 4) for (let x = 5; x < w - 4; x += 4) P.px(x, y, 0xd6cab4);
  P.box(1, 8, w - 2, h - 15, ink);
  P.rect(0, 0, w, 10, 0x17151a); P.hl(1, 1, w - 2, 0x3a3440);
  const lbl = $t('ACCESSOARER');
  text(P, SMALL, lbl, Math.round(w / 2 - textW(SMALL, lbl) / 2), 3, 0xf0d048);
  P.rect(3, 3, 5, 5, 0xf28bb3); P.rect(w - 8, 3, 5, 5, 0x3fc4ff);
  for (const sy of [GTOP - GOND.y, GBOT - GOND.y]) {
    P.rect(1, sy, w - 2, 2, wood); P.hl(1, sy, w - 2, mix(wood, 0xffffff, 0.3));
    P.rect(1, sy + 2, w - 2, 2, woodLo);
    P.hl(1, sy + 4, w - 2, mul(back, 0.8));
  }
  P.rect(0, h - 7, w, 7, 0x3a3440); P.hl(0, h - 7, w, 0x5a5460); P.hl(0, h - 1, w, 0x17151a);
  P.vl(0, 8, h - 8, ink); P.vl(w - 1, 8, h - 8, ink);
  const vw = textW(SMALL, $t('VÄSKOR')) + 4, vx = Math.round(w / 2 - vw / 2) + 1;
  P.rect(vx, 44, vw, 8, 0x17151a); text(P, SMALL, $t('VÄSKOR'), vx + 2, 46, 0xf28bb3);
  return P.flush();
}
// Hatthyllan framför trappan: två hyllplan med byster (ritas levande)
export const HTOP = HATS.y + 36, HBOT = HATS.y + 72;
export function hatGondolaImg() {
  const { w, h } = HATS;
  const P = new Pix(w, h);
  const ink = 0x1d1822, back = 0x3a4658;
  P.rect(2, 9, w - 4, h - 16, back);
  for (let y = 12; y < h - 8; y += 5) P.hl(4, y, w - 8, 0x2c3646);
  P.box(1, 8, w - 2, h - 14, ink);
  P.rect(0, 0, w, 10, 0x17151a); P.hl(1, 1, w - 2, 0x3a3440);
  const lbl = $t('HATTAR + MÖSSOR');

  text(P, SMALL, lbl, Math.round(w / 2 - textW(SMALL, lbl) / 2), 3, 0xf0d048);
  for (const sy of [HTOP - HATS.y, HBOT - HATS.y]) {
    P.rect(1, sy, w - 2, 2, 0xf7eef3); P.hl(1, sy, w - 2, 0xffffff); P.rect(1, sy + 2, w - 2, 2, 0xd98fb4);
  }
  P.rect(0, h - 6, w, 6, 0x3a3440); P.hl(0, h - 6, w, 0x5a5460); P.hl(0, h - 1, w, 0x17151a);
  P.vl(0, 8, h - 8, ink); P.vl(w - 1, 8, h - 8, ink);
  return P.flush();
}
export function deskImg() {
  const { w, h } = DESK;
  const P = new Pix(w, h);
  const ink = 0x1d1822;
  P.rect(0, 8, w, 6, 0xe9e1d2); P.hl(0, 8, w, 0xfaf6ee); P.hl(0, 13, w, 0xb8ad98);
  P.rect(1, 14, w - 2, h - 15, 0xc9a06b);
  for (let x = 3; x < w - 2; x += 6) P.vl(x, 15, h - 17, 0xb08850);
  P.rect(1, 18, w - 2, 3, 0xf28bb3); P.rect(Math.round(w / 2), 18, Math.round(w / 2) - 1, 3, 0x3fc4ff);
  P.hl(1, h - 2, w - 2, 0x7a5a38);
  P.box(0, 8, w, h - 8, ink);
  P.rect(34, 0, 16, 9, 0x2a2a32); P.rect(35, 1, 14, 4, 0x6fe08a); P.hl(36, 2, 6, 0x1d5a2c); P.hl(36, 3, 9, 0x2f8f46);
  P.rect(33, 6, 18, 3, 0x3a3a44); P.hl(33, 6, 18, 0x5a5a64);
  P.rect(6, 1, 9, 8, 0xf28bb3); P.box(6, 1, 9, 8, 0x8a3a60); P.hl(8, 0, 5, 0x8a3a60);
  P.rect(16, 3, 8, 6, 0x3fc4ff); P.box(16, 3, 8, 6, 0x1f5a8a); P.hl(18, 2, 4, 0x1f5a8a);
  P.rect(54, 4, 5, 5, 0x2a2a32); P.hl(55, 5, 3, 0x8fa0b8);
  return P.flush();
}
// Fristående klädställning: skylt på en stolpe, stång, ben med hjul och en låg hylla med vikta plagg.
// Bilden är RACK_W × 58, foten (golvet) på sista raden. Plaggen hänger levande från RACK_RAIL.
export const RACK_H = 58, RACK_RAIL = RACK_H - 40;
export function rackImg(key, lbl, seed = 1) {
  const w = RACK_W, h = RACK_H, P = new Pix(w, h);
  const th = DEPT[key] || DEPT.mid;
  const metal = 0xc9ccd6, metalLo = 0x6d717c, rail = RACK_RAIL;
  // skylten
  const tw = textW(SMALL, lbl), sw = Math.min(w, tw + 8), sx = Math.round((w - sw) / 2);
  P.vl(w / 2, 10, rail - 10, metalLo);
  P.rect(sx, 0, sw, 10, th.board); P.box(sx, 0, sw, 10, th.trim);
  text(P, SMALL, lbl, sx + Math.round((sw - tw) / 2), 3, 0xffffff);
  // ben och stång
  for (const x of [1, w - 3]) { P.rect(x, rail, 2, h - rail - 3, metal); P.vl(x + 1, rail, h - rail - 3, metalLo); }
  P.rect(0, rail - 1, w, 2, metal); P.hl(0, rail - 1, w, 0xf2f2f6); P.hl(0, rail + 1, w, metalLo);
  // låg hylla med vikta plagg
  const sy = h - 9;
  P.rect(2, sy, w - 4, 2, 0xe8e0d4); P.hl(2, sy + 2, w - 4, 0x8a8070);
  const cols = key === 'tjej' ? [0xf28bb3, 0x8e5bd1, 0xff7a6b, 0xf0b429, 0x2aa39a, 0xb9a3e8] : key === 'kille' ? [0x3a7bd5, 0x46a35a, 0x2d3a5c, 0xe07a2e, 0xd9433b, 0x5f7f99] : [0xd9434b, 0xf0b429, 0x3a7bd5, 0x46a35a, 0x1d1d22, 0xf4f1ea];
  for (let i = 0; i < 5; i++) {
    const x = 5 + i * 13;
    for (let j = 0; j < 2; j++) {
      const c = cols[(i * 2 + j + seed) % cols.length];
      P.rect(x, sy - 3 - j * 3, 10, 3, c); P.hl(x, sy - 3 - j * 3, 10, mix(c, 0xffffff, 0.3)); P.px(x + 9, sy - 2 - j * 3, mul(c, 0.7));
    }
  }
  // fötter med hjul
  P.rect(0, h - 3, w, 1, metalLo);
  for (const x of [1, w - 4]) { P.rect(x, h - 2, 3, 2, 0x26242c); P.px(x + 1, h - 2, 0x5a5a64); }
  return P.flush();
}
// Provbänk framför skoväggen med en skokartong: BENCH_W × 14, benen på sista raden
export const BENCH_W = 84;
export function benchImg() {
  const w = BENCH_W, h = 16, P = new Pix(w, h);
  P.rect(0, 6, w, 3, 0xc08a50); P.hl(0, 6, w, 0xe0b070); P.hl(0, 9, w, 0x7a5430);
  for (const x of [3, w - 6]) { P.rect(x, 10, 3, 6, 0x5a3e24); P.vl(x + 2, 10, 6, 0x3a2614); }
  P.hl(1, 15, w - 2, 0x000000, 0.2);
  // skokartongen (öppen, med silkespapper)
  P.rect(10, 0, 16, 6, 0xe8e0d0); P.box(10, 0, 16, 6, 0x6d6050); P.hl(11, 1, 14, 0xf6f2ea);
  P.rect(12, 2, 12, 3, 0xffd6ea); P.px(14, 3, 0xe4f22e); P.px(15, 3, 0xe4f22e); P.px(19, 3, 0xe4f22e); P.px(20, 3, 0xe4f22e);
  P.rect(28, 3, 14, 3, 0xd9434b); P.box(28, 3, 14, 3, 0x7a1f2e);
  return P.flush();
}
// Litet fotbollsmål (framifrån) för provplanen: 30 × 18, mynningen mot betraktaren
export function goalImg() {
  const w = 32, h = 20, P = new Pix(w, h);
  for (let y = 2; y < h - 1; y++) for (let x = 2; x < w - 2; x++) if ((x % 3 === 0) || (y % 3 === 0)) P.px(x, y, 0xe8ecef, 0.6);
  P.rect(0, 0, w, 2, 0xffffff); P.hl(0, 1, w, 0xc9ccd6);
  P.rect(0, 0, 2, h, 0xffffff); P.vl(1, 0, h, 0xc9ccd6); P.rect(w - 2, 0, 2, h, 0xffffff); P.vl(w - 1, 0, h, 0xc9ccd6);
  P.hl(2, h - 1, w - 4, 0x000000, 0.2);
  return P.flush();
}
