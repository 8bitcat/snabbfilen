// 🎈 LIVET på Pixelberg (Carl 2026-10-13: "nu känns den nästan öde … många dekorationer, ballonger, lamporna ska gnistra
// och lysa"): ballonger i knippen vid stånden och hos ballongförsäljaren, vimpelband över torget, gnistrande slingor,
// jonglören vid karusellen. Allt ritas varje bildruta men är små saker (bara fillRect på heltal – ett pixelkorn).
import { mix, mul } from '../core/floor-pix.js';

const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
export const BALLONG_FARG = [0xe04848, 0x3a7bd5, 0xf0c030, 0x46a35a, 0xd060a0, 0xf08a2a, 0x9a6ad8, 0x2ab8c8];
// en ballong: knuten i (x, y), kroppen ovanför – glans uppe till vänster, mörkare skuggsida
export function ballong(ctx, x, y, farg, t = 0, fro = 0) {
  const bob = Math.round(Math.sin(t * 1.6 + fro) * 1), bx = Math.round(x), by = Math.round(y) + bob;
  const ljus = css(mix(farg, 0xffffff, 0.35)), bas = css(farg), mork = css(mul(farg, 0.68));
  // kroppen 7 × 9: rader [halvbredd]
  const RAD = [1, 2, 3, 3, 3, 3, 3, 2, 1];
  RAD.forEach((hw, j) => { const yy = by - 10 + j; ctx.fillStyle = bas; ctx.fillRect(bx - hw, yy, hw * 2 + 1, 1); ctx.fillStyle = mork; ctx.fillRect(bx + hw, yy, 1, 1); if (j > 5) ctx.fillRect(bx + hw - 1, yy, 1, 1); });
  ctx.fillStyle = ljus; ctx.fillRect(bx - 2, by - 8, 1, 2); ctx.fillRect(bx - 1, by - 9, 1, 1);
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(bx - 2, by - 8, 1, 1);
  ctx.fillStyle = mork; ctx.fillRect(bx, by - 1, 1, 1);   // knuten
}
// ett snöre från (x0, y0) upp till (x1, y1), lätt vågigt
function snore(ctx, x0, y0, x1, y1, t, fro) {
  ctx.fillStyle = 'rgba(236,232,224,.85)';
  const n = Math.max(2, Math.round(Math.abs(y1 - y0)));
  for (let i = 0; i <= n; i++) { const u = i / n, x = x0 + (x1 - x0) * u + Math.sin(u * 5 + t * 2 + fro) * 0.6 * u; ctx.fillRect(Math.round(x), Math.round(y0 + (y1 - y0) * u), 1, 1); }
}
// ett knippe ballonger knutet i (x, y): n ballonger i en solfjäder
export function knippe(ctx, x, y, t, fro = 0, n = 4, hojd = 22) {
  for (let i = 0; i < n; i++) {
    const s = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2, bx = x + s * (3 + n * 1.6) + Math.sin(t * 0.9 + i + fro) * 1.2, by = y - hojd - (1 - Math.abs(s)) * 5 + (i % 2) * 3;
    snore(ctx, x, y, bx, by, t, fro + i);
  }
  for (let i = 0; i < n; i++) {
    const s = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2, bx = x + s * (3 + n * 1.6) + Math.sin(t * 0.9 + i + fro) * 1.2, by = y - hojd - (1 - Math.abs(s)) * 5 + (i % 2) * 3;
    ballong(ctx, bx, by, BALLONG_FARG[(i * 3 + fro) % BALLONG_FARG.length], t, fro + i * 1.7);
  }
}
// vimpelband mellan två punkter: trianglar var 6:e pixel i växlande färger, bandet hänger i en båge och vajar lite
const VIMPEL = [0xe04848, 0xf4f1ea, 0x3a7bd5, 0xf0c030, 0x46a35a, 0xd060a0];
export function vimpelband(ctx, x0, y0, x1, y1, t, hang = 12, fro = 0) {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 6));
  const at = (u) => [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * hang];
  ctx.fillStyle = '#5a5662';
  for (let i = 0; i <= n * 3; i++) { const [x, y] = at(i / (n * 3)); ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
  for (let i = 0; i < n; i++) {
    const [x, y] = at((i + 0.5) / n), c = VIMPEL[(i + fro) % VIMPEL.length], vaj = Math.round(Math.sin(t * 3 + i * 0.8 + fro) * 0.6);
    const px = Math.round(x), py = Math.round(y);
    ctx.fillStyle = css(c); ctx.fillRect(px - 2, py + 1, 5, 1); ctx.fillRect(px - 1 + vaj, py + 2, 3, 1); ctx.fillRect(px + vaj, py + 3, 1, 1);
    ctx.fillStyle = css(mix(c, 0xffffff, 0.35)); ctx.fillRect(px - 2, py + 1, 1, 1);
    ctx.fillStyle = css(mul(c, 0.7)); ctx.fillRect(px + 2, py + 1, 1, 1);
  }
}
// gnistrande lampor i en slinga (dag som kväll): en jagande våg + gnistor som blinkar till
const SLINGA = ['#ff6868', '#ffe068', '#68b8ff', '#78f078', '#ff9ad8', '#fff2c0'];
export function glodlampa(ctx, x, y, i, t, natt) {
  const steg = Math.floor(t * 6), jag = (i + steg) % 6 === 0, g = Math.sin(t * 9 + i * 2.3) > 0.97;
  ctx.fillStyle = jag || g ? '#ffffff' : SLINGA[i % SLINGA.length];
  ctx.fillRect(x, y, natt ? 2 : 1, natt ? 2 : 1);
  if (g || (natt && jag)) { ctx.fillStyle = natt ? 'rgba(255,250,220,.8)' : 'rgba(255,255,255,.7)'; ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + (natt ? 2 : 1), y, 1, 1); ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + (natt ? 2 : 1), 1, 1); }
}
// jonglören: tre käglor i en båge över händerna (figuren ritas av scenen; armarna upp varannan stund)
export function jonglerar(ctx, x, y, t) {
  for (let k = 0; k < 3; k++) {
    const u = ((t * 1.4 + k / 3) % 1), side = Math.floor(t * 1.4 + k / 3) % 2 ? 1 : -1;
    const px = Math.round(x + side * (6 - u * 12)), py = Math.round(y - 30 - Math.sin(u * Math.PI) * 16);
    ctx.fillStyle = ['#e04848', '#f0c030', '#3a7bd5'][k]; ctx.fillRect(px, py, 2, 3); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(px, py + 3, 2, 1);
  }
}
// en ballong i ett snöre som man håller i (snöret från handen i (x, y))
export function enBallong(ctx, x, y, farg, t) {
  const bx = x + Math.sin(t * 1.3) * 1.5, by = y - 16;
  snore(ctx, x, y, bx, by, t, 1);
  ballong(ctx, bx, by, farg, t, 1);
}
