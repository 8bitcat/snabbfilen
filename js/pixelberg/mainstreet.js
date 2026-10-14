// 🏪 MAIN STREET – butiksfasaderna i viktoriansk tivolistil längs översta raden innanför entrén (v0.135, Carl
// 2026-10-14: "gör om hela Pixelberget, gör det till en riktig amerikansk temapark"). Tre fasader i pastell med
// skyltfönster, markiser, balkonger, takkrön med spiror och utsmyckning, hängskyltar och lyktor: SOUVENIRER (nallar,
// muggar, tröjor), FOTOATELJÉN (kameran, bilderna) och KARAMELLKOKERIET (burkar, klubbor, en kokande kittel).
// Fasaderna står på y 262 (samma fotlinje som glasståndet) och målas en gång per dag/kväll (fönstren tända på kvällen).
import { SMALL, BIG, text, textW, mix, mul, hash } from '../core/floor-pix.js';
import { tone, fyll, spr, skylttext, bild, put, F } from '../core/pennor.js';
import { $t } from '../core/i18n.js';

const { VIT, MASS, JARN, ZINK, TRA, BLAD, ROD, BLA, GUL, GRON, ROSA, MINT, LILA, GLD, GLN } = F;
const PERSIKA = [0x8a4a30, 0xc07050, 0xe89a70, 0xf4bc98, 0xfadcc4];
export const FASADER = [
  { id: 'souvenir', x: 330, w: 66, namn: $t('SOUVENIRER'), pal: LILA, tak: ROD, markis: [GUL, VIT] },
  { id: 'foto', x: 402, w: 56, namn: $t('FOTO'), pal: MINT, tak: BLA, markis: [BLA, VIT] },
  { id: 'karamell', x: 464, w: 68, namn: $t('KARAMELLER'), pal: PERSIKA, tak: GRON, markis: [ROSA, VIT] },
];
export const MAINSTREET_Y = 262;
// väggens höjd. Uppifrån: krönet · övervåningens fönster med blomlådor · den ljusa listen · namnskylten · markisen ·
// skyltfönstret. (v0.136: högre vägg så att skylten får plats mellan listen och markisen – förut låg markisens räcke
// tvärs över bokstäverna, Carl 2026-10-14: "skyltarna är täckta")
const H = 108;

