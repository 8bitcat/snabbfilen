// FORDONEN i pixelstil (Carl 2026-10-01: "köpa cykel, elsparkcykel och moppe"). Ritas under och
// runt figuren i staden (city.js, walkable.js) och står uppställda i GARAGET (shop-fordon.js).
//
//   drawRide(ctx, id, x, y, dir, t, moving, look, color)
//     ritar fordonet med figuren på: skugga → det som är bakom figuren → figuren (lyft upp på
//     sadeln/brädan, utan egen skugga) → det som är framför (styret, framhjulet sett framifrån,
//     hjälmen på mopeden). Fötterna/marken vid (x, y) precis som drawPerson.
//   drawVehicle(ctx, id, x, y, dir, color, ph)   bara fordonet (uppställt i garaget)
//
// Varje fordon ritas pixel för pixel i en sprite (49×42, marken på rad AY, mitten i kolumn AX)
// i två lager och fyra hjulfaser (ekrarna och vevarna snurrar när man rullar), cachat per färg.
// Från sidan ritas högerläget och speglas till vänster. Inga riktiga märken – modellnamnen är
// påhittade (se game.js FORDON).
import { Pix, mix, mul, hex, hash } from './floor-pix.js';
import { personSprite } from './people.js';

const SW = 49, SH = 42, AX = 24, AY = 40;
// typ = utseendet · lift = hur högt figuren sitter/står · dx = figurens plats längs fordonet (sidvy,
// + = framåt) · frame = drawPerson-bildrutan (5 sitter, 0 står) · hjalm = hjälm på
export const RIDE_ART = {
  begcykel: { typ: 'cykel', herr: true, rost: true, lift: 7, dx: -2, frame: 5 },
  stadscykel: { typ: 'cykel', korg: true, lampa: true, pak: true, lift: 7, dx: -2, frame: 5 },
  racer: { typ: 'racer', lift: 8, dx: -1, frame: 5 },
  elspark: { typ: 'spark', lift: 5, dx: -2, frame: 0 },
  moppe: { typ: 'moppe', lift: 8, dx: -3, frame: 5, hjalm: true },
};
export const rideLift = (id) => RIDE_ART[id]?.lift || 0;

const TIRE = 0x1c1a20, TIRE_HI = 0x3e3b44, RIM = 0xc4cad2, RIM_LO = 0x7c828c, SPOKE = 0xa8adb6;
const CHROME = 0xe4e8ee, CHROME_LO = 0x8c929c, CHROME_DK = 0x5a5e66, BLACK = 0x26232c, SEAT = 0x2c2622, SEAT_HI = 0x4e443c;
const RED_L = 0xe8343a, AMBER = 0xf0a020, LENS = 0xfff0b0, WICKER = 0xb8864a, WICKER_LO = 0x7e5a2e, WICKER_HI = 0xdcb070;
const ramp = (c) => ({ hi: mix(c, 0xffffff, 0.38), base: c, lo: mul(c, 0.72), dk: mul(c, 0.46) });

