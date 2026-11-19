// 🏛️ GAMLA STAN – kartan, marken och takåsarna (Carl 2026-11-18: "kan vi bygga gamla stan … kullersten, bibliotek,
// museum, teater, antikaffär, kvällsmarknad"). En egen plats som Tassbacken och Pixelberg: man åker hit med den
// gamla bussen från vilken hållplats som helst i stan (city.js) och tillbaka från hållplatsen vid Stadsporten.
//
// Norr om STORGATAN står de gamla husen tätt, vägg i vägg, i ockra, rosa, terrakotta och kalkvitt med korsvirke,
// tegeltak, kupor och skorstenar: BIBLIOTEKET, ANTIKAFFÄREN, GAMLA KAFÉET, VALVET (gränden), MUSEET, GULDSMEDEN,
// TEATERN, LYKTMAKAREN och fyra bostadshus. Bakom husen takåsarna och domkyrkans torn (parallax). Söder om gatan
// STORTORGET med BRUNNEN, kvällsmarknadens stånd med lyktor (16–22), bänkarna, lindarna och gatumusikanten, och
// längst i väster STADSPORTEN. Allt är kullersten – ett pixelkorn, ljuset från sydväst.
//
// Scenen (js/scenes/gamlastan.js) ritar: himlen + takåsarna (parallax) → marken (paintGround, en gång) → husen,
// stånden, lyktorna, folket y-sorterade → kvällens mörker och lyktornas sken.
import { Pix, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { $t } from '../core/i18n.js';

export const TW = 1760, TH = 500;
export const G = { BASE: 196, GATA: [196, 300], TOP: 192, BOTTOM: 492 };
// husen på norra sidan (fasaden står på BASE, dörren x0–x1). typ styr målningen i hus.js, farg bostadshusens puts
export const HUS = {
  port: { id: 'port', namn: $t('STADSPORTEN'), x: 0, w: 56, h: 150, door: { x0: 10, x1: 46 }, typ: 'port' },
  bibliotek: { id: 'bibliotek', namn: $t('BIBLIOTEKET'), x: 62, w: 190, h: 112, door: { x0: 142, x1: 172 }, typ: 'bibliotek' },
  antik: { id: 'antik', namn: $t('ANTIKAFFÄREN'), x: 258, w: 120, h: 96, door: { x0: 318, x1: 338 }, typ: 'antik' },
  hus1: { id: 'hus1', x: 384, w: 96, h: 104, door: { x0: 418, x1: 434 }, typ: 'bostad', farg: 'ockra' },
  kafe: { id: 'kafe', namn: $t('GAMLA KAFÉET'), x: 486, w: 140, h: 92, door: { x0: 548, x1: 570 }, typ: 'kafe' },
  valv: { id: 'valv', namn: $t('VALVET'), x: 632, w: 44, h: 84, door: { x0: 638, x1: 670 }, typ: 'valv' },
  museum: { id: 'museum', namn: $t('MUSEET'), x: 682, w: 200, h: 118, door: { x0: 768, x1: 796 }, typ: 'museum' },
  guldsmed: { id: 'guldsmed', namn: $t('GULDSMEDEN'), x: 888, w: 104, h: 94, door: { x0: 934, x1: 952 }, typ: 'guldsmed' },
  hus2: { id: 'hus2', x: 998, w: 110, h: 108, door: { x0: 1042, x1: 1058 }, typ: 'bostad', farg: 'rosa' },
  teater: { id: 'teater', namn: $t('TEATERN'), x: 1114, w: 230, h: 124, door: { x0: 1210, x1: 1248 }, typ: 'teater' },
  hus3: { id: 'hus3', x: 1350, w: 100, h: 100, door: { x0: 1388, x1: 1404 }, typ: 'bostad', farg: 'bla' },
  lyktmakare: { id: 'lyktmakare', namn: $t('LYKTMAKAREN'), x: 1456, w: 112, h: 98, door: { x0: 1504, x1: 1522 }, typ: 'lykt' },
  hus4: { id: 'hus4', x: 1574, w: 96, h: 106, door: { x0: 1610, x1: 1626 }, typ: 'bostad', farg: 'gron' },
  hus5: { id: 'hus5', x: 1676, w: 84, h: 98, door: { x0: 1706, x1: 1722 }, typ: 'bostad', farg: 'terra' },
};
export const HUSLISTA = Object.keys(HUS);
// söder om gatan
export const TORG = { x: 880, y: 396, rx: 200, ry: 82 };     // Stortorget (ringar av gatsten runt brunnen)
export const BRUNN = { x: 880, y: 390 };                      // brunnen med tak och hink
export const STAND = [                                        // kvällsmarknadens stånd (typ styr varorna)
  { id: 'brod', x: 712, y: 342, typ: 'brod' }, { id: 'blommor', x: 1050, y: 342, typ: 'blommor' },
  { id: 'honung', x: 690, y: 448, typ: 'honung' }, { id: 'keramik', x: 1070, y: 448, typ: 'keramik' }, { id: 'ljus', x: 880, y: 476, typ: 'ljus' },
];
export const MUSIKANT = { x: 1000, y: 416 };                  // gatumusikanten (dragspel) vid brunnen
export const SAGOBANK = { x: 760, y: 420 };                   // bänken där sagoberätterskan sitter på kvällen
export const BANKAR = [{ x: 420, y: 380 }, { x: 520, y: 380 }, { x: 1260, y: 380 }, { x: 1360, y: 380 }, { x: 240, y: 460 }, { x: 1560, y: 460 }];
export const LYKTOR = [120, 330, 560, 820, 1080, 1320, 1540].map((x) => ({ x, y: G.GATA[1] - 4 }));   // gatlyktorna längs gatans södra kant
export const TORGLYKTOR = [[700, 400], [1060, 400], [780, 470], [980, 470]].map(([x, y]) => ({ x, y }));
export const TRAD = [[140, 350], [300, 470], [1480, 350], [1640, 470], [600, 480], [1160, 480]].map(([x, y]) => ({ x, y, kind: 'lind' }));
export const RABATTER = [[200, 400], [1580, 400], [420, 470], [1380, 470]].map(([x, y]) => ({ x, y }));
export const HALLPLATS = { x: 1700, y: 300 };                 // hållplatsen GAMLA STAN (gatans södra kant, östra änden)
export const SKYLT = { x: 1740, y: 300 };
export const KAFEBORD = [{ x: 506, y: G.BASE + 18 }, { x: 600, y: G.BASE + 18 }];
export const BLOMLADOR = [{ x: 400, y: G.BASE + 4 }, { x: 1020, y: G.BASE + 4 }, { x: 1596, y: G.BASE + 4 }];
export const DUVOR = [[840, 372], [900, 372], [920, 392], [860, 410]];   // duvorna på torget
export const MARKNAD = [16, 22];                              // kvällsmarknaden är öppen 16–22

// gånghinder (fotavtryck)
export function hinder() {
  const o = [];
  for (const id of HUSLISTA) { const h = HUS[id]; if (h.typ === 'valv') continue; o.push([h.x, G.BASE - 34, h.door.x0 - 1, G.BASE - 2], [h.door.x1 + 1, G.BASE - 34, h.x + h.w, G.BASE - 2]); }
  o.push([0, 0, TW, G.BASE - 6]);                                            // bakom husen
  o.push([BRUNN.x - 16, BRUNN.y - 10, BRUNN.x + 16, BRUNN.y + 8]);
  for (const s of STAND) o.push([s.x - 22, s.y - 8, s.x + 22, s.y + 2]);
  for (const b of BANKAR) o.push([b.x - 15, b.y - 4, b.x + 16, b.y + 1]);
  o.push([SAGOBANK.x - 15, SAGOBANK.y - 4, SAGOBANK.x + 16, SAGOBANK.y + 1]);
  for (const l of [...LYKTOR, ...TORGLYKTOR]) o.push([l.x - 2, l.y - 2, l.x + 3, l.y + 1]);
  for (const t of TRAD) o.push([t.x - 4, t.y - 3, t.x + 5, t.y + 2]);
  for (const r of RABATTER) o.push([r.x - 13, r.y - 5, r.x + 14, r.y + 5]);
  for (const k of KAFEBORD) o.push([k.x - 8, k.y - 4, k.x + 9, k.y + 1]);
  for (const b of BLOMLADOR) o.push([b.x - 14, b.y - 5, b.x + 14, b.y + 1]);
  o.push([MUSIKANT.x - 6, MUSIKANT.y - 3, MUSIKANT.x + 7, MUSIKANT.y + 1]);
  return o;
}

// ---------------------------------------------------------------- takåsarna (parallax bakom husen)
// Gamla stans tak sedda över husraden: gavlar och sadeltak om vartannat i tegelrött och brunt, skorstenar med
// rök, takfönster, och domkyrkans torn med urtavla, ljudluckor och grönärgad spira. Om natten tänds takfönstren.
const BACK = new Map();
export function takCanvas(night) {
  if (BACK.has(night)) return BACK.get(night);
  const w = 1200, h = 110, P = new Pix(w, h);
  const N = (c) => (night ? mix(mul(c, 0.4), 0x101634, 0.35) : c);
  const px = (x, y, c) => { if (c != null) P.px(x, y, N(c)); };
  const TAK = [[0x8a3a2a, 0xb04c34, 0xc86a4a], [0x6a3c28, 0x8a5236, 0xa86a46], [0x4a4a56, 0x62626e, 0x7a7a88], [0x7a3a1e, 0x9a4c2a, 0xb86a3e]];
  let x = -20, k = 0;
  while (x < w + 40) {
    const bw = 44 + ((hash(k, 1, 71) * 50) | 0), bh = 18 + ((hash(k, 2, 71) * 22) | 0), gavel = hash(k, 3, 71) > 0.55, pal = TAK[k % 4], yb = h - 1, yt = yb - bh;
    for (let i = 0; i < bw; i++) for (let y = yt; y <= yb; y++) {
      const u = (y - yt) / Math.max(1, bh);
      if (gavel) { const half = bw / 2, dx = Math.abs(i - half); if (dx > half * (0.25 + u * 0.75)) continue; }
      const r = Math.floor((y - yt) / 3), rr = (y - yt) % 3, ii = i + (r & 1) * 2;
      let c = rr === 0 ? pal[2] : rr === 2 ? pal[0] : pal[1];
      if (ii % 5 === 4) c = mul(c, 0.82);
      if (hash(x + i, y, 72) > 0.96) c = mix(c, 0x3a5a3a, 0.4);
      px(x + i, y, c);
    }
    if (!gavel) for (let i = 0; i < bw; i++) px(x + i, yt, mix(pal[2], 0xffffff, 0.25));
    // skorsten med rök, takfönster
    const cx = x + 8 + ((hash(k, 4, 71) * (bw - 16)) | 0);
    for (let y = yt - 7; y < yt + 4; y++) for (let i = 0; i < 5; i++) px(cx + i, y, y === yt - 7 ? 0x8a8a84 : (i + y) % 3 ? 0x8a4a3a : 0x6a3428);
    if (hash(k, 5, 71) > 0.5) { const fx = x + ((hash(k, 6, 71) * (bw - 12)) | 0) + 4; P.rect(fx, yt + 6, 5, 4, night ? 0xf8d878 : N(0x6a8ab0)); P.hl(fx, yt + 5, 5, N(0xd8d4c8)); }
    x += bw + 2 + ((hash(k, 7, 71) * 6) | 0); k++;
  }
  // domkyrkans torn mitt i bilden
  const kx = 560, ky = 22, tw = 22;
  for (let j = 0; j < 80; j++) for (let i = 0; i < tw; i++) px(kx + i, ky + j, i === tw - 1 ? 0x9a9488 : i === 0 ? 0xe8e4da : (j % 10 === 9 ? 0xc0bab0 : mix(0xd8d4c8, 0xcac4b8, hash(i, j, 73))));
  for (let j = 0; j < 30; j++) { const half = Math.max(0, 11 - Math.round(j * 0.38)); for (let i = -half; i <= half; i++) px(kx + 11 + i, ky - 1 - j, (i + 30) % 3 === 0 ? 0x2a6a5a : i < -half + 2 ? 0x7ac8b0 : 0x4a8a7a); }
  P.vl(kx + 11, ky - 40, 10, N(0x3a3a3e)); px(kx + 11, ky - 41, 0xd8b040); px(kx + 10, ky - 39, 0xd8b040); px(kx + 12, ky - 39, 0xd8b040);
  for (let j = 0; j < 9; j++) for (let i = 0; i < 9; i++) { const d = Math.hypot(i - 4, j - 4); if (d < 4.6) px(kx + 7 + i, ky + 10 + j, d > 3.6 ? 0x2a2a30 : 0xfaf6ea); }
  px(kx + 11, ky + 14, 0x2a2a30); px(kx + 11, ky + 13, 0x2a2a30); px(kx + 12, ky + 15, 0x2a2a30); px(kx + 13, ky + 16, 0x2a2a30);
  for (const sx of [kx + 4, kx + 13]) for (let j = 0; j < 10; j++) for (let i = 0; i < 5; i++) px(sx + i, ky + 26 + j, j % 2 ? 0x2a3448 : 0x5a5a66);
  for (const sx of [kx + 4, kx + 13]) { P.rect(sx, ky + 48, 5, 10, night ? 0xf0c860 : N(0x5a7aa0)); px(sx + 2, ky + 47, 0xe8e4da); }
  const cv = P.flush(); BACK.set(night, cv); return cv;
}

// ---------------------------------------------------------------- marken (en gång)
// kullersten: rundade stenar i förskjutna rader, slitna och ljusare mitt på gatan, mossa i fogarna vid husväggarna
function cobble(x, y, base, s = 2) {
  const r = Math.floor(y / 5), xx = x + (r & 1) * 3, c = Math.floor(xx / 6), rx = xx - c * 6, ry = y - r * 5;
  if (rx === 5 || ry === 4) return mix(base, 0x3e3a36, 0.6);
  let k = mix(base, hash(c, r, s) > 0.5 ? 0xc4bcae : 0x7e7870, hash(c, r, s + 1) * 0.55);
  if (ry === 0 || rx === 0) k = mix(k, 0xffffff, 0.12);
  if (ry === 3 || rx === 4) k = mul(k, 0.9);
  return k;
}
const vnoise = (x, y, s, cell) => {
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell), sm = (t) => t * t * (3 - 2 * t), u = sm(x / cell - gx), v = sm(y / cell - gy);
  const a = hash(gx, gy, s), b = hash(gx + 1, gy, s), c = hash(gx, gy + 1, s), d = hash(gx + 1, gy + 1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
};
const GRASS = [0x3e8a32, 0x4a9a3a, 0x58a842, 0x6ab84a];
export function paintGround() {
  const P = new Pix(TW, TH);
  // (bakom husen lämnas genomskinligt – där syns takåsarna, takCanvas; bara valvets gränd målas, nedan)
  // STORGATAN och torget: kullersten, sliten ljusare mitt på gatan, rännstenen längs mitten, mossa vid husfoten
  for (let y = G.BASE; y < TH; y++) for (let x = 0; x < TW; x++) {
    const mitt = y >= G.GATA[0] && y < G.GATA[1] ? 1 - Math.min(1, Math.abs(y - 248) / 46) : 0;
    let base = mix(0x9a948a, 0xb8b2a6, mitt * 0.6 + vnoise(x, y, 5, 40) * 0.25);
    if (y > 470) base = mix(base, 0x8a8a7c, 0.3);
    let c = cobble(x, y, base);
    if (y < G.BASE + 5 && hash(x >> 1, y, 6) > 0.72) c = mix(c, 0x3a6a2a, 0.45);         // mossa vid husfoten
    if (y === 249 || y === 250) c = mul(c, y === 249 ? 0.72 : 0.84);                    // rännstenen
    if (vnoise(x, y, 7, 60) > 0.78 && y > 300) c = mix(c, 0x6a6458, 0.25);              // fuktiga fläckar
    P.px(x, y, c);
  }
  // STORTORGET: ringar av gatsten runt brunnen, med en stjärna i mitten och årtalet
  for (let y = TORG.y - TORG.ry; y <= TORG.y + TORG.ry; y++) for (let x = TORG.x - TORG.rx; x <= TORG.x + TORG.rx; x++) {
    const d = Math.hypot((x - TORG.x), (y - TORG.y) * TORG.rx / TORG.ry);
    if (d > TORG.rx) continue;
    const ring = Math.floor(d / 7), ang = Math.floor((Math.atan2((y - TORG.y) * TORG.rx / TORG.ry, x - TORG.x) + Math.PI) / (Math.PI * 2) * (10 + ring * 5));
    let c = mix(0xa8a296, 0xcac2b4, hash(ring, ang, 38));
    if (ring % 3 === 2) c = mix(c, 0x7a5a48, 0.35);                                       // var tredje ring i rödaktig sten
    if ((d % 7) < 1 || d > TORG.rx - 2) c = 0x6e685e;
    P.px(x, y, c);
  }
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; for (let r = 24; r < 56; r++) { const x = Math.round(TORG.x + Math.cos(a) * r), y = Math.round(TORG.y + Math.sin(a) * r * TORG.ry / TORG.rx); P.px(x, y, 0x5a4a3a); } }   // kompassrosen
  // gränden i valvet: trappsteg upp
  const V = HUS.valv;
  for (let y = 120; y < G.BASE; y++) for (let x = V.x; x < V.x + V.w; x++) P.px(x, y, mul(cobble(x, y, 0x8a8478), 0.6));
  for (let y = 120; y < G.BASE; y++) { const r = (y - 120) % 4; for (let x = V.x + 4; x < V.x + V.w - 4; x++) P.px(x, y, r === 0 ? 0xc8c0b4 : r === 3 ? 0x6a645c : mix(0xa8a094, 0x9a9488, hash(x >> 2, y, 61))); }
  // gräsremsorna längst i söder med maskrosor, och rabatterna med rosor
  for (let y = 478; y < TH; y++) for (let x = 0; x < TW; x++) if (vnoise(x, y, 9, 30) > 0.35) P.px(x, y, GRASS[Math.min(3, Math.max(0, Math.round(1.6 + (hash(x >> 1, y >> 1, 3) - 0.5) * 2 + (bayer(x, y) - 0.5))))]);
  for (let k = 0; k < 80; k++) { const x = (hash(k, 1, 21) * TW) | 0, y = 480 + ((hash(k, 2, 21) * 18) | 0); P.px(x, y, [0xf8f0a0, 0xffffff, 0xf4a8c8][k % 3]); }
  for (const r of RABATTER) {
    for (let y = r.y - 5; y <= r.y + 5; y++) for (let x = r.x - 13; x <= r.x + 13; x++) { const d = Math.hypot((x - r.x) / 13.5, (y - r.y) / 5.5); if (d > 1) continue; P.px(x, y, d > 0.82 ? mix(0x6e685e, 0x9a948a, hash(x >> 1, y, 64)) : mix(0x4a3020, 0x5e3e28, hash(x, y, 65))); }
    for (let y = r.y - 2; y <= r.y + 3; y += 2) for (let x = r.x - 9 + ((y - r.y) & 2 ? 1 : 0); x <= r.x + 8; x += 3) { if (Math.hypot((x - r.x) / 10, (y - r.y) / 4.2) > 1) continue; const c = [0xd82838, 0xf06aa0, 0xffffff, 0xf0c030][((x + y) / 3 | 0) % 4]; P.px(x, y, 0x2e6a26); P.px(x, y - 1, 0x3e7e2a); P.px(x, y - 2, c); P.px(x + 1, y - 2, mix(c, 0xffffff, 0.3)); }
  }
  // hopphagen i krita vid torgets västra kant, ett brunnslock, en pöl
  const hx = 560, hy = 420;
  for (let k = 0; k < 6; k++) { const yy = hy - k * 9; P.box(hx - 6, yy - 8, 13, 9, 0xf4ecd8, 0.7); }
  P.box(hx - 12, hy - 62, 25, 9, 0xf4ecd8, 0.7);
  for (let a = 0; a < 40; a++) { const an = a / 40 * Math.PI * 2; P.px(Math.round(1200 + Math.cos(an) * 7), Math.round(430 + Math.sin(an) * 4), 0x4a4640); }
  for (let y = 427; y <= 433; y++) for (let x = 1194; x <= 1206; x++) if (Math.hypot((x - 1200) / 6, (y - 430) / 3) < 1) P.px(x, y, (x + y) % 3 ? 0x5a564e : 0x6a665e);
  for (let y = 300; y < 316; y++) for (let x = 1120; x < 1180; x++) { const d = Math.hypot((x - 1150) / 30, (y - 308) / 8); if (d < 1) P.px(x, y, mix(P.get(x, y), 0x6a8ab0, 0.55 - d * 0.3)); }
  return P.flush();
}
// husbildens anker: fasaden står på BASE – hus.js husBild(id, natt) ritas med put(ctx, s, H.x, G.BASE)