function fasadBild(Fa, natt) {
  const w = Fa.w;
  return bild(`fasad|${Fa.id}|${natt ? 1 : 0}`, w + 16, H + 36, 8, H + 6, (P) => {
    const x0 = 0, x1 = w - 1, gy = 0, top = -H + 22, pal = Fa.pal;
    // väggen: puts i pastell med en ljus list mellan våningarna och hörnkedjor
    fyll(P, x0, top, x1, gy - 1, (X, Y) => tone(pal, 0.66 + (hash(X >> 1, Y >> 1, 3) - 0.5) * 0.08 - X / w * 0.1 + ((X < 3 || X > w - 4) && (Y - top) % 6 < 3 ? 0.18 : 0), X, Y));
    P.hl(x0, -52, w, VIT[4]); P.hl(x0, -51, w, VIT[2]); P.hl(x0, -50, w, 0x000000, 0.15);
    // takkrönet: parapet med balustrad, ett mittparti med spira och en liten flagga
    fyll(P, x0 - 2, top - 8, x1 + 2, top, (X, Y) => tone(VIT, (Y === top - 8 ? 0.98 : Y === top ? 0.45 : 0.8) - (X - x0) / w * 0.1, X, Y));
    for (let X = x0 + 2; X < x1 - 1; X += 4) { P.rect(X, top - 6, 2, 5, VIT[3]); P.px(X, top - 6, VIT[4]); P.px(X + 1, top - 2, VIT[1]); }
    P.hl(x0 - 2, top - 8, w + 4, VIT[4]);
    const mx = x0 + (w >> 1);
    for (let j = 0; j < 8; j++) { const hw = Math.round((8 - j) * 1.4); fyll(P, mx - hw, top - 9 - j, mx + hw, top - 9 - j, (X) => tone(Fa.tak, 0.68 - (X - mx + hw) / (hw * 2 + 1) * 0.35 + (j % 3 === 0 ? -0.1 : 0), X, j)); }
    P.vl(mx, top - 24, 8, JARN[2]); for (let k = 0; k < 4; k++) P.px(mx + 1 + k, top - 24 + (k > 1 ? 1 : 0), k < 2 ? GUL[3] : ROD[2]);
    P.px(mx, top - 25, MASS[3]);
    // övervåningen: två fönster med vita omfattningar, en liten balkong med smidesräcke och blomlådor
    for (const fx of [x0 + 8, x1 - 19]) {
      P.rect(fx - 1, top + 9, 14, 18, VIT[3]); P.hl(fx - 2, top + 7, 16, VIT[4]); P.hl(fx - 2, top + 8, 16, VIT[2]);
      fyll(P, fx + 1, top + 11, fx + 10, top + 24, (X, Y) => (natt ? (hash(fx, 1, 2) > 0.4 ? tone(GLN, 0.85 - (Y - top - 11) * 0.02, X, Y) : tone([0x080c18, 0x0e1626, 0x162238, 0x22324e, 0x34486a], 0.5, X, Y)) : tone(GLD, 0.8 - (Y - top - 11) * 0.03 + ((((X * 2 - Y * 3) % 17) + 17) % 17 < 2 ? 0.2 : 0), X, Y)));
      P.vl(fx + 5, top + 11, 14, VIT[3]); P.hl(fx + 1, top + 17, 10, VIT[3]);
      P.rect(fx + 1, top + 11, 2, 14, natt ? 0xc89a6a : [0xd84a6a, 0x3a7bd5][fx > mx ? 1 : 0], 0.8); P.rect(fx + 9, top + 11, 2, 14, natt ? 0xc89a6a : [0xd84a6a, 0x3a7bd5][fx > mx ? 1 : 0], 0.8);
      P.hl(fx - 2, top + 27, 16, VIT[4]); P.hl(fx - 2, top + 28, 16, VIT[1]);
      fyll(P, fx - 1, top + 29, fx + 12, top + 32, (X, Y) => tone(TRA, Y === top + 29 ? 0.85 : 0.5, X, Y));
      for (let X = fx; X < fx + 12; X++) { P.px(X, top + 28, tone(BLAD, 0.4 + hash(X, 1, 5) * 0.5, X, 0)); if (hash(X, 2, 5) > 0.5) P.px(X, top + 27, [0xe0383c, 0xf0c030, 0xf06aa0, 0xffffff][(hash(X, 3, 5) * 4) | 0]); }
    }
    // hängskylten på en smidesarm vid hörnet
    P.hl(x1 - 3, -48, 10, JARN[2]); P.px(x1 + 6, -47, JARN[3]); P.px(x1 - 1, -49, JARN[3]);
    fyll(P, x1 - 1, -46, x1 + 6, -38, (X, Y) => (X === x1 - 1 || X === x1 + 6 || Y === -46 || Y === -38) ? MASS[2] : tone(Fa.tak, 0.65, X, Y));
    if (Fa.id === 'souvenir') spr(P, x1 + 1, -44, ['k.k', 'kkk', 'kwk', 'kkk'], { k: 0xa8703e, w: 0xe8c8a0 });
    else if (Fa.id === 'foto') spr(P, x1 + 1, -44, ['.k.', 'kkk', 'kwk', 'kkk'], { k: 0x2a2a30, w: 0x8ad8ff });
    else spr(P, x1 + 1, -44, ['.rr', '.rr', 'rr.', '.w.'], { r: 0xe04848, w: 0xf4ecd8 });
    // skylten med namnet i guldram över markisen
    const s = Fa.namn, F2 = textW(BIG, s) <= w - 14 ? BIG : SMALL, tw = textW(F2, s), sw = Math.min(w - 4, tw + 12), sx = mx - (sw >> 1), sy = -33 - (F2.h + 7);   // (nederkanten på -33, strax ovanför markisens räcke)
    fyll(P, sx, sy, sx + sw - 1, sy + F2.h + 7, (X, Y) => (X < sx + 2 || X >= sx + sw - 2 || Y < sy + 2 || Y >= sy + F2.h + 6) ? tone(MASS, 0.9 - (X - sx) / sw * 0.4 - (Y - sy) * 0.03, X, Y) : tone(Fa.tak, 0.62 - (Y - sy) * 0.03, X, Y));
    skylttext(P, F2, s, mx - (tw >> 1), sy + 4, 0xfff0a0, mul(Fa.tak[0], 0.8), 0xffffff);
    // bottenvåningen: skyltfönstret, dörren med glas och ett överljus, lyktorna
    const fx0 = x0 + 4, fx1 = x1 - 22, dx = x1 - 17, dw = 14;
    fyll(P, fx0 - 2, -24, fx1 + 2, -1, (X, Y) => (X < fx0 || X > fx1 || Y < -22 || Y > -3) ? tone(VIT, X < fx0 || Y < -22 ? 0.85 : 0.4, X, Y) : null);
    fyll(P, fx0, -22, fx1, -3, (X, Y) => (natt ? tone(GLN, 0.9 - (Y + 22) * 0.012, X, Y) : (Y > -9 ? tone(TRA, 0.5, X, Y) : tone([0xe0c8a0, 0xe8d4b0, 0xf0e0c0, 0xf6ecd0, 0xfaf4e4], 0.7 - (Y + 22) * 0.01, X, Y))));
    if (Fa.id === 'souvenir') {
      spr(P, fx0 + 3, -18, ['.kk..kk.', 'kbbkkbbk', 'kbbbbbbk', '.kbwwbk.', '.kbbbbk.', 'kbbbbbbk', 'kbbbbbbk', '.kk..kk.'], { k: 0x5a3a20, b: 0xa8703e, w: 0xe8c8a0 });
      for (let i = 0; i < 3; i++) { P.rect(fx0 + 14 + i * 5, -14, 3, 4, [0xd84a6a, 0x3a7bd5, 0xf0c030][i]); P.px(fx0 + 17 + i * 5, -13, [0xd84a6a, 0x3a7bd5, 0xf0c030][i]); P.px(fx0 + 14 + i * 5, -14, 0xffffff); }
      spr(P, fx0 + 14, -21, ['.rrrr.', 'rrrrrr', 'r.ww.r', '.rwwr.', '.rrrr.'], { r: 0xe04848, w: 0xffffff });
      P.hl(fx0 + 2, -9, fx1 - fx0 - 3, TRA[4]);
    } else if (Fa.id === 'foto') {
      spr(P, fx0 + 4, -16, ['..kk..', 'kkkkkk', 'kkwwkk', 'kkwbkk', 'kkkkkk'], { k: 0x2a2a30, w: 0x8ad8ff, b: 0x1a1a24 });
      for (let i = 0; i < 2; i++) { fyll(P, fx0 + 13, -20 + i * 7, fx0 + 22, -15 + i * 7, (X, Y) => (X === fx0 + 13 || X === fx0 + 22 || Y === -20 + i * 7 || Y === -15 + i * 7) ? 0xffffff : [0xf4c8d0, 0xb8e0d0][i]); P.rect(fx0 + 16, -18 + i * 7, 3, 2, [0xe08a3a, 0x3a3438][i]); }
      P.rect(fx0 + 2, -8, 3, 5, JARN[2]); P.rect(fx0 + 1, -9, 5, 1, JARN[3]);
    } else {
      for (let i = 0; i < 4; i++) { const c = [0xe04848, 0x46a35a, 0xf0c030, 0x8a5ad0][i]; fyll(P, fx0 + 2 + i * 6, -19, fx0 + 6 + i * 6, -12, (X, Y) => (Y === -19 ? ZINK[3] : X === fx0 + 2 + i * 6 ? mix(c, 0xffffff, 0.35) : X === fx0 + 6 + i * 6 ? mul(c, 0.7) : c)); P.px(fx0 + 3 + i * 6, -16, mix(c, 0xffffff, 0.5)); }
      for (let i = 0; i < 4; i++) { const c = [0xf06aa0, 0xf0c030, 0x3a7bd5, 0x46a35a][i]; P.vl(fx0 + 3 + i * 6, -9, 5, 0xf4ecd8); P.rect(fx0 + 2 + i * 6, -11, 3, 3, c); P.px(fx0 + 2 + i * 6, -11, mix(c, 0xffffff, 0.5)); }
      P.hl(fx0 + 1, -9, fx1 - fx0 - 1, TRA[4]);
    }
    for (let Y = -22; Y <= -3; Y++) for (let X = fx0; X <= fx1; X++) { const s2 = (((X - Y * 2) % 29) + 29) % 29; if (s2 < 3 && !natt) P.px(X, Y, 0xffffff, s2 === 1 ? 0.3 : 0.15); }
    fyll(P, dx - 2, -26, dx + dw + 1, -1, (X, Y) => (X < dx || X >= dx + dw || Y < -24) ? tone(VIT, X < dx ? 0.85 : 0.4, X, Y) : null);
    fyll(P, dx, -24, dx + dw - 1, -1, (X, Y) => (Y < -18 ? (natt ? tone(GLN, 0.8, X, Y) : tone(GLD, 0.75, X, Y)) : tone(Fa.tak, 0.62 - (X - dx) * 0.02 + (X === dx ? 0.15 : 0), X, Y)));
    P.hl(dx, -18, dw, VIT[3]); P.rect(dx + 2, -14, dw - 4, 8, mul(Fa.tak[1], 0.9)); P.box(dx + 2, -14, dw - 4, 8, Fa.tak[3]); P.px(dx + dw - 4, -10, MASS[3]);
    for (const lx of [fx0 - 6, dx + dw + 3]) { P.rect(lx, -20, 3, 4, JARN[1]); P.rect(lx, -21, 3, 1, JARN[3]); P.px(lx + 1, -22, JARN[3]); fyll(P, lx, -19, lx + 2, -17, () => (natt ? 0xffe8a0 : 0xd8e8f0)); P.px(lx + 1, -16, JARN[2]); }
    // markisen: randig med bågkant, hänger ut över skyltfönstrets överkant (ritas efter fönstret) och skuggar glaset
    const [A, B] = Fa.markis, my = -29;
    for (let X = x0 - 2; X <= x1 + 2; X++) { const i = X - x0 + 2, p = Math.floor(i / 5) % 2 ? B : A, drop = [2, 3, 3, 2, 1][i % 5]; for (let Y = my; Y <= my + 5 + drop; Y++) P.px(X, Y, Y >= my + 5 ? (Y === my + 5 + drop ? tone(p, 0.25, X, Y) : tone(p, 0.6, X, Y)) : tone(p, 0.9 - (Y - my) * 0.06, X, Y)); }
    P.hl(x0 - 3, my - 2, w + 6, JARN[1]); P.hl(x0 - 3, my - 1, w + 6, JARN[3]);
    for (let i = 0; i < 4; i++) { P.darken(fx0, my + 9 + i, fx1 - fx0 + 1, 1, 0.55 + i * 0.08); P.darken(dx, my + 9 + i, dw, 1, 0.55 + i * 0.08); }
    P.hl(x0 - 2, 0, w + 4, VIT[2]); P.hl(x0 - 2, 1, w + 4, 0x000000, 0.2);
  });
}
export function ritaFasad(ctx, Fa, natt) { put(ctx, fasadBild(Fa, natt), Fa.x, MAINSTREET_Y); }
// vimpelband mellan fasadernas spiror och en lykta som lyser på kvällen ritas av scenen (deko.js/liv.js)
export const fasadHinder = () => FASADER.map((Fa) => [Fa.x - 2, 160, Fa.x + Fa.w + 2, MAINSTREET_Y - 1]);
export const FASAD_PRAT = {
  souvenir: [$t('Nallar, muggar och tröjor med Pixelberg på! Allt är slut i dag – nya kommer med bergbussen i morgon.'), $t('Den stora Pixel-Nallen i fönstret är inte till salu. Tyvärr!')],
  foto: [$t('Le! Vi fotar alla som åker berg-och-dalbanan – bilderna hänger i fönstret.'), $t('Fotoateljén framkallar på en kvart. Ställ dig framför slottet, det blir finast!')],
  karamell: [$t('Kokta karameller, polkagrisar och klubbor – kitteln puttrar hela dagen!'), $t('Smaka på en bit polkagris! Resten säljs i godisståndet på Marknadsgatan.')],
};
