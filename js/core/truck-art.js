// FOODTRUCKEN i staden (city.js) och uppställd i GARAGET (shop-fordon.js): en kantig skåpbil sedd från
// sidan med förarhytten åt höger, den uppfällda serveringsluckan på sidan, disken med senap och
// ketchup, takskylten med truckens namn och griffeltavlan med menyn framför. Med markis-uppgraderingen
// en randig markis och en ljusslinga (lyser på kvällen). Står någon i luckan syns hen där inne.
//   drawTruck(ctx, x, y, { open, markis, namn, meny: [rätt-id], staff: [look], t, night })
//   (x, y) = mitt på marken under trucken. Storlek ≈ 68×46.
import { Pix, SMALL, text, textW, mix, mul, hash } from './floor-pix.js';
import { personSprite } from './people.js';
import { truckIcon } from '../jobs/jobb-truck.js';

const W = 72, H = 52, AX = 36, AY = 50;
const CACHE = new Map();
const BODY = 0xf2ecd8, BODY_LO = 0xd8cfb4, BODY_DK = 0xa89c80, STRIPE = 0x2aa39a, STRIPE_LO = 0x1e7a72;
function build(open, markis, namn) {
  const P = new Pix(W, H);
  const px = (x, y, c, a) => P.px(AX + x, AY + y, c, a);
  const rect = (x, y, w, h, c) => P.rect(AX + x, AY + y, w, h, c);
  // hjulen
  for (const wx of [-22, 18]) for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) { const d = Math.hypot(i, j); if (d <= 5.4) px(wx + i, -6 + j, d > 4 ? 0x141418 : d > 2 ? 0x2c2c32 : 0xb8bcc4); }
  // lådan (bakdelen) och hytten
  rect(-33, -40, 50, 32, BODY); rect(-33, -40, 50, 2, 0xfaf6ea); rect(-33, -10, 50, 2, BODY_LO);
  rect(17, -30, 16, 22, BODY); rect(17, -30, 16, 2, 0xfaf6ea);
  for (let y = -30; y < -8; y++) px(32, y, BODY_DK);
  rect(19, -28, 11, 9, 0x6aa8d8); rect(19, -28, 11, 2, 0xa8d8f0); px(29, -21, 0x4a88b8);    // vindrutan/sidorutan
  rect(18, -16, 13, 1, BODY_DK); px(28, -14, 0x3a3a3e);                                        // dörren och handtaget
  rect(31, -12, 3, 3, 0xffe9a0); rect(31, -8, 4, 2, 0x8a8e96);                                 // lyktan och stötfångaren
  // randen längs sidan
  rect(-33, -14, 66, 3, STRIPE); rect(-33, -11, 66, 1, STRIPE_LO);
  // skärmar över hjulen
  for (const wx of [-22, 18]) for (let a = 200; a <= 340; a += 6) { const r = 7, t = a * Math.PI / 180; px(Math.round(wx + Math.cos(t) * r), Math.round(-6 + Math.sin(t) * r), BODY_DK); }
  // serveringsluckan
  if (open) {
    rect(-29, -34, 40, 17, 0x2a2622); rect(-29, -34, 40, 2, 0x1a1614);
    // inredning: hylla med flaskor och en lampa
    rect(-27, -30, 36, 1, 0x6a6058); for (let i = 0; i < 6; i++) rect(-25 + i * 6, -33, 2, 3, [0xd8302a, 0xf0c030, 0x46a35a][i % 3]);
    px(-10, -33, 0xfff0b0); px(-9, -33, 0xfff0b0);
    // disken utanför luckan med senap och ketchup
    rect(-31, -17, 44, 3, 0xc8ccd4); rect(-31, -17, 44, 1, 0xf0f2f6);
    rect(-28, -21, 2, 4, 0xf0c030); rect(-25, -21, 2, 4, 0xd8302a); rect(-21, -20, 4, 3, 0xf4f1ea);
    // luckan uppfälld som tak (eller markisen)
    if (markis) { for (let x = -33; x < 17; x++) for (let y = -44; y < -38; y++) px(x, y, ((x + 40) >> 2) & 1 ? 0xd8343c : 0xf4f1ea); for (let x = -33; x < 17; x += 4) px(x + 2, -38, ((x + 40) >> 2) & 1 ? 0xd8343c : 0xf4f1ea); }
    else { rect(-31, -40, 44, 3, BODY_LO); rect(-31, -40, 44, 1, 0xfaf6ea); for (const sx of [-30, 11]) for (let k = 0; k < 6; k++) px(sx, -37 + k, 0x8a8e96); }
  } else {
    rect(-29, -34, 40, 17, BODY_LO); rect(-29, -34, 40, 1, BODY_DK); rect(-29, -18, 40, 1, BODY_DK);
    rect(-17, -29, 16, 7, 0xd8343c); text(P, SMALL, 'STÄNGT', AX - 16, AY - 28, 0xf4f1ea);
  }
  // takskylten med namnet
  const s = String(namn || 'FOODTRUCK').toUpperCase().replace(/[^A-ZÅÄÖÉÁÀÂÃÇĆÈÊËÍÌÎÏÑŃÓÒÔÕŚŹŻÚÙÛÜŸÝĄĘŁŒÆ¡¿€$0-9 !'.-]/g, '').slice(0, 14), tw = textW(SMALL, s) + 6;
  const sx = Math.round(-8 - tw / 2);
  rect(sx, -50 + (markis && open ? 0 : 3), tw, 8, STRIPE); rect(sx, -50 + (markis && open ? 0 : 3), tw, 1, 0x5ad0c4);
  text(P, SMALL, s, AX + sx + 3, AY - 48 + (markis && open ? 0 : 3), 0xf4f1ea);
  // mörk kontur runt allt
  const out = new Pix(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (P.d[(y * W + x) * 4 + 3]) { out.px(x, y, P.get(x, y)); continue; }
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < W && yy < H && P.d[(yy * W + xx) * 4 + 3]; })) out.px(x, y, 0x1e1a24);
  }
  return out.flush();
}

