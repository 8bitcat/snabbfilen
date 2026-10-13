// 🎪 TIVOLISTÅNDEN på Pixelberg i full prakt (Carl 2026-10-13: "stånden är inte alls fina … tänk som glassboden och
// leksaksaffären, mycket detaljer … många dekorationer, ballonger, lamporna ska gnistra och lysa … många stånd: glass,
// spunnet socker, popcorn, hamburgare"). Samma hantverk som glasståndet i parken (js/city/props.js): tonramper med
// Bayer-dither i övergångarna, ljuset från vänster uppe, mörk färgad kontur – och lager per stånd:
//   bak  – takprydnaden, skylten med guldram och glödlampor, markisen med bågkant, de spiralrandiga pelarna,
//          bakväggen och inredningen (expediten ritas av scenen mellan bak och fram – hen står bakom disken)
//   fram – disken med dekorband och allt som står på den, krittavlan och blomkrukan vid foten
//   sken – glöden på kvällen (scenen ritar den med 'lighter')
// Det som rör sig ritas varje bildruta av live(): glödlamporna (en jagande slinga + gnistor), popcornen som poppar,
// sockervadden som snurrar, grillens os och fräs, lyckohjulet.
// Origo (0, 0) = mitt på ståndets fotlinje; x åt höger, y uppåt negativt. Bilderna cachas per stånd och dag/kväll.
import { Pix, SMALL, BIG, text, textW, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { $t } from '../core/i18n.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// ---------- paletter (mörk → ljus) ----------
const CREAM = [0xb8ac92, 0xd4c9ae, 0xe9dfc9, 0xf6efe2, 0xfffaf0];
const WOOD = [0x3a2214, 0x5e3a20, 0x86562e, 0xae7640, 0xd29a5c];
const STEEL = [0x3e444c, 0x646c76, 0x8e98a2, 0xbcc4cc, 0xe6ecf0];
const IRON = [0x101216, 0x1e2228, 0x30363e, 0x4a525c, 0x6e7884];
const GOLD = [0x6a400c, 0xa06c14, 0xd8a028, 0xf6cc4a, 0xfff0a0];
export const ROSA = [0x7a1840, 0xbc3666, 0xee5e98, 0xf898c0, 0xffd2e6];
export const MINT = [0x1a5446, 0x2a7664, 0x469a86, 0x70c0a8, 0xa8e2cc];
export const ROD = [0x5e0e16, 0x9a1a24, 0xd4323a, 0xf06868, 0xffb4ac];
export const BLA = [0x122656, 0x1c4086, 0x285ec0, 0x5890e8, 0xa8ccff];
export const GUL = [0x845408, 0xc08c10, 0xeebc20, 0xffde5c, 0xfff6b4];
export const TURK = [0x0c464e, 0x166670, 0x228c96, 0x48bcc0, 0x98e6e2];
export const LILA = [0x381a58, 0x58288a, 0x8246c0, 0xae78e0, 0xd8b8f8];
export const GRON = [0x163e1c, 0x22602a, 0x34883c, 0x58b45a, 0x9ce08c];
const VAF = [0x6a4520, 0x96662f, 0xc08c44, 0xe0b46a];
const STRO = [0xf0629a, 0xf0c020, 0x2a5ad0, 0x6fdc4c, 0xffffff];

function tone(pal, v, x, y) {
  const f = clamp(v, 0, 0.999) * (pal.length - 1);
  let i = Math.floor(f);
  if (f - i > 0.25 + bayer(x, y) * 0.5) i++;
  return pal[Math.min(pal.length - 1, i)];
}
function spr(w, h, ax, ay, fn) { const P = new Pix(w, h, -ax, -ay); fn(P); return { img: P.flush(), ax, ay, w, h }; }
export const put = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
// fylld ellips med ljus uppe till vänster (4 toner ur en palett) – klot, kulor, moln
function klot(P, cx, cy, rx, ry, pal, ljus = 0) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
    if (d > 1) continue;
    const v = 0.62 - dx * 0.28 - dy * 0.34 + (1 - d) * 0.18 + ljus;
    P.px(x, y, tone(pal, v, x, y));
  }
}
// mörk kontur runt det som redan är målat (hård nedtill/höger)
function kontur(P, dark = 0x1e1626, soft = 0x2a2030, softA = 0.6) {
  const { w, h, d } = P, A = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 200, add = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3]) continue;
    const hard = A(x, y - 1) || A(x - 1, y), sft = A(x, y + 1) || A(x + 1, y);
    if (hard || sft) add.push(x, y, hard ? 1 : 0);
  }
  for (let i = 0; i < add.length; i += 3) P.px(add[i] + P.ox, add[i + 1] + P.oy, add[i + 2] ? dark : soft, add[i + 2] ? 1 : softA);
}
// text med mörk kant runt om och ljus överkant på bokstäverna
function skylttext(P, F, s, x, y, c, kant, ljus) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) text(P, F, s, x + dx, y + dy, kant);
  text(P, F, s, x, y, c);
  if (ljus != null) { const rad = new Map(); text({ px: (px, py) => { if (!rad.has(px) || py < rad.get(px)) rad.set(px, py); } }, F, s, x, y, 0); for (const [px, py] of rad) P.px(px, py, ljus); }
}

