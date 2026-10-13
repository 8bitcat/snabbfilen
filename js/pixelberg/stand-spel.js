// 🎰🥫🎯 SPELSTÅNDEN på Pixelberg (ramen: js/pixelberg/kiosk.js) – lyckohjulet, burktornet och skjutbanan i samma
// stil som matstånden: marinblå sammet med guldstjärnor och ett stort hjul som sakta snurrar, plankvägg med
// burkpyramider och gosedjur som hänger i taket, en mörk skjutbana där plåtfigurerna åker på sina skenor.
import { SMALL, text, textW, mix, mul, hash } from '../core/floor-pix.js';
import { $t } from '../core/i18n.js';
import { tone, klot, CREAM, WOOD, STEEL, IRON, GOLD, ROSA, ROD, BLA, GUL, GRON, LILA, TURK } from './kiosk.js';

const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
// ett litet gosedjur som sitter (6 × 7): nalle, kanin, katt eller anka
const GOS = { nalle: [0x6a3a1e, 0x9a6234, 0xc89060, 0xe8bc8c], kanin: [0xb0507a, 0xe08aaa, 0xf8c0d4, 0xffe8f0], katt: [0x8a8a98, 0xc8c8d4, 0xf0f0f6, 0xffffff], anka: [0x9a6a08, 0xe0b020, 0xf8d850, 0xfff0a0], bjorn: [0x2a5a9a, 0x4a86d0, 0x80b0f0, 0xc0dcff] };
function gosedjur(P, x, y, typ) {   // (x, y) = nedre vänstra hörnet
  const c = GOS[typ] || GOS.nalle;
  P.rect(x + 1, y - 4, 4, 4, c[2]); P.vl(x + 4, y - 4, 4, c[1]); P.px(x + 1, y - 4, c[3]);   // kroppen
  P.rect(x, y - 7, 6, 3, c[2]); P.px(x, y - 7, c[3]); P.vl(x + 5, y - 7, 3, c[1]);              // huvudet
  if (typ === 'kanin') { P.vl(x + 1, y - 10, 3, c[2]); P.vl(x + 4, y - 10, 3, c[1]); }
  else if (typ === 'katt') { P.px(x, y - 8, c[2]); P.px(x + 5, y - 8, c[1]); }
  else if (typ === 'anka') { P.px(x + 6, y - 6, 0xf08a2a); P.px(x + 6, y - 5, 0xd06a1a); }
  else { P.px(x, y - 8, c[1]); P.px(x + 5, y - 8, c[0]); }
  P.px(x + 1, y - 6, 0x1e1a24); P.px(x + 4, y - 6, 0x1e1a24); P.px(x + 2, y - 5, typ === 'anka' ? 0xf08a2a : 0x3a2418);
  if (typ !== 'anka') { P.px(x + 1, y - 1, c[1]); P.px(x + 4, y - 1, c[0]); }
}

