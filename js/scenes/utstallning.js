// UTSTÄLLNINGSHALLEN i Tassbacken (Carl 2026-10-12: "kan vi ha … kattutställning?"). Tegelhallen med
// valvtaket: ANMÄLAN vid dörren (Gunilla), UTSTÄLLARNA (burar med de andra djuren), RINGEN med det gröna
// mattan och domarbordet (tre domare), PRISBORDET med pokalerna och LÄKTAREN med publiken.
//
// Tre klasser: 🐈 KATTUTSTÄLLNING, 🐕 HUNDUTSTÄLLNING (bedöms i ringen) och 🐇 KANINHOPPNING
// (ett hinderlopp, js/scenes/kaninhopp.js). Varje djur får tävla en gång om dagen. Anmälan 100 kr.
// I ringen: man går ett varv med djuret, sedan POSERA – tryck när visaren är i det gröna (tre försök).
// Domarna bedömer: ✂️ päls (frisyr från trimmaren: nygjord = mest), ❤️ hälsa (mätt och glad),
// 🤝 samarbete (minnet: klappar och lekar) och ✨ posen. Placering mot fem andra djur: 1–3 ger rosett
// (sparas på djuret, pet.utst), prispengar och en POKAL i förrådet (guld/silver/brons – ställ ut hemma).
// Vinner man med minst 85 poäng blir det BEST IN SHOW (extra pengar).
//
// _debug-API för tools/utstallning-test.mjs. Poängen räknas i showPoang (exporterad, ren funktion).
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { fmt } from '../game.js';
import { createWalker, selfDrawable, folkDrawables, createSpeech, WALK_SEQ } from './walkable.js';
import { drawPet } from '../pets/sprites.js';
import { petStore } from '../pets/sim.js';
import { frisyrById } from '../pets/trim.js';
import { klinikBonus } from './shop-djurklinik.js';   // 🩺 hälsokoll/vaccin senaste veckan = extra hälsopoäng
import { $t } from '../core/i18n.js';
import { tavla, affisch, anslagstavla, vaggklocka, eluttag, brandslackare, dorrmatta, ritaLampsken, ritaKrukvaxt, ritaVattenautomat } from '../tassbacken/inne-kit.js';   // 🧰 inredningen (v0.134)

const W = 640, H = 216, WALL_Y = 70;
const DOOR = { x0: 14, x1: 46 };
const DISK = { x: 62, y: 84, w: 66, h: 26 };
const BURAR = { x0: 142, y: 96, n: 4, w: 26 };          // utställarburarna (två våningar)
const RING = { x: 372, y: 152, rx: 92, ry: 34 };
const DOMARBORD = { x: 332, y: 86, w: 80 };
const PRIS = { x: 494, y: 90, w: 56 };
const LAKTARE = { x0: 562, x1: 636 };
export const ANMALAN = 100;
export const PRISPENGAR = [400, 200, 100];
export const BIS_PENGAR = 500;
export const KLASSER = [
  { id: 'katt', icon: '🐈', namn: $t('Kattutställning'), skylt: $t('KATTUTSTÄLLNING') },
  { id: 'hund', icon: '🐕', namn: $t('Hundutställning'), skylt: $t('HUNDUTSTÄLLNING') },
  { id: 'kanin', icon: '🐇', namn: $t('Kaninhoppning'), skylt: $t('KANINHOPPNING') },
];
// de andra utställarna (namnen är djurens; rasen väljs ur arten)
const RIVALER = {
  katt: [['Sir Mjau', 'skogkatt'], ['Lady Smilla', 'siames'], ['Prinsessan Tussi', 'vit'], ['Greven', 'blagra'], ['Lilla My', 'skoldpadd']],
  hund: [['Rex', 'schafer'], ['Bella', 'golden'], ['Doris', 'pudel'], ['Kapten Krok', 'tax'], ['Molly', 'corgi']],
  kanin: [['Hoppsan', 'brun'], ['Snöflingan', 'vit'], ['Raketen', 'prickig'], ['Lord Öra', 'vadur'], ['Pompom', 'lejonhuvud']],
};
const GUNILLA = { skin: '#f6d7bf', hair: '#b9b3ab', style: 'bob', top: 'jacket', shirt: '#2a4a6a', accent: '#f0c040', bottom: 'skirt', pants: '#2a4a6a', shoes: '#1c1c1c', glasses: 'round', beard: false, phones: false, bag: null, hat: null, build: 4, blush: true, kid: false };
const DOMARE = [
  { skin: '#e0a97f', hair: '#1d1714', style: 'short', top: 'jacket', shirt: '#2f3440', accent: '#d8343c', bottom: 'pants', pants: '#2b2b30', shoes: '#1c1c1c', glasses: false, beard: 'short', phones: false, bag: null, hat: null, build: 5, blush: false, kid: false },
  { skin: '#a06a43', hair: '#1d1714', style: 'bun', top: 'jacket', shirt: '#7a2e3e', accent: '#f0c040', bottom: 'pants', pants: '#2b2b30', shoes: '#1c1c1c', glasses: 'round', beard: false, phones: false, bag: null, hat: null, build: 4, blush: true, kid: false },
  { skin: '#f6d7bf', hair: '#ecd489', style: 'side', top: 'jacket', shirt: '#26605a', accent: '#f4f1ea', bottom: 'pants', pants: '#2b2b30', shoes: '#1c1c1c', glasses: false, beard: false, phones: false, bag: null, hat: null, build: 5, blush: false, kid: false },
];
const GUNILLA_SAY = [
  $t('Välkommen till utställningen! Anmäl ditt djur här vid disken – det kostar 100 kr.'),
  $t('Domarna tittar på pälsen, hälsan, hur väl ni samarbetar och posen i ringen.'),
  $t('Ett tips: gå till trimmaren först! En nygjord frisyr ger mest poäng för pälsen.'),
  $t('Ett djur som blir klappat och lekt med varje dag samarbetar bäst i ringen.'),
  $t('Kaninerna tävlar i hoppning – tryck precis innan hindret!'),
];

