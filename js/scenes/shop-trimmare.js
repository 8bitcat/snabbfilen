// DJURTRIMMAREN KLIPP & KLO i Tassbacken (Carl 2026-10-12: "kan vi ha olika frisyrer för våra katter").
// 560 px bred salong som rullar med figuren. Från vänster: dörren UT, väntbänken (en hundkund väntar)
// under FRISYRVÄGGEN (sex inramade bilder: en katt med varje frisyr), disken med PRISLISTAN och
// klockan, TRIMBORDET med trimarmen där trimmaren Tova står, fönen på stativ, BADKARET med
// duschslangen och handdukshyllan, och hyllan med schampo och rosetter.
//
// Så går det till: klicka på trimbordet (eller Tova eller frisyrväggen) → välj djur, frisyr och färg
// med förhandsbild → betala → ditt djur står på trimbordet: 🛁 bad (bubblor), 💨 fön, ✂️ klipp
// (pälstussar som faller) och ✨ Tadaa! Frisyren sparas på djuret (petStore().trim, js/pets/trim.js)
// och syns överallt – hemma, på promenaden och (snart) på utställningen. När ingen kund är där
// trimmar Tova salongens egen hund.
//
// _debug-API för tools/trimmare-test.mjs.
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { fmt } from '../game.js';
import { createWalker, selfDrawable, folkDrawables, createSpeech } from './walkable.js';
import { drawPet } from '../pets/sprites.js';
import { petStore } from '../pets/sim.js';
import { FRISYRER, FARGER, NATUR_PRIS, frisyrById, fargById, trimPris } from '../pets/trim.js';
import { $t } from '../core/i18n.js';
import { tavla, affisch, eluttag, brandslackare, dorrmatta, matta, ljusslinga, taklampa, ritaLjusslinga, ritaLampsken, ritaKrukvaxt, ritaPapperskorg } from '../tassbacken/inne-kit.js';   // 🧰 inredningen (v0.134)

const W = 560, H = 216, WALL_Y = 74;
const DOOR = { x0: 14, x1: 46 };
const BANK = { x0: 58, x1: 138, y: 104 };
const BOK = { x: 60, y: 10, cw: 26, ch: 24 };      // frisyrväggen: 3 × 2 ramar
const DISK = { x: 166, y: 82, w: 62, h: 28 };
const BORD = { x: 296, y: 128 };                   // trimbordets mitt (bordsskivan i y−18)
const FON = { x: 342, y: 132 };
const BAD = { x0: 392, x1: 470, y: 112 };
const HYLLA = { x0: 488, x1: 548 };
const TOVA = { skin: '#eec3a0', hair: '#c65fa0', style: 'ponytail', top: 'tee', shirt: '#62c8a0', accent: '#62c8a0', bottom: 'pants', pants: '#2d3a5c', shoes: '#f2f2f2', glasses: false, beard: false, phones: false, bag: null, hat: null, apron: true, build: 4, blush: true, kid: false };
const KUND = { skin: '#c68a5c', hair: '#1d1714', style: 'short', top: 'jacket', shirt: '#3a7bd5', accent: '#2a5aa8', bottom: 'jeans', pants: '#3f5f8f', shoes: '#1c1c1c', glasses: 'round', beard: false, phones: false, bag: null, hat: null, build: 5, blush: false, kid: false };
const TOVA_SAY = [
  $t('Välkommen till Klipp & Klo! ✂️ Klicka på trimbordet så fixar vi ditt djur.'),
  $t('Lejonklipp är populärt på katter i sommar – kort på kroppen och en stor man!'),
  $t('Pompoms på svansen? Absolut! Det funkar på kaniner också.'),
  $t('Färgen är helt ofarlig – den tvättas ur med tiden. Rosa är min favorit!'),
  $t('Snart blir det utställning i hallen. Ett nytrimmat djur får extra poäng av domarna!'),
];
const FASER = [[0, 1.8, 'bad', $t('🛁 Bad och schampo …')], [1.8, 3.4, 'fon', $t('💨 Fönen …')], [3.4, 5.6, 'klipp', $t('✂️ Klipp klipp …')], [5.6, 8, 'klar', $t('✨ Tadaa!')]];
const SEQ_LEN = 8;
// salongens egen hund som Tova trimmar när ingen kund är där
const HUSHUND = { id: 'tr-hus', species: 'hund', breed: 'pudel', sex: 'hona', stage: 'vuxen', seed: 'trimhund' };
const KUNDHUND = { id: 'tr-kund', species: 'hund', breed: 'golden', sex: 'hane', stage: 'vuxen', seed: 'trimkund' };
const BOKKATT = { id: 'tr-bok', species: 'katt', breed: 'blagra', sex: 'hona', stage: 'vuxen', seed: 'trimbok' };

