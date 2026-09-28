// MÖBELJÄTTEN – bakgrunden per plan (målas en gång, cachas): golv, väggar,
// väggdekor, avdelningarnas hyllor, pallställen, restaurangens väggar,
// entréns glasdörrar, rulltrappornas takbjälke / golvöppningar, hissramar,
// skyltar, gula gången och ljuset.
import { Pix, SMALL, BIG, text, textW, mix, mul, hash, bayer } from '../../core/floor-pix.js';
import { H, WH, FD, PW, OW, A_WALL, A_FLOOR, B_WALL, B_FLOOR, AISLE1, AISLE2, ROWY } from './geo.js';
import {
  storeFloorPx, floorPx, paintFloor, paintWall, wallCap, floorAO, roomSign, exitSign, bigSign, planBadge, arrowGlyph,
  paintWindow, paintDeco, paintFix, paintGlassDoors, doorMat, paintPath, trackLights, pendant, paintPicture, paintClock,
} from './art.js';
import { paintDeptWall, paintLampCeiling, paintRacks, hazard } from './art-market.js';
import { paintSlab, paintPit, paintLiftFrame } from './art-transit.js';
import { paintMenuBoard } from './food.js';

const YEL = 0xf6cf2a, BLUE = 0x1d51a0, NAVY = 0x0c2a5c;

// ---------- karta över planet (skylten i hallarna) ----------
function paintMap(P, x, y, w, h, F) {
  P.rect(x + 2, y + 2, w, h, 0x000000, 0.2);
  P.rect(x, y, w, h, 0xf4f1ea); P.box(x, y, w, h, 0x3a3f4a); P.box(x + 1, y + 1, w - 2, h - 2, 0xc8c2b8);
  text(P, SMALL, `PLAN ${F.n}`, x + 3, y + 3, BLUE);
  const mx = x + 3, my = y + 10, mw = w - 6, mh = h - 13;
  const sx = mw / F.W, sy = mh / H;
  P.rect(mx, my, mw, mh, 0xdcd8cd);
  for (const r of F.blocks) {
    const col = r.kind === 'rest' ? 0xc4764e : r.kind === 'lager' ? 0x9aa0a8 : r.kind === 'kassa' || r.kind === 'exit' ? 0x7aa0d8 : r.kind.startsWith('core') ? YEL : r.st.wall;
    const x0 = Math.round(mx + r.x0 * sx), x1 = Math.max(x0 + 1, Math.round(mx + r.x1 * sx) - 1);
    const y0 = Math.round(my + r.fy * sy), y1 = Math.round(my + (r.fy + (r.open ? H - r.fy - 40 : FD)) * sy);
    P.rect(x0, y0, x1 - x0, y1 - y0, col);
  }
  for (const pts of F.paths) for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    P.line(mx + ax * sx, my + ay * sy, mx + bx * sx, my + by * sy, 0xe0a810);
  }
  const [hx, hy] = F.spawn;
  P.rect(Math.round(mx + hx * sx) - 1, Math.round(my + hy * sy) - 1, 3, 3, 0xd8231e);
}

// ---------- entréhallen (plan 1) ----------
function paintCore1(P, F) {
  const r = F.core, bx = r.x0;
  // hög blå vägg med gul rand
  for (let y = 2; y < A_FLOOR; y++) for (let x = r.wl; x < r.wr; x++) {
    let c = mix(0x1d51a0, 0x2862b4, (bayer(x, y) - 0.5) * 0.2 + 0.5 + (y < 20 ? -0.3 : 0));
    if ((x - r.x0) % 30 === 0) c = mul(c, 0.9);
    if (y >= 29 && y < 31) c = YEL;
    if (A_FLOOR - 1 - y < 3) c = A_FLOOR - 1 - y === 2 ? YEL : 0x13396e;
    P.px(x, y, c);
  }
  P.hl(r.wl, 2, r.wr - r.wl, NAVY);
  bigSign(P, bx + 120, 3, 'MÖBELJÄTTEN');
  paintGlassDoors(P, F.door.x0, F.door.y0, F.door.x1 - F.door.x0, A_FLOOR);
  exitSign(P, bx + 38, 20, 'IN / UT');
  doorMat(P, F.door.x0 - 6, F.door.x1 + 6, A_FLOOR, 16);
  planBadge(P, bx + 70, 36, 1, 'ENTRÉPLAN');
  paintMap(P, bx + 140, 34, 54, 32, F);
  paintLiftFrame(P, F.lift.x, A_FLOOR, 1);
  // över rulltrapporna: takbjälke mot plan 2 och en hängande skylt (nedanför
  // takbandet 0–12, där spelets planvisare ligger)
  const [eu, en] = F.esc;
  for (const [e, lbl] of [[eu, 'UPP'], [en, 'NER']]) {
    // golvmarkering vid påstigningen
    const [px] = e.board;
    P.rect(px - 9, e.ly - 8, 18, 14, 0x000000, 0.08);
    const tw = textW(SMALL, lbl) + 12, tx = Math.round(px - tw / 2);
    P.rect(tx, e.ly + 10, tw, 9, e.up ? 0x169a4a : BLUE); P.box(tx, e.ly + 10, tw, 9, NAVY);
    text(P, SMALL, lbl, tx + 3, e.ly + 12, 0xffffff);
    arrowGlyph(P, tx + tw - 5, e.ly + 14, e.up ? 'U' : 'D', YEL);
  }
  paintSlab(P, F.slab.x0, F.slab.x1, F.slab.y, 'PLAN 2');
  roomSign(P, Math.round((eu.lx + en.lx) / 2), A_WALL, 0, 'RULLTRAPPOR TILL PLAN 2', { wire: 4, bg: YEL, fg: NAVY });
}

