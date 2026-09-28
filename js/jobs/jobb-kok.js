// Burgarköket – jobba i köket på Burgarbaren och BYGG rätterna som beställs!
// Beställningslappar kommer in på en skena ovanför luckan till matsalen. Varje
// lapp visar rätten; burgare byggs lager för lager på tråget på bänken – i
// EXAKT den ordning receptet säger (ordningen står längst ner på skärmen).
// Stationerna: brödlådan (under- och överbröd), grillen (biffar som måste
// VÄNDAS och inte får brännas – timer och färg syns), fritösen (pommes ner,
// timer, upp och salta), läskautomaten, milkshakemaskinen (tre smaker),
// glassmaskinen (strut) och bänkens backar (ost, sallad, tomat, lök, pickles)
// plus dressingflaskorna. Färdig rätt bärs till BRICKAN vid luckan – RING I
// KLOCKAN så tar servitrisen Bella den till gästen. Fel sak eller fel ordning
// på tråget = fel (oops). Bränt kött på burgaren = fel. Snabbt serverad
// beställning = dricks! Allt görs med den egna figuren som går mellan
// stationerna (klick-och-gå). Allt statiskt målas EN gång (rummet, ön);
// rätterna är procedurella pixelkartor i skala 1 som cachas per tillstånd.
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, ctxText, textW, text, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ, createSpeech } from '../scenes/walkable.js';
import { SHIFT_SECONDS, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';
import { JOBS } from '../game.js';
import { burgarMeny } from './jobb-burgare.js';

const FW = 384, FH = 216;
const WALL_B = 88;                       // bakväggen möter golvet
// stationerna längs väggen (bänkskivan börjar vid y 54, fronten ner till 88)
const GRILL = { x0: 6, x1: 98, slots: [22, 50, 78], slotY: 59 };
const FRIT = { x0: 102, x1: 152, korgar: [118, 138] };
const SALT = { x: 107 };                 // saltkaret på fritösbänken
const LASK = { x0: 156, x1: 184 };
const SHAKE = { x0: 190, x1: 222, knapp: [197, 206, 215] };  // C · J · V
const GLASS = { x0: 228, x1: 252 };
const LUCK = { x0: 258, x1: 378, oy0: 30, oy1: 62 };         // öppningen till matsalen
const RAIL_Y = 20;                       // skenan med beställningslapparna
const TICKET_W = 16, TICKET_H = 22, TICKET_PITCH = 17, MAX_TICKETS = 7;
const BRICKA = { x0: 264, x1: 348, y: 64, spots: [278, 304, 330] };
const BELL = { x: 362, y: 60 };          // klockan på diskhyllan vid luckan
const ISL = { x0: 20, x1: 246, top: 108, front: 124, base: 140 };  // bänkön
const STAND_Y = 121;                     // kocken står bakom ön (som pizzabagaren)
const TRAY = { x: 76, y: 119 };          // tråget – burgaren byggs här (nedersta lagrets underkant)
const BROD = { xU: 33, xO: 50 };         // brödlådans två fack (under / över)
const BINS = [
  { id: 'ost', x: 104, namn: 'OST' },
  { id: 'sallad', x: 126, namn: 'SALLAD' },
  { id: 'tomat', x: 148, namn: 'TOMAT' },
  { id: 'lok', x: 170, namn: 'LÖK' },
  { id: 'pickles', x: 192, namn: 'PICKLES' },
];
const DRESS = { x: 220 };                // dressing/ketchup/senap-flaskorna
const TRASH = { x: 362, y: 192 };        // soptunnan i högra hörnet
// grillen: sidan klar efter T_SIDE s, bränd efter T_BRANN s. Fritösen likadant.
const T_SIDE = 3, T_BRANN = 7;
const T_FRY = 4.5, T_FRY_BRANN = 9;
const FYLL_TID = { lask: 1.1, shake: 1.6, glass: 1.3 };
const SMAKER = ['CHOKLAD', 'JORDGUBB', 'VANILJ'];
const SMAK_PAL = [{ f: 0x8a5a34, F: 0xb8845c }, { f: 0xef7fae, F: 0xffb0d0 }, { f: 0xf0dca0, F: 0xfff0c8 }];

// ---------- recepten: stegen i EXAKT ordning (nedersta lagret först) ----------
const RECEPT = [
  { id: 'burgare', namn: 'BURGARE', mark: 'B', steg: ['underbrod', 'biff', 'ost', 'sallad', 'overbrod'], vikt: 20, max: 45 },
  { id: 'gron', namn: 'GRÖNBURGARE', mark: 'GB', steg: ['underbrod', 'biff', 'tomat', 'sallad', 'dressing', 'overbrod'], vikt: 12, max: 50 },
  { id: 'stora', namn: 'STORA STADAREN', mark: 'SS', steg: ['underbrod', 'biff', 'ost', 'tomat', 'lok', 'pickles', 'dressing', 'overbrod'], vikt: 10, max: 55 },
  { id: 'pommes', namn: 'POMMES', mark: 'P', steg: ['pommes'], vikt: 18, max: 34 },
  { id: 'lask', namn: 'LÄSK', mark: 'L', steg: ['lask'], vikt: 14, max: 26 },
  { id: 'shake', namn: 'MILKSHAKE', mark: 'M', steg: ['shake'], vikt: 14, max: 30 },
  { id: 'glass', namn: 'GLASS', mark: 'G', steg: ['glass'], vikt: 12, max: 26 },
];
const REC_IX = Object.fromEntries(RECEPT.map((r, i) => [r.id, i]));
const STEG_NAMN = {
  underbrod: 'UNDERBRÖD', biff: 'BIFF', ost: 'OST', sallad: 'SALLAD', tomat: 'TOMAT',
  lok: 'LÖK', pickles: 'PICKLES', dressing: 'DRESSING', overbrod: 'ÖVERBRÖD',
  pommes: 'FRITÖSEN: NER - VÄNTA - UPP - SALTA', lask: 'LÄSKAUTOMATEN', shake: 'MILKSHAKEMASKINEN', glass: 'GLASSMASKINEN',
};
const isBurgare = (r) => RECEPT[r].steg.length > 1;

// ---------- pixelrutnät (sprites byggs som rutnät, konturen läggs på sist) ----------
const newCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const grid = (w, h) => ({ w, h, d: new Array(w * h).fill(-1) });
function gset(G, x, y, c) { if (x >= 0 && y >= 0 && x < G.w && y < G.h) G.d[y * G.w + x] = c; }
function gblit(G, S, ox, oy) { for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) { const v = S.d[y * S.w + x]; if (v !== -1) gset(G, x + ox, y + oy, v); } }
// 1 px "sel-out"-kontur: mörkare ton av grannpixeln
function outlined(G) {
  const O = grid(G.w + 2, G.h + 2);
  gblit(O, G, 1, 1);
  const src = O.d.slice();
  for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w; x++) {
    if (src[y * O.w + x] !== -1) continue;
    for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= O.w || yy >= O.h || src[yy * O.w + xx] === -1) continue;
      O.d[y * O.w + x] = mix(mul(src[yy * O.w + xx], 0.42), 0x1c1418, 0.4);
      break;
    }
  }
  return O;
}
function gCanvas(G) {
  const c = newCanvas(G.w, G.h), x2 = c.getContext('2d');
  for (let y = 0; y < G.h; y++) for (let x = 0; x < G.w; x++) {
    const v = G.d[y * G.w + x];
    if (v === -1) continue;
    x2.fillStyle = css(v); x2.fillRect(x, y, 1, 1);
  }
  return c;
}
function mapGrid(map, pal) {
  const G = grid(Math.max(...map.map((r) => r.length)), map.length);
  map.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (pal[row[x]] !== undefined) gset(G, x, y, pal[row[x]]); });
  return G;
}
const SPR = new Map();
function cached(key, make) { let c = SPR.get(key); if (!c) { c = make(); SPR.set(key, c); } return c; }

// ---------- burgarens lager: 14 px breda pixelkartor, staplas nerifrån ----------
const LAGER = {
  underbrod: { h: 3, pal: { s: 0xfff0d0, b: 0xf2aa4c, c: 0xd4822c }, map: ['.ssssssssssss.', 'bbbbbbbbbbbbbb', '.cccccccccccc.'] },
  biff: { h: 3, pal: { e: 0xa85a34, m: 0x8a4a2c, M: 0x5a2c1a }, map: ['.eeeeeeeeeeee.', 'mmMmmMmmMmmMmm', '.MMMMMMMMMMMM.'] },
  ost: { h: 2, pal: { y: 0xffd23f, Y: 0xe09a1a }, map: ['yyyyyyyyyyyyyy', '.Y....Y....Y..'] },
  sallad: { h: 2, pal: { g: 0x8edc4c, G: 0x3f9e34 }, map: ['g.gg.gg.gg.gg.', '.GgGGgGGgGGgG.'] },
  tomat: { h: 2, pal: { r: 0xe0342c, R: 0xff7060, w: 0xffd0c0 }, map: ['.rrrrrrrrrrrr.', 'rRrwrRrrwrRrwr'] },
  lok: { h: 1, pal: { l: 0xf6eeff, L: 0xc9aee0 }, map: ['lLl.lLl.lL.lLl'] },
  pickles: { h: 1, pal: { p: 0x6a9a2c, P: 0x9ac84a }, map: ['.pP..pP..pP.p.'] },
  dressing: { h: 1, pal: { w: 0xfff6e6 }, map: ['.w.ww.w.ww.w..'] },
  overbrod: { h: 5, pal: { a: 0xf2aa4c, A: 0xffe2aa, s: 0xfff6dc, c: 0xd4822c }, map: ['....AAAAAA....', '..aAsAAAAsAa..', '.aaaaasaaaaaa.', 'aasaaaaaasaaaa', '.cccccccccccc.'] },
};
// hela stapeln (eller en påbörjad) som canvas med kontur – cachas per lagerföljd
function burgSprite(layers) {
  return cached('burg|' + layers.join(','), () => {
    const H = layers.reduce((a, id) => a + LAGER[id].h, 0);
    const G = grid(14, H);
    let y = H;
    for (const id of layers) { const L = LAGER[id]; y -= L.h; gblit(G, mapGrid(L.map, L.pal), 0, y); }
    return gCanvas(outlined(G));
  });
}

