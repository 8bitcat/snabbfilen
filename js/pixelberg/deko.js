// 🎉 DEKORATIONERNA i ministaden på Pixelberg (Carl 2026-10-13: "en nöjespark är oftast en tematiserad ministad … väv
// in karusellerna i ministaden med stånd och dekorationer – mycket mer dekorationer än på de ställen i staden med mest,
// mycket animationer också så det känns vibrant och rörligt"). Allt här rör sig: portalerna över gränderna med jagande
// glödlampor, tekopparna som snurrar (man kan åka), fontänen, såpbubblorna, konfettin vid entrén, flaggorna som vajar
// och tivolilyktorna. Ett pixelkorn – bara fillRect på heltal.
import { SMALL, ctxText, textW, mix, mul } from '../core/floor-pix.js';
import { drawPerson } from '../core/people.js';
import { glodlampa } from './liv.js';

const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
const R = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = typeof c === 'number' ? css(c) : c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

// 🏮 en portal över en gränd: två spiralrandiga pelare, ett valv med en skylt (namnet) och glödlampor som jagar
export function ritaPortal(ctx, x0, x1, y, namn, t, natt, farg = 0xd84a8a) {
  const H = 46, mx = (x0 + x1) / 2, bredd = x1 - x0;
  for (const px of [x0, x1 - 3]) {
    for (let yy = y - H; yy <= y; yy++) R(ctx, Math.floor((yy + px) / 3) % 2 ? farg : 0xf4f1ea, px, yy, 3, 1);
    R(ctx, 0xf0c030, px - 1, y - H - 2, 5, 2); R(ctx, 0xfff0a0, px - 1, y - H - 2, 1, 1); R(ctx, 0x6a4a2a, px - 1, y, 5, 2);
  }
  // valvet: en båge av guld med lampor
  let i = 0;
  for (let x = x0; x <= x1; x++) {
    const u = (x - x0) / bredd, by = Math.round(y - H - Math.sin(u * Math.PI) * 10);
    R(ctx, 0xf0c030, x, by, 1, 2); R(ctx, 0x8a6a1a, x, by + 2, 1, 1);
    if ((x - x0) % 5 === 2) glodlampa(ctx, x, by - 1, i++, t, natt);
  }
  // skylten mitt på valvet
  const tw = textW(SMALL, namn), sw = tw + 8, sx = Math.round(mx - sw / 2), sy = y - H - 18;
  R(ctx, 0x1e1a24, sx - 1, sy - 1, sw + 2, 11); R(ctx, farg, sx, sy, sw, 9); R(ctx, mix(farg, 0xffffff, 0.35), sx, sy, sw, 1); R(ctx, mul(farg, 0.7), sx, sy + 8, sw, 1);
  ctxText(ctx, SMALL, namn, sx + 4, sy + 2, '#ffffff');
  for (const lx of [sx + 1, sx + sw - 2]) glodlampa(ctx, lx, sy - 2, i++, t, natt);
}