// ================= poängen (ren funktion – testerna räknar på den) =================
// pet = djuret ur petStore, day = spelets dag, pose = antal perfekta poser (0–3), r = slump 0–1
export function showPoang(pet, day, pose = 0, r = 0.5) {
  const fr = pet?.frisyr, nyss = fr && day - (fr.d | 0) <= 3;
  const pals = fr ? (nyss ? 22 : 12) : 6;
  const halsa = Math.min(22, Math.round(((+pet?.hunger || 0) + (+pet?.happy || 0)) / 200 * 18) + klinikBonus(pet, day));
  const m = pet?.minne || {}, samarbete = Math.min(22, Math.round(((m.klapp | 0) + (m.lek | 0) * 2 + (m.boll | 0)) / 3) + 4);
  const posePo = Math.min(3, pose | 0) * 8;
  const slump = Math.round((r - 0.5) * 8);
  const tot = Math.max(10, Math.min(100, 10 + pals + halsa + samarbete + posePo + slump));
  return { tot, pals, halsa, samarbete, pose: posePo };
}
// de andra utställarnas poäng: samma för alla en viss dag och klass (så att man kan försöka slå dem)
export function rivalPoang(klass, day) {
  return RIVALER[klass].map(([namn, ras], i) => ({ namn, ras, tot: 46 + Math.round(hash(i, day, klass.length * 7) * 40) + (i === 0 ? 4 : 0) }));
}
// hoppningens placering: fel och tid mot de andra kaninerna
export function hoppPlacering(day, fel, tid) {
  const andra = RIVALER.kanin.map(([namn], i) => ({ namn, fel: hash(i, day, 5) < 0.35 ? 4 : 0, tid: 21 + Math.round(hash(i, day, 6) * 70) / 10 }));
  const alla = [...andra, { namn: $t('Du'), fel, tid, du: true }].sort((a, b) => a.fel - b.fel || a.tid - b.tid);
  return { plats: alla.findIndex((x) => x.du) + 1, alla };
}
// rosetten, prispengarna och pokalen (gemensamt för ringen och hoppningen)
export function belona(g, S, pet, klass, plats, tot = 0) {
  const pris = PRISPENGAR[plats - 1] || 0, bis = plats === 1 && tot >= 85 && (klass === 'katt' || klass === 'hund');
  g.money += pris + (bis ? BIS_PENGAR : 0); g.earned = (g.earned || 0) + pris + (bis ? BIS_PENGAR : 0);
  if (plats <= 3) g.storage.push({ k: 'pokal', v: plats - 1 });
  if (plats <= 3) g.merit?.(klass, plats, { vem: pet.name });   // 🏆 till troféskåpet (js/core/meriter.js)
  if (bis) g.merit?.('bis', 1, { klass, vem: pet.name });
  const u = (pet.utst ||= {});
  u[klass] ||= [0, 0, 0];
  if (plats <= 3) u[klass][plats - 1]++;
  if (bis) u.bis = (u.bis | 0) + 1;
  u.dag = g.day;
  pet.happy = Math.min(100, (+pet.happy || 0) + (plats <= 3 ? 15 : 6));
  S.save();
  const glad = g.glad?.(plats === 1 ? 8 : plats <= 3 ? 5 : 2, $t('Utställningen i Tassbacken'), 'utstallning', 10) || 0;
  g.save();
  return { pris, bis, glad };
}

