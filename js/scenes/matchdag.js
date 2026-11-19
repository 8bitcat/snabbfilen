// ⚽ MATCHDAGEN – Arenan steg 2 (Carl 2026-11-18: "Arenan: matchdag-minispel"). Biljetten köps i biljettluckan på
// Arenatorget (arenan.js → A.matchFran → A.go('matchdag')). Man står på läktaren mitt bland supportrarna och hejar fram
// KBK: klackledaren Kjell ropar KLAPPA, HEJA, VÅGEN eller SJUNG, och man trycker på rätt knapp (eller 1–4) innan hans
// tålamod tar slut. Rätt → STÄMNINGEN stiger (klapp, vågen går runt läktaren), fel eller för sent → den sjunker.
// Matchen går i två halvlekar om 45 minuter (en matchminut per sekund) med HALVTID emellan (korv!). Lagen anfaller
// om vartannat: KBK:s chans att göra mål växer med stämningen, bortalagets krymper. Målskyttarna är KBK:s riktiga
// spelare (data/kbk.js, bara förnamn). Slutsignalen ger lycka efter resultatet, och sedan står man på Arenatorget igen.
import { openModal, closeModal, toast } from '../core/ui.js';
import { play } from '../core/sound.js';
import { SMALL, BIG, ctxText, textW } from '../core/floor-pix.js';
import { makeLook } from '../core/people.js';
import { KUNGS_PLAYERS } from '../data/kbk.js';
import { makePops } from '../jobs/shift.js';
import { FW, FH, BTN, paintMatchBg, drawTavla, drawSpelare, drawBoll, drawLaktare, drawJag, drawKjell, drawKnappar, drawStamning } from '../arenan/match.js';
import { KBK } from '../arenan/karta.js';
import { $t } from '../core/i18n.js';

export const HALVLEK = 45, PAUS = 6, BILJETT_PRIS = 30, KORV_PRIS = 25;
export const MOTSTANDARE = [
  { namn: $t('Pixelbergs IF'), kort: 'PIF', troja: 0xf0c030, byxor: 0x1a1414 },
  { namn: $t('Solö BK'), kort: 'SBK', troja: 0x3a7bd5, byxor: 0xf4f1ea },
  { namn: $t('Hamnens FF'), kort: 'HFF', troja: 0x46a35a, byxor: 0x1a1414 },
  { namn: $t('Linné United'), kort: 'LUN', troja: 0xf4f1ea, byxor: 0x2a5aa8 },
  { namn: $t('Tassbackens BK'), kort: 'TBK', troja: 0xf07e24, byxor: 0x1a1414 },
];
export const dagensMotstandare = (dag) => MOTSTANDARE[(dag | 0) % MOTSTANDARE.length];
const CHANTS = [
  { id: 'klappa', namn: $t('KLAPPA'), cues: [$t('Klappa händerna!'), $t('Klapp-klapp-klapp!')], ikon: ['k.....k', 'kk...kk', '.kk.kk.', '..kkk..', '..kkk..', '.kk.kk.', 'k.....k'] },
  { id: 'heja', namn: $t('HEJA'), cues: [$t('HEJA KBK!'), $t('Armarna upp – HEJA!')], ikon: ['k.....k', 'k.kkk.k', 'kkkkkkk', '.kkkkk.', '..kkk..', '..k.k..', '..k.k..'] },
  { id: 'vagen', namn: $t('VÅGEN'), cues: [$t('Nu kör vi VÅGEN!'), $t('Vågen – upp och ner!')], ikon: ['.......', 'kk...kk', 'k.k.k.k', '...k...', 'kk...kk', 'k.k.k.k', '...k...'] },
  { id: 'sjung', namn: $t('SJUNG'), cues: [$t('Sjung med! KBK, KBK!'), $t('Allsång för laget!')], ikon: ['...kk..', '...k.k.', '...k...', '...k...', '.kkk...', 'kkkk...', '.kk....'] },
];
const KBKFARG = { troja: KBK.rod, byxor: KBK.svart, hud: 0xe0a97f };

