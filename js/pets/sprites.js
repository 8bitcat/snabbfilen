// HUSDJURENS SPRITES – katter, hundar och kaniner i alla raser, stadier och animationer.
// Ritas i kod pixel för pixel (se pet-art.js + pet-canvas.js), cachas per bildruta.
//
// ---------------------------------------------------------------------------
//  API (allt i det logiska 384×216-rummet, heltalspixlar, ingen skalning)
// ---------------------------------------------------------------------------
//  SPECIES = { katt, hund, kanin } → { id, namn, plural, unge, ung, vuxen, ljud,
//            breeds: [{ id, namn, pris, beskr, pat, c, c2, … }] }
//            katt: 9 raser/pälsar, hund: 12 raser, kanin: 6 raser.
//  STAGES = ['unge','ung','vuxen'], ANIMS = [...12 st], DIRS = ['down','up','left','right']
//  breedOf(pet)            → rasobjektet (faller tillbaka på artens första ras)
//  petName(pet)            → t.ex. "Tax · valp · hane"
//  petSize(pet)            → { w, h } i px (stående; w = längd från sidan, h = höjd inkl. öron)
//  drawPet(ctx, x, y, pet, anim='idle', t=0, dir='down')
//        (x, y) = mitten av fötterna (efter scenens setTransform). pet = { species, breed, sex, stage,
//        [id|name] (fas för blink/svans så att djuren inte går i takt), [breed2] (blandras: pälsen
//        från breed2), [seed] (små individuella tecken: vit tass/bläs) }.
//        anim ∈ ANIMS, t = sekunder, dir ∈ DIRS. Ritar skugga + djur; 'sleep' ritar zzz, 'love' hjärtan.
//        Bildrutorna är diskreta (gång 4 rutor à 1/8 s, svansvift, blink, andning) och cachas.
//  drawPetIcon(ctx, x, y, pet, scale=1) → porträtt (övre vänstra hörnet i (x, y)), ICON_W×ICON_H px × scale
//        (heltalsskala, skärpt – för dialoger/menyer)
//  petBox(pet, anim, dir)  → { x0, y0, x1, y1 } relativt fötterna (för klicktest/mätarens höjd)
//  petNeck(pet, anim, t, dir) → { x, y } relativt fötterna där kopplet sitter (halsbandet)
//  drawHearts(ctx, x, y, t), drawZzz(ctx, x, y, t), drawPoop(ctx, x, y, t), drawPuddle(ctx, x, y)
//        (x, y) = punkten effekten utgår från (hjärtan/zzz stiger uppåt därifrån; bajs/pöl ligger på golvet där)
//  animFrame(pet, anim, t) → heltal som ändras bara när bilden byts (för den som vill veta när)
// ---------------------------------------------------------------------------
import { SPECIES } from './sprite-data.js';
import { paintPet, strHash } from './pet-art.js';

export { SPECIES };
export const STAGES = ['unge', 'ung', 'vuxen'];
export const ANIMS = ['idle', 'walk', 'run', 'sit', 'sleep', 'eat', 'play', 'poop', 'pee', 'love', 'happy', 'beg'];
export const DIRS = ['down', 'up', 'left', 'right'];
const ANIM_OK = new Set(ANIMS), DIRS_OK = new Set(DIRS);

export function breedOf(pet) {
  const S = SPECIES[pet?.species] || SPECIES.katt;
  return S.breeds.find((b) => b.id === pet?.breed) || S.breeds[0];
}
export function petName(pet) {
  const S = SPECIES[pet?.species] || SPECIES.katt, B = breedOf(pet);
  const st = pet?.stage === 'unge' ? S.unge.toLowerCase() : pet?.stage === 'ung' ? 'ung' : 'vuxen';
  return `${B.namn} · ${st} · ${pet?.sex === 'hona' ? 'hona' : 'hane'}`;
}

export const ICON_W = 24, ICON_H = 20;