// ================= bakgrunden =================
let BG = null;
function paintBg() {
  const P = new Pix(W, H);
  // väggen: pastellrosa tapet med små vita tassar, vit boasering med mintgrön list
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < W; x++) P.px(x, y, mix(((x / 10) | 0) % 2 ? 0xf4c4d0 : 0xf0bccb, 0xffffff, (bayer(x, y) - 0.5) * 0.06));
  const TS = ['.#.#.', '#...#', '.###.', '.###.'];
  for (let y = 8; y < WALL_Y - 22; y += 14) for (let x = 6; x < W - 6; x += 18) { const ox = x + (((y / 14) | 0) % 2 ? 9 : 0); TS.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') P.px(ox + i, y + j, 0xffffff, 0.5); }); }
  for (let x = 0; x < W; x++) for (let y = WALL_Y - 18; y < WALL_Y; y++) P.px(x, y, y === WALL_Y - 18 ? 0x62c8a0 : y === WALL_Y - 17 ? 0x8ae0c0 : y >= WALL_Y - 2 ? 0xa8a49a : (x % 16 === 0 ? 0xe0dcd4 : 0xf4f1ea));
  P.rect(0, 0, W, 3, 0xe8a0b8); P.hl(0, 3, W, 0xffffff);
  // dörren UT (mintgrön med glasruta)
  P.rect(DOOR.x0 - 3, 18, DOOR.x1 - DOOR.x0 + 6, WALL_Y - 18, 0xf4f1ea);
  for (let y = 20; y < WALL_Y; y++) for (let x = DOOR.x0; x < DOOR.x1; x++) P.px(x, y, mix(0x62c8a0, 0x4ab088, ((x - DOOR.x0) % 8 === 0 ? 0.5 : 0) + hash(x >> 2, y, 3) * 0.15));
  P.rect(DOOR.x0 + 6, 26, 20, 16, 0xb8e4f4); P.box(DOOR.x0 + 6, 26, 20, 16, 0xf4f1ea);
  P.rect(DOOR.x0 + 8, 46, 16, 7, 0x2a6a4a); text(P, SMALL, $t('UT'), DOOR.x0 + 12, 47, 0xf4f1ea);
  P.px(DOOR.x0 + 26, 54, 0xe8b830);
  // frisyrväggen: rubriken (ramarna med katterna ritas live)
  const fl = $t('FRISYRER'), fw = textW(SMALL, fl) + 8; P.rect(BOK.x + 40 - fw / 2, 2, fw, 8, 0xd84a8a); text(P, SMALL, fl, BOK.x + 44 - fw / 2, 3, 0xffffff);
  // stora skylten och prislistan ovanför disken
  bigSign(P, $t('KLIPP & KLO'), 380, 6, 0xf4f1ea, 0xd84a8a);
  const px0 = DISK.x - 2, pw = DISK.w + 4;
  P.rect(px0, 14, pw, 44, 0x2a3a3a); P.box(px0, 14, pw, 44, 0xb07a48);
  text(P, SMALL, $t('PRISLISTA'), px0 + 6, 17, 0xf8d860);
  FRISYRER.slice(0, 6).forEach((f, i) => { const lbl = `${f.pris}:-`; P.rect(px0 + 5, 25 + i * 5, 2, 2, [0xf4f1ea, 0xf8d860, 0xf07ab8, 0x8ae0c0, 0xe0484a, 0xa87ae8][i]); text(P, SMALL, lbl, px0 + pw - 6 - textW(SMALL, lbl), 24 + i * 5, 0xf4f1ea); });
  // klockan
  P.ell(250, 30, 8, 8, 0xf4f1ea, 1, 1); P.box(242, 22, 17, 17, 0xb07a48); P.vl(250, 25, 6, 0x2a2a30); P.hl(250, 30, 4, 0x2a2a30);
  // handdukshyllan över badkaret med rullade handdukar
  P.rect(BAD.x0 + 4, 30, BAD.x1 - BAD.x0 - 8, 3, 0xb07a48); P.hl(BAD.x0 + 4, 30, BAD.x1 - BAD.x0 - 8, 0xd8a070);
  for (let i = 0; i < 6; i++) { const c = [0xf4f1ea, 0x8ae0c0, 0xf4c4d0][i % 3], x = BAD.x0 + 10 + i * 11; P.rect(x, 22, 9, 8, c); P.ell(x + 4.5, 26, 2, 2, mul(c, 0.8), 1, 1); P.hl(x, 22, 9, mix(c, 0xffffff, 0.4)); }
  // kakel bakom badkaret
  for (let y = 36; y < WALL_Y - 18; y++) for (let x = BAD.x0; x < BAD.x1; x++) P.px(x, y, (x - BAD.x0) % 8 === 0 || (y - 36) % 8 === 0 ? 0xc8d8e0 : 0xeef6fa);
  // duschslangen på väggen
  P.rect(BAD.x1 - 18, 38, 6, 3, 0xc8ccd4); for (let k = 0; k < 16; k++) P.px(BAD.x1 - 15 + Math.round(Math.sin(k / 3) * 2), 41 + k, 0x8a929c);
  // hyllan med schampo och rosetter
  for (const sy of [24, 44]) { P.rect(HYLLA.x0, sy, HYLLA.x1 - HYLLA.x0, 2, 0xb07a48); P.hl(HYLLA.x0, sy, HYLLA.x1 - HYLLA.x0, 0xd8a070); }
  for (let i = 0; i < 7; i++) { const c = [0xf07ab8, 0x62c8a0, 0x6ab4f0, 0xf0c040, 0xa87ae8, 0xf4f1ea, 0xe0484a][i], x = HYLLA.x0 + 3 + i * 8; P.rect(x, 14, 5, 10, c); P.rect(x + 1, 11, 3, 3, mul(c, 0.7)); P.vl(x, 15, 8, mix(c, 0xffffff, 0.4)); }
  for (let i = 0; i < 6; i++) { const c = FARGER[1 + i].c, x = HYLLA.x0 + 4 + i * 9; P.rect(x, 38, 3, 4, c); P.rect(x + 4, 38, 3, 4, c); P.rect(x + 3, 39, 1, 2, mul(c, 0.7)); }
  // 🧰 mer på väggen (v0.134): ljusslingan, taklamporna, sminkspegeln med lampor, affischen, tavlorna, eluttagen, brandsläckaren
  ljusslinga(P, W, 6);
  for (const lx of [100, 296, 430]) taklampa(P, lx, 5, 24, [0x7a2a4a, 0xb8406a, 0xe0608a, 0xf090b0, 0xffc0d8]);
  P.rect(266, 12, 60, 40, 0xf4f1ea); P.box(266, 12, 60, 40, 0xd8a070); for (let y = 15; y < 49; y++) for (let x = 269; x < 323; x++) P.px(x, y, mix(0xc8e8f4, 0xa0c8e0, Math.floor(((x - 269) / 54 + (y - 15) / 68) * 2 + bayer(x, y)) / 4));
  for (let x = 271; x < 322; x += 6) { P.px(x, 13, 0xfff0a0); P.px(x, 50, 0xfff0a0); } for (let y = 17; y < 48; y += 6) { P.px(267, y, 0xfff0a0); P.px(324, y, 0xfff0a0); }
  P.line(272, 18, 290, 36, 0xffffff, 0.5); P.line(300, 18, 318, 36, 0xffffff, 0.3);
  affisch(P, 346, 24, 20, 30, 'klipp'); tavla(P, 372, 24, 16, 14, 'hund', 0xf8e4a0); tavla(P, 372, 42, 16, 14, 'katt', 0xb8e0d0);
  eluttag(P, 240, 62); eluttag(P, 478, 62); brandslackare(P, 482, 54);
  // golvet: mintgröna och vita kakelplattor, en tassmatta framför trimbordet
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    const tx = (x / 16) | 0, ty = ((y - WALL_Y) / 10) | 0;
    let c = (tx + ty) % 2 ? 0xd8f0e4 : 0xf4f6f2;
    if ((x % 16) === 15 || ((y - WALL_Y) % 10) === 9) c = mul(c, 0.86);
    P.px(x, y, c);
  }
  for (let i = 0; i < 5; i++) P.darken(0, WALL_Y + i, W, 1, 0.8 + i * 0.04);
  for (let y = 150; y < 176; y++) for (let x = BORD.x - 44; x < BORD.x + 44; x++) P.px(x, y, y === 150 || y === 175 || x === BORD.x - 44 || x === BORD.x + 43 ? 0xd84a8a : mix(0xf4a8c8, 0xf8c0d8, hash(x >> 1, y >> 1, 9) * 0.5));
  for (let k = 0; k < 4; k++) { const cx = BORD.x - 30 + k * 20, cy = 162; TS.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') P.px(cx + i, cy - 2 + j, 0xffffff, 0.8); }); }
  // ljuspölar från taket
  for (const x of [100, 296, 430]) P.ell(x, 150, 46, 14, 0xffffff, 0.1, 4);
  dorrmatta(P, DOOR.x0 - 4, 78, DOOR.x1 - DOOR.x0 + 8, 10, 0x62c8a0, 0x4ab088);
  matta(P, 56, 112, 84, 30, 0xb8e0d0, 0xd8f0e4, 0xd84a8a);
  P.box(0, 0, W, H, 0x0e0d12);
  return P.flush();
}
function bigSign(P, lbl, cx, y, board, fg) {
  const tw = textW(BIG, lbl), w = tw + 16, x0 = Math.round(cx - w / 2), h = 13;
  P.rect(x0, y, w, h, board); P.box(x0, y, w, h, fg);
  text(P, BIG, lbl, x0 + 9, y + 4, mul(fg, 0.6), 0.5);
  text(P, BIG, lbl, x0 + 8, y + 3, fg);
}

