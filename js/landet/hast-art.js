// HÄSTEN MED RYTTARE (landet.js när man rider, hopp.js på hinderbanan). En egen, mer detaljerad häst
// från sidan än betesdjuren i djur.js: sadel, schabrak och träns, och benen ritas som leder (axel/höft →
// knä → hov) så att gångarterna går att animera:
//   ga 'sta' (står) · 'trav' (bildruta 0–3) · 'galopp' (0–3) · 'hopp' (svävar: frambenen indragna)
// Ryttaren är spelarens figur (personSprite, sittande) med tyglarna i händerna och hjälm på.
//   drawHastRyttare(ctx, x, y, dir, ga, fr, farg, look, opts)   (x, y) = marken mitt under hästen
//   drawHastEnsam(ctx, x, y, dir, ga, fr, farg)                  utan ryttare (sadel på om sadel: true)
import { Pix, mix, mul } from '../core/floor-pix.js';
import { personSprite } from '../core/people.js';
import { HASTFARG } from './djur.js';

const W = 67, H = 54, AX = 33, AY = 50;   // spriten: marken på rad AY, bålens mitt i kolumn AX (W = 2·AX + 1: speglingen står still)
const CACHE = new Map();
// benens vinklar (grader från lodrätt, + = framåt) per gångart och bildruta: [fram nära, fram bortre, bak nära, bak bortre] × [lår, underben]
const BEN = {
  sta: [[[2, 0], [-2, 0], [0, 0], [-4, 2]]],
  trav: [[[20, -14], [-12, 4], [-14, 6], [18, -12]], [[6, -2], [-2, 0], [-4, 2], [4, -2]], [[-12, 4], [20, -14], [18, -12], [-14, 6]], [[-2, 0], [6, -2], [4, -2], [-4, 2]]],
  galopp: [[[34, -24], [24, -14], [-26, 12], [-34, 16]], [[12, -44], [0, -34], [12, -24], [-10, 6]], [[-22, 10], [-30, 18], [28, -32], [20, -22]], [[-6, 2], [-14, 6], [6, -10], [0, -4]]],
  hopp: [[[64, -118], [56, -108], [-44, 22], [-50, 28]]],
};
const L1 = 9, L2 = 10;   // lårets och underbenets längd
function legLine(P, x, y, ang1, ang2, c, hov) {
  const r1 = ang1 * Math.PI / 180, kx = x + Math.sin(r1) * L1, ky = y + Math.cos(r1) * L1;
  const r2 = (ang1 + ang2) * Math.PI / 180, fx = kx + Math.sin(r2) * L2, fy = ky + Math.cos(r2) * L2;
  for (const [ax, ay, bx, by, w] of [[x, y, kx, ky, 3], [kx, ky, fx, fy, 2]]) {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let i = 0; i <= n; i++) { const px = Math.round(ax + (bx - ax) * i / n), py = Math.round(ay + (by - ay) * i / n); for (let k = 0; k < w; k++) P.px(px + k - (w >> 1), py, c); }
  }
  P.rect(Math.round(fx) - 1, Math.round(fy), 3, 2, hov);
}
function paint(farg, ga, fr, sadel) {
  const [base, lo, man] = HASTFARG[farg] || HASTFARG.fux;
  const hi = mix(base, 0xffffff, 0.18);
  const P = new Pix(W, H);
  const px = (x, y, c) => P.px(AX + x, AY + y, c);
  const rect = (x, y, w, h, c) => P.rect(AX + x, AY + y, w, h, c);
  const set = BEN[ga] || BEN.sta, ben = set[fr % set.length];
  const lift = ga === 'galopp' ? [1, 0, 1, 2][fr % 4] : 0;   // kroppen gungar i galoppen
  const by = -29 - lift;   // ryggens överkant
  const strak = ga === 'galopp' || ga === 'hopp';
  // bortre benen (mörkare) bakom kroppen
  const legs = (near) => {
    for (const i of near ? [0, 2] : [1, 3]) { const fram = i < 2, [a1, a2] = ben[i]; legLine(P, AX + (fram ? 11 : -12) + (near ? 0 : 2), AY + by + 11, a1, a2, near ? lo : mul(lo, 0.78), 0x2a2420); }
  };
  legs(false);
  // svansen (flyger i galoppen)
  for (let k = 0; k < 13; k++) { const x = -18 - (strak ? Math.round(k * 0.8) : (k > 8 ? 1 : 0)), y = by + 3 + (strak ? Math.round(k * 0.45) : k); px(x, y, man); px(x - 1, y, mul(man, 0.85)); }
  // bålen: rundad med ljus rygg, mörkare buk, bröstet och korset lite högre
  for (let j = 0; j < 15; j++) for (let i = -18; i <= 17; i++) {
    const r = Math.hypot(i / 18, (j - 7) / 7.4) - (i > 10 ? 0.06 : 0);
    if (r < 1) px(i, by + j, j < 3 ? hi : j > 11 ? lo : (i < -12 && j < 6 ? hi : base));
  }
  // halsen snett framåt-uppåt och huvudet (mulen nedåt)
  const nx = 12, ny = by + 3, steg = 11, dx = strak ? 1.05 : 0.8, dy = strak ? 0.65 : 0.95;
  for (let k = 0; k < steg; k++) { const x = Math.round(nx + k * dx), y = Math.round(ny - k * dy); rect(x - 2, y - 2, 6, 5, k < 3 ? base : hi); }
  const hx = Math.round(nx + steg * dx), hy = Math.round(ny - steg * dy);
  rect(hx - 1, hy - 3, 6, 5, base); rect(hx + 3, hy - 1, 5, 5, base); rect(hx + 5, hy + 2, 3, 3, lo);
  px(hx + 7, hy + 3, 0x1e1a1c); px(hx + 2, hy - 2, 0x1e1a1c);                     // näsborren och ögat
  px(hx, hy - 4, base); px(hx, hy - 5, lo); px(hx + 1, hy - 5, base);              // öronen
  for (let k = 0; k < steg; k++) { const x = Math.round(nx + k * dx) - 2, y = Math.round(ny - k * dy) - 3; px(x, y, man); px(x - 1, y + 1, man); }   // manen
  if (farg === 'skimmel') for (let k = 0; k < 22; k++) px(-15 + ((k * 7) % 31), by + 2 + ((k * 3) % 10), 0x9a968e);
  // tränset
  px(hx + 6, hy + 1, 0x3a2414); px(hx + 5, hy, 0x3a2414); px(hx + 3, hy - 2, 0x3a2414); px(hx + 4, hy + 4, 0xb8bcc4);
  if (sadel) {
    rect(-7, by + 1, 13, 8, 0x2a5a9a); rect(-7, by + 8, 13, 1, 0xf4f1ea); rect(-7, by + 1, 1, 8, 0xf4f1ea);   // schabraket
    rect(-5, by - 1, 10, 3, 0x6a3a1e); rect(-6, by - 2, 2, 2, 0x6a3a1e); rect(4, by - 2, 2, 2, 0x6a3a1e);     // sadeln
    rect(-1, by + 9, 1, 3, 0x5a3a1e); rect(-2, by + 12, 3, 1, 0xb8bcc4);                                      // stigläder och stigbygel
  }
  legs(true);
  // mörk kontur
  const out = new Pix(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (P.d[(y * W + x) * 4 + 3]) { out.px(x, y, P.get(x, y)); continue; }
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ddx, ddy]) => { const xx = x + ddx, yy = y + ddy; return xx >= 0 && yy >= 0 && xx < W && yy < H && P.d[(yy * W + xx) * 4 + 3]; })) out.px(x, y, 0x1e1a24);
  }
  return { cv: out.flush(), ryggY: by, mule: [hx + 6, hy + 2] };
}
function mirror(cv) { const m = document.createElement('canvas'); m.width = cv.width; m.height = cv.height; const c = m.getContext('2d'); c.translate(cv.width, 0); c.scale(-1, 1); c.drawImage(cv, 0, 0); return m; }
function sprite(farg, ga, fr, dir, sadel) {
  const key = `${farg}|${ga}|${fr}|${dir}|${sadel}`;
  if (CACHE.has(key)) return CACHE.get(key);
  const r = paint(farg, ga, fr, sadel);
  const s = dir === 'left' ? { ...r, cv: mirror(r.cv) } : r;
  if (CACHE.size > 300) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(key, s);
  return s;
}
const skugga = (ctx, x, y, w) => { ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(Math.round(x - w / 2), Math.round(y - 1), w, 2); };

