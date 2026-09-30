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
// Jobbar man ihop (💼, js/jobs/shift.js) delar kockarna skenan, grillen, fritösen,
// maskinerna och brickan – se "jobba tillsammans" nedan.
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, ctxText, textW, text, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ, createSpeech } from '../scenes/walkable.js';
import { planOf, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';
import { JOBS } from '../game.js';
import { burgarMeny } from './jobb-burgare.js';
import { makeShiftCoop } from '../net/coop.js';

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
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------- jobba ihop: det som skickas mellan kockarna ----------
const MASK = ['lask', 'shake', 'glass'];                  // maskinerna i snappen (index = kod)
const MASK_X = { lask: 170, shake: 206, glass: 240 };     // där maskinernas rop syns
const TYPER = ['biff', 'burgare', 'pommes', 'lask', 'shake', 'glass'];   // det man bär (index = kod)
const LJUD = new Set(['click', 'miss', 'slide', 'ok', 'fel', 'box', 'coin', 'chirp']);
// En sak – det man bär, eller det som står på brickan – som fyra tal:
// [typ, rätt (−1), smak (−1), 1 saltad | 2 bränd | 4 redan räknad som fel]. 0 = tomt.
const itemEnc = (c) => (c ? [TYPER.indexOf(c.typ), c.recept ?? -1, c.smak ?? -1, (c.saltad ? 1 : 0) | (c.brand ? 2 : 0) | (c.feld ? 4 : 0)] : 0);
function itemDec(a) {
  if (!Array.isArray(a)) return null;
  const typ = TYPER[a[0] | 0], f = a[3] | 0;
  if (!typ) return null;
  let c;
  if (typ === 'biff') c = { typ, brand: !!(f & 2) };
  else if (typ === 'burgare') { const r = a[1] | 0; if (!RECEPT[r] || !isBurgare(r)) return null; c = { typ, recept: r }; }
  else if (typ === 'pommes') c = { typ, saltad: !!(f & 1), brand: !!(f & 2) };
  else if (typ === 'shake') c = { typ, smak: clamp(a[2] | 0, 0, 2) };
  else c = { typ, smak: undefined };   // läsk, glass
  if (f & 4) c.feld = true;
  return c;
}

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
// mark = färgen på märket i nedre vänstra hörnet när en kock bygger lappen (bara ihop)
function drawTicket(ctx, o, x, blink, mark = null) {
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
  if (mark) { ctx.fillStyle = mark; ctx.fillRect(x + 1, y + TICKET_H - 5, 2, 4); }   // (märket får plats vänster om texten)
  if (o.kvar < 8 && blink) {
    // varningslampan ritas INNANFÖR lappen – skenan är tät (lapp 16 px, delning 17)
    // så en platta utanför högerkanten skulle skymma nästa lapps tålamodsrand
    ctx.fillStyle = '#17151a'; ctx.fillRect(x + TICKET_W - 6, y - 3, 5, 10);
    ctx.fillStyle = '#d9433b'; ctx.fillRect(x + TICKET_W - 5, y - 2, 3, 5); ctx.fillRect(x + TICKET_W - 5, y + 4, 3, 2);
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
  // ---------- golvdekaler: fläckar, spill och spår (platta – kocken går över dem) ----------
  P.ell(44, 149, 7, 3, 0x241c12, 0.2);                       // fettfläckar nedanför grillen
  P.ell(56, 153, 4, 2, 0x241c12, 0.15);
  P.ell(118, 148, 5, 2, 0x241c12, 0.13);                     // ...och vid fritösen
  for (const [fx, fy] of [[115, 145], [121, 149], [126, 144]]) { P.px(fx, fy, 0xf0b83a); P.px(fx + 1, fy, 0xd89a28); }   // tappade pommes
  P.px(206, 148, 0x6a9a2c); P.px(207, 148, 0x9ac84a);        // en picklesskiva som trillat
  for (const [sx, sy, sw] of [[70, 159, 9], [180, 158, 8], [206, 166, 7], [252, 151, 10], [296, 161, 6]]) P.darken(sx, sy, sw, 1, 0.88);   // hjulspår efter vagnen
  P.ell(150, 182, 14, 5, 0xaec6ba, 0.1);                     // nyskurat och vått kring brunnen
  P.ell(129, 171, 9, 4, 0xaec6ba, 0.08);
  // moppen ligger på golvet bredvid hinken
  P.line(306, 187, 284, 196, 0x9a6a3a); P.line(306, 188, 284, 197, 0x6a4424);
  P.px(303, 187, 0xc08a54);
  P.rect(281, 193, 4, 4, 0x6a747e); P.hl(281, 193, 4, 0xa8b2bc);   // kragen som håller garnet
  for (let i = 0; i < 7; i++) { const gx = 269 + i * 2, gy = 194 + (i % 3), gh = 4 + (i % 2); P.vl(gx, gy, gh, i & 1 ? 0xd8d2c0 : 0xb0aa9c); P.px(gx, gy + gh, 0x8a8478); }
  P.ell(276, 200, 9, 2, 0xaec6ba, 0.12);
  P.box(0, 0, FW, FH, 0x0e0d12);
  return P.flush();
}

// ---------- golvrekvisitan: lastpall, läskbackar, halt-skylt och hink ----------
// Målas separat och ritas med djupsortering (fy = basen) så att kocken kan
// stå BAKOM rekvisitan utan att hamna framför den i bilden.
const PROPS_Z = [
  { x: 6, y: 162, w: 52, h: 42, fy: 203 },    // lastpallen med brödlådorna
  { x: 84, y: 173, w: 33, h: 29, fy: 202 },   // läskbackarna
  { x: 152, y: 169, w: 29, h: 23, fy: 191 },  // halt-skylten vid brunnen
  { x: 305, y: 182, w: 23, h: 19, fy: 200 },  // hinken
];
function paintProps() {
  const P = new Pix(FW, FH);
  // -- lastpallen i vänstra hörnet: träpall med brödlådor från grossisten --
  P.rect(8, 195, 48, 3, 0x9a6a3a); P.hl(8, 195, 48, 0xc08a54);
  for (const gx of [18, 30, 42]) P.vl(gx, 195, 3, 0x4a2e16);        // springorna
  P.hl(8, 198, 48, 0x3a2412);
  P.rect(8, 199, 48, 3, 0x6a4424);
  for (const fx of [8, 28, 49]) P.rect(fx, 199, 7, 3, 0x50321a);    // klossarna
  P.darken(7, 202, 50, 1, 0.7);
  const lada = (x, y, w, h) => {                                    // en kartong
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++)
      P.px(xx, yy, mix(0xbe9152, 0xa87c42, (yy - y) / h + (bayer(xx, yy) - 0.5) * 0.2));
    P.hl(x, y, w, 0xe0b478); P.vl(x, y + 1, h - 1, 0xd0a468);
    P.vl(x + w - 1, y + 1, h - 1, 0x8a6034); P.hl(x + 1, y + h - 1, w - 1, 0x74522a);
    P.hl(x + 1, y + 3, w - 2, 0x8a6034);                            // lockets skarv
  };
  lada(10, 179, 22, 16); lada(32, 179, 21, 16); lada(19, 165, 24, 14);
  P.rect(20, 187, 2, 6, 0xd8c9a4); P.px(20, 187, 0xece0c0);         // tejp på vänstra lådan
  P.rect(41, 186, 5, 2, 0x8a6034); P.rect(41, 189, 8, 1, 0x8a6034); // fraktstämpel på högra
  text(P, SMALL, 'BRÖD', 23, 170, 0x6a4a24);
  // -- läskbackarna: två staplade, samma röda som läskautomaten, flaskhalsar uppstickande --
  const back = (x, y, spjalor) => {
    for (let yy = y; yy < y + 11; yy++) for (let xx = x; xx < x + 28; xx++)
      P.px(xx, yy, mix(0xbe2530, 0x9c1c26, (yy - y) / 11 + (bayer(xx, yy) - 0.5) * 0.2));
    P.hl(x, y, 28, 0xe86050); P.vl(x, y + 1, 10, 0xd8453a);
    P.vl(x + 27, y + 1, 10, 0x8e1a22); P.hl(x, y + 10, 28, 0x6e1218);
    if (spjalor) for (let i = 1; i < 7; i++) P.vl(x + i * 4, y + 2, 7, 0x7e161e);
  };
  back(86, 190, false); back(86, 179, true);
  text(P, SMALL, 'LÄSK', 92, 193, 0xffd0c8);
  for (let i = 0; i < 6; i++) {                                     // kapsyler + halsar
    const bx = 89 + i * 4;
    P.px(bx, 175, i === 2 ? 0xd9433b : 0xf0c02a);
    P.vl(bx, 176, 3, 0x4a2c1a); P.px(bx, 177, 0x8a5a3a);
  }
  P.darken(85, 201, 30, 1, 0.72);
  // -- varningsskylten vid golvbrunnen (nyskurat = HALT) --
  for (let y = 173; y <= 189; y++) {
    const hw = 3 + Math.round(((y - 173) * 9) / 16);
    for (let x = 166 - hw; x <= 166 + hw; x++) {
      let c = mix(0xffd23f, 0xd9a41e, (y - 173) / 16 + (bayer(x, y) - 0.5) * 0.18);
      if (x === 166 - hw || x === 166 + hw) c = 0x8a6a10;
      if (y === 189) c = 0x6e5208;
      P.px(x, y, c);
    }
  }
  P.rect(164, 171, 5, 2, 0x8a6a10); P.px(165, 171, 0xffe27a);       // toppöglan
  P.rect(165, 174, 2, 4, 0x3a2c08); P.rect(165, 179, 2, 2, 0x3a2c08); // utropstecknet
  text(P, SMALL, 'HALT', 159, 183, 0x3a2c08);
  P.darken(157, 190, 19, 1, 0.78);
  // -- hinken (moppen ligger bredvid, målad i golvet) --
  for (let y = 184; y <= 198; y++) {
    const hw = 8 - Math.round(((y - 184) * 2) / 14);
    for (let x = 316 - hw; x <= 316 + hw; x++) {
      let c = mix(0xb4bec8, 0x6e7882, (x - (316 - hw)) / (hw * 2) + (bayer(x, y) - 0.5) * 0.14);
      if (y === 184) c = 0xd8e0e6;
      if (x === 316 - hw || x === 316 + hw) c = 0x49525c;
      P.px(x, y, c);
    }
  }
  P.hl(310, 185, 13, 0x3e6272); P.px(313, 185, 0x9ed0e0); P.px(318, 185, 0x86b8c8);   // skurvattnet
  P.px(308, 186, 0x2e3840); P.px(324, 186, 0x2e3840);               // grepens fästen
  P.darken(309, 199, 15, 1, 0.72);
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
  const stats = { ok: 0, fel: 0, miss: 0, dricks: 0, dricksKr: 0, brand: 0 }; // dricksKr läggs på lönen (shift.js)
  const wage = JOBS.kok?.wage ?? 11;   // huvudagenten lägger in JOBS.kok i game.js
  const P = planOf(A);   // passets plan: längd (P.seconds) och lapptakt (P.pace) efter vanan
  const walker = createWalker({ top: 92, bottom: FH - 5, spawn: [TRAY.x, STAND_Y] });
  walker.setObstacles([
    [ISL.x0, ISL.front + 1, ISL.x1, ISL.base],               // bänkön (kocken står bakom, som i pizzerian)
    [TRASH.x - 11, TRASH.y - 26, TRASH.x + 11, TRASH.y + 1], // soptunnan
    [6, 178, 57, 203],                                       // lastpallen med brödlådorna
    [84, 176, 115, 201],                                     // läskbackarna
    [153, 175, 179, 191],                                    // halt-skylten vid brunnen
    [305, 181, 327, 199],                                    // hinken (moppen är platt och gåbar)
  ]);
  const pops = makePops();
  const popLog = [];   // de senaste puffarnas text (provet läser dem: syntes "HANN FÖRE!"?)
  const addPop = pops.add;
  pops.add = (x, y, txt, c) => { popLog.push(txt); if (popLog.length > 30) popLog.shift(); addPop(x, y, txt, c); };
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
  let nid = 0;                         // id:n till det som står på stationerna (biffar, korgar, koppar, brickan)
  let carry = null;                    // { typ, recept?, smak?, saltad?, brand?, feld? }
  let tray = null;                     // { recept, lager: [], klar } – burgaren på tråget
  const grill = [null, null, null];    // { id, sida: 0|1, tid, brand, by } per platta (by = kocken som lade på den)
  const fritos = [null, null];         // { id, tid, brand, by } per korg
  const maskin = { lask: null, shake: null, glass: null };   // { id, fas: 'fyller'|'klar', t, dur, smak }
  const bricka = [null, null, null];   // saken + { id, by } (by = kocken som ställde dit den)
  let bellT = 0, trashT = 0, workT = 0, hover = null, parts = [];
  let done = false, doneT = 0, reported = false;
  const cache = {};
  const bg = () => (cache.bg ||= paintKok());
  const island = () => (cache.isl ||= paintIsland());
  const props = () => (cache.props ||= paintProps());

  // ---------- hjälpare ----------
  function hint(txt, x, y) { pops.add(x, y, txt, '#ffd23f'); play('click'); }
  // brända saker ger EN gång fel när man försöker använda dem – sedan bara påminnelser
  function felOnce(obj, txt, x, y) {
    if (obj.feld) { hint(txt, x, y); return; }
    obj.feld = true; felMin(); play('fel'); pops.add(x, y, txt, '#ff6a6a');
  }
  // ett fel med det egna (tråget, saltet, det man bär): mitt – och lagets, som skiftledaren räknar
  function felMin() { stats.fel++; if (mate()) coop.send({ t: 'fel' }); else { team.fel++; snapAsap(); } }
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

  // ---------- jobba tillsammans (delat pass via js/net/coop.js) ----------
  // Skiftledaren (den som varit längst i köket) kör det gemensamma: lapparna på skenan (nya
  // beställningar och gästernas tålamod), grillen, fritösen, läsk-, shake- och glassmaskinen och
  // brickan vid luckan med klockan. Läget delas ~3 ggr/s; medarbetarna ser samma kök och skickar
  // varje handling vid en gemensam station som ett önskemål – skiftledaren kör samma kod åt dem
  // (med det de bär i händerna) och är ENDA domaren: en biff tas från grillen EN gång, en lapp
  // serveras EN gång. Tråget (burgaren man bygger), backarna, saltet, soptunnan och det man bär
  // är var och ens egna – två kockar bygger var sin burgare, och den som börjar på ett tråg tar
  // första burgarlappen som ingen annan redan bygger (lappen får ett märke). Poängen och dricksen
  // går till kocken som ställde rätten på brickan – den som lagade den – vem som än ringer i
  // klockan. Lagets rätt, fel och missade delas lika vid passets slut; dricksen behåller var och
  // en (den läggs på lönen efter nivåbonusen, shift.js). Ihop kommer lapparna tätare.
  const coop = makeShiftCoop(A, 'away:jobbkok');
  let snapIn = 0, wasLead = true, wasCoop = false, maxN = 1, snaps = 0;
  let pend = null, queued = null;          // medarbetarens önskemål som väntar på svar (och ett köat klick)
  const team = { ok: 0, fel: 0, miss: 0 }; // LAGETS räkning – delas lika vid passets slut
  const mate = () => coop.active && !coop.leader;
  const snapAsap = () => { snapIn = 0; };
  const int = (v, dflt) => (Number.isInteger(v) ? v : dflt);
  const str = (v) => (typeof v === 'string' ? v.slice(0, 80) : '');
  const here = (id) => id === coop.myId || coop.peers().some((f) => f.id === id);
  // bygger en ANNAN kock redan den här lappen? (den som gått därifrån räknas inte)
  const annans = (o) => coop.active && !!o.kock && o.kock !== coop.myId && here(o.kock);
  const sendSnap = () => coop.send({
    t: 'snap',
    // lapp: [id, rätt, smak (−1), tålamod·10, kocken som bygger den ('' = ingen)]
    or: orders.map((o) => [o.id, o.recept, o.smak ?? -1, Math.round(o.kvar * 10), o.kock || '']),
    // grillen: per platta [id, sida, tid·100, bränd, vems] eller 0 (hundradelarna avrundas nedåt)
    gr: grill.map((b) => (b ? [b.id, b.sida, Math.floor(b.tid * 100), b.brand ? 1 : 0, b.by || ''] : 0)),
    // fritösen: per korg [id, tid·100, bränd, vems] eller 0
    fr: fritos.map((f) => (f ? [f.id, Math.floor(f.tid * 100), f.brand ? 1 : 0, f.by || ''] : 0)),
    // maskinerna (MASK-ordning): [id, klar, t·100, smak (−1)] eller 0
    ma: MASK.map((typ) => { const m = maskin[typ]; return m ? [m.id, m.fas === 'klar' ? 1 : 0, Math.floor(m.t * 100), m.smak ?? -1] : 0; }),
    // brickan: per plats [id, vem som ställde dit den, ...saken (itemEnc)] eller 0
    br: bricka.map((it) => (it ? [it.id, it.by || '', ...itemEnc(it)] : 0)),
    tm: [team.ok, team.fel, team.miss],
  });
  const applySnap = (m) => {
    if (Array.isArray(m.or)) {
      const next = [];
      for (const a of m.or.slice(0, MAX_TICKETS)) {
        if (!Array.isArray(a)) continue;
        const id = a[0] | 0, r = clamp(a[1] | 0, 0, RECEPT.length - 1);
        seq = Math.max(seq, id + 1);   // (tar jag över passet senare fortsätter numreringen härifrån – inga krockar)
        let o = orders.find((q) => q.id === id);
        if (!o) { o = { id }; if (snaps) play('chirp'); }   // en ny lapp plingar hos alla
        o.recept = r; o.max = RECEPT[r].max;
        o.smak = RECEPT[r].id === 'shake' ? clamp(a[2] | 0, 0, 2) : undefined;
        o.kvar = clamp((a[3] | 0) / 10, 0, o.max);
        o.kock = str(a[4]);
        next.push(o);
      }
      orders = next;
    }
    if (Array.isArray(m.gr)) for (let i = 0; i < 3; i++) {
      const a = m.gr[i];
      if (!Array.isArray(a)) { grill[i] = null; continue; }
      const id = a[0] | 0, old = grill[i] && grill[i].id === id ? grill[i] : null, b = old || { id };
      b.sida = a[1] ? 1 : 0; b.tid = Math.max(0, (a[2] | 0) / 100); b.brand = !!a[3]; b.by = str(a[4]);
      grill[i] = b;
      ropaGrill(i, !old);
    }
    if (Array.isArray(m.fr)) for (let i = 0; i < 2; i++) {
      const a = m.fr[i];
      if (!Array.isArray(a)) { fritos[i] = null; continue; }
      const id = a[0] | 0, old = fritos[i] && fritos[i].id === id ? fritos[i] : null, f = old || { id };
      f.tid = Math.max(0, (a[1] | 0) / 100); f.brand = !!a[2]; f.by = str(a[3]);
      fritos[i] = f;
      ropaKorg(i, !old);
    }
    if (Array.isArray(m.ma)) MASK.forEach((typ, j) => {
      const a = m.ma[j];
      if (!Array.isArray(a)) { maskin[typ] = null; return; }
      const id = a[0] | 0, old = maskin[typ] && maskin[typ].id === id ? maskin[typ] : null, mm = old || { id, dur: FYLL_TID[typ] };
      mm.fas = a[1] ? 'klar' : 'fyller'; mm.t = Math.max(0, (a[2] | 0) / 100);
      mm.smak = typ === 'shake' ? clamp(a[3] | 0, 0, 2) : undefined;
      maskin[typ] = mm;
      ropaMaskin(typ, !old);
    });
    if (Array.isArray(m.br)) for (let s = 0; s < 3; s++) {
      const a = m.br[s], it = Array.isArray(a) ? itemDec(a.slice(2)) : null;
      bricka[s] = it ? Object.assign(it, { id: a[0] | 0, by: str(a[1]) }) : null;
    }
    if (Array.isArray(m.tm)) { team.ok = m.tm[0] | 0; team.fel = m.tm[1] | 0; team.miss = m.tm[2] | 0; }
    for (const x of [...grill, ...fritos, ...MASK.map((typ) => maskin[typ]), ...bricka]) if (x) nid = Math.max(nid, (x.id | 0) + 1);
    snaps++;
  };
  // Medarbetarens kök: grillen, fritösen och maskinerna tickar vidare mellan ledarens lägen
  // (rättas vid nästa snap) och lapparnas tålamod rinner. Ropen ("VÄND MIG!", "KLAR!",
  // "BRÄNNS!") kommer EN gång per steg – vare sig steget tickade fram här eller kom med snappen.
  const biffSteg = (b) => b.sida * 3 + (b.brand ? 2 : b.tid >= T_SIDE ? 1 : 0);
  const korgSteg = (f) => (f.brand ? 2 : f.tid >= T_FRY ? 1 : 0);
  function brannPop(b, x) { play('miss'); pops.add(x, 46, 'BRÄNNS!', '#ff6a6a'); if (b.by === coop.myId) stats.brand++; }
  function ropaGrill(i, fresh) {
    const b = grill[i];
    if (!b) return;
    const s = biffSteg(b);
    if (fresh || b.said === undefined) { b.said = s; return; }
    if (s <= b.said) return;
    b.said = s;
    if (b.brand) brannPop(b, GRILL.slots[i]);
    else if (s % 3 === 1) { play('ok'); pops.add(GRILL.slots[i], 46, b.sida === 0 ? 'VÄND MIG!' : 'KLAR!', b.sida === 0 ? '#ffd23f' : '#8ee03c'); }
  }
  function ropaKorg(i, fresh) {
    const f = fritos[i];
    if (!f) return;
    const s = korgSteg(f);
    if (fresh || f.said === undefined) { f.said = s; return; }
    if (s <= f.said) return;
    f.said = s;
    if (f.brand) brannPop(f, FRIT.korgar[i]);
    else { play('ok'); pops.add(FRIT.korgar[i], 42, 'UPP MED KORGEN!', '#8ee03c'); }
  }
  function ropaMaskin(typ, fresh) {
    const m = maskin[typ];
    if (!m) return;
    const s = m.fas === 'klar' ? 1 : 0;
    if (fresh || m.said === undefined) { m.said = s; return; }
    if (s > m.said) { m.said = s; play('ok'); pops.add(MASK_X[typ], 26, 'KLAR!', '#8ee03c'); }
  }
  function mateTick(dt) {
    grill.forEach((b, i) => {
      if (!b) return;
      b.tid += dt;
      if (b.tid >= T_BRANN) b.brand = true;
      ropaGrill(i, false);
      if (b.brand && Math.random() < dt * 7) smoke(GRILL.slots[i], 52);
    });
    fritos.forEach((f, i) => {
      if (!f) return;
      f.tid += dt;
      if (f.tid >= T_FRY_BRANN) f.brand = true;
      ropaKorg(i, false);
      if (f.brand && Math.random() < dt * 7) smoke(FRIT.korgar[i], 50);
    });
    for (const typ of MASK) {
      const m = maskin[typ];
      if (m && m.fas === 'fyller') { m.t += dt; if (m.t >= m.dur) m.fas = 'klar'; }
      ropaMaskin(typ, false);
    }
    for (const o of orders) o.kvar = Math.max(0, o.kvar - dt);
  }

  // Kocken som gör något vid en gemensam station: jag själv, eller – hos skiftledaren – en
  // medarbetare vars önskemål körs åt hen. Det hen bär följer med önskemålet och tillbaka i svaret.
  const cookMe = () => ({ by: coop.myId || '', fx: [], get carry() { return carry; }, set carry(v) { carry = v; } });
  const cookFor = (by, c) => ({ by, fx: [], carry: c, remote: true });
  // Utfallet av en handling: [slag, vem (spelar-id; '' = alla i köket), ...]. Det som gäller mig
  // (eller alla) syns och hörs här direkt – ensam gäller allt mig; i ett delat pass (eller när
  // jag kör en medarbetares önskemål) följer resten med svaret ut.
  function fx(k, who, kind, ...a) {
    const me = coop.myId || '', ut = coop.active || !!k.remote;
    if (!who || who === me || !ut) doFx(kind, a);
    if (ut && who !== me) k.fx.push([kind, who, ...a]);
  }
  function doFx(kind, a) {
    if (kind === 'h') hint(String(a[0]).slice(0, 48), +a[1] || 0, +a[2] || 0);
    else if (kind === 'H') { play('miss'); pops.add(+a[0] || 0, +a[1] || 0, 'HANN FÖRE!', '#ff6a6a'); }   // någon annan hann först
    else if (kind === 's') { if (LJUD.has(a[0])) play(a[0]); }
    else if (kind === 'p') pops.add(+a[0] || 0, +a[1] || 0, String(a[2]).slice(0, 48), String(a[3] || '#f4f1ea'));
    else if (kind === 'w') workT = 0.3;
    else if (kind === 'f') stats.fel++;
    else if (kind === 'o') { const kr = clamp(a[0] | 0, 0, 10); stats.ok++; if (kr) { stats.dricks++; stats.dricksKr += kr; } }   // serverat (+ dricks)
    else if (kind === 'u') puff(+a[0] || 0, GRILL.slotY, [0xfff0d0, 0xffffff, 0xffc040], 6, 5);   // biffen vänds
    else if (kind === 'k') bellT = 0.55;                                                            // klockan ringer
    else if (kind === 'B') bellaSay(String(a[0]).slice(0, 80));
  }
  const kHint = (k, txt, x, y) => fx(k, k.by, 'h', txt, x, y);
  const kLjud = (k, s) => fx(k, k.by, 's', s);
  const kPop = (k, x, y, txt, c) => fx(k, '', 'p', x, y, txt, c);   // syns hos alla i köket
  const kWork = (k) => fx(k, k.by, 'w');
  // felOnce vid en gemensam station (brickan): felet är kockens eget, men räknas i laget här
  function kFelOnce(k, obj, txt, x, y) {
    if (obj.feld) { kHint(k, txt, x, y); return; }
    obj.feld = true; team.fel++; fx(k, k.by, 'f'); kLjud(k, 'fel'); fx(k, k.by, 'p', x, y, txt, '#ff6a6a');
  }
  // De gemensamma stationerna. id(i) = vad kocken såg där när hen klickade (−1 = tomt); har det
  // ändrats när handlingen väl görs hann någon annan före (grillen räknar sidan också – en
  // biff som redan vänts vänds inte igen).
  const STN = {
    grill: { n: 3, id: (i) => (grill[i] ? grill[i].id * 2 + grill[i].sida : -1), at: (i) => [GRILL.slots[i], 48], run: (k, i) => doGrill(k, i) },
    fritos: { n: 2, id: (i) => (fritos[i] ? fritos[i].id : -1), at: (i) => [FRIT.korgar[i], 44], run: (k, i) => doFritos(k, i) },
    maskin: { n: 3, id: (i) => (maskin[MASK[i]] ? maskin[MASK[i]].id : -1), at: (i) => [MASK_X[MASK[i]], 26], run: (k, i, s) => doMaskin(k, MASK[i], s >= 0 && s < 3 ? s : undefined) },
    // brickan: bara den som vill TA något därifrån kan hinna efter (den som ställer dit tar en ledig plats)
    bricka: { n: 3, id: (i) => (bricka[i] ? bricka[i].id : -1), at: (i) => [BRICKA.spots[i], 52], run: (k, i) => doBricka(k, i), stale: (i, v, k) => !k.carry && STN.bricka.id(i) !== v },
    // klockan: id = hur mycket som stod på brickan – är den tom nu ringde någon annan först
    klocka: { n: 1, id: () => bricka.filter(Boolean).length, at: () => [BELL.x - 10, 46], run: (k) => doBell(k), stale: (i, v) => v > 0 && !bricka.some(Boolean) },
  };
  for (const s of Object.values(STN)) s.stale ||= (i, v) => s.id(i) !== v;
  // En handling vid en gemensam station: ensam (eller som skiftledare) görs den direkt, som
  // medarbetare blir den ett önskemål till skiftledaren (med det man bär). v = det man såg vid klicket.
  function shared(key, i, v, s = -1) {
    const st = STN[key];
    // (fältet heter st – k är platsnyckeln som coop.send() lägger på)
    if (mate()) { if (!pend) ask({ t: 'do', st: key, i, v, s, c: itemEnc(carry) }); return; }
    const k = cookMe();
    if (st.stale(i, v, k)) fx(k, k.by, 'H', ...st.at(i));
    else st.run(k, i, s);
    publish(k, false);
  }
  // skiftledaren: läget ut direkt efter en handling (FÖRE svaret – då har den som frågade redan
  // det nya läget när svaret kommer) och utfallet till alla
  function publish(k, svar) {
    if (!svar && !(coop.active && coop.leader && coop.settled)) return;
    sendSnap(); coop.sentSnap(); snapIn = 0.35;
    if (svar) coop.send({ t: 'res', by: k.by, fx: k.fx, c: itemEnc(k.carry) });
    else if (k.fx.length) coop.send({ t: 'res', by: k.by, fx: k.fx });
  }
  // medarbetarens önskemål: kocken väntar på ledarens svar (högst 2,5 s – sedan kan man försöka igen)
  function ask(m) { coop.send(m); pend = { t: 2.5 }; }
  function answered() {
    pend = null;
    if (queued && !done) { const q = queued; queued = null; api.down(q[0], q[1]); }
  }
  // ihop: lappen jag börjar bygga på tråget märks som min (skiftledaren håller i märkningen)
  function paLappen(o) {
    if (o.kock && here(o.kock)) return;   // någon (kanske jag) bygger den redan
    o.kock = coop.myId;                   // syns direkt – nästa snap bekräftar
    if (mate()) coop.send({ t: 'tag', id: o.id }); else snapAsap();
  }
  coop.on('snap', (m) => { if (!coop.leader) applySnap(m); });
  coop.on('res', (m) => {   // ledarens utfall: puffarna hos alla – händerna, poängen och dricksen hos den det gäller
    const me = coop.myId, mine = m.by === me;
    if (coop.leader && !mine) return;   // (skiftledaren har redan visat det hos sig)
    for (const f of (Array.isArray(m.fx) ? m.fx : []).slice(0, 48)) {
      if (!Array.isArray(f)) continue;
      const who = str(f[1]);
      if (!who || who === me) doFx(f[0], f.slice(2));
    }
    if (mine) { if ('c' in m) carry = itemDec(m.c); answered(); }
  });
  coop.on('do', (m, from) => {   // en medarbetares handling vid en gemensam station – körs här, åt hen
    if (!coop.leader) return;
    const st = Object.hasOwn(STN, m.st) ? STN[m.st] : null;
    if (!st) return;
    const i = clamp(int(m.i, 0), 0, st.n - 1), k = cookFor(from, itemDec(m.c));
    if (st.stale(i, int(m.v, -1), k)) fx(k, from, 'H', ...st.at(i));
    else st.run(k, i, int(m.s, -1));
    publish(k, true);
  });
  coop.on('fel', () => { if (coop.leader) { team.fel++; snapAsap(); } });   // en medarbetares egna fel räknas i laget
  coop.on('tag', (m, from) => {   // en medarbetare börjar bygga en lapp: den blir hens (om ingen hann före)
    if (!coop.leader) return;
    const o = orders.find((q) => q.id === int(m.id, -1));
    if (o && !(o.kock && here(o.kock))) { o.kock = from; snapAsap(); }
  });

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
    snapAsap();
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
    b.brand = true;
    if (!coop.active || !b.by || b.by === coop.myId) stats.brand++;   // ihop: den brända är hens som lade på den
    play('miss'); pops.add(x, 46, 'BRÄNNS!', '#ff6a6a');
  }
  // Stationerna görs av en kock k (se "jobba tillsammans"): k.carry är det hen bär, och allt
  // som ska synas och höras går via k – ensam är det bara jag, precis som förut.
  function doGrill(k, i) {
    const x = GRILL.slots[i], b = grill[i];
    if (!b) { grill[i] = { id: nid++, sida: 0, tid: 0, brand: false, by: k.by }; kLjud(k, 'click'); kPop(k, x, 48, 'RÅ BIFF PÅ!', '#f4f1ea'); kWork(k); return; }
    if (b.brand) {
      if (k.carry) { kHint(k, 'HÄNDERNA ÄR FULLA', x, 48); return; }
      k.carry = { typ: 'biff', brand: true }; grill[i] = null; kLjud(k, 'miss'); kPop(k, x, 48, 'BRÄND - SLÄNG DEN', '#ff6a6a'); return;
    }
    if (b.sida === 0) {
      if (b.tid < T_SIDE) { kHint(k, 'LÅT DEN STEKA KLART', x, 48); return; }
      b.sida = 1; b.tid = 0; kLjud(k, 'slide'); kPop(k, x, 48, 'VÄND!', '#f4f1ea');
      fx(k, '', 'u', x); kWork(k); return;
    }
    if (b.tid < T_SIDE) { kHint(k, 'ANDRA SIDAN STEKER ÄN', x, 48); return; }
    if (k.carry) { kHint(k, 'HÄNDERNA ÄR FULLA', x, 48); return; }
    k.carry = { typ: 'biff', brand: false }; grill[i] = null; kLjud(k, 'ok'); kWork(k);
  }
  // v = det kocken såg vid plattan när hen klickade (se STN)
  function actGrill(i, v = STN.grill.id(i)) { walker.dir = 'up'; shared('grill', i, v); }
  // ---------- fritösen ----------
  function doFritos(k, i) {
    const x = FRIT.korgar[i], f = fritos[i];
    if (!f) { fritos[i] = { id: nid++, tid: 0, brand: false, by: k.by }; kLjud(k, 'click'); kPop(k, x, 44, 'POMMES NER!', '#f4f1ea'); kWork(k); return; }
    if (f.tid < T_FRY && !f.brand) { kHint(k, 'INTE KLARA ÄN', x, 44); return; }
    if (k.carry) { kHint(k, 'HÄNDERNA ÄR FULLA', x, 44); return; }
    k.carry = { typ: 'pommes', saltad: false, brand: f.brand }; fritos[i] = null;
    kLjud(k, f.brand ? 'miss' : 'ok');
    kPop(k, x, 44, f.brand ? 'BRÄNDA...' : 'UPP MED KORGEN!', f.brand ? '#ff6a6a' : '#8ee03c'); kWork(k);
  }
  function actFritos(i, v = STN.fritos.id(i)) { walker.dir = 'up'; shared('fritos', i, v); }
  function actSalt() {
    walker.dir = 'up';
    if (!carry || carry.typ !== 'pommes') { hint('TA UPP POMMES FÖRST', SALT.x, 40); return; }
    if (carry.brand) { felOnce(carry, 'BRÄNDA! SLÄNG DEM', SALT.x, 40); return; }
    if (carry.saltad) { hint('REDAN SALTADE', SALT.x, 40); return; }
    carry.saltad = true; play('click'); pops.add(SALT.x, 40, '+SALT!', '#f4f1ea');
    puff(walker.px, walker.py - 26, [0xffffff, 0xf0f4f6], 8, 5); workT = 0.3;
  }
  // ---------- läsk, milkshake och glass ----------
  function doMaskin(k, typ, smak) {
    const mx = MASK_X[typ];
    const m = maskin[typ];
    if (m?.fas === 'klar') {
      if (k.carry) { kHint(k, 'HÄNDERNA ÄR FULLA', mx, 26); return; }
      k.carry = { typ, smak: m.smak }; maskin[typ] = null; kLjud(k, 'ok'); kWork(k); return;
    }
    if (m) { kHint(k, 'MASKINEN ÄR IGÅNG', mx, 26); return; }
    if (typ === 'shake' && smak === undefined) { kHint(k, 'VÄLJ SMAK PÅ KNAPPARNA', mx, 26); return; }
    maskin[typ] = { id: nid++, fas: 'fyller', t: 0, dur: FYLL_TID[typ], smak };
    kLjud(k, 'click'); kWork(k);
    if (typ === 'shake') kPop(k, mx, 26, SMAKER[smak] + '!', '#f4f1ea');
  }
  function actMaskin(typ, smak, v = STN.maskin.id(MASK.indexOf(typ))) { walker.dir = 'up'; shared('maskin', MASK.indexOf(typ), v, smak ?? -1); }
  // ---------- tråget: bygg burgaren i receptets ordning ----------
  function actLager(id) {
    const kx = walker.px, srcX = id === 'biff' ? kx : id === 'underbrod' ? BROD.xU : id === 'overbrod' ? BROD.xO : id === 'dressing' ? DRESS.x : BINS.find((b) => b.id === id).x;
    if (id === 'biff' && (!carry || carry.typ !== 'biff')) { hint('HÄMTA EN BIFF FRÅN GRILLEN', TRAY.x, 96); return; }
    if (id === 'biff' && carry.brand) { felOnce(carry, 'BRÄNT KÖTT! SLÄNG DET', TRAY.x, 96); return; }
    if (tray?.klar) { hint('LYFT BURGAREN FÖRST', TRAY.x, 96); return; }
    if (!tray) {
      // ihop: den första burgarlappen som ingen annan kock redan bygger (finns ingen sådan – den första)
      const o = orders.find((c) => isBurgare(c.recept) && !annans(c)) || orders.find((c) => isBurgare(c.recept));
      if (!o) { hint('INGEN BURGARE ÄR BESTÄLLD', TRAY.x, 96); return; }
      tray = { recept: o.recept, lager: [], klar: false };
      if (coop.active) paLappen(o);
    }
    const steg = RECEPT[tray.recept].steg, next = steg[tray.lager.length];
    if (id !== next) { felMin(); play('fel'); pops.add(TRAY.x, 96, `OOPS! NÄSTA: ${STEG_NAMN[next]}`, '#ff6a6a'); return; }
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
  function doBricka(k, spot) {
    const x = BRICKA.spots[spot];
    if (!k.carry && bricka[spot]) { k.carry = itemDec(itemEnc(bricka[spot])); bricka[spot] = null; kLjud(k, 'click'); return; }   // (utan brickans id och kock)
    if (!k.carry) { kHint(k, 'HÄMTA EN FÄRDIG RÄTT FÖRST', x, 52); return; }
    if (k.carry.typ === 'biff') { kHint(k, 'BIFFEN SKA PÅ EN BURGARE', x, 52); return; }
    if (k.carry.brand) { kFelOnce(k, k.carry, 'BRÄNT! SLÄNG DET', x, 52); return; }
    if (k.carry.typ === 'pommes' && !k.carry.saltad) { kHint(k, 'SALTA POMMESEN FÖRST!', x, 52); return; }
    let s = bricka[spot] ? bricka.findIndex((v) => !v) : spot;
    if (s < 0) { kHint(k, 'BRICKAN ÄR FULL - RING I KLOCKAN', x, 52); return; }
    bricka[s] = { ...k.carry, id: nid++, by: k.by }; k.carry = null; kLjud(k, 'click'); kWork(k);   // by: rätten är hens
  }
  function actBricka(spot, v = STN.bricka.id(spot)) { walker.dir = 'up'; shared('bricka', spot, v); }
  function doBell(k) {
    fx(k, '', 'k'); fx(k, '', 's', 'box');   // PLING – syns och hörs hos alla
    let served = 0, rest = null;
    for (let s = 0; s < 3; s++) {
      const it = bricka[s];
      if (!it) continue;
      const oi = orders.findIndex((o) => matches(o, it));
      if (oi < 0) { rest = it; continue; }
      const o = orders.splice(oi, 1)[0];
      bricka[s] = null; served++; team.ok++;
      // poängen och dricksen till kocken som ställde dit rätten, vem som än ringde (ensam: jag)
      const kock = (coop.active || k.remote) && it.by ? it.by : k.by;
      // snabb mat ger dricks – blixtsnabb ger mer; allt går rakt ner i lönen
      const kr = o.kvar / o.max > 0.6 ? (o.kvar / o.max > 0.85 ? 10 : 5) : 0;
      fx(k, kock, 'o', kr); fx(k, kock, 's', 'coin');
      kPop(k, BRICKA.spots[s], 52, `+${wage} TACK!`, '#8ee03c');
      if (kr) {
        kPop(k, BRICKA.spots[s], 42, `+${kr} DRICKS!`, '#ffd23f');
        fx(k, '', 'B', kr >= 10 ? 'BLIXTSNABBT! GÄSTEN GAV EN TIA I DRICKS! 💰' : 'SNABBT JOBBAT! GÄSTEN GAV DRICKS! 💰');
      }
    }
    if (!served && !rest) kHint(k, 'STÄLL MATEN PÅ BRICKAN FÖRST', BELL.x - 10, 46);
    else if (!served && rest) kHint(k, 'INGEN HAR BESTÄLLT DET HÄR', BELL.x - 10, 46);
  }
  function actBell(v = STN.klocka.id()) { walker.dir = 'up'; shared('klocka', 0, v); }
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
  // (vid de gemensamma stationerna minns kocken vad hen såg när hen klickade – har det ändrats
  // när hen kommer fram hann någon annan före)
  function doStation(s) {
    if (s.k === 'grill') { const v = STN.grill.id(s.i); walker.walkTo(GRILL.slots[s.i], 95, () => actGrill(s.i, v)); }
    else if (s.k === 'fritos') { const v = STN.fritos.id(s.i); walker.walkTo(FRIT.korgar[s.i], 95, () => actFritos(s.i, v)); }
    else if (s.k === 'salt') walker.walkTo(SALT.x + 3, 95, actSalt);
    else if (s.k === 'lask' || s.k === 'shake' || s.k === 'glass') {
      const v = STN.maskin.id(MASK.indexOf(s.k));
      walker.walkTo(MASK_X[s.k], 95, () => actMaskin(s.k, s.k === 'shake' ? s.smak : undefined, v));
    }
    else if (s.k === 'klocka') { const v = STN.klocka.id(); walker.walkTo(BELL.x - 8, 95, () => actBell(v)); }
    else if (s.k === 'bricka') { const v = STN.bricka.id(s.spot); walker.walkTo(BRICKA.spots[s.spot], 95, () => actBricka(s.spot, v)); }
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
      grill: grill.map((b) => (b ? { id: b.id, sida: b.sida, tid: +b.tid.toFixed(2), brand: b.brand, by: b.by } : null)),
      fritos: fritos.map((f) => (f ? { id: f.id, tid: +f.tid.toFixed(2), brand: f.brand } : null)),
      maskin: Object.fromEntries(Object.entries(maskin).map(([k, m]) => [k, m ? { id: m.id, fas: m.fas, smak: m.smak !== undefined ? SMAKER[m.smak] : undefined } : null])),
      bricka: bricka.map(beskriv),
      nasta: orders[0] ? RECEPT[orders[0].recept].id : null,
    }),
    // (kock = spelar-id för den som bygger lappen – bara ihop)
    orders: () => orders.map((o) => ({ id: o.id, recept: RECEPT[o.recept].id, namn: RECEPT[o.recept].namn, smak: o.smak !== undefined ? SMAKER[o.smak] : undefined, kvar: +o.kvar.toFixed(1), kock: o.kock || null })),
    // forceOrder('burgare' | 'gron' | 'stora' | 'pommes' | 'lask' | 'shake' | 'glass', smak 0-2)
    forceOrder: (recept, smak) => { const o = spawnOrder(REC_IX[recept] ?? 0, smak); return o ? dbg.orders()[orders.length - 1] : null; },
    // testhjälp: sänker alla lappars tålamod (varningslampan tänds under 8 s kvar)
    rush: (s = 6) => { for (const o of orders) o.kvar = Math.min(o.kvar, s); return dbg.orders(); },
    // Ett stationssteg direkt, utan gång. Ingredienser: 'underbrod' 'ost' 'sallad' 'tomat'
    // 'lok' 'pickles' 'dressing' 'overbrod'. Grillen: 'grill' (rå biff på), 'vand', 'stek'
    // (allt blir klart), 'brann' (allt bränns), 'tabiff' (ta klar biff), 'biff' (genväg:
    // perfekt biff läggs på tråget). Fritösen: 'pommesner', 'pommesklar', 'pommesbrann',
    // 'pommesupp', 'salta'. Maskinerna: 'lask', 'glass', 'shake' eller 'shake:jordgubb'
    // (fyller och tar direkt). Övrigt: 'trag' (lyft/lägg), 'bricka', 'klocka', 'sopor'.
    // Ihop: 'stek'/'brann'/'pommesklar'/'pommesbrann' gäller hos skiftledaren; hos en medarbetare
    // blir stegen vid grillen, fritösen, maskinerna, brickan och klockan önskemål (ett i taget).
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
      snapAsap();
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
    // ---------- jobba tillsammans (tools/coop-kok-test.mjs) ----------
    coop: () => ({ leader: coop.leader, active: coop.active, mates: coop.peers().length, settled: coop.settled, myId: coop.myId }),
    lag: () => ({ ...team, maxN }),
    brickan: () => bricka.map((it) => (it ? { id: it.id, by: it.by, ...beskriv(it) } : null)),
    // lugnt i köket (skiftledaren/solo): inga nya lappar, skenan och de gemensamma stationerna töms
    calm() { orderIn = 1e9; orders = []; grill.fill(null); fritos.fill(null); for (const typ of MASK) maskin[typ] = null; bricka.fill(null); snapAsap(); },
    // lägg en biff direkt på grillen (skiftledaren/solo): sida 0/1 (null = töm plattan), tid =
    // sekunder på den sidan. Returnerar biffens id.
    forceGrill(slot = 0, sida = 0, tid = 0) {
      const i = clamp(slot | 0, 0, 2);
      grill[i] = sida === null ? null : { id: nid++, sida: sida ? 1 : 0, tid: +tid || 0, brand: false, by: coop.myId || '' };
      snapAsap();
      return grill[i] ? grill[i].id : null;
    },
    // lägg något direkt i händerna (det man bär är ens eget): 'lask' | 'glass' | 'shake:jordgubb' |
    // 'pommes' (saltad) | 'biff' | 'burgare:gron' | annat = tomma händer
    give(namn) {
      const [id, arg] = String(namn).split(':');
      if (id === 'shake') carry = { typ: 'shake', smak: Math.max(0, SMAKER.findIndex((s) => s.toLowerCase() === String(arg || 'vanilj').toLowerCase())) };
      else if (id === 'pommes') carry = { typ: 'pommes', saltad: true, brand: false };
      else if (id === 'biff') carry = { typ: 'biff', brand: false };
      else if (id === 'burgare') carry = { typ: 'burgare', recept: REC_IX[arg || 'burgare'] ?? 0 };
      else if (id === 'lask' || id === 'glass') carry = { typ: id, smak: undefined };
      else carry = null;
      return beskriv(carry);
    },
    // ställ kocken direkt på en plats (för klicktester vid stationerna)
    place(x, y, dir = 'up') { walker.stop(); walker.px = x; walker.py = y; walker.dir = dir; },
    // där kocken står vid en station (samma mål som klicket går till)
    standAt: (id) => ({
      grill0: [GRILL.slots[0], 95], grill1: [GRILL.slots[1], 95], grill2: [GRILL.slots[2], 95],
      fritos0: [FRIT.korgar[0], 95], fritos1: [FRIT.korgar[1], 95], salt: [SALT.x + 3, 95],
      lask: [MASK_X.lask, 95], shake: [MASK_X.shake, 95], glass: [MASK_X.glass, 95],
      bricka0: [BRICKA.spots[0], 95], bricka1: [BRICKA.spots[1], 95], bricka2: [BRICKA.spots[2], 95],
      klocka: [BELL.x - 8, 95], trag: [TRAY.x, STAND_Y], sopor: [TRASH.x - 16, TRASH.y - 2],
    })[id] || null,
    // sant när kocken står still och inte väntar på skiftledarens svar
    idle: () => !pend && !queued && walker.path.length === 0,
    pending: () => !!pend,
    time: () => t,
    pops: () => popLog.slice(),
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
    const o = orders.find((c) => !annans(c)) || orders[0];   // (ihop: hoppa över lappar en annan kock bygger)
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

  // skiftledarens (och den ensammas) kök: grillen, fritösen, maskinerna och lapparna på skenan
  function leadTick(dt) {
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
      if (m.t >= m.dur) { m.fas = 'klar'; play('ok'); pops.add(MASK_X[typ], 26, 'KLAR!', '#8ee03c'); }
    }
    // nya beställningar på skenan (en van kock får fler lappar – P.pace; gästerna väntar lika
    // länge; ihop kommer de tätare – skenan har ändå bara plats för MAX_TICKETS)
    orderIn -= dt;
    if (orderIn <= 0) {
      orderIn = (8.5 - 3.5 * Math.min(1, t / P.seconds) + hash(seq, 3) * 2.5) * P.pace * (coop.active ? 0.45 : 1);
      spawnOrder(seq === 0 ? 0 : undefined);   // första lappen är alltid en vanlig burgare
    }
    // tålamodet rinner ut (en gäst som tröttnar hörs hos alla i köket)
    for (let i = orders.length - 1; i >= 0; i--) {
      const o = orders[i];
      o.kvar -= dt;
      if (o.kvar <= 0) {
        orders.splice(i, 1);
        stats.miss++; team.miss++; play('miss');
        const x = LUCK.x0 + 10 + i * TICKET_PITCH;
        pops.add(x, 40, 'EN GÄST TRÖTTNADE...', '#d8d2c0');
        if (coop.active) { coop.send({ t: 'res', by: '', fx: [['s', '', 'miss'], ['p', '', x, 40, 'EN GÄST TRÖTTNADE...', '#d8d2c0']] }); snapAsap(); }
      }
    }
    if (coop.active) { snapIn -= dt; if (snapIn <= 0) { snapIn = 0.35; sendSnap(); coop.sentSnap(); } }
  }

  const api = {
    _debug: dbg,
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    enter() {},
    exit() { talk.clear(); coop.dispose(); },
    update(dt) {
      pops.update(dt);
      updParts(dt);
      if (done) {
        coop.tick(); coop.resign();   // MITT pass är slut – lämna över ledningen direkt (även på lönebeskedet)
        doneT += dt;
        if (doneT > 1.2 && !reported) {
          reported = true;
          if (maxN > 1) {   // jobbat ihop: laget delar lika på rätt, fel och missade – dricksen är var och ens egen
            const sh = (v) => Math.round(v / maxN);
            onDone?.({ ok: sh(team.ok), fel: sh(team.fel), miss: sh(team.miss), delat: maxN, lagOk: team.ok, lagFel: team.fel, dricks: stats.dricks, dricksKr: stats.dricksKr, brand: stats.brand });
          } else onDone?.(stats);
        }
        return;
      }
      t += dt;
      if (t >= P.seconds) { done = true; pend = null; queued = null; return; }
      walker.update(dt);
      if (workT > 0) workT -= dt;
      if (bellT > 0) bellT -= dt;
      if (trashT > 0) trashT -= dt;
      if (pend) { pend.t -= dt; if (pend.t <= 0) answered(); }   // inget svar (ledaren gick?) – då får man försöka igen
      coop.tick();
      if (coop.active) maxN = Math.max(maxN, coop.peers().length + 1);
      if (coop.active !== wasCoop) {   // en kollega kom in: fullt ös på skenan
        wasCoop = coop.active;
        if (wasCoop) { play('knock'); pops.add(FW >> 1, 160, 'NI JOBBAR IHOP!', '#8ee03c'); }
      }
      if (!saidIntro && t > 0.8) { saidIntro = true; bellaSay('HEJ KOCKEN! BYGG DET SOM STÅR PÅ LAPPARNA OCH RING I KLOCKAN! 🍔'); }
      // Skiftledaren (eller solo) kör skenan och stationerna; medarbetare följer ledarens läge
      const iLead = !coop.active || (coop.leader && coop.settled);
      if (iLead && !wasLead) {
        // JAG tar över passet: hoppa över gamla id:n (lappar, biffar, korgar, koppar och det på
        // brickan – inga krockar) och låt nästa lapp komma snart
        seq = Math.max(seq, 1 + orders.reduce((mx, o) => Math.max(mx, o.id | 0), -1));
        nid = Math.max(nid, 1 + [...grill, ...fritos, ...MASK.map((typ) => maskin[typ]), ...bricka].reduce((mx, x) => Math.max(mx, x ? x.id | 0 : -1), -1));
        orderIn = Math.min(orderIn, 2);
        snapAsap();
      }
      wasLead = iLead;
      if (iLead) leadTick(dt); else mateTick(dt);
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
      if (pend) { queued = [x, y]; return; }   // väntar på skiftledarens svar – klicket tas strax
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
      // beställningslapparna på skenan (ihop: grönt märke = jag bygger den, blått = en kollega)
      const blink = (t * 4 | 0) % 2;
      const mark = (o) => (!coop.active || !o.kock ? null : o.kock === coop.myId ? '#45b964' : annans(o) ? '#3a78d8' : null);
      orders.slice(0, MAX_TICKETS).forEach((o, i) => drawTicket(ctx, o, LUCK.x0 + 2 + i * TICKET_PITCH, blink, mark(o)));
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
      for (const pr of PROPS_Z) drawables.push({ fy: pr.fy, draw: () => ctx.drawImage(props(), pr.x, pr.y, pr.w, pr.h, pr.x, pr.y, pr.w, pr.h) });
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
      drawShiftHud(ctx, { W: FW }, { t, dur: P.seconds, ok: maxN > 1 ? team.ok : stats.ok, fel: maxN > 1 ? team.fel : stats.fel, title: maxN > 1 ? 'BURGARKÖKET IHOP' : 'BURGARKÖKET' });
      if (done) drawTimeUp(ctx, { W: FW, H: FH });
    },
  };
  return api;
}