// ---------------------------------------------------------------- hjälpare (koordinater relativt ankaret)
function kit(P) {
  const px = (x, y, c, a) => P.px(AX + x, AY + y, c, a);
  const rect = (x, y, w, h, c, a) => P.rect(AX + x, AY + y, w, h, c, a);
  const line = (x0, y0, x1, y1, c, a) => P.line(AX + x0, AY + y0, AX + x1, AY + y1, c, a);
  return { px, rect, line };
}
// hjulet från sidan: däck, fälg, ekrar (fas ph 0–3 vrider dem ett snäpp) och nav
function wheelSide(P, cx, cy, r, ph, { thick = 1.6, spokes = true, solid = false } = {}) {
  const { px, line } = kit(P);
  for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
    const d = Math.hypot(x, y);
    if (d > r + 0.45) continue;
    if (d > r - thick) px(cx + x, cy + y, (y < -r * 0.3 && x < r * 0.3) ? TIRE_HI : TIRE);
    else if (solid) px(cx + x, cy + y, d < 1.2 ? CHROME : (y < 0 ? 0x5a5862 : 0x3e3c46));
    else if (d > r - thick - 0.9) px(cx + x, cy + y, y < 0 ? RIM : RIM_LO, 0.9);
  }
  // däckets mönster: några ljusa prickar som följer med hjulet runt
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + ph * Math.PI / 12; px(cx + Math.round(Math.cos(a) * (r - 0.4)), cy + Math.round(Math.sin(a) * (r - 0.4)), TIRE_HI); }
  if (spokes && !solid) {
    const rr = r - thick - 1;
    // (få ekrar och halvgenomskinliga – hjulet ska gå att se igenom, inte bli en grå skiva)
    for (let k = 0; k < 3; k++) {
      const a = k / 3 * Math.PI + ph * Math.PI / 12;
      line(cx + Math.round(Math.cos(a) * rr), cy + Math.round(Math.sin(a) * rr), cx - Math.round(Math.cos(a) * rr), cy - Math.round(Math.sin(a) * rr), SPOKE, 0.4);
    }
  }
  px(cx, cy, CHROME); px(cx + 1, cy, CHROME_LO);
}
// stänkskärm: en båge ovanför hjulet (vinklar i grader, 180 = bakåt, 270 = rakt upp)
function fender(P, cx, cy, r, a0, a1, c) {
  const { px } = kit(P);
  for (let a = a0; a <= a1; a += 4) {
    const t = a * Math.PI / 180, x = Math.round(cx + Math.cos(t) * r), y = Math.round(cy + Math.sin(t) * r);
    px(x, y, c.base); px(x, y - 1, c.hi);
  }
}

