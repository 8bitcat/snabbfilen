// KATTCAFÉ KURR i Tassbacken – fika bland katterna som bor här (Carl 2026-10-12: "bygg allting inklusive
// stadsdelarna"). 560 px brett kafé som rullar med figuren. Från vänster: dörren UT, KLÖSTRÄDET (två katter
// på hyllorna), DISKEN med Kerstin och bullarna, tre bord med stolar, korgarna på golvet och det stora
// FÖNSTRET med fönsterbänken där katterna solar. Högt uppe längs väggen går KATTGÅNGEN – en katt
// promenerar fram och tillbaka på hyllorna.
//
// Sju katter bor här (Smulan, Kanel, Pepparkaka, Sotis, Mysan, Doris och Leo) och sover, sitter, går runt
// och leker med garnnystanet. Klicka på en katt: gå fram och klappa (den spinner). Köp FIKA vid disken
// (kaffe, varm choklad, kanelbulle, kattkaka) och sätt dig vid ett bord – då kommer en katt och lägger sig
// på bordet. Köper man ett FJÄDERSPÖ springer katterna efter det dit man klickar på golvet.
// Katterna kommer från djurhemmet Tassarnas hem (skylten berättar).
//
// _debug-API för tools/kattcafe-test.mjs.
import { drawPerson } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { fmt } from '../game.js';
import { createWalker, selfDrawable, folkDrawables, createSpeech } from './walkable.js';
import { drawPet } from '../pets/sprites.js';
import { $t } from '../core/i18n.js';

const W = 560, H = 216, WALL_Y = 72;
const DOOR = { x0: 14, x1: 46 };
const TRAD = { x: 76, y: 112 };                    // klösträdets fot
const DISK = { x: 112, y: 82, w: 76, h: 26 };
const BORD = [{ x: 240, y: 150 }, { x: 330, y: 178 }, { x: 410, y: 146 }];
const KORGAR = [{ x: 206, y: 196 }, { x: 476, y: 200 }];
const FONSTER = { x0: 442, x1: 550, y: 104 };      // fönsterbänken (katterna ligger på den)
const GANG = { x0: 206, x1: 420, y: 36 };           // kattgången högt uppe på väggen
const KERSTIN = { skin: '#f6d7bf', hair: '#d9a95c', style: 'bun', top: 'sweater', shirt: '#e0a030', accent: '#f4f1ea', bottom: 'pants', pants: '#5a4632', shoes: '#6b3e1e', glasses: 'round', beard: false, phones: false, bag: null, hat: null, apron: true, build: 4, blush: true, kid: false };
export const FIKA = [
  { id: 'kaffe', icon: '☕', namn: $t('Kaffe'), pris: 25, hunger: 3, energi: 12, glad: 1 },
  { id: 'choklad', icon: '🍫', namn: $t('Varm choklad med grädde'), pris: 30, hunger: 8, energi: 4, glad: 2 },
  { id: 'bulle', icon: '🥐', namn: $t('Kanelbulle'), pris: 20, hunger: 15, energi: 2, glad: 1 },
  { id: 'kattkaka', icon: '🍪', namn: $t('Kattkaka (med öron!)'), pris: 35, hunger: 18, energi: 2, glad: 3 },
];
export const SPO_PRIS = 20;
const KERSTIN_SAY = [
  $t('Välkommen till Kurr! ☕ Fika vid disken – och klappa gärna katterna, de älskar det.'),
  $t('Alla katterna här kommer från Tassarnas hem. Vill du adoptera? Fråga där!'),
  $t('Sätt dig vid ett bord med din fika, så kommer det snart en katt och håller dig sällskap.'),
  $t('Ett fjäderspö kostar 20 kr – katterna blir tokiga i det!'),
  $t('Smulan är äldst. Hon sover nästan jämt i fönstret.'),
];
// katterna: namn, ras, var de håller till ('trad0'/'trad1' = klösträdet, 'fonster', 'gang', 'golv', 'korg')
const KATTER = [
  { namn: 'Smulan', ras: 'blagra', plats: 'fonster', x: 470 }, { namn: 'Kanel', ras: 'rodkatt', plats: 'trad1' }, { namn: 'Pepparkaka', ras: 'tigrerad', plats: 'golv' },
  { namn: 'Sotis', ras: 'svart', plats: 'gang' }, { namn: 'Mysan', ras: 'skoldpadd', plats: 'korg', k: 0 }, { namn: 'Doris', ras: 'siames', plats: 'fonster', x: 520 }, { namn: 'Leo', ras: 'smoking', plats: 'golv' },
];

