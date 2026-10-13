// KATTCAFÉ KURR i Tassbacken – fika bland katterna som bor här (Carl 2026-10-12: "bygg allting inklusive
// stadsdelarna"; 2026-10-13: "jättetomt kafé – kan vi lägga till mycket mer saker?"). 640 px brett kafé som rullar
// med figuren – inredningen målas i js/tassbacken/kafe-inne.js. Från vänster: dörren UT, kapphyllan, katt-tältet,
// KLÖSTRÄDET (tre hyllor, två katter), DISKEN med Kerstin, bakelserna och espressomaskinen, akvariet på skåpet
// (Måns stirrar på fiskarna), golvskylten, soffan med Nisse, fyra bord med stolar (gäster vid två av dem), korgarna,
// tygtunneln (Sessan tittar ut), det stora FÖNSTRET med fönsterbänken där katterna solar och sughängmattan,
// bokhyllan (Tigge högst upp), kakelugnen (Gösta sover framför) och KATTUNGEHAGEN med Knut och Kotte. Högt uppe
// längs väggen går KATTGÅNGEN med hängmatta och tunnel – Sotis promenerar fram och tillbaka. Elin går runt med
// brickan. Klicka på en katt: gå fram och klappa (den spinner). Köp FIKA vid disken och sätt dig vid ett bord – då
// kommer en katt och lägger sig på bordet. Köper man ett FJÄDERSPÖ springer golvkatterna efter det dit man klickar.
//
// _debug-API för tools/kattcafe-test.mjs.
import { drawPerson, makeLook } from '../core/people.js';
import { SMALL, ctxText, textW } from '../core/floor-pix.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { fmt } from '../game.js';
import { createWalker, selfDrawable, folkDrawables, createSpeech, WALK_SEQ } from './walkable.js';
import { drawPet } from '../pets/sprites.js';
import { KAFE, paintKafeBg, ritaKafeLiv, ritaAkvarium, ritaTunnel, ritaTalt, ritaHageBak, ritaHageFram, ritaGolvskylt } from '../tassbacken/kafe-inne.js';
import { $t } from '../core/i18n.js';

const { W, H, WALL_Y, DOOR, TRAD, DISK, BORD, KORGAR, FONSTER, GANG, SOFFA, VAXT, LAMPA, HYLLA, UGN, HAGE, AKVARIUM, TUNNEL, TALT, HANGMATTA, SKYLT } = KAFE;
const KERSTIN = { skin: '#f6d7bf', hair: '#d9a95c', style: 'bun', top: 'sweater', shirt: '#e0a030', accent: '#f4f1ea', bottom: 'pants', pants: '#5a4632', shoes: '#6b3e1e', glasses: 'round', beard: false, phones: false, bag: null, hat: null, apron: true, build: 4, blush: true, kid: false };
const lcg = (s) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
const LR = lcg(4711);
const ELIN = { ...makeLook(LR), kid: false, hair: '#2a1a14', style: 'ponytail', shirt: '#46a090', top: 'tee', hat: null, apron: true };
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
// katterna: namn, ras, var de håller till
//   trad0/trad1 = klösträdet · fonster · gang (kattgången) · golv · korg · hangmatta (fönstret) · hylla (bokhyllan)
//   akvarium (sitter och stirrar) · tunnel (tittar ut) · talt (sover i tältet) · ugn (sover vid kakelugnen) · soffa · hage (ungarna)
const KATTER = [
  { namn: 'Smulan', ras: 'blagra', plats: 'fonster', x: 474 }, { namn: 'Kanel', ras: 'rodkatt', plats: 'trad1' }, { namn: 'Pepparkaka', ras: 'tigrerad', plats: 'golv' },
  { namn: 'Sotis', ras: 'svart', plats: 'gang' }, { namn: 'Mysan', ras: 'skoldpadd', plats: 'korg', k: 0 }, { namn: 'Doris', ras: 'siames', plats: 'fonster', x: 526 }, { namn: 'Leo', ras: 'smoking', plats: 'golv' },
  { namn: 'Pelle', ras: 'vit', plats: 'trad0' }, { namn: 'Nisse', ras: 'blagra', plats: 'soffa' }, { namn: 'Lillan', ras: 'vit', plats: 'hangmatta' }, { namn: 'Tigge', ras: 'tigrerad', plats: 'hylla' },
  { namn: 'Måns', ras: 'svart', plats: 'akvarium' }, { namn: 'Sessan', ras: 'siames', plats: 'tunnel' }, { namn: 'Pyret', ras: 'skoldpadd', plats: 'talt' }, { namn: 'Gösta', ras: 'rodkatt', plats: 'ugn' },
  { namn: 'Knut', ras: 'rodkatt', plats: 'hage', unge: true }, { namn: 'Kotte', ras: 'skoldpadd', plats: 'hage', unge: true },
];
// gästerna: vid bord 1 och 3 (höger stol), en som väntar vid disken och ett barn vid kattungehagen
const GASTER = [
  { x: BORD[1].x + 15, y: BORD[1].y + 2, dir: 'left', sitter: true, look: makeLook(LR) },
  { x: BORD[3].x + 15, y: BORD[3].y + 2, dir: 'left', sitter: true, katt: true, look: makeLook(LR) },
  { x: DISK.x + 72, y: DISK.y + DISK.h + 14, dir: 'up', look: makeLook(LR) },
  { x: HAGE.x0 - 10, y: HAGE.y1 - 2, dir: 'right', sitter: true, kid: true, look: { ...makeLook(LR), kid: true } },
];
const KNAN = { id: 'kurr-gast-katt', name: 'Molly', species: 'katt', breed: 'vit', sex: 'hona', stage: 'vuxen', seed: 'kurrg' };