// ---------------------------------------------------------------- från sidan (åt höger)
function cykelSide(B, F, R, c, ph) {
  const b = kit(B), f = kit(F);
  const rost = (x, y) => R.rost && hash(x, y, 77) > 0.72;
  const tube = (k, x0, y0, x1, y1, col) => { k.line(x0, y0, x1, y1, col); };
  // hjulen
  wheelSide(B, -10, -6, 6, ph);
  wheelSide(B, 10, -6, 6, ph);
  if (!R.herr || R.pak) { fender(B, -10, -6, 7, 196, 330, R.pak ? ramp(mix(c.base, 0xc0c4cc, 0.35)) : c); fender(B, 10, -6, 7, 212, 326, R.pak ? ramp(mix(c.base, 0xc0c4cc, 0.35)) : c); }
  // bortre veven (bakom ramen)
  const a = ph * Math.PI / 2;
  b.line(-1, -6, -1 - Math.round(Math.cos(a) * 3), -6 - Math.round(Math.sin(a) * 3), CHROME_DK);
  // ramen
  tube(b, -1, -6, -10, -6, c.lo);                    // kedjestaget
  tube(b, -4, -13, -10, -6, c.base);                 // sadelstaget
  tube(b, -1, -6, -4, -14, c.base);                  // sadelröret
  if (R.herr) { tube(b, -4, -14, 6, -14, c.base); tube(b, -4, -13, 6, -13, c.lo); tube(b, 6, -13, -1, -6, c.base); tube(b, 6, -12, 0, -6, c.lo); }
  else { // damcykel: låg, böjd ram
    for (const [x0, y0, x1, y1] of [[6, -13, 3, -10], [3, -10, -1, -7]]) { tube(b, x0, y0, x1, y1, c.base); tube(b, x0, y0 + 1, x1, y1 + 1, c.lo); }
  }
  b.rect(6, -16, 2, 5, c.base); b.px(6, -16, c.hi); b.px(6, -15, c.hi);   // styrröret
  tube(b, 7, -11, 10, -6, c.lo); tube(b, 8, -11, 10, -7, c.dk);           // gaffeln
  if (R.rost) for (let x = -10; x <= 8; x++) for (let y = -16; y <= -5; y++) if (B.get(AX + x, AY + y) && rost(x, y) && B.get(AX + x, AY + y) !== TIRE) b.px(x, y, 0x8a4a26);
  // kedjeskyddet
  if (R.pak) { b.rect(-9, -8, 9, 2, c.base); b.rect(-9, -8, 9, 1, c.hi); b.px(-10, -7, c.lo); }
  // sadeln och sadelstolpen
  b.line(-4, -15, -4, -14, CHROME_LO);
  b.rect(-7, -16, 6, 1, SEAT); b.rect(-6, -17, 4, 1, SEAT_HI); b.px(-2, -16, SEAT);
  // pakethållaren
  if (R.pak) { b.rect(-15, -13, 10, 1, CHROME_LO); b.line(-13, -12, -10, -7, CHROME_DK); b.px(-15, -12, RED_L); }
  // styret: stammen upp, bakåtsvepta handtag (handtaget framför figurens hand)
  b.line(6, -17, 6, -19, CHROME_LO); b.line(6, -19, 3, -19, CHROME);
  f.rect(2, -20, 2, 2, BLACK); f.px(2, -20, 0x3e3a46);
  if (R.lampa) { b.rect(8, -16, 2, 2, CHROME); b.px(9, -16, LENS); b.px(9, -15, mix(LENS, 0xffffff, 0.5)); }
  if (R.korg) { // flätad korg framför styret
    b.rect(8, -21, 8, 6, WICKER); b.rect(8, -21, 8, 1, WICKER_HI); b.rect(8, -16, 8, 1, WICKER_LO);
    for (let x = 8; x < 16; x += 2) b.line(x, -20, x, -17, WICKER_LO);
    b.px(9, -22, 0x4aa83a); b.px(10, -23, 0x4aa83a); b.px(11, -22, 0xd84a3a);   // något grönt och ett äpple i korgen
  }
  // närmaste veven och pedalen (framför figuren)
  const vx = Math.round(Math.cos(a + Math.PI) * 3), vy = Math.round(Math.sin(a + Math.PI) * 3);
  f.line(-1, -6, -1 + vx, -6 + vy, CHROME); f.rect(-2 + vx, -6 + vy, 3, 1, BLACK);
  b.rect(-3, -8, 4, 4, CHROME_LO); b.px(-1, -6, CHROME);   // kedjedrevet
}
function racerSide(B, F, R, c, ph) {
  const b = kit(B), f = kit(F);
  wheelSide(B, -10, -6, 6, ph, { thick: 1.2 });
  wheelSide(B, 10, -6, 6, ph, { thick: 1.2 });
  const a = ph * Math.PI / 2;
  b.line(-1, -6, -1 - Math.round(Math.cos(a) * 3), -6 - Math.round(Math.sin(a) * 3), CHROME_DK);
  b.line(-1, -6, -10, -6, c.lo);
  b.line(-4, -14, -10, -6, c.base);
  b.line(-1, -6, -4, -15, c.base);
  b.line(-4, -15, 7, -16, c.base); b.line(-3, -14, 6, -15, c.hi);          // sluttande överrör
  b.line(7, -15, -1, -6, c.base); b.line(7, -14, 0, -6, c.lo);            // grovt underrör
  b.rect(7, -17, 2, 5, c.base); b.px(7, -17, c.hi);
  b.line(8, -12, 10, -6, CHROME_LO);
  b.rect(1, -11, 2, 3, 0xf0f0f0); b.px(1, -12, 0x3a7bd5);                 // vattenflaskan
  b.line(-4, -16, -4, -15, CHROME_LO); b.rect(-7, -17, 5, 1, BLACK); b.px(-3, -17, BLACK);
  b.line(8, -18, 10, -18, CHROME_LO);                                    // stammen
  // böjt styre (racerstyre) med lindning
  f.rect(10, -19, 2, 1, BLACK); f.px(12, -18, BLACK); f.px(12, -17, BLACK); f.px(12, -16, BLACK); f.px(11, -15, BLACK);
  const vx = Math.round(Math.cos(a + Math.PI) * 3), vy = Math.round(Math.sin(a + Math.PI) * 3);
  f.line(-1, -6, -1 + vx, -6 + vy, CHROME); f.rect(-2 + vx, -6 + vy, 3, 1, BLACK);
  b.rect(-3, -8, 4, 4, CHROME_LO); b.px(-1, -6, CHROME);
}
function sparkSide(B, F, R, c, ph) {
  const b = kit(B);
  wheelSide(B, -9, -3, 3, ph, { thick: 1.4, solid: true });
  wheelSide(B, 10, -3, 3, ph, { thick: 1.4, solid: true });
  fender(B, -9, -3, 4, 190, 320, ramp(0x3a3a42));
  // brädan: svart med grip, färgad rand under
  b.rect(-9, -5, 18, 2, 0x2a2a30); b.rect(-9, -5, 18, 1, 0x44444e); for (let x = -8; x < 8; x += 3) b.px(x, -5, 0x55555f);
  b.rect(-9, -3, 17, 1, c.base);
  // stången (lutar lite bakåt), fällleden, lampan, handtaget
  for (let y = -19; y <= -5; y++) { const x = 9 - Math.round((-5 - y) / 12); b.px(x, y, c.base); b.px(x - 1, y, c.lo); }
  b.rect(8, -9, 3, 2, CHROME_LO);
  b.rect(9, -17, 2, 2, 0xf4f4f4); b.px(10, -17, LENS);
  kit(F).rect(5, -20, 4, 1, BLACK); kit(F).px(4, -20, 0x3e3a46);
  b.rect(7, -20, 3, 1, BLACK);
  b.px(-10, -5, RED_L);
}
function moppeSide(B, F, R, c, ph) {
  const b = kit(B), f = kit(F);
  wheelSide(B, -11, -6, 6, ph, { thick: 2 });
  wheelSide(B, 11, -6, 6, ph, { thick: 2 });
  fender(B, -11, -6, 7, 188, 326, c);
  fender(B, 11, -6, 7, 214, 330, c);
  // avgasröret och ljuddämparen (krom), motorn med kylflänsar
  b.line(3, -6, -6, -8, CHROME_LO); b.line(3, -5, -6, -7, CHROME_DK);
  b.rect(-15, -10, 9, 3, CHROME); b.rect(-15, -10, 9, 1, 0xffffff); b.rect(-15, -8, 9, 1, CHROME_LO); b.px(-16, -9, CHROME_DK);
  b.rect(-3, -11, 7, 6, 0x6e6e78); b.rect(-3, -11, 7, 1, 0x9a9aa4); b.rect(-3, -6, 7, 1, 0x4a4a52);
  for (let y = -12; y <= -8; y += 2) b.rect(1, y, 4, 1, 0xa8a8b2);
  b.rect(0, -7, 2, 1, BLACK);                                             // fotpinnen
  // bakdelen: sidokåpa, pakethållare, baklyse och skylt
  b.rect(-9, -14, 9, 3, c.lo); b.rect(-9, -14, 9, 1, c.base);
  b.rect(-16, -14, 9, 1, CHROME_LO); b.line(-14, -13, -11, -8, CHROME_DK);
  b.rect(-17, -12, 2, 2, RED_L); b.px(-17, -12, 0xff8a8a);
  b.rect(-17, -10, 2, 3, 0xf0f0e8);
  // sadeln: lång och svart med söm
  b.rect(-10, -16, 11, 2, SEAT); b.rect(-9, -17, 9, 1, SEAT_HI); for (let x = -9; x < 0; x += 2) b.px(x, -15, 0x3e3632);
  // tanken: rundad, högblank, med rand
  const tank = [[2, 6], [1, 7], [1, 8], [1, 8], [1, 8], [2, 7]];
  tank.forEach(([x0, x1], j) => b.rect(x0, -18 + j, x1 - x0 + 1, 1, j === 0 ? c.hi : j === 5 ? c.lo : c.base));
  b.rect(2, -16, 6, 1, 0xf4f1ea); b.rect(3, -17, 2, 1, mix(c.hi, 0xffffff, 0.5));
  b.rect(4, -14, 2, 1, CHROME);                                             // tanklocket… emblemet
  // ramen fram, gaffeln (krom), framlyktan och styret med backspegel
  b.line(8, -18, 9, -15, CHROME_LO);
  b.line(9, -15, 11, -6, CHROME); b.line(10, -15, 12, -7, CHROME_LO);
  b.rect(10, -20, 4, 4, CHROME); b.rect(10, -20, 4, 1, 0xffffff); b.rect(13, -19, 1, 2, LENS); b.px(10, -17, CHROME_LO);
  b.line(8, -19, 7, -22, CHROME_LO); b.line(7, -22, 4, -22, CHROME);
  b.line(7, -22, 8, -25, CHROME_LO); b.rect(7, -27, 3, 2, CHROME); b.px(8, -27, 0xffffff);
  b.px(9, -21, AMBER);
  f.rect(3, -23, 2, 2, BLACK);
}

