// 🌳 TASSBACKENS PARK OCH GÅRDAR i full prakt (v0.133) – södra sidan av Tassgatan med samma hantverk som husen
// (js/tassbacken/hus.js): hundkojor i plank med spåntak och namnskylt, kaninburen med nät (kaninerna syns bakom),
// busshållplatsen med skylt och tidtabell, buskar med hortensior och rododendron, parklyktor, andhuset i dammen,
// valvet HUNDPARKEN över grinden, påsautomaten, hundfontänen, picknickkorgen, vattenhon och däcket i rastgården –
// och fjärilar som fladdrar runt blommorna. Allt målas EN gång till små bilder (cachade), fjärilarna och
// fontänens droppar ritas varje bildruta. Origo i varje bild = foten (x, y i världen).
import { Pix, SMALL, text, textW, mix, mul, hash } from '../core/floor-pix.js';
import { $t } from '../core/i18n.js';
import { PENNOR, FARGER } from './hus.js';

const { tone, fyll, spr } = PENNOR;
const { VIT, FALU, SKIF, TAKR, MINP, BLAP, MASS, JARN, ZINK, STEN, TRA, TERR, BLAD, RODT, BLA } = FARGER;
const GRON = [0x163e1c, 0x22602a, 0x34883c, 0x58b45a, 0x9ce08c];
const GULT = [0x845408, 0xc08c10, 0xeebc20, 0xffde5c, 0xfff6b4];

const S = new Map();
// en bild med origo i (ax, ay) – målas en gång, med mörk kontur runt om
function bild(key, w, h, ax, ay, fn) {
  if (S.has(key)) return S.get(key);
  const P = new Pix(w, h, -ax, -ay); fn(P); kontur(P);
  const s = { img: P.flush(), ax, ay }; S.set(key, s); return s;
}
const put = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
function kontur(P, dark = 0x1e1a24) {
  const { w, h, d } = P, A = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 200, add = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (d[(y * w + x) * 4 + 3]) continue; if (A(x, y - 1) || A(x - 1, y) || A(x + 1, y) || A(x, y + 1)) add.push(x, y); }
  for (let i = 0; i < add.length; i += 2) P.px(add[i] + P.ox, add[i + 1] + P.oy, dark);
}
const skugga = (ctx, x, y, w) => { ctx.fillStyle = 'rgba(20,12,30,.24)'; ctx.fillRect(Math.round(x - w / 2), Math.round(y) - 1, Math.round(w), 3); };