// ---------- ankomsthallen (plan 2) ----------
function paintCore2(P, F) {
  const r = F.core, bx = r.x0;
  paintWall(P, r.wl, r.wr, r.wy, r.fy, r.st);
  planBadge(P, bx + 12, A_WALL + 16, 2, 'UTSTÄLLNING');
  paintMap(P, bx + 148, A_WALL + 12, 60, 34, F);
  paintLiftFrame(P, F.lift.x, A_FLOOR, 2);
  trackLights(P, r.x0, r.x1, r.wy);
  for (const e of F.esc) paintPit(P, e.pit[0], e.pit[1], e.pit[2], e.pit[3]);
  // skyltar vid öppningarna
  const [eu, en] = F.esc;
  const lab = (e, lbl, up) => { // skylt på golvet bakom öppningen
    const tw = textW(SMALL, lbl) + 12, tx = Math.round((e.pit[0] + e.pit[1]) / 2 - tw / 2), ty = e.pit[2] - 28;
    P.rect(tx + 1, ty + 1, tw, 9, 0x000000, 0.2);
    P.rect(tx, ty, tw, 9, up ? 0x169a4a : BLUE); P.box(tx, ty, tw, 9, NAVY);
    text(P, SMALL, lbl, tx + 3, ty + 2, 0xffffff);
    arrowGlyph(P, tx + tw - 5, ty + 4, up ? 'U' : 'D', YEL);
  };
  lab(en, 'RULLTRAPPA NER TILL PLAN 1', false);
  lab(eu, 'FRÅN PLAN 1', true);
  roomSign(P, bx + 116, r.wy + 1, 0, 'VÄLKOMMEN UPP!', { wire: 0, bg: YEL, fg: NAVY });
  void eu;
}

// ---------- restaurangen ----------
function paintRest(P, F) {
  const r = F.rest, bx = r.x0, fy = r.fy;
  paintWall(P, r.wl, r.wr, r.wy, r.fy, r.st);
  // menytavlan över serveringen
  const M = F.menuBoard = { x: bx + 52, y: r.wy + 4, w: 186, h: 42 };
  paintMenuBoard(P, M.x, M.y, M.w, M.h);
  // fönster med utsikt i östra delen + lampor över borden
  for (const wx of [bx + 262, bx + 346]) paintWindow(P, wx, fy - 44, 60, 22, 0xe8d8b0);
  for (const lx of [bx + 290, bx + 366]) pendant(P, lx, r.wy - 2, 22, 0xf2c230);
  for (const lx of [bx + 60, bx + 130, bx + 200]) pendant(P, lx, r.wy - 2, 4, 0xf4f1ea, false);
  roomSign(P, bx + 330, r.wy + 1, 0, 'RESTAURANG', { wire: 0, bg: 0x6a3a1c, fg: YEL });
  text(P, SMALL, 'KAFFE PÅTÅR INGÅR', bx + 262, fy - 14, 0xf4e2bc, 0.9);
  // kakel bakom serveringen
  for (let y = fy - 14; y < fy - 2; y++) for (let x = bx + 4; x < bx + 256; x++) {
    const tx = (x - bx) % 8, ty = (y - fy) % 6;
    P.px(x, y, tx === 0 || ty === 0 ? 0xc8c2b4 : 0xf2eee6);
  }
}

