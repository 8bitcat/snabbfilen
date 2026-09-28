// Pixelmätarna: porträtt, pengar, dag/klocka, mätthet och sömn ritade direkt på
// spelbilden uppe till vänster, i samma pixelkorn som allt annat. Växlas mot
// HUD-raden i inställningarna ("Mätare: pixel / rad"); valet sparas per webbläsare.
import { portrait } from './people.js';
import { SMALL, ctxText, textW } from './floor-pix.js';
import { clock } from '../game.js';

const KEY = 'snabbfilen_hud';
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

// porträttet cachas per utseende (portrait() ritar 80×96 = 4× av 20×24)
let faceKey = '', faceImg = null;
function face(av) {
  const k = JSON.stringify(av?.look || 0) + (av?.color || '');
  if (k !== faceKey) { faceKey = k; faceImg = portrait(av?.look || {}, '#3a3542'); }
  return faceImg;
}

function bar(ctx, x, y, w, v, icon) {
  icon(ctx, x, y - 1);
  const bx = x + 8;
  ctx.fillStyle = INK; ctx.fillRect(bx - 1, y - 1, w + 2, 6);
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

export function drawPixHud(ctx, A) {
  const g = A.game; if (!g) return;
  // under ett arbetspass har jobbet sin egen rad överst och ordersedlar i hörnet – mätarna skulle skymma dem
  if (String(A.sceneName || '').startsWith('jobb')) return;
  ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
  const X = 3, Y = 3, W = 126, H = 48;
  // panel med skugga
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(X + 2, Y + 2, W, H);
  ctx.fillStyle = INK; ctx.fillRect(X, Y, W, H);
  ctx.fillStyle = PAPER2; ctx.fillRect(X, Y, W, 1); ctx.fillRect(X, Y + H - 1, W, 1); ctx.fillRect(X, Y, 1, H); ctx.fillRect(X + W - 1, Y, 1, H);
  ctx.fillStyle = '#2b2733'; ctx.fillRect(X + 1, Y + 1, W - 2, 1);
  // porträtt 20×24 i ram
  const px = X + 3, py = Y + 3;
  ctx.fillStyle = PAPER2; ctx.fillRect(px - 1, py - 1, 22, 26);
  const f = face(A.avatar);
  if (f) ctx.drawImage(f, 0, 0, 80, 96, px, py, 20, 24);
  // namn, pengar, dag+klocka
  const tx = X + 27;
  const name = String(A.avatar?.name || '').toUpperCase().slice(0, 16);
  ctxText(ctx, SMALL, name, tx, Y + 4, GOLD);
  coin(ctx, tx, Y + 11);
  const money = Math.round(g.money);
  const moneyTxt = (money < 0 ? '-' : '') + Math.abs(money).toLocaleString('sv-SE').replace(/ /g, ' ') + ' KR';
  ctxText(ctx, SMALL, moneyTxt, tx + 7, Y + 11, money < 0 ? '#ff6a6a' : PAPER);
  const day = `${String(g.dayName || '').toUpperCase().slice(0, 3)} ${g.day}  ${clock(g.min)}`;
  ctxText(ctx, SMALL, day, tx, Y + 18, PAPER2);
  // mätare: mätthet + sömn
  bar(ctx, X + 4, Y + 37, 44, g.hunger, burger);
  bar(ctx, X + 66, Y + 37, 44, g.energy, zz);
  // små etiketter ovanför mätarna (under porträttramen, som slutar vid Y+28)
  ctxText(ctx, SMALL, 'MAT', X + 12, Y + 30, PAPER2);
  ctxText(ctx, SMALL, 'SÖMN', X + 74, Y + 30, PAPER2);
  // liten rubrik uppe till höger i panelen om man är skyldig pengar
  if (money < 0) ctxText(ctx, SMALL, 'SKULD!', X + W - textW(SMALL, 'SKULD!') - 3, Y + 4, RED);
}