// ---------------------------------------------------------------- 🐕 hundkojan
// plankor i husets färg, gavel med vindskivor, spåntak, rundbågig öppning, namnskylt och en matskål med ett ben
// (Carl 2026-10-13: "många fler detaljer på hundhusen" – trädäck framför, blomlåda på gaveln, en lykta, dörrmatta
// med VOV, matskål + vattenskål, ett ben och en boll, en flagga på nocken, en hund som tittar ut ur kojan 0)
export function ritaKoja(ctx, x, y, i) {
  const [pal, namn] = [[FALU, 'FIA'], [BLAP, 'BOSSE'], [MINP, 'SIXTEN']][i % 3];
  skugga(ctx, x, y, 34);
  put(ctx, bild(`koja${i}`, 48, 40, 24, 34, (P) => {
    // trädäcket framför kojan (plankor) och dörrmattan
    fyll(P, -18, 0, 20, 5, (X, Y) => tone(TRA, (Y === 0 ? 0.85 : 0.55) - ((X + 18) % 6 === 5 ? 0.25 : 0) - Y * 0.04, X, Y));
    fyll(P, -5, 1, 5, 4, (X, Y) => ((X + Y) & 1 ? 0x8a3a2a : 0xd8343c)); P.px(-3, 2, 0xf4ecd8); P.px(-1, 2, 0xf4ecd8); P.px(1, 2, 0xf4ecd8); P.px(3, 2, 0xf4ecd8);
    fyll(P, -10, -13, 9, -1, (X, Y) => { const k = (X + 10) % 4; return tone(pal, 0.64 - (X + 10) / 20 * 0.28 + (k === 0 ? -0.22 : k === 1 ? 0.14 : 0) - (Y + 13) * 0.004, X, Y); });
    for (let j = 0; j < 9; j++) { const half = Math.round((j + 1) * 10 / 9); for (let X = -half; X < half; X++) P.px(X, -22 + j, tone(pal, 0.6 - (X + half) / (half * 2) * 0.22 + ((X + 20) % 4 === 0 ? -0.2 : 0), X, -22 + j)); }
    // taket: två takfall (spån) som syns bakom gaveln, ljust till vänster
    for (let j = 0; j < 12; j++) for (const s of [-1, 1]) { const ex = Math.round(j * 13 / 11); for (let k = 0; k < 4; k++) { const X = s * ex + (s < 0 ? -1 : 0), Y = -24 + j - k; const v = (s < 0 ? 0.72 : 0.38) + ((j + k) % 3 === 0 ? -0.16 : 0) + ((X + k * 2) % 5 === 0 ? -0.08 : 0); P.px(X, Y, tone(TAKR, v, X, Y)); } }
    // vindskivorna (vita) längs gaveln och en liten tass på nocken
    for (let j = 0; j < 11; j++) { const ex = Math.round(j * 12 / 10); P.px(-ex - 1, -23 + j, VIT[4]); P.px(ex, -23 + j, VIT[2]); P.px(-ex, -23 + j, VIT[3]); P.px(ex - 1, -23 + j, VIT[1]); }
    P.px(0, -25, MASS[3]); P.px(-1, -25, MASS[3]);
    // öppningen (rundbåge) med en ljus karm
    fyll(P, -5, -10, 4, -1, (X, Y) => { const d = Y < -6 ? Math.hypot(X + 0.5, Y + 6) : 0; if (d > 5) return null; if (d > 4 || X === -5 || X === 4) return VIT[3]; return Y < -5 ? 0x0a0608 : 0x16100e; });
    // namnskylten ovanför öppningen
    const tw = textW(SMALL, namn); fyll(P, -(tw >> 1) - 2, -18, (tw >> 1) + 1, -12, (X, Y) => (Y === -18 ? MASS[4] : Y === -12 ? MASS[1] : 0xf4ecd8)); text(P, SMALL, namn, -(tw >> 1), -17, 0x5a2a18);
    // flaggan på nocken, lyktan på gaveln, blomlådan på väggen
    P.vl(8, -31, 7, JARN[3]); P.px(8, -32, MASS[3]); for (let k = 0; k < 5; k++) P.px(9 + k, -31 + (k > 2 ? 1 : 0), [RODT[2], RODT[3], 0xf4f1ea, RODT[2], RODT[3]][k]);
    P.rect(-12, -19, 3, 4, JARN[2]); P.px(-11, -20, JARN[3]); P.px(-11, -17, 0xffe8a0); P.px(-11, -16, 0xffd060); P.px(-12, -15, JARN[1]); P.px(-10, -15, JARN[1]);
    fyll(P, 5, -8, 9, -6, (X, Y) => tone(TRA, Y === -8 ? 0.85 : 0.5, X, Y)); P.px(5, -9, 0xe0384a); P.px(7, -10, 0xf0c030); P.px(9, -9, 0xf06aa0); P.px(6, -9, 0x3e7e2a); P.px(8, -9, 0x3e7e2a);
    // matskålen och vattenskålen på däcket, ett ben, en boll och en tass målad på däcket
    fyll(P, 9, -2, 15, 0, (X, Y) => (Y === -2 ? RODT[4] : tone(RODT, 0.6 - (X - 9) * 0.05, X, Y))); P.hl(10, -2, 5, 0x8a5a3a); P.px(12, -2, 0xf0d8a0);
    fyll(P, 15, -2, 20, 0, (X, Y) => (Y === -2 ? BLA[4] : tone(BLA, 0.6 - (X - 15) * 0.05, X, Y))); P.hl(16, -2, 3, 0x9ad8f8);
    spr(P, -17, -2, ['w..w', '.ww.', 'w..w'], { w: 0xf4ecd8 });
    P.rect(-11, -4, 3, 3, 0xf0c030); P.px(-11, -4, 0xfff0a0); P.px(-9, -2, 0xc89a20);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, -2], [1, -3], [3, -2], [-2, 0], [3, 0]]) P.px(14 + dx, 2 + dy, 0x5a3a20, 0.6);
    // en hund som tittar ut ur kojan (bara i den första) – nos, ögon och ett öra
    if (i === 0) spr(P, -4, -8, ['.aaaaa.', 'aeaaaea', 'aaaaaaa', '.aannaa', '..aaaa.'], { a: 0xc89a5a, e: 0x1a1414, n: 0x2a1a1a });
    else if (i === 1) { P.rect(-3, -5, 6, 3, 0x6a4a3a); P.hl(-3, -5, 6, 0x8a6a5a); }   // en filt att ligga på
  }), x, y);
}