// ---------------------------------------------------------------- framifrån / bakifrån
function front(B, F, R, c, ph, back) {
  const b = kit(B), f = kit(F);
  const tread = (x, y0, y1, w) => { for (let y = y0; y <= y1; y++) for (let i = 0; i < w; i++) f.px(x + i, y, ((y + ph) & 1) && i === 0 ? TIRE_HI : TIRE); };
  if (R.typ === 'cykel' || R.typ === 'racer') {
    tread(-1, -12, -1, 2);
    if (R.typ === 'cykel' && (!R.herr || R.pak)) { f.rect(-2, -14, 4, 2, c.base); f.rect(-2, -14, 4, 1, c.hi); }
    if (!back) {
      f.line(-2, -15, -2, -8, c.lo); f.line(1, -15, 1, -8, c.lo);         // gaffeln
      f.rect(-1, -17, 2, 3, c.base); f.px(-1, -17, c.hi);
      if (R.typ === 'racer') { f.rect(-6, -18, 12, 1, CHROME_LO); f.rect(-7, -18, 1, 4, BLACK); f.rect(6, -18, 1, 4, BLACK); }
      else { f.rect(-8, -18, 16, 1, CHROME_LO); f.rect(-9, -19, 2, 2, BLACK); f.rect(7, -19, 2, 2, BLACK); }
      if (R.lampa) { f.rect(-1, -16, 2, 2, CHROME); f.px(-1, -15, LENS); f.px(0, -15, LENS); }
      if (R.korg) { f.rect(-5, -17, 10, 5, WICKER); f.rect(-5, -17, 10, 1, WICKER_HI); f.rect(-5, -13, 10, 1, WICKER_LO); for (let x = -4; x < 5; x += 2) f.line(x, -16, x, -14, WICKER_LO); f.px(-2, -18, 0x4aa83a); f.px(1, -18, 0xd84a3a); }
      f.rect(-6, -8, 2, 1, BLACK); f.rect(4, -8, 2, 1, BLACK);            // pedalerna
    } else {
      b.rect(-9, -19, 2, 2, BLACK); b.rect(7, -19, 2, 2, BLACK);          // handtagen syns bakom
      f.rect(-1, -15, 2, 1, RED_L);                                         // reflexen
      if (R.pak) { f.rect(-3, -15, 6, 1, CHROME_LO); f.px(-1, -16, RED_L); f.px(0, -16, RED_L); }
      f.rect(-6, -8, 2, 1, BLACK); f.rect(4, -8, 2, 1, BLACK);
    }
  } else if (R.typ === 'spark') {
    tread(-1, -6, -1, 2);
    if (!back) {
      f.rect(-1, -20, 2, 14, c.base); f.line(-1, -20, -1, -7, c.hi);
      f.rect(-6, -21, 12, 1, BLACK); f.rect(-7, -21, 1, 2, 0x3e3a46); f.rect(6, -21, 1, 2, 0x3e3a46);
      f.rect(-1, -17, 2, 2, 0xf4f4f4); f.px(-1, -16, LENS); f.px(0, -16, LENS);
    } else {
      b.rect(-7, -21, 2, 1, BLACK); b.rect(5, -21, 2, 1, BLACK);
      f.rect(-2, -7, 4, 2, 0x3a3a42); f.rect(-1, -8, 2, 1, RED_L);
    }
  } else if (R.typ === 'moppe') {
    tread(-1, -12, -1, 3);
    f.rect(-2, -15, 5, 3, c.base); f.rect(-2, -15, 5, 1, c.hi);
    if (!back) {
      f.line(-3, -18, -3, -9, CHROME); f.line(3, -18, 3, -9, CHROME_LO);
      f.rect(-2, -22, 5, 4, CHROME); f.rect(-1, -21, 3, 2, LENS); f.px(-1, -21, 0xffffff);
      f.rect(-10, -23, 21, 1, CHROME_LO);
      f.rect(-11, -24, 2, 2, BLACK); f.rect(10, -24, 2, 2, BLACK);
      f.line(-8, -23, -9, -26, CHROME_LO); f.rect(-11, -28, 3, 2, CHROME); f.line(8, -23, 9, -26, CHROME_LO); f.rect(9, -28, 3, 2, CHROME);
      f.px(-10, -22, AMBER); f.px(10, -22, AMBER);
      f.rect(-6, -8, 2, 1, BLACK); f.rect(5, -8, 2, 1, BLACK);
    } else {
      b.rect(-11, -24, 2, 2, BLACK); b.rect(10, -24, 2, 2, BLACK); b.rect(-11, -28, 3, 2, CHROME); b.rect(9, -28, 3, 2, CHROME);
      f.rect(-2, -18, 5, 2, RED_L); f.px(-2, -18, 0xff8a8a);
      f.rect(-2, -13, 5, 3, 0xf0f0e8); f.px(-1, -12, 0x3a3a42); f.px(1, -12, 0x3a3a42);
      f.rect(4, -10, 3, 4, CHROME); f.rect(4, -10, 3, 1, 0xffffff);         // ljuddämparen
      f.rect(-6, -8, 2, 1, BLACK); f.rect(5, -8, 2, 1, BLACK);
    }
  }
}

