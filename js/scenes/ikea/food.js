// MÖBELJÄTTEN – restaurangen: menyn, handritade rätter i skala 1 (på tallrik),
// brickan, serveringslinjen, bord och stolar.
import { Pix, SMALL, BIG, text, textW, mix, mul, hash, bayer } from '../../core/floor-pix.js';

export const MENU = [
  { id: 'kottbullar', name: 'Köttbullar med mos och lingonsylt', short: 'KÖTTBULLAR', sub: 'MED MOS OCH LINGON', price: 59, fill: 45, icon: '🍝' },
  { id: 'korv', name: 'Korv med bröd', short: 'KORV MED BRÖD', price: 15, fill: 15, icon: '🌭' },
  { id: 'bulle', name: 'Kanelbulle', short: 'KANELBULLE', price: 12, fill: 10, icon: '🥐' },
  { id: 'kaffe', name: 'Kaffe (påtår ingår)', short: 'KAFFE', price: 10, fill: 3, energy: 6, icon: '☕' },
  { id: 'saft', name: 'Lingonsaft', short: 'SAFT', price: 5, fill: 4, icon: '🧃' },
];
export const menuOf = (id) => MENU.find((m) => m.id === id);

const memo = new Map();
const once = (key, make) => { if (!memo.has(key)) memo.set(key, make()); return memo.get(key); };
const disk = (P, cx, cy, r, fn) => {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d < r) fn(x, y, d / r, x + 0.5 - cx, y + 0.5 - cy);
  }
};
const oval = (P, cx, cy, rx, ry, fn) => {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const t = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (t < 1) fn(x, y, t, x + 0.5 - cx, y + 0.5 - cy);
  }
};
// sel-out-kontur: mörk ton av grannpixeln runt det som målats
function outline(P) {
  const { w, h, d } = P;
  const src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (src[i + 3] > 30) continue;
    for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = (yy * w + xx) * 4;
      if (src[j + 3] < 200) continue;
      d[i] = src[j] * 0.35 + 18; d[i + 1] = src[j + 1] * 0.3 + 12; d[i + 2] = src[j + 2] * 0.35 + 20; d[i + 3] = 255;
      break;
    }
  }
}
// tallrik (ellips) med matens mitt i (cx, cy)
function plate(P, cx, cy, rx, ry) {
  oval(P, cx, cy + 1, rx + 0.5, ry + 0.5, (x, y) => P.px(x, y, 0x1a1020, 0.25)); // skugga
  oval(P, cx, cy, rx, ry, (x, y, t, dx, dy) => P.px(x, y, t > 0.82 ? (dy < 0 ? 0xd6dce4 : 0xaeb6c2) : t > 0.7 ? 0xeef0f4 : dy < -0.5 ? 0xffffff : 0xfaf8f2));
}

