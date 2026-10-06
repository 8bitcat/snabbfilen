// 🎭 Dräkterna lever (maskeradbutiken, Carl 2026-10-06: "dräkterna ska vara interaktiva så man kan
// göra emotes med dem … svinga sitt trollspö om man är en fe, spöket ska lyfta händerna och skrämmas").
//
// Bär man en dräkt med en rörelse syns 🎭-knappen i HUD:en (main.js). Ett tryck spelar rörelsen
// för en själv direkt – även utan nät – och skickar den som en emote ('👻', '🪄' …, world.js) till
// de andra, som ritar samma rörelse på ens figur. Rörelsen = en ställning ur figurritaren
// (bildruta 10 armarna upp, 11 ena armen upp, js/core/people.js) + effekter: gnistor ur
// trollspöet, BUUU! från spöket, fladdermöss runt vampyren, ett skramlande skelett …
// Ritas av walkable.js (selfDrawable/folkDrawables – staden och de flesta butikerna) och room.js.
import { drawPerson } from './people.js';
import { play } from './sound.js';
import { BIG, ctxText, textW } from './floor-pix.js';

export const DUR = 2.4;   // sekunder (världens emotes visas 2,6 s)
export const ACTIONS = [
  { e: '👻', namn: 'BU!', when: (L) => L.hat === 'ghost', fx: 'bu', snd: 'fel' },
  { e: '🪄', namn: 'Trollspöet', when: (L) => L.bag === 'fairyWings', fx: 'wand', snd: 'coin' },
  { e: '✨', namn: 'Trollformeln', when: (L) => L.hat === 'witch' || L.hat === 'wizard' || L.top === 'robe', fx: 'spell', snd: 'box' },
  { e: '🧛', namn: 'Muahaha!', when: (L) => L.top === 'vampire', fx: 'bats', snd: 'slide' },
  { e: '💀', namn: 'Skallra', when: (L) => L.topPrint === 'skeleton' || L.bottomPrint === 'skeleton', fx: 'rattle', snd: 'click' },
  { e: '🎃', namn: 'Lys', when: (L) => L.topPrint === 'pumpkin', fx: 'glow', snd: 'ok' },
  { e: '🦸', namn: 'Hjältekraft', when: (L) => L.top === 'hero', fx: 'hero', snd: 'fanfare' },
  { e: '😇', namn: 'Gloria', when: (L) => L.hat === 'halo' || L.bag === 'wings', fx: 'halo', snd: 'morning' },
];
export const actionFor = (L) => ACTIONS.find((a) => a.when(L || {})) || null;
export const actionByEmote = (e) => ACTIONS.find((a) => a.e === e) || null;

// ---------- min egen rörelse (fungerar utan nät) ----------
let mine = null;   // { a, t0 }
export function startAction(A) {
  const a = actionFor(A.avatar?.look);
  if (!a) return null;
  mine = { a, t0: performance.now() };
  try { A.sendEmote?.(a.e); } catch { /* utan nät: bara här */ }
  play(a.snd);
  return a;
}
export function myAction() {
  if (mine && (performance.now() - mine.t0) / 1000 > DUR) mine = null;
  return mine ? { a: mine.a, el: (performance.now() - mine.t0) / 1000 } : null;
}
// andra spelares rörelser: när emoten först syntes (för att veta hur långt rörelsen kommit)
const seen = new Map();   // id → { e, t0 }
export function folkAction(id, emote) {
  const a = emote && actionByEmote(emote);
  if (!a) { seen.delete(id); return null; }
  let s = seen.get(id);
  if (!s || s.e !== emote) { s = { e: emote, t0: performance.now() }; seen.set(id, s); }
  const el = (performance.now() - s.t0) / 1000;
  return el > DUR ? null : { a, el };
}

