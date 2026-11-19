// 🏡 RÖDA STUGAN PÅ SOLÖN inifrån (Carl 2026-11-18: "sommarstuga på ön"). Ett enda rum, 384 px brett, ingen rullning.
// Väggen (y < 76): furupanel, dörren UT med krokar och regnjackan, skylten RÖDA STUGAN, hyllan med burkar, snäckor och
// skeppet i flaskan, fotot på fyrvaktaren Hulda, det stora FÖNSTRET mot havet (utsikten ritas levande av scenen:
// vågor, segelbåten, måsarna, fyren om natten), rutiga gardiner, väggklockan, fotogenlampan, nätet med flöten och
// VERANDADÖRREN i glas. Golvet: breda plankor, trasmattan, sängen med lapptäcket, nattduksbordet, KAMINEN med
// vedkorgen, bordet med stolar, kaffepanna och gästbok, bänken under fönstret, bokhyllan, gungstolen, filtkorgen och
// stövlarna vid dörren. Det stillastående målas en gång (paintStugaBg); elden, lampans sken och utsikten varje bildruta.
import { Pix, SMALL, text, textW, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { PENNOR, FARGER } from '../tassbacken/hus.js';
import { bokrad, vaggklocka } from '../tassbacken/inne-kit.js';
import { $t } from '../core/i18n.js';

const { tone, fyll, spr } = PENNOR;
const { VIT, MASS, JARN, TRA, RODT, BLA, SAND, BLAD } = FARGER;
const FURU = [0x8a6232, 0xb8864a, 0xd8a862, 0xe8c080, 0xf4d8a0];
const PLANK = [0x6a4a28, 0x8a6236, 0xa87848, 0xc09258, 0xd4a868];
const STUGA = {
  W: 384, H: 216, WALL_Y: 76,
  DOOR: { x0: 14, x1: 46 },
  FONSTER: { x0: 150, x1: 250, y0: 12, y1: 58 },
  VERANDA: { x0: 312, x1: 348 },
  HYLLA: { x0: 60, x1: 132 },
  SANG: { x: 56, y: 136 },           // sängens fot (mitten)
  NATTBORD: { x: 100, y: 128 },
  KAMIN: { x: 130, y: 112 },
  VEDKORG: { x: 154, y: 110 },
  BANK: { x: 200, y: 88 },           // bänken under fönstret
  BORD: { x: 230, y: 160 },
  BOKHYLLA: { x: 296, y: 108 },
  GUNGSTOL: { x: 344, y: 160 },
  FILTKORG: { x: 60, y: 196 },
  STOVLAR: { x: 24, y: 92 },
  SPO: { x: 372, y: 104 },
  LAMPA: { x: 286, y: 10 },
  KLOCKA: { x: 272, y: 26 },
  MATTA: { x: 200, y: 170, rx: 56, ry: 22 },
};
export { STUGA };
const { W, H, WALL_Y, DOOR, FONSTER, VERANDA, HYLLA, LAMPA, KLOCKA, MATTA } = STUGA;

let BG = null;
export function paintStugaBg() {
  if (BG) return BG;
  const P = new Pix(W, H);
  // furupanelen: liggande brädor med kvistar, en list vid taket och en vid golvet
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < W; x++) P.px(x, y, y % 8 === 7 ? FURU[0] : tone(FURU, 0.55 + (hash(x >> 3, y >> 3, 3) - 0.5) * 0.12 + (y % 8 === 0 ? 0.12 : 0) - y * 0.001, x, y));
  for (let k = 0; k < 18; k++) { const kx = (hash(k, 1, 4) * W) | 0, ky = ((hash(k, 2, 4) * WALL_Y) | 0); P.px(kx, ky, FURU[0]); P.px(kx + 1, ky, FURU[1]); P.px(kx, ky + 1, FURU[1]); }   // kvistarna
  P.rect(0, 0, W, 3, FURU[1]); P.hl(0, 3, W, FURU[4]); P.rect(0, WALL_Y - 3, W, 3, PLANK[1]); P.hl(0, WALL_Y - 3, W, PLANK[3]);
  // dörren UT: blå dörr med fönster, krokar med regnjackan och sydvästen, skylten ovanför
  P.rect(DOOR.x0 - 3, 14, DOOR.x1 - DOOR.x0 + 6, WALL_Y - 14, VIT[2]);
  for (let y = 16; y < WALL_Y; y++) for (let x = DOOR.x0; x < DOOR.x1; x++) P.px(x, y, tone(BLA, 0.5 + (((x - DOOR.x0) % 8 === 0) ? -0.15 : 0) + (hash(x >> 2, y, 3) - 0.5) * 0.08, x, y));
  P.rect(DOOR.x0 + 7, 20, 18, 14, 0xb8e4f4); P.box(DOOR.x0 + 7, 20, 18, 14, VIT[3]); P.vl(DOOR.x0 + 16, 20, 14, VIT[3]);
  P.rect(DOOR.x0 + 6, 40, 20, 9, 0x1d2b1f); text(P, SMALL, $t('UT'), DOOR.x0 + 12, 42, 0x6fe08a);
  P.px(DOOR.x1 - 5, 50, MASS[3]); P.px(DOOR.x1 - 5, 51, MASS[2]);
  { const s = $t('RÖDA STUGAN'), tw = textW(SMALL, s); P.rect(30 - (tw >> 1) - 4, 4, tw + 8, 9, 0xa8382a); P.box(30 - (tw >> 1) - 4, 4, tw + 8, 9, 0xd8343c); text(P, SMALL, s, 30 - (tw >> 1), 6, 0xf4f1ea); }
  P.rect(50, 18, 2, 2, JARN[3]); P.rect(50, 20, 1, 2, JARN[2]); fyll(P, 48, 22, 55, 44, (X, Y) => tone([0xa88020, 0xd8a830, 0xf0c030, 0xf8d860, 0xffe890], 0.55 - (X - 48) * 0.05 + (Y === 22 ? 0.2 : 0), X, Y)); P.px(51, 26, 0x8a6a10);   // regnjackan
  P.rect(56, 16, 2, 2, JARN[3]); for (let j = 0; j < 5; j++) P.hl(54 - j, 22 + j, 7 + j * 2, 0xf0c030); P.hl(52, 27, 12, 0xd8a830);   // sydvästen
  // hyllan: burkar, snäckor, skeppet i flaskan, fotot på Hulda
  P.hl(HYLLA.x0, 36, HYLLA.x1 - HYLLA.x0, FURU[4]); P.hl(HYLLA.x0, 37, HYLLA.x1 - HYLLA.x0, FURU[1]); P.hl(HYLLA.x0, 38, HYLLA.x1 - HYLLA.x0, 0x000000, 0.15);
  P.px(HYLLA.x0 + 2, 39, FURU[1]); P.px(HYLLA.x1 - 3, 39, FURU[1]); P.px(HYLLA.x0 + 2, 40, FURU[1]); P.px(HYLLA.x1 - 3, 40, FURU[1]);
  for (let k = 0; k < 3; k++) { const bx = HYLLA.x0 + 3 + k * 7, c = [0xd8a050, 0xe04848, 0x8a5a30][k]; fyll(P, bx, 27, bx + 4, 35, (X, Y) => (Y === 27 ? 0xd8d4c8 : X === bx ? mix(c, 0xffffff, 0.35) : X === bx + 4 ? mul(c, 0.7) : c)); P.px(bx + 1, 31, mix(c, 0xffffff, 0.5)); }   // syltburkar
  for (let k = 0; k < 4; k++) { const sx = HYLLA.x0 + 27 + k * 6; P.px(sx, 34, 0xf8e0d0); P.px(sx + 1, 34, 0xf0c8b8); P.px(sx + 1, 33, 0xf8e0d0); P.px(sx + 2, 35, 0xe8b8a8); }   // snäckor
  fyll(P, HYLLA.x0 + 50, 28, HYLLA.x0 + 70, 35, (X, Y) => { const d = Math.hypot((X - HYLLA.x0 - 60) / 10.5, (Y - 31.5) / 3.8); return d > 1 ? null : d > 0.85 ? 0x9ad8f0 : 0xc8ecf8; }); P.rect(HYLLA.x0 + 70, 30, 3, 3, 0x8a5a30); P.rect(HYLLA.x0 + 56, 29, 1, 5, 0x5a3a20); P.rect(HYLLA.x0 + 57, 29, 3, 3, 0xf4f1ea); P.rect(HYLLA.x0 + 54, 33, 11, 1, 0x3a2214);   // skeppet i flaskan
  P.rect(62, 50, 14, 16, 0x5a3a20); P.rect(63, 51, 12, 14, 0xd8d0c0); spr(P, 66, 53, ['.hhh.', 'hhhhh', 'hssh.', '.sss.', '.kkk.', 'kkkkk'], { h: 0xe8e4da, s: 0xf0cfae, k: 0x2a3a5a });   // Hulda
  P.rect(80, 52, 36, 12, 0xf4f1ea); P.hl(84, 56, 28, 0x5a4632, 0.6); P.hl(84, 59, 20, 0x5a4632, 0.6);   // ett sjökort
  // fönstret mot havet: karm, rutiga gardiner, fönsterbrädan med en kruka (utsikten ritas av scenen)
  const F = FONSTER;
  P.rect(F.x0 - 4, F.y0 - 4, F.x1 - F.x0 + 8, F.y1 - F.y0 + 8, VIT[3]); P.hl(F.x0 - 4, F.y0 - 4, F.x1 - F.x0 + 8, VIT[4]); P.vl(F.x1 + 3, F.y0 - 4, F.y1 - F.y0 + 8, VIT[1]);
  for (const [gx, s] of [[F.x0 - 4, 1], [F.x1 + 3, -1]]) for (let y = F.y0 - 2; y < F.y1 + 2; y++) { const w = 9 + Math.round(Math.sin(y / 4) * 1.5); for (let i = 0; i < w; i++) { const X = gx + s * i; P.px(X, y, ((i >> 1) + (y >> 1)) & 1 ? 0xd8343c : 0xf4f1ea); } }
  P.hl(F.x0 - 14, F.y0 - 5, F.x1 - F.x0 + 28, JARN[2]); P.px(F.x0 - 15, F.y0 - 5, MASS[3]); P.px(F.x1 + 14, F.y0 - 5, MASS[3]);
  P.hl(F.x0 - 6, F.y1 + 4, F.x1 - F.x0 + 12, VIT[4]); P.hl(F.x0 - 6, F.y1 + 5, F.x1 - F.x0 + 12, VIT[1]);
  PENNOR.kruka(P, F.x0 + 10, F.y1 + 3, 0xe04848); PENNOR.kruka(P, F.x1 - 18, F.y1 + 3, 0x3a7bd5);
  // väggklockan, fotogenlampan på kroken, nätet med korkflöten
  vaggklocka(P, KLOCKA.x, KLOCKA.y, 6, MASS);
  P.vl(LAMPA.x, LAMPA.y, 6, JARN[2]); P.rect(LAMPA.x - 4, LAMPA.y + 6, 9, 3, MASS[2]); P.rect(LAMPA.x - 3, LAMPA.y + 9, 7, 9, 0xd8e8f0); P.rect(LAMPA.x - 1, LAMPA.y + 11, 3, 5, 0xf0c030); P.rect(LAMPA.x - 3, LAMPA.y + 18, 7, 2, MASS[1]); P.rect(LAMPA.x - 2, LAMPA.y + 20, 5, 3, MASS[2]);
  for (let i = 0; i < 40; i++) for (let j = 0; j < 22; j++) { const sag = Math.round(Math.sin(i / 40 * Math.PI) * 6); if ((i + j) % 3 === 0 && j < 16 + sag) P.px(258 + i, 44 + j + sag, 0x8aa0a8, 0.8); }
  for (let k = 0; k < 5; k++) P.rect(260 + k * 9, 46 + (k % 2) * 4, 3, 3, 0xd8a050);
  // verandadörren: glas med spröjs, utanför syns verandans räcke och havet (ritas levande av scenen)
  P.rect(VERANDA.x0 - 3, 10, VERANDA.x1 - VERANDA.x0 + 6, WALL_Y - 10, VIT[2]); P.rect(VERANDA.x0 - 2, 11, VERANDA.x1 - VERANDA.x0 + 4, WALL_Y - 11, TRA[3]);
  P.px(VERANDA.x0 + 3, 46, MASS[3]); P.px(VERANDA.x0 + 3, 47, MASS[2]);
  // golvet: breda plankor med spikar, trasmattan, dörrmattan
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) { const row = ((y - WALL_Y) / 10) | 0, off = (hash(row, 1, 7) * 50) | 0; let c = tone(PLANK, 0.5 + (hash(((x + off) / 50) | 0, row, 9) - 0.5) * 0.14 + (hash(x >> 1, y >> 1, 8) - 0.5) * 0.06, x, y); if ((y - WALL_Y) % 10 === 9) c = mul(c, 0.78); else if ((x + off) % 50 === 0) c = mul(c, 0.8); P.px(x, y, c); }
  for (let i = 0; i < 5; i++) P.darken(0, WALL_Y + i, W, 1, 0.78 + i * 0.045);
  for (let y = -MATTA.ry; y <= MATTA.ry; y++) for (let x = -MATTA.rx; x <= MATTA.rx; x++) { const d = Math.hypot(x / MATTA.rx, y / MATTA.ry); if (d > 1) continue; const ring = Math.floor(d * 7); P.px(MATTA.x + x, MATTA.y + y, [0xd8343c, 0xf4ecd8, 0x3a7bd5, 0xf0c030, 0xf4ecd8, 0x46a35a, 0xf4ecd8][ring % 7]); }
  for (let y = WALL_Y + 4; y < WALL_Y + 14; y++) for (let x = DOOR.x0 - 4; x < DOOR.x1 + 4; x++) P.px(x, y, (x + y) % 2 ? 0x8a5a30 : 0x6a4424);
  P.box(0, 0, W, H, 0x0e0d12);
  BG = P.flush();
  return BG;
}

