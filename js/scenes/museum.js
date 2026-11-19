// 🏛️ MUSEET i Gamla stan – Pixelstadens historia (Carl 2026-11-18: "Gamla stan: … museum"). 640 px brett rum som rullar
// med figuren – inredningen målas i js/gamlastan/museum-inne.js. Från vänster: dörren UT, intendent Maltes disk,
// tavelgalleriet, Kattstatyns krona under glas, den första bussen som modell, Gunvors fotbollssko, mitt i salen
// PIXELOSAURUS bakom sammetsrepen (vakten Vera håller koll – rör man skelettet tre gånger blir det tillsägelse),
// Solöns gamla fyrlampa och Pirat-Petters kista längst bort. Klicka på ett föremål → figuren går dit och skylten läses
// upp. Har man sett minst tre föremål erbjuder Malte MUSEIQUIZET vid disken: tre frågor om det man sett, tre svar var.
// Alla rätt = MUSEIDIPLOM och en utbildningspoäng (g.museiDiplom, en gång om dagen) + lycka; annars lite lycka ändå.
// _debug-API för tools/museum-test.mjs.
import { drawPerson, makeLook } from '../core/people.js';
import { SMALL, ctxText, textW } from '../core/floor-pix.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables, createSpeech } from './walkable.js';
import { ritaKrukvaxt } from '../tassbacken/inne-kit.js';
import { MUS, FOREMAL, paintMuseumBg, ritaKrona, ritaBussModell, ritaSko, ritaFyrlampa, ritaKista, ritaDino, ritaRep, ritaDisk } from '../gamlastan/museum-inne.js';
import { $t } from '../core/i18n.js';

const { W, H, WALL_Y, DOOR, DISK, TAVLOR, KRONA, BUSS, SKO, FYR, KISTA, DINO, VAKT, SPOTS } = MUS;
const MALTE = { skin: '#e0b090', hair: '#8a8a92', style: 'short', top: 'jacket', shirt: '#3a3a52', accent: '#f4f1ea', bottom: 'pants', pants: '#2a2a3a', shoes: '#2a1a14', glasses: 'round', beard: true, phones: false, bag: null, hat: null, apron: false, build: 3, blush: false, kid: false };
const VERA = { skin: '#c68a5c', hair: '#1a1a1a', style: 'bun', top: 'jacket', shirt: '#1e3a6a', accent: '#f0c030', bottom: 'pants', pants: '#1e3a6a', shoes: '#1a1a1a', glasses: false, beard: false, phones: false, bag: null, hat: 'cap', cap: '#1e3a6a', apron: false, build: 4, blush: false, kid: false };
const lcg = (s) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
const LR = lcg(1848);
const MALTE_SAY = [
  $t('Välkommen till Museet! Titta på föremålen – skyltarna berättar. När du sett tre stycken får du ta quizet hos mig.'),
  $t('Pixelosaurus är vår stolthet. Vera vaktar den som en hök.'),
  $t('Kronan kom tillbaka tack vare en detektiv med förstoringsglas. Kanske var det du?'),
];
const GASTER = [
  { x: TAVLOR[1].x0 + 20, y: WALL_Y + 16, dir: 'up', look: makeLook(LR) },
  { x: DINO.x0 - 16, y: DINO.y1 + 6, dir: 'up', look: { ...makeLook(LR), glasses: 'round' } },
  { x: KISTA.x - 24, y: KISTA.y - 6, dir: 'right', kid: true, look: { ...makeLook(LR), kid: true } },
];
const QUIZ_N = 3;