// ---------- rätterna (left: 2 = hel, 1 = halväten, 0 = uppäten) ----------
function paintKottbullar(P, ox, oy, left) {
  plate(P, ox + 10, oy + 8, 9.5, 3.4);
  if (left === 0) { // smulor + lite sås och ett lingon kvar
    P.px(ox + 8, oy + 8, 0xb8844a); P.px(ox + 9, oy + 8, 0xa8743a); P.px(ox + 13, oy + 9, 0xc4142c); P.px(ox + 6, oy + 7, 0xf2dc98);
    P.rect(ox + 14, oy + 6, 3, 1, 0xc8ccd2); P.px(ox + 17, oy + 7, 0xc8ccd2); // gaffeln
    return;
  }
  // gräddsås
  oval(P, ox + 12.5, oy + 7.5, 5.5, 2.2, (x, y, t) => P.px(x, y, t > 0.8 ? 0xa06a34 : 0xc08a4c));
  // potatismos (en rejäl klick) med smörklick och persilja
  const mashR = left === 2 ? 3.6 : 2.6;
  oval(P, ox + 5.5, oy + 6.4, mashR, mashR * 0.8, (x, y, t, dx, dy) => P.px(x, y, dy < -1 ? 0xffffff : t > 0.75 ? 0xe8cf8a : dx > 1 ? 0xf2dc98 : 0xfbeab8));
  if (left === 2) { P.px(ox + 5, oy + 4, 0xffd23f); P.px(ox + 4, oy + 5, 0x4aa040); P.px(ox + 7, oy + 5, 0x3a8a34); }
  // köttbullar
  const balls = left === 2 ? [[10, 5], [13.5, 4.6], [16.5, 6], [11.5, 7.8], [15, 8.2], [9, 8]] : [[12, 6], [15.5, 7.4]];
  for (const [bx, by] of balls) disk(P, ox + bx, oy + by, 1.9, (x, y, t, dx, dy) => P.px(x, y, dx < -0.2 && dy < -0.2 ? 0xb8703a : t > 0.7 ? 0x4e2610 : dx > 0.5 || dy > 0.5 ? 0x6a3416 : 0x86461e));
  // lingonsylt framtill
  const lin = left === 2 ? [[6, 9], [7, 9], [8, 9], [7, 10], [8, 10], [9, 10], [6, 10], [9, 9]] : [[7, 9], [8, 9], [8, 10]];
  for (const [lx, ly] of lin) P.px(ox + lx, oy + ly, (lx + ly) % 3 === 0 ? 0x8a0a1e : 0xc4142c);
  P.px(ox + 7, oy + 9, 0xff6a78);
}
function paintKorv(P, ox, oy, left) {
  // servett
  P.rect(ox + 2, oy + 7, 16, 4, 0xf4f1ea); P.hl(ox + 2, oy + 10, 16, 0xd8d2c6); P.px(ox + 3, oy + 7, 0xffffff);
  if (left === 0) { P.px(ox + 7, oy + 8, 0xe0a860); P.px(ox + 11, oy + 9, 0xf2c230); P.px(ox + 12, oy + 8, 0xe0a860); return; }
  const len = left === 2 ? 14 : 8, x0 = ox + 3;
  // korven sticker ut
  P.rect(x0 - 1, oy + 5, len + 2, 2, 0xb8452a); P.hl(x0 - 1, oy + 5, len + 2, 0xe07050); P.px(x0 - 1, oy + 6, 0x7a2a18); P.px(x0 + len, oy + 6, 0x7a2a18);
  // brödet
  P.rect(x0, oy + 6, len, 3, 0xe0a860); P.hl(x0, oy + 6, len, 0xf0c888); P.hl(x0, oy + 8, len, 0xa87038);
  P.rect(x0 + 1, oy + 3, len - 2, 2, 0xe8b470); P.hl(x0 + 1, oy + 3, len - 2, 0xf6d49a);
  // senap i sicksack + ketchup
  for (let i = 0; i < len - 2; i++) P.px(x0 + 1 + i, oy + 4 + (i & 1), 0xf2c230);
  if (left === 2) for (let i = 1; i < len - 3; i += 3) P.px(x0 + 1 + i, oy + 5, 0xd8231e);
}
function paintBulle(P, ox, oy, left) {
  plate(P, ox + 10, oy + 8, 6.5, 2.4);
  if (left === 0) { P.px(ox + 9, oy + 8, 0xc88a4a); P.px(ox + 11, oy + 7, 0xffffff); P.px(ox + 12, oy + 8, 0xa86a34); return; }
  const r = left === 2 ? 4.2 : 3;
  oval(P, ox + 10, oy + 6, r, r * 0.72, (x, y, t, dx, dy) => {
    const ang = Math.atan2(dy, dx), rr = Math.hypot(dx, dy);
    const sw = Math.sin(ang * 1 + rr * 2.2) > 0.45;
    P.px(x, y, t > 0.8 ? 0x8a4a1e : dy < -1.2 ? 0xe0a860 : sw ? 0x8a4a1e : 0xc88a4a);
  });
  if (left === 2) for (const [dx, dy] of [[-2, -2], [1, -2], [3, -1], [-1, 0], [2, 1], [-3, 0]]) P.px(ox + 10 + dx, oy + 6 + dy, 0xffffff);
}
function paintKaffe(P, ox, oy, left) {
  oval(P, ox + 10, oy + 9, 5, 1.6, (x, y, t) => P.px(x, y, t > 0.75 ? 0xaeb6c2 : 0xf6f4ee)); // fat
  P.rect(ox + 7, oy + 3, 6, 6, 0xfaf8f2); P.vl(ox + 12, oy + 3, 6, 0xd6dce4); P.vl(ox + 7, oy + 3, 6, 0xffffff);
  P.hl(ox + 7, oy + 8, 6, 0xc8ccd2);
  P.px(ox + 13, oy + 4, 0xd6dce4); P.px(ox + 14, oy + 5, 0xd6dce4); P.px(ox + 13, oy + 6, 0xd6dce4); // öra
  P.hl(ox + 7, oy + 3, 6, left ? 0x4a2a14 : 0x8a6a4a); P.px(ox + 8, oy + 3, left ? 0x6a4a2a : 0xa88a6a);
  if (left === 2) { P.px(ox + 9, oy + 1, 0xffffff, 0.6); P.px(ox + 10, oy + 0, 0xffffff, 0.45); P.px(ox + 11, oy + 1, 0xffffff, 0.5); }
}
function paintSaft(P, ox, oy, left) {
  // glas med lingonsaft och sugrör
  P.rect(ox + 8, oy + 1, 5, 9, 0xe8f6fa, 0.5); P.vl(ox + 8, oy + 1, 9, 0xcfe8f0); P.vl(ox + 12, oy + 1, 9, 0xaed0dc);
  P.hl(ox + 8, oy + 10, 5, 0xaed0dc);
  const lvl = left === 2 ? 3 : left === 1 ? 6 : 9;
  for (let y = oy + lvl; y < oy + 10; y++) P.hl(ox + 9, y, 3, y === oy + lvl ? 0xff8a6a : 0xd8303a);
  P.vl(ox + 11, oy - 2, 5, 0xffffff); P.px(ox + 11, oy - 1, 0xd8231e); P.px(ox + 11, oy + 1, 0xd8231e); P.px(ox + 12, oy - 2, 0xffffff);
}
const PAINT = { kottbullar: paintKottbullar, korv: paintKorv, bulle: paintBulle, kaffe: paintKaffe, saft: paintSaft };
export const DISH_W = 20, DISH_H = 12;
// en rätt i skala 1 (20×12), med kontur
export function dishImg(id, left = 2) {
  return once(`d:${id}:${left}`, () => {
    const P = new Pix(DISH_W + 2, DISH_H + 3);
    PAINT[id]?.(P, 1, 2, left);
    outline(P);
    return P.flush();
  });
}
// förstorad rätt till menyn i dialogen (canvas i skala s)
export function dishBig(id, s = 3) {
  const src = dishImg(id, 2), c = document.createElement('canvas');
  c.width = src.width * s; c.height = src.height * s;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// ---------- brickan ----------
// items: [id, …] (högst 4). left: 2/1/0. Brickan är 36×12, rätterna står på den.
const SLOT_ORDER = ['kottbullar', 'korv', 'bulle', 'kaffe', 'saft'];
export const TRAY_W = 38, TRAY_H = 22;
export function trayImg(items, left = 2) {
  const list = [...items].sort((a, b) => SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b)).slice(0, 4);
  return once(`t:${list.join(',')}:${left}`, () => {
    const c = document.createElement('canvas'); c.width = TRAY_W; c.height = TRAY_H;
    const x = c.getContext('2d');
    const P = new Pix(TRAY_W, TRAY_H);
    // brickan (brun plast, upphöjd kant)
    for (let y = 12; y < 21; y++) for (let xx = 1; xx < TRAY_W - 1; xx++) {
      let col = y === 12 || y === 20 || xx === 1 || xx === TRAY_W - 2 ? 0x5a3a20 : y === 13 ? 0xa87048 : mix(0x8a5a34, 0x7a4c2a, (y - 13) / 7);
      if ((y === 13 || y === 19) && (xx === 1 || xx === TRAY_W - 2)) col = 0x5a3a20;
      P.px(xx, y, col);
    }
    P.hl(2, 21, TRAY_W - 4, 0x000000, 0.25);
    P.hl(3, 14, 4, 0xc08a5a); // glans
    x.drawImage(P.flush(), 0, 0);
    // rätterna: stora rätter bak till vänster, småsaker till höger
    const big = list.filter((i) => i === 'kottbullar' || i === 'korv');
    const small = list.filter((i) => !big.includes(i));
    let px = 0;
    for (const id of big.slice(0, 1)) { x.drawImage(dishImg(id, left), px - 1, 3); px += 17; }
    const spots = big.length ? [[16, 4], [23, 6], [9, 7]] : [[0, 4], [9, 5], [18, 4], [24, 6]];
    const rest = [...big.slice(1), ...small];
    rest.forEach((id, i) => { const s = spots[i] || spots[spots.length - 1]; x.drawImage(dishImg(id, left), s[0] - 4, s[1] - 2); });
    return c;
  });
}