// ================= scenen =================
export function makeShopTrimmare(A) {
  const g = A.game, S = petStore();
  if (!BG) BG = paintBg();
  let VW = 384;
  const syncView = () => { VW = Math.max(384, Math.min(A.W || 384, W)); };
  const walker = createWalker({ W, H, left: 6, right: W - 6, top: WALL_Y + 6, bottom: H - 4, spawn: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 12] });
  walker.speed = 72;
  walker.setObstacles([
    [BANK.x0, BANK.y - 10, BANK.x1, BANK.y + 2],
    [DISK.x, DISK.y, DISK.x + DISK.w, DISK.y + DISK.h],
    [BORD.x - 22, BORD.y - 8, BORD.x + 22, BORD.y + 2],
    [FON.x - 6, FON.y - 4, FON.x + 6, FON.y + 2],
    [BAD.x0, BAD.y - 26, BAD.x1, BAD.y + 2],
    [HYLLA.x0, WALL_Y, HYLLA.x1, WALL_Y + 14],
    [538, 116, 554, 126], [242, 106, 254, 116], [470, 176, 494, 186],   // palmen, papperskorgen, barnet med kaninen
  ]);
  walker.snapFree();
  let t = 0, hover = null, hoverT = 0, lockedCam = null, sayIdx = 0, greeted = false;
  let seq = null;            // { pet, s, f, t, klar }
  let husT = 0;              // salongens egen hund: byter frisyr var åttonde sekund
  const tussar = [];         // pälstussar som faller (och ligger kvar på golvet)
  const talk = createSpeech();
  const tSay = (s, secs = 4) => talk.say(s, () => ({ x: BORD.x - 30, y: BORD.y - 40 }), secs, { voice: TOVA });
  const camTarget = () => lockedCam ?? Math.max(0, Math.min(W - VW, walker.px - VW / 2));
  syncView();
  const cam = { x: camTarget() };
  const egna = () => (S.pets || []).filter((p) => p && p.species);

  // 🐇 ett barn som väntar med sin kanin i en korg
  const BARN = { ...makeLook(() => hash(5, 6, 7)), kid: true, hat: null }, BARNKANIN = { id: 'tr-bk', species: 'kanin', breed: 'vadur', sex: 'hona', stage: 'vuxen', seed: 'trbk' };

  // ---------- dialogen: välj djur, frisyr och färg ----------
  let val = { id: null, s: 'lejon', f: 'natur' };
  function oppna() {
    const djur = egna();
    if (!djur.length) { tSay($t('Du har inget husdjur än! Djuraffären i stan säljer katter, hundar och kaniner – kom tillbaka sen så gör vi dem fina. 🐾'), 5); return; }
    if (seq && !seq.klar) { tSay($t('Ett ögonblick – jag är mitt i en klippning!'), 2.5); return; }
    if (!djur.some((p) => p.id === val.id)) val.id = (djur.find((p) => p.out) || djur[0]).id;
    play('click');
    rita();
  }
  function rita() {
    const djur = egna(), pet = djur.find((p) => p.id === val.id) || djur[0];
    const F = frisyrById(val.s), pris = trimPris(val.s, val.s ? val.f : 'natur'), maste = F?.maste;
    if (maste && val.f === 'natur') val.f = 'rosa';
    const emo = { katt: '🐈', hund: '🐕', kanin: '🐇' };
    const nu = pet.frisyr ? `${frisyrById(pet.frisyr.s)?.icon || ''} ${esc(frisyrById(pet.frisyr.s)?.namn || '')}${pet.frisyr.f !== 'natur' ? ` · ${esc(fargById(pet.frisyr.f).namn.toLowerCase())}` : ''}` : $t('naturlig');
    const valj = djur.length > 1 ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">${djur.map((p) => `<button class="btn btn-small ${p.id === pet.id ? 'btn-gold' : ''}" data-pet="${esc(p.id)}">${emo[p.species] || '🐾'} ${esc(p.name)}</button>`).join('')}</div>` : '';
    const rader = [...FRISYRER.map((f) => ({ id: f.id, icon: f.icon, namn: f.namn, text: f.text, pris: f.pris })), { id: '', icon: '🌿', namn: $t('Naturlig'), text: $t('Klipp bort frisyren och färgen – tillbaka som förut.'), pris: NATUR_PRIS }]
      .map((f) => `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:20px">${f.icon}</span><span class="nm">${esc(f.namn)} <small class="sp">${fmt(f.pris)}</small><br><small class="sp">${esc(f.text)}</small></span><button class="btn btn-small ${(val.s || '') === f.id ? 'btn-gold' : ''}" data-stil="${f.id}">${(val.s || '') === f.id ? '✓' : $t('Välj')}</button></div>`).join('');
    const farger = val.s ? `<span class="fb-lbl">${$t('Färg')} <small class="sp">${$t`(+${fmt(80)})`}</small></span><div style="display:flex;flex-wrap:wrap;gap:4px">${FARGER.filter((c) => !(maste && c.id === 'natur')).map((c) => `<button class="btn btn-small ${c.id === val.f ? 'btn-gold' : ''}" data-farg="${c.id}" style="${c.c ? `box-shadow:inset 0 -6px 0 #${c.c.toString(16).padStart(6, '0')}` : ''}">${esc(c.namn)}</button>`).join('')}</div>` : '';
    const dlg = openModal($t('✂️ Klipp & Klo'), `${valj}<div class="fd"><canvas class="fd-big" width="96" height="56"></canvas><div class="fd-side" style="font-size:var(--f2)"><b>${esc(pet.name)}</b><span>${$t`Nu: ${nu}`}</span>${farger}</div></div>
      <div class="plist">${rader}</div>
      <p style="font-size:var(--f2);margin-bottom:0">${$t`💰 Du har <b>${fmt(g.money)}</b> · Pris <b>${fmt(pris)}</b>`}</p>`, [
      { label: $t`✂️ Trimma · ${fmt(pris)}`, cls: 'btn-go', onClick: () => betala(pet, pris) },
      { label: $t('Stäng'), onClick: closeModal },
    ]);
    // förhandsbilden: från sidan och framifrån
    const c = dlg.querySelector('.fd-big').getContext('2d');
    c.fillStyle = '#fbe4ec'; c.fillRect(0, 0, 96, 56); c.fillStyle = '#d8f0e4'; c.fillRect(0, 44, 96, 12); c.fillStyle = '#62c8a0'; c.fillRect(0, 44, 96, 1);
    const prov = { ...pet, frisyr: val.s ? { s: val.s, f: val.f, d: g.day } : undefined };
    drawPet(c, 32, 50, prov, 'idle', 0, 'right'); drawPet(c, 70, 50, prov, 'idle', 0, 'down');
    dlg.querySelectorAll('[data-pet]').forEach((b) => (b.onclick = () => { val.id = b.dataset.pet; play('click'); rita(); }));
    dlg.querySelectorAll('[data-stil]').forEach((b) => (b.onclick = () => { val.s = b.dataset.stil || null; if (frisyrById(val.s)?.maste && val.f === 'natur') val.f = 'rosa'; play('click'); rita(); }));
    dlg.querySelectorAll('[data-farg]').forEach((b) => (b.onclick = () => { val.f = b.dataset.farg; play('click'); rita(); }));
  }
  function betala(pet, pris) {
    if (g.money < pris) { toast($t('Du har inte råd med det här just nu.'), 'bad'); play('fel'); return; }
    g.money -= pris; g.save();
    closeModal(); play('coin');
    seq = { pet, s: val.s, f: val.s ? val.f : 'natur', t: 0, klar: false, fore: pet.frisyr ? { ...pet.frisyr } : null };
    tussar.length = 0;
    tSay($t`${pet.name}! Upp på bordet med dig. Först ett bad …`, 2.4);
  }
  function klart() {
    const sq = seq; if (!sq || sq.klar) return;
    sq.klar = true;
    S.trim(sq.pet.id, sq.s, sq.f, g.day);
    const F = frisyrById(sq.s), namn = sq.pet.name;
    const h = g.glad?.(3, $t('Ditt djur blev fint i trimmaren'), 'trimmare', 3) || 0;
    play('fanfare');
    tSay(sq.s ? $t`Tadaa! ${namn} är jättefin!` : $t`Tadaa! ${namn} är sig själv igen.`, 3);
    toast((sq.s ? $t`✨ ${namn} fick ${F.icon} ${F.namn}${sq.f !== 'natur' ? ` (${fargById(sq.f).namn.toLowerCase()})` : ''}! Frisyren syns hemma, på promenaden och på utställningen.` : $t`🌿 ${namn} är naturlig igen.`) + (h ? ` +${h} 😊` : ''), 'good');
  }

  // ---------- platserna ----------
  const bokRam = (i) => ({ x: BOK.x + (i % 3) * (BOK.cw + 2), y: BOK.y + 2 + Math.floor(i / 3) * (BOK.ch + 4) });
  const spots = () => [
    { id: 'dorr', r: [DOOR.x0, 18, DOOR.x1, WALL_Y + 6], go: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 10], label: $t('UT'), act: () => { play('door'); A.tassFran = { trim: true }; A.go('tassbacken'); } },
    { id: 'bord', r: [BORD.x - 24, BORD.y - 40, BORD.x + 24, BORD.y + 4], go: [BORD.x, BORD.y + 14], label: $t('TRIMBORDET – TRIMMA DITT DJUR'), act: oppna },
    { id: 'tova', r: [BORD.x - 42, BORD.y - 34, BORD.x - 24, BORD.y + 2], go: [BORD.x - 30, BORD.y + 14], label: $t('TRIMMAREN TOVA'), act: () => { if (!egna().length || (seq && !seq.klar)) return oppna(); tSay(TOVA_SAY[sayIdx++ % TOVA_SAY.length]); } },
    { id: 'bok', r: [BOK.x - 2, BOK.y, BOK.x + 3 * (BOK.cw + 2), BOK.y + 2 * (BOK.ch + 4) + 2], go: [BOK.x + 40, WALL_Y + 12], label: $t('FRISYRVÄGGEN'), act: oppna },
    { id: 'bad', r: [BAD.x0, BAD.y - 30, BAD.x1, BAD.y + 2], go: [(BAD.x0 + BAD.x1) / 2, BAD.y + 12], label: $t('BADKARET'), act: () => tSay($t('Badet ingår alltid! Varmt vatten och schampo som luktar äpple. 🍏'), 3) },
    { id: 'hylla', r: [HYLLA.x0, 8, HYLLA.x1, WALL_Y], go: [(HYLLA.x0 + HYLLA.x1) / 2, WALL_Y + 18], label: $t('SCHAMPO OCH ROSETTER'), act: () => tSay($t('Rosetterna finns i sex färger – välj Rosett vid trimbordet!'), 3) },
    { id: 'kund', r: [BANK.x0 + 36, BANK.y - 26, BANK.x0 + 70, BANK.y + 4], go: [BANK.x0 + 56, BANK.y + 14], label: $t('EN KUND SOM VÄNTAR'), act: () => { play('click'); talk.say($t('VOFF!'), () => ({ x: BANK.x0 + 58, y: BANK.y - 24 }), 2, { animal: true, silent: true }); } },
  ];
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const focusSpot = () => {
    const h = hover && t - hoverT < 4 && spotAt(hover.x, hover.y);
    if (h) return h;
    if (walker.path.length) return null;
    return spots().find((s) => s.id !== 'dorr' && Math.abs(walker.px - s.go[0]) < 7 && Math.abs(walker.py - s.go[1]) < 7) || null;
  };

  // ---------- ritning ----------
  const fasOf = (tt) => FASER.find(([a, b]) => tt >= a && tt < b)?.[2] || 'klar';
  function bordsDjur() {
    if (seq) {
      const f = fasOf(seq.t), ny = seq.klar || seq.t >= 5.2;
      const fr = ny ? (seq.s ? { s: seq.s, f: seq.f, d: g.day } : undefined) : seq.fore || undefined;
      return { pet: { ...seq.pet, frisyr: fr }, anim: f === 'klar' || f === 'fon' ? 'happy' : 'idle', fas: f };
    }
    // salongens egen pudel: ny frisyr var åttonde sekund
    const k = Math.floor(husT / 8) % FRISYRER.length, F = FRISYRER[k];
    return { pet: { ...HUSHUND, frisyr: { s: F.id, f: FARGER[1 + (k % 6)].id } }, anim: 'idle', fas: (husT % 8) < 2.4 ? 'klipp' : null };
  }
  function drawBord(ctx) {
    const { x, y } = BORD;
    // bordet: grå skiva på ett ben, trimarmen med öglan
    ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(x - 20, y - 1, 40, 3);
    ctx.fillStyle = '#5a5e66'; ctx.fillRect(x - 2, y - 16, 4, 16); ctx.fillRect(x - 10, y - 2, 20, 2);
    ctx.fillStyle = '#8a929c'; ctx.fillRect(x - 20, y - 20, 40, 4); ctx.fillStyle = '#c8ccd4'; ctx.fillRect(x - 20, y - 20, 40, 1); ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - 20, y - 17, 40, 1);
    ctx.fillStyle = '#5a5e66'; ctx.fillRect(x + 16, y - 46, 2, 26); ctx.fillRect(x + 2, y - 46, 16, 2);
    const B = bordsDjur(), bx = x - 2, by = y - 20;
    ctx.fillStyle = '#d84a8a'; ctx.fillRect(x + 3, y - 44, 1, 8);
    drawPet(ctx, bx, by, B.pet, B.anim, t, 'right');
    // effekterna: bubblor, fönens luft, saxen och tussarna, gnistor
    if (B.fas === 'bad') for (let k = 0; k < 9; k++) { const u = (t * 0.8 + k / 9) % 1, ex = bx - 10 + ((k * 7) % 22), ey = by - 4 - u * 18; ctx.fillStyle = `rgba(255,255,255,${(0.9 - u * 0.6).toFixed(2)})`; ctx.fillRect(Math.round(ex), Math.round(ey), 2, 2); ctx.fillStyle = 'rgba(140,200,240,.6)'; ctx.fillRect(Math.round(ex) + 1, Math.round(ey) + 1, 1, 1); }
    if (B.fas === 'fon') for (let k = 0; k < 6; k++) { const u = (t * 2.2 + k / 6) % 1; ctx.fillStyle = `rgba(255,255,255,${(0.7 * (1 - u)).toFixed(2)})`; ctx.fillRect(Math.round(FON.x - 8 - u * 26), Math.round(FON.y - 30 + (k % 3) * 3 - u * 2), 4, 1); }
    if (B.fas === 'klipp') {
      const sx = bx + Math.round(Math.sin(t * 3) * 6), sy = by - 16 + Math.round(Math.cos(t * 2.3) * 3), open = Math.floor(t * 10) % 2;
      ctx.fillStyle = '#c8ccd4'; ctx.fillRect(sx, sy, 5, 1); ctx.fillRect(sx, sy + (open ? 2 : 1), 5, 1); ctx.fillStyle = '#d84a8a'; ctx.fillRect(sx - 3, sy - 1, 3, 2); ctx.fillRect(sx - 3, sy + (open ? 2 : 1), 3, 2);
      if (Math.random() < 0.15 && tussar.length < 40) tussar.push({ x: bx - 8 + Math.random() * 16, y: by - 10, vy: 6 + Math.random() * 8, c: B.pet.species === 'hund' ? '#e8dcc8' : '#9aa0aa', y1: y + 2 + Math.random() * 10 });
    }
    if (B.fas === 'klar') for (let k = 0; k < 6; k++) { const an = t * 2 + k; if (Math.sin(t * 7 + k * 2) < 0.3) continue; ctx.fillStyle = k % 2 ? '#ffd23f' : '#ffffff'; const px = Math.round(bx + Math.cos(an) * 14), py = Math.round(by - 10 + Math.sin(an) * 9); ctx.fillRect(px, py, 1, 3); ctx.fillRect(px - 1, py + 1, 3, 1); }
    // Tova vid bordet
    drawPerson(ctx, x - 30, y + 2, TOVA, 'right', B.fas === 'klipp' ? (Math.floor(t * 4) % 2 ? 11 : 9) : B.fas === 'bad' || B.fas === 'fon' ? 9 : Math.sin(t * 1.7) > 0.93 ? 4 : 0);
  }
  function drawFon(ctx) {
    const { x, y } = FON;
    ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(x - 7, y - 1, 14, 2);
    ctx.fillStyle = '#5a5e66'; ctx.fillRect(x - 1, y - 30, 2, 30); ctx.fillRect(x - 6, y - 2, 12, 2);
    ctx.fillStyle = '#62c8a0'; ctx.fillRect(x - 10, y - 34, 12, 7); ctx.fillStyle = '#8ae0c0'; ctx.fillRect(x - 10, y - 34, 12, 1); ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - 12, y - 33, 2, 5);
  }
  function drawBad(ctx) {
    const { x0, x1, y } = BAD;
    ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(x0, y - 1, x1 - x0, 3);
    ctx.fillStyle = '#c8ccd4'; ctx.fillRect(x0 + 4, y - 8, 4, 8); ctx.fillRect(x1 - 8, y - 8, 4, 8);
    ctx.fillStyle = '#f4f6f8'; ctx.fillRect(x0, y - 26, x1 - x0, 18); ctx.fillStyle = '#ffffff'; ctx.fillRect(x0, y - 26, x1 - x0, 2); ctx.fillStyle = '#c8d0d8'; ctx.fillRect(x0, y - 10, x1 - x0, 2);
    ctx.fillStyle = '#8ad0f4'; ctx.fillRect(x0 + 3, y - 24, x1 - x0 - 6, 3);
    // skum och en gul badanka
    for (let k = 0; k < 8; k++) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + 6 + k * 9 + Math.round(Math.sin(t * 2 + k) * 1), y - 27 - (k % 2), 4, 2); }
    const dx = x0 + 30 + Math.round(Math.sin(t * 0.9) * 10); ctx.fillStyle = '#f0c040'; ctx.fillRect(dx, y - 29, 5, 3); ctx.fillRect(dx + 3, y - 31, 3, 2); ctx.fillStyle = '#e07a2a'; ctx.fillRect(dx + 6, y - 30, 1, 1);
  }
  function drawDisk(ctx) {
    const d = DISK;
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(d.x, d.y + 6, d.w, d.h - 6); ctx.fillStyle = '#d84a8a'; ctx.fillRect(d.x, d.y + 6, d.w, 2); ctx.fillStyle = '#e0dcd4'; ctx.fillRect(d.x + 2, d.y + 12, d.w - 4, 1);
    for (let k = 0; k < 4; k++) { const cx = d.x + 10 + k * 14; ctx.fillStyle = '#f4a8c8'; ctx.fillRect(cx, d.y + 16, 2, 2); ctx.fillRect(cx + 3, d.y + 16, 2, 2); ctx.fillRect(cx, d.y + 19, 5, 3); }
    ctx.fillStyle = '#2a3a3a'; ctx.fillRect(d.x + 40, d.y, 14, 7); ctx.fillStyle = '#8ae0c0'; ctx.fillRect(d.x + 42, d.y + 1, 8, 2);
    ctx.fillStyle = '#b07a48'; ctx.fillRect(d.x + 8, d.y + 2, 12, 4); ctx.fillStyle = '#e8c890'; for (let k = 0; k < 4; k++) ctx.fillRect(d.x + 9 + k * 3, d.y + 1, 2, 2);   // hundgodis i skålen
  }
  function drawBank(ctx) {
    const b = BANK;
    ctx.fillStyle = 'rgba(20,12,30,.22)'; ctx.fillRect(b.x0, b.y - 1, b.x1 - b.x0, 3);
    ctx.fillStyle = '#d84a8a'; ctx.fillRect(b.x0, b.y - 12, b.x1 - b.x0, 6); ctx.fillStyle = '#f07ab8'; ctx.fillRect(b.x0, b.y - 12, b.x1 - b.x0, 2);
    ctx.fillStyle = '#b07a48'; ctx.fillRect(b.x0 + 2, b.y - 6, 3, 6); ctx.fillRect(b.x1 - 5, b.y - 6, 3, 6);
  }
  function drawBok(ctx, on) {
    for (let i = 0; i < 6; i++) {
      const { x, y } = bokRam(i), F = FRISYRER[i];
      ctx.fillStyle = '#b07a48'; ctx.fillRect(x, y, BOK.cw, BOK.ch); ctx.fillStyle = '#fff4f8'; ctx.fillRect(x + 2, y + 2, BOK.cw - 4, BOK.ch - 4);
      ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + 2, BOK.cw - 4, BOK.ch - 4); ctx.clip();
      drawPet(ctx, x + BOK.cw / 2, y + BOK.ch - 3, { ...BOKKATT, frisyr: { s: F.id, f: FARGER[1 + i].id } }, 'sit', 0.5, 'down');
      ctx.restore();
    }
    if (on) { ctx.fillStyle = 'rgba(255,210,63,.25)'; ctx.fillRect(BOK.x - 2, BOK.y, 3 * (BOK.cw + 2) + 2, 2 * (BOK.ch + 4) + 2); }
  }
  function label(ctx, s, cx) {
    if (!s) return;
    const txt = s.label, w = textW(SMALL, txt) + 10, x = Math.round(Math.max(cx + 2, Math.min(cx + VW - w - 2, (s.r[0] + s.r[2]) / 2 - w / 2))), y = Math.max(2, s.r[1] - 13);
    ctx.fillStyle = 'rgba(40,16,30,.92)'; ctx.fillRect(x, y, w, 11); ctx.fillStyle = '#d84a8a'; ctx.fillRect(x, y + 10, w, 1);
    ctxText(ctx, SMALL, txt, x + 5, y + 3, '#ffd23f');
  }

  return {
    viewMax: { w: W, h: H },
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    update(dt) {
      dt = Math.min(0.1, Math.max(0, dt));
      t += dt; husT += dt; syncView(); walker.update(dt);
      if (seq && !seq.klar) {
        const f0 = fasOf(seq.t);
        seq.t += dt;
        const f1 = fasOf(seq.t);
        if (f1 !== f0) { const F = FASER.find((q) => q[2] === f1); if (F && f1 !== 'klar') tSay(F[3], 1.6); play(f1 === 'fon' ? 'slide' : 'click'); }
        if (seq.t >= 5.6) klart();
      }
      for (const q of tussar) if (q.y < q.y1) q.y = Math.min(q.y1, q.y + q.vy * dt);
      if (!greeted && t > 0.8) { greeted = true; tSay(egna().length ? TOVA_SAY[0] : $t('Välkommen till Klipp & Klo! Har du ett husdjur så gör vi det jättefint här. ✂️'), 5); sayIdx = 1; }
      const k = lockedCam !== null ? 1 : Math.min(1, dt * 6);
      cam.x += (camTarget() - cam.x) * k;
    },
    draw(ctx) {
      syncView();
      const cx = Math.round(cam.x);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(BG, cx, 0, VW, H, cx, 0, VW, H);
      ritaLjusslinga(ctx, t, W, 7); ritaLampsken(ctx, [100, 296, 430], 31, '255,200,230');
      const focus = focusSpot();
      drawBok(ctx, focus?.id === 'bok');
      for (const q of tussar) { ctx.fillStyle = q.c; ctx.fillRect(Math.round(q.x), Math.round(q.y), 2, 1); }
      const list = [...folkDrawables(A, t), selfDrawable(A, walker, t)];
      list.push({ fy: BANK.y, draw: () => { drawBank(ctx); drawPerson(ctx, BANK.x0 + 22, BANK.y - 2, KUND, 'down', 5); drawPet(ctx, BANK.x0 + 56, BANK.y + 6, KUNDHUND, 'sit', t, 'left'); } });
      list.push({ fy: DISK.y + DISK.h, draw: () => drawDisk(ctx) });
      list.push({ fy: BORD.y, draw: () => drawBord(ctx) });
      list.push({ fy: FON.y, draw: () => drawFon(ctx) });
      list.push({ fy: BAD.y, draw: () => drawBad(ctx) });
      list.push({ fy: 126, draw: () => ritaKrukvaxt(ctx, 546, 126, 'palm') }, { fy: 116, draw: () => ritaPapperskorg(ctx, 248, 116, 0xd84a8a) });
      list.push({ fy: 186, draw: () => { drawPerson(ctx, 482, 186, BARN, 'left', Math.sin(t * 1.5) > 0.9 ? 4 : 0); ctx.fillStyle = '#b8894a'; ctx.fillRect(464, 178, 14, 7); ctx.fillStyle = '#d8a96a'; for (let x = 464; x < 478; x += 3) ctx.fillRect(x, 178, 1, 7); drawPet(ctx, 471, 181, BARNKANIN, 'idle', t, 'left'); } });
      list.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      talk.draw(ctx, { x0: cx, x1: cx + VW });
      label(ctx, focus, cx);
    },
    down(sx, sy) {
      const x = sx + cam.x, y = sy;
      hover = null;
      const s = spotAt(x, y);
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { hover = { x: sx + cam.x, y: sy }; hoverT = t; },
    exit() { talk.clear(); },
    _debug: {
      spots: () => spots().map((s) => s.id),
      spot: (id) => {
        const s = spots().find((q) => q.id === id);
        if (!s) return null;
        const x = (s.r[0] + s.r[2]) / 2;
        if (lockedCam === null && (x - cam.x < 8 || x - cam.x > VW - 8)) cam.x = Math.max(0, Math.min(W - VW, x - VW / 2));
        return { x: Math.round(x - cam.x), y: Math.round((s.r[1] + s.r[3]) / 2) };
      },
      act: (id) => { const s = spots().find((q) => q.id === id); if (!s) return false; s.act(); return true; },
      lockCam: (x) => { lockedCam = x === null || x === undefined ? null : Math.max(0, Math.min(W - VW, x)); cam.x = camTarget(); },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); cam.x = camTarget(); },
      pos: () => ({ x: Math.round(walker.px), y: Math.round(walker.py) }),
      seq: () => (seq ? { t: seq.t, klar: seq.klar, s: seq.s, f: seq.f, pet: seq.pet.id } : null),
      snabba: () => { if (seq && !seq.klar) { seq.t = 5.59; } },
      tova: () => talk.text?.() ?? null,
    },
  };
}