export function makeMuseum(A) {
  const g = A.game;
  let VW = 384;
  const syncView = () => { VW = Math.max(384, Math.min(A.W || 384, W)); };
  const walker = createWalker({ W, H, left: 6, right: W - 6, top: WALL_Y + 6, bottom: H - 4, spawn: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 12] });
  walker.speed = 72;
  walker.setObstacles([
    [DISK.x - 2, DISK.y - 2, DISK.x + DISK.w + 2, DISK.y + DISK.h + 2],
    [KRONA.x - 14, KRONA.y - 10, KRONA.x + 14, KRONA.y + 1], [BUSS.x - 26, BUSS.y - 8, BUSS.x + 26, BUSS.y + 1], [SKO.x - 14, SKO.y - 10, SKO.x + 14, SKO.y + 1],
    [FYR.x - 16, FYR.y - 10, FYR.x + 16, FYR.y + 1], [KISTA.x - 21, KISTA.y - 8, KISTA.x + 21, KISTA.y + 1],
    [DINO.x0 - 8, DINO.y0 + 16, DINO.x1 + 8, DINO.y1 + 4],
    ...GASTER.map((q) => [q.x - 5, q.y - 4, q.x + 5, q.y + 1]), [VAKT.x - 5, VAKT.y - 4, VAKT.x + 5, VAKT.y + 1],
  ]);
  walker.snapFree();
  let t = 0, hover = null, sayIdx = 1, greeted = false, dinoKlick = 0, quizAktiv = false;
  const sett = new Set();
  const talk = createSpeech();
  const mSay = (s, secs = 4.5) => talk.say(s, () => ({ x: DISK.x + 30, y: DISK.y - 30 }), secs, { voice: MALTE });
  const vSay = (s, secs = 3.5) => talk.say(s, () => ({ x: VAKT.x, y: VAKT.y - 36 }), secs, { voice: VERA });
  const camTarget = () => Math.max(0, Math.min(W - VW, walker.px - VW / 2));
  syncView();
  const cam = { x: camTarget() };
  const BGd = paintMuseumBg();
  const fade = { a: 1, phase: 2, cb: null };
  function go(cb) { if (fade.phase === 1) return; fade.phase = 1; fade.cb = cb; }
  if (!A.attract) { const h = g.glad?.(1, '', 'museet', 2); if (h) setTimeout(() => toast($t`🏛️ Museet – Pixelstadens historia. +${h} 😊`, 'good'), 900); }

  // ---------- föremålen ----------
  function titta(id) {
    const f = FOREMAL.find((q) => q.id === id); if (!f) return;
    play('click');
    const ny = !sett.has(id); sett.add(id);
    toast(`${f.ik} ${f.namn}: ${f.fakta}`, ny ? 'good' : '');
    if (id === 'dino') { dinoKlick++; if (dinoKlick >= 3) { dinoKlick = 0; play('miss'); vSay($t('Vera: "RÖR INTE SKELETTET! Det är 70 miljoner år gammalt – och limmat."')); } }
    if (ny && sett.size === QUIZ_N) setTimeout(() => mSay($t('Malte: "Tre föremål! Kom till disken så tar vi museiquizet."')), 400);
  }
  // ---------- quizet ----------
  function disken() {
    play('knock');
    if (sett.size < QUIZ_N) { mSay(greeted ? $t`Malte: "Titta på ${QUIZ_N - sett.size} föremål till, så får du quizet."` : MALTE_SAY[0]); greeted = true; return; }
    openModal($t('🏛️ Museiquizet'), `<p style="font-size:var(--f2);margin-top:0">${$t('Tre frågor om det du sett, tre svar på varje. Alla rätt ger MUSEIDIPLOM och en utbildningspoäng (en gång om dagen).')}</p>`, [
      { label: $t('🎓 Kör!'), cls: 'btn-go', onClick: () => { closeModal(); startQuiz(); } },
      { label: $t('Inte nu'), onClick: closeModal },
    ]);
  }
  let quiz = null;
  function startQuiz() {
    const ids = [...sett].sort(() => Math.random() - 0.5).slice(0, QUIZ_N);
    quiz = { fragor: ids.map((id) => FOREMAL.find((q) => q.id === id)), i: 0, ratt: 0 };
    quizAktiv = true; fraga();
  }
  function fraga() {
    const f = quiz.fragor[quiz.i];
    const alt = f.svar.map((s, k) => ({ s, ratt: k === 0 })).sort(() => Math.random() - 0.5);
    const dlg = openModal($t`🏛️ Fråga ${quiz.i + 1} av ${QUIZ_N}`, `<p style="font-size:var(--f2);margin-top:0"><b>${esc(f.fraga)}</b></p><div class="plist">${alt.map((a) => `<button class="btn" style="width:100%;margin:3px 0" data-svar="${esc(a.s)}" data-ratt="${a.ratt ? 1 : 0}">${esc(a.s)}</button>`).join('')}</div>`, []);
    dlg.querySelectorAll('[data-svar]').forEach((b) => (b.onclick = () => { const ok = b.dataset.ratt === '1'; closeModal(); if (ok) { quiz.ratt++; play('ok'); toast($t('✅ Rätt!'), 'good'); } else { play('miss'); toast($t`❌ Fel – rätt svar: ${f.svar[0]}`, 'bad'); } quiz.i++; if (quiz.i < QUIZ_N) setTimeout(fraga, 500); else setTimeout(quizKlar, 500); }));
  }
  function quizKlar() {
    quizAktiv = false;
    const alla = quiz.ratt === QUIZ_N;
    if (alla) {
      const r = g.museiDiplom?.() || { ok: false, poang: 0 };
      const h = g.glad?.(2, $t('Museidiplom'), 'museiquiz', 2) || 0;
      play('fanfare');
      toast(r.ok ? $t`🎓 MUSEIDIPLOM! Alla tre rätt – +1 utbildningspoäng.` + (h ? ` +${h} 😊` : '') : $t('🎓 Alla tre rätt igen! Diplomet för i dag har du redan.') + (h ? ` +${h} 😊` : ''), 'good');
      mSay($t('Malte: "Imponerande! Du kan din stad."'));
    } else {
      const h = g.glad?.(1, $t('Museiquizet'), 'museiquiz', 2) || 0;
      toast($t`🏛️ ${quiz.ratt} av ${QUIZ_N} rätt. Läs skyltarna en gång till och försök igen!` + (h ? ` +${h} 😊` : ''));
      mSay($t('Malte: "Nära! Skyltarna står kvar – de har tålamod."'));
    }
    quiz = null;
  }
  // ut: A.gamlaFran ({ museum, buss }) sattes av gamlastan.js när man gick in och ligger kvar – då står man vid museets dörr igen
  function ut() { play('door'); go(() => { if (!A.gamlaFran?.museum) A.gamlaFran = { museum: true, buss: A.gamlaFran?.buss || '' }; A.go('gamlastan'); }); }

  // ---------- platserna ----------
  const spots = () => [
    { id: 'ut', r: [DOOR.x0 - 4, 0, DOOR.x1 + 4, WALL_Y], go: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 10], label: $t('UT TILL GAMLA STAN'), act: ut },
    { id: 'disk', r: [DISK.x - 4, DISK.y - 40, DISK.x + DISK.w + 4, DISK.y + DISK.h], go: [DISK.x + DISK.w / 2, DISK.y + DISK.h + 10], label: sett.size >= QUIZ_N ? $t('INTENDENT MALTE – MUSEIQUIZET') : $t('INTENDENT MALTE'), act: disken },
    { id: 'tavlor', r: [TAVLOR[0].x0 - 4, 4, TAVLOR[2].x1 + 4, WALL_Y], go: [TAVLOR[1].x0 + 22, WALL_Y + 14], label: $t('TAVELGALLERIET'), act: () => titta('tavlor') },
    { id: 'krona', r: [KRONA.x - 14, KRONA.y - 66, KRONA.x + 14, KRONA.y], go: [KRONA.x, KRONA.y + 10], label: $t('KATTSTATYNS KRONA'), act: () => titta('krona') },
    { id: 'buss', r: [BUSS.x - 28, BUSS.y - 52, BUSS.x + 28, BUSS.y], go: [BUSS.x - 34, BUSS.y - 2], label: $t('DEN FÖRSTA BUSSEN'), act: () => titta('buss') },
    { id: 'sko', r: [SKO.x - 14, SKO.y - 62, SKO.x + 14, SKO.y], go: [SKO.x, SKO.y + 10], label: $t('GUNVORS FOTBOLLSSKO'), act: () => titta('sko') },
    { id: 'dino', r: [DINO.x0, DINO.y0 - 20, DINO.x1, DINO.y1], go: [DINO.cx, DINO.y1 + 12], label: $t('PIXELOSAURUS'), act: () => titta('dino') },
    { id: 'fyr', r: [FYR.x - 16, FYR.y - 72, FYR.x + 16, FYR.y], go: [FYR.x, FYR.y + 10], label: $t('SOLÖNS GAMLA FYRLAMPA'), act: () => titta('fyr') },
    { id: 'kista', r: [KISTA.x - 22, KISTA.y - 36, KISTA.x + 22, KISTA.y], go: [KISTA.x, KISTA.y + 8], label: $t('PIRAT-PETTERS KISTA'), act: () => titta('kista') },
    { id: 'vakt', r: [VAKT.x - 8, VAKT.y - 36, VAKT.x + 8, VAKT.y + 2], go: [VAKT.x - 14, VAKT.y + 4], label: $t('VAKTEN VERA'), act: () => { play('knock'); vSay($t('Vera: "Titta så mycket du vill – men händerna i fickorna."')); } },
  ];
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);

  return {
    viewMax: { w: W, h: H },
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    update(dt) {
      t += dt; syncView();
      if (fade.phase === 1) { fade.a = Math.min(1, fade.a + dt * 2.6); if (fade.a >= 1) { fade.phase = 0; const cb = fade.cb; fade.cb = null; cb?.(); return; } }
      else if (fade.phase === 2) { fade.a = Math.max(0, fade.a - dt * 1.8); if (fade.a <= 0) fade.phase = 0; }
      walker.update(dt);
      const c = camTarget(); cam.x += (c - cam.x) * Math.min(1, dt * 8);   // camTarget ger ett tal (bara x)
      if (!greeted && t > 1.2) { greeted = true; mSay(MALTE_SAY[0], 5.5); }
      else if (greeted && Math.random() < dt * 0.02 && !talk.text()) mSay(MALTE_SAY[sayIdx++ % MALTE_SAY.length]);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const cx = Math.round(cam.x);
      ctx.drawImage(BGd, -cx, 0);
      ctx.save(); ctx.translate(-cx, 0);
      // spotlightarnas sken på golvet
      ctx.globalCompositeOperation = 'lighter';
      for (const sx of SPOTS) { const gr = ctx.createRadialGradient(sx, WALL_Y + 60, 4, sx, WALL_Y + 60, 60); gr.addColorStop(0, 'rgba(255,240,200,0.16)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = gr; ctx.fillRect(sx - 60, WALL_Y, 120, 140); }
      ctx.globalCompositeOperation = 'source-over';
      const items = [];
      items.push({ fy: DISK.y + DISK.h, draw: () => ritaDisk(ctx) }, { fy: DISK.y - 1, draw: () => drawPerson(ctx, DISK.x + 30, DISK.y - 2, MALTE, 'down', talk.text()?.startsWith('Malte') ? 11 : 0) });
      items.push({ fy: KRONA.y, draw: () => ritaKrona(ctx, KRONA.x, KRONA.y, t) }, { fy: BUSS.y, draw: () => ritaBussModell(ctx, BUSS.x, BUSS.y) }, { fy: SKO.y, draw: () => ritaSko(ctx, SKO.x, SKO.y) });
      items.push({ fy: FYR.y, draw: () => ritaFyrlampa(ctx, FYR.x, FYR.y, t) }, { fy: KISTA.y, draw: () => ritaKista(ctx, KISTA.x, KISTA.y) });
      items.push({ fy: DINO.fy, draw: () => ritaDino(ctx) }, { fy: DINO.y1 + 5, draw: () => ritaRep(ctx) });
      items.push({ fy: VAKT.y, draw: () => drawPerson(ctx, VAKT.x, VAKT.y, VERA, 'left', Math.sin(t * 1.1) > 0.92 ? 4 : 0) });
      items.push({ fy: WALL_Y + 8, draw: () => { ritaKrukvaxt(ctx, 120, WALL_Y + 8, 'palm'); ritaKrukvaxt(ctx, 630, WALL_Y + 8, 'monstera'); } });
      for (const q of GASTER) items.push({ fy: q.y, draw: () => drawPerson(ctx, q.x, q.y, q.look, q.dir, Math.sin(t * 1.3 + q.x) > 0.9 ? 4 : 0) });
      items.push(...folkDrawables(A, t));
      const me = selfDrawable(A, walker, t); items.push({ fy: me.fy, draw: () => me.draw(ctx) });
      items.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      talk.draw(ctx, { x0: cx, x1: cx + VW });
      ctx.restore();
      const s = hover && spotAt(hover.x + cx, hover.y);
      if (s) { const w = textW(SMALL, s.label) + 10, x = Math.round(Math.max(2, Math.min(VW - w - 2, hover.x - w / 2))), y = Math.max(2, hover.y - 22); ctx.fillStyle = 'rgba(20,18,26,.9)'; ctx.fillRect(x, y, w, 11); ctxText(ctx, SMALL, s.label, x + 5, y + 3, '#ffd23f'); }
      const sl = $t`SETT ${sett.size} AV ${FOREMAL.length}`; ctx.fillStyle = 'rgba(20,18,26,.8)'; ctx.fillRect(VW - textW(SMALL, sl) - 14, 4, textW(SMALL, sl) + 10, 11); ctxText(ctx, SMALL, sl, VW - textW(SMALL, sl) - 9, 7, '#f4f1ea');
      if (fade.a > 0) { ctx.fillStyle = `rgba(10,10,16,${fade.a.toFixed(2)})`; ctx.fillRect(0, 0, VW, H); }
    },
    down(sx, sy) {
      if (fade.phase === 1 || quizAktiv) return;
      hover = { x: sx, y: sy };
      const x = sx + cam.x, y = sy;
      const s = spotAt(x, y);
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { hover = { x: sx, y: sy }; },
    exit() { talk.clear(); },
    _debug: {
      pos: () => ({ x: walker.px, y: walker.py }),
      cam: () => ({ x: cam.x }),
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); cam.x = camTarget(); },
      spots: () => spots().map((s) => s.id),
      act: (id) => { const s = spots().find((q) => q.id === id); if (!s) return false; s.act(); return true; },
      prat: () => talk.text(),
      sett: () => [...sett],
      quiz: () => (quiz ? { i: quiz.i, ratt: quiz.ratt, fragor: quiz.fragor.map((f) => f.id) } : null),
      fade: () => fade.phase,
    },
  };
}