// ---------------------------------------------------------------- 🐇 kaninburen (bak + nät fram – kaninerna sitter emellan)
const BUR_W = 56;
export function ritaBurBak(ctx, x, y) {
  skugga(ctx, x, y, BUR_W + 4);
  put(ctx, bild('burbak', BUR_W + 10, 40, (BUR_W >> 1) + 5, 34, (P) => {
    const x0 = -(BUR_W >> 1), x1 = x0 + BUR_W - 1;
    for (const lx of [x0 + 1, 0, x1 - 2]) fyll(P, lx, -7, lx + 1, 0, (X, Y) => tone(TRA, X === lx ? 0.6 : 0.35, X, Y));
    fyll(P, x0, -26, x1, -9, (X, Y) => tone(TRA, 0.32 + ((X + 60) % 5 === 0 ? -0.12 : 0) + (Y + 26) * 0.006, X, Y));
    fyll(P, x0, -9, x1, -7, (X, Y) => tone(TRA, Y === -9 ? 0.85 : 0.5, X, Y));
    for (let k = 0; k < 40; k++) { const X = x0 + 10 + ((hash(k, 1, 77) * (BUR_W - 12)) | 0), Y = -10 - ((hash(k, 2, 77) * 3) | 0); P.px(X, Y, hash(k, 3, 77) > 0.5 ? 0xe8c860 : 0xc8a040); }   // höet
    fyll(P, x1 - 8, -24, x1 - 6, -14, (X, Y) => (Y < -22 ? ZINK[3] : 0xb8e0f0)); P.px(x1 - 7, -13, ZINK[2]);   // vattenflaskan
    spr(P, x0 + 22, -12, ['..g.g', '.oog.', 'ooo..', 'oo...'], { o: 0xf08a2a, g: 0x46a35a });   // morötterna
    // huset längst till vänster (plank, ett runt hål)
    fyll(P, x0, -26, x0 + 9, -8, (X, Y) => tone(FALU, 0.62 - (X - x0) * 0.03 + ((X - x0) % 3 === 0 ? -0.15 : 0), X, Y));
    fyll(P, x0 + 2, -18, x0 + 7, -12, (X, Y) => (Math.hypot(X - x0 - 4.5, Y + 15) < 3 ? 0x140c0a : null));
    // taket (spån) med överhäng
    for (let j = 0; j < 5; j++) fyll(P, x0 - 2 + (j >> 1), -31 + j, x1 + 2 - (j >> 1), -31 + j, (X, Y) => tone(SKIF, 0.68 - j * 0.07 + ((X + j * 2) % 5 === 0 ? -0.1 : 0), X, Y));
    P.hl(x0 - 2, -26, BUR_W + 4, SKIF[0]);
  }), x, y);
}
export function ritaBurFram(ctx, x, y) {
  put(ctx, bild('burfram', BUR_W + 10, 40, (BUR_W >> 1) + 5, 34, (P) => {
    const x0 = -(BUR_W >> 1) + 10, x1 = -(BUR_W >> 1) + BUR_W - 1;
    for (let Y = -25; Y <= -10; Y++) for (let X = x0; X <= x1; X++) if ((X - x0) % 3 === 0 || (Y + 25) % 3 === 0) P.px(X, Y, 0xd8dce0, (X - x0) % 3 === 0 && (Y + 25) % 3 === 0 ? 0.95 : 0.6);
    for (const X of [x0 - 1, Math.round((x0 + x1) / 2), x1]) fyll(P, X, -26, X + 1, -9, (XX, Y) => tone(TRA, XX === X ? 0.75 : 0.45, XX, Y));
    P.hl(x0 - 1, -26, x1 - x0 + 2, TRA[3]); P.rect(Math.round((x0 + x1) / 2) + 2, -18, 2, 3, MASS[3]);
  }), x, y);
}