// ---------- byggdelarna som alla stånd delar ----------
// en spiralrandig pelare med guldkapitäl och en rad glödlampor på framsidan
function pelare(P, x0, y0, y1, A, B, lampor) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x < x0 + 6; x++) {
    const rand = Math.floor((y + (x - x0) * 0.7) / 4) % 2 === 0, pal = rand ? A : B;
    const v = 0.86 - ((x - x0) / 5) * 0.5 + (x === x0 ? 0.08 : 0);
    P.px(x, y, tone(pal, v, x, y));
  }
  for (let x = x0 - 1; x < x0 + 7; x++) { P.px(x, y0 - 1, tone(GOLD, 0.95 - (x - x0) * 0.08, x, y0)); P.px(x, y0 - 2, tone(GOLD, 0.7 - (x - x0) * 0.06, x, y0)); P.px(x, y1 + 1, tone(GOLD, 0.6 - (x - x0) * 0.06, x, y1)); P.px(x, y1 + 2, GOLD[0]); }
  P.px(x0 + 2, y0 - 4, GOLD[4]); P.px(x0 + 3, y0 - 4, GOLD[3]); P.rect(x0 + 1, y0 - 3, 4, 1, GOLD[2]);   // knoppen
  for (let y = y0 + 4; y < y1 - 2; y += 7) lampor.push([x0 + 2, y]);
}
// randig markis med bågkant (en glödlampa i varje båge) – returnerar markisens nedersta rad
function markis(P, xl, xr, ytop, h, A, B, lampor) {
  const BAGE = [3, 4, 4, 3, 2, 1, 1, 2], w = xr - xl + 1;
  for (let x = xl; x <= xr; x++) {
    const i = x - xl, rand = Math.floor(i / 6) % 2 === 0, pal = rand ? A : B, drop = BAGE[i % 8], yb = ytop + h + drop;
    for (let y = ytop; y <= yb; y++) {
      let v = 0.9 - ((y - ytop) / (h + 4)) * 0.38 - (i / w) * 0.12;
      if (i % 6 === 0) v -= 0.08;   // sömmen mellan våderna
      if (y === ytop) v += 0.12;
      let c = tone(pal, v, x, y);
      if (y === yb) c = tone(pal, 0.18, x, y);
      if (y === yb - 1) c = mix(c, 0xffffff, 0.12);
      P.px(x, y, c);
    }
    P.px(x, yb + 1, 0x1e1626, 0.45);
    if (i % 8 === 2) lampor.push([x, yb + 1]);
  }
  for (let x = xl - 1; x <= xr + 1; x++) { P.px(x, ytop - 1, tone(GOLD, 0.8 - (x - xl) / w * 0.4, x, ytop)); P.px(x, ytop - 2, GOLD[1]); }   // guldlisten överst
  return ytop + h + 4;
}
// skylten: ett bräde med guldram och glödlampor runt om, namnet i stor text med kant
function skylt(P, cx, yb, namn, bg, fg, kant, lampor) {
  const tw = textW(BIG, namn), bw = Math.max(48, tw + 18), bh = 17, x0 = cx - (bw >> 1), y0 = yb - bh;
  for (let y = y0; y < yb; y++) for (let x = x0; x < x0 + bw; x++) {
    const ram = x < x0 + 2 || x >= x0 + bw - 2 || y < y0 + 2 || y >= yb - 2;
    if ((x === x0 || x === x0 + bw - 1) && (y === y0 || y === yb - 1)) continue;   // rundade hörn
    let c;
    if (ram) c = tone(GOLD, 0.9 - (x - x0) / bw * 0.5 - (y - y0) / bh * 0.3 + (y === y0 ? 0.1 : 0), x, y);
    else c = tone(bg, 0.72 - (y - y0) / bh * 0.3 - (x - x0) / bw * 0.14 + (hash(x >> 2, y, 71) - 0.5) * 0.06, x, y);
    P.px(x, y, c);
  }
  skylttext(P, BIG, namn, cx - (tw >> 1), y0 + 5, fg, kant, mix(fg, 0xffffff, 0.6));
  for (let x = x0 + 4; x < x0 + bw - 3; x += 5) { lampor.push([x, y0 + 1]); lampor.push([x, yb - 2]); }
  for (let y = y0 + 5; y < yb - 3; y += 5) { lampor.push([x0 + 1, y]); lampor.push([x0 + bw - 2, y]); }
  // stöttorna ner mot markisen
  for (const sx of [x0 + 6, x0 + bw - 7]) { P.vl(sx, yb, 3, IRON[2]); P.px(sx + 1, yb, IRON[3]); }
  return { x0, y0, bw, bh };
}
// bakväggen: fn(x, y, ao) ger färgen – ao = skuggan under markisen och i hörnen (1 = ingen skugga)
function vagg(P, xl, xr, y0, y1, fn) {
  for (let y = y0; y <= y1; y++) for (let x = xl; x <= xr; x++) {
    const top = y - y0, kant = Math.min(x - xl, xr - x);
    let ao = 1;
    if (top < 5) ao *= 0.66 + top * 0.068;
    if (kant < 2) ao *= 0.8 + kant * 0.08;
    P.px(x, y, fn(x, y, ao));
  }
}
// disken: skiva i ljust trä, front med dekorband, sparklist – deko(x, y) får måla frontens mönster
function disk(P, xl, xr, ytop, front, deko) {
  for (let x = xl; x <= xr; x++) {
    P.px(x, ytop, tone(WOOD, 0.95 - (x - xl) / (xr - xl) * 0.2, x, ytop)); P.px(x, ytop + 1, tone(WOOD, 0.6, x, ytop + 1)); P.px(x, ytop + 2, WOOD[1]);
    for (let y = ytop + 3; y <= -2; y++) {
      let v = 0.78 - (x - xl) / (xr - xl) * 0.24 + (hash(x >> 3, y, 72) - 0.5) * 0.06;
      if (y === ytop + 3) v -= 0.18;
      P.px(x, y, tone(front, v, x, y));
    }
    P.px(x, -1, mul(front[0], 0.8)); P.px(x, 0, 0x2a2026);
  }
  P.px(xl, ytop, WOOD[4]);
  for (let y = ytop + 3; y <= -2; y++) for (let x = xl; x <= xr; x++) { const c = deko(x, y); if (c != null) P.px(x, y, c); }
}