// ======================= 🎰 LYCKOHJULET =======================
const HJ_FARG = [0xe04848, 0xf4f1ea, 0x3a7bd5, 0xf4f1ea, 0x46a35a, 0xf4f1ea, 0xd060a0, 0xf4f1ea, 0xf0c030, 0xf4f1ea, 0x9a6ad8, 0xf4f1ea];
const HJ_CACHE = new Map();
function hjulBild(steg) {   // hjulet (r 17) i 48 vinkelsteg, cachat
  if (HJ_CACHE.has(steg)) return HJ_CACHE.get(steg);
  const c = document.createElement('canvas'); c.width = 38; c.height = 38;
  const x = c.getContext('2d'), v0 = steg / 48 * Math.PI * 2;
  for (let yy = -18; yy <= 18; yy++) for (let xx = -18; xx <= 18; xx++) {
    const d = Math.hypot(xx, yy); if (d > 17.4) continue;
    let col;
    if (d > 15.6) col = d > 16.8 ? 0x8a6a1a : 0xf0c030;
    else { const seg = Math.floor((((Math.atan2(yy, xx) - v0) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2)) / (Math.PI / 6)); col = HJ_FARG[seg]; if (d > 14.6) col = mul(col, 0.82); if (xx < -3 && yy < -3 && d < 14) col = mix(col, 0xffffff, 0.12); }
    x.fillStyle = css(col); x.fillRect(xx + 19, yy + 19, 1, 1);
  }
  x.fillStyle = '#f0c030'; x.fillRect(16, 16, 6, 6); x.fillStyle = '#8a6a1a'; x.fillRect(18, 18, 2, 2); x.fillStyle = '#fff0a0'; x.fillRect(16, 16, 2, 1);
  HJ_CACHE.set(steg, c); return c;
}
export const LYCKA = {
  id: 'lycka', W: 96, namn: $t('LYCKOHJULET'),
  tema: { pel: [BLA, GUL], mark: [BLA, GUL], skyltBg: BLA, skyltFg: 0xffe060, skyltKant: 0x0c1430, disk: BLA, skenFarg: 'rgba(255,220,100,.32)' },
  expedit: { dx: -26 },
  vagg(x, y, ao, natt) {
    let c = mix(0x1e2a5a, 0x26346a, hash(x >> 1, y >> 1, 111) * 0.6);
    const sx = (x + 200) % 9, sy = (y + 200 + (Math.floor((x + 200) / 9) % 2) * 4) % 8;
    if ((sx === 4 && sy === 3) || (sx === 4 && (sy === 2 || sy === 4)) || (sy === 3 && (sx === 3 || sx === 5))) c = sx === 4 && sy === 3 ? 0xffe060 : 0xc89a20;
    return mul(c, ao * (natt ? 0.92 : 1));
  },
  inne(P, xl, xr, natt, lampor) {
    // hyllorna med gosedjur till vänster och höger om hjulet
    const typer = ['nalle', 'kanin', 'katt', 'anka', 'bjorn'];
    for (const [x0, x1] of [[-41, -21], [20, 40]]) for (let r = 0; r < 3; r++) {
      const yy = -46 + r * 10;
      for (let x = x0; x <= x1; x++) { P.px(x, yy, tone(WOOD, 0.85, x, yy)); P.px(x, yy + 1, tone(WOOD, 0.45, x, yy)); }
      for (let k = 0; k < 3; k++) gosedjur(P, x0 + 1 + k * 7, yy, typer[(r * 3 + k + (x0 > 0 ? 2 : 0)) % typer.length]);
    }
    // hjulets fäste och lamporna runt fälgen (hjulet ritas av live – det snurrar)
    P.rect(-2, -20, 5, 4, GOLD[2]); P.hl(-2, -20, 5, GOLD[4]);
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; lampor.push([Math.round(Math.cos(a) * 19), Math.round(-38 + Math.sin(a) * 19)]); }
  },
  diskDeko(x, y) {
    if (y === -11 || y === -4) return GOLD[3];
    if (y >= -10 && y <= -5) { const z = Math.abs(((x + 200) % 8) - 4) - Math.abs(y + 7); return z === 0 ? GOLD[3] : null; }
    return null;
  },
  framfor(P) {
    // spelbrädet på disken: tolv färgrutor
    for (let k = 0; k < 12; k++) { const x = -24 + k * 4; P.rect(x, -18, 3, 3, HJ_FARG[k] === 0xf4f1ea ? 0xfffaf0 : HJ_FARG[k]); P.px(x, -18, 0xffffff, 0.5); }
    P.hl(-25, -15, 49, GOLD[2]);
    // en hink med lotter
    P.rect(30, -21, 7, 6, ROD[2]); P.hl(30, -21, 7, ROD[4]); for (let k = 0; k < 5; k++) P.px(31 + k, -22 - (k & 1), k % 2 ? 0xfff6b4 : 0xffffff);
  },
  prydnad(P) {
    // en stor guldhästsko med glödlampor och en fyrklöver i mitten
    // (ett U med öppningen uppåt – då stannar turen i hästskon)
    for (let a = 0; a <= 220; a++) {
      const v = Math.PI * 0.8 + a / 220 * Math.PI * 1.4;
      for (let r = -2; r <= 2; r++) { const xx = Math.round(Math.cos(v) * (12 + r)), yy = Math.round(-112 - Math.sin(v) * (13 + r)); P.px(xx, yy, tone(GOLD, 0.82 - r * 0.1 - Math.cos(v) * 0.15 + Math.sin(v) * 0.1, xx, yy)); }
    }
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) P.px(Math.round(Math.cos(Math.PI * (s < 0 ? 1.05 : 1.95) + k * 0.2 * s) * 12), Math.round(-112 - Math.sin(Math.PI * (s < 0 ? 1.05 : 1.95) + k * 0.2 * s) * 13), IRON[2]);   // spikhålen
    for (const [cx, cy] of [[-2, -116], [2, -116], [-2, -112], [2, -112]]) klot(P, cx, cy, 2.4, 2.4, GRON);
    P.vl(0, -112, 6, GRON[1]); P.px(1, -107, GRON[1]);
  },
  live(ctx, x, y, t) { ctx.drawImage(hjulBild(Math.floor(t * 3) % 48), Math.round(x) - 19, Math.round(y) - 57); ctx.fillStyle = '#1e1a24'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 59, 5, 2); ctx.fillRect(Math.round(x) - 1, Math.round(y) - 57, 3, 2); ctx.fillRect(Math.round(x), Math.round(y) - 55, 1, 1); },
};