// ---------- rätterna som bärs och visas på lapparna ----------
// burgare/pommes/läsk/glass lånar Burgarbarens egna pixelkartor (samma stil ute och inne)
const MENY = burgarMeny();
const menyMap = (id) => MENY.dishes.find((d) => d.id === id);
function menySprite(id) { const d = menyMap(id); return cached('meny|' + id, () => gCanvas(outlined(mapGrid(d.map, d.pal)))); }
// grönburgaren och Stora Stadaren: varianter av burgarkartan (12 px breda)
const BURG_PAL = { a: 0xffe2aa, b: 0xf2aa4c, c: 0xd4822c, d: 0x9c5622, s: 0xfff6dc, G: 0x3f9e34, g: 0x8edc4c, y: 0xffd23f, Y: 0xe09a1a, m: 0x8a4a2c, M: 0x5a2c1a, r: 0xe0342c, R: 0xff7060, l: 0xf6eeff, p: 0x9ac84a, v: 0xfff6e6 };
const ICON_MAPS = {
  gron: ['...abbbbb...', '..absbbbsb..', '.dccccccccd.', 'GgGgGGgGgGgG', '.rRrrRrrRrr.', '.v.vv.v.vv..', '.mymmmmmmYm.'.replace(/y|Y/g, 'm'), '.MMMMMMMMMM.', '.cbbbbbbbbc.', '..dddddddd..'],
  stora: ['...abbbbb...', '..absbbbsb..', '.dccccccccd.', 'GgGgGGgGgGgG'.replace(/G|g/g, 'v'), '.lpl.lp.lpl.', '.rRrrRrrRrr.', '.yyyyyyyyyY.', '.mymmmmmmYm.', '.MMMMMMMMMM.', '.cbbbbbbbbc.', '..dddddddd..'],
  shake: ['.....ss...', '....s.....', '..wwwwww..', '.wwwwwwww.', '.FFFFFFFF.', '.ffffffff.', '.ffffffff.', '.Ffffffff.', '..ffffff..', '..FFFFFF..'],
};
function iconSprite(r, smak = 0) {
  const rec = RECEPT[r];
  if (rec.id === 'shake') {
    return cached('ikon|shake' + smak, () => {
      const sp = SMAK_PAL[smak];
      return gCanvas(outlined(mapGrid(ICON_MAPS.shake, { s: 0xe8443a, w: 0xffffff, F: sp.F, f: sp.f })));
    });
  }
  if (ICON_MAPS[rec.id]) return cached('ikon|' + rec.id, () => gCanvas(outlined(mapGrid(ICON_MAPS[rec.id], BURG_PAL))));
  return menySprite(rec.id);   // burgare, pommes, lask, glass
}
// det man bär i händerna (och det som står på brickan)
function pommesSprite(saltad, brand) {
  return cached(`pom|${saltad ? 1 : 0}${brand ? 1 : 0}`, () => {
    const d = menyMap('pommes'), G = mapGrid(d.map, d.pal);
    if (brand) for (let i = 0; i < G.d.length; i++) if (G.d[i] !== -1) G.d[i] = mix(G.d[i], 0x2a1810, 0.62);
    if (saltad) for (const [x, y] of [[3, 1], [6, 0], [9, 2], [5, 3], [8, 1], [2, 3]]) gset(G, x, y, 0xffffff);
    return gCanvas(outlined(G));
  });
}
function shakeSprite(smak) {
  return cached('shk|' + smak, () => {
    const sp = SMAK_PAL[smak];
    return gCanvas(outlined(mapGrid(ICON_MAPS.shake, { s: 0xe8443a, w: 0xffffff, F: sp.F, f: sp.f })));
  });
}
// biffen på stekspaden (rå/klar/bränd syns på färgen)
function biffSpade(brand) {
  return cached('spade|' + (brand ? 'x' : 'ok'), () => {
    const G = grid(16, 8);
    for (let x = 1; x < 15; x++) for (let y = 3; y < 7; y++) gset(G, x, y, y === 3 ? 0xc4ccd4 : y === 6 ? 0x5a646e : 0x8e98a4);   // stålblad
    const e = brand ? 0x3a2014 : 0xa85a34, m = brand ? 0x241009 : 0x8a4a2c, M = brand ? 0x140a06 : 0x5a2c1a;
    for (let x = 3; x < 13; x++) { gset(G, x, 1, e); gset(G, x, 2, (x & 2) ? m : M); gset(G, x, 3, M); }
    return gCanvas(outlined(G));
  });
}
function carrySprite(c) {
  if (c.typ === 'burgare') return burgSprite(RECEPT[c.recept].steg);
  if (c.typ === 'biff') return biffSpade(c.brand);
  if (c.typ === 'pommes') return pommesSprite(c.saltad, c.brand);
  if (c.typ === 'shake') return shakeSprite(c.smak);
  return menySprite(c.typ);   // lask, glass
}

// ---------- beställningslappen på skenan ----------
function drawTicket(ctx, o, x, blink) {
  const y = RAIL_Y + 6, left = Math.max(0, o.kvar / o.max);
  ctx.fillStyle = 'rgba(20,14,10,0.3)'; ctx.fillRect(x + 1, y + 1, TICKET_W, TICKET_H);   // skugga
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(x, y, TICKET_W, TICKET_H);
  ctx.fillStyle = '#e8e2d2'; ctx.fillRect(x, y + TICKET_H - 1, TICKET_W, 1);
  ctx.fillStyle = '#3e434b'; ctx.fillRect(x + (TICKET_W >> 1), y - 4, 1, 4);              // klämman mot skenan
  ctx.fillStyle = '#8e98a4'; ctx.fillRect(x + (TICKET_W >> 1) - 1, y - 5, 3, 2);
  // tålamodskanten överst
  ctx.fillStyle = left > 0.5 ? '#45b964' : left > 0.27 ? '#f0b429' : '#d9433b';
  ctx.fillRect(x, y, Math.max(1, Math.round(TICKET_W * left)), 2);
  const ic = iconSprite(o.recept, o.smak || 0);
  ctx.drawImage(ic, x + ((TICKET_W - ic.width) >> 1), y + 3 + ((13 - ic.height) >> 1));
  const rec = RECEPT[o.recept];
  const mk = rec.id === 'shake' ? SMAKER[o.smak][0] + rec.mark : rec.mark;
  ctxText(ctx, SMALL, mk, x + ((TICKET_W - textW(SMALL, mk)) >> 1), y + TICKET_H - 6, '#b8281e');
  if (o.kvar < 8 && blink) {
    ctx.fillStyle = '#17151a'; ctx.fillRect(x + TICKET_W - 2, y - 3, 5, 10);
    ctx.fillStyle = '#d9433b'; ctx.fillRect(x + TICKET_W - 1, y - 2, 3, 5); ctx.fillRect(x + TICKET_W - 1, y + 4, 3, 2);
  }
}