// ================= bakgrunden =================
let BG = null;
function paintBg() {
  const P = new Pix(W, H);
  // väggen: tegel med vita fogar nedtill, ljus puts upptill, takstolar och girlanger
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < W; x++) {
    let c;
    if (y < 30) c = mix(0xf0e8dc, 0xe0d4c4, (bayer(x, y) - 0.5) * 0.2 + y / 60);
    else { const r = Math.floor((y - 30) / 4), xx = x + (r & 1) * 4, rx = xx % 9, ry = (y - 30) % 4; c = ry === 3 || rx === 8 ? 0xd8c8b8 : mix(0xb86a4a, 0xa05a3e, hash(Math.floor(xx / 9), r, 2) * 0.6); }
    P.px(x, y, c);
  }
  for (let x = 20; x < W; x += 80) { P.rect(x, 0, 4, 30, 0x6a4a3a); P.hl(x, 0, 4, 0x8a6a5a); }   // takstolarna
  P.hl(0, 29, W, 0x8a6a5a); P.hl(0, 30, W, 0x6a4a3a);
  const FL = [0xd8343c, 0xf4f1ea, 0x3a7bd5, 0xf0c040, 0x46a35a];
  for (let x = 0; x < W; x += 6) { const y = 8 + Math.round(Math.sin(x / 40) * 3 + 3); const c = FL[(x / 6) % FL.length | 0]; for (let j = 0; j < 4; j++) P.hl(x + j, y + j, 5 - j * 2 > 0 ? 5 - j * 2 : 1, c); }
  // dörren UT
  P.rect(DOOR.x0 - 3, 18, DOOR.x1 - DOOR.x0 + 6, WALL_Y - 18, 0x6a4a3a);
  for (let y = 20; y < WALL_Y; y++) for (let x = DOOR.x0; x < DOOR.x1; x++) P.px(x, y, mix(0x2a4a6a, 0x1e3a5a, ((x - DOOR.x0) % 8 === 0 ? 0.6 : 0) + hash(x >> 2, y, 3) * 0.2));
  P.vl(DOOR.x0 + 16, 20, WALL_Y - 20, 0x14283e); P.rect(DOOR.x0 + 6, 26, 20, 9, 0x1d2b1f); text(P, SMALL, $t('UT'), DOOR.x0 + 12, 28, 0x6fe08a);
  // skyltarna
  sign(P, $t('ANMÄLAN'), DISK.x + DISK.w / 2, 38, 0x1e3a5a, 0xf8d860);
  sign(P, $t('UTSTÄLLARNA'), BURAR.x0 + 52, 38, 0x1e3a5a, 0xf4f1ea);
  sign(P, $t('UTSTÄLLNINGSHALLEN'), RING.x, 14, 0x1e3a5a, 0xf8d860, true);
  sign(P, $t('PRISBORDET'), PRIS.x + PRIS.w / 2, 38, 0x6a2a3a, 0xf8d860);
  // läktaren: tre bänkrader i trä som stiger mot väggen
  for (let r = 0; r < 4; r++) { const y = WALL_Y - 26 + r * 14; P.rect(LAKTARE.x0 + r * 4, y, LAKTARE.x1 - LAKTARE.x0 - r * 4, 4, 0xb07a48); P.hl(LAKTARE.x0 + r * 4, y, LAKTARE.x1 - LAKTARE.x0 - r * 4, 0xd8a070); P.rect(LAKTARE.x0 + r * 4, y + 4, LAKTARE.x1 - LAKTARE.x0 - r * 4, 10, 0x5a3a28); }
  // 🧰 mer på väggen (v0.134): strålkastarna i takstolarna, anslagstavlan, klockan, rosettväggen, resultattavlan,
  // affischerna, vinnarnas foton, brandsläckaren och eluttagen
  for (const sx of [300, 372, 444]) { P.rect(sx - 4, 22, 8, 7, 0x2a2a30); P.hl(sx - 4, 22, 8, 0x5a5a62); P.rect(sx - 2, 29, 4, 2, 0xfff0a0); P.vl(sx, 18, 4, 0x3a3a42); }
  anslagstavla(P, 60, 8, 64, 26, 5); vaggklocka(P, 134, 18, 6);
  P.rect(254, 34, 72, 32, 0x1e3a5a); P.box(254, 34, 72, 32, 0xf8d860);
  [[0xf0c030, 0xfff0a0], [0xc8ccd4, 0xf4f6f8], [0xc06a2a, 0xe8a060], [0xd8343c, 0xf07a7a], [0x3a7bd5, 0x8ab8f0], [0x46a35a, 0x9ad87a]].forEach(([c, l], i) => { const rx = 262 + (i % 3) * 22, ry = 40 + Math.floor(i / 3) * 14; for (let a = 0; a < 12; a++) P.px(Math.round(rx + Math.cos(a / 12 * 6.283) * 4), Math.round(ry + Math.sin(a / 12 * 6.283) * 4), a % 2 ? c : l); P.rect(rx - 1, ry - 1, 3, 3, l); P.px(rx, ry, c); P.rect(rx - 2, ry + 4, 2, 5, c); P.rect(rx + 1, ry + 4, 2, 5, c); });
  P.rect(340, 42, 64, 24, 0x14283e); P.box(340, 42, 64, 24, 0x8aa0c0); for (let i = 0; i < 3; i++) { P.rect(344, 46 + i * 6, 3, 3, [0xf0c030, 0xc8ccd4, 0xc06a2a][i]); for (let k = 0; k < 6; k++) P.px(350 + k * 3, 47 + i * 6, k < 4 - i ? 0xf8d860 : 0x3a5a7a); P.rect(390, 46 + i * 6, 10, 3, 0x3a5a7a); for (let k = 0; k < 2; k++) P.px(392 + k * 4, 47 + i * 6, 0xf8d860); }
  affisch(P, 420, 36, 22, 30, 'show'); affisch(P, 448, 36, 22, 30, 'show');
  for (let i = 0; i < 4; i++) tavla(P, 496 + i * 14, 50, 12, 12, ['katt', 'hund', 'kanin', 'hjarta'][i], [0xf4c8d0, 0xc8d4f4, 0xf8e4a0, 0xf4f1ea][i], [0xc8a040, 0xe0c060, 0xf0d880, 0xf8e8a0, 0xfff4c0]);
  brandslackare(P, 52, 66); eluttag(P, 250, 62); eluttag(P, 556, 62);
  // golvet: blankt trägolv, och ringens gröna matta med vit kant
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    const row = ((y - WALL_Y) / 6) | 0, off = (hash(row, 1, 7) * 50) | 0;
    let c = mix(0xc8945a, 0xb88450, hash(((x + off) / 50) | 0, row, 9) * 0.6);
    if ((y - WALL_Y) % 6 === 5) c = mul(c, 0.82); else if ((x + off) % 50 === 0) c = mul(c, 0.86);
    if (((x - y * 2) % 60 + 60) % 60 < 3 && y > WALL_Y + 8) c = mix(c, 0xffffff, 0.12);   // glansen
    P.px(x, y, c);
  }
  for (let i = 0; i < 5; i++) P.darken(0, WALL_Y + i, W, 1, 0.78 + i * 0.045);
  for (let y = RING.y - RING.ry; y <= RING.y + RING.ry; y++) for (let x = RING.x - RING.rx; x <= RING.x + RING.rx; x++) {
    const d = Math.hypot((x - RING.x) / RING.rx, (y - RING.y) / RING.ry);
    if (d > 1) continue;
    P.px(x, y, d > 0.95 ? 0xf4f1ea : d > 0.9 ? 0x2a7a3a : mix(0x3a9a4a, 0x46a858, hash(x >> 1, y >> 1, 11) * 0.5 + (((x >> 3) + (y >> 2)) & 1) * 0.2));
  }
  // en röd löpare från dörren till ringen
  for (let y = 150; y < 162; y++) for (let x = 50; x < RING.x - RING.rx + 4; x++) P.px(x, y, y === 150 || y === 161 ? 0xf0c040 : mix(0xb8283a, 0xa82030, hash(x >> 1, y >> 1, 12) * 0.5));
  dorrmatta(P, DOOR.x0 - 4, 74, DOOR.x1 - DOOR.x0 + 8, 10, 0x1e3a5a, 0x14283e);
  for (let k = 0; k < 24; k++) { const x = 70 + ((hash(k, 1, 31) * 500) | 0), y = 178 + ((hash(k, 2, 31) * 30) | 0); P.px(x, y, [0xd8343c, 0xf0c030, 0x3a7bd5, 0xf4f1ea][k % 4]); }   // konfetti på golvet
  P.box(0, 0, W, H, 0x0e0d12);
  return P.flush();
}
function sign(P, lbl, cx, y, bg, fg, big = false) {
  const F = big ? BIG : SMALL, tw = textW(F, lbl), w = tw + 10, x0 = Math.round(cx - w / 2), h = F.h + 5;
  P.rect(x0, y, w, h, bg); P.box(x0, y, w, h, mix(bg, 0xffffff, 0.3)); P.hl(x0, y + h, w, 0x000000, 0.3);
  text(P, F, lbl, x0 + 5, y + 3, fg);
}

