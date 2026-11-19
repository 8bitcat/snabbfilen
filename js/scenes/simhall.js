// 🏊 SIMHALLEN på Arenatorget – Arenan steg 3 (Carl 2026-11-18: "Arenan: … simhall"; arenan.js lovade "bassäng,
// rutschkana och bubbelpool"). 640 px brett rum som rullar med figuren – inredningen målas i js/arenan/simhall-inne.js.
// Entrén betalas i arenan.js (SIM.PRIS, öppet SIM.OPPET). Byt om i omklädningsrummet först – sedan:
//   • 25-METERSBASSÄNGEN: ner för stegen → man simmar längder i sin bana. Klick (eller mellanslag) = simtag, takten
//     håller farten uppe; vid kortsidan vänder man. Varannan längd ger lycka, tio längder på ett besök = SIMMÄRKET.
//   • RUTSCHKANAN: upp för trappan, tre kurvor och plask i bassängens hörn (lycka). Barn åker hela tiden.
//   • BUBBELPOOLEN: sitt en stund → energi. BASTUN: svettas sex sekunder → energi och ro. Badvakten Ulla i stolen.
// Ut genom dörren → Arenatorget vid simhallens dörr (A.arenaFran.simhall ligger kvar från arenan.js).
// _debug-API för tools/simhall-test.mjs.
import { drawPerson, makeLook } from '../core/people.js';
import { SMALL, BIG, ctxText, textW } from '../core/floor-pix.js';
import { toast } from '../core/ui.js';
import { play } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables, createSpeech } from './walkable.js';
import { ritaKrukvaxt } from '../tassbacken/inne-kit.js';
import { ritaBadring } from '../vattenlandet/deko.js';
import { SIM, paintSimhallBg, ritaKana, kanaPos, ritaStol, ritaStege, ritaBastu, ritaBubblor, ritaGlitter, ritaPlask, ritaKlocka, ritaBank, ritaKassa } from '../arenan/simhall-inne.js';
import { $t } from '../core/i18n.js';

const { W, H, WALL_Y, DOOR, OMKL, KASSA, STOL, KANA, BASSANG, STEGE, STEGE2, BUBBEL, BASTU, BANKAR, PALM } = SIM;
const ULLA = { skin: '#f0cfae', hair: '#d8a040', style: 'ponytail', top: 'tee', shirt: '#d8343c', accent: '#f4f1ea', bottom: 'shorts', pants: '#f4f1ea', shoes: '#f0cfae', glasses: false, beard: false, phones: false, bag: null, hat: 'cap', cap: '#f4f1ea', apron: false, build: 3, blush: false, kid: false };
const ULLA_SAY = [$t('Badvakten Ulla: "Inget springande – och ingen dykning vid grunda delen!"'), $t('Badvakten Ulla: "Tio längder, så får du simmärket av mig."'), $t('Badvakten Ulla: "Rutschkanan är bäst med armarna i kors."')];
const lcg = (s) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
const LR = lcg(2525);
const BADFARGER = ['#e04848', '#3a7bd5', '#f0c030', '#46a35a', '#e060a0', '#f07e24'];
const KLATTER = 1.2, KANATID = 2.6, BUBBELTID = 5, BASTUTID = 6, SIMMARKE = 10;
const laneY = (b) => BASSANG.y0 + Math.round((BASSANG.y1 - BASSANG.y0) * (b + 0.5) / BASSANG.banor);