// ---------- utsikten (varje bildruta): himmel, hav med vågor, segelbåten, måsarna, fyren om natten ----------
export function ritaUtsikt(ctx, t, natt, kvall) {
  const F = FONSTER, w = F.x1 - F.x0, h = F.y1 - F.y0;
  const sky = natt ? ['#0e1a3a', '#1e2e5a'] : kvall ? ['#f0a060', '#f8d0a0'] : ['#8ad0f8', '#c8e8fc'], sea = natt ? ['#102a48', '#1a3a5a'] : kvall ? ['#2a5a8a', '#4a7aa8'] : ['#2a7ab8', '#4aa0d8'];
  const g = ctx.createLinearGradient(0, F.y0, 0, F.y0 + h * 0.5); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); ctx.fillStyle = g; ctx.fillRect(F.x0, F.y0, w, Math.round(h * 0.5));
  const g2 = ctx.createLinearGradient(0, F.y0 + h * 0.5, 0, F.y1); g2.addColorStop(0, sea[0]); g2.addColorStop(1, sea[1]); ctx.fillStyle = g2; ctx.fillRect(F.x0, F.y0 + Math.round(h * 0.5), w, h - Math.round(h * 0.5));
  if (natt) { ctx.fillStyle = '#fff6d0'; ctx.fillRect(F.x0 + 70, F.y0 + 6, 5, 5); ctx.fillStyle = sky[0]; ctx.fillRect(F.x0 + 72, F.y0 + 5, 4, 5); for (let k = 0; k < 10; k++) { ctx.fillStyle = (Math.floor(t * 2 + k) % 5) ? '#f4f1ea' : sky[1]; ctx.fillRect(F.x0 + 4 + ((hash(k, 1, 5) * (w - 8)) | 0), F.y0 + 2 + ((hash(k, 2, 5) * 16) | 0), 1, 1); } }
  else if (!kvall) for (let k = 0; k < 2; k++) { const cx = F.x0 + ((t * 2 + k * 50) % (w + 30)) - 15; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(cx, F.y0 + 5 + k * 7, 14, 3); ctx.fillRect(cx + 3, F.y0 + 3 + k * 7, 7, 2); }
  else { ctx.fillStyle = '#ffd880'; ctx.fillRect(F.x0 + 60, F.y0 + 14, 6, 6); ctx.fillStyle = 'rgba(255,220,140,.4)'; ctx.fillRect(F.x0 + 40, F.y0 + 24, 46, 1); }
  for (let k = 0; k < 14; k++) { const u = (t * 0.08 + hash(k, 3, 6)) % 1, x = F.x0 + u * w, y = F.y0 + h * 0.5 + 2 + hash(k, 4, 6) * (h * 0.5 - 4), a = 0.3 + Math.sin(t * 2 + k) * 0.25; if (a > 0.1) { ctx.fillStyle = `rgba(${natt ? '160,190,230' : '230,245,255'},${a.toFixed(2)})`; ctx.fillRect(Math.round(x), Math.round(y), 3 + Math.round(a * 3), 1); } }
  // segelbåten glider förbi vid horisonten, en fiskebåt i andra riktningen; fyren blinkar om natten
  const bx = F.x0 + ((t * 1.5) % (w + 40)) - 20, by = F.y0 + Math.round(h * 0.5) - 1 + Math.round(Math.sin(t * 1.3));
  if (bx > F.x0 - 10 && bx < F.x1 + 10) { ctx.save(); ctx.beginPath(); ctx.rect(F.x0, F.y0, w, h); ctx.clip(); ctx.fillStyle = natt ? '#1a2a44' : '#f4f1ea'; ctx.fillRect(bx - 6, by, 12, 2); ctx.fillStyle = natt ? '#2a3a5a' : '#2a5aa8'; ctx.fillRect(bx - 6, by + 2, 12, 1); ctx.fillStyle = natt ? '#3a4a6a' : '#ffffff'; for (let j = 0; j < 9; j++) ctx.fillRect(bx, by - 9 + j, Math.max(1, Math.round(j * 0.6)), 1); ctx.restore(); }
  if (natt) { const on = Math.floor(t * 1.2) % 4 === 0; ctx.fillStyle = on ? '#fff0a0' : '#8a8a94'; ctx.fillRect(F.x1 - 12, F.y0 + Math.round(h * 0.5) - 6, 2, 6); if (on) { ctx.fillStyle = 'rgba(255,240,160,.5)'; ctx.fillRect(F.x1 - 15, F.y0 + Math.round(h * 0.5) - 8, 8, 3); } }
  else for (let k = 0; k < 2; k++) { const gx = F.x0 + ((t * 9 + k * 60) % (w + 20)) - 10, gy = F.y0 + 10 + k * 8 + Math.round(Math.sin(t * 2 + k) * 2), up = Math.sin(t * 10 + k) > 0; ctx.fillStyle = '#f4f1ea'; ctx.fillRect(gx - 3, gy - (up ? 1 : 0), 3, 1); ctx.fillRect(gx + 1, gy - (up ? 1 : 0), 3, 1); ctx.fillRect(gx, gy, 1, 1); }
  // verandadörrens glas: räcket och havet utanför
  const V = VERANDA, vw = V.x1 - V.x0;
  ctx.fillStyle = sky[1]; ctx.fillRect(V.x0, 12, vw, 20); ctx.fillStyle = sea[1]; ctx.fillRect(V.x0, 32, vw, 14); ctx.fillStyle = natt ? '#2a2a32' : '#f4f1ea'; ctx.fillRect(V.x0, 44, vw, 2); for (let x = V.x0 + 2; x < V.x1; x += 6) ctx.fillRect(x, 46, 1, 10); ctx.fillStyle = natt ? '#4a3a2a' : '#c09258'; ctx.fillRect(V.x0, 56, vw, WALL_Y - 56 - 1);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(V.x0 + (vw >> 1), 11, 1, WALL_Y - 12); ctx.fillRect(V.x0, 30, vw, 1); ctx.fillRect(V.x0, 50, vw, 1);
}