// ---------- rummet: kakelvägg, fläkt, grill, fritös, maskiner, lucka, golv ----------
function kakel(x, y) {
  if (y < 22) return 0x2a2430;                               // mörk rand under HUD:en
  if (y === 22) return 0xe8eef2;                             // kromlist
  if (y === 23) return 0x8e98a4;
  if (y >= 84) return y === 84 ? 0x6a747e : 0x2a2d33;        // sockel
  if (y >= 38 && y < 42) {                                   // rödvit schackbård (Burgarbarens färger)
    return (((x >> 2) + ((y - 38) >> 1)) & 1) ? 0xf4f1ea : 0xb8323a;
  }
  const ly = (y - 24) % 4, lx = x % 6, tx = (x / 6) | 0, ty = ((y - 24) / 4) | 0;   // vitt kakel
  if (lx === 5 || ly === 3) return 0xc8cec8;
  let c = mix(0xf6f8f4, 0xe4e8e2, hash(tx, ty, 9) * 0.8);
  if (lx === 0 && ly === 0) c = 0xffffff;
  else if (ly === 2) c = mul(c, 0.97);
  return c;
}
function paintKok() {
  const P = new Pix(FW, FH);
  for (let y = 18; y < WALL_B; y++) for (let x = 0; x < FW; x++) P.px(x, y, kakel(x, y));
  // ---------- golvet: grågröna klinker med brunn ----------
  for (let y = WALL_B; y < FH; y++) for (let x = 0; x < FW; x++) {
    const TW = 14, TH = 9, ty = ((y - WALL_B) / TH) | 0, lyy = (y - WALL_B) % TH, lx = x % TW, tx = (x / TW) | 0;
    let c;
    if (lx === 0 || lyy === 0) c = 0x59605c;
    else {
      const v = hash(tx, ty, 5);
      c = v < 0.3 ? 0x8b948e : v < 0.65 ? 0x848d87 : v < 0.92 ? 0x909a92 : 0x7a837d;
      c = mul(c, 0.96 + hash(x, y, 6) * 0.07);
      if (lyy === 1 || lx === 1) c = mix(c, 0xdce4de, 0.1);
      if (lyy === TH - 1 || lx === TW - 1) c = mul(c, 0.92);
    }
    if (y < WALL_B + 4) c = mul(c, 0.7 + (y - WALL_B) * 0.07);
    P.px(x, y, c);
  }
  // golvbrunnen
  for (let dy = -3; dy <= 3; dy++) for (let dx = -5; dx <= 5; dx++) {
    const d = Math.hypot(dx / 5.2, dy / 3.4);
    if (d > 1) continue;
    P.px(140 + dx, 176 + dy, d > 0.8 ? 0x4a504c : ((dx + dy) & 1) ? 0x383e3a : 0x2a302c);
  }
  P.darken(ISL.x0 + 2, ISL.base, ISL.x1 - ISL.x0 - 2, 1, 0.62);
  P.darken(ISL.x0 + 4, ISL.base + 1, ISL.x1 - ISL.x0 - 6, 1, 0.8);
  // gummimattan där kocken står och jobbar bakom ön
  for (let y = 94; y < 106; y++) for (let x = 36; x < 232; x++) {
    const edge = y === 94 || y === 105 || x === 36 || x === 231;
    let c = edge ? 0x2e3236 : ((x + y) & 3) === 0 && (y & 1) ? 0x33383c : 0x3c4146;
    if (y === 95 && !edge) c = 0x4a5056;
    P.px(x, y, c);
  }
  // ---------- bänkskivan längs väggen (under all utrustning) ----------
  for (let y = 54; y < 84; y++) for (let x = 2; x < LUCK.x0 - 2; x++) {
    let c;
    if (y === 54) c = 0xeef3f6;
    else if (y === 55) c = 0x98a2ae;
    else if (y < 66) c = mix(0xb8c0c8, 0x98a2aa, (y - 56) / 10 + (bayer(x, y) - 0.5) * 0.14);
    else c = mix(0x8e98a2, 0x717b85, (y - 66) / 18 + (bayer(x, y) - 0.5) * 0.12);   // skåpfront
    if (x % 50 === 2 && y > 66) c = 0x5a646e;
    P.px(x, y, c);
  }
  for (const hx of [28, 78, 128, 176, 226]) { P.rect(hx, 72, 6, 2, 0x4a545e); P.hl(hx, 72, 6, 0xeef3f6); }  // handtag
  // ---------- köksfläkten över grillen ----------
  for (let y = 18; y < 34; y++) { const ins = Math.max(0, (33 - y) - 11); P.hl(GRILL.x0 - 2 + ins, y, GRILL.x1 - GRILL.x0 + 4 - ins * 2, y === 33 ? 0x4a545e : mix(0xc8d0d8, 0x8e98a4, (y - 18) / 15)); }
  P.hl(GRILL.x0 + 2, 30, GRILL.x1 - GRILL.x0 - 4, 0x6a747e);
  for (let x = GRILL.x0 + 4; x < GRILL.x1 - 4; x += 3) P.vl(x, 26, 4, 0x7a848e);   // filtret
  P.rect(GRILL.x0 + 30, 20, 33, 7, 0x17151a);
  text(P, SMALL, 'GRILL', GRILL.x0 + 38, 21, 0xffd23f);
  // stänkskydd + grillplattan (het i mitten)
  P.rect(GRILL.x0 + 2, 44, GRILL.x1 - GRILL.x0 - 4, 10, 0xa8b0b8);
  P.hl(GRILL.x0 + 2, 44, GRILL.x1 - GRILL.x0 - 4, 0xd8e0e6);
  for (let y = 54; y < 64; y++) for (let x = GRILL.x0 + 2; x < GRILL.x1 - 2; x++) {
    const heat = 1 - Math.min(1, Math.abs(y - 58.5) / 5);
    let c = mix(0x23262b, 0x3a3026, heat * 0.8 + (bayer(x, y) - 0.5) * 0.2);
    if (y === 54) c = 0x565e66;
    if (hash(x, y, 31) < 0.04) c = 0x14161a;                 // gamla grillmärken
    P.px(x, y, c);
  }
  P.hl(GRILL.x0 + 2, 64, GRILL.x1 - GRILL.x0 - 4, 0x14161a); // fettrännan
  for (const sx of GRILL.slots) { P.box(sx - 8, 55, 17, 8, 0x3f434a); P.px(sx - 8, 55, 0x565e66); P.px(sx + 8, 62, 0x14161a); }   // biffarnas platser
  for (let i = 0; i < 3; i++) { const vx = GRILL.slots[i]; P.rect(vx - 2, 69, 5, 4, 0x8a1a22); P.px(vx - 1, 70, 0xe86050); P.hl(vx - 2, 73, 5, 0x4a0e12); } // röda vred
  // ---------- fritösen ----------
  P.rect(FRIT.x0, 46, FRIT.x1 - FRIT.x0, 8, 0xa8b0b8); P.hl(FRIT.x0, 46, FRIT.x1 - FRIT.x0, 0xd8e0e6);
  text(P, SMALL, 'FRITÖS', FRIT.x0 + 14, 77, 0x3a424a);
  for (const kx of FRIT.korgar) {
    P.rect(kx - 9, 54, 18, 12, 0x6a747e); P.box(kx - 9, 54, 18, 12, 0x49525c);
    P.rect(kx - 7, 56, 14, 5, 0xe0a030);                     // oljan
    P.hl(kx - 7, 56, 14, 0xffd060);
  }
  // saltkaret
  P.rect(SALT.x - 3, 47, 6, 7, 0xf0f4f6); P.vl(SALT.x - 3, 47, 7, 0xffffff); P.vl(SALT.x + 2, 47, 7, 0xb8c2cc);
  P.rect(SALT.x - 2, 44, 4, 3, 0xd9433b); P.px(SALT.x - 1, 44, 0xff8a80); P.px(SALT.x, 45, 0x8a1a22);
  text(P, SMALL, 'S', SALT.x - 1, 48, 0x6a747e);
  // ---------- läskautomaten ----------
  for (let y = 28; y < 66; y++) for (let x = LASK.x0; x < LASK.x1; x++) {
    let c = mix(0xc0262e, 0x8e1a22, (y - 28) / 38 + (bayer(x, y) - 0.5) * 0.16);
    if (x === LASK.x0 || x === LASK.x1 - 1) c = mul(c, 0.6);
    if (y === 28) c = 0xe86050;
    P.px(x, y, c);
  }
  P.rect(LASK.x0 + 3, 31, 22, 7, 0x17151a);
  text(P, SMALL, 'LÄSK', LASK.x0 + 6, 33, 0xfff09a);
  // bubbellogga + tre kranar
  for (const [bx, by] of [[LASK.x0 + 6, 42], [LASK.x0 + 13, 40], [LASK.x0 + 20, 43]]) { P.px(bx, by, 0xfff4ea); P.px(bx + 1, by + 1, 0xffb0a0); }
  for (let i = 0; i < 3; i++) { const tx = LASK.x0 + 6 + i * 8; P.rect(tx, 47, 3, 5, 0x2a2d33); P.hl(tx, 47, 3, 0x6a747e); P.px(tx + 1, 52, 0x14161a); }
  P.rect(LASK.x0 + 2, 60, LASK.x1 - LASK.x0 - 4, 4, 0x3a424a);  // droppgallret
  for (let x = LASK.x0 + 3; x < LASK.x1 - 3; x += 2) P.px(x, 61, 0x5a646e);
  // ---------- milkshakemaskinen ----------
  for (let y = 30; y < 66; y++) for (let x = SHAKE.x0; x < SHAKE.x1; x++) {
    let c = mix(0xf0e8dc, 0xcfc4b4, (y - 30) / 36 + (bayer(x, y) - 0.5) * 0.14);
    if (x === SHAKE.x0 || x === SHAKE.x1 - 1) c = mul(c, 0.66);
    if (y === 30) c = 0xfffaf0;
    P.px(x, y, c);
  }
  P.rect(SHAKE.x0 + 3, 33, 26, 7, 0x17151a);
  text(P, SMALL, 'SHAKE', SHAKE.x0 + 6, 35, 0xff88bb);
  // tre smakknappar (choklad · jordgubb · vanilj) + pip
  const KN = [0x8a5a34, 0xef7fae, 0xf0dca0];
  SHAKE.knapp.forEach((kx, i) => { P.rect(kx - 3, 44, 7, 7, mul(KN[i], 0.55)); P.rect(kx - 2, 45, 5, 5, KN[i]); P.px(kx - 2, 45, mix(KN[i], 0xffffff, 0.45)); });
  P.rect(SHAKE.x0 + 13, 53, 6, 4, 0x8e98a4); P.rect(SHAKE.x0 + 15, 57, 2, 2, 0x5a646e);
  P.rect(SHAKE.x0 + 2, 62, SHAKE.x1 - SHAKE.x0 - 4, 3, 0x3a424a);
  // ---------- glassmaskinen ----------
  for (let y = 32; y < 66; y++) for (let x = GLASS.x0; x < GLASS.x1; x++) {
    let c = mix(0xf4f6f8, 0xcdd4da, (y - 32) / 34 + (bayer(x, y) - 0.5) * 0.12);
    if (x === GLASS.x0 || x === GLASS.x1 - 1) c = mul(c, 0.68);
    if (y === 32) c = 0xffffff;
    P.px(x, y, c);
  }
  P.rect(GLASS.x0 + 2, 35, 20, 7, 0x17151a);
  text(P, SMALL, 'GLASS', GLASS.x0 + 3, 37, 0x8ec0ff);
  // våffelstrutar i ett ställ + spaken
  for (let i = 0; i < 3; i++) { const cx = GLASS.x0 + 5 + i * 6; P.px(cx, 45, 0xecb466); P.px(cx + 1, 45, 0xb8742c); P.px(cx, 46, 0xb8742c); P.px(cx + 1, 46, 0xecb466); P.px(cx, 47, 0x8a5620); P.px(cx + 1, 47, 0x8a5620); }
  P.rect(GLASS.x0 + 9, 50, 6, 3, 0x8e98a4); P.rect(GLASS.x0 + 11, 53, 2, 4, 0xd9433b); P.px(GLASS.x0 + 11, 53, 0xff8a80);
  P.rect(GLASS.x0 + 2, 62, GLASS.x1 - GLASS.x0 - 4, 3, 0x3a424a);
  // ---------- luckan till matsalen ----------
  P.box(LUCK.x0 - 2, LUCK.oy0 - 2, LUCK.x1 - LUCK.x0 + 4, LUCK.oy1 - LUCK.oy0 + 4, 0x49525c);
  P.box(LUCK.x0 - 1, LUCK.oy0 - 1, LUCK.x1 - LUCK.x0 + 2, LUCK.oy1 - LUCK.oy0 + 2, 0xc8d0d8);
  for (let y = LUCK.oy0; y < LUCK.oy1; y++) for (let x = LUCK.x0; x < LUCK.x1; x++) {
    let c;
    if (y < 50) c = mix(0x8ad6c6, 0x62b2a3, (y - LUCK.oy0) / 20 + (bayer(x, y) - 0.5) * 0.2);   // Burgarbarens mintvägg
    else if (y < 52) c = y === 50 ? 0xeef3f6 : 0x98a2ae;
    else c = mix(0xb8323a, 0x962630, (y - 52) / 10 + (bayer(x, y) - 0.5) * 0.2);                 // röd bröstpanel
    P.px(x, y, mul(c, 0.88));
  }
  // en pendellampa och ett bordshörn där ute
  P.vl(318, LUCK.oy0, 5, 0x2a2430);
  P.rect(315, LUCK.oy0 + 5, 7, 2, 0xc8323a); P.px(316, LUCK.oy0 + 5, 0xff6a6a);
  P.rect(316, LUCK.oy0 + 7, 5, 1, 0xfff2b0);
  P.ell(318, LUCK.oy0 + 12, 9, 5, 0xfff0b8, 0.25);
  P.rect(272, 54, 18, 3, 0xf0e8d8); P.hl(272, 54, 18, 0xfffaf0); P.rect(279, 57, 4, 5, 0x8e6a3a);
  // hyllan under luckan (brickan står här) + skåpfront
  for (let y = 62; y < 84; y++) for (let x = LUCK.x0 - 2; x < FW - 2; x++) {
    let c;
    if (y === 62) c = 0xeef3f6;
    else if (y === 63) c = 0x98a2ae;
    else if (y < 70) c = mix(0xc4ccd4, 0xa8b2ba, (y - 64) / 6);
    else c = mix(0x8e98a2, 0x6e7882, (y - 70) / 14 + (bayer(x, y) - 0.5) * 0.12);
    P.px(x, y, c);
  }
  P.rect(300, 74, 6, 2, 0x4a545e); P.hl(300, 74, 6, 0xeef3f6);
  // brickan: brun kant, ljus botten – rätterna ställs på den
  P.rect(BRICKA.x0, BRICKA.y, BRICKA.x1 - BRICKA.x0, 7, 0x8a5a2c);
  P.rect(BRICKA.x0 + 1, BRICKA.y + 1, BRICKA.x1 - BRICKA.x0 - 2, 5, 0xc89858);
  P.hl(BRICKA.x0 + 1, BRICKA.y + 1, BRICKA.x1 - BRICKA.x0 - 2, 0xe4b878);
  P.hl(BRICKA.x0, BRICKA.y + 7, BRICKA.x1 - BRICKA.x0, 0x5a3a1c);
  // ---------- skenan med beställningslapparna ----------
  P.rect(LUCK.x0 - 4, RAIL_Y, LUCK.x1 - LUCK.x0 + 8, 5, 0x5a646e);
  P.hl(LUCK.x0 - 4, RAIL_Y, LUCK.x1 - LUCK.x0 + 8, 0xa8b2bc);
  P.hl(LUCK.x0 - 4, RAIL_Y + 4, LUCK.x1 - LUCK.x0 + 8, 0x2a2d33);
  // ---------- soptunnan ----------
  P.rect(TRASH.x - 9, TRASH.y - 22, 18, 22, 0x8e98a4);
  P.rect(TRASH.x - 8, TRASH.y - 21, 16, 20, 0xc4ccd4);
  P.vl(TRASH.x - 7, TRASH.y - 21, 20, 0xeef3f6);
  P.vl(TRASH.x + 6, TRASH.y - 21, 20, 0x7a848e);
  P.rect(TRASH.x - 10, TRASH.y - 24, 20, 3, 0x6a747e); P.hl(TRASH.x - 10, TRASH.y - 24, 20, 0xa8b2bc);
  P.rect(TRASH.x - 2, TRASH.y - 26, 4, 2, 0x4a545e);
  P.darken(TRASH.x - 8, TRASH.y, 17, 1, 0.7);
  P.box(0, 0, FW, FH, 0x0e0d12);
  return P.flush();
}

