// Pixelmätarna: en remsa (384×28 spelpixlar) direkt OVANFÖR spelbilden, på en egen canvas i
// exakt samma pixelkorn – porträtt, namn, pengar, dag och klocka, mat- och sömnmätare,
// antal online. Den ligger utanför scenen och skymmer aldrig något i spelet. Växlas mot
// HUD-raden i inställningarna ("Mätare: pixel / rad"); valet sparas per webbläsare.
import { portrait } from './people.js';
import { SMALL, ctxText, textW } from './floor-pix.js';
import { clock } from '../game.js';

const KEY = 'snabbfilen_hud';
export const STRIP_H = 28;
const W = 384;
const INK = '#17151a', PAPER = '#f1ebe0', PAPER2 = '#cfc7ba', GOLD = '#e8b230', RED = '#c9323a', GREEN = '#45b964';

let mode = null;
export function hudMode() {
  if (mode) return mode;
  try { mode = localStorage.getItem(KEY); } catch { /* ok */ }
  // testrobotar får raden (samma skärmdumpar som förut), spelare får pixelmätarna
  if (mode !== 'pix' && mode !== 'rad') mode = typeof navigator !== 'undefined' && navigator.webdriver ? 'rad' : 'pix';
  return mode;
}
export const isPixHud = () => hudMode() === 'pix';
export function setHudMode(m) {
  mode = m === 'pix' ? 'pix' : 'rad';
  try { localStorage.setItem(KEY, mode); } catch { /* ok */ }
  apply();
  return mode;
}
export function apply() {
  document.body.classList.toggle('hud-pix', isPixHud());
  window.dispatchEvent(new Event('resize')); // canvasen får plats som frigörs
}

// Telefonen i liggande läge (html.desk-mobil, index.html): en tunn remsa på en rad – namn, pengar,
// dag och klocka, mat- och sömnmätaren – och HUD-knapparna ligger ovanpå dess högra del (css).
// Mer höjd till spelet, så att figuren kan synas större (Carl 2026-09-30).
export const STRIP_PHONE = 14;
const phoneHud = () => typeof document !== 'undefined' && document.documentElement.classList.contains('desk-mobil');
// Remsans höjd i spelpixlar (0 = ingen remsa: raden överst, eller huvudmenyn)
export const stripHeight = (A) => (isPixHud() && !A?.attract ? (phoneHud() ? STRIP_PHONE : STRIP_H) : 0);
// Telefonen i liggande läge: passets tid och poäng står i remsan i stället för överst i scenen –
// där beskärs bilden upptill, och en mörk rad över scenen skymde disken (Carl 2026-09-30:
// "sakerna på disken … fastnar bakom"). Minispelen lämnar läget i A.shiftHud (drawShiftHud).
export const shiftInStrip = () => isPixHud() && phoneHud();

let strip = null;
function ensureStrip() {
  if (strip) return strip;
  const app = document.getElementById('app'), scene = document.getElementById('scene');
  if (!app || !scene) return null;
  strip = document.createElement('canvas');
  strip.id = 'hudpix';
  app.insertBefore(strip, scene);
  return strip;
}
// Anropas från fit(): ger remsan samma skala som spelbilden (heltal device-pixlar per spelpixel)
export function layoutStrip(A, dpr, wLogical = W, cssW = 0) {
  const c = ensureStrip(); if (!c) return;
  const h = stripHeight(A);
  c.classList.toggle('hidden', h === 0);
  if (!h) return;
  c.width = wLogical * A.pxs; c.height = h * A.pxs;
  c.style.width = (cssW || (wLogical * A.pxs / dpr)) + 'px';
  c.style.height = (h * A.pxs / dpr) + 'px';
}

// porträttet cachas per utseende (portrait() ritar 80×96 = 4× av 20×24)
let faceKey = '', faceImg = null;
function face(av) {
  const k = JSON.stringify(av?.look || 0) + (av?.color || '');
  if (k !== faceKey) { faceKey = k; faceImg = portrait(av?.look || {}, '#3a3542'); }
  return faceImg;
}