export function drawTruck(ctx, x, y, { open = false, markis = false, namn = '', meny = [], staff = [], t = 0, night = false } = {}) {
  const key = `${open}|${markis}|${namn}`;
  if (!CACHE.has(key)) { if (CACHE.size > 20) CACHE.delete(CACHE.keys().next().value); CACHE.set(key, build(open, markis, namn)); }
  const X = Math.round(x), Y = Math.round(y);
  ctx.fillStyle = 'rgba(20,12,30,.28)'; ctx.fillRect(X - 34, Y - 2, 70, 3); ctx.fillRect(X - 30, Y + 1, 62, 1);
  ctx.drawImage(CACHE.get(key), X - AX, Y - AY);
  // personalen i luckan (huvud och axlar)
  if (open) staff.slice(0, 2).forEach((look, i) => {
    const spr = personSprite(look, 'down', Math.sin(t * 2 + i * 2) > 0.85 ? 4 : 0);
    const px = X - 20 + i * 16, py = Y - 34;
    ctx.drawImage(spr, 0, 4, 24, 15, px - 12, py - 2, 24, 15);
  });
  // ljusslingan (markisen) – lyser på kvällen
  if (open && markis) for (let i = 0; i < 9; i++) {
    const lx = X - 33 + i * 6, ly = Y - 37 + (i % 2);
    ctx.fillStyle = night ? ['#ffe070', '#ff8a8a', '#8ad8ff'][i % 3] : '#c8c0a0';
    ctx.fillRect(lx, ly, 2, 2);
    if (night && Math.floor(t * 3 + i) % 4) { ctx.fillStyle = 'rgba(255,230,140,.25)'; ctx.fillRect(lx - 1, ly - 1, 4, 4); }
  }
  // griffeltavlan med menyn framför trucken
  if (open && meny.length) {
    const bx = X + 26, by = Y - 2;
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(bx - 1, by - 22, 2, 22); ctx.fillRect(bx + 15, by - 22, 2, 22);
    ctx.fillStyle = '#2a3a2e'; ctx.fillRect(bx, by - 24, 16, 18); ctx.fillStyle = '#8a6a3e'; ctx.fillRect(bx - 1, by - 25, 18, 1);
    meny.slice(0, 4).forEach((id, i) => { ctx.save(); ctx.globalAlpha = 0.95; ctx.drawImage(truckIcon(id), 0, 0, 12, 12, bx + 1 + (i % 2) * 8, by - 22 + Math.floor(i / 2) * 8, 7, 7); ctx.restore(); });
  }
}
export const TRUCK_RECT = { x0: -34, x1: 34, y0: -14, y1: 2 };   // fotavtrycket (hinder i staden)