// ================= bakgrunden =================
let BG = null;
function paintBg() {
  const P = new Pix(W, H);
  // väggen: varm gul tapet med små fiskar, träpanel med list
  const FISK = ['.##..#', '#####.', '.##..#'];
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < W; x++) P.px(x, y, mix(0xf4dc98, 0xf0d488, ((x >> 3) & 1) * 0.5 + (bayer(x, y) - 0.5) * 0.15));
  for (let y = 6; y < WALL_Y - 22; y += 13) for (let x = 4; x < W - 8; x += 20) { const ox = x + (((y / 13) | 0) % 2 ? 10 : 0); FISK.forEach((r, j) => { for (let i = 0; i < 6; i++) if (r[i] === '#') P.px(ox + i, y + j, 0xe0a030, 0.45); }); }
  for (let x = 0; x < W; x++) for (let y = WALL_Y - 20; y < WALL_Y; y++) P.px(x, y, y === WALL_Y - 20 ? 0x8a5a30 : y === WALL_Y - 19 ? 0xb07a48 : y >= WALL_Y - 2 ? 0x5a3a1e : ((x % 14) === 0 ? 0x8a5a30 : mix(0xa8703c, 0x9a6434, hash(x >> 2, y, 3) * 0.5)));
  P.rect(0, 0, W, 3, 0x8a5a30); P.hl(0, 3, W, 0xc8945a);
  // dörren UT
  P.rect(DOOR.x0 - 3, 18, DOOR.x1 - DOOR.x0 + 6, WALL_Y - 18, 0x5a3a1e);
  for (let y = 20; y < WALL_Y; y++) for (let x = DOOR.x0; x < DOOR.x1; x++) P.px(x, y, mix(0x6a4a3a, 0x5a3a2a, ((x - DOOR.x0) % 8 === 0 ? 0.6 : 0) + hash(x >> 2, y, 3) * 0.2));
  P.rect(DOOR.x0 + 6, 24, 20, 16, 0xb8e4f4); P.box(DOOR.x0 + 6, 24, 20, 16, 0xf4f1ea); P.rect(DOOR.x0 + 6, 44, 20, 9, 0x1d2b1f); text(P, SMALL, $t('UT'), DOOR.x0 + 12, 46, 0x6fe08a);
  // menytavlan ovanför disken
  const mx = DISK.x + 2, mw = DISK.w - 4;
  P.rect(mx, 12, mw, 34, 0x2a3a2a); P.box(mx, 12, mw, 34, 0x8a5a30);
  text(P, SMALL, $t('MENY'), mx + (mw >> 1) - (textW(SMALL, $t('MENY')) >> 1), 15, 0xf8d860);
  FIKA.forEach((f, i) => { const s = `${f.pris}:-`; P.rect(mx + 4, 23 + i * 6, 3, 3, [0x8a5a30, 0x5a3a28, 0xd8a050, 0xf0c040][i]); text(P, SMALL, s, mx + mw - 4 - textW(SMALL, s), 22 + i * 6, 0xf4f1ea); });
  // skylten
  bigSign(P, $t('KATTCAFÉ KURR'), 330, 4, 0x3a2a2a, 0xf8d860);
  // kattgången: hyllor högt upp längs väggen med små trappsteg
  for (let x = GANG.x0; x <= GANG.x1; x += 2) { P.px(x, GANG.y, 0xb07a48); P.px(x, GANG.y + 1, 0x8a5a30); P.px(x, GANG.y + 2, 0x5a3a1e, 0.6); }
  for (let x = GANG.x0 + 8; x < GANG.x1; x += 40) P.vl(x, GANG.y + 2, 4, 0x5a3a1e);
  // tavlan om djurhemmet
  P.rect(160, 50, 30, 18, 0xf4f1ea); P.box(160, 50, 30, 18, 0xa8382a); text(P, SMALL, $t('ADOPTERA'), 162, 53, 0xa8382a); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, -2], [1, -3], [3, -2], [-2, 0], [3, 0]]) P.px(174 + dx, 62 + dy, 0xa8382a);
  // fönstret med utsikt mot gatan (soligt)
  const fx0 = FONSTER.x0, fx1 = FONSTER.x1;
  P.rect(fx0 - 3, 8, fx1 - fx0 + 6, 66, 0xf4f1ea);
  for (let y = 11; y < 70; y++) for (let x = fx0; x < fx1; x++) P.px(x, y, qm(0xb8e0f8, 0x7ab8e0, (y - 11) / 59, x, y));
  for (let x = fx0; x < fx1; x++) { const h = 50 + Math.round(Math.sin(x / 9) * 3); for (let y = h; y < 70; y++) P.px(x, y, mix(0x5aa848, 0x4a9a3a, hash(x >> 1, y >> 1, 5))); }   // träden utanför
  P.vl((fx0 + fx1) >> 1, 11, 59, 0xf4f1ea); P.hl(fx0, 38, fx1 - fx0, 0xf4f1ea);
  for (let k = 0; k < 6; k++) P.line(fx0 + 6 + k * 16, 14, fx0 + 20 + k * 16, 30, 0xffffff, 0.35);   // glansen
  // golvet: varma brädor, en trasmatta mitt i rummet och solfläcken från fönstret
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    const row = ((y - WALL_Y) / 7) | 0, off = (hash(row, 1, 7) * 40) | 0;
    let c = mul(0xb07a48, 0.9 + hash(((x + off) / 40) | 0, row, 9) * 0.14);
    if ((y - WALL_Y) % 7 === 6) c = mul(c, 0.78); else if ((x + off) % 40 === 0) c = mul(c, 0.82);
    P.px(x, y, c);
  }
  for (let i = 0; i < 5; i++) P.darken(0, WALL_Y + i, W, 1, 0.78 + i * 0.045);
  for (let y = 128; y < 196; y++) for (let x = 216; x < 446; x++) { const e = x === 216 || x === 445 || y === 128 || y === 195; P.px(x, y, e ? 0xa8382a : (((y - 128) >> 2) & 1) ? mix(0xd8a050, 0xc89040, hash(x >> 2, y, 6) * 0.4) : mix(0xe0c8a0, 0xd0b890, hash(x >> 2, y, 7) * 0.4)); }
  for (let y = WALL_Y + 4; y < WALL_Y + 40; y++) for (let x = FONSTER.x0 - 10; x < FONSTER.x1 + 4; x++) { const k = (x - FONSTER.x0 + 10) - (y - WALL_Y) * 0.6; if (k > 0 && k < 100) P.px(x, y, 0xfff4c8, 0.16); }
  P.box(0, 0, W, H, 0x0e0d12);
  return P.flush();
}
const qm = (a, b, t, x, y) => mix(a, b, Math.floor(Math.max(0, Math.min(1, t)) * 4 + bayer(x, y)) / 4);
function bigSign(P, lbl, cx, y, board, fg) {
  const tw = textW(BIG, lbl), w = tw + 16, x0 = Math.round(cx - w / 2), h = 13;
  P.rect(x0, y, w, h, board); P.box(x0, y, w, h, fg);
  text(P, BIG, lbl, x0 + 8, y + 3, fg);
}