// ---------------------------------------------------------------- cache
const CACHE = new Map();
function mirror(cv) {
  const m = document.createElement('canvas'); m.width = cv.width; m.height = cv.height;
  const c = m.getContext('2d'); c.translate(cv.width, 0); c.scale(-1, 1); c.drawImage(cv, 0, 0);
  return m;
}
function build(id, color, dir, ph) {
  const R = RIDE_ART[id];
  const c = ramp(hex(color, 0x3a7bd5));
  const B = new Pix(SW, SH), F = new Pix(SW, SH);
  if (dir === 'left' || dir === 'right') {
    ({ cykel: cykelSide, racer: racerSide, spark: sparkSide, moppe: moppeSide }[R.typ])(B, F, R, c, ph);
  } else front(B, F, R, c, ph, dir === 'up');
  const out = { back: B.flush(), front: F.flush() };
  if (dir === 'left') { out.back = mirror(out.back); out.front = mirror(out.front); }
  return out;
}
function sprite(id, color, dir, ph) {
  const key = `${id}|${color}|${dir}|${ph}`;
  let s = CACHE.get(key);
  if (!s) { if (CACHE.size > 400) CACHE.delete(CACHE.keys().next().value); s = build(id, color, dir, ph); CACHE.set(key, s); }
  return s;
}