// ======================= 🥫 BURKTORNET =======================
const BURK_F = [ROD, BLA, GUL, GRON, ROSA, LILA];
function burk(P, x, y, pal) {   // en burk 5 × 7 (nedre vänstra hörnet)
  for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) {
    const etikett = j >= 2 && j <= 4;
    P.px(x + i, y - 6 + j, etikett ? tone(pal, 0.8 - i * 0.12, x + i, j) : tone(STEEL, 0.9 - i * 0.14, x + i, j));
  }
  P.hl(x, y - 7, 5, STEEL[4]); P.px(x + 1, y - 4, 0xffffff, 0.6);
}
export const KAST = {
  id: 'kast', W: 96, namn: $t('BURKTORNET'),
  tema: { pel: [GRON, CREAM], mark: [GRON, CREAM], skyltBg: GRON, skyltFg: 0xfffaf0, skyltKant: 0x0c2410, disk: GRON, skenFarg: 'rgba(160,255,140,.25)' },
  expedit: { dx: 28 },
  vagg(x, y, ao, natt) {
    const b = Math.floor((x + 200) / 6), fog = (x + 200) % 6 === 0;
    let c = fog ? WOOD[1] : tone(WOOD, 0.55 + (hash(b, y >> 3, 112) - 0.5) * 0.18 + ((x + 200) % 6 === 1 ? 0.12 : 0), x, y);
    return mul(c, ao * (natt ? 0.92 : 1));
  },
  inne(P, xl, xr) {
    // gosedjuren som hänger från taklisten
    P.hl(xl + 1, -57, xr - xl - 1, IRON[3]);
    ['nalle', 'kanin', 'bjorn', 'katt', 'anka', 'nalle', 'kanin'].forEach((typ, k) => { const x = -40 + k * 12; P.vl(x + 2, -57, 2, 0xd8d0c0); gosedjur(P, x, -47, typ); });
    // två hyllor med burkpyramider
    for (const yy of [-34, -22]) for (let x = xl + 1; x <= xr - 1; x++) { P.px(x, yy, tone(WOOD, 0.95, x, yy)); P.px(x, yy + 1, tone(WOOD, 0.5, x, yy)); }
    for (const [cx, yy] of [[-26, -34], [4, -34], [-12, -22], [22, -22]]) {
      let k = 0;
      for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) burk(P, cx - (3 - r) * 3 + i * 6, yy - r * 7, BURK_F[(((k++ + cx) % BURK_F.length) + BURK_F.length) % BURK_F.length]);
    }
  },
  diskDeko(x, y) {
    if (y === -11 || y === -4) return 0xfffaf0;
    if (y >= -9 && y <= -6) return ((x + 200) % 10 < 5) === (y < -7) ? GRON[3] : null;
    return null;
  },
  framfor(P) {
    // trådkorgen med bollar och en stor nalle på disken
    for (let y = -21; y <= -16; y++) for (let x = -34; x <= -20; x++) P.px(x, y, ((x + y) & 1) ? STEEL[2] : 0x2a2830);
    for (let k = 0; k < 6; k++) { const bx = -33 + k * 2 + (k & 1), by = -22 - (k % 3); klot(P, bx + 1, by, 1.6, 1.6, [0x9a8a7a, 0xd8d0c4, 0xf4f1ea, 0xffffff, 0xffffff]); P.px(bx + 1, by, ROD[2]); }
    for (let k = 0; k < 2; k++) gosedjur(P, 26 + k * 7, -15, k ? 'kanin' : 'nalle');
  },
  prydnad(P) {
    // tre jätteburkar i en pyramid och en boll på väg
    const B = (cx, by, pal) => { for (let j = 0; j < 12; j++) for (let i = -5; i <= 5; i++) { const et = j >= 3 && j <= 8; P.px(cx + i, by - j, et ? tone(pal, 0.85 - (i + 5) / 10 * 0.5, i, j) : tone(STEEL, 0.95 - (i + 5) / 10 * 0.55, i, j)); } P.hl(cx - 5, by - 12, 11, STEEL[4]); };
    B(-6, -97, ROD); B(6, -97, BLA); B(0, -109, GUL);
    klot(P, 15, -122, 3.5, 3.5, [0x9a8a7a, 0xd8d0c4, 0xf4f1ea, 0xffffff, 0xffffff]); P.hl(13, -122, 5, ROD[2]);
    for (let k = 0; k < 4; k++) P.px(19 + k * 2, -121 + k, 0xffffff, 0.6 - k * 0.12);
  },
};

