// 🧭 DEN STORA BLINKANDE PILEN vid kanten av en stadsdel (Carl 2026-10-13: "en stor blinkande pil som säger
// TASSBACKEN om man kommer nära kanten så man förstår" – och "vi behöver en pil tillbaka till Pixelstaden").
// Delas av staden (→ Tassbacken, → Landet), Tassbacken (→ Pixelstaden) och Landet (→ Pixelstaden).
// Spetsen i (x, y) åt dir (−1 vänster, 1 höger), tre chevroner som jagar framför, ramen blinkar vitt/gult och
// pilen guppar i sin riktning. k = 0–1 tonar in när man närmar sig kanten. ik = en liten 5×5-ikon (tass, ko, stad).
import { BIG, ctxText, textW } from './floor-pix.js';

export const IKON = {
  tass: ['.#.#.', '#...#', '.###.', '#####', '.###.'],
  ko: ['#...#', '.###.', '#####', '.#.#.', '.###.'],
  stad: ['..#..', '.###.', '#.#.#', '#####', '#.#.#'],
};
export function drawRiktning(ctx, x, y, label, dir, t, fg, mork, k, ik = null) {
  if (k <= 0) return;
  const tw = textW(BIG, label), L = tw + (ik ? 30 : 20), H = 23, bob = Math.round(Math.sin(t * 5) * 2) * dir, blink = Math.floor(t * 2.6) % 2 === 0;
  const tx = Math.round(x + bob), x0 = dir < 0 ? tx + 12 : tx - 12 - L, cy = Math.round(y);
  ctx.save(); ctx.globalAlpha = Math.min(1, k);
  // chevronerna framför spetsen
  for (let c = 0; c < 3; c++) {
    const u = ((t * 2.2 + c / 3) % 1), cx = tx + dir * (6 + c * 9 + Math.round(u * 4)), a = Math.min(1, k) * (1 - u) * 0.95;
    ctx.globalAlpha = a; ctx.fillStyle = blink ? '#ffd23f' : '#ffffff';
    for (let j = -5; j <= 5; j++) { const off = (5 - Math.abs(j)) * dir; ctx.fillRect(cx + off, cy + j, 2, 1); }
  }
  ctx.globalAlpha = Math.min(1, k);
  // kroppen: mörk kant, ram (blinkar), fyllning
  const tri = (inset, col) => { ctx.fillStyle = col; for (let j = 0; j <= 11 - inset; j++) { const w = 12 - j - inset; if (w <= 0) continue; const xa = dir < 0 ? tx + j + inset : tx - j - inset - w + 1; ctx.fillRect(xa, cy - j, w, 1); if (j) ctx.fillRect(xa, cy + j, w, 1); } };
  ctx.fillStyle = '#1e1a24'; ctx.fillRect(x0 - 1, cy - 12, L + 2, H + 2); tri(-1, '#1e1a24');
  ctx.fillStyle = blink ? '#ffd23f' : '#f4f1ea'; ctx.fillRect(x0, cy - 11, L, H); tri(0, blink ? '#ffd23f' : '#f4f1ea');
  ctx.fillStyle = fg; ctx.fillRect(x0 + 2, cy - 9, L - 4, H - 4); tri(2, fg);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x0 + 2, cy - 9, L - 4, 2);
  const lx = dir < 0 ? x0 + 6 : x0 + (ik ? 14 : 4) + (ik ? 0 : 6);
  ctxText(ctx, BIG, label, lx + 1, cy - 3, mork); ctxText(ctx, BIG, label, lx, cy - 4, '#ffffff');
  if (ik) { ctx.fillStyle = '#ffffff'; ik.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') ctx.fillRect((dir < 0 ? x0 + L - 10 : x0 + 6) + i, cy - 2 + j, 1, 1); }); }
  ctx.restore();
}
