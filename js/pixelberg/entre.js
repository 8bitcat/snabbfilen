// 🎟️ PIXELBERGS ENTRÉ (v0.135, Carl 2026-10-14: "vägen in är jätteful … känns tomt – flytta ner allting", "gör om
// hela Pixelberget, gör det till en riktig amerikansk temapark"). Entrén ligger NERE i vänstra hörnet: bergbussen
// stannar på bussgatan längst ner, man går upp genom den stora PORTEN i staketet och kommer in på ENTRÉPLATSEN med
// fontänen och Pixel-Nalle-statyn, blomsterrabatterna, flaggstängerna och lyktorna – och därifrån in i parken.
// Utanför staketet: busskuren, bergbussen, biljettluckan, parkkartan, cykelställen och planteringarna. På berget
// ovanför platsen står de stora PIXELBERG-bokstäverna. Allt stillastående är cachade bilder (origo = foten);
// det som rör sig (fontänens vatten, portens glödlampor, bussens blinkers) ritas varje bildruta.
import { SMALL, BIG, text, textW, ctxText, mix, mul, hash } from '../core/floor-pix.js';
import { tone, fyll, spr, skylttext, bild, put, skugga, palett, F } from '../core/pennor.js';
import { glodlampa } from './liv.js';
import { $t } from '../core/i18n.js';

const { VIT, MASS, JARN, ZINK, STEN, TRA, TERR, BLAD, ROD, BLA, GUL, GRON, ROSA, TURK, ASFALT } = F;
const GUMMI = [0x1a1a20, 0x2a2a32, 0x3a3a44, 0x4a4a56, 0x6a6a76];

// var allting står (världskoordinater i js/pixelberg/karta.js – staketlinjen y, porten, bussgatan)
export const ENTRE = {
  STAKET_Y: 380, STAKET_X1: 330,                 // staketet längs y = 380 från x 0 till 330, sedan ner längs x = 330
  PORT: { cx: 220, w: 72 },                      // öppningen i staketet (x 184–256), bågen ovanför
  GATA: [436, 470],                              // bussgatan (asfalt) längst ner, x 0–330
  BUSS: { x: 232, y: 466 },                      // bergbussen står vid trottoarkanten (bakhjulets fot)
  KUR: { x: 58, y: 432 },                        // busskuren (bakväggens fot) på trottoaren
  HALLPLATS: { x: 96, y: 434 },                  // hållplatsskylten
  BILJETT: { x: 124, y: 428 },                   // biljettluckan utanför porten (vänster)
  KARTA: { x: 294, y: 426 },                     // parkkartan (höger om porten)
  CYKLAR: { x: 24, y: 470 },
  FONTAN: { x: 165, y: 300 },                    // fontänen med statyn på entréplatsen
  FLAGGOR: [60, 110, 220, 270],                  // flaggstängerna längs staketets insida (y = STAKET_Y − 6)
  TOPIARY: [[40, 270, 'bjorn'], [300, 270, 'kanin'], [40, 360, 'kanin'], [300, 360, 'bjorn']],
  PLANTERINGAR: [[70, 430], [280, 430]],
  LYKTOR: [[20, 344], [118, 344], [212, 344], [310, 344]],
  BANKAR: [[72, 320], [258, 320]],
};