// ---------------------------------------------------------------- bildrutor
// t (sekunder) → diskreta bildrutor. Djurets egen fas (id/namn) gör att de inte blinkar i takt.
function framesOf(pet, anim, t, sp) {
  const ph = strHash(pet?.id ?? pet?.name ?? pet?.breed ?? '') * 9.7;
  const T = (t || 0) + ph;
  const f = { step: 0, wag: 0, breath: 0, blink: false, chew: 0, alt: 0, nose: 0, ear: 0 };
  const blink = (T % 4.3) < 0.14 || ((T + 0.3) % 11.1) < 0.12;
  const breath = Math.floor(T / 1.15) % 2;
  const rabbitIdle = () => { f.nose = Math.floor(T * 0.6) % 3 === 0 ? Math.floor(T * 7) % 2 : 0; f.ear = Math.floor(T * 0.37) % 4 === 1 ? 1 : 0; };
  switch (anim) {
    case 'walk': f.step = Math.floor(T * (sp === 'kanin' ? 7 : 8)) % 4; f.wag = Math.floor(T * 4) % 4; break;
    case 'run': f.step = Math.floor(T * (sp === 'kanin' ? 9 : 12)) % 4; f.wag = Math.floor(T * 6) % 4; break;
    case 'sleep': f.breath = Math.floor(T / 1.4) % 2; break;
    case 'eat': f.chew = Math.floor(T * 4.5) % 2; f.wag = Math.floor(T * 3) % 4; f.blink = blink; break;
    case 'play': f.step = Math.floor(T * 4.5) % 4; f.wag = Math.floor(T * 8) % 4; break;
    case 'poop': f.alt = Math.floor(T * 1.6) % 2; break;
    case 'pee': f.alt = Math.floor(T * 1.4) % 2; f.blink = blink; break;
    case 'happy': f.step = Math.floor(T * 6) % 4; f.wag = Math.floor(T * 10) % 4; break;
    case 'beg': f.alt = Math.floor(T * 2.5) % 2; f.wag = Math.floor(T * 6) % 4; f.blink = blink; if (sp === 'kanin') f.nose = Math.floor(T * 7) % 2; break;
    case 'love': f.wag = Math.floor(T * 2) % 4; f.breath = breath; break;
    case 'sit': f.wag = sp === 'hund' ? Math.floor(T * 2.4) % 4 : Math.floor(T * 1.1) % 4; f.breath = breath; f.blink = blink; if (sp === 'kanin') rabbitIdle(); break;
    default: // idle
      f.wag = sp === 'hund' ? Math.floor(T * 2.2) % 4 : Math.floor(T * 0.9) % 4;
      f.breath = breath; f.blink = blink;
      if (sp === 'kanin') { rabbitIdle(); f.wag = 0; }
  }
  return f;
}
const fkey = (f) => `${f.step}${f.wag}${f.breath}${f.blink ? 1 : 0}${f.chew}${f.alt}${f.nose}${f.ear}`;
export function animFrame(pet, anim, t) {
  const sp = SPECIES[pet?.species] ? pet.species : 'katt';
  const f = framesOf(pet, anim, t, sp);
  return strHash(fkey(f)) * 1e9 | 0;
}

// ---------------------------------------------------------------- cache
const CACHE = new Map();
const visKey = (pet) => `${pet?.species}|${pet?.breed}|${pet?.breed2 || ''}|${pet?.stage || 'vuxen'}|${pet?.sex || ''}|${pet?.seed ?? ''}`;
function spriteOf(pet, anim, t, dir) {
  if (!ANIM_OK.has(anim)) anim = 'idle';
  if (!DIRS_OK.has(dir)) dir = 'down';
  const sp = SPECIES[pet?.species] ? pet.species : 'katt';
  const f = framesOf(pet, anim, t, sp);
  const key = visKey(pet) + '|' + anim + '|' + dir + '|' + fkey(f);
  let s = CACHE.get(key);
  if (!s) {
    s = paintPet(pet, anim, dir, f);
    if (CACHE.size > 6000) CACHE.clear();
    CACHE.set(key, s);
  }
  return s;
}