// ---------- ritning ----------
// ställningen: bildrutan och en liten förskjutning (spöket svävar, skelettet skakar)
export function poseOf(a, el) {
  switch (a.fx) {
    case 'bu': return { frame: 10, dx: 0, dy: -Math.round(2 + Math.sin(el * 6) * 2) };
    case 'wand': case 'spell': return { frame: Math.floor(el * 4) % 2 ? 11 : 0, dx: 0, dy: 0 };
    case 'rattle': return { frame: Math.floor(el * 10) % 2 ? 10 : 0, dx: Math.floor(el * 20) % 2 ? 1 : -1, dy: 0 };
    case 'hero': return { frame: 10, dx: 0, dy: el < 1.2 ? -Math.round(Math.sin(el / 1.2 * Math.PI) * 6) : 0 };
    default: return { frame: 10, dx: 0, dy: 0 };
  }
}
// figuren i rörelsen + effekterna (dir = blickriktningen; fötterna vid x, y)
export function drawActing(ctx, x, y, look, dir, act) {
  const { a, el } = act, p = poseOf(a, el);
  const d = a.fx === 'bu' || a.fx === 'hero' || a.fx === 'halo' ? 'down' : dir;   // vänd mot den man skrämmer
  if (a.fx === 'glow' || a.fx === 'halo') glowBehind(ctx, x, y, a, el);
  drawPerson(ctx, x + p.dx, y + p.dy, look, d, p.frame);
  fx(ctx, x + p.dx, y + p.dy, a, el, d, p.frame);
}
const R = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
function sparkle(ctx, x, y, c, s = 1) { R(ctx, x, y - s, 1, 1 + 2 * s, c); R(ctx, x - s, y, 1 + 2 * s, 1, c); }
function glowBehind(ctx, x, y, a, el) {
  const k = Math.min(1, el * 3) * Math.min(1, (DUR - el) * 3);
  const c = a.fx === 'glow' ? '255,170,60' : '255,240,170';
  for (const [rx, ry, al] of [[14, 22, 0.12], [9, 16, 0.16]]) {
    ctx.fillStyle = `rgba(${c},${(al * k).toFixed(3)})`;
    for (let j = -ry; j <= ry; j++) { const w = Math.round(rx * Math.sqrt(1 - (j / ry) ** 2)); ctx.fillRect(x - w, y - 20 + j, w * 2, 1); }
  }
}
function bubble(ctx, x, y, txt, el) {
  // en tecknad pratbubbla med tjock text (BUUU!, MUAHAHA!) – växer fram
  const k = Math.min(1, el * 5), w = textW(BIG, txt) + 6, h = 11;
  const x0 = Math.round(x - w / 2), y0 = Math.round(y - h - 2 * (1 - k));
  R(ctx, x0 - 1, y0 - 1, w + 2, h + 2, '#1c1820'); R(ctx, x0, y0, w, h, '#fffef6');
  R(ctx, x - 1, y0 + h + 1, 3, 1, '#1c1820'); R(ctx, x, y0 + h, 1, 2, '#fffef6');
  ctxText(ctx, BIG, txt, x0 + 3, y0 + 2, '#1c1820');
}
function fx(ctx, x, y, a, el, dir, frame) {
  const t = el;
  switch (a.fx) {
    case 'bu': {
      bubble(ctx, x, y - 44, 'BUUU!', el);
      for (let k = 0; k < 3; k++) { const u = (t * 1.5 + k / 3) % 1; R(ctx, x - 12 - u * 8, y - 30 + k * 6, 3, 1, `rgba(200,210,240,${(0.6 * (1 - u)).toFixed(2)})`); R(ctx, x + 10 + u * 8, y - 30 + k * 6, 3, 1, `rgba(200,210,240,${(0.6 * (1 - u)).toFixed(2)})`); }
      break;
    }
    case 'wand': case 'spell': {
      // trollspöet i den upplyfta handen och gnistorna som virvlar ut ur stjärnan
      const up = frame === 11, side = dir === 'left' ? -1 : 1;
      const hx = dir === 'left' || dir === 'right' ? x + side * 5 : x + 7, hy = y - 33;
      if (up) {
        R(ctx, hx, hy - 6, 1, 6, '#6a4228'); R(ctx, hx + 1, hy - 6, 1, 6, '#3a2414');
        sparkle(ctx, hx, hy - 8, a.fx === 'spell' ? '#8af08a' : '#fff4a0', 1); R(ctx, hx, hy - 8, 1, 1, '#ffffff');
      }
      const cols = a.fx === 'spell' ? ['#8af08a', '#c8f070', '#5ac86a'] : ['#fff4a0', '#ff9ad8', '#9ad8ff', '#ffffff'];
      for (let k = 0; k < 9; k++) {
        const u = ((t * 1.3) + k / 9) % 1, ang = k * 2.3 + t * 3, r = 4 + u * 16;
        const px = hx + Math.cos(ang) * r, py = hy - 8 + Math.sin(ang) * r * 0.6 + u * 10;
        if (u < 0.85) sparkle(ctx, px, py, cols[k % cols.length], u < 0.3 ? 1 : 0);
      }
      break;
    }
    case 'bats': {
      bubble(ctx, x, y - 46, 'MUAHAHA!', el);
      for (let k = 0; k < 4; k++) {
        const ang = t * 4 + k * Math.PI / 2, bx = x + Math.cos(ang) * 14, by = y - 26 + Math.sin(ang) * 6, up = Math.floor(t * 10 + k) % 2;
        R(ctx, bx, by, 3, 2, '#1c1428'); R(ctx, bx - 2, by + (up ? -1 : 1), 2, 1, '#1c1428'); R(ctx, bx + 3, by + (up ? -1 : 1), 2, 1, '#1c1428');
      }
      break;
    }
    case 'rattle': {
      for (let k = 0; k < 4; k++) { const u = (t * 2 + k / 4) % 1; R(ctx, x + (k % 2 ? 9 : -10) + u * (k % 2 ? 4 : -4), y - 34 + k * 7, 2, 1, `rgba(244,241,234,${(1 - u).toFixed(2)})`); }
      if (el < 1.4) bubble(ctx, x, y - 44, 'KLAPP!', el);
      break;
    }
    case 'glow': for (let k = 0; k < 6; k++) { const u = (t * 0.8 + k / 6) % 1; R(ctx, x - 8 + ((k * 5) % 16), y - 20 - u * 24, 1, 1, u < 0.5 ? '#ffd23f' : '#ff9d0e'); } break;
    case 'hero': for (let k = 0; k < 5; k++) { const u = (t * 2 + k / 5) % 1; R(ctx, x - 10 + k * 5, y + 2 + u * 3, 2, 1, `rgba(255,220,120,${(0.8 * (1 - u)).toFixed(2)})`); } break;
    case 'halo': for (let k = 0; k < 8; k++) { const ang = t * 2 + k * 0.785; sparkle(ctx, x + Math.cos(ang) * 12, y - 22 + Math.sin(ang) * 14, '#fff4c0', 0); } break;
  }
}