// ---------------------------------------------------------------- staketet
// smidesstaket med spjut och en klippt häck bakom; en sektion i taget (x0..x1 på raden y)
export function ritaStaket(ctx, x0, x1, y, hack = true) {
  const R = (c, x, yy, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(yy), w, h); };
  if (hack) for (let x = x0; x < x1; x++) { const h = 10 + Math.round(Math.sin(x / 3) * 1.2); for (let j = 0; j < h; j++) R(j === 0 ? '#80c05a' : (x + j) % 5 === 0 ? '#24521c' : (x * 3 + j) % 7 === 0 ? '#52983a' : '#387628', x, y - 4 - j); }
  R('#2c323a', x0, y - 10, x1 - x0, 1); R('#434b56', x0, y - 11, x1 - x0, 1); R('#2c323a', x0, y - 3, x1 - x0, 1); R('#434b56', x0, y - 4, x1 - x0, 1);
  for (let x = x0; x < x1; x += 4) { R('#1c2026', x, y - 16, 1, 16); R('#434b56', x + 1, y - 15, 1, 14); R('#c0922c', x, y - 18, 1, 2); R('#fff0a0', x, y - 18, 1, 1); }
  for (let x = x0; x < x1; x += 24) { R('#1c2026', x - 1, y - 20, 3, 21); R('#646e7a', x - 1, y - 20, 1, 20); R('#e6be4c', x - 2, y - 22, 5, 2); R('#fff0a0', x - 2, y - 22, 1, 1); }
  R('rgba(20,12,30,.25)', x0, y, x1 - x0, 2);
}
// en staketstolpe i den lodräta delen (ritas en i taget så folk kan gå framför och bakom)
export function ritaStaketstolpe(ctx, x, y, hog) {
  const R = (c, xx, yy, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(xx), Math.round(yy), w, h); };
  if (hog) { R('#1c2026', x - 1, y - 20, 3, 21); R('#646e7a', x - 1, y - 20, 1, 20); R('#e6be4c', x - 2, y - 22, 5, 2); R('#fff0a0', x - 2, y - 22, 1, 1); }
  else { R('#1c2026', x, y - 16, 1, 16); R('#434b56', x + 1, y - 15, 1, 14); R('#c0922c', x, y - 18, 1, 2); R('#fff0a0', x, y - 18, 1, 1); }
  R('#2c323a', x - 1, y - 10, 4, 1); R('#2c323a', x - 1, y - 3, 4, 1);
}