// hjälmen (mopeden): vit kupa med fordonets färg som rand, visir åt färdriktningen
const HELM = new Map();
function helmet(look, dir, color) {
  const kid = !!look?.kid, key = `${kid}|${dir}|${color}`;
  if (HELM.has(key)) return HELM.get(key);
  const P = new Pix(24, 40), c = ramp(hex(color, 0x3a7bd5));
  const headTop = kid ? 15 : 7;                       // (people.js: sittande figurens huvudtopp)
  const rows = [[8, 15], [6, 17], [5, 18], [5, 18], [5, 18], [5, 18]];
  rows.forEach(([x0, x1], j) => { for (let x = x0; x <= x1; x++) P.px(x, headTop - 1 + j, j === 0 ? 0xffffff : (x === x0 || x === x1) ? 0xb8bcc6 : 0xeceef2); });
  for (let x = 6; x <= 17; x++) P.px(x, headTop + 1, c.base);                               // randen
  if (dir === 'right' || dir === 'left') {
    const fr = dir === 'right';
    for (let j = 2; j <= 5; j++) P.px(fr ? 19 : 4, headTop + j, 0xb8bcc6);
    P.rect(fr ? 15 : 6, headTop + 3, 4, 1, 0x2a3a4e); P.rect(fr ? 16 : 6, headTop + 4, 3, 1, 0x4a6a8e);  // visiret
  } else if (dir === 'up') { for (let x = 5; x <= 18; x++) P.px(x, headTop + 5, 0xd8dce4); for (let x = 6; x <= 17; x++) P.px(x, headTop + 6, 0xc8ccd6); }
  // mörk kontur ovanpå
  const out = new Pix(24, 40);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 24; x++) {
    const v = P.d[(y * 24 + x) * 4 + 3];
    if (v) out.px(x, y, P.get(x, y));
    else if ([[0, 1], [1, 0], [-1, 0]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < 24 && yy < 40 && P.d[(yy * 24 + xx) * 4 + 3]; })) out.px(x, y, 0x1e1a24);
  }
  const cv = out.flush();
  HELM.set(key, cv);
  return cv;
}