// ======================= 🎯 SKJUTBANAN =======================
const ANKA = ['..yy...', '.yyyy..', '.ykyyo.', '.yyyyoo', '..yy...', 'yyyyyyy', '.yyyyy.'];
export const SKJUT = {
  id: 'skjut', W: 100, namn: $t('SKJUTBANAN'),
  tema: { pel: [BLA, CREAM], mark: [BLA, CREAM], skyltBg: [0x0c1430, 0x141e46, 0x1e2a5a, 0x2a3a78, 0x40549a], skyltFg: 0xffe060, skyltKant: 0x05070f, disk: WOOD, skenFarg: 'rgba(120,170,255,.3)' },
  expedit: { dx: -30 },
  vagg(x, y, ao, natt) {
    let c = mix(0x141e46, 0x1a2654, hash(x >> 1, y >> 1, 113) * 0.6);
    if (hash(x, y, 114) > 0.985) c = 0xffe060; else if (hash(x, y, 115) > 0.99) c = 0xa8ccff;
    if (y === -51 || y === -41 || y === -31) c = WOOD[3]; else if (y === -50 || y === -40 || y === -30) c = WOOD[1];   // skenorna
    return mul(c, ao * (natt ? 0.92 : 1));
  },
  inne(P, xl, xr) {
    // en stor tavla med ringar uppe till vänster och gosedjur som hänger till höger
    for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) { const d = Math.hypot(x, y); if (d > 7.6) continue; const r = Math.floor(d / 1.6); P.px(-36 + x + 3, -54 + y / 2 | 0, r % 2 ? 0xf4f1ea : ROD[2]); }
    ['anka', 'nalle', 'kanin'].forEach((typ, k) => { const x = 22 + k * 7; P.vl(x + 2, -60, 3, 0xd8d0c0); gosedjur(P, x, -52, typ); });
  },
  diskDeko(x, y) {
    if (y === -11) return GOLD[3];
    if (y >= -9 && y <= -4) { const sx = ((x + 300) % 14) - 7; return Math.abs(sx) <= 1 && y === -7 ? ROD[2] : Math.abs(sx) <= 3 && Math.abs(y + 7) <= 1 && (Math.abs(sx) === 3 || Math.abs(y + 7) === 1) ? 0xf4f1ea : null; }
    return null;
  },
  framfor(P) {
    // två korkgevär med kedja och en ask med korkar
    for (const gx of [-26, 10]) {
      for (let i = 0; i < 16; i++) P.px(gx + i, -18 - (i > 9 ? 1 : 0), i < 6 ? tone(WOOD, 0.8 - i * 0.04, i, 0) : STEEL[i > 13 ? 3 : 1]);
      P.rect(gx, -17, 6, 2, WOOD[2]); P.px(gx + 6, -16, IRON[3]);
      for (let k = 0; k < 4; k++) P.px(gx + 3 - k, -15 + (k & 1), STEEL[2]);
    }
    P.rect(32, -19, 8, 4, 0xc89a5a); P.hl(32, -19, 8, 0xe8c080); for (let k = 0; k < 4; k++) P.px(33 + k * 2, -20, 0xd8b088);
  },
  prydnad(P) {
    // en stor måltavla med en kork mitt i prick
    for (let y = -13; y <= 13; y++) for (let x = -13; x <= 13; x++) { const d = Math.hypot(x, y); if (d > 13.4) continue; const r = Math.floor(d / 2.7); P.px(x, -112 + y, d > 12.6 ? 0x5a1018 : tone(r % 2 ? CREAM : ROD, 0.8 - x / 13 * 0.25 - y / 13 * 0.25, x, y)); }
    P.rect(-1, -113, 3, 3, 0xc89a5a); P.px(-1, -113, 0xe8c080);
    P.vl(0, -98, 2, IRON[3]);
  },
  live(ctx, x, y, t) {   // plåtfigurerna åker på skenorna
    const ritaAnka = (ax, ay, f) => ANKA.forEach((rad, j) => { for (let i = 0; i < rad.length; i++) { const ch = rad[i]; if (ch === '.') continue; ctx.fillStyle = ch === 'k' ? '#1e1a24' : ch === 'o' ? '#f08a2a' : f ? '#f0c030' : '#ffe060'; ctx.fillRect(ax + (f ? 6 - i : i), ay + j, 1, 1); } });
    for (let r = 0; r < 3; r++) {
      const ry = Math.round(y - 52 + r * 10 - 7), fart = r % 2 ? -14 : 11, n = 5;
      for (let k = 0; k < n; k++) {
        const span = 74, px = Math.round(x - 37 + (((k * span / n + t * fart) % span) + span) % span);
        if (r === 1) { ctx.fillStyle = '#ffe060'; ctx.fillRect(px + 2, ry + 2, 3, 3); ctx.fillRect(px + 3, ry + 1, 1, 5); ctx.fillRect(px + 1, ry + 3, 5, 1); }
        else ritaAnka(px, ry, r === 2);
      }
    }
  },
};

export const SPELSTAND = [LYCKA, KAST, SKJUT];