function drawShadow(ctx, x, y, sh, lift) {
  const rx = Math.max(2, sh.rx - (lift > 1 ? 1 : 0)), ry = sh.ry;
  ctx.fillStyle = 'rgba(20,12,30,.24)';
  for (let r = -ry; r <= ry; r++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (r / (ry + 0.6)) ** 2)));
    if (w > 0) ctx.fillRect(x - w, y + r, w * 2 + 1, 1);
  }
}

const sizeCache = new Map();
export function petSize(pet) {
  const k = visKey(pet);
  let s = sizeCache.get(k);
  if (!s) {
    const b = spriteOf(pet, 'idle', 0, 'right'), f = spriteOf(pet, 'idle', 0, 'down');
    s = { w: b.w, h: Math.max(b.h, f.h) };
    sizeCache.set(k, s);
  }
  return s;
}
export function petBox(pet, anim = 'idle', dir = 'down') { const s = spriteOf(pet, anim, 0, dir); return { x0: s.ox, y0: s.oy, x1: s.ox + s.w, y1: s.oy + s.h }; }
export function petNeck(pet, anim = 'walk', t = 0, dir = 'down') { const s = spriteOf(pet, anim, t, dir); return { x: s.neck.x, y: s.neck.y }; }

export function drawPet(ctx, x, y, pet, anim = 'idle', t = 0, dir = 'down') {
  x = Math.round(x); y = Math.round(y);
  const s = spriteOf(pet, anim, t, dir);
  drawShadow(ctx, x, y, s.shadow, s.lift);
  ctx.drawImage(s.cv, x + s.ox, y + s.oy);
  if (anim === 'sleep') drawZzz(ctx, x + (dir === 'left' ? -3 : 3), y + s.oy + 2, t);
  if (anim === 'love') drawHearts(ctx, x, y + s.oy - 1, t);
}

// Porträtt: djuret sittande framifrån (kanin: sidan), centrerat i en ICON_W×ICON_H-ruta
export function drawPetIcon(ctx, x, y, pet, scale = 1) {
  const sc = Math.max(1, Math.round(scale));
  x = Math.round(x); y = Math.round(y);
  const anim = pet?.species === 'kanin' ? 'idle' : 'sit';
  const s = spriteOf({ ...pet, id: pet?.id ?? 'ikon' }, anim, 0.5, 'down');
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  const fx = Math.round(ICON_W / 2), fy = ICON_H - 2;
  ctx.fillStyle = 'rgba(20,12,30,.22)';
  const rx = s.shadow.rx + 1;
  ctx.fillRect(x + (fx - rx) * sc, y + (fy) * sc, (rx * 2 + 1) * sc, 1 * sc);
  // passa in i rutan (stora hundar kan vara högre än rutan): lyft uppåt vid behov
  const top = fy + s.oy;
  const dy = top < 0 ? -top : 0;
  ctx.drawImage(s.cv, x + (fx + s.ox) * sc, y + (fy + s.oy + dy) * sc, s.w * sc, s.h * sc);
  ctx.imageSmoothingEnabled = smooth;
}