// ---------------------------------------------------------------- 🚌 busshållplatsen
export function ritaHallplats(ctx, x, y) {
  skugga(ctx, x + 6, y, 22);
  const namn = $t('TASSBACKEN');
  put(ctx, bild(`hallplats|${namn}`, Math.max(64, textW(SMALL, namn) + 44), 52, 32, 46, (P) => {
    fyll(P, 0, -36, 1, 0, (X, Y) => tone(ZINK, X === 0 ? 0.85 : 0.45, X, Y)); P.rect(-1, -1, 4, 2, ZINK[1]);
    // den runda skylten: gul med mörk kant och en buss
    fyll(P, -6, -46, 7, -34, (X, Y) => { const d = Math.hypot(X - 0.5, Y + 40); return d > 6.6 ? null : d > 5.5 ? 0x2a2a30 : tone(GULT, 0.8 - (Y + 46) * 0.03 - (X + 6) * 0.01, X, Y); });
    spr(P, -3, -43, ['bbbbbbb', 'bwbwbwb', 'bbbbbbb', 'bbbbbbb', '.k...k.'], { b: 0x2a5aa8, w: 0xd8f0ff, k: 0x1a1a1e });
    // namnplåten TASSBACKEN och tidtabellen
    const s = $t('TASSBACKEN'), tw = textW(SMALL, s);
    fyll(P, 2, -33, tw + 7, -26, (X, Y) => (Y === -33 ? 0x5a8ae8 : tone(BLA, 0.6, X, Y))); text(P, SMALL, s, 5, -31, 0xffffff);
    fyll(P, -7, -22, -2, -12, (X, Y) => (X === -7 || Y === -22 ? ZINK[3] : 0xfaf9f6));
    for (let j = 0; j < 4; j++) P.hl(-6, -20 + j * 2, 3 + (j % 2), JARN[3]);
    // en liten papperskorg på stolpen
    fyll(P, 2, -14, 6, -7, (X, Y) => tone(GRON, 0.6 - (X - 2) * 0.08, X, Y)); P.hl(2, -14, 5, GRON[4]);
  }), x, y);
}