// ================= scenen =================
export function makeUtstallning(A, opts = {}) {
  const g = A.game, S = petStore();
  if (!BG) BG = paintBg();
  let VW = 384;
  const syncView = () => { VW = Math.max(384, Math.min(A.W || 384, W)); };
  const walker = createWalker({ W, H, left: 6, right: W - 6, top: WALL_Y + 6, bottom: H - 4, spawn: opts.fran === 'hopp' ? [DISK.x + DISK.w / 2, DISK.y + DISK.h + 12] : [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 12] });
  walker.speed = 72;
  walker.setObstacles([
    [DISK.x, DISK.y, DISK.x + DISK.w, DISK.y + DISK.h],
    [BURAR.x0, BURAR.y - 6, BURAR.x0 + BURAR.n * BURAR.w, BURAR.y + 2],
    [DOMARBORD.x, DOMARBORD.y, DOMARBORD.x + DOMARBORD.w, DOMARBORD.y + 12],
    [PRIS.x, PRIS.y, PRIS.x + PRIS.w, PRIS.y + 12],
    [LAKTARE.x0, WALL_Y, LAKTARE.x1, WALL_Y + 22],
    [544, 108, 560, 118], [126, 118, 138, 128], [292, 190, 308, 200], [246, 196, 274, 208],   // palmen, vattenautomaten, fotografen, de som står och tittar
  ]);
  walker.snapFree();
  let t = 0, hover = null, hoverT = 0, lockedCam = null, sayIdx = 0, greeted = false;
  const talk = createSpeech();
  const gSay = (s, secs = 4) => talk.say(s, () => ({ x: DISK.x + 30, y: DISK.y - 30 }), secs, { voice: GUNILLA });
  const camTarget = () => lockedCam ?? Math.max(0, Math.min(W - VW, walker.px - VW / 2));
  syncView();
  const cam = { x: camTarget() };
  const egna = () => (S.pets || []).filter((p) => p && p.species);
  const publik = Array.from({ length: 9 }, (_, i) => ({ look: makeLook(() => hash(i, 3, 41)), x: LAKTARE.x0 + 8 + (i % 3) * 22 + (Math.floor(i / 3)) * 4, y: WALL_Y - 12 + Math.floor(i / 3) * 14 }));
  // 📸 fotografen vid ringen (blixtar då och då) och två som står och tittar
  const FOTOGRAF = makeLook(() => hash(9, 3, 41)), STAENDE = [{ look: makeLook(() => hash(10, 3, 41)), x: 252, y: 206 }, { look: { ...makeLook(() => hash(11, 3, 41)), kid: true }, x: 268, y: 208 }];
  const burdjur = (klass) => RIVALER[klass === 'kanin' ? 'katt' : klass].slice(0, 4).map(([namn, ras], i) => ({ id: `rv-${klass}-${i}`, name: namn, species: klass === 'kanin' ? 'katt' : klass, breed: ras, sex: i % 2 ? 'hona' : 'hane', stage: 'vuxen', seed: `rv${i}`, ...(i === 1 ? { frisyr: { s: 'rosett', f: 'rosa' } } : i === 3 ? { frisyr: { s: 'fluff', f: 'natur' } } : {}) }));
  let dagensKlass = KLASSER[g.day % 2].id;    // burarna: katter eller hundar varannan dag
  const iBurar = () => burdjur(dagensKlass);

  // ---------- utställningen i ringen ----------
  let show = null;   // { pet, klass, fas, ft, varv, pose: [..], visare, resultat }
  const tavlade = (p) => p.utst?.dag === g.day;
  function anmalan() {
    if (show) return;
    const djur = egna();
    play('click');
    if (!djur.length) { gSay($t('Du har inget djur att ställa ut! Djuraffären i stan har katter, hundar och kaniner.'), 4); return; }
    const emo = { katt: '🐈', hund: '🐕', kanin: '🐇' };
    const ros = (p) => { const u = p.utst || {}, s = ['katt', 'hund', 'kanin'].map((k) => u[k]).filter(Boolean).reduce((a, r) => [a[0] + r[0], a[1] + r[1], a[2] + r[2]], [0, 0, 0]); return s.some(Boolean) || u.bis ? ` · 🥇${s[0]} 🥈${s[1]} 🥉${s[2]}${u.bis ? ` · 🏆 BIS ${u.bis}` : ''}` : ''; };
    const rader = djur.map((p) => {
      const K = KLASSER.find((k) => k.id === p.species), fr = p.frisyr ? frisyrById(p.frisyr.s) : null, klar = tavlade(p);
      return `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:22px">${emo[p.species] || '🐾'}</span><span class="nm"><b>${esc(p.name)}</b> – ${esc(K?.namn || '')}<br><small class="sp">${fr ? `${fr.icon} ${esc(fr.namn)}` : $t('ingen frisyr')}${ros(p)}</small></span><button class="btn btn-small btn-go" data-anmal="${esc(p.id)}" ${klar || g.money < ANMALAN ? 'disabled' : ''}>${klar ? $t('Tävlat i dag') : $t`Anmäl · ${fmt(ANMALAN)}`}</button></div>`;
    }).join('');
    const dlg = openModal($t('🏆 Anmälan – utställningen'), `<p style="font-size:var(--f2);margin-top:0">${$t('Katter och hundar visas i ringen – gå ett varv och posera när domarna tittar. Kaniner tävlar i hoppning. Varje djur får tävla en gång om dagen.')}</p><div class="plist">${rader}</div>
      <p style="font-size:var(--f2);margin-bottom:0">${$t`🥇 ${fmt(PRISPENGAR[0])} + guldpokal · 🥈 ${fmt(PRISPENGAR[1])} + silverpokal · 🥉 ${fmt(PRISPENGAR[2])} + bronspokal`}<br>${$t`💰 Du har <b>${fmt(g.money)}</b>`}</p>`, [{ label: $t('Inte nu'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-anmal]').forEach((b) => (b.onclick = () => {
      const p = djur.find((q) => q.id === b.dataset.anmal);
      if (!p || tavlade(p)) return;
      if (g.money < ANMALAN) { toast($t('Du har inte råd med anmälan.'), 'bad'); return; }
      g.money -= ANMALAN; g.save(); closeModal(); play('coin');
      if (p.species === 'kanin') { gSay($t`${p.name} hoppar! Lycka till på banan!`, 2); setTimeout(() => A.go('kaninhopp', { petId: p.id, onDone: (res) => efterHopp(A, p.id, res) }), 700); return; }
      starta(p);
    }));
  }
  function starta(p) {
    dagensKlass = p.species;
    show = { pet: p, klass: p.species, fas: 'in', ft: 0, varv: 0, pose: [], visare: 0, forsok: 0, svar: null };
    walker.stop(); walker.px = RING.x - RING.rx - 6; walker.py = RING.y + 2;
    lockedCam = Math.max(0, Math.min(W - VW, RING.x - VW / 2));
    gSay($t`Nästa utställare: ${p.name}! Gå ett varv i ringen.`, 3);
  }
  const ringPos = (u) => ({ x: RING.x - Math.cos(u * Math.PI * 2) * (RING.rx - 14), y: RING.y + Math.sin(u * Math.PI * 2) * (RING.ry - 8) });
  function poseKlick() {
    if (!show || show.fas !== 'pose' || show.svar) return;
    const v = Math.abs(Math.sin(show.visare)), bra = v < 0.14, ok = v < 0.4;
    show.pose.push(bra ? 2 : ok ? 1 : 0);
    show.svar = { txt: bra ? $t('PERFEKT POSE!') : ok ? $t('BRA!') : $t('MISS'), c: bra ? '#7ee07e' : ok ? '#ffd23f' : '#ff9a7a', t: 0 };
    play(bra ? 'ok' : ok ? 'click' : 'fel');
  }
  function bedom() {
    const p = show.pet, perfekta = show.pose.filter((x) => x === 2).length + (show.pose.filter((x) => x === 1).length >= 2 ? 1 : 0);
    const mitt = showPoang(p, g.day, perfekta, hash(g.day, p.id.length, 3));
    const alla = [...rivalPoang(show.klass, g.day).map((r) => ({ ...r })), { namn: p.name, tot: mitt.tot, du: true }].sort((a, b) => b.tot - a.tot);
    const plats = alla.findIndex((x) => x.du) + 1;
    show.resultat = { mitt, alla, plats };
    show.kort = [0, 1, 2].map((i) => Math.max(1, Math.min(10, Math.round(mitt.tot / 10 + (hash(i, g.day, 9) - 0.5) * 1.6))));
  }
  function avsluta() {
    const R = show.resultat, p = show.pet;
    const b = belona(g, S, p, show.klass, R.plats, R.mitt.tot);
    visaResultat(p.name, KLASSER.find((k) => k.id === show.klass), R.plats, R.alla.map((x) => `${x.du ? `<b>${esc(x.namn)}</b>` : esc(x.namn)}`), R.alla.map((x) => $t`${x.tot} p`), b, R.mitt);
    show = null; lockedCam = null;
  }

  // ---------- platserna ----------
  const spots = () => [
    { id: 'dorr', r: [DOOR.x0, 18, DOOR.x1, WALL_Y + 6], go: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 10], label: $t('UT'), act: () => { play('door'); A.tassFran = { hall: true }; A.go('tassbacken'); } },
    { id: 'anmalan', r: [DISK.x, DISK.y - 30, DISK.x + DISK.w, DISK.y + DISK.h], go: [DISK.x + DISK.w / 2, DISK.y + DISK.h + 10], label: $t('ANMÄLAN – STÄLL UT DITT DJUR'), act: anmalan },
    { id: 'gunilla', r: [DISK.x + 18, DISK.y - 34, DISK.x + 42, DISK.y], go: [DISK.x + DISK.w / 2, DISK.y + DISK.h + 10], label: $t('GUNILLA'), act: () => gSay(GUNILLA_SAY[sayIdx++ % GUNILLA_SAY.length]) },
    { id: 'burar', r: [BURAR.x0, BURAR.y - 52, BURAR.x0 + BURAR.n * BURAR.w, BURAR.y], go: [BURAR.x0 + 52, BURAR.y + 12], label: $t('DE ANDRA UTSTÄLLARNA'), act: () => { const d = iBurar()[Math.floor(Math.random() * 4)]; talk.say(d.species === 'hund' ? $t('VOFF!') : $t('Mjau!'), () => ({ x: BURAR.x0 + 52, y: BURAR.y - 50 }), 2, { animal: true, silent: true }); toast($t`🏆 ${d.name} tävlar också i dag. Slå ${d.name} om du kan!`); } },
    { id: 'domare', r: [DOMARBORD.x, DOMARBORD.y - 30, DOMARBORD.x + DOMARBORD.w, DOMARBORD.y + 12], go: [DOMARBORD.x + 40, DOMARBORD.y + 22], label: $t('DOMARNA'), act: () => talk.say($t('Vi bedömer pälsen, hälsan, samarbetet och posen. Lycka till!'), () => ({ x: DOMARBORD.x + 40, y: DOMARBORD.y - 30 }), 3.5, { voice: DOMARE[1] }) },
    { id: 'pris', r: [PRIS.x, PRIS.y - 24, PRIS.x + PRIS.w, PRIS.y + 12], go: [PRIS.x + PRIS.w / 2, PRIS.y + 22], label: $t('PRISBORDET'), act: () => toast($t`🏆 Ettan får ${fmt(PRISPENGAR[0])} och en guldpokal, tvåan ${fmt(PRISPENGAR[1])} och silver, trean ${fmt(PRISPENGAR[2])} och brons. Pokalerna ställer du ut hemma!`, 'wrap') },
    { id: 'laktare', r: [LAKTARE.x0, 30, LAKTARE.x1, WALL_Y + 22], go: [LAKTARE.x0 + 30, WALL_Y + 30], label: $t('LÄKTAREN'), act: () => { play('fanfare'); talk.say($t('HEJA HEJA! 👏'), () => ({ x: LAKTARE.x0 + 36, y: 20 }), 2); } },
  ];
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const focusSpot = () => {
    if (show) return null;
    const h = hover && t - hoverT < 4 && spotAt(hover.x, hover.y);
    if (h) return h;
    if (walker.path.length) return null;
    return spots().find((s) => s.id !== 'dorr' && Math.abs(walker.px - s.go[0]) < 7 && Math.abs(walker.py - s.go[1]) < 7) || null;
  };

  // ---------- ritning ----------
  function drawDisk(ctx) {
    drawPerson(ctx, DISK.x + 30, DISK.y + 12, GUNILLA, 'down', Math.sin(t * 1.6) > 0.93 ? 4 : 0);
    const d = DISK;
    ctx.fillStyle = '#1e3a5a'; ctx.fillRect(d.x, d.y + 6, d.w, d.h - 6); ctx.fillStyle = '#f0c040'; ctx.fillRect(d.x, d.y + 6, d.w, 2); ctx.fillStyle = '#2a4a6a'; ctx.fillRect(d.x + 2, d.y + 12, d.w - 4, d.h - 15);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(d.x + 6, d.y + 2, 14, 5); ctx.fillStyle = '#8a929c'; for (let k = 0; k < 3; k++) ctx.fillRect(d.x + 7, d.y + 3 + k, 12, 1);   // anmälningslistan
    for (let k = 0; k < 3; k++) { ctx.fillStyle = ['#3a7bd5', '#d8343c', '#f0c040'][k]; ctx.fillRect(d.x + 44 + k * 6, d.y + 1, 4, 4); ctx.fillRect(d.x + 45 + k * 6, d.y + 5, 2, 3); }   // rosetterna
  }
  function drawBurar(ctx) {
    const djur = iBurar();
    for (let i = 0; i < BURAR.n; i++) {
      const x = BURAR.x0 + i * BURAR.w, y = BURAR.y;
      ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(x, y - 1, BURAR.w - 2, 3);
      ctx.fillStyle = '#5a5e66'; ctx.fillRect(x, y - 30, BURAR.w - 2, 2); ctx.fillRect(x, y - 2, BURAR.w - 2, 2); ctx.fillRect(x, y - 30, 2, 30); ctx.fillRect(x + BURAR.w - 4, y - 30, 2, 30);
      ctx.fillStyle = ['#f4c4d0', '#c8d4f4', '#f8e4a0', '#b8e0d0'][i]; ctx.fillRect(x + 2, y - 28, BURAR.w - 6, 26);
      drawPet(ctx, x + BURAR.w / 2 - 1, y - 3, djur[i], i % 2 ? 'sit' : 'idle', t, i % 2 ? 'down' : 'right');
      ctx.fillStyle = 'rgba(200,204,212,.8)'; for (let k = x + 4; k < x + BURAR.w - 4; k += 4) ctx.fillRect(k, y - 28, 1, 26);
      ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x + 4, y - 38, BURAR.w - 10, 6); ctxText(ctx, SMALL, String(i + 1), x + 10, y - 37, '#1e1a24');
    }
  }
  function drawDomare(ctx) {
    DOMARE.forEach((L, i) => drawPerson(ctx, DOMARBORD.x + 14 + i * 26, DOMARBORD.y + 6, L, 'down', show?.fas === 'domare' ? 11 : Math.sin(t * 1.3 + i) > 0.94 ? 4 : 0));
    const d = DOMARBORD;
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(d.x, d.y, d.w, 12); ctx.fillStyle = '#1e3a5a'; ctx.fillRect(d.x, d.y + 3, d.w, 9); ctx.fillStyle = '#f0c040'; ctx.fillRect(d.x, d.y + 3, d.w, 1);
    ctxText(ctx, SMALL, $t('DOMARE'), d.x + d.w / 2 - textW(SMALL, $t('DOMARE')) / 2, d.y + 5, '#f8d860');
    // poängkorten när domarna visar dem
    if (show?.fas === 'domare' && show.kort) show.kort.forEach((n, i) => { if (show.ft < 0.5 + i * 0.4) return; const x = d.x + 8 + i * 26, y = d.y - 40; ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 1, y - 1, 14, 12); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x, y, 12, 10); ctxText(ctx, SMALL, String(n), x + (n >= 10 ? 1 : 4), y + 3, '#d8343c'); ctx.fillStyle = '#8a929c'; ctx.fillRect(x + 5, y + 10, 2, 6); });
  }
  function drawPris(ctx) {
    const d = PRIS;
    ctx.fillStyle = '#6a2a3a'; ctx.fillRect(d.x, d.y, d.w, 12); ctx.fillStyle = '#f0c040'; ctx.fillRect(d.x, d.y, d.w, 2);
    for (const [i, c, h] of [[0, '#f0c040', 16], [1, '#c8ccd4', 13], [2, '#c87a3a', 11]]) {
      const x = d.x + 8 + i * 16, y = d.y;
      ctx.fillStyle = c; ctx.fillRect(x, y - h, 8, h - 5); ctx.fillRect(x + 2, y - 5, 4, 3); ctx.fillRect(x + 1, y - 2, 6, 2); ctx.fillRect(x - 2, y - h + 1, 2, 4); ctx.fillRect(x + 8, y - h + 1, 2, 4);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x + 1, y - h + 1, 1, h - 7);
    }
  }
  function drawRingPosts(ctx, fram) {
    // rep och stolpar runt ringen (bakre halvan före djuren, främre halvan efter)
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, x = RING.x + Math.cos(a) * (RING.rx + 3), y = RING.y + Math.sin(a) * (RING.ry + 3);
      if ((Math.sin(a) > 0) !== fram) continue;
      if (Math.abs(x - (RING.x - RING.rx)) < 8 && Math.abs(y - RING.y) < 8) continue;   // ingången från löparen
      ctx.fillStyle = '#c8a040'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 12, 2, 12); ctx.fillStyle = '#f0d070'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 13, 2, 2);
      const b = (k + 1) / 16 * Math.PI * 2, x2 = RING.x + Math.cos(b) * (RING.rx + 3), y2 = RING.y + Math.sin(b) * (RING.ry + 3);
      ctx.fillStyle = '#b8283a'; for (let s = 1; s < 8; s++) { const u = s / 8; ctx.fillRect(Math.round(x + (x2 - x) * u), Math.round(y - 9 + (y2 - y) * u + Math.sin(u * Math.PI) * 2), 1, 1); }
    }
  }
  function drawShow(ctx) {
    if (!show) return;
    const p = show.pet;
    let dp;
    if (show.fas === 'varv') { const u = Math.min(1, show.ft / 6); dp = ringPos(u + 0.04); }
    else if (show.fas === 'in') dp = { x: RING.x - RING.rx + 10, y: RING.y + 2 };
    else dp = { x: RING.x, y: RING.y + 2 };
    const anim = show.fas === 'varv' || show.fas === 'in' ? 'walk' : show.fas === 'pose' ? (show.svar && show.pose[show.pose.length - 1] === 2 ? 'happy' : 'sit') : 'happy';
    const dir = show.fas === 'varv' ? (Math.sin((show.ft / 6) * Math.PI * 2 + 0.25) > 0 ? 'left' : 'right') : 'down';
    drawPet(ctx, dp.x, dp.y, p, anim, t, dir);
    if (show.fas === 'klar') for (let k = 0; k < 8; k++) { if (Math.sin(t * 6 + k * 2) < 0.2) continue; const an = t + k; ctx.fillStyle = k % 2 ? '#ffd23f' : '#ffffff'; ctx.fillRect(Math.round(dp.x + Math.cos(an) * 16), Math.round(dp.y - 10 + Math.sin(an) * 10), 2, 2); }
  }
  function drawPoseMeter(ctx, cx) {
    if (!show || show.fas !== 'pose') return;
    const w = 150, x0 = Math.round(cx + VW / 2 - w / 2), y0 = 44;
    const lbl = $t`POSERA! TRYCK NÄR VISAREN ÄR I DET GRÖNA (${show.forsok + 1}/3)`, bw = Math.max(w, textW(SMALL, lbl)) + 12;
    ctx.fillStyle = 'rgba(20,18,26,.9)'; ctx.fillRect(Math.round(cx + VW / 2 - bw / 2), y0 - 16, bw, 34);
    ctxText(ctx, SMALL, lbl, Math.round(cx + VW / 2 - textW(SMALL, lbl) / 2), y0 - 12, '#f4f1ea');
    ctx.fillStyle = '#d8343c'; ctx.fillRect(x0, y0, w, 10); ctx.fillStyle = '#f0c040'; ctx.fillRect(x0 + w * 0.3, y0, w * 0.4, 10); ctx.fillStyle = '#46c85a'; ctx.fillRect(x0 + w * 0.43, y0, w * 0.14, 10);
    const pos = x0 + w / 2 + Math.sin(show.visare) * (w / 2 - 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(pos) - 1, y0 - 3, 3, 16); ctx.fillStyle = '#1e1a24'; ctx.fillRect(Math.round(pos), y0 - 2, 1, 14);
    if (show.svar) { const s = show.svar, tw = textW(BIG, s.txt); ctxText(ctx, BIG, s.txt, Math.round(cx + VW / 2 - tw / 2), y0 + 20 - Math.round(s.t * 6), s.c); }
  }
  function label(ctx, s, cx) {
    if (!s) return;
    const txt = s.label, w = textW(SMALL, txt) + 10, x = Math.round(Math.max(cx + 2, Math.min(cx + VW - w - 2, (s.r[0] + s.r[2]) / 2 - w / 2))), y = Math.max(2, s.r[1] - 13);
    ctx.fillStyle = 'rgba(20,26,40,.92)'; ctx.fillRect(x, y, w, 11); ctx.fillStyle = '#f0c040'; ctx.fillRect(x, y + 10, w, 1);
    ctxText(ctx, SMALL, txt, x + 5, y + 3, '#ffd23f');
  }

  return {
    viewMax: { w: W, h: H },
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    update(dt) {
      dt = Math.min(0.1, Math.max(0, dt));
      t += dt; syncView();
      if (show) {
        show.ft += dt;
        if (show.fas === 'in' && show.ft > 1.6) { show.fas = 'varv'; show.ft = 0; play('fanfare'); }
        else if (show.fas === 'varv') { const P0 = ringPos(Math.min(1, show.ft / 6)); walker.px = P0.x; walker.py = P0.y + 4; walker.dir = Math.sin((show.ft / 6) * Math.PI * 2) > 0 ? 'left' : 'right'; if (show.ft > 6) { show.fas = 'pose'; show.ft = 0; walker.px = RING.x - 18; walker.py = RING.y + 6; walker.dir = 'right'; gSay($t('Nu posera! Tryck när visaren är i det gröna.'), 2.5); } }
        else if (show.fas === 'pose') {
          show.visare += dt * (2.4 + show.forsok * 0.7);
          if (show.svar) { show.svar.t += dt; if (show.svar.t > 1.1) { show.svar = null; show.forsok++; if (show.forsok >= 3) { show.fas = 'domare'; show.ft = 0; bedom(); play('slide'); } } }
        } else if (show.fas === 'domare' && show.ft > 2.6) { show.fas = 'klar'; show.ft = 0; play(show.resultat.plats <= 3 ? 'fanfare' : 'ok'); }
        else if (show.fas === 'klar' && show.ft > 1.4) avsluta();
      } else walker.update(dt);
      if (!greeted && t > 0.8 && !opts.fran) { greeted = true; gSay(GUNILLA_SAY[0], 5); sayIdx = 1; }
      const k = lockedCam !== null ? Math.min(1, dt * 4) : Math.min(1, dt * 6);
      cam.x += (camTarget() - cam.x) * k;
    },
    draw(ctx) {
      syncView();
      const cx = Math.round(cam.x);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(BG, cx, 0, VW, H, cx, 0, VW, H);
      ritaLampsken(ctx, [300, 372, 444], 32, '255,240,200');
      const focus = focusSpot();
      // banderollen för dagens klass under takstolarna
      const K = KLASSER.find((k) => k.id === (show?.klass || dagensKlass)), bl = `${K.skylt}`, bw = textW(SMALL, bl) + 12;
      ctx.fillStyle = '#d8343c'; ctx.fillRect(RING.x - bw / 2, 30, bw, 9); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(RING.x - bw / 2, 30, bw, 1); ctxText(ctx, SMALL, bl, RING.x - bw / 2 + 6, 32, '#f4f1ea');
      publik.forEach((p, i) => drawPerson(ctx, p.x, p.y, p.look, 'down', show && (show.fas === 'klar' || show.fas === 'varv') ? (Math.floor(t * 4 + i) % 2 ? 10 : 0) : Math.sin(t * 1.4 + i) > 0.9 ? 4 : 5));
      drawRingPosts(ctx, false);
      // under utställningen går figuren varvet med riktiga steg (walker styrs av scenen, inte av en väg)
      const jag = show ? { fy: walker.py, draw: () => drawPerson(ctx, walker.px, walker.py, A.avatar.look, walker.dir, show.fas === 'varv' ? WALK_SEQ[Math.floor(t * 8.5) % 4] : 0) } : selfDrawable(A, walker, t);
      const list = [...folkDrawables(A, t), jag];
      list.push({ fy: DISK.y + DISK.h, draw: () => drawDisk(ctx) });
      list.push({ fy: BURAR.y, draw: () => drawBurar(ctx) });
      list.push({ fy: DOMARBORD.y + 12, draw: () => drawDomare(ctx) });
      list.push({ fy: PRIS.y + 12, draw: () => drawPris(ctx) });
      list.push({ fy: 118, draw: () => ritaKrukvaxt(ctx, 552, 118, 'palm') }, { fy: 128, draw: () => ritaVattenautomat(ctx, 132, 128) });
      list.push({ fy: 200, draw: () => { drawPerson(ctx, 300, 200, FOTOGRAF, 'up', 9); ctx.fillStyle = '#2a2a30'; ctx.fillRect(296, 184, 8, 5); ctx.fillStyle = '#8ad8ff'; ctx.fillRect(299, 185, 2, 2); if (show && Math.floor(t * 3) % 5 === 0) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(292, 178, 16, 6); } } });
      for (const q of STAENDE) list.push({ fy: q.y, draw: () => drawPerson(ctx, q.x, q.y, q.look, 'up', show && show.fas === 'klar' ? (Math.floor(t * 4) % 2 ? 10 : 0) : Math.sin(t * 1.4 + q.x) > 0.9 ? 4 : 0) });
      if (show) { const fy = show.fas === 'varv' ? ringPos(Math.min(1, show.ft / 6) + 0.04).y : RING.y + 2; list.push({ fy, draw: () => drawShow(ctx) }); }
      list.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      drawRingPosts(ctx, true);
      talk.draw(ctx, { x0: cx, x1: cx + VW });
      label(ctx, focus, cx);
      drawPoseMeter(ctx, cx);
    },
    down(sx, sy) {
      if (show) { poseKlick(); return; }
      const x = sx + cam.x, y = sy;
      hover = null;
      const s = spotAt(x, y);
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    key(k) { if (show && (k === ' ' || k === 'Enter')) poseKlick(); },
    move(sx, sy) { hover = { x: sx + cam.x, y: sy }; hoverT = t; },
    exit() { talk.clear(); },
    _debug: {
      spots: () => spots().map((s) => s.id),
      act: (id) => { const s = spots().find((q) => q.id === id); if (!s) return false; s.act(); return true; },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); cam.x = camTarget(); },
      pos: () => ({ x: Math.round(walker.px), y: Math.round(walker.py) }),
      show: () => (show ? { fas: show.fas, ft: show.ft, pose: [...show.pose], forsok: show.forsok, plats: show.resultat?.plats ?? null, tot: show.resultat?.mitt?.tot ?? null } : null),
      // testerna: hoppa fram till posen / lägg visaren mitt i det gröna
      tillPose: () => { if (show && (show.fas === 'in' || show.fas === 'varv')) { show.fas = 'varv'; show.ft = 6.01; } },
      centrera: () => { if (show) show.visare = Math.PI * Math.round(show.visare / Math.PI); },
      tova: () => talk.text?.() ?? null,
    },
  };
}