// ---------- serveringslinjen ----------
// brickstället med bestick (22×30)
export const trayStackImg = () => once('tstack', () => {
  const P = new Pix(24, 32);
  P.rect(1, 12, 22, 20, 0x9aa0a8); P.box(1, 12, 22, 20, 0x5a6068); P.hl(2, 13, 20, 0xd8dce2);
  for (let i = 0; i < 7; i++) { P.hl(3, 10 - i, 18, i % 2 ? 0x7a4c2a : 0x8a5a34); P.px(3, 10 - i, 0x5a3a20); P.px(20, 10 - i, 0x5a3a20); }
  P.hl(3, 3, 18, 0xa87048);
  // bestickkoppar
  for (const [x, c] of [[4, 0xc8ccd2], [10, 0xe8ecf0], [16, 0xc8ccd2]]) { P.rect(x, 18, 5, 6, 0x3a3e46); P.vl(x + 1, 15, 3, c); P.vl(x + 3, 14, 4, c); }
  text(P, SMALL, 'BRICKOR', 0, 26, 0xffffff);
  return P.flush();
});
// varma disken med matbrickor bakom glas (w bred)
export function servingImg(w) {
  return once('serve' + w, () => {
    const P = new Pix(w, 34);
    // glastak (nysskydd)
    for (let x = 1; x < w - 1; x++) { P.px(x, 2, 0xe8f6ff, 0.9); for (let y = 3; y < 12; y++) P.px(x, y, 0xbfe4f4, 0.22); }
    P.vl(0, 2, 13, 0x8a9098); P.vl(w - 1, 2, 13, 0x8a9098);
    for (let x = 6; x < w; x += 26) P.line(x, 11, x + 6, 4, 0xffffff, 0.55);
    // värmelampor
    for (let x = 10; x < w - 6; x += 22) { P.rect(x, 0, 6, 2, 0xd8431e); P.ell(x + 3, 6, 5, 5, 0xffb070, 0.25, 3); }
    // mattrågen
    P.rect(1, 12, w - 2, 6, 0x3a3e46); P.hl(1, 12, w - 2, 0x6a6e76);
    const pans = ['kottbullar', 'mos', 'lingon', 'sas', 'korv', 'bullar', 'gronsaker'];
    let i = 0;
    for (let x = 3; x < w - 13; x += 14, i++) {
      const k = pans[i % pans.length];
      P.rect(x, 13, 12, 4, 0xc8ccd2); P.rect(x + 1, 13, 10, 3, 0xe8ecf0);
      for (let j = 0; j < 10; j++) {
        const px = x + 1 + j, py = 13 + (j & 1);
        if (k === 'kottbullar') { P.px(px, 13, j % 3 ? 0x7a3e1a : 0xb8703a); P.px(px, 14, 0x5a2a10); }
        else if (k === 'mos') { P.px(px, 13, 0xfbeab8); P.px(px, 14, j % 4 ? 0xf2dc98 : 0xffffff); }
        else if (k === 'lingon') { P.px(px, 13, j % 2 ? 0xc4142c : 0x8a0a1e); P.px(px, 14, 0xc4142c); }
        else if (k === 'sas') { P.px(px, 13, 0xc08a4c); P.px(px, 14, 0xa06a34); }
        else if (k === 'korv') { P.px(px, 13, 0xb8452a); P.px(px, 14, j % 5 ? 0xe07050 : 0x7a2a18); }
        else if (k === 'bullar') { P.px(px, 13, j % 3 ? 0xc88a4a : 0x8a4a1e); P.px(px, 14, 0xe0a860); if (j % 3 === 1) P.px(px, 13, 0xffffff); }
        else { P.px(px, 13, j % 2 ? 0x4aa040 : 0xf2a030); P.px(px, 14, 0xd8433b); }
        void py;
      }
    }
    // disken: rostfri front + brickränna
    for (let y = 18; y < 34; y++) for (let x = 0; x < w; x++) {
      let c = mix(0xb4bac2, 0x9aa0a8, (y - 18) / 16);
      if (x % 7 === 0) c = mul(c, 0.94);
      P.px(x, y, c);
    }
    P.box(0, 18, w, 16, 0x5a6068);
    P.rect(0, 18, w, 3, 0xd8dce2); P.hl(0, 21, w, 0x7a8088);
    for (let x = 2; x < w - 2; x += 3) P.px(x, 19, 0xa8aeb6); // brickrännans rör
    P.hl(1, 26, w - 2, 0x1d51a0); P.hl(1, 27, w - 2, 0xf2c230);
    return P.flush();
  });
}
// dryckesstationen: kaffeautomat + saftmaskin (30×34)
export const drinksImg = () => once('drinks', () => {
  const P = new Pix(32, 36);
  P.rect(0, 20, 32, 16, 0x9aa0a8); P.box(0, 20, 32, 16, 0x5a6068); P.hl(1, 21, 30, 0xd8dce2);
  // kaffemaskin
  P.rect(2, 2, 13, 18, 0x2a2a32); P.rect(3, 3, 11, 5, 0x3a3e46); text(P, SMALL, 'KAFFE', 3, 4, 0xf6d02f);
  P.rect(5, 10, 7, 5, 0x16161a); P.rect(7, 15, 3, 4, 0xfaf8f2); P.px(8, 15, 0x4a2a14);
  // saftmaskin: två behållare
  P.rect(17, 2, 13, 18, 0xc8ccd2); P.box(17, 2, 13, 18, 0x6a7078);
  P.rect(18, 4, 5, 9, 0xd8303a); P.rect(24, 4, 5, 9, 0xf2a030); P.hl(18, 4, 5, 0xff8a6a); P.hl(24, 4, 5, 0xffd07a);
  P.rect(19, 14, 3, 2, 0x3a3e46); P.rect(25, 14, 3, 2, 0x3a3e46);
  // glas + koppar
  for (let i = 0; i < 4; i++) { P.rect(2 + i * 4, 23, 3, 4, 0xe8f6fa); P.vl(4 + i * 4, 23, 4, 0xaed0dc); }
  for (let i = 0; i < 3; i++) { P.rect(19 + i * 4, 24, 3, 3, 0xfaf8f2); }
  return P.flush();
});
// restaurangkassan (32×30)
export const registerImg = () => once('reg', () => {
  const P = new Pix(32, 30);
  P.rect(0, 14, 32, 16, 0xe8e6e0); P.box(0, 14, 32, 16, 0x6a6a72); P.rect(1, 18, 30, 2, 0x1d51a0); P.hl(1, 20, 30, 0xf2c230);
  P.rect(0, 12, 32, 3, 0xd8d6d0); P.hl(0, 12, 32, 0xf4f2ec);
  P.rect(18, 3, 12, 9, 0x2a2a32); P.rect(19, 4, 10, 5, 0x5fd08a); P.hl(19, 4, 10, 0x9ff0b8);
  P.rect(4, 7, 6, 5, 0x3a3a44); P.rect(5, 8, 4, 2, 0x7fd0ff);
  // skylt
  P.rect(2, 0, 14, 6, 0xf6cf2a); P.box(2, 0, 14, 6, 0x9a7a10); text(P, SMALL, 'KASSA', 2, 22, 0x1d51a0);
  P.px(5, 2, 0x1d51a0); P.hl(7, 2, 6, 0x1d51a0); P.hl(7, 4, 4, 0x1d51a0);
  return P.flush();
});
// brickvagnen (återlämning) 22×34
export const trayCartImg = () => once('tcart', () => {
  const P = new Pix(24, 36);
  P.vl(1, 2, 30, 0x6a7078); P.vl(22, 2, 30, 0x6a7078); P.hl(1, 2, 22, 0x9aa0a8);
  for (let i = 0; i < 6; i++) { const y = 6 + i * 4; P.hl(2, y, 20, 0x9aa0a8); if (i % 2 === 0 || i === 3) { P.hl(3, y - 1, 18, 0x8a5a34); P.px(6, y - 2, 0xfaf8f2); P.px(12, y - 2, 0xc4142c); } }
  P.rect(2, 30, 20, 2, 0x5a6068);
  for (const x of [1, 19]) { P.rect(x, 32, 3, 3, 0x1c1c22); }
  P.rect(4, 0, 16, 5, 0x1d51a0); text(P, SMALL, 'RETUR', 3, 0, 0xf6d02f);
  return P.flush();
});
// bordet (björk, 42×17) – fotlinjen längst ner
export const TABLE_W = 42;
export const tableImg = () => once('table', () => {
  const P = new Pix(TABLE_W, 17);
  for (let y = 0; y < 6; y++) for (let x = 0; x < TABLE_W; x++) {
    let c = y === 0 ? 0xf4e2bc : mix(0xe8d0a0, 0xdcc08c, y / 6 + (hash(x >> 3, 0, 49) - 0.5) * 0.2);
    if (x === 0 || x === TABLE_W - 1) c = 0xc8a870;
    P.px(x, y, c);
  }
  P.rect(0, 6, TABLE_W, 2, 0xc8a870); P.hl(0, 7, TABLE_W, 0xa8884e);
  for (const x of [2, TABLE_W - 5]) { P.rect(x, 8, 3, 9, 0xd8b884); P.vl(x + 2, 8, 9, 0xa8884e); }
  P.hl(2, 16, TABLE_W - 4, 0x000000, 0.2);
  return P.flush();
});
// stol (björk) – sitsen i höjd med där figuren sitter; ritas bakom figuren
export const chairImg = () => once('chair', () => {
  const P = new Pix(12, 24);
  // ryggstöd (spjälor)
  P.rect(1, 0, 10, 2, 0xe8d0a0); P.hl(1, 0, 10, 0xf4e2bc); P.box(1, 0, 10, 2, 0xa8884e);
  for (const x of [1, 4, 7, 10]) P.vl(x, 2, 11, x === 1 || x === 10 ? 0xd8b884 : 0xe0c494);
  P.vl(2, 2, 11, 0xa8884e); P.vl(11, 2, 11, 0xa8884e);
  // sits
  P.rect(0, 13, 12, 3, 0xe8d0a0); P.hl(0, 13, 12, 0xf4e2bc); P.hl(0, 15, 12, 0xa8884e);
  P.vl(1, 16, 7, 0xc8a870); P.vl(10, 16, 7, 0xc8a870);
  return P.flush();
});
// menytavlan på väggen (målas på bakgrunden; rätterna ritas på efteråt med ctx)
export function paintMenuBoard(P, x, y, w, h) {
  P.rect(x - 2, y - 2, w + 4, h + 4, 0x5a3a20); P.box(x - 2, y - 2, w + 4, h + 4, 0x3a2414); P.hl(x - 1, y - 1, w + 2, 0x8a5a30);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) P.px(xx, yy, mix(0x1e2a24, 0x26342c, hash(xx, yy, 5) * 0.8));
  const t = 'MENY';
  text(P, BIG, t, x + Math.round((w - textW(BIG, t)) / 2), y + 3, 0xf6cf2a);
  for (let xx = x + 6; xx < x + w - 6; xx += 2) P.px(xx, y + 12, 0x5a6a60);
}
// menyraderna på tavlan (efter att bakgrunden är klar – rätterna är canvasar)
export function drawMenuRows(ctx, x, y, w, ctxText) {
  MENU.forEach((m, i) => {
    const ry = y + 16 + i * 11;
    ctx.drawImage(dishImg(m.id, 2), x + 2, ry - 5);
    ctxText(ctx, SMALL, m.short, x + 25, ry + 1, '#f4f1ea');
    const p = `${m.price}:-`;
    ctxText(ctx, SMALL, p, x + w - 4 - textW(SMALL, p), ry + 1, '#f6cf2a');
  });
}