// ☕ tekopparna: en rund plattform med ett tak-paraply av ränder, fyra koppar som går runt och snurrar var för sig;
// sitt = [look | null] för varje kopp (barn eller den som åker)
const KOPPF = [0xe04848, 0x3a7bd5, 0xf0c030, 0x46a35a];
export const TEKOPP = { rx: 40, ry: 12 };
export function koppPos(i, t, x, y) { const v = t * 0.9 + i * Math.PI / 2; return { x: x + Math.cos(v) * 26, y: y + Math.sin(v) * 7, v }; }
export function ritaTekopparGolv(ctx, x, y, t, natt) {
  for (let j = -TEKOPP.ry; j <= TEKOPP.ry; j++) { const w = Math.round(TEKOPP.rx * Math.sqrt(1 - (j / TEKOPP.ry) ** 2)); R(ctx, j > TEKOPP.ry - 3 ? 0x6a4a8a : (j + 20) % 4 === 0 ? 0xc8a8e8 : 0xb890d8, x - w, y + j, w * 2, 1); }
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2 + t * 0.4; glodlampa(ctx, Math.round(x + Math.cos(a) * (TEKOPP.rx - 1)), Math.round(y + Math.sin(a) * (TEKOPP.ry - 1)), k, t, natt); }
  R(ctx, 0xf0c030, x - 3, y - 3, 7, 4); R(ctx, 0xfff0a0, x - 3, y - 3, 3, 1);
}
export function ritaKopp(ctx, i, x, y, t, look) {
  const p = koppPos(i, t, x, y), cx = Math.round(p.x), cy = Math.round(p.y), f = KOPPF[i], spinn = Math.floor(t * 6 + i) % 4;
  if (look) { ctx.save(); ctx.beginPath(); ctx.rect(cx - 8, cy - 40, 16, 34); ctx.clip(); drawPerson(ctx, cx, cy + 10, look, ['down', 'right', 'up', 'left'][spinn], 5); ctx.restore(); }
  // koppen: rundad kropp, ljus kant, en prick-dekor och örat som syns på olika sidor när den snurrar
  for (let j = 0; j < 7; j++) { const w = j < 5 ? 7 : 6 - (j - 5) * 2; R(ctx, j === 0 ? mix(f, 0xffffff, 0.45) : j > 4 ? mul(f, 0.75) : f, cx - w, cy - 6 + j, w * 2 + 1, 1); }
  R(ctx, 0xffffff, cx - 4 + spinn * 2, cy - 3, 1, 1); R(ctx, 0xffffff, cx + 3 - spinn, cy - 2, 1, 1);
  const ox = [8, 4, -9, -5][spinn]; R(ctx, mul(f, 0.85), cx + ox, cy - 5, 2, 3); R(ctx, mul(f, 0.6), cx + ox + 1, cy - 4, 1, 1);
  R(ctx, 'rgba(20,12,30,.25)', cx - 6, cy + 1, 13, 1);
}

