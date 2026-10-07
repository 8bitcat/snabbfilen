// MÖBELJÄTTEN – inredningen per plan: rekvisita som ritas y-sorterat (disk,
// kassor, Småland, korvkiosk, pallar, bord och stolar …), hinder för gången,
// klickbara ytor, restaurangens sittplatser och ankarpunkter för personalen.
import { H, WH, FD, PW, OW, A_WALL, A_FLOOR, B_WALL, B_FLOOR, AISLE1, AISLE2, ROWY } from './geo.js';
import { cartsImg, bagStandImg, smalandBackImg, smalandFrontImg, infoDeskImg, offerSignImg, bigPlantImg, signpostImg, pillarImg,
  checkoutImg, queuePostImg, palletStackImg, flatCartImg, rollCageImg, hotdogImg, highTableImg } from './art-props.js';
import { binImg, goodsTableImg, plantStandImg, cartonExhibitImg } from './art-market.js';
import { partitionImg, outerWallImg, fixSolid } from './art.js';
import { trayStackImg, servingImg, drinksImg, registerImg, trayCartImg } from './food.js';
import { restTableImg, chairImg, REST_TABLE_W } from './resto.js';
import { katOf, tagDims, signText } from './kat.js';
import { LIFT_W } from './art-transit.js';
import { FRAMES } from '../../data/frames.js';
import { $t } from '../../core/i18n.js';

const prop = (img, x, y, o = {}) => ({ img, x, y, fy: y + img.height, ...o });
const foot = (p, h = 8, dx0 = 1, dx1 = 1) => [p.x + dx0, p.fy - h, p.x + p.img.width - dx1, p.fy];