// ---------------------------------------------------------------- porten
// två breda pelare i ljus sten med guldkapitäl och lyktor, en välvd skylt PIXELBERG med jagande glödlampor, en klocka
// mitt på bågen, vändkors i öppningen, blomlådor vid foten och banderoller på pelarna
const PORT_H = 112;
function portBild(natt) {
  const w = ENTRE.PORT.w + 60, cx = 0;   // (origo = mitt i öppningen, på marken)
  return bild(`entreport|${natt ? 1 : 0}`, w, PORT_H + 8, w >> 1, PORT_H, (P) => {
    for (const px of [cx - 46, cx + 32]) {
      fyll(P, px, -78, px + 13, 0, (X, Y) => { const rad = Math.floor((Y + 78) / 7), bx = X - px + (rad & 1) * 4, f = (Y + 78) % 7 === 6 || bx % 8 === 7; return tone(STEN, (f ? 0.35 : 0.72) - (X - px) * 0.025 + (hash(X >> 1, Y, 3) - 0.5) * 0.1, X, Y); });
      fyll(P, px - 2, -84, px + 15, -79, (X, Y) => tone(MASS, 0.85 - (Y + 84) * 0.08 - (X - px) * 0.02, X, Y));
      fyll(P, px - 1, -3, px + 14, 0, (X, Y) => tone(STEN, 0.5 - (Y + 3) * 0.1, X, Y));
      // banderollen på pelaren (röd med en guldstjärna) och lyktan
      fyll(P, px + 3, -70, px + 10, -44, (X, Y) => { const sv = Y > -48 && Math.abs(X + 0.5 - px - 7) < Y + 48 + 0.5; return sv ? null : tone(ROD, 0.66 - (X - px - 3) * 0.04 + (X === px + 3 ? 0.14 : 0), X, Y); });
      P.hl(px + 2, -71, 10, MASS[3]); spr(P, px + 4, -62, ['..g..', '.ggg.', 'ggggg', '.ggg.', 'g...g'], { g: 0xfff0a0 });
      P.rect(px + 4, -36, 6, 7, JARN[1]); P.rect(px + 5, -35, 4, 5, natt ? 0xffe8a0 : 0xd8e8f0); P.hl(px + 3, -37, 8, JARN[3]); P.px(px + 6, -38, JARN[3]); P.px(px + 6, -29, JARN[2]);
      // blomlådan vid foten
      fyll(P, px - 3, -8, px + 16, -1, (X, Y) => tone(TRA, 0.6 - (Y + 8) * 0.05 + ((X - px) % 6 === 5 ? -0.2 : 0), X, Y)); P.hl(px - 3, -9, 20, TRA[4]);
      for (let X = px - 2; X < px + 16; X++) { const hh = 2 + ((hash(X, px, 5) * 3) | 0); for (let j = 0; j < hh; j++) P.px(X, -9 - j, tone(BLAD, 0.4 + hash(X, j, 6) * 0.5, X, j)); if (hash(X, px, 7) > 0.45) P.px(X, -9 - hh, [0xe0383c, 0xf0c030, 0xf06aa0, 0xffffff][(hash(X, px, 8) * 4) | 0]); }
    }
    // bågen: ett blått band med guldkant, rundat upptill, med namnet i stor text och lampor runt
    const bx0 = cx - 48, bx1 = cx + 46, by = -PORT_H + 2;
    for (let X = bx0; X <= bx1; X++) { const u = (X - bx0) / (bx1 - bx0), top = Math.round(by + 14 - Math.sin(u * Math.PI) * 14); for (let Y = top; Y <= by + 36; Y++) P.px(X, Y, Y === top ? MASS[4] : Y === top + 1 ? MASS[2] : Y > by + 33 ? MASS[1] : tone(BLA, 0.5 - (Y - top) * 0.012 + (hash(X >> 2, Y, 9) - 0.5) * 0.05, X, Y)); }
    const s = $t('PIXELBERG'), sw = textW(BIG, s), F2 = sw > 84 ? SMALL : BIG, tw = textW(F2, s);
    skylttext(P, F2, s, cx - (tw >> 1), by + 20 - (F2.h >> 1) + 1, 0xfff0a0, 0x0c1a34, 0xffffff);
    // klockan mitt under bågen
    fyll(P, cx - 6, by + 30, cx + 6, by + 42, (X, Y) => { const d = Math.hypot(X + 0.5 - cx, Y + 0.5 - by - 36); return d > 6.5 ? null : d > 5.2 ? MASS[3] : 0xfaf6ea; });
    P.vl(cx, by + 33, 3, 0x22202a); P.hl(cx, by + 36, 3, 0x22202a); P.px(cx, by + 36, 0xd8343c);
    // vändkorsen i öppningen
    for (const tx of [cx - 30, cx + 24]) { P.rect(tx, -14, 2, 14, ZINK[2]); P.px(tx, -14, ZINK[4]); P.rect(tx - 4, -12, 10, 1, ZINK[3]); P.rect(tx - 4, -8, 10, 1, ZINK[3]); P.px(tx - 4, -13, ZINK[4]); P.px(tx + 5, -13, ZINK[4]); }
  });
}
export function ritaPort(ctx, t, natt) {
  const { cx } = ENTRE.PORT, y = ENTRE.STAKET_Y;
  const s = portBild(natt);
  put(ctx, s, cx, y);
  // glödlamporna runt bågen (jagar varandra) och skenet från pelarnas lyktor på kvällen
  const bx0 = cx - 48, bx1 = cx + 46, by = y - PORT_H + 2;
  let i = 0;
  for (let X = bx0 + 2; X <= bx1 - 2; X += 5) { const u = (X - bx0) / (bx1 - bx0), top = Math.round(by + 14 - Math.sin(u * Math.PI) * 14); glodlampa(ctx, X, top - 2, i++, t, natt); }
  for (const X of [bx0 - 1, bx1 + 1]) for (let Y = by + 16; Y < by + 36; Y += 5) glodlampa(ctx, X, Y, i++, t, natt);
  if (natt) for (const px of [cx - 39, cx + 39]) { const g = ctx.createRadialGradient(px, y - 33, 1, px, y - 33, 20); g.addColorStop(0, 'rgba(255,236,170,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(px - 20, y - 53, 40, 40); }
}

// ---------------------------------------------------------------- utanför: busskuren, bergbussen, kartan, cykelställ, planteringar
export function ritaBusskur(ctx, x, y, natt) {
  put(ctx, bild(`kur|${natt ? 1 : 0}`, 70, 50, 32, 44, (P) => {
    // bakväggen i glas med en affisch (PIXELBERG-tivolit), stålstolpar, bänken, taket
    fyll(P, -30, -38, 30, -2, (X, Y) => (X === -30 || X === 30 || X === 0 ? ZINK[2] : Y === -38 ? ZINK[4] : mix(0xbfe2f2, 0xf0faff, hash(X >> 2, Y >> 2, 3) * 0.2)));
    for (let X = -28; X < 30; X += 2) P.px(X, -20, 0xffffff, 0.7);
    fyll(P, 6, -34, 26, -6, (X, Y) => (X === 6 || X === 26 || Y === -34 || Y === -6) ? JARN[2] : Y < -22 ? tone(BLA, 0.55 + (Y + 34) * 0.02, X, Y) : tone(GUL, 0.75, X, Y));
    spr(P, 11, -31, ['..r..', '.rrr.', 'rrrrr', '.rrr.', 'r.r.r'], { r: 0xfff0a0 }); P.hl(9, -18, 14, 0x1e3a5a); P.hl(10, -15, 12, 0x1e3a5a); P.hl(9, -12, 14, 0xd8343c);
    fyll(P, -28, -14, -2, -10, (X, Y) => tone(TRA, Y === -14 ? 0.85 : 0.55, X, Y)); P.rect(-27, -10, 2, 8, JARN[2]); P.rect(-5, -10, 2, 8, JARN[2]);
    for (let j = 0; j < 4; j++) P.hl(-34 + j, -42 + j, 68 - j * 2, j === 0 ? ZINK[4] : j === 3 ? ZINK[0] : ZINK[2]);
    P.rect(-33, -39, 2, 2, ZINK[1]); P.rect(31, -39, 2, 2, ZINK[1]);
    const s = $t('BUSS'), tw = textW(SMALL, s); fyll(P, -(tw >> 1) - 3, -43, (tw >> 1) + 3, -36, () => 0x1f7a3a); text(P, SMALL, s, -(tw >> 1), -41, 0xffffff);
  }), x, y);
}
export function ritaHallplatsskylt(ctx, x, y) {
  put(ctx, bild('hplskylt', 20, 48, 10, 44, (P) => {
    P.rect(0, -34, 2, 34, ZINK[3]); P.vl(1, -34, 34, ZINK[1]); P.rect(-1, -1, 4, 2, ZINK[0]);
    fyll(P, -7, -44, 8, -34, (X, Y) => (X === -7 || X === 8 || Y === -44 || Y === -34) ? 0x1a1a1e : tone(GUL, 0.85 - (Y + 44) * 0.03, X, Y));
    spr(P, -4, -41, ['bbbbbbb', 'bwbwbwb', 'bbbbbbb', '.k...k.'], { b: 0x2a5aa8, w: 0xd8f0ff, k: 0x1a1a1e });
    fyll(P, -5, -30, 5, -24, (X, Y) => (Y === -30 ? 0x5a8ae8 : tone(BLA, 0.6, X, Y))); for (let j = 0; j < 2; j++) P.hl(-3, -28 + j * 2, 6 - j, 0xffffff);
  }), x, y);
}
// 🚌 bergbussen: en gul-blå minibuss med PIXELBERG-dekor, fönster med passagerare, dörren, hjulen och lyktorna
export function ritaBuss(ctx, x, y, t) {
  skugga(ctx, x - 44, y, 96, 0.3);
  put(ctx, bild('bergbuss', 100, 44, 92, 40, (P) => {
    const x0 = -90, x1 = 2, yt = -36, yb = -8;
    fyll(P, x0, yt, x1, yb, (X, Y) => { const u = (Y - yt) / (yb - yt); let c = u < 0.55 ? tone(GUL, 0.78 - u * 0.2 + (X === x0 ? 0.12 : 0) - (X === x1 ? 0.2 : 0), X, Y) : tone(BLA, 0.62 - (u - 0.55) * 0.5 + (X === x0 ? 0.12 : 0), X, Y); if (Y === yt) c = GUL[4]; if (Y === yb) c = BLA[0]; return c; });
    for (let j = 0; j < 3; j++) P.hl(x0 + 2 + j, yt - 1 - j, x1 - x0 - 4 - j * 2, j === 2 ? GUL[1] : GUL[3]);   // det rundade taket
    for (let k = 0; k < 5; k++) { const wx = x0 + 6 + k * 16; fyll(P, wx, yt + 4, wx + 11, yt + 15, (X, Y) => (X === wx || X === wx + 11 || Y === yt + 4 || Y === yt + 15) ? JARN[3] : mix(0x8ac8f0, 0x5aa0d8, (Y - yt - 4) / 11)); P.px(wx + 1, yt + 5, 0xffffff); if (k !== 2 && k !== 4) spr(P, wx + 3, yt + 8, ['.hh.', 'hhhh', '.ss.'], { h: [0x3b2619, 0xd9a95c, 0x1d1714, 0x8a5a3a][k % 4], s: [0xe0a97f, 0xf6d7bf, 0xc68a5c, 0xe0a97f][k % 4] }); }
    fyll(P, x1 - 14, yt + 4, x1 - 3, yb - 2, (X, Y) => (X === x1 - 14 || X === x1 - 3 || Y === yt + 4 ? JARN[3] : Y < yt + 16 ? mix(0x8ac8f0, 0x5aa0d8, (Y - yt - 4) / 11) : tone(BLA, 0.5, X, Y)));   // dörren
    P.vl(x1 - 9, yt + 5, yb - yt - 7, JARN[3]);
    const s = 'PIXELBERG', tw = textW(SMALL, s); text(P, SMALL, s, x0 + 44 - (tw >> 1), yb - 7, 0xfff0a0);   // (namnet på parken – egennamn, översätts inte)
    for (const [wx] of [[x0 + 14], [x1 - 22]]) { fyll(P, wx - 7, yb - 2, wx + 7, 4, (X, Y) => { const d = Math.hypot(X + 0.5 - wx, Y + 0.5 - 1); return d > 7 ? null : d > 5.2 ? GUMMI[1 + ((X + Y) & 1)] : d > 2.2 ? tone(ZINK, 0.6 + (X < wx ? 0.2 : 0), X, Y) : ZINK[1]; }); }
    P.rect(x1 - 2, yb - 6, 2, 3, 0xd8343c); P.rect(x0, yb - 6, 2, 3, 0xfff6c0); P.rect(x0, yt + 2, 3, 2, 0xf0c030); P.rect(x1 - 3, yt + 2, 3, 2, 0xf0c030);
    fyll(P, x0 - 1, yb - 2, x1 + 1, yb + 1, (X, Y) => tone(JARN, 0.5 - (Y - yb + 2) * 0.1, X, Y));
  }), x, y);
  // blinkersen blinkar och avgaserna puffar
  if (Math.floor(t * 2) % 2) { ctx.fillStyle = '#ffd040'; ctx.fillRect(x - 89, y - 18, 3, 2); }
  for (let k = 0; k < 3; k++) { const u = (t * 0.6 + k / 3) % 1; ctx.globalAlpha = 0.35 * (1 - u); ctx.fillStyle = '#d8d8e0'; ctx.fillRect(Math.round(x - 94 - u * 10 + Math.sin(t * 3 + k) * 2), Math.round(y - 10 - u * 8), 3, 2); ctx.globalAlpha = 1; }
}
// 🗺️ parkkartan på två stolpar: en färgglad karta med tivolits delar
export function ritaKarta(ctx, x, y) {
  skugga(ctx, x, y, 40);
  put(ctx, bild('parkkarta', 48, 58, 24, 54, (P) => {
    for (const sx of [-18, 16]) { P.rect(sx, -22, 3, 22, TRA[2]); P.vl(sx, -22, 22, TRA[4]); P.rect(sx - 1, -1, 5, 2, TRA[0]); }
    fyll(P, -22, -52, 21, -22, (X, Y) => (X === -22 || X === 21 || Y === -52 || Y === -22) ? TRA[1] : (X === -21 || Y === -51) ? TRA[4] : null);
    fyll(P, -20, -50, 19, -24, (X, Y) => { const g = hash(X >> 2, Y >> 2, 11); return g > 0.82 ? 0x7ab858 : Y > -30 ? 0xc8784a : 0xd8d0b8; });
    fyll(P, -18, -48, -8, -41, () => 0x5aa0d8); P.hl(-20, -34, 39, 0xb05a40); P.hl(-20, -33, 39, 0xb05a40);
    for (const [ix, iy, c] of [[-14, -45, 0xe04848], [-3, -46, 0x3a7bd5], [6, -42, 0x8246c0], [13, -45, 0xf0c030], [-10, -38, 0x46a35a], [3, -37, 0xe04848], [14, -30, 0xf4f1ea]]) { P.rect(ix, iy, 3, 3, c); P.px(ix, iy, mix(c, 0xffffff, 0.4)); }
    P.rect(-19, -29, 6, 4, 0xd8343c); P.px(-17, -27, 0xffffff);
    fyll(P, -8, -29, 10, -25, () => 0x1e1a24); P.hl(-6, -27, 5, 0xffd23f); P.hl(0, -27, 8, 0xffd23f);
  }), x, y);
}
export function ritaCykelstall(ctx, x, y) {
  put(ctx, bild('cykelstall', 44, 26, 2, 22, (P) => {
    for (let k = 0; k < 5; k++) { const sx = k * 8; P.rect(sx, -10, 1, 10, ZINK[2]); P.rect(sx + 3, -10, 1, 10, ZINK[2]); P.hl(sx, -10, 4, ZINK[3]); P.hl(sx, -6, 4, ZINK[1]); }
    // två cyklar
    for (const [bx, c] of [[6, 0xd8343c], [26, 0x46a35a]]) { for (let a = 0; a < 16; a++) { const v = a / 16 * 6.283; P.px(Math.round(bx + Math.cos(v) * 4), Math.round(-4 + Math.sin(v) * 4), JARN[2]); P.px(Math.round(bx + 10 + Math.cos(v) * 4), Math.round(-4 + Math.sin(v) * 4), JARN[2]); } P.line(bx, -4, bx + 4, -9, c); P.line(bx + 4, -9, bx + 9, -9, c); P.line(bx + 9, -9, bx + 10, -4, c); P.line(bx + 4, -9, bx + 6, -4, c); P.px(bx + 3, -11, JARN[1]); P.px(bx + 9, -11, JARN[2]); }
  }), x, y);
}
// 🪴 en stor plantering i sten med blommor och en liten skylt
export function ritaPlantering(ctx, x, y) {
  skugga(ctx, x, y, 30);
  put(ctx, bild('plantering', 36, 26, 18, 22, (P) => {
    fyll(P, -14, -9, 13, -1, (X, Y) => tone(STEN, 0.66 - (X + 14) * 0.012 - (Y + 9) * 0.03 + ((X + 14) % 7 === 6 ? -0.2 : 0), X, Y)); P.hl(-15, -10, 30, STEN[4]); P.hl(-15, 0, 30, STEN[0]);
    for (let X = -12; X <= 11; X++) { const hh = 3 + ((hash(X, 1, 13) * 5) | 0); for (let j = 0; j < hh; j++) P.px(X, -10 - j, tone(BLAD, 0.35 + hash(X, j, 14) * 0.55, X, j)); if (hash(X, 2, 13) > 0.4) { const c = [0xe0383c, 0xf0c030, 0xf06aa0, 0xffffff, 0x8a5ad0][(hash(X, 3, 13) * 5) | 0]; P.px(X, -10 - hh, c); P.px(X + 1, -10 - hh, mix(c, 0xffffff, 0.4)); } }
  }), x, y);
}

// ---------------------------------------------------------------- entréplatsen: fontänen, topiaryerna
// ⛲ den stora fontänen: två skålar, Pixel-Nalle i brons högst upp, vattenstrålar i en ring (vattnet rör sig)
export function ritaFontanStor(ctx, x, y, t) {
  put(ctx, bild('stortfontan', 84, 70, 42, 64, (P) => {
    for (let j = -12; j <= 12; j++) { const w = Math.round(38 * Math.sqrt(Math.max(0, 1 - (j / 12) ** 2))); fyll(P, -w, j, w, j, (X) => tone(STEN, (j > 8 ? 0.45 : 0.75) - (X + 38) * 0.004 + (j === -12 ? 0.15 : 0), X, j)); }
    for (let j = -9; j <= 8; j++) { const w = Math.round(33 * Math.sqrt(Math.max(0, 1 - (j / 9.5) ** 2))); fyll(P, -w, j - 1, w, j - 1, (X) => (((X + j * 3) % 11) === 0 ? 0xd8f4ff : j < -4 ? 0x6ac0e8 : 0x4aa0d8)); }
    fyll(P, -4, -34, 4, -2, (X, Y) => tone(STEN, 0.7 - (X + 4) * 0.05, X, Y));
    for (let j = -4; j <= 4; j++) { const w = Math.round(16 * Math.sqrt(Math.max(0, 1 - (j / 4.5) ** 2))); fyll(P, -w, -34 + j, w, -34 + j, (X) => tone(STEN, j > 2 ? 0.45 : 0.75, X, j)); }
    for (let j = -3; j <= 2; j++) { const w = Math.round(13 * Math.sqrt(Math.max(0, 1 - (j / 3.5) ** 2))); fyll(P, -w, -35 + j, w, -35 + j, (X) => (((X + j * 5) % 9) === 0 ? 0xd8f4ff : 0x5aa8d8)); }
    fyll(P, -5, -44, 4, -38, (X, Y) => tone(STEN, 0.65 - (Y + 44) * 0.03, X, Y)); P.hl(-6, -45, 11, STEN[4]);
    // statyn: Pixel-Nalle i brons med armen upp
    const BR = [0x3a2a18, 0x5a4428, 0x7a5c34, 0x9a7a48, 0xc0a068];
    spr(P, -6, -62, ['.bb....bb.', 'bffb..bffb', 'bfffbbfffb', '.bffffffb.', 'bffwbbwffb', 'bffffffffb', 'bfffppfffb', '.bfffffffb', '..bbbbbb..', '.bffffffb.', 'bfffwwfffb', 'bffwwwwffb', '.bffwwffb.', '.bfffffffb', '..bffffb..', '..bb..bb..', '.bbb..bbb.'], { b: BR[0], f: BR[2], w: BR[4], p: BR[1] });
    P.rect(4, -58, 2, 8, BR[2]); P.px(5, -59, BR[3]); P.px(4, -59, BR[3]);   // armen som vinkar
  }), x, y);
  // vattnet: strålar ur den övre skålen ner i den nedre, och små droppar ur den nedre kanten
  const R = (c, X, Y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(X), Math.round(Y), w, h); };
  for (let k = 0; k < 12; k++) { const u = (t * 0.8 + k / 12) % 1, a = k / 12 * Math.PI * 2, r = 12 + u * 24, h = Math.sin(u * Math.PI) * 14; R(u < 0.4 ? '#ffffff' : '#a8e0ff', x + Math.cos(a) * r, y - 34 - h + u * 24 + Math.sin(a) * r * 0.25); }
  for (let k = 0; k < 6; k++) { const u = (t * 1.5 + k / 6) % 1; R('#ffffff', x - 2 + (k % 3) - 1 + Math.sin(t * 4 + k) * 1.5, y - 44 - u * 12, 1, 2); }
  for (let k = 0; k < 8; k++) { const u = (t * 0.9 + k * 0.37) % 1; R('rgba(255,255,255,.7)', x - 32 + ((k * 9) % 64), y - 4 + ((k * 5) % 10), 2 + (u > 0.5 ? 1 : 0), 1); }
}
// 🐻🐰 topiaryer: klippta buskar formade som en björn eller en kanin, i en stor kruka
export function ritaTopiary(ctx, x, y, typ) {
  skugga(ctx, x, y, 18);
  put(ctx, bild('topiary|' + typ, 30, 46, 15, 42, (P) => {
    fyll(P, -8, -10, 7, -1, (X, Y) => tone(TERR, 0.62 - (X + 8) * 0.03 + (Y === -10 ? 0.25 : 0), X, Y)); P.hl(-9, -11, 18, TERR[4]);
    const G = (cx, cy, rx, ry) => fyll(P, cx - rx, cy - ry, cx + rx, cy + ry, (X, Y) => { const d = Math.hypot((X + 0.5 - cx) / rx, (Y + 0.5 - cy) / ry); return d > 1 ? null : tone(BLAD, 0.56 - (X - cx) * 0.03 - (Y - cy) * 0.04 + (hash(X, Y, 3) - 0.5) * 0.25, X, Y); });
    if (typ === 'bjorn') { G(0, -18, 8, 7); G(0, -32, 6, 6); G(-5, -38, 2, 2); G(5, -38, 2, 2); G(-9, -20, 3, 4); G(9, -20, 3, 4); P.px(-2, -33, 0x1a1414); P.px(2, -33, 0x1a1414); P.px(0, -30, 0x1a1414); }
    else { G(0, -18, 7, 7); G(0, -30, 5, 5); G(-3, -39, 2, 6); G(3, -39, 2, 6); G(-7, -14, 3, 3); G(7, -14, 3, 3); P.px(-2, -31, 0x1a1414); P.px(2, -31, 0x1a1414); P.px(0, -29, 0xf06aa0); }
  }), x, y);
}

// ---------------------------------------------------------------- PIXELBERG-bokstäverna på berget (målas i marken)
// stora vita bokstäver på stolpar uppe på sluttningen ovanför entréplatsen (Hollywood-stil), en tass som prick
export function malaBergskylt(P, x, y) {
  const s = 'PIXELBERG', sc = 2, tw = textW(BIG, s, sc), x0 = Math.round(x - tw / 2);
  for (let i = 0; i < s.length; i++) { const lx = x0 + i * ((tw / s.length) | 0) + 4; P.vl(lx, y, 16, 0x5a5e66); P.vl(lx + 1, y, 16, 0x3a3a42); P.vl(lx + 8, y, 16, 0x5a5e66); P.vl(lx + 9, y, 16, 0x3a3a42); }
  for (const [dx, dy] of [[1, 1], [2, 2]]) text(P, BIG, s, x0 + dx, y - 14 + dy, 0x6a6a72, 0.8, sc);
  text(P, BIG, s, x0, y - 14, 0xfafafa, 1, sc); text(P, BIG, s, x0, y - 15, 0xffffff, 0.6, sc);
  for (let i = 0; i < tw; i += 2) P.px(x0 + i, y - 1, 0xd8d8e0);
}
// 🏰 slottet på berget (bakom pariserhjulet): tre torn med blå spiror och flaggor, rosa murar, en portal
export function malaSlott(P, cx, by) {
  const MUR = [0x9a5a6a, 0xc07a8a, 0xe0a0b0, 0xf0c0cc, 0xf8dce4], TAK = [0x1c4086, 0x285ec0, 0x5890e8, 0xa8ccff, 0xd8ecff];
  const torn = (tx, w, h, spira) => {
    fyll(P, tx - (w >> 1), by - h, tx + (w >> 1), by, (X, Y) => { const f = (Y - by + h) % 6 === 5 || (X - tx + (w >> 1) + (Math.floor((Y - by + h) / 6) & 1) * 3) % 7 === 6; return tone(MUR, (f ? 0.4 : 0.72) - (X - tx + (w >> 1)) / w * 0.3, X, Y); });
    for (let X = tx - (w >> 1) - 1; X <= tx + (w >> 1) + 1; X += 3) P.rect(X, by - h - 3, 2, 3, MUR[3]);
    for (let j = 0; j < spira; j++) { const hw = Math.round((spira - j) / spira * ((w >> 1) + 2)); fyll(P, tx - hw, by - h - 4 - j, tx + hw, by - h - 4 - j, (X) => tone(TAK, 0.65 - (X - tx + hw) / (hw * 2 + 1) * 0.35 + (j % 4 === 0 ? -0.12 : 0), X, j)); }
    P.vl(tx, by - h - 4 - spira - 6, 7, 0x3a3a42); for (let k = 0; k < 5; k++) P.px(tx + 1 + k, by - h - 4 - spira - 6 + (k > 2 ? 1 : 0), k < 3 ? 0xf0c030 : 0xe04848);
    for (let Y = by - h + 6; Y < by - 6; Y += 10) { P.rect(tx - 2, Y, 4, 6, 0x3a2a44); P.px(tx - 2, Y, 0x8ab8f0); P.px(tx - 1, Y, 0x8ab8f0); P.hl(tx - 3, Y + 6, 6, MUR[4]); }
  };
  fyll(P, cx - 70, by - 44, cx + 70, by, (X, Y) => { const f = (Y - by + 44) % 6 === 5 || (X - cx + 70 + (Math.floor((Y - by + 44) / 6) & 1) * 3) % 7 === 6; return tone(MUR, (f ? 0.4 : 0.72) - (X - cx + 70) / 140 * 0.3, X, Y); });
  for (let X = cx - 71; X <= cx + 71; X += 4) P.rect(X, by - 47, 2, 3, MUR[3]);
  torn(cx - 56, 18, 74, 16); torn(cx + 56, 18, 74, 16); torn(cx, 26, 96, 22); torn(cx - 28, 12, 56, 10); torn(cx + 28, 12, 56, 10);
  // portalen med fällbron
  fyll(P, cx - 10, by - 24, cx + 10, by, (X, Y) => { const d = Y < by - 14 ? Math.hypot(X + 0.5 - cx, Y + 0.5 - by + 14) : 0; return d > 10 ? null : d > 8 || X === cx - 10 || X === cx + 10 ? MUR[0] : 0x2a1a30; });
  for (let j = 0; j < 6; j++) P.hl(cx - 12 - j, by + 1 + j, 24 + j * 2, j & 1 ? 0x86562e : 0xae7640);
  for (const wx of [cx - 40, cx + 40]) { P.rect(wx - 3, by - 30, 6, 10, 0x3a2a44); P.rect(wx - 3, by - 30, 2, 3, 0x8ab8f0); P.hl(wx - 4, by - 20, 8, MUR[4]); }
}