// ================= scenen =================
export function makeShopKattcafe(A) {
  const g = A.game;
  if (!BG) BG = paintBg();
  let VW = 384;
  const syncView = () => { VW = Math.max(384, Math.min(A.W || 384, W)); };
  const walker = createWalker({ W, H, left: 6, right: W - 6, top: WALL_Y + 6, bottom: H - 4, spawn: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 12] });
  walker.speed = 72;
  walker.setObstacles([
    [TRAD.x - 14, TRAD.y - 8, TRAD.x + 14, TRAD.y + 2],
    [DISK.x, DISK.y, DISK.x + DISK.w, DISK.y + DISK.h],
    ...BORD.map((b) => [b.x - 10, b.y - 6, b.x + 10, b.y + 1]),
    [FONSTER.x0 - 4, WALL_Y, FONSTER.x1 + 4, FONSTER.y + 4],
    [233, WALL_Y, 303, 101], [199, 106, 213, 113], [307, 100, 317, 105],   // soffan, krukväxten, golvlampan
  ]);
  walker.snapFree();
  let t = 0, hover = null, hoverT = 0, lockedCam = null, sayIdx = 0, greeted = false;
  let sitter = null, spo = false, spoMal = null, fika = null;   // sitter = bordets index; spoMal = { x, y, t }
  const talk = createSpeech();
  const kSay = (s, secs = 4) => talk.say(s, () => ({ x: DISK.x + 38, y: DISK.y - 30 }), secs, { voice: KERSTIN });
  const camTarget = () => lockedCam ?? Math.max(0, Math.min(W - VW, walker.px - VW / 2));
  syncView();
  const cam = { x: camTarget() };

  // ---------- katterna ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const golv = () => [rnd(210, 520), rnd(118, 206)];
  const katter = KATTER.map((K, i) => {
    const pet = { id: `kurr-${i}`, name: K.namn, species: 'katt', breed: K.ras, sex: i % 3 ? 'hona' : 'hane', stage: 'vuxen', seed: `kurr${i}` };
    const k = { ...K, pet, i, state: 'sitt', tm: rnd(1, 5), dir: i % 2 ? 'left' : 'right', klapp: 0 };
    if (K.plats === 'fonster') Object.assign(k, { x: K.x, y: FONSTER.y - 4, state: 'sov' });
    else if (K.plats === 'trad1') Object.assign(k, { x: TRAD.x + 6, y: TRAD.y - 30, state: 'sitt' });
    else if (K.plats === 'gang') Object.assign(k, { x: GANG.x0 + 20, y: GANG.y, state: 'ga', tx: GANG.x1 - 10, ty: GANG.y });
    else if (K.plats === 'korg') Object.assign(k, { x: KORGAR[K.k].x, y: KORGAR[K.k].y - 2, state: 'sov' });
    else { const [x, y] = golv(); Object.assign(k, { x, y }); }
    return k;
  });
  const KATT2 = { pet: { id: 'kurr-trad0', name: 'Pelle', species: 'katt', breed: 'vit', sex: 'hane', stage: 'vuxen', seed: 'kurrt0' }, x: TRAD.x - 8, y: TRAD.y - 16, state: 'sov', dir: 'right', plats: 'trad0' };
  function updKatter(dt) {
    for (const k of katter) {
      k.tm -= dt; if (k.klapp > 0) k.klapp -= dt;
      if (k.plats === 'gang') {
        const dx = k.tx - k.x, step = 12 * dt;
        if (k.state === 'ga') { k.dir = dx < 0 ? 'left' : 'right'; if (Math.abs(dx) <= step) { k.x = k.tx; k.state = 'sitt'; k.tm = rnd(2, 5); } else k.x += Math.sign(dx) * step; }
        else if (k.tm <= 0) { k.tx = k.x > (GANG.x0 + GANG.x1) / 2 ? GANG.x0 + 10 : GANG.x1 - 10; k.state = 'ga'; }
        continue;
      }
      if (k.plats !== 'golv' || k.klapp > 0) continue;
      // fjäderspöet: golvkatterna springer dit och leker
      if (spoMal && t - spoMal.t < 4) { k.tx = spoMal.x + (k.i % 2 ? -8 : 8); k.ty = spoMal.y + 2; k.state = 'ga'; k.spring = true; }
      if (k.state === 'ga') {
        const dx = k.tx - k.x, dy = k.ty - k.y, d = Math.hypot(dx, dy), step = (k.spring ? 48 : 16) * dt;
        if (Math.abs(dx) > 0.5) k.dir = dx < 0 ? 'left' : 'right';
        if (d <= step) { k.x = k.tx; k.y = k.ty; k.state = k.spring ? 'lek' : Math.random() < 0.4 ? 'sov' : 'sitt'; k.spring = false; k.tm = rnd(2, 7); }
        else { k.x += dx / d * step; k.y += dy / d * step; }
      } else if (k.tm <= 0) {
        // sitter man vid ett bord: en katt kommer och lägger sig på bordet bredvid
        if (sitter !== null && !katter.some((q) => q.paBord)) { const B = BORD[sitter]; k.tx = B.x + 6; k.ty = B.y - 2; k.state = 'ga'; k.paBord = true; continue; }
        [k.tx, k.ty] = golv(); k.state = 'ga'; k.paBord = false;
      }
    }
  }
  const kattAt = (x, y) => [...katter, KATT2].find((k) => Math.abs(k.x - x) < 9 && y < k.y + 3 && y > k.y - 14);
  function klappa(k) {
    k.klapp = 2.5; k.state = 'sitt'; k.tm = 3;
    talk.say(Math.random() < 0.5 ? $t('Purrr … ❤️') : $t('Mjau! 😺'), () => ({ x: k.x, y: k.y - (k.plats === 'gang' ? 18 : 16) }), 2.2, { animal: true, silent: true });
    play('click');
    const h = g.glad?.(1, $t('Kattcaféet'), 'kattcafe', 3); if (h) toast(`😊 +${h}`);
  }

  // ---------- fika och fjäderspöet ----------
  function meny() {
    play('click');
    const rader = FIKA.map((f) => `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:22px">${f.icon}</span><span class="nm">${esc(f.namn)}<br><small class="sp">${fmt(f.pris)}</small></span><button class="btn btn-small btn-go" data-fika="${f.id}" ${g.money < f.pris ? 'disabled' : ''}>${$t('Köp')}</button></div>`).join('')
      + `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:22px">🪶</span><span class="nm">${$t('Fjäderspö – lek med katterna')}<br><small class="sp">${spo ? $t('Du har ett!') : fmt(SPO_PRIS)}</small></span><button class="btn btn-small" data-spo ${spo || g.money < SPO_PRIS ? 'disabled' : ''}>${$t('Köp')}</button></div>`;
    const dlg = openModal($t('☕ Kattcafé Kurr'), `<p style="font-size:var(--f2);margin-top:0">${$t('Sätt dig vid ett bord med fikat – då kommer en katt och håller dig sällskap.')}</p><div class="plist">${rader}</div>`, [{ label: $t('Stäng'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-fika]').forEach((b) => (b.onclick = () => {
      const f = FIKA.find((q) => q.id === b.dataset.fika);
      if (!f || g.money < f.pris) return;
      g.money -= f.pris;
      g.hunger = Math.min(100, (g.hunger || 0) + f.hunger); g.energy = Math.min(100, (g.energy || 0) + f.energi);
      const h = g.glad?.(f.glad, $t('Fika på kattcaféet'), 'kattfika', 4) || 0;
      g.save(); closeModal(); play('coin');
      fika = { f, t: 0 };
      toast($t`${f.icon} ${f.namn}! Sätt dig vid ett bord, så kommer en katt.` + (h ? ` +${h} 😊` : ''), 'good');
    }));
    const sb = dlg.querySelector('[data-spo]');
    if (sb) sb.onclick = () => { if (spo || g.money < SPO_PRIS) return; g.money -= SPO_PRIS; g.save(); spo = true; closeModal(); play('coin'); toast($t('🪶 Fjäderspöet! Klicka på golvet så springer katterna dit.'), 'good'); };
  }
  function sattDig(i) {
    const B = BORD[i];
    if (sitter === i) { sitter = null; katter.forEach((k) => (k.paBord = false)); return; }
    walker.walkTo(B.x - 14, B.y + 2, () => { sitter = i; walker.dir = 'right'; for (const k of katter) if (k.plats === 'golv' && k.state !== 'ga') k.tm = Math.min(k.tm, 1.2); });
  }

  // ---------- platserna ----------
  const spots = () => [
    { id: 'dorr', r: [DOOR.x0, 18, DOOR.x1, WALL_Y + 6], go: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 10], label: $t('UT'), act: () => { play('door'); A.tassFran = { kafe: true }; A.go('tassbacken'); } },
    { id: 'disk', r: [DISK.x, DISK.y - 34, DISK.x + DISK.w, DISK.y + DISK.h], go: [DISK.x + DISK.w / 2, DISK.y + DISK.h + 10], label: $t('DISKEN – FIKA'), act: meny },
    ...BORD.map((B, i) => ({ id: 'bord' + i, r: [B.x - 12, B.y - 14, B.x + 12, B.y + 2], go: [B.x - 14, B.y + 2], label: sitter === i ? $t('RES DIG') : $t('SÄTT DIG'), act: () => sattDig(i) })),
    { id: 'trad', r: [TRAD.x - 16, TRAD.y - 46, TRAD.x + 16, TRAD.y], go: [TRAD.x + 18, TRAD.y + 8], label: $t('KLÖSTRÄDET'), act: () => toast($t('🐈 Pelle och Kanel har de bästa platserna i klösträdet.')) },
    { id: 'fonster', r: [FONSTER.x0, 8, FONSTER.x1, FONSTER.y + 2], go: [(FONSTER.x0 + FONSTER.x1) / 2, FONSTER.y + 14], label: $t('FÖNSTERBÄNKEN'), act: () => toast($t('☀️ Smulan och Doris solar i fönstret. Smulan är äldst och sover nästan jämt.')) },
    { id: 'adoptera', r: [158, 48, 192, 70], go: [175, WALL_Y + 12], label: $t('ADOPTERA EN KATT'), act: () => kSay(KERSTIN_SAY[1]) },
  ];
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const focusSpot = () => {
    const h = hover && t - hoverT < 4 && spotAt(hover.x, hover.y);
    if (h) return h;
    if (walker.path.length) return null;
    return spots().find((s) => s.id !== 'dorr' && Math.abs(walker.px - s.go[0]) < 7 && Math.abs(walker.py - s.go[1]) < 7) || null;
  };

  // ---------- ritning ----------
  function drawTrad(ctx) {
    const { x, y } = TRAD;
    ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(x - 14, y - 1, 28, 3);
    ctx.fillStyle = '#c8b488'; ctx.fillRect(x - 12, y - 4, 24, 4);                        // foten
    for (let yy = y - 44; yy < y - 4; yy++) { ctx.fillStyle = (yy % 3) ? '#d8c49a' : '#b8a47a'; ctx.fillRect(x - 2, yy, 5, 1); }   // sisalpelaren
    for (const [px, py, w] of [[x - 14, y - 16, 14], [x + 2, y - 30, 14], [x - 10, y - 44, 18]]) { ctx.fillStyle = '#8a5a8a'; ctx.fillRect(px, py, w, 4); ctx.fillStyle = '#a87aa8'; ctx.fillRect(px, py, w, 1); }
    ctx.fillStyle = '#f0c040'; ctx.fillRect(x + 12, y - 28, 1, 6); ctx.fillRect(x + 11, y - 22, 3, 3);   // leksaken som dinglar
    drawPet(ctx, KATT2.x, KATT2.y, KATT2.pet, 'sleep', t, 'right');
  }
  function drawDisk(ctx) {
    drawPerson(ctx, DISK.x + 38, DISK.y + 12, KERSTIN, 'down', Math.sin(t * 1.6) > 0.93 ? 4 : 0);
    const d = DISK;
    ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(d.x, d.y + d.h - 1, d.w, 3);
    ctx.fillStyle = '#8a5a30'; ctx.fillRect(d.x, d.y + 6, d.w, d.h - 6);
    for (let x = d.x + 3; x < d.x + d.w - 2; x += 6) { ctx.fillStyle = '#6a4224'; ctx.fillRect(x, d.y + 11, 1, d.h - 15); ctx.fillStyle = '#9a6a3a'; ctx.fillRect(x + 1, d.y + 11, 1, d.h - 15); }
    ctx.fillStyle = '#d8a070'; ctx.fillRect(d.x - 2, d.y + 6, d.w + 4, 2); ctx.fillStyle = '#b07a48'; ctx.fillRect(d.x - 2, d.y + 8, d.w + 4, 3); ctx.fillStyle = '#5a3a1e'; ctx.fillRect(d.x, d.y + d.h - 3, d.w, 3);
    ctx.fillStyle = '#e0a030'; for (const [dx, dy] of [[0, 1], [1, 1], [0, 2], [1, 2], [-1, 0], [2, 0], [-1, -2], [2, -2]]) ctx.fillRect(d.x + d.w / 2 + dx, d.y + 17 + dy, 1, 1);   // tassen på disken
    ctx.fillStyle = 'rgba(200,232,248,.7)'; ctx.fillRect(d.x + 4, d.y - 2, 30, 9); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(d.x + 4, d.y + 6, 30, 1);   // glasdisken
    for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#c8803a' : '#d89a4a'; ctx.fillRect(d.x + 7 + k * 7, d.y + 2, 5, 3); ctx.fillStyle = '#8a4a1e'; ctx.fillRect(d.x + 8 + k * 7, d.y + 3, 3, 1); }   // bullarna
    ctx.fillStyle = '#3a3a42'; ctx.fillRect(d.x + 52, d.y - 6, 14, 12); ctx.fillStyle = '#c8ccd4'; ctx.fillRect(d.x + 53, d.y - 5, 12, 2);   // kaffemaskinen
    if (Math.floor(t * 2) % 3 === 0) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(d.x + 58, d.y - 10 - (Math.floor(t * 4) % 3), 1, 2); }
  }
  function drawBord(ctx, B, i) {
    ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(B.x - 10, B.y - 1, 20, 3);
    for (const s of [-1, 1]) { const cx = B.x + s * 15; ctx.fillStyle = '#8a5a30'; ctx.fillRect(cx - 4, B.y - 9, 8, 2); ctx.fillRect(cx - 4, B.y - 7, 1, 7); ctx.fillRect(cx + 3, B.y - 7, 1, 7); ctx.fillRect(cx + (s < 0 ? -4 : 3), B.y - 16, 1, 8); }
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(B.x - 1, B.y - 10, 2, 10); ctx.fillRect(B.x - 5, B.y - 1, 10, 1);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(B.x - 10, B.y - 14, 20, 4); ctx.fillStyle = '#e0a030'; ctx.fillRect(B.x - 10, B.y - 11, 20, 1);
    ctx.fillStyle = '#d8343c'; ctx.fillRect(B.x - 3, B.y - 17, 2, 3); ctx.fillStyle = '#46a35a'; ctx.fillRect(B.x - 2, B.y - 19, 1, 2);   // en liten blomma
    if (sitter === i && fika) { ctx.fillStyle = '#f4f1ea'; ctx.fillRect(B.x - 8, B.y - 16, 4, 3); ctx.fillStyle = fika.f.id === 'kaffe' ? '#5a3a28' : fika.f.id === 'choklad' ? '#7a4a2a' : '#d89a4a'; ctx.fillRect(B.x - 7, B.y - 16, 2, 1); if (Math.floor(t * 2) % 2) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(B.x - 6, B.y - 19, 1, 2); } }
  }
  // soffan mot väggen (en katt sover på den), den stora krukväxten och golvlampan
  const SOFFA = { x: 236, y: 100 }, SOVKATT = { id: 'kurr-soffa', name: 'Nisse', species: 'katt', breed: 'blagra', sex: 'hane', stage: 'vuxen', seed: 'kurrs' };
  function drawSoffa(ctx) {
    const { x, y } = SOFFA;
    ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(x - 2, y - 1, 68, 3);
    ctx.fillStyle = '#8a3a4a'; ctx.fillRect(x, y - 22, 64, 12); ctx.fillStyle = '#a84a5a'; ctx.fillRect(x, y - 22, 64, 2);
    ctx.fillStyle = '#9a4252'; ctx.fillRect(x - 3, y - 16, 6, 14); ctx.fillRect(x + 61, y - 16, 6, 14);
    ctx.fillStyle = '#b85a6a'; ctx.fillRect(x + 2, y - 11, 29, 7); ctx.fillRect(x + 33, y - 11, 29, 7); ctx.fillStyle = '#c8707e'; ctx.fillRect(x + 2, y - 11, 29, 1); ctx.fillRect(x + 33, y - 11, 29, 1);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x + 1, y - 3, 3, 3); ctx.fillRect(x + 60, y - 3, 3, 3);
    ctx.fillStyle = '#f0c040'; ctx.fillRect(x + 6, y - 19, 8, 6); ctx.fillStyle = '#62c8a0'; ctx.fillRect(x + 50, y - 19, 8, 6);   // kuddarna
    drawPet(ctx, x + 44, y - 10, SOVKATT, 'sleep', t, 'left');
  }
  function drawVaxt(ctx, x, y) {
    ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(x - 7, y - 1, 14, 3);
    ctx.fillStyle = '#c86a3a'; ctx.fillRect(x - 6, y - 10, 12, 10); ctx.fillStyle = '#e08a50'; ctx.fillRect(x - 6, y - 10, 12, 2); ctx.fillStyle = '#a8502a'; ctx.fillRect(x + 3, y - 8, 3, 8);
    for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (k - 4) * 0.36, L = 12 + (k % 3) * 4; for (let s = 2; s < L; s++) { ctx.fillStyle = s > L - 4 ? '#5aa848' : k % 2 ? '#2e7a3a' : '#3e8a42'; ctx.fillRect(Math.round(x + Math.cos(a) * s), Math.round(y - 10 + Math.sin(a) * s * 0.9), s > L - 5 ? 3 : 1, 2); } }
  }
  function drawLampa(ctx, x, y) {
    ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(x - 5, y - 1, 10, 2);
    ctx.fillStyle = '#3a3a42'; ctx.fillRect(x - 4, y - 2, 8, 2); ctx.fillRect(x, y - 40, 1, 38);
    ctx.fillStyle = '#f4e4b8'; ctx.fillRect(x - 6, y - 50, 13, 10); ctx.fillStyle = '#e8d098'; ctx.fillRect(x - 6, y - 42, 13, 2);
    ctx.fillStyle = 'rgba(255,230,160,.18)'; ctx.fillRect(x - 12, y - 52, 25, 16);
  }
  function drawKorg(ctx, K) {
    ctx.fillStyle = 'rgba(20,12,30,.22)'; ctx.fillRect(K.x - 10, K.y - 1, 20, 3);
    ctx.fillStyle = '#b8894a'; ctx.fillRect(K.x - 10, K.y - 6, 20, 6); ctx.fillStyle = '#d8a96a'; for (let x = K.x - 10; x < K.x + 10; x += 3) ctx.fillRect(x, K.y - 6, 1, 6);
    ctx.fillStyle = '#e8b8c8'; ctx.fillRect(K.x - 8, K.y - 7, 16, 2);
  }
  function drawGarn(ctx) { const x = 300 + Math.round(Math.sin(t * 0.3) * 30), y = 196; ctx.fillStyle = '#d84a8a'; ctx.fillRect(x - 2, y - 4, 5, 4); ctx.fillStyle = '#f07ab8'; ctx.fillRect(x - 1, y - 4, 2, 1); ctx.fillStyle = '#d84a8a'; for (let k = 0; k < 8; k++) ctx.fillRect(x + 3 + k, y - 1 + Math.round(Math.sin(k + t) * 1), 1, 1); }
  function drawSpo(ctx) {
    if (!spo) return;
    const m = spoMal && t - spoMal.t < 4 ? spoMal : null, hx = walker.px + (walker.dir === 'left' ? -5 : 5), hy = walker.py - 14;
    const ex = m ? m.x + Math.round(Math.sin(t * 9) * 3) : hx + (walker.dir === 'left' ? -10 : 10), ey = m ? m.y - 6 + Math.round(Math.cos(t * 7) * 2) : hy + 6;
    ctx.fillStyle = '#8a5a30'; for (let k = 0; k <= 10; k++) { const u = k / 10; ctx.fillRect(Math.round(hx + (ex - hx) * u), Math.round(hy + (ey - hy) * u - Math.sin(u * Math.PI) * 4), 1, 1); }
    ctx.fillStyle = '#e0484a'; ctx.fillRect(ex - 1, ey, 3, 2); ctx.fillStyle = '#6ab4f0'; ctx.fillRect(ex, ey + 2, 2, 2); ctx.fillStyle = '#f0c040'; ctx.fillRect(ex + 2, ey + 1, 2, 2);
  }
  function label(ctx, s, cx) {
    if (!s) return;
    const txt = s.label, w = textW(SMALL, txt) + 10, x = Math.round(Math.max(cx + 2, Math.min(cx + VW - w - 2, (s.r[0] + s.r[2]) / 2 - w / 2))), y = Math.max(2, s.r[1] - 13);
    ctx.fillStyle = 'rgba(40,26,20,.92)'; ctx.fillRect(x, y, w, 11); ctx.fillStyle = '#e0a030'; ctx.fillRect(x, y + 10, w, 1);
    ctxText(ctx, SMALL, txt, x + 5, y + 3, '#ffd23f');
  }

  return {
    viewMax: { w: W, h: H },
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    update(dt) {
      dt = Math.min(0.1, Math.max(0, dt));
      t += dt; syncView();
      if (sitter === null) walker.update(dt);
      if (fika) fika.t += dt;
      updKatter(dt);
      if (!greeted && t > 0.8) { greeted = true; kSay(KERSTIN_SAY[0], 5); sayIdx = 1; }
      const k = lockedCam !== null ? 1 : Math.min(1, dt * 6);
      cam.x += (camTarget() - cam.x) * k;
    },
    draw(ctx) {
      syncView();
      const cx = Math.round(cam.x);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(BG, cx, 0, VW, H, cx, 0, VW, H);
      const focus = focusSpot();
      // katterna på kattgången och i fönstret ritas mot väggen
      for (const k of katter) if (k.plats === 'gang') drawPet(ctx, k.x, k.y, k.pet, k.state === 'ga' ? 'walk' : 'sit', t, k.dir);
      ctx.fillStyle = '#b07a48'; ctx.fillRect(FONSTER.x0 - 6, FONSTER.y, FONSTER.x1 - FONSTER.x0 + 12, 4); ctx.fillStyle = '#d8a070'; ctx.fillRect(FONSTER.x0 - 6, FONSTER.y, FONSTER.x1 - FONSTER.x0 + 12, 1); ctx.fillStyle = '#8a5a30'; ctx.fillRect(FONSTER.x0 - 4, FONSTER.y + 4, FONSTER.x1 - FONSTER.x0 + 8, 10);
      for (const k of katter) if (k.plats === 'fonster') drawPet(ctx, k.x, k.y, k.pet, k.klapp > 0 ? 'love' : 'sleep', t, 'left');
      const sitDraw = sitter !== null ? { fy: BORD[sitter].y + 2, draw: () => drawPerson(ctx, walker.px, walker.py, A.avatar.look, 'right', fika && Math.floor(t * 1.6) % 3 === 1 ? 6 : 5) } : selfDrawable(A, walker, t);
      const list = [...folkDrawables(A, t), sitDraw];
      list.push({ fy: TRAD.y, draw: () => drawTrad(ctx) });
      for (const k of katter) if (k.plats === 'trad1') list.push({ fy: TRAD.y + 0.5, draw: () => drawPet(ctx, k.x, k.y, k.pet, k.klapp > 0 ? 'love' : 'sit', t, 'left') });
      list.push({ fy: DISK.y + DISK.h, draw: () => drawDisk(ctx) });
      BORD.forEach((B, i) => list.push({ fy: B.y, draw: () => drawBord(ctx, B, i) }));
      for (const K of KORGAR) list.push({ fy: K.y, draw: () => drawKorg(ctx, K) });
      list.push({ fy: 196, draw: () => drawGarn(ctx) });
      list.push({ fy: SOFFA.y, draw: () => drawSoffa(ctx) }, { fy: 112, draw: () => drawVaxt(ctx, 206, 112) }, { fy: 104, draw: () => drawLampa(ctx, 312, 104) });
      for (const k of katter) if (k.plats === 'golv' || k.plats === 'korg') list.push({ fy: k.paBord && k.state !== 'ga' ? BORD[sitter ?? 0].y + 1 : k.y, draw: () => drawPet(ctx, k.x, k.paBord && k.state !== 'ga' ? k.y - 12 : k.y, k.pet, k.klapp > 0 ? 'love' : k.state === 'ga' ? (k.spring ? 'run' : 'walk') : k.state === 'lek' ? 'play' : k.state === 'sov' ? 'sleep' : 'sit', t, k.dir) });
      list.push({ fy: walker.py + 0.1, draw: () => drawSpo(ctx) });
      list.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      talk.draw(ctx, { x0: cx, x1: cx + VW });
      label(ctx, focus, cx);
    },
    down(sx, sy) {
      const x = sx + cam.x, y = sy;
      hover = null;
      const s = spotAt(x, y);
      if (sitter !== null && !(s && s.id === 'bord' + sitter)) { sitter = null; katter.forEach((k) => (k.paBord = false)); }
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      const k = kattAt(x, y);
      if (k) { const gy = k.plats === 'gang' || k.plats === 'fonster' || k.plats === 'trad0' || k.plats === 'trad1' ? Math.max(WALL_Y + 10, Math.min(FONSTER.y + 14, k.y + 30)) : k.y + 6; walker.walkTo(k.x + (walker.px < k.x ? -12 : 12), Math.max(WALL_Y + 8, gy), () => klappa(k)); return; }
      if (y > WALL_Y) { if (spo) spoMal = { x, y, t }; walker.walkTo(x, y); }
    },
    move(sx, sy) { hover = { x: sx + cam.x, y: sy }; hoverT = t; },
    exit() { talk.clear(); },
    _debug: {
      spots: () => spots().map((s) => s.id),
      act: (id) => { const s = spots().find((q) => q.id === id); if (!s) return false; s.act(); return true; },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); cam.x = camTarget(); },
      pos: () => ({ x: Math.round(walker.px), y: Math.round(walker.py) }),
      katter: () => katter.map((k) => ({ namn: k.namn, plats: k.plats, x: Math.round(k.x), y: Math.round(k.y), state: k.state, paBord: !!k.paBord, klapp: k.klapp > 0 })),
      klappa: (namn) => { const k = katter.find((q) => q.namn === namn); if (!k) return false; klappa(k); return true; },
      sitter: () => sitter,
      cam: () => cam.x,
      spo: () => spo,
      kattSkarm: (namn) => { const k = katter.find((q) => q.namn === namn); return k ? { x: Math.round(k.x - cam.x), y: Math.round(k.y - 6) } : null; },
      tova: () => talk.text?.() ?? null,
    },
  };
}