export function furnish(F) {
  const props = [], clicks = [], obstacles = [], seats = [], anchors = {};
  const furn = []; // { k, v, x, base } – ritas ur möbelatlasen, säljs inte
  const bench = (k, v, x, base, solid = true) => { const f = FRAMES[k + v] || FRAMES[k + '0']; if (!f) return; furn.push({ k, v, x, base, w: f[2], h: f[3] }); if (solid) obstacles.push([x, base - 7, x + f[2], base + 1]); };
  const add = (p, solid = true) => { if (solid === true) p.solid = foot(p); else if (solid) p.solid = solid; props.push(p); return p; };

  // ---------- plan 1 ----------
  if (F.n === 1) {
    const c = F.core, bx = c.x0;
    add(prop(cartsImg(), bx + 66, A_FLOOR + 4), [bx + 68, A_FLOOR + 18, bx + 104, A_FLOOR + 28]);
    add(prop(bagStandImg(), bx + 176, A_FLOOR + 8));
    const info = add(prop(infoDeskImg(), bx + 106, A_FLOOR + 26, { id: 'info' }), [bx + 106, A_FLOOR + 40, bx + 164, A_FLOOR + 56]);
    anchors.info = [bx + 114, A_FLOOR + 41];
    const smB = add(prop(smalandBackImg(), bx + 8, A_FLOOR + 74, { id: 'lekland' }), [bx + 9, A_FLOOR + 90, bx + 83, A_FLOOR + 122]);
    smB.fy = A_FLOOR + 96;
    add(prop(smalandFrontImg(), bx + 8, smB.y + 32), false);
    anchors.smaland = { x0: bx + 16, x1: bx + 70, y: smB.y + 37 };
    // skyltstolpar
    const [eu, en] = F.esc;
    add(prop(signpostImg([[$t('PLAN 2 UTSTÄLLNING'), 'U'], [$t('RESTAURANG'), 'U'], [$t('HISS'), 'L']]), eu.board[0] - 52, A_FLOOR + 66), 'post');
    add(prop(signpostImg([[$t('MARKNADSHALL'), 'R'], [$t('LAGER OCH KASSOR'), 'R'], [$t('UTGÅNG'), 'R']]), en.board[0] - 104, A_FLOOR + 66), 'post');
    add(prop(offerSignImg(), bx + 404, A_FLOOR + 84));
    bench('sittbank', 0, bx + 310, A_FLOOR + 122); bench('sittbank', 0, bx + 350, A_FLOOR + 122);
    bench('vaxtS', 0, bx + 290, A_FLOOR + 124); bench('vaxtS', 0, bx + 384, A_FLOOR + 124);
    add(prop(bigPlantImg(1), bx + 214, A_FLOOR + 36));
    add(prop(bigPlantImg(2), bx + 596, A_FLOOR + 60));
    clicks.push({ id: 'dorr', kind: 'door', hot: [F.door.x0 - 3, 30, F.door.x1 + 3, A_FLOOR + 10], go: [(F.door.x0 + F.door.x1) >> 1, A_FLOOR + 8] });
    clicks.push({ id: 'info', kind: 'info', hot: [info.x, info.y, info.x + 58, info.fy], go: [info.x + 29, info.fy + 7] });
    clicks.push({ id: 'lekland', kind: 'play', hot: [smB.x, smB.y, smB.x + 76, smB.y + 44], go: [smB.x + 90, smB.y + 30] });

    // utgången: korvkiosken och ståborden
    const ex = F.exit, xb = ex.x0, fy = ex.fy;
    const hd = add(prop(hotdogImg(), xb + 14, fy + 34, { id: 'korv' }), [xb + 17, fy + 60, xb + 61, fy + 70]);
    anchors.korv = [xb + 72, fy + 64];
    for (const tx of [xb + 186, xb + 214]) add(prop(highTableImg(), tx, fy + 50), [tx + 3, fy + 72, tx + 13, fy + 76]);
    add(prop(bigPlantImg(3), xb + 226, fy + 4));
    anchors.hightables = [[xb + 184, fy + 76], [xb + 234, fy + 76]];
    bench('sittbank', 0, xb + 70, fy + 30); bench('vaxtS', 0, xb + 160, fy + 26);
    clicks.push({ id: 'korv', kind: 'food', food: 'korv', hot: [hd.x, hd.y, hd.x + 50, hd.fy + 1], go: [hd.x + 25, hd.fy + 6] });
    clicks.push({ id: 'utgang', kind: 'exit', hot: [F.exitDoor.x0 - 3, fy - 58, F.exitDoor.x1 + 3, fy + 12], go: [(F.exitDoor.x0 + F.exitDoor.x1) >> 1, fy + 8] });

    // kassorna
    const ks = F.kassa;
    anchors.kassor = [];
    for (let i = 0; i < 3; i++) {
      const x = ks.x0 + 20 + i * 84;
      const co = add(prop(checkoutImg(i + 1), x, ks.fy + 18, { id: 'kassa' }), [x, ks.fy + 32, x + 62, ks.fy + 48]);
      anchors.kassor.push({ cashier: [x + 9, ks.fy + 31], queue: [x + 44, ks.fy + 62] });
      clicks.push({ id: 'kassa', kind: 'kassa', hot: [co.x, co.y, co.x + 70, co.fy + 2], go: [x + 40, ks.fy + 60] });
      add(prop(queuePostImg(), x + 64, ks.fy + 52), [x + 64, ks.fy + 64, x + 70, ks.fy + 68]);
    }

    // lagret: kartonger (klickbara), pallar, flakvagnar
    const lg = F.lager;
    anchors.lager = { x0: lg.x0 + 36, x1: lg.x1 - 84, y: lg.fy + 82, cart: lg.fy + 62 };
    F.cartons = [];
    const nb = Math.floor((lg.IW - 16) / 40);
    const bays = F.bays = Array.from({ length: nb }, (_, i) => lg.x0 + 8 + i * 40);
    lg.cartons.forEach((k, i) => {
      if (!bays[i] || !katOf(k)) return;
      const x = bays[i] + 5, base = lg.fy + 10, img = cartonExhibitImg(signText(katOf(k).name).slice(0, 6));
      const td = tagDims(k);
      const e = { k, v: 0, carton: true, buy: true, room: lg, floor: 1, x, base, top: base - img.height, w: img.width, h: img.height, img,
        tag: { x: Math.round(x + 15 - td.w / 2), y: base + 2 + (i % 2) * 15, w: td.w, h: td.h }, hot: null, go: [x + 15, base + 36] };
      e.hot = [Math.min(x, e.tag.x) - 1, e.top - 2, Math.max(x + 30, e.tag.x + e.tag.w) + 1, e.tag.y + e.tag.h];
      e.solid = [x, base - 6, x + 30, base + 1];
      F.cartons.push(e);
    });
    add(prop(palletStackImg(0), lg.x0 + 4, lg.fy + 50));
    add(prop(palletStackImg(1), lg.x1 - 34, lg.fy + 50));
    add(prop(palletStackImg(2), lg.x1 - 64, lg.fy + 50));
    add(prop(rollCageImg(), lg.x1 - 26, lg.fy + 20));
    add(prop(flatCartImg(false), lg.x0 + 6, lg.fy + 76), [lg.x0 + 7, lg.fy + 92, lg.x0 + 44, lg.fy + 98]);

    // marknadshallens avdelningar: korgar, bord och växtställ
    for (const r of F.blocks) if (r.kind === 'dept') for (const [t, a, b, dx, row] of r.props || []) {
      const x = r.x0 + r.ox + dx, base = r.fy + ROWY[row];
      const img = t === 'bin' ? binImg(a, b) : t === 'table' ? goodsTableImg(a, b) : plantStandImg(a);
      add(prop(img, x, base - img.height), [x + 1, base - 8, x + img.width - 1, base]);
    }
  }

  // ---------- plan 2 ----------
  if (F.n === 2) {
    const c = F.core, bx = c.x0;
    const [eu, en] = F.esc;
    add(prop(signpostImg([[$t('VARDAGSRUM'), 'R'], [$t('SOVRUM'), 'R'], [$t('RESTAURANG'), 'D']]), eu.board[0] + 20, A_FLOOR + 90), 'post');
    add(prop(signpostImg([[$t('PLAN 1'), 'D'], [$t('MARKNADSHALL'), 'D'], [$t('KASSOR'), 'D']])
, en.board[0] + 6, B_FLOOR - 54), 'post');
    add(prop(bigPlantImg(4), bx + 8, A_FLOOR + 118));
    add(prop(bigPlantImg(5), bx + 214, A_FLOOR + 30));
    add(prop(bigPlantImg(6), bx + 8, B_FLOOR + 60));
    bench('sittbank', 0, bx + 30, B_FLOOR - 26); bench('sittbank', 0, bx + 176, B_FLOOR - 26);
    bench('vaxtS', 0, bx + 72, B_FLOOR - 24); bench('vaxtS', 0, bx + 214, B_FLOOR - 24);

    // restaurangen
    const r = F.rest, rx = r.x0, fy = r.fy;
    add(prop(trayStackImg(), rx + 10, fy - 6), [rx + 10, fy + 18, rx + 34, fy + 26]);
    const sv = add(prop(servingImg(150), rx + 36, fy - 6, { id: 'restaurang' }), [rx + 36, fy + 14, rx + 186, fy + 28]);
    add(prop(drinksImg(), rx + 190, fy - 8), [rx + 190, fy + 18, rx + 222, fy + 28]);
    const reg = add(prop(registerImg(), rx + 226, fy - 2), [rx + 226, fy + 18, rx + 258, fy + 28]);
    add(prop(trayCartImg(), rx + r.IW - 30, fy + 2), [rx + r.IW - 30, fy + 28, rx + r.IW - 6, fy + 38]);
    add(prop(bigPlantImg(7), rx + r.IW - 26, fy + 40), [rx + r.IW - 24, fy + 78, rx + r.IW - 6, fy + 84]);
    anchors.cook = [rx + 44, fy + 10];
    anchors.cashierR = [rx + 244, fy + 12];
    anchors.line = { x0: rx + 22, x1: rx + 250, y: fy + 40 };
    F.restLine = { start: [rx + 22, fy + 40], pay: [rx + 244, fy + 40] };
    clicks.push({ id: 'restaurang', kind: 'rest', hot: [rx + 6, r.wy + 2, rx + 262, fy + 30], go: [rx + 22, fy + 40] });
    // borden: två platser per bord, stolen bakom, man sitter vänd mot gången
    const tables = [];
    for (const tx of [rx + 268, rx + 336]) tables.push({ x: tx, base: fy + 36 });
    for (let i = 0; i < 5; i++) tables.push({ x: rx + 14 + i * 78, base: fy + 82 });
    for (const tb of tables) {
      const img = restTableImg();
      add(prop(img, tb.x, tb.base - img.height, { table: tb }), [tb.x + 1, tb.base - 7, tb.x + REST_TABLE_W - 1, tb.base + 1]);
      for (const [k, sx] of [[0, 15], [1, 45]]) {
        const s = { id: seats.length, table: tb, x: tb.x + sx, y: tb.base - 10, side: k, occ: null,
          approach: [k ? tb.x + REST_TABLE_W + 7 : tb.x - 7, tb.base - 10] };
        seats.push(s);
        const ch = chairImg();
        props.push({ img: ch, x: s.x - 6, y: s.y - 6 - ch.height, fy: s.y - 0.5, chair: s });
        obstacles.push([s.x - 6, s.y - 4, s.x + 6, s.y + 1]);
      }
      clicks.push({ id: 'bord', kind: 'table', table: tb, hot: [tb.x - 2, tb.base - 40, tb.x + REST_TABLE_W + 2, tb.base + 2], go: [tb.x - 7, tb.base - 10] });
    }
    F.tables = tables;
    void sv; void reg;
  }

  // ---------- svängen: växter vid väggarna ----------
  add(prop(bigPlantImg(8 + F.n), F.turnX0 + 2, B_FLOOR - 6), [F.turnX0 + 4, B_FLOOR + 30, F.turnX0 + 20, B_FLOOR + 38]);
  add(prop(bigPlantImg(10 + F.n), F.W - OW - 24, B_FLOOR + 36), [F.W - OW - 22, B_FLOOR + 72, F.W - OW - 6, B_FLOOR + 80]);

  // ---------- rulltrappor och hiss (båda planen) ----------
  // Bara påstigningsänden går att åka från: på plan 1 trappan UPP, på plan 2
  // trappan NER. Den andra änden är en ankomstände – klick ger bara en upplysning.
  for (const e of F.esc) {
    e.arrive = e.up !== (F.n === 1);
    if (!e.arrive) clicks.push({ id: 'rulltrappa', esc: e, kind: 'esc', hot: e.hot, go: e.board });
    else clicks.push({ id: 'rulltrappa-ankomst', esc: e, kind: 'escArr', hot: e.hot, go: F.n === 2 ? [e.board[0] + 8, e.board[1] + 16] : [e.board[0], e.board[1] + 18] });
    if (e.sy < 0) obstacles.push([Math.min(e.lx, e.far[0]) - 3, A_FLOOR - 2, Math.max(e.lx, e.far[0]) + 3, e.ly + 7]);
    else obstacles.push([Math.min(e.pit[0], e.lx) - 3, e.pit[2] - 14, Math.max(e.pit[1], e.lx) + 3, e.pit[3] + 3]);
  }
  if (F.n === 1) obstacles.push([F.esc[0].lx - 2, A_FLOOR - 2, F.esc[1].lx + 2, F.esc[0].ly - 12]); // under takbjälken
  const L = F.lift;
  clicks.push({ id: 'hiss', kind: 'lift', hot: [L.x - 5, L.fy - 56, L.x + LIFT_W + 14, L.fy + 4], go: [L.x + 13, L.fy + 8] });

  // ---------- väggar, hinder ----------
  const walls = [];
  const pimg = partitionImg();
  for (const p of F.partitions) {
    const fy = p.band === 'A' ? A_FLOOR : B_FLOOR;
    walls.push({ img: pimg, x: p.x, y: fy - WH, fy: fy + FD });
    obstacles.push([p.x, fy - 4, p.x + PW, fy + FD + 1]);
  }
  walls.push({ img: outerWallImg(H - 2), x: 0, y: 0, fy: H + 1 });
  walls.push({ img: outerWallImg(H - A_WALL - 2), x: F.W - OW, y: A_WALL - 3, fy: H + 1 });
  obstacles.push([F.open ? F.open.x1 : 0, B_WALL - 4, F.turnX0, B_FLOOR + 2]); // rad B:s bakvägg
  for (const e of F.ex) if (e.solid) obstacles.push(e.solid);
  for (const e of F.cartons || []) obstacles.push(e.solid);
  for (const r of F.blocks) for (const f of r.fix) { const s = fixSolid(f, r.x0 + r.ox, r.fy); if (s) obstacles.push(s); }
  for (const p of props) if (p.solid && p.solid !== 'post') obstacles.push(p.solid);
  for (const p of props) if (p.solid === 'post') { p.solid = null; const cx = p.x + (p.img.width >> 1); obstacles.push([cx - 4, p.fy - 4, cx + 5, p.fy]); }

  // ---------- klickbara möbler (främst först), mattor sist ----------
  const buyables = [...F.ex.filter((e) => !e.rug), ...(F.cartons || [])].sort((a, b) => b.base - a.base);
  const exClicks = buyables.map((e) => ({ id: e.k, kind: e.buy ? 'buy' : 'decor', ex: e, hot: e.hot, go: e.go }));
  const rugClicks = F.ex.filter((e) => e.rug).map((e) => ({ id: e.k, kind: e.buy ? 'buy' : 'decor', ex: e, hot: e.hot, go: e.go }));
  F.clicks = [...exClicks, ...clicks, ...rugClicks];
  F.furn = furn; F.props = props; F.walls = walls; F.obstacles = obstacles; F.seats = seats; F.anchors = anchors;
  // golvytor för namnet i hörnet
  F.zones = F.blocks.map((r) => ({ r, x0: r.x0, x1: r.x1, y0: r.fy - 4, y1: r.open ? H : r.fy + FD }));
}