// ---------------------------------------------------------------- buskar, lyktor och prylar
const BUSKFARG = { rosa: [0xc83a7a, 0xe86aa0, 0xff9ac4, 0xffd0e4], bla: [0x3a5ac8, 0x6a8ae8, 0x9ab8ff, 0xd0e0ff], rodo: [0x8a2a8a, 0xb84ab0, 0xd87ad0, 0xf0b8ec] };
export function ritaBuske(ctx, b) {
  skugga(ctx, b.x, b.y, 18);
  put(ctx, bild(`buske|${b.typ}|${b.x}`, 24, 18, 12, 15, (P) => {
    const F = BUSKFARG[b.typ] || BUSKFARG.rosa;
    fyll(P, -9, -13, 9, 0, (X, Y) => { const d = Math.hypot(X / 9.5, (Y + 6) / 7.5); if (d > 1 || (d > 0.85 && hash(X, Y, b.x) > 0.5)) return null; const v = 0.6 - X * 0.03 - (Y + 6) * 0.04 + (hash(X >> 1, Y >> 1, b.x) - 0.5) * 0.3; return tone(BLAD, v, X, Y); });
    for (let k = 0; k < 7; k++) { const cx = -6 + ((hash(k, 1, b.x) * 12) | 0), cy = -11 + ((hash(k, 2, b.x) * 8) | 0); for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]]) P.px(cx + i, cy + j, F[(i + j + 2 + k) % 3 + (i < 0 || j < 0 ? 1 : 0)]); }
  }), b.x, b.y);
}
export function ritaParklykta(ctx, l, natt) {
  skugga(ctx, l.x, l.y, 8);
  put(ctx, bild(`plykta|${natt ? 1 : 0}`, 14, 30, 7, 27, (P) => {
    fyll(P, -2, -3, 2, 0, (X, Y) => tone(JARN, 0.6 - (X + 2) * 0.1, X, Y));
    fyll(P, 0, -18, 1, -4, (X, Y) => tone(JARN, X === 0 ? 0.75 : 0.35, X, Y));
    P.hl(-1, -12, 4, JARN[3]);
    fyll(P, -2, -24, 3, -19, (X, Y) => (X === -2 || X === 3 ? JARN[1] : natt ? (X === -1 ? 0xfff6d0 : 0xffe090) : X === -1 ? 0xf0f4f4 : 0xc8d4dc));
    P.hl(-3, -25, 8, JARN[2]); P.hl(-2, -26, 6, JARN[3]); P.px(0, -27, JARN[4]); P.px(1, -27, JARN[3]); P.hl(-3, -18, 8, JARN[2]);
  }), l.x, l.y);
}
export function parklyktaSken(ctx, l) {
  const g = ctx.createRadialGradient(l.x + 0.5, l.y - 21, 1, l.x + 0.5, l.y - 21, 26);
  g.addColorStop(0, 'rgba(255,224,150,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(l.x - 26, l.y - 47, 52, 52);
  ctx.fillStyle = 'rgba(255,214,140,.12)'; ctx.fillRect(l.x - 10, l.y - 1, 21, 4);
}
export function ritaParkPryl(ctx, p, t) {
  const R = (c, X, Y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(X), Math.round(Y), w, h); };
  if (p.typ === 'ankhus') {
    put(ctx, bild('ankhus', 30, 34, 15, 30, (P) => {
      fyll(P, 0, -12, 1, 0, (X, Y) => tone(TRA, X === 0 ? 0.6 : 0.35, X, Y));
      fyll(P, -7, -21, 7, -13, (X, Y) => tone(RODT, 0.6 - (X + 7) * 0.02 + ((X + 7) % 4 === 0 ? -0.12 : 0), X, Y));
      for (let j = 0; j < 6; j++) fyll(P, -9 + j, -22 - j, 9 - j, -22 - j, (X, Y) => tone(SKIF, 0.62 - j * 0.04, X, Y));
      fyll(P, -2, -19, 2, -14, (X, Y) => (Math.hypot(X, Y + 16) < 2.7 ? 0x140c0a : null));
      P.hl(-8, -13, 17, VIT[3]); P.hl(-8, -12, 17, TRA[2]);
      for (let k = 0; k < 9; k++) { P.px(8 + k, -12 + k, TRA[3]); P.px(8 + k, -11 + k, TRA[1]); if (k % 2) P.px(8 + k, -13 + k, TRA[4]); }
    }), p.x, p.y);
    R('rgba(255,255,255,.4)', p.x - 3, p.y + 1, 7, 1);
  } else if (p.typ === 'pasar') {
    skugga(ctx, p.x, p.y, 8);
    put(ctx, bild('pasar', 16, 24, 8, 21, (P) => {
      fyll(P, 0, -12, 1, 0, (X, Y) => tone(GRON, X === 0 ? 0.7 : 0.35, X, Y));
      fyll(P, -3, -20, 4, -12, (X, Y) => tone(GRON, 0.66 - (X + 3) * 0.06 + (Y === -20 ? 0.25 : 0), X, Y));
      P.rect(-2, -14, 6, 2, 0x1a2a1a); P.px(0, -13, 0x3a7a3a); P.px(1, -12, 0x3a7a3a);
      spr(P, -2, -19, ['.ww.', 'wwww', 'w..w'], { w: 0xffffff });
    }), p.x, p.y);
  } else if (p.typ === 'hundfontan') {
    skugga(ctx, p.x, p.y, 12);
    put(ctx, bild('hundfontan', 20, 24, 10, 21, (P) => {
      fyll(P, -2, -14, 2, -1, (X, Y) => tone(STEN, 0.7 - (X + 2) * 0.1 + (Y === -14 ? 0.2 : 0), X, Y));
      P.rect(-1, -16, 3, 2, ZINK[3]); P.px(2, -15, ZINK[2]); P.px(3, -15, ZINK[2]);
      fyll(P, -7, -3, 7, 0, (X, Y) => (Y === -3 ? STEN[4] : Y === -2 && Math.abs(X) < 6 ? 0x6ac0e8 : tone(STEN, 0.5, X, Y)));
      spr(P, -4, -9, ['w...w', '.www.', 'w...w'], { w: 0xf4ecd8 });
    }), p.x, p.y);
    const u = (t * 2.2) % 1; R('#9ad8f8', p.x + 3, p.y - 14 + u * 11); R('#ffffff', p.x + 3, p.y - 3 + (u > 0.9 ? 0 : 1));
  } else if (p.typ === 'korg') {
    put(ctx, bild('picknickkorg', 18, 16, 9, 13, (P) => {
      fyll(P, -5, -6, 5, 0, (X, Y) => tone(SAND_K, 0.6 + ((X + Y) & 1 ? 0.15 : -0.1) - (Y + 6) * 0.02, X, Y));
      for (let k = -4; k <= 4; k++) P.px(k, -7 - Math.round(Math.sqrt(16 - k * k) * 0.9), TRA[2]);
      fyll(P, -5, -6, 5, -6, (X) => (X % 2 ? 0xd8343c : 0xffffff));
      fyll(P, 6, -9, 7, -1, (X, Y) => (Y < -7 ? 0x2a6a3a : X === 6 ? 0x5aa86a : 0x3a8a4a));
    }), p.x, p.y);
  } else if (p.typ === 'ho') {
    skugga(ctx, p.x, p.y, 14);
    put(ctx, bild('vattenho', 20, 10, 10, 7, (P) => { fyll(P, -7, -5, 7, 0, (X, Y) => (Y === -5 ? ZINK[4] : Y === -4 && X > -6 && X < 6 ? 0x6ac0e8 : tone(ZINK, 0.62 - (Y + 5) * 0.06 - (X + 7) * 0.01, X, Y))); P.px(-3, -4, 0xd8f4ff); P.px(2, -4, 0xd8f4ff); }), p.x, p.y);
  } else if (p.typ === 'dack') {
    put(ctx, bild('dack', 22, 12, 11, 8, (P) => {
      fyll(P, -9, -6, 9, 1, (X, Y) => { const d = Math.hypot(X / 9.5, (Y + 2.5) / 4); return d > 1 || d < 0.55 ? null : tone(JARN, 0.5 - (Y + 2.5) * 0.08 + ((X + 20) % 3 === 0 ? -0.1 : 0), X, Y); });
      fyll(P, -3, -4, -1, -2, () => 0xd8e848); P.px(-3, -4, 0xf8ff98);
    }), p.x, p.y);
  }
}
const SAND_K = [0x6a4a22, 0x9a7034, 0xc0964a, 0xdcb468, 0xf0d494];