function bar(ctx, x, y, w, v, icon) {
  icon(ctx, x, y - 1);
  const bx = x + 9;
  ctx.fillStyle = PAPER2; ctx.fillRect(bx - 1, y - 1, w + 2, 6);
  ctx.fillStyle = '#3a3542'; ctx.fillRect(bx, y, w, 4);
  const f = Math.round(Math.max(0, Math.min(1, v / 100)) * w);
  ctx.fillStyle = v <= 20 ? RED : v <= 45 ? GOLD : GREEN;
  if (f) ctx.fillRect(bx, y, f, 4);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; if (f) ctx.fillRect(bx, y, f, 1);
  // skalstreck var fjärdedel
  ctx.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 1; i < 4; i++) ctx.fillRect(bx + Math.round(w * i / 4), y, 1, 4);
  if (v <= 20 && Math.floor(performance.now() / 400) % 2 === 0) { ctx.fillStyle = RED; ctx.fillRect(bx - 1, y - 1, w + 2, 1); ctx.fillRect(bx - 1, y + 4, w + 2, 1); }
}
// små ikoner (6×6)
function burger(ctx, x, y) {
  ctx.fillStyle = '#e0a44a'; ctx.fillRect(x + 1, y, 4, 1); ctx.fillRect(x, y + 1, 6, 1);
  ctx.fillStyle = '#5a9a3a'; ctx.fillRect(x, y + 2, 6, 1);
  ctx.fillStyle = '#7a3a1e'; ctx.fillRect(x, y + 3, 6, 1);
  ctx.fillStyle = '#e0a44a'; ctx.fillRect(x, y + 4, 6, 1); ctx.fillRect(x + 1, y + 5, 4, 1);
}
function zz(ctx, x, y) {
  ctx.fillStyle = '#8fd3ff';
  ctx.fillRect(x, y, 4, 1); ctx.fillRect(x + 2, y + 1, 1, 1); ctx.fillRect(x + 1, y + 2, 1, 1); ctx.fillRect(x, y + 3, 4, 1);
  ctx.fillRect(x + 4, y + 2, 2, 1); ctx.fillRect(x + 5, y + 3, 1, 1); ctx.fillRect(x + 4, y + 4, 2, 1);
}
function coin(ctx, x, y) {
  ctx.fillStyle = '#b07a12'; ctx.fillRect(x + 1, y, 3, 5); ctx.fillRect(x, y + 1, 5, 3);
  ctx.fillStyle = GOLD; ctx.fillRect(x + 1, y + 1, 3, 3);
  ctx.fillStyle = '#fff2b0'; ctx.fillRect(x + 1, y + 1, 1, 1);
}
function folkIcon(ctx, x, y) {
  ctx.fillStyle = PAPER2;
  ctx.fillRect(x + 1, y, 2, 2); ctx.fillRect(x, y + 2, 4, 3);
  ctx.fillRect(x + 5, y + 1, 2, 2); ctx.fillRect(x + 4, y + 3, 4, 3);
}

// Telefonens remsa: allt på en rad (knapparna ligger ovanpå högerdelen, se css html.desk-mobil)
function drawPhoneStrip(ctx, A, g, Wv) {
  const H = STRIP_PHONE, y = 5;
  ctx.fillStyle = INK; ctx.fillRect(0, 0, Wv, H);
  ctx.fillStyle = PAPER2; ctx.fillRect(0, H - 1, Wv, 1);
  let x = 4;
  const name = String(A.avatar?.name || '').toUpperCase().slice(0, 12);
  ctxText(ctx, SMALL, name, x, y, GOLD); x += textW(SMALL, name) + 8;
  coin(ctx, x, y);
  const money = Math.round(g.money);
  const moneyTxt = (money < 0 ? '-' : '') + Math.abs(money).toLocaleString('sv-SE').replace(/ /g, ' ') + ' KR';
  ctxText(ctx, SMALL, moneyTxt, x + 7, y, money < 0 ? '#ff6a6a' : PAPER); x += 7 + textW(SMALL, moneyTxt) + 8;
  // mitt i ett pass: jobbet, poängen och tiden kvar (klockan står still under passet och
  // mat/sömn ändras först när det är slut)
  const sh = A.shiftHud;
  if (sh && performance.now() - sh.at < 600) {
    ctxText(ctx, SMALL, sh.title, x, y, GOLD); x += textW(SMALL, sh.title) + 8;
    const sc = `+${sh.ok} -${sh.fel}`;
    ctxText(ctx, SMALL, sc, x, y, PAPER); x += textW(SMALL, sc) + 8;
    const bw = 64, left = Math.max(0, 1 - sh.t / sh.dur);
    ctx.fillStyle = PAPER2; ctx.fillRect(x - 1, y - 1, bw + 2, 6);
    ctx.fillStyle = '#3a3542'; ctx.fillRect(x, y, bw, 4);
    ctx.fillStyle = left < 0.2 ? RED : GREEN; ctx.fillRect(x, y, Math.round(bw * left), 4);
    return;
  }
  const day = `${String(g.dayName || '').slice(0, 3).toUpperCase()} ${clock(g.min)}`;
  ctxText(ctx, SMALL, day, x, y, PAPER2); x += textW(SMALL, day) + 10;
  bar(ctx, x, y, 34, g.hunger, burger); x += 34 + 9 + 8;
  bar(ctx, x, y, 34, g.energy, zz);
}