// ---------- kassorna och utgången (plan 1) ----------
function paintKassa(P, F) {
  const r = F.kassa, bx = r.x0;
  paintWall(P, r.wl, r.wr, r.wy, r.fy, r.st);
  roomSign(P, bx + r.IW / 2, r.wy + 10, 0, 'KASSOR', { wire: 0 });
  text(P, SMALL, 'ALLT DU KÖPT ÄR REDAN BETALT', bx + r.IW / 2 - 56, r.wy + 28, BLUE);
  trackLights(P, r.x0, r.x1, r.wy);
  for (let i = 0; i < 3; i++) { const x = bx + 20 + i * 84; P.rect(x - 2, r.fy + 48, 74, 8, 0x3a3e48); P.box(x - 2, r.fy + 48, 74, 8, 0x2a2a30); }
}
function paintExit(P, F) {
  const r = F.exit, bx = r.x0, d = F.exitDoor;
  paintWall(P, r.wl, r.wr, r.wy, r.fy, r.st);
  paintGlassDoors(P, d.x0, r.fy - 44, d.x1 - d.x0, r.fy);
  exitSign(P, (d.x0 + d.x1) >> 1, r.fy - 57, 'UTGÅNG');
  doorMat(P, d.x0 - 4, d.x1 + 4, r.fy, 14);
  text(P, SMALL, 'TACK FÖR', bx + r.IW - 58, r.wy + 18, BLUE);
  text(P, SMALL, 'BESÖKET!', bx + r.IW - 58, r.wy + 25, BLUE);
  text(P, SMALL, 'VÄLKOMMEN', bx + 16, r.wy + 18, BLUE);
  text(P, SMALL, 'ÅTER!', bx + 16, r.wy + 25, BLUE);
  roomSign(P, bx + 40, r.wy + 34, 0, 'BISTRO', { wire: 0, bg: 0xd8231e, fg: 0xffffff });
  trackLights(P, r.x0, r.x1, r.wy);
}

// ---------- lagret ----------
function paintLager(P, F) {
  const r = F.lager, bx = r.x0, fy = r.fy;
  paintWall(P, r.wl, r.wr, r.wy, r.fy, r.st);
  const rx0 = bx + 8, bw = 40;
  const n = Math.floor((r.IW - 16) / bw);
  const scx = bx + r.IW / 2, sw = textW(SMALL, 'SJÄLVBETJÄNINGSLAGER') + 10; // lagrets skylt – inga gångskyltar under den
  paintRacks(P, rx0, rx0 + n * bw, fy, r.wy, 11, bw, [scx - sw / 2 - 3, scx + sw / 2 + 3]);
  // gul/svart kant framför pallställen + körfält för truckarna
  hazard(P, rx0, fy + 45, n * bw, 2);
  for (let x = bx + 6; x < r.x1 - 10; x += 16) P.rect(x, fy + 88, 8, 2, 0xf2c230, 0.85);
  text(P, SMALL, 'TRUCK', bx + 40, fy + 58, 0xf2c230, 0.7);
  roomSign(P, bx + r.IW / 2, r.wy - 2, 0, 'SJÄLVBETJÄNINGSLAGER', { wire: 0, bg: YEL, fg: NAVY });
  // lampor i taket (lysrör)
  for (let x = bx + 30; x < r.x1 - 20; x += 80) { P.rect(x, r.wy - 1, 24, 2, 0xf4f8ff); P.ell(x + 12, fy + 40, 34, 16, 0xf4f8ff, 0.08, 4); }
}

// ---------- ett inrett rum / en avdelning ----------
function paintRoom(P, r) {
  const bx = r.x0 + r.ox;
  paintWall(P, r.wl, r.wr, r.wy, r.fy, r.st);
  if (r.kind === 'room' && !r.rugs.length && r.IW > 160) { // de extra rummen får en vävd matta under mittraden
    const x0 = r.x0 + 14, x1 = r.x1 - 14, y0 = r.fy + 28, y1 = r.fy + 60;
    const base = mix(r.st.trim || 0x8a6a4a, 0xf4f1ea, 0.35), stripe = mix(r.st.wall, 0xffffff, 0.2);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const b = Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y);
      let c = b < 2 ? mul(base, 0.72) : ((y - y0) % 6 < 2 ? stripe : base);
      if (b >= 2 && ((x + y) & 3) === 0) c = mul(c, 0.94);
      if (b === 3) c = mix(c, 0xffffff, 0.25);
      P.px(x, y, c);
    }
    for (let x = x0; x < x1; x += 2) { P.px(x, y0 - 1, mul(base, 0.8)); P.px(x, y1, mul(base, 0.8)); }
    P.hl(x0 + 1, y1 + 1, x1 - x0 - 2, 0x000000, 0.12);
  }
  for (const d of r.deco) if (d[0] === 'fonster') paintWindow(P, bx + d[1], r.fy + d[2], d[3], d[4], r.st.curtain);
  for (const d of r.deco) paintDeco(P, d, bx, r.fy);
  for (const f of r.fix) paintFix(P, f, bx, r.fy);
  if (r.kind === 'dept' && r.props?.length) {
    paintDeptWall(P, r.dept, r.x0 + 6, Math.max(0, (r.st.fixW || 150) - 8), r.fy, r.wy, r.num * 3);
    if (r.dept === 'ljus') paintLampCeiling(P, r.x0 + 4, r.x0 + (r.st.fixW || 140), r.wy, r.num);
  }
  trackLights(P, r.x0, r.x1, r.wy);
  roomSign(P, Math.round(r.x0 + r.IW / 2), r.wy + 1, r.num, r.name);
}