// ---------- små saker ----------
export function miniGlass(P, x, y, kula, mjuk = false, kula2 = null) {
  P.px(x, y, VAF[1]); P.px(x - 1, y - 1, VAF[2]); P.px(x, y - 1, VAF[3]); P.px(x + 1, y - 1, VAF[1]);
  if (mjuk) { P.rect(x - 1, y - 4, 3, 3, 0xf4ead0); P.px(x - 1, y - 4, 0xffffff); P.px(x + 1, y - 3, 0xb89e6c); P.px(x + 1, y - 2, 0xa88a58); P.px(x, y - 5, 0xf4ead0); P.px(x, y - 6, 0xc8b088); return; }
  P.rect(x - 1, y - 4, 3, 3, kula[2]); P.px(x - 1, y - 4, kula[4]); P.px(x, y - 3, kula[3]); P.px(x + 1, y - 2, kula[1]);
  if (kula2) { P.rect(x - 1, y - 6, 3, 2, kula2[2]); P.px(x - 1, y - 6, kula2[4]); P.px(x + 1, y - 5, kula2[1]); }
}
const KULOR = [ROSA, [0x9a8448, 0xc8b070, 0xe8d8a0, 0xf8eecc, 0xfffaea], GRON, [0x2a1a10, 0x4a2e1a, 0x6a4628, 0x8a6238, 0xaa8050], BLA, ROD, GUL, LILA];
// en balja kulglass: rundad topp, skopade vågor, glans uppe till vänster
function balja(P, x, y, w, h, pal, frö) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (j === 0 && (i === 0 || i === w - 1)) continue;
    let v = 0.7 - j * 0.12 - i * 0.05 + (hash(x + i, y + j, frö) - 0.5) * 0.14;
    if ((i + j * 2 + frö) % 5 === 0) v += 0.2;
    P.px(x + i, y + j, tone(pal, v, x + i, y + j));
  }
}
// en glödlampa på krittavlan/skylten när den är släckt (dag): en liten glaskula
export const LAMP_FARGER = [0xfff2c0, 0xffe060, 0xff8ac0, 0x8ae0ff, 0xa8ff9a, 0xffb060];