// Ritas varje bildruta från spelets loop (ctx-argumentet är spelbildens och används inte)
export function drawPixHud(_ctx, A) {
  const g = A.game; if (!g) return;
  const c = ensureStrip(); if (!c || stripHeight(A) === 0 || !c.width) return;
  const ctx = c.getContext('2d');
  ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (phoneHud()) { drawPhoneStrip(ctx, A, g, Math.round(c.width / A.pxs)); return; }
  const H = STRIP_H, Wv = Math.max(W, Math.round(c.width / A.pxs)); // remsan kan vara bredare än 384 (mobilfyllning)
  ctx.fillStyle = INK; ctx.fillRect(0, 0, Wv, H);
  ctx.fillStyle = '#2b2733'; ctx.fillRect(0, 0, Wv, 1);
  ctx.fillStyle = PAPER2; ctx.fillRect(0, H - 1, Wv, 1);
  // porträtt 20×24 i ram
  const px = 3, py = 2;
  ctx.fillStyle = PAPER2; ctx.fillRect(px - 1, py - 1, 22, 26);
  const f = face(A.avatar);
  if (f) ctx.drawImage(f, 0, 0, 80, 96, px, py, 20, 24);
  // namn, pengar, dag + klocka
  const tx = 27;
  const name = String(A.avatar?.name || '').toUpperCase().slice(0, 16);
  ctxText(ctx, SMALL, name, tx, 3, GOLD);
  coin(ctx, tx, 10);
  const money = Math.round(g.money);
  const moneyTxt = (money < 0 ? '-' : '') + Math.abs(money).toLocaleString('sv-SE').replace(/ /g, ' ') + ' KR';
  ctxText(ctx, SMALL, moneyTxt, tx + 7, 10, money < 0 ? '#ff6a6a' : PAPER);
  const day = `${String(g.dayName || '').toUpperCase()} DAG ${g.day}  ${clock(g.min)}`;
  ctxText(ctx, SMALL, day, tx, 17, PAPER2);
  // mätare: mat + sömn
  const mx = Math.max(136, ((Wv / 2) | 0) - 76); // mätarna i mitten när remsan är bred
  ctxText(ctx, SMALL, 'MAT', mx, 3, PAPER2);
  bar(ctx, mx, 12, 64, g.hunger, burger);
  ctxText(ctx, SMALL, 'SÖMN', mx + 88, 3, PAPER2);
  bar(ctx, mx + 88, 12, 64, g.energy, zz);
  // höger: online + skuld / dagens händelse
  const online = A.worldInfo?.().online || 1;
  const onTxt = online > 1 ? `${online} ONLINE` : 'ENSAM I STAN';
  folkIcon(ctx, Wv - 4 - textW(SMALL, onTxt) - 10, 3);
  ctxText(ctx, SMALL, onTxt, Wv - 4 - textW(SMALL, onTxt), 3, PAPER2);
  if (money < 0) ctxText(ctx, SMALL, 'SKULD!', Wv - 4 - textW(SMALL, 'SKULD!'), 17, RED);
  else if (g.event?.id) { const t = String(g.event.id).toUpperCase(); ctxText(ctx, SMALL, t, Wv - 4 - textW(SMALL, t), 17, GOLD); }
}