export function makeMatchdag(A) {
  const g = A.game;
  const from = A.matchFran || null; A.matchFran = null;
  const motst = dagensMotstandare(g.day);
  const MF = { ...motst, hud: 0xf1c7a3 };
  const pops = makePops();
  let t = 0, spel = 0, halv = 1, paus = 0, done = false, doneT = 0, lamnad = false;
  const S = { kbk: 0, gast: 0 };
  let stamning = 50, cue = null, nextT = 2.2, streak = 0, pose = null, poseT = 0, klapp = 0, jubel = 0, suck = 0, vag = null, info = '', infoT = 0, lastCue = -1, korv = false;
  let anfall = null, nextAnfall = 5, flash = 0;
  const skyttar = [];
  let seed = ((g.day || 1) * 104729 + 7919) % 233280;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const KJELL = { skin: '#c68a5c', hair: '#1a1a1a', style: 'short', top: 'tee', shirt: '#7a1a2a', bottom: 'jeans', pants: '#1a1414', hat: 'beanie', cap: '#7a1a2a', beard: true, glasses: false, kid: false };
  const ljus = () => { const h = g.min / 60; return h >= 20 || h < 6 ? 2 : h >= 17 ? 1 : 0; };
  const minut = () => Math.min(90, (halv === 1 ? 0 : HALVLEK) + Math.floor(spel));
  // ---------- spelarna ----------
  const form = [[-0.92, 0.5], [-0.6, 0.25], [-0.6, 0.75], [-0.3, 0.5], [-0.05, 0.3], [-0.05, 0.7]];
  const kbk = form.map(([x, y], i) => ({ hx: x, hy: y, x, y, f: i * 1.3, jubel: 0 }));
  const gast = form.map(([x, y], i) => ({ hx: -x, hy: y, x: -x, y, f: i * 1.7 + 0.5, jubel: 0 }));
  const boll = { x: 0, y: 0.5, h: 0, tx: 0, ty: 0.5 };
  function updPlan(dt) {
    const skjut = anfall ? anfall.lag === 'kbk' ? 1 : -1 : 0;
    for (const [lag, mot] of [[kbk, 1], [gast, -1]]) for (const p of lag) {
      const push = skjut * mot * 0.22, tx = p.hx + push + (boll.x - p.hx) * 0.25 + Math.sin(t * 1.2 + p.f) * 0.03, ty = p.hy + (boll.y - p.hy) * 0.3 + Math.cos(t * 1.1 + p.f) * 0.03;
      p.x += (tx - p.x) * Math.min(1, dt * 2.5); p.y += (ty - p.y) * Math.min(1, dt * 2.5);
      if (p.jubel > 0) p.jubel -= dt;
    }
    boll.x += (boll.tx - boll.x) * Math.min(1, dt * 3); boll.y += (boll.ty - boll.y) * Math.min(1, dt * 3);
    if (!anfall && Math.random() < dt * 0.8) { boll.tx = (Math.random() - 0.5) * 1.2; boll.ty = 0.2 + Math.random() * 0.6; }
  }
  // ---------- anfallen ----------
  function nyttAnfall() {
    const lag = rnd() < 0.56 ? 'kbk' : 'gast';
    anfall = { lag, t: 0, dur: 3.2, klart: false };
    const sida = lag === 'kbk' ? 1 : -1;
    boll.tx = sida * 0.86; boll.ty = 0.5 + (rnd() - 0.5) * 0.3;
    if (lag === 'kbk') { const [nr, namn] = KUNGS_PLAYERS[(rnd() * KUNGS_PLAYERS.length) | 0]; anfall.vem = { nr, namn }; saga($t`Nr ${nr} ${namn} driver framåt …`); }
    else saga($t`${motst.namn} anfaller …`);
  }
  function avgorAnfall() {
    const a = anfall; a.klart = true;
    const p = a.lag === 'kbk' ? 0.2 + stamning / 100 * 0.5 : 0.42 - stamning / 100 * 0.3;
    if (rnd() < p) {
      if (a.lag === 'kbk') { S.kbk++; skyttar.push(a.vem); saga($t`⚽ MÅÅÅL! Nr ${a.vem.nr} ${a.vem.namn}!`); jubel = 3; flash = 0.6; stamning = Math.min(100, stamning + 8); for (const q of kbk) q.jubel = 2.5; play('fanfare'); pops.add(FW / 2, 70, $t('MÅÅÅL!'), '#ffd23f'); }
      else { S.gast++; saga($t`${motst.namn} gör mål … ${S.kbk}–${S.gast}.`); suck = 2.5; stamning = Math.max(0, stamning - 6); for (const q of gast) q.jubel = 2.5; play('miss'); }
    } else {
      saga(a.lag === 'kbk' ? [$t('Räddning av deras målvakt!'), $t('I stolpen! Nära!'), $t('Över ribban …')][(rnd() * 3) | 0] : [$t('Räddning! Vilken målvakt!'), $t('Utanför. Puh.'), $t('Blockerat av försvaret!')][(rnd() * 3) | 0]);
      if (a.lag === 'kbk') suck = 1.2; else { klapp = 1.2; stamning = Math.min(100, stamning + 2); }
      play(a.lag === 'kbk' ? 'miss' : 'ok');
    }
    boll.tx = 0; boll.ty = 0.5;
  }
  function saga(s) { info = s; infoT = 3.2; }
  // ---------- Kjells rop ----------
  const cueDur = () => 2.8, gap = () => 1.6 + rnd() * 2.4;
  function nyCue() { let k = (rnd() * CHANTS.length) | 0; if (k === lastCue) k = (k + 1) % CHANTS.length; lastCue = k; const ch = CHANTS[k]; cue = { id: ch.id, text: ch.cues[(rnd() * ch.cues.length) | 0], t: cueDur(), dur: cueDur() }; play('click'); }
  function press(id) {
    if (done || paus > 0) return;
    pose = id; poseT = 1.2;
    if (!cue) return;
    if (cue.id === id) {
      streak++; stamning = Math.min(100, stamning + 10); cue = null; nextT = gap();
      if (id === 'vagen') vag = 0; else klapp = 1.4;
      pops.add(FW / 2, 112, ['+10', $t('SÅ JA!'), $t('HÖRS HELA VÄGEN!')][(rnd() * 3) | 0], '#8ae08a'); play('ok');
      if (streak % 8 === 0) { stamning = Math.min(100, stamning + 10); pops.add(FW / 2, 96, $t('HELA LÄKTAREN SJUNGER!'), '#ff8ac8'); play('fanfare'); jubel = Math.max(jubel, 1.5); }
    } else { streak = 0; stamning = Math.max(0, stamning - 6); cue = null; nextT = gap() + 0.5; pops.add(FW / 2, 112, $t('FEL ROP!'), '#ff6a6a'); play('miss'); }
  }
  // ---------- slutet ----------
  function slut() {
    done = true; cue = null; anfall = null; play('fanfare');
    const vinst = S.kbk > S.gast, oavgjort = S.kbk === S.gast;
    const h = vinst ? g.glad?.(3, $t('KBK vann!'), 'matchdag', 2) || 0 : oavgjort ? g.glad?.(2, $t('Matchdag på Arenan'), 'matchdag', 2) || 0 : g.glad?.(1, $t('Matchdag på Arenan'), 'matchdag', 2) || 0;
    g.passTime?.(30); g.save?.();
    const text = vinst ? $t`🏆 KBK VANN med ${S.kbk}–${S.gast}! Läktaren kokar.` : oavgjort ? $t`⚽ Oavgjort, ${S.kbk}–${S.gast}. Bra kämpat!` : $t`⚽ Förlust, ${S.kbk}–${S.gast}. Nästa gång!`;
    setTimeout(() => toast(text + (h ? ` +${h} 😊` : ''), vinst ? 'good' : ''), 300);
  }
  function tillbaka() { A.arenaFran = { arena: true, buss: from?.buss || '' }; A.go('arenan'); }
  function korven() {
    if (korv) return;
    if (g.money < KORV_PRIS) { toast($t('Du har inte råd med en korv.'), 'bad'); return; }
    g.money -= KORV_PRIS; g.hunger = Math.min(100, (g.hunger || 0) + 22); korv = true; g.save?.(); play('coin'); pops.add(FW / 2, 100, $t('MUMS!'), '#ffd23f');
  }
  function update(dt) {
    t += dt; pops.update(dt);
    if (poseT > 0 && (poseT -= dt) <= 0) pose = null;
    if (klapp > 0) klapp -= dt; if (jubel > 0) jubel -= dt; if (suck > 0) suck -= dt; if (flash > 0) flash -= dt; if (infoT > 0 && (infoT -= dt) <= 0) info = '';
    if (vag != null) { vag += dt * 0.9; if (vag > 1.15) vag = null; }
    updPlan(dt);
    if (done) { doneT += dt; if (doneT > 3 && !lamnad) { lamnad = true; tillbaka(); } return; }
    if (paus > 0) { paus -= dt; if (paus <= 0) { halv = 2; spel = 0; nextT = 2; nextAnfall = 4; saga($t('Andra halvlek är igång!')); } return; }
    spel += dt;
    if (spel >= HALVLEK) { if (halv === 1) { paus = PAUS; cue = null; anfall = null; boll.tx = 0; boll.ty = 0.5; saga($t('HALVTID')); play('pling'); return; } slut(); return; }
    if (cue) { cue.t -= dt; if (cue.t <= 0) { streak = 0; stamning = Math.max(0, stamning - 5); cue = null; nextT = gap() + 0.5; pops.add(FW / 2, 112, $t('FÖR SENT!'), '#ff6a6a'); play('miss'); } }
    else if ((nextT -= dt) <= 0) nyCue();
    if (anfall) { anfall.t += dt; if (!anfall.klart && anfall.t >= anfall.dur) avgorAnfall(); if (anfall.t >= anfall.dur + 1.2) { anfall = null; nextAnfall = 5 + rnd() * 6; } }
    else if ((nextAnfall -= dt) <= 0) nyttAnfall();
    stamning = Math.max(0, stamning - dt * 0.6);   // sjunker sakta av sig själv
  }
  return {
    get worldX() { return FW / 2; }, get worldY() { return FH / 2; },
    update,
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(paintMatchBg(ljus(), motst), 0, 0);
      drawTavla(ctx, S, motst, minut(), info);
      const alla = [...kbk.map((p) => ({ p, f: KBKFARG })), ...gast.map((p) => ({ p, f: MF }))].sort((a, b) => a.p.y - b.p.y);
      for (const { p, f } of alla) drawSpelare(ctx, p, f);
      drawBoll(ctx, boll);
      if (flash > 0) { ctx.fillStyle = `rgba(255,240,160,${(flash * 0.5).toFixed(2)})`; ctx.fillRect(0, 0, FW, 128); }
      const vagUpp = vag != null && Math.abs(0.5 - vag) < 0.14 ? Math.round(Math.cos(Math.abs(0.5 - vag) / 0.14 * Math.PI / 2) * 6) : 0;
      drawLaktare(ctx, { t, klapp, vag, jubel, suck, hoppa: pose === 'heja' });
      drawKjell(ctx, KJELL, cue, CHANTS);
      drawJag(ctx, A.avatar?.look || makeLook(), { t, pose, vagUpp });
      drawKnappar(ctx, CHANTS, pose, streak);
      drawStamning(ctx, stamning);
      pops.draw(ctx);
      const rub = $t`MATCHDAG · ${halv === 1 ? $t('1:A HALVLEK') : $t('2:A HALVLEK')} · ${minut()}'`;
      ctx.fillStyle = 'rgba(20,18,26,.8)'; ctx.fillRect(4, 4, textW(SMALL, rub) + 10, 11); ctxText(ctx, SMALL, rub, 9, 7, '#f4f1ea');
      const lm = $t('LÄMNA'); ctx.fillStyle = 'rgba(20,18,26,.8)'; ctx.fillRect(4, 18, textW(SMALL, lm) + 10, 11); ctxText(ctx, SMALL, lm, 9, 21, '#ff8a8a');
      if (paus > 0) {
        ctx.fillStyle = 'rgba(10,10,20,.55)'; ctx.fillRect(0, 0, FW, FH);
        const s = $t('HALVTID'), s2 = $t`${S.kbk} – ${S.gast}`; ctxText(ctx, BIG, s, (FW - textW(BIG, s, 2)) >> 1, 60, '#ffd23f', 2); ctxText(ctx, BIG, s2, (FW - textW(BIG, s2, 2)) >> 1, 84, '#f4f1ea', 2);
        const k = korv ? $t('KORVEN ÄR UPPÄTEN') : $t`KÖP EN KORV · ${KORV_PRIS} KR`; const w = textW(SMALL, k) + 16; ctx.fillStyle = korv ? '#2a2436' : '#7a1a2a'; ctx.fillRect((FW - w) >> 1, 112, w, 16); ctxText(ctx, SMALL, k, (FW - textW(SMALL, k)) >> 1, 116, '#f4f1ea');
        const s3 = $t`Andra halvlek om ${Math.ceil(paus)} s`; ctxText(ctx, SMALL, s3, (FW - textW(SMALL, s3)) >> 1, 136, '#a8a8b0');
      }
      if (done) {
        ctx.fillStyle = `rgba(10,10,20,${Math.min(0.6, doneT * 0.5).toFixed(2)})`; ctx.fillRect(0, 0, FW, FH);
        const s = $t('SLUTSIGNAL'), s2 = `KBK ${S.kbk} – ${S.gast} ${motst.kort}`; ctxText(ctx, BIG, s, (FW - textW(BIG, s, 2)) >> 1, 64, '#ffd23f', 2); ctxText(ctx, BIG, s2, (FW - textW(BIG, s2, 2)) >> 1, 88, '#f4f1ea', 2);
        if (skyttar.length) { const s3 = $t('Målskyttar: ') + skyttar.map((q) => `${q.namn} (${q.nr})`).join(', '); ctxText(ctx, SMALL, s3, (FW - textW(SMALL, s3)) >> 1, 112, '#8ae08a'); }
      }
    },
    down(x, y) {
      if (done) return;
      if (x >= 4 && x <= 4 + textW(SMALL, $t('LÄMNA')) + 10 && y >= 18 && y <= 29) { lamna(); return; }
      if (paus > 0) { const k = korv ? $t('KORVEN ÄR UPPÄTEN') : $t`KÖP EN KORV · ${KORV_PRIS} KR`, w = textW(SMALL, k) + 16; if (x >= (FW - w) / 2 && x <= (FW + w) / 2 && y >= 110 && y <= 130) korven(); return; }
      for (let i = 0; i < CHANTS.length; i++) { const B = BTN(i); if (x >= B.x - 1 && x <= B.x + B.w + 1 && y >= B.y - 1 && y <= B.y + B.h + 1) { press(CHANTS[i].id); return; } }
    },
    key(k) {
      if (k === 'Escape' && !done) { lamna(); return; }
      const i = ['1', '2', '3', '4'].indexOf(k); if (i >= 0) press(CHANTS[i].id);
    },
    _debug: {
      state: () => ({ t: +t.toFixed(1), spel: +spel.toFixed(1), halv, paus: +paus.toFixed(1), minut: minut(), S: { ...S }, stamning: Math.round(stamning), streak, cue: cue ? cue.id : null, anfall: anfall ? { lag: anfall.lag, klart: anfall.klart } : null, done, korv, motst: motst.kort }),
      press: (id) => { press(id); return Math.round(stamning); },
      force: (id) => { const ch = CHANTS.find((q) => q.id === id) || CHANTS[0]; cue = { id: ch.id, text: ch.cues[0], t: cueDur(), dur: cueDur() }; return cue.id; },
      anfall: (lag) => { anfall = { lag, t: 0, dur: 0.01, klart: false, vem: { nr: 9, namn: KUNGS_PLAYERS[5][1] } }; boll.tx = lag === 'kbk' ? 0.86 : -0.86; },
      stamning: (v) => { if (v != null) stamning = v; return Math.round(stamning); },
      korv: () => korven(),
      tick: (sec) => { for (let k = 0; k < sec * 30; k++) update(1 / 30); },
      hoppa: (sec) => { spel += sec; },
      skyttar: () => skyttar.map((q) => q.namn),
    },
  };
  function lamna() {
    openModal($t('⚽ Lämna matchen?'), `<p style="font-size:var(--f2);margin-top:0">${$t('Matchen fortsätter utan dig. Biljetten gäller inte igen i dag.')}</p>`, [
      { label: $t('Lämna'), cls: 'btn-go', onClick: () => { closeModal(); done = true; lamnad = true; tillbaka(); } },
      { label: $t('Stanna'), onClick: closeModal },
    ]);
  }
}