export function makeSimhall(A) {
  const g = A.game;
  let VW = 384;
  const syncView = () => { VW = Math.max(384, Math.min(A.W || 384, W)); };
  const walker = createWalker({ W, H, left: 6, right: W - 6, top: WALL_Y + 6, bottom: H - 4, spawn: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 12] });
  walker.speed = 72;
  const torrHinder = [
    [KASSA.x - 2, KASSA.y - 2, KASSA.x + KASSA.w + 2, KASSA.y + KASSA.h + 2],
    [BASSANG.x0 - 14, BASSANG.y0 - 6, BASSANG.x1 + 6, BASSANG.y1 + 4],
    [BUBBEL.x - BUBBEL.rx - 5, BUBBEL.y - BUBBEL.ry - 5, BUBBEL.x + BUBBEL.rx + 5, BUBBEL.y + BUBBEL.ry + 3],
    [BASTU.x - 2, BASTU.y - 2, BASTU.x + BASTU.w + 2, BASTU.y + BASTU.h + 2],
    [STOL.x - 10, STOL.y - 6, STOL.x + 10, STOL.y + 1], [PALM.x - 7, PALM.y - 6, PALM.x + 7, PALM.y + 1],
    ...BANKAR.map(([x, y]) => [x - 14, y - 6, x + 14, y + 1]),
  ];
  walker.setObstacles(torrHinder);
  walker.snapFree();
  let t = 0, hover = null, lage = 'torr', bad = false, sim = null, kana = null, bubbel = null, bastu = null, plask = [], sista = null, greeted = false, sayIdx = 1;
  const talk = createSpeech();
  const uSay = (s, secs = 4.5) => talk.say(s, () => ({ x: STOL.x, y: STOL.y - 72 }), secs, { voice: ULLA });
  const camTarget = () => Math.max(0, Math.min(W - VW, pos().x - VW / 2));
  syncView();
  const cam = { x: 0 };
  const BGd = paintSimhallBg();
  const fade = { a: 1, phase: 2, cb: null };
  function go(cb) { if (fade.phase === 1) return; fade.phase = 1; fade.cb = cb; }
  const pos = () => (sim ? { x: sim.x, y: sim.y } : kana ? kanaXY() : { x: walker.px, y: walker.py });
  cam.x = camTarget();
  if (!A.attract) { const h = g.glad?.(1, '', 'simhallen', 2); if (h) setTimeout(() => toast($t`🏊 Simhallen – det luktar klor och sommarlov. +${h} 😊`, 'good'), 900); }
  // ---------- folket ----------
  const simmare = [0, 1, 2].map((i) => ({ look: { ...makeLook(LR), top: 'tee', bottom: 'shorts', shirt: BADFARGER[i], hat: null }, bana: i, x: BASSANG.x0 + 60 + i * 120, dir: i % 2 ? -1 : 1, v: 26 + i * 6 }));
  const barn = { look: { ...makeLook(LR), kid: true, top: 'tee', bottom: 'shorts', shirt: BADFARGER[4] }, t: -3 };
  const bastare = { look: makeLook(LR) };
  function updLiv(dt) {
    for (const s of simmare) { s.x += s.dir * s.v * dt; if (s.x > BASSANG.x1 - 16) { s.x = BASSANG.x1 - 16; s.dir = -1; } if (s.x < BASSANG.x0 + 16) { s.x = BASSANG.x0 + 16; s.dir = 1; } }
    barn.t += dt; if (barn.t > KANATID + 1) { barn.t = -(5 + Math.random() * 6); }
    if (barn.t > KANATID && barn.t - dt <= KANATID) plask.push({ x: KANA.mynning[0], y: KANA.mynning[1] + 4, t: 0 });
    for (const p of plask) p.t += dt; plask = plask.filter((p) => p.t < 0.8);
    if (sim) { sim.v = Math.max(0, sim.v - dt * 28); sim.x += sim.dir * sim.v * dt; if (sim.dir > 0 && sim.x >= BASSANG.x1 - 14) { sim.x = BASSANG.x1 - 14; sim.dir = -1; langd(); } if (sim.dir < 0 && sim.x <= BASSANG.x0 + 14) { sim.x = BASSANG.x0 + 14; sim.dir = 1; langd(); } if (sim.taktT > 0) sim.taktT -= dt; }
    if (kana) { kana.t += dt; if (kana.t >= KLATTER + KANATID) kanaKlar(); }
    if (bubbel) { bubbel.t += dt; if (bubbel.t >= BUBBELTID) bubbelKlar(); }
    if (bastu) { bastu.t += dt; if (bastu.t >= BASTUTID) bastuKlar(); }
  }
  // ---------- bassängen ----------
  function iBassangen(fran = 'stege', bana = 3) {
    if (!bad) { toast($t('🩱 Byt om i omklädningsrummet först!'), 'bad'); return; }
    lage = 'sim'; walker.stop();
    const x = fran === 'kana' ? KANA.mynning[0] : fran === 'stege2' ? BASSANG.x1 - 14 : BASSANG.x0 + 14;
    sim = { x, y: laneY(bana), bana, dir: fran === 'stege2' ? -1 : 1, v: 0, langder: sim?.langder || 0, taktT: 0, start: x };
    if (fran !== 'kana') { play('slide'); toast($t('🏊 I vattnet! Klicka eller tryck mellanslag i takt – varje simtag ger fart. Vänd vid kanten.')); }
  }
  function simtag() { if (!sim) return false; sim.v = Math.min(92, sim.v + 38); sim.taktT = 0.5; play('click'); return true; }
  function langd() {
    sim.langder++; play('ok');
    const n = sim.langder;
    if (n % 2 === 0) { const h = g.glad?.(1, $t('Längder i simhallen'), 'simlangd', 3) || 0; toast($t`🏊 ${n} längder!` + (h ? ` +${h} 😊` : ''), h ? 'good' : ''); }
    if (n === SIMMARKE) { const h = g.glad?.(2, $t('Simmärket'), 'simmarke', 1) || 0; g.energy = Math.max(0, (g.energy || 0) - 4); play('fanfare'); toast($t('🏅 SIMMÄRKET! Tio längder – Ulla nickar från stolen.') + (h ? ` +${h} 😊` : ''), 'good'); uSay(ULLA_SAY[1]); }
    sista = { typ: 'langd', n };
  }
  function urBassangen(vid = 'stege') {
    const n = sim?.langder || 0; sim = null; lage = 'torr';
    const S = vid === 'stege2' ? STEGE2 : STEGE; walker.px = S.x; walker.py = S.y + 8; walker.stop(); walker.snapFree();
    toast(n ? $t`🏊 Upp ur bassängen efter ${n} längder – armarna känns.` : $t('🏊 Upp ur bassängen.'));
  }
  // ---------- rutschkanan ----------
  function akKana() {
    if (!bad) { toast($t('🩱 Byt om i omklädningsrummet först!'), 'bad'); return; }
    lage = 'kana'; walker.stop(); kana = { t: 0 }; play('slide'); toast($t('🛝 Upp för trappan till rutschkanan …'));
  }
  const kanaXY = () => { if (!kana) return { x: KANA.x0, y: WALL_Y }; if (kana.t < KLATTER) { const u = kana.t / KLATTER; return { x: KANA.x0 + 80 + u * 12, y: WALL_Y + 20 - u * 60, klattrar: true }; } const p = kanaPos(Math.min(1, (kana.t - KLATTER) / KANATID)); return { x: p.x, y: p.y - 4, dx: p.dx }; };
  function kanaKlar() {
    kana = null; plask.push({ x: KANA.mynning[0], y: KANA.mynning[1] + 4, t: 0 }); play('ok');
    const h = g.glad?.(1, $t('Rutschkanan i simhallen'), 'simkana', 2) || 0;
    sista = { typ: 'kana' };
    toast($t('🛝 Tre kurvor och PLASK! Vattnet upp i näsan.') + (h ? ` +${h} 😊` : ''), 'good');
    iBassangen('kana', 0);
  }
  // ---------- bubbelpoolen och bastun ----------
  function iBubbel() { if (!bad) { toast($t('🩱 Byt om i omklädningsrummet först!'), 'bad'); return; } lage = 'bubbel'; walker.stop(); bubbel = { t: 0 }; play('slide'); toast($t('🫧 Bubblorna kittlar under fötterna …')); }
  function bubbelKlar() { bubbel = null; lage = 'torr'; walker.px = BUBBEL.x - BUBBEL.rx - 12; walker.py = BUBBEL.y + 10; walker.snapFree(); g.energy = Math.min(100, (g.energy || 0) + 6); const h = g.glad?.(1, $t('Bubbelpoolen'), 'bubbelpool', 2) || 0; g.save(); sista = { typ: 'bubbel' }; toast($t('🫧 Varm och mjuk i kroppen. +6 ⚡') + (h ? ` +${h} 😊` : ''), 'good'); }
  function iBastu() { if (!bad) { toast($t('🩱 Byt om i omklädningsrummet först!'), 'bad'); return; } lage = 'bastu'; walker.stop(); bastu = { t: 0 }; play('door'); toast($t('🔥 Bastun: 80 grader och tyst. Någon slår på en skopa vatten.')); }
  function bastuKlar() { bastu = null; lage = 'torr'; walker.px = BASTU.x + 14; walker.py = BASTU.y + BASTU.h + 10; walker.snapFree(); g.energy = Math.min(100, (g.energy || 0) + 8); const h = g.glad?.(1, $t('Bastun'), 'bastu', 2) || 0; g.save(); sista = { typ: 'bastu' }; toast($t('🔥 Ut ur bastun, röd om kinderna. +8 ⚡') + (h ? ` +${h} 😊` : ''), 'good'); }
  function omkl() { play('door'); bad = !bad; toast(bad ? $t('🩱 Ombytt – baddräkten på och handduken i skåpet.') : $t('👕 Ombytt till vanliga kläder igen.'), 'good'); }
  function ut() { play('door'); go(() => { if (!A.arenaFran?.simhall) A.arenaFran = { simhall: true, buss: A.arenaFran?.buss || '' }; A.go('arenan'); }); }

  // ---------- platserna ----------
  const spots = () => lage === 'sim' ? [
    { id: 'upp', r: [STEGE.x - 12, STEGE.y - 30, STEGE.x + 12, STEGE.y + 4], go: [BASSANG.x0 + 14, sim.y], label: $t('STEGEN UPP'), act: () => urBassangen('stege') },
    { id: 'upp2', r: [STEGE2.x - 12, STEGE2.y - 30, STEGE2.x + 12, STEGE2.y + 4], go: [BASSANG.x1 - 14, sim.y], label: $t('STEGEN UPP'), act: () => urBassangen('stege2') },
  ] : lage === 'torr' ? [
    { id: 'ut', r: [DOOR.x0 - 4, 0, DOOR.x1 + 4, WALL_Y], go: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 10], label: $t('UT TILL ARENATORGET'), act: ut },
    { id: 'omkl', r: [OMKL.x0 - 4, 0, OMKL.x1 + 4, WALL_Y], go: [(OMKL.x0 + OMKL.x1) / 2, WALL_Y + 10], label: bad ? $t('OMKLÄDNINGSRUMMET – BYT TILLBAKA') : $t('OMKLÄDNINGSRUMMET – BYT OM'), act: omkl },
    { id: 'kassa', r: [KASSA.x - 2, KASSA.y - 30, KASSA.x + KASSA.w + 2, KASSA.y + KASSA.h], go: [KASSA.x + KASSA.w / 2, KASSA.y + KASSA.h + 10], label: $t('RECEPTIONEN'), act: () => toast($t`🎟️ Entrén är betald. Öppet ${SIM.OPPET[0]}–${SIM.OPPET[1]}. Handdukar finns i omklädningsrummet.`) },
    { id: 'stege', r: [STEGE.x - 12, STEGE.y - 30, STEGE.x + 12, STEGE.y + 6], go: [STEGE.x, STEGE.y + 10], label: $t('BASSÄNGEN – SIMMA LÄNGDER'), act: () => iBassangen('stege', 3) },
    { id: 'stege2', r: [STEGE2.x - 12, STEGE2.y - 30, STEGE2.x + 12, STEGE2.y + 6], go: [STEGE2.x, STEGE2.y + 10], label: $t('BASSÄNGEN – SIMMA LÄNGDER'), act: () => iBassangen('stege2', 3) },
    { id: 'kana', r: [KANA.x0 + 60, 0, KANA.x0 + 120, WALL_Y + 10], go: [KANA.x0 + 80, WALL_Y + 20], label: $t('RUTSCHKANAN – TRE KURVOR'), act: akKana },
    { id: 'bubbel', r: [BUBBEL.x - BUBBEL.rx, BUBBEL.y - BUBBEL.ry - 20, BUBBEL.x + BUBBEL.rx, BUBBEL.y + BUBBEL.ry], go: [BUBBEL.x - BUBBEL.rx - 12, BUBBEL.y + 10], label: $t('BUBBELPOOLEN'), act: iBubbel },
    { id: 'bastu', r: [BASTU.x - 2, BASTU.y - 50, BASTU.x + BASTU.w + 2, BASTU.y + BASTU.h], go: [BASTU.x + 14, BASTU.y + BASTU.h + 10], label: $t('BASTUN'), act: iBastu },
    { id: 'badvakt', r: [STOL.x - 12, STOL.y - 60, STOL.x + 12, STOL.y + 2], go: [STOL.x + 16, STOL.y + 6], label: $t('BADVAKTEN ULLA'), act: () => { play('knock'); uSay(ULLA_SAY[sayIdx++ % ULLA_SAY.length]); } },
  ] : [];
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const badLook = () => { const L = A.avatar?.look || makeLook(); return { ...L, top: 'tee', shirt: BADFARGER[(L.shirt || '').length % 6], bottom: 'shorts', pants: BADFARGER[((L.shirt || '').length + 2) % 6], hat: null, bag: null, phones: false, apron: false, shoes: L.skin || '#e0a97f' }; };
  function ritaSimmande(ctx, x, y, look, dir, frame, dy = 0) { ctx.save(); ctx.beginPath(); ctx.rect(x - 20, y - 60, 40, 50 + dy); ctx.clip(); drawPerson(ctx, x, y + 10 + dy, look, dir, frame); ctx.restore(); }

  return {
    viewMax: { w: W, h: H },
    get worldX() { return pos().x; }, get worldY() { return pos().y; },
    update(dt) {
      t += dt; syncView();
      if (fade.phase === 1) { fade.a = Math.min(1, fade.a + dt * 2.6); if (fade.a >= 1) { fade.phase = 0; const cb = fade.cb; fade.cb = null; cb?.(); return; } }
      else if (fade.phase === 2) { fade.a = Math.max(0, fade.a - dt * 1.8); if (fade.a <= 0) fade.phase = 0; }
      if (lage === 'torr') walker.update(dt);
      updLiv(dt);
      const c = camTarget(); cam.x += (c - cam.x) * Math.min(1, dt * 8);
      if (!greeted && t > 1.2) { greeted = true; uSay(ULLA_SAY[0], 5); }
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const cx = Math.round(cam.x);
      ctx.drawImage(BGd, -cx, 0);
      ctx.save(); ctx.translate(-cx, 0);
      ritaGlitter(ctx, t); ritaBubblor(ctx, t); ritaKlocka(ctx, g.min);
      const items = [];
      items.push({ fy: KASSA.y + KASSA.h, draw: () => ritaKassa(ctx) }, { fy: STOL.y, draw: () => { ritaStol(ctx, STOL.x, STOL.y); drawPerson(ctx, STOL.x, STOL.y - 44, ULLA, 'down', Math.sin(t * 1.4) > 0.9 ? 11 : 5); } });
      items.push({ fy: BASTU.y + BASTU.h, draw: () => ritaBastu(ctx, t, lage === 'bastu' || Math.sin(t * 0.3) > 0.3) });
      for (const [bx, by] of BANKAR) items.push({ fy: by, draw: () => ritaBank(ctx, bx, by) });
      items.push({ fy: PALM.y, draw: () => ritaKrukvaxt(ctx, PALM.x, PALM.y, 'palm') });
      items.push({ fy: STEGE.y + 1, draw: () => ritaStege(ctx, STEGE.x, STEGE.y) }, { fy: STEGE2.y + 1, draw: () => ritaStege(ctx, STEGE2.x, STEGE2.y) });
      for (const s of simmare) items.push({ fy: laneY(s.bana), draw: () => ritaSimmande(ctx, s.x, laneY(s.bana), s.look, s.dir > 0 ? 'right' : 'left', [1, 2][Math.floor(t * 4 + s.bana) % 2], Math.round(Math.sin(t * 2 + s.bana) * 1)) });
      if (lage === 'bubbel') items.push({ fy: BUBBEL.y + 2, draw: () => { ritaSimmande(ctx, BUBBEL.x, BUBBEL.y, badLook(), 'down', 5, 2); } });
      else items.push({ fy: BUBBEL.y + 2, draw: () => ritaSimmande(ctx, BUBBEL.x - 10, BUBBEL.y - 2, bastare.look, 'down', 5, 2) });
      if (lage === 'torr') { const L0 = A.avatar.look; if (bad) A.avatar.look = badLook(); const me = selfDrawable(A, walker, t); A.avatar.look = L0; items.push({ fy: me.fy, draw: () => { const L1 = A.avatar.look; if (bad) A.avatar.look = badLook(); me.draw(ctx); A.avatar.look = L1; } }); }
      else if (lage === 'sim' && sim) items.push({ fy: sim.y + 0.1, draw: () => { ritaSimmande(ctx, sim.x, sim.y, badLook(), sim.dir > 0 ? 'right' : 'left', sim.v > 10 ? [1, 2][Math.floor(t * 6) % 2] : 0, Math.round(Math.sin(t * 2.5))); if (sim.taktT > 0) { ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let k = 0; k < 4; k++) ctx.fillRect(Math.round(sim.x - sim.dir * (8 + k * 5)), Math.round(sim.y - 2 + Math.sin(t * 9 + k) * 2), 2, 1); } } });
      else if (lage === 'kana' && kana) { const p = kanaXY(); items.push({ fy: p.klattrar ? WALL_Y + 1 : 999, draw: () => drawPerson(ctx, p.x, p.y, badLook(), p.klattrar ? 'up' : (p.dx < 0 ? 'left' : 'right'), p.klattrar ? [1, 3, 2, 3][Math.floor(t * 6) % 4] : 5) }); }
      if (barn.t >= 0 && barn.t <= KANATID) { const p = kanaPos(barn.t / KANATID); items.push({ fy: 998, draw: () => drawPerson(ctx, p.x, p.y - 4, barn.look, p.dx < 0 ? 'left' : 'right', 5) }); }
      items.push(...folkDrawables(A, t));
      for (const p of plask) items.push({ fy: p.y + 1, draw: () => ritaPlask(ctx, p.x, p.y, p.t / 0.8) });
      items.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      ritaKana(ctx, t);   // kanan hänger i luften – ovanpå allt
      talk.draw(ctx, { x0: cx, x1: cx + VW });
      ctx.restore();
      if (sim) { const s = $t`LÄNGDER ${sim.langder} · TAKT`; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect(8, 20, textW(SMALL, s) + 44, 11); ctxText(ctx, SMALL, s, 13, 23, '#f4f1ea'); ctx.fillStyle = '#2a2430'; ctx.fillRect(13 + textW(SMALL, s) + 4, 23, 30, 5); ctx.fillStyle = sim.v > 60 ? '#46a35a' : sim.v > 25 ? '#f0c030' : '#e04848'; ctx.fillRect(13 + textW(SMALL, s) + 4, 23, Math.round(30 * Math.min(1, sim.v / 92)), 5); }
      if (kana) { const s = kana.t < KLATTER ? $t('KLÄTTRAR …') : $t('WIIIE!'); ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect(8, 20, textW(SMALL, s) + 10, 11); ctxText(ctx, SMALL, s, 13, 23, '#ffd23f'); }
      if (bubbel || bastu) { const s = bastu ? $t('SVETTAS …') : $t('BUBBLAR …'); ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect(8, 20, textW(SMALL, s) + 10, 11); ctxText(ctx, SMALL, s, 13, 23, '#ffd23f'); }
      const s = hover && spotAt(hover.x + cx, hover.y);
      if (s) { const w = textW(SMALL, s.label) + 10, x = Math.round(Math.max(2, Math.min(VW - w - 2, hover.x - w / 2))), y = Math.max(2, hover.y - 22); ctx.fillStyle = 'rgba(20,18,26,.9)'; ctx.fillRect(x, y, w, 11); ctxText(ctx, SMALL, s.label, x + 5, y + 3, '#ffd23f'); }
      if (fade.a > 0) { ctx.fillStyle = `rgba(10,10,16,${fade.a.toFixed(2)})`; ctx.fillRect(0, 0, VW, H); }
    },
    down(sx, sy) {
      if (fade.phase === 1 || kana || bubbel || bastu) return;
      hover = { x: sx, y: sy };
      const x = sx + cam.x, y = sy;
      const s = spotAt(x, y);
      if (lage === 'sim') { if (s) { s.act(); return; } simtag(); return; }
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    key(k) { if (lage === 'sim' && (k === ' ' || k === 'Enter')) simtag(); },
    move(sx, sy) { hover = { x: sx, y: sy }; },
    exit() { talk.clear(); },
    _debug: {
      pos: () => pos(),
      cam: () => ({ x: cam.x }),
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); cam.x = camTarget(); },
      spots: () => spots().map((s) => s.id),
      act: (id) => { const s = spots().find((q) => q.id === id); if (!s) return false; s.act(); return true; },
      prat: () => talk.text(),
      lage: () => lage,
      bad: () => bad,
      sim: () => (sim ? { x: Math.round(sim.x), y: sim.y, dir: sim.dir, v: Math.round(sim.v), langder: sim.langder } : null),
      simtag: () => simtag(),
      kana: () => (kana ? { t: +kana.t.toFixed(1) } : null),
      tick: (sec) => { for (let k = 0; k < sec * 30; k++) updLiv(1 / 30); },
      sista: () => sista,
      fade: () => fade.phase,
    },
  };
}