// resultatet (ringen och hoppningen): placeringslistan, rosetten, pengarna och pokalen
export function visaResultat(namn, K, plats, rader, poang, b, delar = null) {
  const ros = [$t('🥇 1:a plats – blå rosett och guldpokal!'), $t('🥈 2:a plats – röd rosett och silverpokal!'), $t('🥉 3:e plats – gul rosett och bronspokal!')][plats - 1] || $t`${plats}:e plats`;
  const lista = rader.map((r, i) => `<div style="display:flex;justify-content:space-between;font-size:var(--f2)"><span>${i + 1}. ${r}</span><b>${poang[i]}</b></div>`).join('');
  const del = delar ? `<p style="font-size:var(--f2);margin:6px 0 0">${$t`✂️ Päls ${delar.pals} · ❤️ Hälsa ${delar.halsa} · 🤝 Samarbete ${delar.samarbete} · ✨ Pose ${delar.pose}`}</p>` : '';
  setTimeout(() => openModal(`${K.icon} ${esc(namn)}: ${ros}`, `${b.bis ? `<p style="font-size:var(--f3);margin:0 0 6px;text-align:center"><b>${$t('🏆✨ BEST IN SHOW! ✨🏆')}</b></p>` : ''}${lista}${del}
    <div style="border-top:3px dashed var(--ink);margin:8px 0"></div>
    <p style="font-size:var(--f2);margin:0">${b.pris ? $t`💰 Prispengar: <b>${fmt(b.pris)}</b>` : $t('Ingen pall den här gången – försök igen i morgon!')}${b.bis ? ` ${$t`+ ${fmt(BIS_PENGAR)} för Best in Show!`}` : ''}${plats <= 3 ? `<br>${$t('🏆 Pokalen ligger i förrådet – ställ ut den hemma med 🛋️ Möblera!')}` : ''}${b.glad ? ` +${b.glad} 😊` : ''}</p>`,
  [{ label: $t('🎉 Härligt!'), cls: 'btn-go', onClick: closeModal }]), 300);
  play(plats === 1 ? 'fanfare' : 'ok');
}
// tillbaka från kaninhoppningen (js/scenes/kaninhopp.js)
function efterHopp(A, petId, res) {
  const g = A.game, S = petStore(), p = S.petById(petId);
  A.go('utstallning', { fran: 'hopp' });
  if (!p || !res) return;
  const { plats, alla } = hoppPlacering(g.day, res.fel, res.tid);
  const b = belona(g, S, p, 'kanin', plats);
  visaResultat(p.name, KLASSER[2], plats, alla.map((x) => (x.du ? `<b>${esc(p.name)}</b>` : esc(x.namn))), alla.map((x) => $t`${x.fel} fel · ${x.tid.toFixed(1).replace('.', ',')} s`), b);
}