// ---------------------------------------------------------------- effekter
const HEART = ['.#.#.', '#####', '#####', '.###.', '..#..'];
const HEART_S = ['#.#', '###', '.#.'];
function blit(ctx, rows, x, y, col) {
  ctx.fillStyle = col;
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] === '#') ctx.fillRect(x + i, y + j, 1, 1);
}
// Två–tre hjärtan som stiger och bleknar i en jämn cykel
export function drawHearts(ctx, x, y, t) {
  x = Math.round(x); y = Math.round(y);
  for (let k = 0; k < 3; k++) {
    const ph = ((t * 0.7 + k / 3) % 1 + 1) % 1;
    const rise = Math.floor(ph * 12), sway = Math.round(Math.sin((ph + k) * Math.PI * 2) * 1.5);
    const a = ph < 0.15 ? ph / 0.15 : ph > 0.7 ? (1 - ph) / 0.3 : 1;
    if (a <= 0.05) continue;
    ctx.globalAlpha = Math.min(1, a);
    const big = k !== 1;
    const hx = x - 2 + (k - 1) * 4 + sway, hy = y - rise - (big ? 5 : 3);
    blit(ctx, big ? HEART : HEART_S, hx + 1, hy + 1, 'rgba(90,20,40,0.35)');
    blit(ctx, big ? HEART : HEART_S, hx, hy, '#e8405a');
    ctx.fillStyle = '#ff9cb0'; ctx.fillRect(hx + 1, hy + (big ? 1 : 0), 1, 1);
  }
  ctx.globalAlpha = 1;
}
const Z_BIG = ['####', '...#', '..#.', '.#..', '####'], Z_SMALL = ['###', '..#', '.#.', '#..', '###'];
// Zzz som stiger snett uppåt höger och växer
export function drawZzz(ctx, x, y, t) {
  x = Math.round(x); y = Math.round(y);
  for (let k = 0; k < 3; k++) {
    const ph = ((t * 0.45 + k / 3) % 1 + 1) % 1;
    const a = ph < 0.2 ? ph / 0.2 : ph > 0.75 ? (1 - ph) / 0.25 : 1;
    if (a <= 0.05) continue;
    ctx.globalAlpha = Math.min(1, a) * 0.95;
    const zx = x + Math.floor(ph * 7), zy = y - Math.floor(ph * 11) - 4;
    const rows = ph > 0.5 ? Z_BIG : Z_SMALL;
    blit(ctx, rows, zx + 1, zy + 1, 'rgba(30,26,50,0.5)');
    blit(ctx, rows, zx, zy, '#f4f1ea');
  }
  ctx.globalAlpha = 1;
}
// Liten bajshög (tre våningar, glans) med två flugor som surrar runt och lite ånga
export function drawPoop(ctx, x, y, t = 0) {
  x = Math.round(x); y = Math.round(y);
  const rows = [
    '...k....',
    '..kBk...',
    '..kbbk..',
    '.kBbbbk.',
    '.kbbbbk.',
    'kBbbbbbk',
    'kbbbbbdk',
    '.kkkkkk.',
  ];
  const pal = { k: '#3a2414', b: '#7a4a24', B: '#a8703a', d: '#5a3418' };
  ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(x - 4, y - 1, 9, 2);
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c) { ctx.fillStyle = c; ctx.fillRect(x - 4 + i, y - 7 + j, 1, 1); } } });
  // ånga (två svaga pelare som växlar)
  const s = Math.floor(t * 3) % 2;
  ctx.fillStyle = 'rgba(210,230,160,0.45)';
  ctx.fillRect(x - 2 + s, y - 10, 1, 2); ctx.fillRect(x + 1 - s, y - 12, 1, 2);
  // flugor
  for (let k = 0; k < 2; k++) {
    const a = t * (2.3 + k * 0.7) + k * 2.1;
    const fx = x + Math.round(Math.cos(a) * (5 + k)), fy = y - 8 + Math.round(Math.sin(a * 1.3) * 3);
    ctx.fillStyle = '#17151a'; ctx.fillRect(fx, fy, 1, 1);
    ctx.fillStyle = (Math.floor(t * 20 + k) % 2) ? 'rgba(220,235,255,0.8)' : 'rgba(220,235,255,0.35)';
    ctx.fillRect(fx - 1, fy - 1, 1, 1); ctx.fillRect(fx + 1, fy - 1, 1, 1);
  }
}
// Gul kisspöl på golvet (platt, med glans)
export function drawPuddle(ctx, x, y) {
  x = Math.round(x); y = Math.round(y);
  const rows = ['...oooo...', '.ooyyyyoo.', 'oyyYYyyyyo', 'oyyyyyyyyo', '.ooyyyyoo.', '...oooo...'];
  const pal = { o: 'rgba(200,160,30,0.55)', y: 'rgba(240,210,70,0.7)', Y: 'rgba(255,250,210,0.95)' };
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c) { ctx.fillStyle = c; ctx.fillRect(x - 5 + i, y - 3 + j, 1, 1); } } });
}