// ⛲ fontänen: en rund bassäng med en strålande mitt och droppar som faller i en ring
export function ritaFontan(ctx, x, y, t) {
  for (let j = -9; j <= 9; j++) { const w = Math.round(24 * Math.sqrt(1 - (j / 9) ** 2)); R(ctx, j > 6 ? 0x6a6a72 : 0xb8b0a4, x - w, y + j, w * 2, 1); }
  for (let j = -7; j <= 6; j++) { const w = Math.round(21 * Math.sqrt(1 - (j / 7.5) ** 2)); R(ctx, (x + j * 3 + Math.floor(t * 6)) % 7 === 0 ? 0xd8f4ff : j < -3 ? 0x6ac0e8 : 0x4aa0d8, x - w, y + j - 1, w * 2, 1); }
  R(ctx, 0xb8b0a4, x - 3, y - 12, 7, 12); R(ctx, 0xd8d0c4, x - 3, y - 12, 2, 12); R(ctx, 0xb8b0a4, x - 7, y - 14, 15, 2);
  for (let k = 0; k < 14; k++) {
    const u = (t * 0.9 + k / 14) % 1, a = k / 14 * Math.PI * 2, r = u * 16, h = Math.sin(u * Math.PI) * 18;
    R(ctx, u < 0.5 ? 0xffffff : 0xa8e0ff, x + Math.cos(a) * r, y - 14 - h + u * 10 + Math.sin(a) * r * 0.3, 1, 1);
  }
  for (let k = 0; k < 5; k++) { const u = (t * 1.6 + k / 5) % 1; R(ctx, 0xffffff, x - 1 + (k % 3) - 1, y - 14 - u * 14, 1, 2); }
}
// 🫧 såpbubblor som stiger och glittrar (maskinen står på en liten pall)
export function ritaBubblor(ctx, x, y, t) {
  R(ctx, 0x8a5a2e, x - 5, y - 6, 11, 6); R(ctx, 0xb88a58, x - 5, y - 6, 11, 1);
  R(ctx, 0xd060a0, x - 4, y - 12, 9, 6); R(ctx, 0xf8a0c8, x - 4, y - 12, 9, 1); R(ctx, 0x2a2830, x + 4, y - 10, 2, 2);
  for (let k = 0; k < 12; k++) {
    const u = (t * 0.25 + k / 12) % 1, bx = x + 6 + u * 40 + Math.sin(t * 2 + k) * 4, by = y - 10 - u * 50 - Math.sin(u * 3 + k) * 3, r = 1 + (k % 3);
    if (u > 0.92) continue;
    ctx.globalAlpha = 0.85 * (1 - u);
    R(ctx, ['#c8f0ff', '#ffd0f0', '#fff6c0'][k % 3], bx - r, by, 1, 1); R(ctx, ['#c8f0ff', '#ffd0f0', '#fff6c0'][k % 3], bx + r, by, 1, 1); R(ctx, '#e8f8ff', bx, by - r, 1, 1); R(ctx, '#e8f8ff', bx, by + r, 1, 1);
    R(ctx, '#ffffff', bx - r + 1, by - r + 1, 1, 1);
    ctx.globalAlpha = 1;
  }
}
// 🎊 konfettikanonen vid entrén: en smäll var 16:e sekund, konfettin flyger upp och singlar ner
const KONF = ['#e04848', '#3a7bd5', '#f0c030', '#46a35a', '#d060a0', '#ffffff', '#f08a2a'];
export function ritaKonfetti(ctx, x, y, t) {
  const fas = t % 16;
  R(ctx, 0x3a3a46, x - 2, y - 10, 5, 10); R(ctx, 0x6a6a7a, x - 2, y - 10, 1, 10); R(ctx, 0xe04848, x - 3, y - 12, 7, 2);
  if (fas > 3.4) return;
  for (let k = 0; k < 40; k++) {
    const vx = Math.cos(k * 2.39) * (10 + (k % 7) * 4), vy = -40 - (k % 5) * 9, tt = fas;
    const px = x + vx * tt + Math.sin(tt * 6 + k) * 2, py = y - 12 + vy * tt + 26 * tt * tt;
    R(ctx, KONF[k % KONF.length], px, py, (k + Math.floor(tt * 8)) % 2 ? 2 : 1, 1);
  }
}
// 🚩 en flagga på en hög stång som vajar (triangel, vågen växer mot spetsen)
export function ritaFlagga(ctx, x, y, t, farg, fro = 0) {
  R(ctx, 0xd8d8e0, x, y - 44, 1, 44); R(ctx, 0x8a8a98, x + 1, y - 44, 1, 44); R(ctx, 0xf0c030, x - 1, y - 46, 3, 2);
  for (let i = 0; i < 14; i++) { const h = Math.round(7 - i / 2), dy = Math.round(Math.sin(i * 0.6 - t * 5 + fro) * (i / 14) * 2); R(ctx, i === 0 ? mix(farg, 0xffffff, 0.3) : mul(farg, 1 - Math.cos(i * 0.6 - t * 5 + fro) * 0.12), x + 2 + i, y - 44 + (7 - h) + dy, 1, h * 2 > 0 ? h * 2 : 1); }
}
// 💡 en tivolilykta: spiralrandig stolpe med tre runda klot och små glödlampor runt dem
export function ritaTivolilykta(ctx, x, y, t, natt) {
  for (let yy = y - 34; yy <= y; yy++) R(ctx, Math.floor((yy + x) / 3) % 2 ? 0x2a5aa8 : 0xf4f1ea, x, yy, 2, 1);
  R(ctx, 0x3a3a46, x - 2, y - 1, 6, 2); R(ctx, 0xf0c030, x - 6, y - 36, 14, 2);
  for (const [dx, dy] of [[-6, -40], [0, -44], [7, -40]]) {
    for (let j = -2; j <= 2; j++) { const w = 2 - Math.abs(j) + (Math.abs(j) < 2 ? 1 : 0); R(ctx, natt ? 0xfff6c0 : 0xf8f0e0, x + dx - w + 1, y + dy + j, w * 2, 1); }
    R(ctx, 0xffffff, x + dx, y + dy - 1, 1, 1);
  }
  for (let k = 0; k < 4; k++) glodlampa(ctx, x - 6 + k * 4, y - 34, k + x, t, natt);
}