// bara fordonet (i garaget, uppställt): ph = hjulfasen
export function drawVehicle(ctx, id, x, y, dir = 'right', color = '#3a7bd5', ph = 0) {
  if (!RIDE_ART[id]) return;
  const s = sprite(id, color, dir, ph & 3), X = Math.round(x), Y = Math.round(y);
  shadow(ctx, X, Y, dir);
  ctx.drawImage(s.back, X - AX, Y - AY);
  ctx.drawImage(s.front, X - AX, Y - AY);
}
function shadow(ctx, X, Y, dir) {
  ctx.fillStyle = 'rgba(20,12,30,.28)';
  if (dir === 'left' || dir === 'right') { ctx.fillRect(X - 16, Y - 1, 32, 2); ctx.fillRect(X - 13, Y + 1, 26, 1); }
  else { ctx.fillRect(X - 5, Y - 1, 10, 2); ctx.fillRect(X - 3, Y + 1, 6, 1); }
}
// fordonet med figuren på
export function drawRide(ctx, id, x, y, dir, t, moving, look, color) {
  const R = RIDE_ART[id];
  if (!R) return false;
  if (!['down', 'up', 'left', 'right'].includes(dir)) dir = 'down';
  const ph = moving ? Math.floor(t * 14) & 3 : 0;
  const s = sprite(id, color, dir, ph), X = Math.round(x), Y = Math.round(y);
  shadow(ctx, X, Y, dir);
  ctx.drawImage(s.back, X - AX, Y - AY);
  const side = dir === 'left' || dir === 'right';
  const pdx = side ? (dir === 'right' ? R.dx : -R.dx) : 0;
  // (mopeden puttrar: figuren skakar en pixel ibland)
  const shake = R.typ === 'moppe' && Math.floor(t * 9) % 5 === 0 ? 1 : 0;
  const py = Y - R.lift - shake;
  ctx.drawImage(personSprite(look, dir, R.frame), X + pdx - 12, py - 39);
  if (R.hjalm) ctx.drawImage(helmet(look, dir, color), X + pdx - 12, py - 39);
  ctx.drawImage(s.front, X - AX, Y - AY);
  // mopedens avgaser när den rullar
  if (R.typ === 'moppe' && moving && side) {
    const back = dir === 'right' ? -1 : 1;
    for (let k = 0; k < 3; k++) {
      const u = ((t * 2.2 + k / 3) % 1);
      ctx.globalAlpha = 0.45 * (1 - u);
      ctx.fillStyle = '#c8c8d0';
      const r = 1 + Math.round(u * 2);
      ctx.fillRect(Math.round(X + back * (17 + u * 12)) - r, Math.round(Y - 9 - u * 5) - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }
  return true;
}