// ---------------------------------------------------------------- valvet HUNDPARKEN över grinden
export function ritaGrindskylt(ctx, x0, x1, y) {
  put(ctx, bild(`grindskylt|${$t('HUNDPARKEN')}`, x1 - x0 + 30, 50, 15, 46, (P) => {
    const w = x1 - x0;
    for (const px of [-1, w - 2]) { fyll(P, px, -32, px + 2, 0, (X, Y) => tone(VIT, X === px ? 0.95 : X === px + 2 ? 0.4 : 0.7, X, Y)); P.rect(px - 1, -34, 5, 2, VIT[4]); P.px(px + 1, -35, MASS[3]); }
    for (let X = 0; X < w; X++) { const u = X / w, by = Math.round(-30 - Math.sin(u * Math.PI) * 6); P.px(X, by, VIT[4]); P.px(X, by + 1, VIT[2]); }
    const s = $t('HUNDPARKEN'), tw = textW(SMALL, s), sw = Math.max(tw + 8, 24), sx = Math.round(w / 2 - sw / 2), sy = -44;
    fyll(P, sx, sy, sx + sw - 1, sy + 8, (X, Y) => (Y === sy ? GRON[4] : Y === sy + 8 ? GRON[0] : tone(GRON, 0.55 - (X - sx) / sw * 0.15, X, Y)));
    text(P, SMALL, s, sx + ((sw - tw) >> 1), sy + 2, 0xffffff);
    spr(P, Math.round(w / 2) - 3, sy - 5, ['oo..oo', 'oaaaao', '.eaae.', '..nn..'], { o: 0x6a4020, a: 0xc89a5a, e: 0x1a1414, n: 0x1a1414 });
  }), x0, y);
}

// ---------------------------------------------------------------- 🦋 fjärilarna (runt buskarna och rabatterna)
const FJARIL = ['#f8f0a0', '#ffffff', '#f4a8c8', '#9ad0ff', '#f0a040'];
export function ritaFjarilar(ctx, t, platser) {
  platser.forEach(([cx, cy], k) => {
    const x = Math.round(cx + Math.sin(t * 0.6 + k * 1.7) * 14 + Math.sin(t * 1.9 + k) * 3), y = Math.round(cy - 10 + Math.sin(t * 1.1 + k * 2.3) * 6), c = FJARIL[k % FJARIL.length], upp = Math.floor(t * 9 + k) % 2;
    ctx.fillStyle = '#3a2a2a'; ctx.fillRect(x, y, 1, 2);
    ctx.fillStyle = c; if (upp) { ctx.fillRect(x - 2, y - 1, 2, 2); ctx.fillRect(x + 1, y - 1, 2, 2); } else { ctx.fillRect(x - 1, y, 1, 2); ctx.fillRect(x + 1, y, 1, 2); }
  });
}