// ---------- bänkön: brödlådan, tråget, backarna och dressingflaskorna ----------
function paintIsland() {
  const P = new Pix(FW, FH);
  for (let y = ISL.top; y < ISL.base; y++) for (let x = ISL.x0; x < ISL.x1; x++) {
    let c;
    if (y === ISL.top) c = 0xeef3f6;
    else if (y < ISL.front) c = mix(0xc8d0d6, 0xa8b2ba, (y - ISL.top) / 15 + (bayer(x, y) - 0.5) * 0.1);   // borstad skiva
    else if (y === ISL.front) c = 0x717b85;
    else c = mix(0x8e98a2, 0x646e78, (y - ISL.front) / 15 + (bayer(x, y) - 0.5) * 0.12);                    // fronten
    if (y < ISL.front && y > ISL.top && ((x + y) % 7 === 0)) c = mul(c, 0.96);                              // borstningen
    if (x === ISL.x0 || x === ISL.x1 - 1) c = mul(c, 0.7);
    if (y >= ISL.front + 1 && (x - ISL.x0) % 45 === 22) c = 0x5a646e;
    P.px(x, y, c);
  }
  for (const hx of [40, 86, 130, 176, 220]) { P.rect(hx, ISL.front + 6, 6, 2, 0x4a545e); P.hl(hx, ISL.front + 6, 6, 0xeef3f6); }
  // brödlådan: trälåda med två fack – underbröd till vänster, överbröd till höger
  P.rect(24, ISL.top - 8, 36, 12, 0x8a5a34); P.box(24, ISL.top - 8, 36, 12, 0x4a2e16);
  P.hl(25, ISL.top - 8, 34, 0xb88450); P.vl(42, ISL.top - 7, 10, 0x4a2e16);
  for (let i = 0; i < 2; i++) {   // två staplar underbröd
    const bx = 27 + i * 7, by = ISL.top - 6 + (i ? 1 : 0);
    for (let s = 0; s < 3; s++) { P.rect(bx, by + s * 2, 6, 2, s === 2 ? 0xd4822c : 0xf2aa4c); P.hl(bx, by + s * 2, 6, 0xffe2aa); }
  }
  for (let i = 0; i < 2; i++) {   // två staplar överbröd (kupolen + sesam)
    const bx = 45 + i * 7, by = ISL.top - 5 + (i ? 1 : 0);
    P.hl(bx + 1, by - 1, 4, 0xffe2aa);
    P.rect(bx, by, 6, 3, 0xf2aa4c); P.px(bx + 1, by, 0xfff6dc); P.px(bx + 4, by + 1, 0xfff6dc);
    P.hl(bx, by + 3, 6, 0xd4822c);
  }
  text(P, SMALL, 'BRÖD', 31, ISL.top + 5, 0x3a2414);
  // tråget: röd bygg-bricka med kant (burgaren staplas ovanpå, ritas dynamiskt)
  P.rect(TRAY.x - 13, TRAY.y - 4, 26, 7, 0x8e1a22);
  P.rect(TRAY.x - 12, TRAY.y - 3, 24, 5, 0xc0262e);
  P.hl(TRAY.x - 12, TRAY.y - 3, 24, 0xe86050);
  P.hl(TRAY.x - 13, TRAY.y + 3, 26, 0x5a0e14);
  // backarna med innehåll
  for (const b of BINS) {
    P.rect(b.x - 10, ISL.top + 1, 20, 10, 0x717b85);
    P.rect(b.x - 9, ISL.top + 2, 18, 8, 0x49525c);
    P.hl(b.x - 9, ISL.top + 2, 18, 0x353d46);
    const put = (fn) => { for (let i = 0; i < 14; i++) { const px = b.x - 8 + ((hash(i, 1, b.x) * 16) | 0), py = ISL.top + 3 + ((hash(i, 2, b.x) * 6) | 0); fn(px, py, i); } };
    if (b.id === 'ost') put((x, y) => { P.rect(x, y, 3, 2, 0xffd23f); P.px(x, y, 0xffe88a); });
    if (b.id === 'sallad') put((x, y, i) => { P.px(x, y, i & 1 ? 0x8edc4c : 0x3f9e34); P.px(x + 1, y, 0x5ab84a); P.px(x, y + 1, 0x3f9e34); });
    if (b.id === 'tomat') put((x, y, i) => { P.px(x, y, 0xe0342c); P.px(x + 1, y, i & 1 ? 0xff7060 : 0xe0342c); P.px(x + 1, y + 1, 0xa82320); });
    if (b.id === 'lok') put((x, y, i) => { P.px(x, y, 0xf6eeff); P.px(x + 1, y, i & 1 ? 0xc9aee0 : 0xf6eeff); });
    if (b.id === 'pickles') put((x, y, i) => { P.px(x, y, i & 1 ? 0x9ac84a : 0x6a9a2c); P.px(x + 1, y, 0x6a9a2c); });
  }
  // dressing, ketchup och senap: tre pumpflaskor
  const FLASK = [[0xf0e8dc, 0xfff6e6], [0xc0262e, 0xff7060], [0xe0a030, 0xffd060]];
  FLASK.forEach(([c, hi], i) => {
    const fx = DRESS.x - 8 + i * 8;
    P.rect(fx, ISL.top - 7, 5, 8, c); P.px(fx, ISL.top - 6, hi); P.vl(fx, ISL.top - 6, 6, mix(c, 0xffffff, 0.3)); P.vl(fx + 4, ISL.top - 6, 6, mul(c, 0.6));
    P.rect(fx + 1, ISL.top - 10, 3, 3, 0x8e98a4); P.rect(fx + 3, ISL.top - 10, 3, 1, 0x8e98a4); P.px(fx + 1, ISL.top - 10, 0xd8e0e6);
  });
  return P.flush();
}

// ---------- mätare under grillen och fritösen: grönt fönster = perfekt ----------
function drawGauge(ctx, x, y, tid, tOk, tBrann) {
  const tMax = tBrann + 2;
  ctx.fillStyle = '#1a1d21'; ctx.fillRect(x - 1, y - 1, 20, 4);
  const ok = Math.round(18 * tOk / tMax), brn = Math.round(18 * tBrann / tMax);
  ctx.fillStyle = '#5a4a24'; ctx.fillRect(x, y, ok, 2);
  ctx.fillStyle = '#28502c'; ctx.fillRect(x + ok, y, brn - ok, 2);
  ctx.fillStyle = '#5a2620'; ctx.fillRect(x + brn, y, 18 - brn, 2);
  if (tid === null) return;
  const p = Math.min(18, Math.round(18 * tid / tMax));
  const klar = tid >= tOk && tid < tBrann;
  ctx.fillStyle = tid < tOk ? '#f0c040' : klar ? '#5ee06a' : '#ff5a3a';
  ctx.fillRect(x, y, p, 2);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + Math.min(17, p), y - 1, 1, 4);
}