// ---------- golvsakerna (cachade bilder, origo = foten) ----------
const S = new Map();
function bild(key, w, h, ax, ay, fn) { if (S.has(key)) return S.get(key); const P = new Pix(w, h, -ax, -ay); fn(P); const s = { img: P.flush(), ax, ay }; S.set(key, s); return s; }
const put = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
const skugga = (ctx, x, y, w) => { ctx.fillStyle = 'rgba(20,12,30,.24)'; ctx.fillRect(Math.round(x - w / 2), Math.round(y) - 1, Math.round(w), 3); };
export function ritaSang(ctx, x, y, sover = false, t = 0) {
  skugga(ctx, x, y, 66);
  put(ctx, bild('sang', 76, 54, 38, 50, (P) => {
    P.rect(-32, -40, 64, 6, TRA[2]); P.hl(-32, -40, 64, TRA[4]); for (let i = -30; i < 32; i += 8) P.rect(i, -39, 3, 4, TRA[3]);   // huvudgaveln
    fyll(P, -31, -34, 31, -4, (X, Y) => { const i = Math.floor((X + 31) / 8), j = Math.floor((Y + 34) / 8); const c = [0xd8343c, 0xf4ecd8, 0x3a7bd5, 0xf0c030][(i + j) % 4]; return (X + 31) % 8 === 0 || (Y + 34) % 8 === 0 ? mul(c, 0.8) : c; });   // lapptäcket
    P.rect(-31, -34, 62, 8, 0xf4f1ea); P.hl(-31, -27, 62, 0xd8d4c8); P.rect(-26, -33, 18, 6, 0xf8f4e8); P.rect(8, -33, 18, 6, 0xf8f4e8);   // lakanet och kuddarna
    P.rect(-33, -4, 66, 4, TRA[1]); P.hl(-33, -4, 66, TRA[3]); P.rect(-33, 0, 3, 2, TRA[0]); P.rect(30, 0, 3, 2, TRA[0]);
  }), x, y);
  if (sover) { ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 8, y - 33, 6, 1); for (let k = 0; k < 3; k++) { const u = (t * 0.5 + k / 3) % 1; ctx.fillStyle = `rgba(244,241,234,${(1 - u).toFixed(2)})`; ctx.fillRect(x + 10 + k * 3, y - 40 - u * 14, 2, 2); } }
}
export function ritaNattbord(ctx, x, y, natt) { skugga(ctx, x, y, 14); put(ctx, bild('nattbord|' + natt, 20, 30, 10, 28, (P) => { P.rect(-7, -16, 14, 2, TRA[3]); P.hl(-7, -16, 14, TRA[4]); P.rect(-6, -14, 12, 14, TRA[2]); P.rect(-4, -11, 8, 5, TRA[3]); P.px(0, -9, MASS[3]); P.rect(-1, -23, 3, 6, 0xf4f1ea); P.px(0, -24, natt ? 0xffe060 : 0x3a2a2a); P.rect(3, -19, 4, 3, 0x3a7bd5); }), x, y); }
export function ritaKamin(ctx, x, y, t, eld = true) {
  skugga(ctx, x, y, 26);
  put(ctx, bild('kamin', 34, 60, 17, 56, (P) => {
    P.rect(-4, -54, 8, 22, JARN[1]); P.vl(-4, -54, 22, JARN[2]); P.rect(-6, -56, 12, 3, JARN[2]);   // röret
    fyll(P, -11, -32, 10, -2, (X, Y) => (Y === -32 ? JARN[3] : X === -11 ? JARN[2] : X === 10 ? JARN[0] : JARN[1]));
    P.rect(-8, -26, 16, 12, 0x0a0608); P.box(-8, -26, 16, 12, JARN[3]); P.px(6, -21, MASS[3]);   // luckan
    P.rect(-9, -11, 18, 4, JARN[2]); for (let i = -7; i < 8; i += 3) P.px(i, -10, JARN[0]);
    P.rect(-10, -2, 5, 2, JARN[0]); P.rect(5, -2, 5, 2, JARN[0]);
    P.rect(-4, -38, 8, 6, JARN[2]); P.rect(-5, -40, 10, 2, JARN[3]); P.px(5, -36, JARN[3]); P.px(6, -37, JARN[3]);   // kaffepannan på plattan
  }), x, y);
  if (eld) { const R = (c, px, py, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(px), Math.round(py), w, h); }; for (let k = 0; k < 5; k++) { const ph = t * 7 + k * 1.3, hh = 3 + Math.round(Math.sin(ph) * 1.5 + Math.sin(ph * 2.3)), fx = x - 5 + k * 2; for (let j = 0; j < hh; j++) R(j < hh - 2 ? '#ffe060' : '#ff8a20', fx, y - 17 - j, 2, 1); } R('#ff6a20', x - 6, y - 16, 12, 1); const g = ctx.createRadialGradient(x, y - 20, 1, x, y - 20, 26); g.addColorStop(0, 'rgba(255,150,60,.3)'); g.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = g; ctx.fillRect(x - 26, y - 46, 52, 52); if (Math.floor(t * 3) % 2) R('rgba(255,255,255,.5)', x + 2, y - 44 - (Math.floor(t * 5) % 3), 1, 2); }
}
export function ritaVedkorg(ctx, x, y) { skugga(ctx, x, y, 16); put(ctx, bild('ved', 22, 18, 11, 16, (P) => { fyll(P, -9, -10, 9, 0, (X, Y) => (Y === -10 ? 0xd8a860 : ((X + Y) % 3 === 0 ? 0x8a6236 : 0xb8864a))); for (let k = 0; k < 4; k++) { P.rect(-7 + k * 4, -14 + (k % 2), 3, 5, 0x6a4a28); P.px(-6 + k * 4, -13 + (k % 2), 0xd8b890); } }), x, y); }
export function ritaBank(ctx, x, y) { skugga(ctx, x, y, 60); put(ctx, bild('bank', 68, 20, 34, 18, (P) => { P.rect(-30, -14, 60, 4, TRA[3]); P.hl(-30, -14, 60, TRA[4]); for (const kx of [-28, 26]) P.rect(kx, -10, 3, 10, TRA[1]); P.rect(-26, -17, 20, 4, 0xd8343c); P.hl(-26, -17, 20, 0xf07a7a); P.rect(4, -17, 20, 4, 0x3a7bd5); P.hl(4, -17, 20, 0x8ab4e8); P.rect(-12, -19, 10, 3, 0xf0c030); }), x, y); }
export function ritaBord(ctx, x, y, kaffe = true) {
  skugga(ctx, x, y, 52);
  for (const s of [-1, 1]) put(ctx, bild('stuga-stol', 12, 22, 6, 20, (P) => { P.rect(-4, -19, 8, 10, TRA[3]); P.hl(-4, -19, 8, TRA[4]); P.vl(-2, -18, 8, TRA[1]); P.vl(1, -18, 8, TRA[1]); P.rect(-4, -9, 8, 2, 0xd8343c); P.vl(-4, -7, 7, TRA[1]); P.vl(3, -7, 7, TRA[1]); }), x + s * 22, y + 2);
  put(ctx, bild('stuga-bord|' + kaffe, 52, 32, 26, 30, (P) => {
    P.rect(-20, -18, 40, 3, TRA[3]); P.hl(-20, -18, 40, TRA[4]); P.hl(-20, -15, 40, TRA[1]); for (const kx of [-18, 16]) P.rect(kx, -15, 2, 15, TRA[1]);
    fyll(P, -18, -20, 17, -18, (X) => ((X >> 2) & 1 ? 0xd8343c : 0xf4ecd8));   // duken
    if (kaffe) { P.rect(-12, -27, 8, 7, 0x2a2a30); P.hl(-12, -27, 8, 0x5a5a62); P.px(-4, -24, 0x5a5a62); P.rect(-10, -29, 4, 2, 0x2a2a30); P.rect(0, -24, 4, 4, 0xf4f1ea); P.px(4, -23, 0xf4f1ea); P.rect(7, -24, 4, 4, 0x3a7bd5); P.px(11, -23, 0x3a7bd5); P.rect(-2, -26, 7, 2, 0xd8a050); }
    P.rect(10, -22, 8, 3, 0x5a3a20); P.hl(10, -22, 8, 0x8a5a30); P.px(14, -21, 0xf4f1ea);   // gästboken
  }), x, y);
}
export function ritaBokhylla(ctx, x, y) { skugga(ctx, x, y, 30); put(ctx, bild('stuga-hylla', 36, 46, 18, 44, (P) => { fyll(P, -15, -42, 15, 0, (X, Y) => (X === -15 || X === 15 || Y === -42 ? TRA[1] : TRA[2])); for (const hy of [-28, -14, 0]) { P.hl(-14, hy, 29, TRA[4]); P.hl(-14, hy + 1, 29, TRA[0], 0.5); } bokrad(P, -13, -28, 27, 2); bokrad(P, -13, -14, 27, 5); P.rect(-12, -8, 6, 7, 0xf4f1ea); P.rect(-4, -6, 5, 5, 0xd8a050); P.px(4, -5, 0xf0c030); }), x, y); }
export function ritaGungstol(ctx, x, y, t) { const g = Math.round(Math.sin(t * 1.4) * 1); skugga(ctx, x, y, 22); put(ctx, bild('gungstol', 28, 36, 14, 34, (P) => { P.rect(-8, -30, 2, 20, TRA[1]); P.rect(8, -30, 2, 20, TRA[1]); for (let j = 0; j < 6; j++) P.hl(-8, -29 + j * 3, 18, TRA[3]); P.rect(-10, -12, 22, 4, TRA[2]); P.hl(-10, -12, 22, TRA[4]); P.rect(-9, -14, 20, 2, 0x3a7bd5); P.vl(-9, -8, 7, TRA[1]); P.vl(10, -8, 7, TRA[1]); for (let i = -13; i < 14; i++) P.px(i, -1 + Math.round(Math.abs(i) / 13 * -2), TRA[1]); }), x, y + g); }
export function ritaFiltkorg(ctx, x, y) { skugga(ctx, x, y, 16); put(ctx, bild('filtkorg', 22, 20, 11, 18, (P) => { fyll(P, -9, -10, 9, 0, (X, Y) => ((X + Y) % 3 === 0 ? 0x8a6236 : 0xb8864a)); P.hl(-9, -10, 19, 0xd8a860); P.rect(-7, -15, 14, 5, 0xd8343c); P.hl(-7, -15, 14, 0xf07a7a); P.rect(-5, -18, 10, 3, 0x3a7bd5); P.hl(-5, -18, 10, 0x8ab4e8); }), x, y); }
export function ritaStovlar(ctx, x, y) { for (const dx of [-5, 2]) { ctx.fillStyle = '#2a5a2a'; ctx.fillRect(x + dx, y - 10, 4, 10); ctx.fillRect(x + dx, y - 3, 7, 3); ctx.fillStyle = '#4a8a4a'; ctx.fillRect(x + dx, y - 10, 1, 9); } }
export function ritaSpo(ctx, x, y) { for (let j = 0; j < 40; j++) { ctx.fillStyle = j > 34 ? '#6a4a28' : '#c8a060'; ctx.fillRect(x - Math.round(j * 0.15), y - j, 1, 1); } ctx.fillStyle = '#3a3a42'; ctx.fillRect(x - 2, y - 30, 3, 3); }
export function ritaLampsken(ctx, natt) { if (!natt) return; const g = ctx.createRadialGradient(LAMPA.x, LAMPA.y + 14, 2, LAMPA.x, LAMPA.y + 14, 60); g.addColorStop(0, 'rgba(255,220,140,.45)'); g.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = g; ctx.fillRect(LAMPA.x - 60, LAMPA.y - 46, 120, 120); }