export function drawHastEnsam(ctx, x, y, dir = 'right', ga = 'sta', fr = 0, farg = 'fux', { sadel = false, hojd = 0 } = {}) {
  const s = sprite(farg, ga, fr, dir === 'left' ? 'left' : 'right', sadel);
  skugga(ctx, x, y, hojd > 4 ? 18 : 28);
  ctx.drawImage(s.cv, Math.round(x - AX), Math.round(y - AY - hojd));
}
// hjälmen (svart ridhjälm med skärm) ritas ovanpå figurens huvud
function hjalm(ctx, x, y, dir, kid) {
  const top = y + (kid ? 15 : 7) - 1;   // (sittande figurens huvudtopp, som i fordon-art.js)
  ctx.fillStyle = '#1e1e26'; ctx.fillRect(x + 6, top, 12, 3); ctx.fillRect(x + 5, top + 2, 14, 2);
  ctx.fillStyle = '#3a3a48'; ctx.fillRect(x + 8, top, 6, 1);
  ctx.fillStyle = '#1e1e26'; ctx.fillRect(dir === 'left' ? x + 2 : x + 17, top + 3, 5, 1);   // skärmen
}
export function drawHastRyttare(ctx, x, y, dir = 'right', ga = 'sta', fr = 0, farg = 'fux', look = {}, { hojd = 0 } = {}) {
  const d = dir === 'left' ? 'left' : 'right';
  const s = sprite(farg, ga, fr, d, true);
  skugga(ctx, x, y, hojd > 4 ? 18 : 28);
  const X = Math.round(x), Y = Math.round(y - hojd);
  ctx.drawImage(s.cv, X - AX, Y - AY);
  // ryttaren sitter i sadeln (sittande figur: höften på rad ≈ 29 i spriten), framåtlutad i galopp/hopp
  const ps = personSprite(look, d, 5), lean = ga === 'galopp' || ga === 'hopp' ? (d === 'right' ? 1 : -1) : 0;
  const rx = X - 12 + (d === 'right' ? 0 : 0) + lean, ry = Y + s.ryggY - 27 - (ga === 'galopp' ? (fr % 2) : 0);
  ctx.drawImage(ps, rx, ry);
  hjalm(ctx, rx, ry, d, !!look?.kid);
  // tyglarna: från händerna till bettet
  ctx.fillStyle = '#3a2414';
  const sgn = d === 'right' ? 1 : -1;
  const hx = X + sgn * 4, hy = Y + s.ryggY - 6;
  const mx = X + sgn * s.mule[0], my = Y + s.mule[1];
  const n = Math.ceil(Math.abs(mx - hx));
  for (let i = 0; i <= n; i += 1) ctx.fillRect(Math.round(hx + (mx - hx) * i / n), Math.round(hy + (my - hy) * i / n + Math.sin(i / n * Math.PI) * 2), 1, 1);
}
