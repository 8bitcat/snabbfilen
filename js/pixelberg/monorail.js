// 🚝 PIXELBERG EXPRESS – monorailen som går på en balk högt över parken, från entrén till Spökgränd och tillbaka
// (v0.135, "en riktig amerikansk temapark"). Balken och pelarna står på berget bakom (målas i marken), tåget –
// ett lok och två vagnar med passagerare i fönstren – ritas varje bildruta och går fram och tillbaka längs hela
// parken. Det går inte att åka med (än) – det är kuliss som rör sig.
import { tone, fyll, spr, bild, put, F } from '../core/pennor.js';
import { hash } from '../core/floor-pix.js';

const { ZINK, JARN, BLA, GUL, ROD } = F;
export const MONORAIL = { y: 170, x0: 20, x1: 2540, fart: 46, paus: 6 };   // balkens överkant, ändstationerna, px/s, sekunder vid ändarna

// balken och pelarna (målas en gång i marken, bakom allt som står på torget)
export function malaMonorail(P, TW) {
  const y = MONORAIL.y;
  for (let x = 0; x < TW; x++) { P.px(x, y, ZINK[4]); P.px(x, y + 1, ZINK[3]); P.px(x, y + 2, ZINK[2]); P.px(x, y + 3, ZINK[1]); P.px(x, y + 4, x % 6 === 0 ? ZINK[0] : ZINK[1]); P.px(x, y + 5, 0x000000, 0.2); }
  for (let x = 60; x < TW; x += 120) {
    if (x > 96 && x < 240) continue;   // (inga pelare framför PIXELBERG-bokstäverna på berget)
    fyll(P, x - 3, y + 5, x + 3, y + 40, (X, Y) => tone(ZINK, 0.62 - (X - x + 3) * 0.08 + ((Y - y) % 9 === 0 ? -0.12 : 0), X, Y));
    fyll(P, x - 7, y + 3, x + 7, y + 6, (X, Y) => tone(ZINK, Y === y + 3 ? 0.9 : 0.5, X, Y));
    fyll(P, x - 6, y + 38, x + 6, y + 41, (X, Y) => tone(JARN, 0.55 - (Y - y - 38) * 0.1, X, Y));
  }
}
// tåget: loket med nos och strålkastare, två vagnar, fönster med passagerare, blå-gult som bergbussen
function tagBild(dir) {
  return bild('monorail|' + dir, 112, 26, dir > 0 ? 110 : 2, 22, (P) => {
    const s = dir > 0 ? -1 : 1, L = (x) => (dir > 0 ? -x : x);   // loket längst fram i färdriktningen
    for (let v = 0; v < 3; v++) {
      const x0 = L(v * 38), x1 = L(v * 38 + 34), a = Math.min(x0, x1), b = Math.max(x0, x1);
      fyll(P, a, -20, b, -2, (X, Y) => { const u = (Y + 20) / 18; let c = u < 0.3 ? tone(BLA, 0.6 + (Y === -20 ? 0.3 : 0), X, Y) : u < 0.75 ? tone(GUL, 0.78 - (u - 0.3) * 0.2, X, Y) : tone(BLA, 0.5 - (u - 0.75) * 0.6, X, Y); if (X === a) c = tone(BLA, 0.85, X, Y); if (X === b) c = tone(BLA, 0.3, X, Y); return c; });
      for (let k = 0; k < 3; k++) { const wx = a + 4 + k * 10; fyll(P, wx, -16, wx + 7, -9, (X, Y) => (X === wx || X === wx + 7 || Y === -16 || Y === -9) ? JARN[3] : 0x8ac8f0); P.px(wx + 1, -15, 0xffffff); if (hash(v, k, 3) > 0.3) spr(P, wx + 2, -14, ['.hh.', 'hhhh', '.ss.'], { h: [0x3b2619, 0xd9a95c, 0x1d1714, 0x8a5a3a][(v * 3 + k) % 4], s: [0xe0a97f, 0xf6d7bf, 0xc68a5c, 0xe0a97f][(v + k) % 4] }); }
      fyll(P, a + 2, -2, b - 2, 0, (X, Y) => tone(JARN, 0.45 - (Y + 2) * 0.1, X, Y));   // boggin som griper om balken
      if (v === 0) { const nx = dir > 0 ? b : a; for (let j = 0; j < 6; j++) P.px(nx + s * -1 * (j < 3 ? 0 : 0) + (dir > 0 ? 1 + (j < 3 ? j : 5 - j) : -1 - (j < 3 ? j : 5 - j)), -14 + j, tone(GUL, 0.7, nx, j)); P.px(nx + (dir > 0 ? 2 : -2), -9, 0xfff6c0); P.px(nx + (dir > 0 ? 2 : -2), -8, 0xfff6c0); }
      else P.px(dir > 0 ? a - 1 : b + 1, -12, JARN[3]);
    }
    P.hl(L(0) < L(110) ? L(0) : L(110), -21, 108, BLA[3]);
  }, false);
}
// var tåget är just nu: fram och tillbaka med en paus vid ändarna (på klockan – samma för alla)
export function tagLage(t) {
  const M = MONORAIL, L = M.x1 - M.x0 - 112, T = L / M.fart, cyk = 2 * (T + M.paus), u = ((t % cyk) + cyk) % cyk;
  if (u < T) return { x: M.x0 + 112 + u * M.fart, dir: 1 };
  if (u < T + M.paus) return { x: M.x1, dir: 1 };
  if (u < 2 * T + M.paus) return { x: M.x1 - (u - T - M.paus) * M.fart, dir: -1 };
  return { x: M.x0 + 112, dir: -1 };
}
export function ritaMonorail(ctx, t, cx, VW) {
  const p = tagLage(t), x = Math.round(p.x);
  if (x < cx - 130 || x > cx + VW + 130) return;
  put(ctx, tagBild(p.dir), x, MONORAIL.y);
  // strålkastaren lyser framåt och en liten gnista från strömskenan
  ctx.fillStyle = 'rgba(255,246,190,.25)'; ctx.fillRect(p.dir > 0 ? x + 2 : x - 14, MONORAIL.y - 10, 12, 3);
  if (Math.floor(t * 7) % 3 === 0) { ctx.fillStyle = '#9ad8ff'; ctx.fillRect(x - (p.dir > 0 ? 60 : -60) + Math.floor(t * 13) % 5, MONORAIL.y - 1, 1, 1); }
}