// ================= scenen =================
export function makeShopKattcafe(A) {
  const g = A.game;
  const BG = paintKafeBg();
  let VW = 384;
  const syncView = () => { VW = Math.max(384, Math.min(A.W || 384, W)); };
  const walker = createWalker({ W, H, left: 6, right: W - 6, top: WALL_Y + 6, bottom: H - 4, spawn: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 12] });
  walker.speed = 72;
  walker.setObstacles([
    [TRAD.x - 16, TRAD.y - 8, TRAD.x + 16, TRAD.y + 2],
    [DISK.x, DISK.y, DISK.x + DISK.w, DISK.y + DISK.h],
    ...BORD.map((b) => [b.x - 10, b.y - 6, b.x + 10, b.y + 1]),
    [FONSTER.x0 - 4, WALL_Y, FONSTER.x1 + 4, FONSTER.y + 4],
    [SOFFA.x - 3, WALL_Y, SOFFA.x + 67, SOFFA.y + 1], [VAXT.x - 7, VAXT.y - 6, VAXT.x + 7, VAXT.y + 1], [LAMPA.x - 5, LAMPA.y - 4, LAMPA.x + 5, LAMPA.y + 1],
    [HYLLA.x0 - 2, WALL_Y, HYLLA.x1 + 2, WALL_Y + 6], [UGN.x0 - 2, WALL_Y, UGN.x1 + 2, UGN.y + 2],
    [HAGE.x0 - 2, HAGE.y0 - 4, HAGE.x1 + 2, HAGE.y1 + 2], [AKVARIUM.x - (AKVARIUM.w >> 1) - 1, AKVARIUM.y - 14, AKVARIUM.x + (AKVARIUM.w >> 1) + 1, AKVARIUM.y + 1],
    [TUNNEL.x - 24, TUNNEL.y - 14, TUNNEL.x + 24, TUNNEL.y + 1], [TALT.x - 15, TALT.y - 10, TALT.x + 15, TALT.y + 1], [SKYLT.x - 7, SKYLT.y - 4, SKYLT.x + 7, SKYLT.y + 1],
    ...KORGAR.map((k) => [k.x - 10, k.y - 6, k.x + 10, k.y + 1]),
    ...GASTER.map((q) => [q.x - 5, q.y - 4, q.x + 5, q.y + 1]),
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
  const golv = () => [rnd(224, 440), rnd(118, 206)];
  const katter = KATTER.map((K, i) => {
    const pet = { id: `kurr-${i}`, name: K.namn, species: 'katt', breed: K.ras, sex: i % 3 ? 'hona' : 'hane', stage: K.unge ? 'unge' : 'vuxen', seed: `kurr${i}` };
    const k = { ...K, pet, i, state: 'sitt', tm: rnd(1, 5), dir: i % 2 ? 'left' : 'right', klapp: 0 };
    if (K.plats === 'fonster') Object.assign(k, { x: K.x, y: FONSTER.y - 4, state: 'sov' });
    else if (K.plats === 'trad1') Object.assign(k, { x: TRAD.x + 8, y: TRAD.y - 44, state: 'sitt', dir: 'left' });
    else if (K.plats === 'trad0') Object.assign(k, { x: TRAD.x - 10, y: TRAD.y - 18, state: 'sov', dir: 'right' });
    else if (K.plats === 'gang') Object.assign(k, { x: GANG.x0 + 20, y: GANG.y, state: 'ga', tx: GANG.x1 - 10, ty: GANG.y });
    else if (K.plats === 'korg') Object.assign(k, { x: KORGAR[K.k].x, y: KORGAR[K.k].y - 2, state: 'sov' });
    else if (K.plats === 'soffa') Object.assign(k, { x: SOFFA.x + 44, y: SOFFA.y - 10, state: 'sov', dir: 'left' });
    else if (K.plats === 'hangmatta') Object.assign(k, { x: HANGMATTA.x, y: HANGMATTA.y + 3, state: 'sov', dir: 'right' });
    else if (K.plats === 'hylla') Object.assign(k, { x: HYLLA.x0 + 18, y: 9, state: 'sitt', dir: 'down' });
    else if (K.plats === 'akvarium') Object.assign(k, { x: AKVARIUM.x + 6, y: AKVARIUM.y + 7, state: 'sitt', dir: 'up' });
    else if (K.plats === 'tunnel') Object.assign(k, { x: TUNNEL.x - 14, y: TUNNEL.y - 2, state: 'sitt', dir: 'left' });
    else if (K.plats === 'talt') Object.assign(k, { x: TALT.x, y: TALT.y - 2, state: 'sov', dir: 'right' });
    else if (K.plats === 'ugn') Object.assign(k, { x: UGN.x0 - 8, y: UGN.y + 8, state: 'sov', dir: 'right' });
    else if (K.plats === 'hage') Object.assign(k, { x: rnd(HAGE.x0 + 10, HAGE.x1 - 10), y: rnd(HAGE.y0 + 6, HAGE.y1 - 4), state: 'ga', tx: HAGE.x0 + 20, ty: HAGE.y0 + 8 });
    else { const [x, y] = golv(); Object.assign(k, { x, y }); }
    return k;
  });
  function updKatter(dt) {
    for (const k of katter) {
      k.tm -= dt; if (k.klapp > 0) k.klapp -= dt;
      if (k.plats === 'gang') {
        const dx = k.tx - k.x, step = 12 * dt;
        if (k.state === 'ga') { k.dir = dx < 0 ? 'left' : 'right'; if (Math.abs(dx) <= step) { k.x = k.tx; k.state = 'sitt'; k.tm = rnd(2, 5); } else k.x += Math.sign(dx) * step; }
        else if (k.tm <= 0) { k.tx = k.x > (GANG.x0 + GANG.x1) / 2 ? GANG.x0 + 10 : GANG.x1 - 10; k.state = 'ga'; }
        continue;
      }
      if (k.plats === 'hage') {   // kattungarna tumlar runt i hagen
        if (k.klapp > 0) continue;
        const dx = k.tx - k.x, dy = k.ty - k.y, d = Math.hypot(dx, dy), step = 20 * dt;
        if (k.state === 'ga') { if (Math.abs(dx) > 0.5) k.dir = dx < 0 ? 'left' : 'right'; if (d <= step) { k.x = k.tx; k.y = k.ty; k.state = Math.random() < 0.5 ? 'lek' : 'sitt'; k.tm = rnd(1, 3); } else { k.x += dx / d * step; k.y += dy / d * step; } }
        else if (k.tm <= 0) { k.tx = rnd(HAGE.x0 + 8, HAGE.x1 - 8); k.ty = rnd(HAGE.y0 + 5, HAGE.y1 - 4); k.state = 'ga'; }
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
  const VAGG = new Set(['gang', 'fonster', 'trad0', 'trad1', 'hangmatta', 'hylla', 'soffa']);
  const kattAt = (x, y) => katter.find((k) => Math.abs(k.x - x) < 9 && y < k.y + 3 && y > k.y - 14);
  function klappa(k) {
    k.klapp = 2.5; if (k.plats !== 'hage') k.state = 'sitt'; k.tm = 3;
    talk.say(Math.random() < 0.5 ? $t('Purrr … ❤️') : (k.unge ? $t('Mjiii! 🐾') : $t('Mjau! 😺')), () => ({ x: k.x, y: k.y - (VAGG.has(k.plats) ? 18 : 16) }), 2.2, { animal: true, silent: true });
    play('click');
    const h = g.glad?.(1, $t('Kattcaféet'), 'kattcafe', 3); if (h) toast(`😊 +${h}`);
  }
  // Elin går runt med brickan: från disken till borden och tillbaka
  const ELINV = [[DISK.x + 100, DISK.y + DISK.h + 10], [BORD[2].x - 20, BORD[2].y + 6], [BORD[3].x - 24, BORD[3].y + 4], [BORD[1].x - 22, BORD[1].y + 6], [DISK.x + 100, DISK.y + DISK.h + 10]];
  const elin = { x: ELINV[0][0], y: ELINV[0][1], i: 1, vila: 2, dir: 'right' };
  function updElin(dt) {
    if (elin.vila > 0) { elin.vila -= dt; return; }
    const [tx, ty] = ELINV[elin.i], dx = tx - elin.x, dy = ty - elin.y, d = Math.hypot(dx, dy), step = 26 * dt;
    if (Math.abs(dx) > 0.5) elin.dir = dx < 0 ? 'left' : 'right';
    if (d <= step) { elin.x = tx; elin.y = ty; elin.vila = rnd(2, 5); elin.i = (elin.i + 1) % ELINV.length; return; }
    elin.x += dx / d * step; elin.y += dy / d * step;
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
    { id: 'disk', r: [DISK.x, DISK.y - 34, DISK.x + DISK.w, DISK.y + DISK.h], go: [DISK.x + DISK.w / 2 - 14, DISK.y + DISK.h + 10], label: $t('DISKEN – FIKA'), act: meny },
    ...BORD.map((B, i) => ({ id: 'bord' + i, r: [B.x - 12, B.y - 14, B.x + 12, B.y + 2], go: [B.x - 14, B.y + 2], label: sitter === i ? $t('RES DIG') : $t('SÄTT DIG'), act: () => sattDig(i) })),
    { id: 'trad', r: [TRAD.x - 16, TRAD.y - 60, TRAD.x + 16, TRAD.y], go: [TRAD.x + 20, TRAD.y + 8], label: $t('KLÖSTRÄDET'), act: () => toast($t('🐈 Pelle och Kanel har de bästa platserna i klösträdet.')) },
    { id: 'fonster', r: [FONSTER.x0, 8, FONSTER.x1, FONSTER.y + 2], go: [(FONSTER.x0 + FONSTER.x1) / 2, FONSTER.y + 14], label: $t('FÖNSTERBÄNKEN'), act: () => toast($t('☀️ Smulan och Doris solar i fönstret. Smulan är äldst och sover nästan jämt.')) },
    { id: 'adoptera', r: [290, 12, 326, 60], go: [308, WALL_Y + 12], label: $t('ADOPTERA EN KATT'), act: () => kSay(KERSTIN_SAY[1]) },
    { id: 'akvarium', r: [AKVARIUM.x - 22, AKVARIUM.y - 36, AKVARIUM.x + 22, AKVARIUM.y], go: [AKVARIUM.x + 30, AKVARIUM.y + 2], label: $t('AKVARIET'), act: () => toast($t('🐟 Måns sitter här varje dag och stirrar på fiskarna. De heter Guld, Rand och Lilla Fenan.')) },
    { id: 'hage', r: [HAGE.x0, HAGE.y0 - 12, HAGE.x1, HAGE.y1], go: [HAGE.x0 - 10, HAGE.y0 + 4], label: $t('KATTUNGARNA'), act: () => { toast($t('🐾 Knut och Kotte är åtta veckor. De bor här tills de är stora nog att adopteras från Tassarnas hem.')); for (const k of katter) if (k.plats === 'hage') { k.state = 'lek'; k.tm = 3; } } },
    { id: 'hylla', r: [HYLLA.x0, 8, HYLLA.x1, WALL_Y], go: [(HYLLA.x0 + HYLLA.x1) / 2, WALL_Y + 12], label: $t('BOKHYLLAN'), act: () => toast($t('📚 Kattböcker, serier och en katt som heter Tigge högst upp. Låna gärna – men lämna tillbaka!')) },
    { id: 'ugn', r: [UGN.x0, 6, UGN.x1, UGN.y], go: [UGN.x0 - 12, UGN.y + 10], label: $t('KAKELUGNEN'), act: () => { toast($t('🔥 Kakelugnen är varm. Gösta har bästa platsen framför den.')); const h = g.glad?.(1, '', 'kakelugn', 1); if (h) toast(`😊 +${h}`); } },
  ];
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const focusSpot = () => {
    const h = hover && t - hoverT < 4 && spotAt(hover.x, hover.y);
    if (h) return h;
    if (walker.path.length) return null;
    return spots().find((s) => s.id !== 'dorr' && Math.abs(walker.px - s.go[0]) < 7 && Math.abs(walker.py - s.go[1]) < 7) || null;
  };

  // ---------- ritning av möblerna ----------
  const R = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  function drawTrad(ctx) {
    const { x, y } = TRAD;
    R(ctx, 'rgba(20,12,30,.25)', x - 16, y - 1, 32, 3);
    R(ctx, '#c8b488', x - 14, y - 4, 28, 4); R(ctx, '#e0cc9c', x - 14, y - 4, 28, 1);                                   // foten (plysch)
    for (let yy = y - 58; yy < y - 4; yy++) { R(ctx, (yy % 3) ? '#d8c49a' : '#b8a47a', x - 2, yy, 5, 1); if (yy % 6 === 0) R(ctx, '#f0e0b8', x - 2, yy, 1, 1); }   // sisalpelaren
    for (const [px, py, w] of [[x - 16, y - 18, 16], [x + 2, y - 32, 16], [x - 12, y - 44, 18], [x - 2, y - 58, 20]]) { R(ctx, '#8a5a8a', px, py, w, 4); R(ctx, '#a87aa8', px, py, w, 1); R(ctx, '#6a3a6a', px, py + 3, w, 1); }
    R(ctx, '#6a3a6a', x + 10, y - 56, 6, 10); R(ctx, '#8a5a8a', x + 10, y - 56, 6, 1); R(ctx, '#1a1014', x + 11, y - 53, 4, 6);   // kojan högst upp
    R(ctx, '#f0c040', x + 14, y - 30, 1, 7); R(ctx, '#d8343c', x + 13, y - 23, 3, 3); R(ctx, '#3a7bd5', x + 14, y - 20, 1, 1);   // leksaken som dinglar
    R(ctx, '#f06aa0', x - 8, y - 14, 1, 5); R(ctx, '#f0c030', x - 9, y - 9, 3, 2);
  }
  function drawDisk(ctx) {
    drawPerson(ctx, DISK.x + 38, DISK.y + 12, KERSTIN, 'down', Math.sin(t * 1.6) > 0.93 ? 4 : 0);
    const d = DISK;
    R(ctx, 'rgba(20,12,30,.25)', d.x, d.y + d.h - 1, d.w, 3);
    R(ctx, '#8a5a30', d.x, d.y + 6, d.w, d.h - 6);
    for (let x = d.x + 3; x < d.x + d.w - 2; x += 6) { R(ctx, '#6a4224', x, d.y + 11, 1, d.h - 15); R(ctx, '#9a6a3a', x + 1, d.y + 11, 1, d.h - 15); }
    R(ctx, '#d8a070', d.x - 2, d.y + 6, d.w + 4, 2); R(ctx, '#b07a48', d.x - 2, d.y + 8, d.w + 4, 3); R(ctx, '#5a3a1e', d.x, d.y + d.h - 3, d.w, 3);
    R(ctx, '#e0a030', d.x + d.w / 2 - 1, d.y + 16, 3, 2); R(ctx, '#e0a030', d.x + d.w / 2 - 2, d.y + 18, 5, 2); R(ctx, '#e0a030', d.x + d.w / 2 - 2, d.y + 14, 1, 1); R(ctx, '#e0a030', d.x + d.w / 2 + 2, d.y + 14, 1, 1);   // tassen på disken
    // glasdisken med bakelser: prinsesstårta, chokladbollar, kanelbullar, kattkakor
    R(ctx, 'rgba(200,232,248,.6)', d.x + 4, d.y - 4, 36, 11); R(ctx, '#f4f1ea', d.x + 4, d.y + 6, 36, 1); R(ctx, '#f4f1ea', d.x + 4, d.y - 5, 36, 1);
    R(ctx, '#8ad89a', d.x + 7, d.y - 1, 6, 4); R(ctx, '#fff6e8', d.x + 8, d.y + 2, 4, 1); R(ctx, '#f06aa0', d.x + 9, d.y - 2, 2, 1);
    for (let k = 0; k < 3; k++) { R(ctx, '#5a3420', d.x + 16 + k * 3, d.y + 1, 2, 2); R(ctx, '#f4f1ea', d.x + 17 + k * 3, d.y + 1, 1, 1); }
    for (let k = 0; k < 2; k++) { R(ctx, k ? '#c8803a' : '#d89a4a', d.x + 27 + k * 6, d.y + 1, 5, 3); R(ctx, '#8a4a1e', d.x + 28 + k * 6, d.y + 2, 3, 1); }
    R(ctx, '#e0a030', d.x + 26, d.y - 3, 4, 3); R(ctx, '#e0a030', d.x + 26, d.y - 4, 1, 1); R(ctx, '#e0a030', d.x + 29, d.y - 4, 1, 1);   // en kattkaka med öron
    R(ctx, '#3a3a42', d.x + 48, d.y - 8, 16, 14); R(ctx, '#c8ccd4', d.x + 49, d.y - 7, 14, 2); R(ctx, '#8a8a94', d.x + 51, d.y - 2, 3, 2); R(ctx, '#8a8a94', d.x + 58, d.y - 2, 3, 2);   // espressomaskinen
    R(ctx, '#f4f1ea', d.x + 51, d.y + 2, 3, 2); R(ctx, '#f4f1ea', d.x + 58, d.y + 2, 3, 2); R(ctx, '#e04848', d.x + 49, d.y - 4, 1, 1); R(ctx, '#46a35a', d.x + 62, d.y - 4, 1, 1);
    if (Math.floor(t * 2) % 3 === 0) { R(ctx, 'rgba(255,255,255,.5)', d.x + 52, d.y - 12 - (Math.floor(t * 4) % 3), 1, 2); R(ctx, 'rgba(255,255,255,.4)', d.x + 59, d.y - 11 - (Math.floor(t * 5) % 3), 1, 2); }
    R(ctx, '#3a3a42', d.x + 68, d.y - 1, 10, 7); R(ctx, '#8ad8ff', d.x + 70, d.y, 6, 3); R(ctx, '#f0c030', d.x + 70, d.y + 4, 6, 1);   // kassan
    R(ctx, '#d8e8f0', d.x + 80, d.y - 2, 5, 8); R(ctx, '#f0c030', d.x + 81, d.y + 3, 3, 2); R(ctx, '#8a5a30', d.x + 80, d.y - 3, 5, 1);   // dricksburken KATTMAT
  }
  function drawBord(ctx, B, i) {
    R(ctx, 'rgba(20,12,30,.25)', B.x - 10, B.y - 1, 20, 3);
    for (const s of [-1, 1]) { const cx = B.x + s * 15; R(ctx, '#8a5a30', cx - 4, B.y - 9, 8, 2); R(ctx, '#8a5a30', cx - 4, B.y - 7, 1, 7); R(ctx, '#8a5a30', cx + 3, B.y - 7, 1, 7); R(ctx, '#8a5a30', cx + (s < 0 ? -4 : 3), B.y - 16, 1, 8); R(ctx, '#d84a6a', cx - 3, B.y - 10, 7, 1); }
    if (B.rund) { R(ctx, '#5a3a1e', B.x - 1, B.y - 10, 2, 10); R(ctx, '#5a3a1e', B.x - 5, B.y - 1, 10, 1); for (let j = 0; j < 5; j++) { const w = [8, 11, 12, 11, 8][j]; R(ctx, j === 0 ? '#ffffff' : '#f4f1ea', B.x - w, B.y - 16 + j, w * 2, 1); } R(ctx, '#e0a030', B.x - 11, B.y - 12, 22, 1); }
    else { R(ctx, '#5a3a1e', B.x - 1, B.y - 10, 2, 10); R(ctx, '#5a3a1e', B.x - 5, B.y - 1, 10, 1); R(ctx, '#f4f1ea', B.x - 10, B.y - 14, 20, 4); R(ctx, '#e0a030', B.x - 10, B.y - 11, 20, 1); R(ctx, '#d84a6a', B.x - 10, B.y - 14, 20, 1); }
    R(ctx, '#d8343c', B.x - 3, B.y - 17, 2, 3); R(ctx, '#46a35a', B.x - 2, B.y - 19, 1, 2); R(ctx, '#f4f1ea', B.x - 4, B.y - 16, 4, 1);   // en liten vas med en blomma
    R(ctx, '#3a2a2a', B.x + 4, B.y - 17, 4, 3); R(ctx, '#f4f1ea', B.x + 5, B.y - 16, 2, 1);   // menyn på bordet
    if (sitter === i && fika) { R(ctx, '#f4f1ea', B.x - 8, B.y - 16, 4, 3); R(ctx, fika.f.id === 'kaffe' ? '#5a3a28' : fika.f.id === 'choklad' ? '#7a4a2a' : '#d89a4a', B.x - 7, B.y - 16, 2, 1); if (Math.floor(t * 2) % 2) R(ctx, 'rgba(255,255,255,.5)', B.x - 6, B.y - 19, 1, 2); }
    const gast = GASTER.find((q) => q.sitter && Math.abs(q.x - B.x - 15) < 2 && Math.abs(q.y - B.y - 2) < 2);
    if (gast) { R(ctx, '#f4f1ea', B.x + 2, B.y - 16, 4, 3); R(ctx, '#5a3a28', B.x + 3, B.y - 16, 2, 1); R(ctx, '#d89a4a', B.x + 7, B.y - 15, 3, 2); if (Math.floor(t * 2 + 1) % 2) R(ctx, 'rgba(255,255,255,.5)', B.x + 4, B.y - 19, 1, 2); }
  }
  function drawSoffa(ctx) {
    const { x, y } = SOFFA;
    R(ctx, 'rgba(20,12,30,.25)', x - 2, y - 1, 68, 3);
    R(ctx, '#8a3a4a', x, y - 22, 64, 12); R(ctx, '#a84a5a', x, y - 22, 64, 2); for (let i = 0; i < 4; i++) R(ctx, '#6a2a3a', x + 8 + i * 16, y - 18, 1, 1);
    R(ctx, '#9a4252', x - 3, y - 16, 6, 14); R(ctx, '#9a4252', x + 61, y - 16, 6, 14); R(ctx, '#b85a6a', x - 3, y - 16, 6, 1); R(ctx, '#b85a6a', x + 61, y - 16, 6, 1);
    R(ctx, '#b85a6a', x + 2, y - 11, 29, 7); R(ctx, '#b85a6a', x + 33, y - 11, 29, 7); R(ctx, '#c8707e', x + 2, y - 11, 29, 1); R(ctx, '#c8707e', x + 33, y - 11, 29, 1);
    R(ctx, '#5a3a1e', x + 1, y - 3, 3, 3); R(ctx, '#5a3a1e', x + 60, y - 3, 3, 3);
    R(ctx, '#f0c040', x + 6, y - 19, 8, 6); R(ctx, '#f8e080', x + 6, y - 19, 8, 1); R(ctx, '#62c8a0', x + 50, y - 19, 8, 6); R(ctx, '#8ae0c0', x + 50, y - 19, 8, 1);   // kuddarna
    R(ctx, '#e8e4dc', x + 20, y - 20, 14, 5); for (let i = 0; i < 3; i++) R(ctx, '#d84a6a', x + 21 + i * 4, y - 19, 2, 3);   // filten
  }
  function drawVaxt(ctx, x, y) {
    R(ctx, 'rgba(20,12,30,.25)', x - 7, y - 1, 14, 3);
    R(ctx, '#c86a3a', x - 6, y - 10, 12, 10); R(ctx, '#e08a50', x - 6, y - 10, 12, 2); R(ctx, '#a8502a', x + 3, y - 8, 3, 8); R(ctx, '#f4f1ea', x - 4, y - 6, 2, 1);
    for (let k = 0; k < 11; k++) { const a = -Math.PI / 2 + (k - 5) * 0.3, L = 12 + (k % 3) * 5; for (let s = 2; s < L; s++) R(ctx, s > L - 4 ? '#5aa848' : k % 2 ? '#2e7a3a' : '#3e8a42', Math.round(x + Math.cos(a) * s), Math.round(y - 10 + Math.sin(a) * s * 0.9), s > L - 5 ? 3 : 1, 2); }
  }
  function drawLampa(ctx, x, y) {
    R(ctx, 'rgba(20,12,30,.25)', x - 5, y - 1, 10, 2);
    R(ctx, '#3a3a42', x - 4, y - 2, 8, 2); R(ctx, '#3a3a42', x, y - 40, 1, 38); R(ctx, '#c8a040', x - 1, y - 22, 3, 1);
    R(ctx, '#f4e4b8', x - 6, y - 50, 13, 10); R(ctx, '#e8d098', x - 6, y - 42, 13, 2); R(ctx, '#fff4d8', x - 6, y - 50, 13, 1); for (let i = 0; i < 3; i++) R(ctx, '#d8a060', x - 5 + i * 5, y - 46, 1, 3);
    R(ctx, 'rgba(255,230,160,.18)', x - 12, y - 52, 25, 16);
  }
  function drawKorg(ctx, K) {
    R(ctx, 'rgba(20,12,30,.22)', K.x - 10, K.y - 1, 20, 3);
    R(ctx, '#b8894a', K.x - 10, K.y - 6, 20, 6); for (let x = K.x - 10; x < K.x + 10; x += 3) R(ctx, '#d8a96a', x, K.y - 6, 1, 6); R(ctx, '#8a5a30', K.x - 10, K.y - 1, 20, 1);
    R(ctx, '#e8b8c8', K.x - 8, K.y - 7, 16, 2); R(ctx, '#f8d8e4', K.x - 8, K.y - 7, 16, 1);
  }
  function drawGarn(ctx) { const x = 300 + Math.round(Math.sin(t * 0.3) * 30), y = 196; R(ctx, '#d84a8a', x - 2, y - 4, 5, 4); R(ctx, '#f07ab8', x - 1, y - 4, 2, 1); R(ctx, '#d84a8a', x + 3, y - 1 + Math.round(Math.sin(t) * 1), 8, 1); }
  function drawSpo(ctx) {
    if (!spo) return;
    const m = spoMal && t - spoMal.t < 4 ? spoMal : null, hx = walker.px + (walker.dir === 'left' ? -5 : 5), hy = walker.py - 14;
    const ex = m ? m.x + Math.round(Math.sin(t * 9) * 3) : hx + (walker.dir === 'left' ? -10 : 10), ey = m ? m.y - 6 + Math.round(Math.cos(t * 7) * 2) : hy + 6;
    ctx.fillStyle = '#8a5a30'; for (let k = 0; k <= 10; k++) { const u = k / 10; ctx.fillRect(Math.round(hx + (ex - hx) * u), Math.round(hy + (ey - hy) * u - Math.sin(u * Math.PI) * 4), 1, 1); }
    R(ctx, '#e0484a', ex - 1, ey, 3, 2); R(ctx, '#6ab4f0', ex, ey + 2, 2, 2); R(ctx, '#f0c040', ex + 2, ey + 1, 2, 2);
  }
  function drawGast(ctx, q) {
    const fr = q.sitter ? (q.kid ? 5 : (Math.sin(t * 1.4 + q.x) > 0.5 ? 6 : 5)) : (Math.sin(t * 2 + q.x) > 0.92 ? 4 : 0);
    drawPerson(ctx, q.x, q.y, q.look, q.dir, fr);
    if (q.katt) drawPet(ctx, q.x - 2, q.y - 8, KNAN, 'sleep', t, 'left');
  }
  const anim = (k) => (k.klapp > 0 ? 'love' : k.state === 'ga' ? (k.spring ? 'run' : 'walk') : k.state === 'lek' ? 'play' : k.state === 'sov' ? 'sleep' : 'sit');
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
      updKatter(dt); updElin(dt);
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
      ritaKafeLiv(ctx, t);
      const focus = focusSpot();
      // katterna mot väggen: kattgången, bokhyllan, hängmattan i fönstret, fönsterbänken
      for (const k of katter) if (k.plats === 'gang' || k.plats === 'hylla' || k.plats === 'hangmatta') drawPet(ctx, k.x, k.y, k.pet, k.klapp > 0 ? 'love' : k.state === 'ga' ? 'walk' : k.state === 'sov' ? 'sleep' : 'sit', t, k.dir);
      R(ctx, '#b07a48', FONSTER.x0 - 6, FONSTER.y, FONSTER.x1 - FONSTER.x0 + 12, 4); R(ctx, '#d8a070', FONSTER.x0 - 6, FONSTER.y, FONSTER.x1 - FONSTER.x0 + 12, 1); R(ctx, '#8a5a30', FONSTER.x0 - 4, FONSTER.y + 4, FONSTER.x1 - FONSTER.x0 + 8, 10);
      for (let i = 0; i < 4; i++) R(ctx, i % 2 ? '#d84a6a' : '#f0c030', FONSTER.x0 + 4 + i * 28, FONSTER.y - 2, 10, 2);   // sittdynorna på fönsterbänken
      for (const k of katter) if (k.plats === 'fonster') drawPet(ctx, k.x, k.y, k.pet, k.klapp > 0 ? 'love' : 'sleep', t, 'left');
      const sitDraw = sitter !== null ? { fy: BORD[sitter].y + 2, draw: () => drawPerson(ctx, walker.px, walker.py, A.avatar.look, 'right', fika && Math.floor(t * 1.6) % 3 === 1 ? 6 : 5) } : selfDrawable(A, walker, t);
      const list = [...folkDrawables(A, t), sitDraw];
      list.push({ fy: TRAD.y, draw: () => drawTrad(ctx) });
      for (const k of katter) if (k.plats === 'trad0' || k.plats === 'trad1') list.push({ fy: TRAD.y + 0.5, draw: () => drawPet(ctx, k.x, k.y, k.pet, anim(k), t, k.dir) });
      list.push({ fy: DISK.y + DISK.h, draw: () => drawDisk(ctx) });
      BORD.forEach((B, i) => list.push({ fy: B.y, draw: () => drawBord(ctx, B, i) }));
      for (const K of KORGAR) list.push({ fy: K.y, draw: () => drawKorg(ctx, K) });
      list.push({ fy: 196, draw: () => drawGarn(ctx) });
      list.push({ fy: SOFFA.y, draw: () => drawSoffa(ctx) }, { fy: VAXT.y, draw: () => drawVaxt(ctx, VAXT.x, VAXT.y) }, { fy: LAMPA.y, draw: () => drawLampa(ctx, LAMPA.x, LAMPA.y) });
      for (const k of katter) if (k.plats === 'soffa') list.push({ fy: SOFFA.y + 0.5, draw: () => drawPet(ctx, k.x, k.y, k.pet, anim(k), t, k.dir) });
      list.push({ fy: AKVARIUM.y, draw: () => ritaAkvarium(ctx, AKVARIUM, t) }, { fy: SKYLT.y, draw: () => ritaGolvskylt(ctx, SKYLT) });
      list.push({ fy: TUNNEL.y, draw: () => ritaTunnel(ctx, TUNNEL) });
      for (const k of katter) if (k.plats === 'tunnel') list.push({ fy: TUNNEL.y + 0.5, draw: () => { ctx.save(); ctx.beginPath(); ctx.rect(TUNNEL.x - 28, TUNNEL.y - 15, 12, 15); ctx.clip(); drawPet(ctx, k.x, k.y, k.pet, anim(k), t, 'left'); ctx.restore(); } });
      list.push({ fy: TALT.y, draw: () => ritaTalt(ctx, TALT) });
      for (const k of katter) if (k.plats === 'talt') list.push({ fy: TALT.y + 0.5, draw: () => { ctx.save(); ctx.beginPath(); ctx.rect(TALT.x - 5, TALT.y - 13, 11, 13); ctx.clip(); drawPet(ctx, k.x, k.y, k.pet, anim(k), t, k.dir); ctx.restore(); } });
      list.push({ fy: HAGE.y0, draw: () => ritaHageBak(ctx, HAGE) }, { fy: HAGE.y1 + 0.5, draw: () => ritaHageFram(ctx, HAGE) });
      for (const k of katter) if (k.plats === 'golv' || k.plats === 'korg' || k.plats === 'akvarium' || k.plats === 'ugn' || k.plats === 'hage') list.push({ fy: k.paBord && k.state !== 'ga' ? BORD[sitter ?? 0].y + 1 : k.y, draw: () => drawPet(ctx, k.x, k.paBord && k.state !== 'ga' ? k.y - 12 : k.y, k.pet, anim(k), t, k.dir) });
      for (const q of GASTER) list.push({ fy: q.y + (q.sitter ? 0.6 : 0), draw: () => drawGast(ctx, q) });
      list.push({ fy: elin.y, draw: () => drawPerson(ctx, elin.x, elin.y, ELIN, elin.dir, elin.vila > 0 ? 9 : [7, 8, 7, 9][Math.floor(t * 7) % 4]) });
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
      const k = kattAt(x, y);
      if (k && !(s && (s.id === 'disk' || s.id.startsWith('bord')))) {
        const gy = VAGG.has(k.plats) ? Math.max(WALL_Y + 10, Math.min(FONSTER.y + 14, k.y + 30)) : k.plats === 'hage' ? HAGE.y0 + 4 : k.plats === 'tunnel' ? k.y + 2 : k.y + 6;
        const gx = k.plats === 'hage' ? HAGE.x0 - 10 : k.plats === 'tunnel' ? TUNNEL.x - 34 : k.plats === 'ugn' ? UGN.x0 - 22 : k.x + (walker.px < k.x ? -12 : 12);
        walker.walkTo(gx, Math.max(WALL_Y + 8, gy), () => klappa(k)); return;
      }
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
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