// ======================= STÅNDEN =======================
// Varje stånd: { id, W, namn, tema: { pel: [A, B], mark: [A, B], skyltBg, skyltFg, skyltKant }, prydnad(P), inne(P, xl, xr),
// framfor(P, xl, xr), expedit: { dx, look }, lampor (fylls när bilden målas), live(ctx, x, y, t, natt) }
const HOJD = 140;
function malaBak(S, natt) {
  const W = S.W, xl = -(W >> 1), xr = (W >> 1) - 1, lampor = [];
  return {
    bild: spr(W + 20, HOJD + 6, (W + 20) >> 1, HOJD + 2, (P) => {
      S.prydnad(P, natt);
      const sk = skylt(P, 0, -78, S.namn, S.tema.skyltBg, S.tema.skyltFg, S.tema.skyltKant, lampor);
      S.skyltRuta = sk;
      const mb = markis(P, xl - 3, xr + 3, -74, 11, S.tema.mark[0], S.tema.mark[1], lampor);
      vagg(P, xl + 6, xr - 6, mb - 1, -16, (x, y, ao) => S.vagg(x, y, ao, natt));
      S.inne(P, xl + 6, xr - 6, natt, lampor);
      pelare(P, xl, mb - 2, -1, S.tema.pel[0], S.tema.pel[1], lampor);
      pelare(P, xr - 5, mb - 2, -1, S.tema.pel[0], S.tema.pel[1], lampor);
    }),
    lampor,
  };
}
function malaFram(S, natt) {
  const W = S.W, xl = -(W >> 1), xr = (W >> 1) - 1;
  return spr(W + 40, 60, (W + 40) >> 1, 50, (P) => {
    disk(P, xl + 6, xr - 6, -15, S.tema.disk, (x, y) => S.diskDeko(x, y));
    S.framfor(P, xl, xr, natt);
  });
}
const CACHE = new Map();
export function standBilder(S, natt) {
  const k = S.id + (natt ? 'n' : 'd');
  if (!CACHE.has(k)) { const b = malaBak(S, natt); CACHE.set(k, { bak: b.bild, fram: malaFram(S, natt), lampor: b.lampor }); }
  return CACHE.get(k);
}
// glödlamporna: alltid tända (tivolilampor lyser även på dagen); en jagande slinga och gnistor som blinkar till
export function ritaLampor(ctx, x, y, lampor, t, natt, frö = 0) {
  const steg = Math.floor(t * 7);
  for (let i = 0; i < lampor.length; i++) {
    const [lx, ly] = lampor[i], px = Math.round(x + lx), py = Math.round(y + ly);
    const c = LAMP_FARGER[(i + frö) % LAMP_FARGER.length], jag = (i + steg) % 5 === 0;
    ctx.fillStyle = jag ? '#ffffff' : '#' + c.toString(16).padStart(6, '0');
    ctx.fillRect(px, py, 1, 1);
    const g = hash(i, Math.floor(t * 3 + i * 0.37), 77 + frö);
    if (g > 0.965 || (natt && jag)) {   // gnistan: ett litet kors
      ctx.fillStyle = natt ? 'rgba(255,250,220,.85)' : 'rgba(255,255,255,.75)';
      ctx.fillRect(px - 1, py, 1, 1); ctx.fillRect(px + 1, py, 1, 1); ctx.fillRect(px, py - 1, 1, 1); ctx.fillRect(px, py + 1, 1, 1);
      if (g > 0.99) { ctx.fillRect(px - 2, py, 1, 1); ctx.fillRect(px + 2, py, 1, 1); ctx.fillRect(px, py - 2, 1, 1); ctx.fillRect(px, py + 2, 1, 1); }
    }
  }
}
// kvällsskenet: varje lampa en liten gloria + skylten och öppningen lyser (ritas med 'lighter')
export function ritaSken(ctx, x, y, S, lampor, t) {
  const sken = (cx, cy, r, c) => { const g = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); };
  const steg = Math.floor(t * 7);
  for (let i = 0; i < lampor.length; i += 2) { const [lx, ly] = lampor[i]; sken(x + lx + 0.5, y + ly + 0.5, (i + steg) % 5 === 0 ? 5 : 3, 'rgba(255,230,160,.35)'); }
  sken(x, y - 38, S.W * 0.55, 'rgba(255,210,140,.3)');
  sken(x, y + 4, S.W * 0.6, 'rgba(255,190,110,.22)');
  if (S.skyltRuta) sken(x, y - 86, S.skyltRuta.bw * 0.7, S.tema.skenFarg || 'rgba(255,160,200,.3)');
}

// (verktygen för ståndens egna målare: js/pixelberg/stand-mat.js och stand-spel.js)
export { tone, klot, kontur, skylttext, balja, CREAM, WOOD, STEEL, IRON, GOLD, VAF, STRO, KULOR };