// ================= hela planet =================
export function paintFloorBg(F) {
  const W = F.W;
  const P = new Pix(W, H);
  P.rect(0, 0, W, H, 0x17151d);
  // 1) golv
  for (let y = A_FLOOR; y < H - 2; y++) for (let x = 0; x < W; x++) P.px(x, y, storeFloorPx(x, y));
  for (const r of F.blocks) {
    const kind = r.st.floor;
    const y1 = r.open ? H - 2 : r.fy + FD;
    if (kind && kind !== 'butik') paintFloor(P, r.x0, r.fy, r.x1, y1, kind);
  }
  // marknadshallens podier under mellanraden
  for (const e of F.ex) if (e.room.kind === 'dept' && !e.rug && !e.hang && e.base === e.room.fy + ROWY.mid) {
    P.rect(e.x - 4, e.base - 8, e.w + 8, 9, 0xe8dcc0); P.hl(e.x - 4, e.base - 8, e.w + 8, 0xf6eed8);
    P.rect(e.x - 4, e.base + 1, e.w + 8, 2, 0xb4a47e); P.hl(e.x - 4, e.base + 3, e.w + 8, 0x000000, 0.15);
  }
  // 2) väggar och allt på dem
  for (const r of F.blocks) {
    if (r.kind === 'core1') paintCore1(P, F);
    else if (r.kind === 'core2') paintCore2(P, F);
    else if (r.kind === 'rest') paintRest(P, F);
    else if (r.kind === 'kassa') paintKassa(P, F);
    else if (r.kind === 'exit') paintExit(P, F);
    else if (r.kind === 'lager') paintLager(P, F);
    else paintRoom(P, r);
  }
  const aEnd = F.rowA[0].kind === 'core1' ? F.rowA[0].wr : F.rowA[0].wr;
  wallCap(P, aEnd, W, A_WALL);
  wallCap(P, F.open ? F.open.x1 : 0, F.turnX0, B_WALL);
  P.vl(F.turnX0 - 1, B_WALL - 3, WH + 3, 0x2a2630);
  // svängen: skylt på östra väggen
  {
    const cx = F.turnCx;
    P.rect(cx - 22, B_WALL + 18, 44, 22, 0x000000, 0.12);
    P.rect(cx - 21, B_WALL + 16, 42, 20, BLUE); P.box(cx - 21, B_WALL + 16, 42, 20, NAVY);
    text(P, SMALL, 'FORTSÄTT', cx - 17, B_WALL + 19, YEL);
    arrowGlyph(P, cx, B_WALL + 30, 'D', 0xffffff);
  }
  // 3) gula gången
  for (const pts of F.paths) paintPath(P, W, H, pts);
  // 4) ljus: glans i gångarna, ljuspölar i rummen, skugga under väggarna
  for (let x = 40; x < W - 20; x += 76) { P.ell(x, AISLE1 + 2, 30, 9, 0xfffbe8, 0.14, 4); P.ell(x + 38, AISLE2 + 2, 30, 9, 0xfffbe8, 0.14, 4); }
  for (const r of F.blocks) {
    P.ell(Math.round(r.x0 + r.IW / 2), r.fy + 44, Math.round(r.IW * 0.42), 30, 0xfff2d6, 0.1, 5);
    floorAO(P, r.x0, r.x1, r.fy);
  }
  P.hl(0, H - 2, W, 0x0e0d12); P.hl(0, H - 1, W, 0x0e0d12);
  return P.flush();
}
export { paintPicture, paintClock, hash };