export function makeJobbKok(A, { onDone } = {}) {
  const stats = { ok: 0, fel: 0, miss: 0, dricks: 0, brand: 0 };
  const wage = JOBS.kok?.wage ?? 11;   // huvudagenten lägger in JOBS.kok i game.js
  const walker = createWalker({ top: 92, bottom: FH - 5, spawn: [TRAY.x, STAND_Y] });
  walker.setObstacles([
    [ISL.x0, ISL.front + 1, ISL.x1, ISL.base],               // bänkön (kocken står bakom, som i pizzerian)
    [TRASH.x - 11, TRASH.y - 26, TRASH.x + 11, TRASH.y + 1], // soptunnan
  ]);
  const pops = makePops();
  const talk = createSpeech();
  // Bella – servitrisen som syns i luckan och tar rätterna (samma utseende varje pass)
  let bseed = 7;
  const brng = () => ((bseed = (bseed * 16807) % 2147483647) / 2147483647);
  const bellaLook = { ...makeLook(brng), kid: false, build: 5, hat: null, bag: null, apron: true };   // vuxen servitris med förkläde
  const bella = { x: 306, dir: 1, pauseT: 1.5 };
  let lastTalk = -99;
  function bellaSay(txt) {
    if (t - lastTalk < 10) return;
    lastTalk = t;
    talk.say(txt, () => ({ x: bella.x, y: 46 }), 4, { voice: bellaLook });
  }

  let orders = [], t = 0, seq = 0, orderIn = 0.5, saidIntro = false;
  let carry = null;                    // { typ, recept?, smak?, saltad?, brand?, feld? }
  let tray = null;                     // { recept, lager: [], klar } – burgaren på tråget
  const grill = [null, null, null];    // { sida: 0|1, tid, brand } per platta
  const fritos = [null, null];         // { tid, brand } per korg
  const maskin = { lask: null, shake: null, glass: null };   // { fas: 'fyller'|'klar', t, dur, smak }
  const bricka = [null, null, null];
  let bellT = 0, trashT = 0, workT = 0, hover = null, parts = [];
  let done = false, doneT = 0, reported = false;
  const cache = {};
  const bg = () => (cache.bg ||= paintKok());
  const island = () => (cache.isl ||= paintIsland());

  // ---------- hjälpare ----------
  function hint(txt, x, y) { pops.add(x, y, txt, '#ffd23f'); play('click'); }
  // brända saker ger EN gång fel när man försöker använda dem – sedan bara påminnelser
  function felOnce(obj, txt, x, y) {
    if (obj.feld) { hint(txt, x, y); return; }
    obj.feld = true; stats.fel++; play('fel'); pops.add(x, y, txt, '#ff6a6a');
  }
  function puff(x, y, cols, n = 10, spread = 10) {
    for (let i = 0; i < n; i++) parts.push({ k: 'puff', x: x + (Math.random() * 2 - 1) * spread, y: y + (Math.random() * 2 - 1) * 3, vx: (Math.random() * 2 - 1) * 10, vy: -4 - Math.random() * 8, life: 0.5 + Math.random() * 0.3, age: 0, c: cols[i % cols.length] });
  }
  function sprinkle(x0, y0, cols, n = 12) {   // kocken kastar ingrediensen i en båge bort till tråget
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
      parts.push({ k: 'arc', x0: x0 + (Math.random() * 4 - 2), y0, x1: TRAY.x + Math.cos(a) * r * 9, y1: TRAY.y - 2 + Math.sin(a) * r * 2.5, t: -i * 0.02, dur: 0.34, h: 9 + Math.random() * 7, c: cols[i % cols.length] });
    }
  }
  function smoke(x, y) { parts.push({ k: 'smoke', x: x + Math.random() * 8 - 4, y, vx: Math.random() * 6 - 3, vy: -10 - Math.random() * 6, life: 1.5, age: 0 }); }
  const lagerCols = (id) => { const L = LAGER[id]; return Object.values(L.pal); };

  // ---------- beställningarna ----------
  function pickRecept() {
    const tot = RECEPT.reduce((a, r) => a + r.vikt, 0);
    let v = Math.random() * tot;
    for (let i = 0; i < RECEPT.length; i++) { v -= RECEPT[i].vikt; if (v <= 0) return i; }
    return 0;
  }
  function spawnOrder(rix, smak) {
    if (orders.length >= MAX_TICKETS) return null;
    const r = rix ?? pickRecept();
    const o = { recept: r, smak: RECEPT[r].id === 'shake' ? (smak ?? ((Math.random() * 3) | 0)) : undefined, kvar: RECEPT[r].max, max: RECEPT[r].max, id: seq++ };
    orders.push(o);
    play('chirp');
    return o;
  }
  function matches(o, it) {
    const rec = RECEPT[o.recept];
    if (rec.id === 'shake') return it.typ === 'shake' && it.smak === o.smak;
    if (isBurgare(o.recept)) return it.typ === 'burgare' && it.recept === o.recept;
    return it.typ === rec.id;
  }

  // ---------- grillen ----------
  function checkBrand(b, x, what) {
    if (b.brand || b.tid < (what === 'fry' ? T_FRY_BRANN : T_BRANN)) return;
    b.brand = true; stats.brand++;
    play('miss'); pops.add(x, 46, 'BRÄNNS!', '#ff6a6a');
  }
  function actGrill(i) {
    const x = GRILL.slots[i], b = grill[i];
    walker.dir = 'up';
    if (!b) { grill[i] = { sida: 0, tid: 0, brand: false }; play('click'); pops.add(x, 48, 'RÅ BIFF PÅ!', '#f4f1ea'); workT = 0.3; return; }
    if (b.brand) {
      if (carry) { hint('HÄNDERNA ÄR FULLA', x, 48); return; }
      carry = { typ: 'biff', brand: true }; grill[i] = null; play('miss'); pops.add(x, 48, 'BRÄND - SLÄNG DEN', '#ff6a6a'); return;
    }
    if (b.sida === 0) {
      if (b.tid < T_SIDE) { hint('LÅT DEN STEKA KLART', x, 48); return; }
      b.sida = 1; b.tid = 0; play('slide'); pops.add(x, 48, 'VÄND!', '#f4f1ea');
      puff(x, GRILL.slotY, [0xfff0d0, 0xffffff, 0xffc040], 6, 5); workT = 0.3; return;
    }
    if (b.tid < T_SIDE) { hint('ANDRA SIDAN STEKER ÄN', x, 48); return; }
    if (carry) { hint('HÄNDERNA ÄR FULLA', x, 48); return; }
    carry = { typ: 'biff', brand: false }; grill[i] = null; play('ok'); workT = 0.3;
  }
  // ---------- fritösen ----------
  function actFritos(i) {
    const x = FRIT.korgar[i], f = fritos[i];
    walker.dir = 'up';
    if (!f) { fritos[i] = { tid: 0, brand: false }; play('click'); pops.add(x, 44, 'POMMES NER!', '#f4f1ea'); workT = 0.3; return; }
    if (f.tid < T_FRY && !f.brand) { hint('INTE KLARA ÄN', x, 44); return; }
    if (carry) { hint('HÄNDERNA ÄR FULLA', x, 44); return; }
    carry = { typ: 'pommes', saltad: false, brand: f.brand }; fritos[i] = null;
    play(f.brand ? 'miss' : 'ok');
    pops.add(x, 44, f.brand ? 'BRÄNDA...' : 'UPP MED KORGEN!', f.brand ? '#ff6a6a' : '#8ee03c'); workT = 0.3;
  }
  function actSalt() {
    walker.dir = 'up';
    if (!carry || carry.typ !== 'pommes') { hint('TA UPP POMMES FÖRST', SALT.x, 40); return; }
    if (carry.brand) { felOnce(carry, 'BRÄNDA! SLÄNG DEM', SALT.x, 40); return; }
    if (carry.saltad) { hint('REDAN SALTADE', SALT.x, 40); return; }
    carry.saltad = true; play('click'); pops.add(SALT.x, 40, '+SALT!', '#f4f1ea');
    puff(walker.px, walker.py - 26, [0xffffff, 0xf0f4f6], 8, 5); workT = 0.3;
  }
  // ---------- läsk, milkshake och glass ----------
  function actMaskin(typ, smak) {
    walker.dir = 'up';
    const mx = typ === 'lask' ? 170 : typ === 'shake' ? 206 : 240;
    const m = maskin[typ];
    if (m?.fas === 'klar') {
      if (carry) { hint('HÄNDERNA ÄR FULLA', mx, 26); return; }
      carry = { typ, smak: m.smak }; maskin[typ] = null; play('ok'); workT = 0.3; return;
    }
    if (m) { hint('MASKINEN ÄR IGÅNG', mx, 26); return; }
    if (typ === 'shake' && smak === undefined) { hint('VÄLJ SMAK PÅ KNAPPARNA', mx, 26); return; }
    maskin[typ] = { fas: 'fyller', t: 0, dur: FYLL_TID[typ], smak };
    play('click'); workT = 0.3;
    if (typ === 'shake') pops.add(mx, 26, SMAKER[smak] + '!', '#f4f1ea');
  }
  // ---------- tråget: bygg burgaren i receptets ordning ----------
  function actLager(id) {
    const kx = walker.px, srcX = id === 'biff' ? kx : id === 'underbrod' ? BROD.xU : id === 'overbrod' ? BROD.xO : id === 'dressing' ? DRESS.x : BINS.find((b) => b.id === id).x;
    if (id === 'biff' && (!carry || carry.typ !== 'biff')) { hint('HÄMTA EN BIFF FRÅN GRILLEN', TRAY.x, 96); return; }
    if (id === 'biff' && carry.brand) { felOnce(carry, 'BRÄNT KÖTT! SLÄNG DET', TRAY.x, 96); return; }
    if (tray?.klar) { hint('LYFT BURGAREN FÖRST', TRAY.x, 96); return; }
    if (!tray) {
      const o = orders.find((c) => isBurgare(c.recept));
      if (!o) { hint('INGEN BURGARE ÄR BESTÄLLD', TRAY.x, 96); return; }
      tray = { recept: o.recept, lager: [], klar: false };
    }
    const steg = RECEPT[tray.recept].steg, next = steg[tray.lager.length];
    if (id !== next) { stats.fel++; play('fel'); pops.add(TRAY.x, 96, `OOPS! NÄSTA: ${STEG_NAMN[next]}`, '#ff6a6a'); return; }
    tray.lager.push(id);
    if (id === 'biff') carry = null;
    sprinkle(srcX, ISL.top + 2, lagerCols(id), id === 'biff' ? 8 : 12);
    play('click'); workT = 0.3;
    pops.add(TRAY.x, 96, '+' + STEG_NAMN[id], '#f4f1ea');
    if (tray.lager.length === steg.length) { tray.klar = true; play('box'); pops.add(TRAY.x, 90, RECEPT[tray.recept].namn + ' KLAR!', '#8ee03c'); }
  }
  function actTray() {
    if (carry?.typ === 'biff') { actLager('biff'); return; }
    if (carry) { hint('HÄNDERNA ÄR FULLA', TRAY.x, 96); return; }
    if (tray?.klar) { carry = { typ: 'burgare', recept: tray.recept }; tray = null; play('ok'); workT = 0.3; return; }
    if (tray) { hint('NÄSTA: ' + STEG_NAMN[RECEPT[tray.recept].steg[tray.lager.length]], TRAY.x, 96); return; }
    hint('BÖRJA MED UNDERBRÖDET', TRAY.x, 96);
  }
  // ---------- brickan och klockan vid luckan ----------
  function actBricka(spot) {
    walker.dir = 'up';
    const x = BRICKA.spots[spot];
    if (!carry && bricka[spot]) { carry = bricka[spot]; bricka[spot] = null; play('click'); return; }
    if (!carry) { hint('HÄMTA EN FÄRDIG RÄTT FÖRST', x, 52); return; }
    if (carry.typ === 'biff') { hint('BIFFEN SKA PÅ EN BURGARE', x, 52); return; }
    if (carry.brand) { felOnce(carry, 'BRÄNT! SLÄNG DET', x, 52); return; }
    if (carry.typ === 'pommes' && !carry.saltad) { hint('SALTA POMMESEN FÖRST!', x, 52); return; }
    let s = bricka[spot] ? bricka.findIndex((v) => !v) : spot;
    if (s < 0) { hint('BRICKAN ÄR FULL - RING I KLOCKAN', x, 52); return; }
    bricka[s] = carry; carry = null; play('click'); workT = 0.3;
  }
  function actBell() {
    walker.dir = 'up';
    bellT = 0.55; play('box');
    let served = 0, rest = null;
    for (let s = 0; s < 3; s++) {
      const it = bricka[s];
      if (!it) continue;
      const oi = orders.findIndex((o) => matches(o, it));
      if (oi < 0) { rest = it; continue; }
      const o = orders.splice(oi, 1)[0];
      bricka[s] = null; served++; stats.ok++;
      play('coin');
      pops.add(BRICKA.spots[s], 52, `+${wage} TACK!`, '#8ee03c');
      if (o.kvar / o.max > 0.6) { stats.dricks++; pops.add(BRICKA.spots[s], 42, 'DRICKS!', '#ffd23f'); bellaSay('SNABBT JOBBAT! GÄSTEN GAV DRICKS! 💰'); }
    }
    if (!served && !rest) hint('STÄLL MATEN PÅ BRICKAN FÖRST', BELL.x - 10, 46);
    else if (!served && rest) hint('INGEN HAR BESTÄLLT DET HÄR', BELL.x - 10, 46);
  }
  function actTrash() {
    if (!carry) { hint('INGET ATT SLÄNGA', TRASH.x, TRASH.y - 30); return; }
    carry = null; trashT = 0.6; play('miss');
    pops.add(TRASH.x, TRASH.y - 30, 'SLÄNGD', '#d8d2c0');
  }

  // ---------- klickytorna ----------
  function stationAt(x, y) {
    if (y >= 40 && y < 96) {
      if (x >= GRILL.x0 && x < GRILL.x1) { let i = 0, bd = 99; GRILL.slots.forEach((sx, si) => { const d = Math.abs(sx - x); if (d < bd) { bd = d; i = si; } }); return { k: 'grill', i, namn: 'GRILLEN' }; }
      if (x >= FRIT.x0 && x < FRIT.x1) return x < 113 ? { k: 'salt', namn: 'SALTET' } : { k: 'fritos', i: x < 128 ? 0 : 1, namn: 'FRITÖSEN' };
      if (x >= LASK.x0 && x < LASK.x1) return { k: 'lask', namn: 'LÄSKAUTOMATEN' };
      if (x >= SHAKE.x0 && x < SHAKE.x1) {
        let smak;
        if (y >= 41 && y < 54) { let bd = 99; SHAKE.knapp.forEach((kx, ki) => { const d = Math.abs(kx - x); if (d < bd && d < 6) { bd = d; smak = ki; } }); }
        return { k: 'shake', smak, namn: smak === undefined ? 'MILKSHAKEMASKINEN' : 'SMAK: ' + SMAKER[smak] };
      }
      if (x >= GLASS.x0 && x < GLASS.x1) return { k: 'glass', namn: 'GLASSMASKINEN' };
      if (x >= BELL.x - 12 && y >= 42) return { k: 'klocka', namn: 'KLOCKAN' };
      if (x >= BRICKA.x0 - 4 && x < BRICKA.x1 + 6 && y >= 48) { let s = 0, bd = 99; BRICKA.spots.forEach((sx, si) => { const d = Math.abs(sx - x); if (d < bd) { bd = d; s = si; } }); return { k: 'bricka', spot: s, namn: 'BRICKAN' }; }
      return null;
    }
    if (y >= 96 && y < ISL.base + 2 && x >= ISL.x0 && x < ISL.x1) {
      if (x < 43) return { k: 'lager', id: 'underbrod', namn: 'UNDERBRÖD', ax: BROD.xU };
      if (x < 62) return { k: 'lager', id: 'overbrod', namn: 'ÖVERBRÖD', ax: BROD.xO };
      if (Math.abs(x - TRAY.x) <= 14) return { k: 'trag', namn: tray ? RECEPT[tray.recept].namn : 'TRÅGET' };
      if (x >= DRESS.x - 12 && x < DRESS.x + 16) return { k: 'lager', id: 'dressing', namn: 'DRESSING M.M.', ax: DRESS.x };
      let best = null, bd = 12;
      for (const b of BINS) { const d = Math.abs(b.x - x); if (d < bd) { bd = d; best = b; } }
      if (best) return { k: 'lager', id: best.id, namn: best.namn, ax: best.x };
      return null;
    }
    if (Math.abs(x - TRASH.x) <= 12 && y >= TRASH.y - 28 && y <= TRASH.y + 2) return { k: 'sopor', namn: 'SOPTUNNAN' };
    return null;
  }
  function doStation(s) {
    if (s.k === 'grill') walker.walkTo(GRILL.slots[s.i], 95, () => actGrill(s.i));
    else if (s.k === 'fritos') walker.walkTo(FRIT.korgar[s.i], 95, () => actFritos(s.i));
    else if (s.k === 'salt') walker.walkTo(SALT.x + 3, 95, actSalt);
    else if (s.k === 'lask') walker.walkTo(170, 95, () => actMaskin('lask'));
    else if (s.k === 'shake') walker.walkTo(206, 95, () => actMaskin('shake', s.smak));
    else if (s.k === 'glass') walker.walkTo(240, 95, () => actMaskin('glass'));
    else if (s.k === 'klocka') walker.walkTo(BELL.x - 8, 95, actBell);
    else if (s.k === 'bricka') walker.walkTo(BRICKA.spots[s.spot], 95, () => actBricka(s.spot));
    else if (s.k === 'lager') walker.walkTo(s.ax, STAND_Y, () => actLager(s.id));
    else if (s.k === 'trag') walker.walkTo(TRAY.x, STAND_Y, actTray);
    else if (s.k === 'sopor') walker.walkTo(TRASH.x - 16, TRASH.y - 2, actTrash);
  }

  // ---------- debug-API för röktestet ----------
  const beskriv = (it) => (it ? { typ: it.typ, recept: it.recept !== undefined ? RECEPT[it.recept].id : undefined, smak: it.smak !== undefined ? SMAKER[it.smak] : undefined, saltad: it.saltad, brand: it.brand } : null);
  const dbg = {
    stats,
    state: () => ({
      carry: beskriv(carry),
      trag: tray ? { recept: RECEPT[tray.recept].id, lager: [...tray.lager], klar: !!tray.klar } : null,
      grill: grill.map((b) => (b ? { sida: b.sida, tid: +b.tid.toFixed(2), brand: b.brand } : null)),
      fritos: fritos.map((f) => (f ? { tid: +f.tid.toFixed(2), brand: f.brand } : null)),
      maskin: Object.fromEntries(Object.entries(maskin).map(([k, m]) => [k, m ? { fas: m.fas, smak: m.smak !== undefined ? SMAKER[m.smak] : undefined } : null])),
      bricka: bricka.map(beskriv),
      nasta: orders[0] ? RECEPT[orders[0].recept].id : null,
    }),
    orders: () => orders.map((o) => ({ recept: RECEPT[o.recept].id, namn: RECEPT[o.recept].namn, smak: o.smak !== undefined ? SMAKER[o.smak] : undefined, kvar: +o.kvar.toFixed(1) })),
    // forceOrder('burgare' | 'gron' | 'stora' | 'pommes' | 'lask' | 'shake' | 'glass', smak 0-2)
    forceOrder: (recept, smak) => { const o = spawnOrder(REC_IX[recept] ?? 0, smak); return o ? dbg.orders()[orders.length - 1] : null; },
    // Ett stationssteg direkt, utan gång. Ingredienser: 'underbrod' 'ost' 'sallad' 'tomat'
    // 'lok' 'pickles' 'dressing' 'overbrod'. Grillen: 'grill' (rå biff på), 'vand', 'stek'
    // (allt blir klart), 'brann' (allt bränns), 'tabiff' (ta klar biff), 'biff' (genväg:
    // perfekt biff läggs på tråget). Fritösen: 'pommesner', 'pommesklar', 'pommesbrann',
    // 'pommesupp', 'salta'. Maskinerna: 'lask', 'glass', 'shake' eller 'shake:jordgubb'
    // (fyller och tar direkt). Övrigt: 'trag' (lyft/lägg), 'bricka', 'klocka', 'sopor'.
    step(namn) {
      const [id, arg] = String(namn).split(':');
      if (LAGER[id] && id !== 'biff') actLager(id);
      else if (id === 'biff') { if (!carry) carry = { typ: 'biff', brand: false }; actLager('biff'); }
      else if (id === 'grill') actGrill(grill.findIndex((b) => !b) < 0 ? 0 : grill.findIndex((b) => !b));
      else if (id === 'vand') { const i = grill.findIndex((b) => b && b.sida === 0); if (i >= 0) { grill[i].tid = Math.max(grill[i].tid, T_SIDE); actGrill(i); } }
      else if (id === 'stek') grill.forEach((b) => { if (b && !b.brand) { b.sida = 1; b.tid = T_SIDE + 0.5; } });
      else if (id === 'brann') grill.forEach((b, i) => { if (b) { b.tid = T_BRANN; checkBrand(b, GRILL.slots[i]); } });
      else if (id === 'tabiff') { const i = grill.findIndex((b) => b && (b.brand || (b.sida === 1 && b.tid >= T_SIDE))); if (i >= 0) actGrill(i); }
      else if (id === 'pommesner') actFritos(fritos.findIndex((f) => !f) < 0 ? 0 : fritos.findIndex((f) => !f));
      else if (id === 'pommesklar') fritos.forEach((f) => { if (f && !f.brand) f.tid = Math.max(f.tid, T_FRY + 0.3); });
      else if (id === 'pommesbrann') fritos.forEach((f, i) => { if (f) { f.tid = T_FRY_BRANN; checkBrand(f, FRIT.korgar[i], 'fry'); } });
      else if (id === 'pommesupp') { const i = fritos.findIndex((f) => f); if (i >= 0) actFritos(i); }
      else if (id === 'salta' || id === 'salt') actSalt();
      else if (id === 'lask' || id === 'glass' || id === 'shake') {
        const smak = id === 'shake' ? (arg ? Math.max(0, SMAKER.findIndex((s) => s.toLowerCase() === arg.toLowerCase())) : (orders.find((o) => RECEPT[o.recept].id === 'shake')?.smak ?? 2)) : undefined;
        if (maskin[id]?.fas !== 'klar') { if (!maskin[id]) actMaskin(id, smak); if (maskin[id]) { maskin[id].fas = 'klar'; } }
        actMaskin(id);
      }
      else if (id === 'trag') actTray();
      else if (id === 'bricka') actBricka(bricka.findIndex((v) => !v) < 0 ? 0 : bricka.findIndex((v) => !v));
      else if (id === 'klocka') actBell();
      else if (id === 'sopor') actTrash();
      return dbg.state();
    },
    // Genväg: lyft det som är klart, ställ på brickan och ring i klockan.
    serve() {
      if (!carry && tray?.klar) actTray();
      if (carry) actBricka(bricka.findIndex((v) => !v) < 0 ? 0 : bricka.findIndex((v) => !v));
      actBell();
      return { stats, bricka: bricka.map(beskriv) };
    },
    // klickpunkter i spelkoordinater (för test via down(x, y))
    spot: (id) => ({
      grill0: [GRILL.slots[0], 60], grill1: [GRILL.slots[1], 60], grill2: [GRILL.slots[2], 60],
      fritos0: [FRIT.korgar[0], 58], fritos1: [FRIT.korgar[1], 58], salt: [SALT.x, 50],
      lask: [170, 45], shake: [206, 60], shakeC: [SHAKE.knapp[0], 47], shakeJ: [SHAKE.knapp[1], 47], shakeV: [SHAKE.knapp[2], 47],
      glass: [240, 45], underbrod: [BROD.xU, 112], overbrod: [BROD.xO, 112], trag: [TRAY.x, 116],
      ost: [104, 112], sallad: [126, 112], tomat: [148, 112], lok: [170, 112], pickles: [192, 112], dressing: [DRESS.x, 112],
      bricka0: [BRICKA.spots[0], 68], bricka1: [BRICKA.spots[1], 68], bricka2: [BRICKA.spots[2], 68],
      klocka: [BELL.x, 62], sopor: [TRASH.x, TRASH.y - 12],
    })[id] || null,
    busy: () => walker.path.length > 0,
  };

  // ---------- dynamisk ritning ----------
  function drawBiffOnGrill(ctx, x, b) {
    const y0 = GRILL.slotY - 3, k = Math.min(1, b.tid / T_SIDE);
    let top;
    if (b.brand) top = 0x241209;
    else if (b.sida === 0) top = mix(0xd97f6a, 0x9a5636, k);          // rå ovansida mörknar
    else top = mix(0x9a5636, 0x6a3820, k);                             // vänd: stekta sidan upp
    ctx.fillStyle = css(mix(top, 0xffffff, b.brand ? 0.04 : 0.16)); ctx.fillRect(x - 5, y0, 11, 1);
    ctx.fillStyle = css(top); ctx.fillRect(x - 6, y0 + 1, 13, 2);
    ctx.fillStyle = css(mul(top, 0.55)); ctx.fillRect(x - 5, y0 + 3, 11, 1);
    if (b.sida === 1 && !b.brand) { ctx.fillStyle = '#5a2c1a'; for (let g = -4; g <= 4; g += 3) ctx.fillRect(x + g, y0 + 1, 1, 1); }   // grillränder
    if (!b.brand && Math.sin(t * 11 + x) > 0.2) { ctx.fillStyle = '#fff6dc'; ctx.fillRect(x - 6 + ((t * 13 + x) | 0) % 12, y0 - 1, 1, 1); }  // fräser
  }
  function drawKorg(ctx, x, f) {
    if (!f) {                                                          // tom korg uppfälld
      ctx.fillStyle = '#5a646e'; ctx.fillRect(x - 6, 45, 12, 7);
      ctx.fillStyle = '#8e98a4';
      for (let i = -5; i <= 5; i += 2) ctx.fillRect(x + i, 46, 1, 5);
      for (let j = 47; j < 51; j += 2) ctx.fillRect(x - 5, j, 10, 1);
      ctx.fillStyle = '#2a2d33'; ctx.fillRect(x + 5, 42, 2, 4);        // handtaget
      return;
    }
    const fk = Math.min(1, f.tid / T_FRY);
    const c = f.brand ? 0x4a2c12 : mix(0xf7e8c0, 0xf0b83a, fk);
    ctx.fillStyle = '#49525c'; ctx.fillRect(x - 7, 53, 14, 4);          // korgens kant i oljan
    ctx.fillStyle = '#6a747e'; for (let i = -6; i <= 6; i += 2) ctx.fillRect(x + i, 53, 1, 3);
    ctx.fillStyle = css(c);                                             // pommes-toppar
    for (let i = -5; i <= 5; i += 2) ctx.fillRect(x + i, 52 - ((i + 7) % 3 ? 0 : 1), 1, 2);
    ctx.fillStyle = '#2a2d33'; ctx.fillRect(x + 6, 47, 2, 6);
    for (let i = 0; i < 4; i++) {                                       // oljan bubblar
      const bx = x - 6 + (((t * 9 + i * 3.7 + x) % 1) * 12 | 0), on = Math.sin(t * 12 + i * 2.1 + x) > 0.3;
      if (on) { ctx.fillStyle = i & 1 ? '#ffe9a0' : '#fff6dc'; ctx.fillRect(bx, 56, 1, 1); }
    }
  }
  function drawMaskiner(ctx) {
    const rita = (typ, mx, py) => {
      const m = maskin[typ];
      if (!m) return;
      if (m.fas === 'klar') { const s = typ === 'shake' ? shakeSprite(m.smak) : menySprite(typ); ctx.drawImage(s, mx - (s.width >> 1), py - s.height); return; }
      const k = Math.min(1, m.t / m.dur), ch = Math.round(6 * k);
      const cc = typ === 'lask' ? 0x3a2418 : typ === 'shake' ? SMAK_PAL[m.smak].f : 0xfff6ec;
      ctx.fillStyle = '#eef3f6'; ctx.fillRect(mx - 3, py - 8, 7, 8);                       // koppen
      ctx.fillStyle = '#b4bfcc'; ctx.fillRect(mx + 3, py - 8, 1, 8);
      ctx.fillStyle = css(cc); ctx.fillRect(mx - 2, py - 1 - ch, 5, ch);                   // fylls på
      ctx.fillStyle = css(mix(cc, 0xffffff, 0.5)); ctx.fillRect(mx - 2, py - 9 - ((t * 16 | 0) % 3), 1, 2);  // strålen
    };
    rita('lask', 170, 63); rita('shake', SHAKE.x0 + 16, 61); rita('glass', GLASS.x0 + 12, 61);
  }
  function drawBell(ctx) {
    const ring = bellT > 0, j = ring && (t * 12 | 0) % 2 ? 1 : 0;
    ctx.fillStyle = '#2a2d33'; ctx.fillRect(BELL.x - 6, BELL.y + 1, 13, 2);                // fotplattan
    ctx.fillStyle = '#8a6a1c'; ctx.fillRect(BELL.x - 5 + j, BELL.y - 4, 11, 5);            // kupan
    ctx.fillStyle = '#d8b24a'; ctx.fillRect(BELL.x - 4 + j, BELL.y - 5, 9, 5);
    ctx.fillStyle = '#ffe07a'; ctx.fillRect(BELL.x - 3 + j, BELL.y - 5, 2, 3);
    ctx.fillStyle = '#5a4310'; ctx.fillRect(BELL.x - 1 + j, BELL.y - 7, 3, 2);
    if (ring) {
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(BELL.x - 9, BELL.y - 8, 1, 2); ctx.fillRect(BELL.x + 9, BELL.y - 8, 1, 2);
      ctxText(ctx, SMALL, 'PLING!', BELL.x - 11, BELL.y - 16, '#ffd23f');
    }
  }
  function drawSteamOver(ctx) {
    for (let i = 0; i < 6; i++) {
      const ph = (t * 0.7 + i * 0.31) % 1, bx = GRILL.x0 + 12 + (i % 3) * 26;
      const sx = bx + Math.round(Math.sin(t * 2.3 + i * 1.7) * 1.5), sy = 52 - Math.round(ph * 13);
      ctx.fillStyle = `rgba(255,255,255,${(0.4 * (1 - ph)).toFixed(2)})`;
      ctx.fillRect(sx, sy, 1, 1 + (ph > 0.5 ? 1 : 0));
    }
  }
  function updParts(dt) {
    for (const p of parts) {
      if (p.k === 'arc') p.t += dt;
      else { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.k === 'puff') p.vy += 18 * dt; }
    }
    parts = parts.filter((p) => (p.k === 'arc' ? p.t < p.dur : p.age < p.life));
  }
  function drawParts(ctx) {
    for (const p of parts) {
      if (p.k === 'arc') {
        if (p.t < 0) continue;
        const q = p.t / p.dur, x = p.x0 + (p.x1 - p.x0) * q, y = p.y0 + (p.y1 - p.y0) * q - p.h * 4 * q * (1 - q);
        ctx.fillStyle = css(p.c); ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      } else if (p.k === 'puff') {
        ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
        ctx.fillStyle = css(p.c); ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        ctx.globalAlpha = 1;
      } else {
        const q = p.age / p.life, s = q < 0.35 ? 2 : 3;
        ctx.fillStyle = `rgba(${q < 0.3 ? '96,90,88' : '168,162,160'},${(0.85 * (1 - q)).toFixed(2)})`;
        ctx.fillRect(Math.round(p.x) - (s >> 1), Math.round(p.y), s, s - 1);
      }
    }
  }
  // nedersta raden: nästa beställning med stegen i rätt ordning (gjorda = grå, nästa = vit)
  function drawNextRow(ctx) {
    ctx.fillStyle = 'rgba(23,21,26,0.85)'; ctx.fillRect(0, FH - 12, FW, 12);
    const o = orders[0];
    let x = 4;
    const put = (s, c) => { ctxText(ctx, SMALL, s, x, FH - 9, c); x += textW(SMALL, s) + 4; };
    if (!o) { put('INGA BESTÄLLNINGAR JUST NU - PASSA PÅ ATT LÄGGA PÅ BIFFAR!', '#ffd23f'); return; }
    const rec = RECEPT[o.recept];
    put('NÄSTA:', '#8ec0ff');
    put(rec.namn + (rec.id === 'shake' ? ' (' + SMAKER[o.smak] + ')' : ''), '#f4f1ea');
    put('-', '#6e7684');
    if (isBurgare(o.recept)) {
      const prog = tray && tray.recept === o.recept ? tray.lager.length : 0;
      rec.steg.forEach((st, i) => put(STEG_NAMN[st], i < prog ? '#6e7684' : i === prog ? '#ffffff' : '#ffd23f'));
    } else put(STEG_NAMN[rec.steg[0]], '#ffd23f');
  }

  return {
    _debug: dbg,
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    enter() {},
    exit() { talk.clear(); },
    update(dt) {
      pops.update(dt);
      updParts(dt);
      if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone?.(stats); } return; }
      t += dt;
      if (t >= SHIFT_SECONDS) { done = true; return; }
      walker.update(dt);
      if (workT > 0) workT -= dt;
      if (bellT > 0) bellT -= dt;
      if (trashT > 0) trashT -= dt;
      if (!saidIntro && t > 0.8) { saidIntro = true; bellaSay('HEJ KOCKEN! BYGG DET SOM STÅR PÅ LAPPARNA OCH RING I KLOCKAN! 🍔'); }
      // grillen steker
      grill.forEach((b, i) => {
        if (!b) return;
        const fore = b.tid;
        b.tid += dt;
        if (!b.brand) {
          if (fore < T_SIDE && b.tid >= T_SIDE) { play('ok'); pops.add(GRILL.slots[i], 46, b.sida === 0 ? 'VÄND MIG!' : 'KLAR!', b.sida === 0 ? '#ffd23f' : '#8ee03c'); }
          checkBrand(b, GRILL.slots[i]);
        } else if (Math.random() < dt * 7) smoke(GRILL.slots[i], 52);
      });
      // fritösen fräser
      fritos.forEach((f, i) => {
        if (!f) return;
        const fore = f.tid;
        f.tid += dt;
        if (!f.brand) {
          if (fore < T_FRY && f.tid >= T_FRY) { play('ok'); pops.add(FRIT.korgar[i], 42, 'UPP MED KORGEN!', '#8ee03c'); }
          checkBrand(f, FRIT.korgar[i], 'fry');
        } else if (Math.random() < dt * 7) smoke(FRIT.korgar[i], 50);
      });
      // maskinerna fyller
      for (const [typ, m] of Object.entries(maskin)) {
        if (!m || m.fas !== 'fyller') continue;
        m.t += dt;
        if (m.t >= m.dur) { m.fas = 'klar'; play('ok'); pops.add(typ === 'lask' ? 170 : typ === 'shake' ? 206 : 240, 26, 'KLAR!', '#8ee03c'); }
      }
      // nya beställningar på skenan
      orderIn -= dt;
      if (orderIn <= 0) {
        orderIn = 8.5 - 3.5 * Math.min(1, t / SHIFT_SECONDS) + hash(seq, 3) * 2.5;
        spawnOrder(seq === 0 ? 0 : undefined);   // första lappen är alltid en vanlig burgare
      }
      // tålamodet rinner ut
      for (let i = orders.length - 1; i >= 0; i--) {
        const o = orders[i];
        o.kvar -= dt;
        if (o.kvar <= 0) {
          orders.splice(i, 1);
          stats.miss++; play('miss');
          pops.add(LUCK.x0 + 10 + i * TICKET_PITCH, 40, 'EN GÄST TRÖTTNADE...', '#d8d2c0');
        }
      }
      if (orders.some((o) => o.kvar < 9)) bellaSay('SKYNDA DIG - EN GÄST HAR VÄNTAT LÄNGE!');
      // Bella går av och an där ute
      if (bella.pauseT > 0) bella.pauseT -= dt;
      else {
        bella.x += bella.dir * 7 * dt;
        if (bella.x > 340) bella.dir = -1;
        if (bella.x < 276) bella.dir = 1;
        if (Math.random() < dt * 0.25) bella.pauseT = 1 + Math.random() * 2;
      }
    },
    move(x, y) { hover = done ? null : stationAt(x, y); },
    down(x, y) {
      if (done) return;
      const s = stationAt(x, y);
      if (s) { doStation(s); return; }
      walker.walkTo(x, y);
    },
    key(k) { if (k === 'Escape' && !done) abortShift(A); },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.drawImage(bg(), 0, 0);
      drawSteamOver(ctx);
      // Bella syns genom luckan (klipps mot öppningen)
      ctx.save(); ctx.beginPath(); ctx.rect(LUCK.x0, LUCK.oy0, LUCK.x1 - LUCK.x0, LUCK.oy1 - LUCK.oy0); ctx.clip();
      const bm = bella.pauseT <= 0;
      drawPerson(ctx, bella.x, 86, bellaLook, bm ? (bella.dir < 0 ? 'left' : 'right') : 'down', bm ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2) > 0.9 ? 4 : 0));
      ctx.restore();
      // grillen och fritösen
      GRILL.slots.forEach((sx, i) => { if (grill[i]) drawBiffOnGrill(ctx, sx, grill[i]); drawGauge(ctx, sx - 9, 76, grill[i] ? grill[i].tid : null, T_SIDE, T_BRANN); });
      FRIT.korgar.forEach((kx, i) => { drawKorg(ctx, kx, fritos[i]); drawGauge(ctx, kx - 9, 70, fritos[i] ? fritos[i].tid : null, T_FRY, T_FRY_BRANN); });
      drawMaskiner(ctx);
      // rätterna på brickan + klockan
      BRICKA.spots.forEach((sx, s) => { const it = bricka[s]; if (!it) return; const sp = carrySprite(it); ctx.drawImage(sp, sx - (sp.width >> 1), BRICKA.y + 2 - sp.height); });
      drawBell(ctx);
      // soptunnans lock slår upp
      if (trashT > 0) { ctx.fillStyle = '#6a747e'; ctx.fillRect(TRASH.x + 6, TRASH.y - 34, 12, 3); ctx.fillStyle = '#a8b2bc'; ctx.fillRect(TRASH.x + 7, TRASH.y - 34, 10, 1); }
      // beställningslapparna på skenan
      const blink = (t * 4 | 0) % 2;
      orders.slice(0, MAX_TICKETS).forEach((o, i) => drawTicket(ctx, o, LUCK.x0 + 2 + i * TICKET_PITCH, blink));
      // figurerna + ön (tråget och burgarbygget ritas med ön, framför kocken bakom bänken)
      const drawables = [...folkDrawables(A, t), selfDrawable(A, walker, t, { carry: !!carry || workT > 0 })];
      if (carry) {
        const sp = carrySprite(carry), dir = walker.dir;
        const ox = dir === 'left' ? -8 : dir === 'right' ? 8 : 0;
        const cx = Math.round(walker.px) + ox - (sp.width >> 1), cy = Math.round(walker.py) - 12 - (sp.height - 1);
        drawables.push({ fy: walker.py + (dir === 'up' ? -0.01 : 0.01), draw: () => ctx.drawImage(sp, cx, cy) });
      }
      drawables.push({
        fy: ISL.base,
        draw: () => {
          ctx.drawImage(island(), 0, 0);
          if (tray && tray.lager.length) { const sp = burgSprite(tray.lager); ctx.drawImage(sp, TRAY.x - (sp.width >> 1), TRAY.y + 3 - sp.height); }
          if (tray) {
            const s = 'BYGGER: ' + RECEPT[tray.recept].namn, w = textW(SMALL, s) + 4;
            ctx.fillStyle = 'rgba(23,21,26,0.8)'; ctx.fillRect(TRAY.x - (w >> 1), ISL.front + 2, w, 9);
            ctxText(ctx, SMALL, s, TRAY.x - (w >> 1) + 2, ISL.front + 4, tray.klar ? '#8ee03c' : '#ffd23f');
          }
        },
      });
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      drawParts(ctx);
      pops.draw(ctx);
      talk.draw(ctx, { x0: 0, x1: FW });
      // namnlapp för stationen under muspekaren
      if (hover && !done) {
        const w = textW(SMALL, hover.namn) + 4;
        const hx = hover.k === 'grill' ? GRILL.slots[hover.i] : hover.k === 'fritos' ? FRIT.korgar[hover.i] : hover.k === 'salt' ? SALT.x : hover.k === 'lask' ? 170 : hover.k === 'shake' ? 206 : hover.k === 'glass' ? 240 : hover.k === 'klocka' ? BELL.x : hover.k === 'bricka' ? BRICKA.spots[hover.spot] : hover.k === 'sopor' ? TRASH.x : hover.k === 'trag' ? TRAY.x : hover.ax;
        const hy = hover.k === 'lager' || hover.k === 'trag' ? 98 : hover.k === 'sopor' ? TRASH.y - 36 : hover.k === 'bricka' || hover.k === 'klocka' ? 82 : 36;
        const x0 = Math.max(1, Math.min(FW - w - 1, Math.round(hx - w / 2)));
        ctx.fillStyle = 'rgba(23,21,26,0.85)'; ctx.fillRect(x0, hy, w, 9);
        ctxText(ctx, SMALL, hover.namn, x0 + 2, hy + 2, '#ffd23f');
      }
      // en rad hjälp i början
      if (t < 10 && !done) {
        const s = 'BYGG PÅ TRÅGET I LAPPENS ORDNING - STÄLL PÅ BRICKAN - RING I KLOCKAN!', w = textW(SMALL, s) + 8;
        ctx.globalAlpha = t > 9 ? 10 - t : 1;
        ctx.fillStyle = 'rgba(23,21,26,0.85)'; ctx.fillRect((FW - w) >> 1, 146, w, 10);
        ctxText(ctx, SMALL, s, ((FW - w) >> 1) + 4, 149, '#ffd23f');
        ctx.globalAlpha = 1;
      }
      drawNextRow(ctx);
      drawShiftHud(ctx, { W: FW }, { t, dur: SHIFT_SECONDS, ok: stats.ok, fel: stats.fel, title: 'BURGARKÖKET' });
      if (done) drawTimeUp(ctx, { W: FW, H: FH });
    },
  };
}
