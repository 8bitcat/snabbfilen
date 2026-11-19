// 📚 BIBLIOTEKET i Gamla stan – läs dig klokare (Carl 2026-11-18: "bibliotek … läsa sig klokare, med poäng till
// livsmålet Utbildning"). 640 px brett rum som rullar med figuren – inredningen målas i js/gamlastan/bibliotek-inne.js.
// Från vänster: dörren UT under TYST-skylten, barnhörnan med bilderböckerna, tidningsstället med PIXELBLADET,
// kortkatalogen under grundarens porträtt, den stora BOKVÄGGEN med fem ämnen (HISTORIA, NATUR, TEKNIK, KONST, SAGOR)
// och stegen, jordgloben, läsborden med banklampor, bibliotekarie Gretas DISK med bokvagnen, valvfönstret med
// glasmålningen, golvuret som går efter spelets klocka, sagohyllan där katten Dewey sover och den öppna spisen med
// två läsfåtöljer. Två besökare läser vid borden, ett barn sitter i barnhörnan och någon letar i hyllorna.
//
// Så läser man: klicka på en hylla → välj en bok → figuren går och sätter sig vid närmaste lediga bord och läser
// (bladen vänds, mätaren ovanför bordet fylls). En utläst bok tar en timme på klockan och ger en utbildningspoäng
// första gången (g.lasBok, game.js) – räknas in i livsmålet Utbildning (utbPoang). Högst LAS_PER_DAG böcker om dagen,
// sedan säger Greta att ögonen behöver vila. Det man lärt sig visas som en tanke när boken är slut.
//
// _debug-API för tools/bibliotek-test.mjs.
import { drawPerson, makeLook } from '../core/people.js';
import { SMALL, ctxText, textW } from '../core/floor-pix.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { LAS_PER_DAG } from '../game.js';
import { createWalker, selfDrawable, folkDrawables, createSpeech } from './walkable.js';
import { drawPet } from '../pets/sprites.js';
import { ritaKrukvaxt } from '../tassbacken/inne-kit.js';
import { BIB, AMNEN, BOCKER, paintBibBg, ritaBibLiv, ritaBord, ritaBokIHand, ritaFatolj, ritaGlob, ritaTidningar, ritaVagn, ritaBarnmobler, ritaDiskSkylt } from '../gamlastan/bibliotek-inne.js';
import { $t } from '../core/i18n.js';

const { W, H, WALL_Y, DOOR, HYLLOR, STEGE, DISK, FONSTER, KLOCKA, HYLLA2, ELD, BORD, FATOLJ, BARN, GLOB, TIDNING, VAGN, VAXT, KATT } = BIB;
const GRETA = { skin: '#f0cfae', hair: '#b8b4ac', style: 'bun', top: 'blouse', shirt: '#4a6a8a', accent: '#f4f1ea', bottom: 'skirt', pants: '#3a3a42', shoes: '#2a1a14', glasses: 'round', beard: false, phones: false, bag: null, hat: null, apron: false, build: 3, blush: false, kid: false };
const lcg = (s) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
const LR = lcg(1699);
const GRETA_SAY = [
  $t('Välkommen till Biblioteket! Ta en bok från hyllan och sätt dig vid ett bord. Varje utläst bok ger en utbildningspoäng.'),
  $t('Tyst här inne, tack. 🤫 Böckerna hör allt.'),
  $t('Två böcker om dagen – sedan behöver ögonen vila.'),
  $t('Sagohyllan är barnens. Dewey sover högst upp – väck honom inte.'),
  $t('Golvuret har gått sedan 1699. Det går en minut fel – per århundrade.'),
];
const TROTT = $t('Du har läst två böcker i dag – ögonen behöver vila. Välkommen tillbaka i morgon!');
const PIXELBLADET = [
  $t('PIXELBLADET: Kvällsmarknaden i Gamla stan lockar rekordmånga.'), $t('PIXELBLADET: Nytt rekord på Pixelberg – 112 varv på berg-och-dalbanan.'),
  $t('PIXELBLADET: KBK vann igen! Fansen jublade på Pixeltorget.'), $t('PIXELBLADET: Villaområdets gräsmattor utsedda till stans finaste.'),
  $t('PIXELBLADET: Teatern sätter upp Tummelisa – alla biljetter slut.'),
];
const LASTID = 7;   // sekunder att läsa ut en bok (en timme på klockan)
// besökarna: två som läser vid borden (höger stol), ett barn i barnhörnan, en som letar i hyllan
const GASTER = [
  { x: BORD[0].x + 15, y: BORD[0].y + 2, dir: 'left', sitter: true, bok: true, look: makeLook(LR) },
  { x: BORD[3].x + 15, y: BORD[3].y + 2, dir: 'left', sitter: true, bok: true, look: { ...makeLook(LR), glasses: 'round' } },
  { x: BARN.cx + 22, y: BARN.cy + 4, dir: 'left', sitter: true, bok: true, kid: true, look: { ...makeLook(LR), kid: true } },
  { x: 150, y: WALL_Y + 14, dir: 'up', look: makeLook(LR) },
];
const DEWEY = { id: 'bib-dewey', name: 'Dewey', species: 'katt', breed: 'rodkatt', sex: 'hane', stage: 'vuxen', seed: 'dewey' };

// ================= scenen =================
export function makeBibliotek(A) {
  const g = A.game;
  const natt = () => { const h = g.min / 60; return h >= 20 || h < 6; };
  let VW = 384;
  const syncView = () => { VW = Math.max(384, Math.min(A.W || 384, W)); };
  const walker = createWalker({ W, H, left: 6, right: W - 6, top: WALL_Y + 6, bottom: H - 4, spawn: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 12] });
  walker.speed = 72;
  walker.setObstacles([
    [DISK.x, DISK.y, DISK.x + DISK.w, DISK.y + DISK.h],
    ...BORD.map((b) => [b.x - 10, b.y - 6, b.x + 10, b.y + 1]),
    ...FATOLJ.map((f) => [f.x - 15, f.y - 12, f.x + 30, f.y + 1]),
    [BARN.cx - 12, BARN.cy - 10, BARN.cx + 10, BARN.cy - 2], [BARN.cx - 36, BARN.cy + 14, BARN.cx - 24, BARN.cy + 21], [BARN.cx + 29, BARN.cy + 8, BARN.cx + 39, BARN.cy + 17],
    [GLOB.x - 6, GLOB.y - 6, GLOB.x + 6, GLOB.y + 1], [TIDNING.x - 8, TIDNING.y - 6, TIDNING.x + 8, TIDNING.y + 1], [VAGN.x - 12, VAGN.y - 6, VAGN.x + 12, VAGN.y + 1], [VAXT.x - 7, VAXT.y - 6, VAXT.x + 7, VAXT.y + 1],
    [KLOCKA.x0 - 2, WALL_Y, KLOCKA.x1 + 2, WALL_Y + 7], [ELD.x0 - 4, WALL_Y, ELD.x1, WALL_Y + 12], [FONSTER.x0, WALL_Y, FONSTER.x1, WALL_Y + 2],
    ...GASTER.map((q) => [q.x - 5, q.y - 4, q.x + 5, q.y + 1]),
  ]);
  walker.snapFree();
  let t = 0, hover = null, hoverT = 0, sayIdx = 1, greeted = false, snurr = 0, dewey = 0;
  let sitter = null, bok = null, las = null;   // sitter = bordets index; bok = boken man bär; las = { bok, t } när man läser
  const talk = createSpeech();
  const gSay = (s, secs = 4.5) => talk.say(s, () => ({ x: DISK.x + 34, y: DISK.y - 30 }), secs, { voice: GRETA });
  const camTarget = () => Math.max(0, Math.min(W - VW, walker.px - VW / 2));
  syncView();
  const cam = { x: camTarget() };
  const BGd = paintBibBg(false);

  // ---------- böckerna ----------
  const lasta = () => g.las?.lasta || [];
  function valjHylla(k) {
    const amne = AMNEN[k], kvar = g.lasKvar();
    play('click');
    if (!kvar) { gSay(TROTT); return; }
    const rader = BOCKER[amne.id].map((b) => { const l = lasta().includes(b.id); return `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:22px">${l ? '✅' : '📕'}</span><span class="nm">${esc(b.titel)}<br><small class="sp">${l ? $t('Läst – ger ingen ny poäng') : $t('Oläst · +1 🎓')}</small></span><button class="btn btn-small ${l ? '' : 'btn-go'}" data-bok="${b.id}">${$t('Läs')}</button></div>`; }).join('');
    const dlg = openModal(`${amne.ik} ${esc(amne.namn)}`, `<p style="font-size:var(--f2);margin-top:0">${$t('Välj en bok. Att läsa ut den tar en timme och ger en utbildningspoäng första gången.')}</p><div class="plist">${rader}</div><p style="font-size:var(--f2)">${$t`I dag kan du läsa ${kvar} till.`}</p>`, [{ label: $t('Stäng'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-bok]').forEach((btn) => (btn.onclick = () => { const b = BOCKER[amne.id].find((q) => q.id === btn.dataset.bok); if (!b) return; closeModal(); taBok(b); }));
  }
  function taBok(b) {
    bok = b; las = null;
    toast($t`📖 Du tar «${b.titel}». Sätt dig vid ett bord och läs.`);
    play('slide');
    // närmaste lediga bord (vänster stol)
    let best = 0, bd = Infinity;
    BORD.forEach((B, i) => { const d = Math.hypot(B.x - 14 - walker.px, B.y + 2 - walker.py); if (d < bd) { bd = d; best = i; } });
    sattDig(best);
  }
  function sattDig(i) {
    const B = BORD[i];
    if (sitter === i && !bok) { sitter = null; las = null; return; }
    sitter = null; las = null;
    walker.walkTo(B.x - 14, B.y + 2, () => { sitter = i; walker.dir = 'right'; if (bok) las = { bok, t: 0 }; });
  }
  function lasKlar() {
    const b = las.bok, r = g.lasBok(b.id);
    las = null; bok = null;
    if (!r.ok) { gSay(TROTT); return; }
    play(r.poang ? 'pling' : 'ok');
    toast(r.poang ? $t`📚 «${b.titel}» utläst! +1 🎓 utbildningspoäng` : $t`📚 «${b.titel}» – du hade läst den förut, men den var lika bra.`, r.poang ? 'good' : '');
    talk.say(b.fakta, () => ({ x: walker.px, y: walker.py - 26 }), 6, { voice: 'self' });
    const h = g.glad?.(1, $t('En bok på Biblioteket'), 'bibliotek', 1); if (h) setTimeout(() => toast(`😊 +${h}`), 900);
    if (!r.kvar) setTimeout(() => gSay(GRETA_SAY[2]), 1500);
  }
  const klockTid = () => { const m = Math.floor(g.min) % (24 * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  function klappaDewey() {
    dewey = 2.5; play('click');
    talk.say($t('Purrr … 📚'), () => ({ x: KATT.x, y: KATT.y - 14 }), 2.2, { animal: true, silent: true });
    const h = g.glad?.(1, $t('Dewey på Biblioteket'), 'bibdewey', 2); if (h) toast(`😊 +${h}`);
  }

  // ---------- platserna ----------
  const spots = () => [
    { id: 'dorr', r: [DOOR.x0, 12, DOOR.x1, WALL_Y + 6], go: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 10], label: $t('UT'), act: () => { play('door'); A.go('gamlastan'); } },
    { id: 'disk', r: [DISK.x, DISK.y - 34, DISK.x + DISK.w, DISK.y + DISK.h], go: [DISK.x + DISK.w / 2 - 10, DISK.y + DISK.h + 10], label: $t('BIBLIOTEKARIE GRETA'), act: () => { const L = g.las || { poang: 0, lasta: [] }; gSay(sayIdx % 3 === 0 ? $t`Lästa böcker: ${L.lasta.length} · poäng: ${L.poang} · kvar i dag: ${g.lasKvar()}` : GRETA_SAY[sayIdx % GRETA_SAY.length]); sayIdx++; } },
    ...AMNEN.map((a, k) => { const sw = (HYLLOR.x1 - HYLLOR.x0) / HYLLOR.n, x0 = Math.round(HYLLOR.x0 + k * sw), x1 = Math.round(x0 + sw); return { id: 'hylla' + k, r: [x0, 8, x1, WALL_Y + 2], go: [(x0 + x1) / 2, WALL_Y + 12], label: `${a.ik} ${a.namn}`, act: () => valjHylla(k) }; }),
    ...BORD.map((B, i) => ({ id: 'bord' + i, r: [B.x - 20, B.y - 34, B.x + 20, B.y + 2], go: [B.x - 14, B.y + 2], label: sitter === i && !bok ? $t('RES DIG') : bok ? $t('LÄS HÄR') : $t('SÄTT DIG'), act: () => sattDig(i) })),
    { id: 'klocka', r: [KLOCKA.x0 - 3, 0, KLOCKA.x1 + 3, WALL_Y + 6], go: [KLOCKA.cx - 14, WALL_Y + 14], label: $t('GOLVURET'), act: () => toast($t`🕰️ Golvuret visar ${klockTid()}. Det har tickat sedan 1699.`) },
    { id: 'fonster', r: [FONSTER.x0, FONSTER.y0, FONSTER.x1, FONSTER.y1 + 4], go: [FONSTER.cx, WALL_Y + 14], label: $t('VALVFÖNSTRET'), act: () => toast($t('🪟 Glasmålningen visar stadens fyra årstider. Solen är alltid gul – även på vintern.')) },
    { id: 'katt', r: [KATT.x - 12, KATT.y - 14, KATT.x + 12, KATT.y + 6], go: [KATT.x - 6, WALL_Y + 14], label: $t('DEWEY'), act: klappaDewey },
    { id: 'sagohylla', r: [HYLLA2.x0, 24, HYLLA2.x1, WALL_Y + 2], go: [(HYLLA2.x0 + HYLLA2.x1) / 2, WALL_Y + 12], label: $t('SAGOHYLLAN'), act: () => valjHylla(4) },
    { id: 'eld', r: [ELD.x0, 10, ELD.x1, WALL_Y + 6], go: [ELD.x0 - 8, WALL_Y + 18], label: $t('ÖPPNA SPISEN'), act: () => { toast($t('🔥 Elden sprakar. Det är den varmaste platsen i hela Gamla stan.')); const h = g.glad?.(1, '', 'bibeld', 1); if (h) toast(`😊 +${h}`); } },
    ...FATOLJ.map((F, i) => ({ id: 'fatolj' + i, r: [F.x - 16, F.y - 32, F.x + 32, F.y + 2], go: [F.x - 22, F.y + 2], label: $t('LÄSFÅTÖLJEN'), act: () => toast($t('🛋️ Fåtöljen är upptagen – av en bok någon glömt. Läsborden är lediga.')) })),
    { id: 'glob', r: [GLOB.x - 10, GLOB.y - 36, GLOB.x + 10, GLOB.y + 2], go: [GLOB.x + 14, GLOB.y + 4], label: $t('JORDGLOBEN'), act: () => { snurr = 4; play('slide'); toast($t('🌍 Du snurrar på jordgloben. Pixelstaden ligger … precis där du står.')); } },
    { id: 'tidningar', r: [TIDNING.x - 10, TIDNING.y - 30, TIDNING.x + 10, TIDNING.y + 2], go: [TIDNING.x + 14, TIDNING.y + 4], label: $t('DAGENS TIDNING'), act: () => toast(`📰 ${PIXELBLADET[(g.day | 0) % PIXELBLADET.length]}`) },
    { id: 'vagn', r: [VAGN.x - 14, VAGN.y - 26, VAGN.x + 14, VAGN.y + 2], go: [VAGN.x - 18, VAGN.y + 4], label: $t('BOKVAGNEN'), act: () => toast($t('📚 Återlämnade böcker. Greta ställer tillbaka dem när det blir kväll.')) },
    { id: 'barn', r: [BARN.x0, BARN.y0 - 10, BARN.x1, BARN.y1], go: [BARN.cx - 16, BARN.cy - 8], label: $t('BARNHÖRNAN'), act: () => toast($t('🧸 Barnhörnan: bilderböcker, små stolar och en nalle som har läst allt.')) },
    { id: 'stege', r: [STEGE.x - 4, 6, STEGE.x + 14, 40], go: [STEGE.x + 6, WALL_Y + 12], label: $t('STEGEN'), act: () => toast($t('🪜 Stegen rullar längs hyllan. Högst upp står de äldsta böckerna – de luktar damm och äventyr.')) },
    { id: 'katalog', r: [BIB.KATALOG.x0, 10, BIB.KATALOG.x1, WALL_Y + 2], go: [(BIB.KATALOG.x0 + BIB.KATALOG.x1) / 2, WALL_Y + 12], label: $t('KORTKATALOGEN'), act: () => toast($t('🗂️ Kortkatalogen: en lapp för varje bok i huset, sorterade för hand. Porträttet är grundaren, Hedvig Bok.')) },
  ];
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const focusSpot = () => {
    const h = hover && t - hoverT < 4 && spotAt(hover.x, hover.y);
    if (h) return h;
    if (walker.path.length || sitter !== null) return null;   // (sittande: skylten skulle täcka läsmätaren)
    return spots().find((s) => s.id !== 'dorr' && Math.abs(walker.px - s.go[0]) < 7 && Math.abs(walker.py - s.go[1]) < 7) || null;
  };

  // ---------- ritning ----------
  const R = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  function drawDisk(ctx) {
    drawPerson(ctx, DISK.x + 34, DISK.y + 12, GRETA, 'down', Math.sin(t * 1.3) > 0.9 ? 4 : 0);
    const d = DISK;
    R(ctx, 'rgba(20,12,30,.25)', d.x, d.y + d.h - 1, d.w, 3);
    R(ctx, '#4a2418', d.x, d.y + 6, d.w, d.h - 6);
    for (let x = d.x + 3; x < d.x + d.w - 2; x += 7) { R(ctx, '#2a1410', x, d.y + 11, 1, d.h - 15); R(ctx, '#6a3420', x + 1, d.y + 11, 1, d.h - 15); }
    R(ctx, '#a8643a', d.x - 2, d.y + 6, d.w + 4, 2); R(ctx, '#8a4a2c', d.x - 2, d.y + 8, d.w + 4, 3); R(ctx, '#2a1410', d.x, d.y + d.h - 3, d.w, 3);
    // på disken: stämpeln, en bokstapel, en liten lampa, lånekorten
    R(ctx, '#2a2a30', d.x + 6, d.y + 1, 5, 5); R(ctx, '#8a8a94', d.x + 7, d.y, 3, 1); R(ctx, '#f4ecd8', d.x + 5, d.y + 5, 7, 1);
    R(ctx, '#d84a6a', d.x + 16, d.y + 3, 10, 3); R(ctx, '#3a7bd5', d.x + 17, d.y, 9, 3); R(ctx, '#f0c030', d.x + 18, d.y - 2, 7, 2);
    R(ctx, '#e6be4c', d.x + d.w - 16, d.y - 6, 1, 12); R(ctx, '#248a56', d.x + d.w - 21, d.y - 9, 11, 3); R(ctx, '#8ae0a8', d.x + d.w - 21, d.y - 9, 11, 1); R(ctx, '#fff6c0', d.x + d.w - 20, d.y - 6, 9, 1);
    R(ctx, '#f4ecd8', d.x + d.w - 34, d.y + 2, 8, 4); R(ctx, '#f8e080', d.x + d.w - 33, d.y + 1, 8, 4); R(ctx, '#2a2a30', d.x + d.w - 31, d.y + 2, 4, 1);
    R(ctx, '#f4ecd8', d.x + 34, d.y + 2, 6, 3); R(ctx, '#d8343c', d.x + 35, d.y + 1, 4, 1);   // en kopp te
  }
  function drawGast(ctx, q) {
    const fr = q.sitter ? 5 : (Math.sin(t * 2 + q.x) > 0.92 ? 4 : 0);
    drawPerson(ctx, q.x, q.y, q.look, q.dir, fr);
    if (q.bok) ritaBokIHand(ctx, q.x, q.y + (q.kid ? 4 : 0), t + q.x, q.dir);
  }
  function drawSelfReading(ctx) {
    const B = BORD[sitter];
    drawPerson(ctx, walker.px, walker.py, A.avatar.look, 'right', 5);
    if (las || bok) ritaBokIHand(ctx, walker.px, walker.py, t, 'right');
    void B;
  }
  function label(ctx, s, cx) {
    if (!s) return;
    const txt = s.label, w = textW(SMALL, txt) + 10, x = Math.round(Math.max(cx + 2, Math.min(cx + VW - w - 2, (s.r[0] + s.r[2]) / 2 - w / 2))), y = Math.max(2, s.r[1] - 13);
    ctx.fillStyle = 'rgba(20,26,20,.92)'; ctx.fillRect(x, y, w, 11); ctx.fillStyle = '#e6be4c'; ctx.fillRect(x, y + 10, w, 1);
    ctxText(ctx, SMALL, txt, x + 5, y + 3, '#ffd23f');
  }

  return {
    viewMax: { w: W, h: H },
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    update(dt) {
      dt = Math.min(0.1, Math.max(0, dt));
      t += dt; syncView();
      if (sitter === null) walker.update(dt);
      if (snurr > 0) snurr -= dt; if (dewey > 0) dewey -= dt;
      if (las && sitter !== null) { las.t += dt; if (las.t >= LASTID) lasKlar(); }
      if (!greeted && t > 0.8) { greeted = true; gSay(GRETA_SAY[0], 5.5); }
      cam.x += (camTarget() - cam.x) * Math.min(1, dt * 6);
    },
    draw(ctx) {
      syncView();
      const N = natt(), cx = Math.round(cam.x);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(N ? paintBibBg(true) : BGd, cx, 0, VW, H, cx, 0, VW, H);
      ritaBibLiv(ctx, t, N, g.min);
      // Dewey på sagohyllan
      drawPet(ctx, KATT.x, KATT.y, DEWEY, dewey > 0 ? 'love' : 'sleep', t, 'left');
      const focus = focusSpot();
      const sitDraw = sitter !== null ? { fy: BORD[sitter].y + 2, draw: () => drawSelfReading(ctx) } : selfDrawable(A, walker, t);
      const list = [...folkDrawables(A, t), sitDraw];
      list.push({ fy: DISK.y + DISK.h, draw: () => drawDisk(ctx) }, { fy: DISK.y + DISK.h + 2, draw: () => ritaDiskSkylt(ctx, DISK.x - 12, DISK.y + DISK.h + 2) });
      BORD.forEach((B, i) => list.push({ fy: B.y, draw: () => ritaBord(ctx, B, { lampa: N, bok: sitter === i && !!(las || bok), progress: sitter === i && las ? las.t / LASTID : null }) }));
      for (const F of FATOLJ) list.push({ fy: F.y, draw: () => ritaFatolj(ctx, F, N) });
      list.push({ fy: GLOB.y, draw: () => ritaGlob(ctx, GLOB, t, snurr > 0 ? 8 : 1) }, { fy: TIDNING.y, draw: () => ritaTidningar(ctx, TIDNING) }, { fy: VAGN.y, draw: () => ritaVagn(ctx, VAGN) });
      list.push({ fy: VAXT.y, draw: () => ritaKrukvaxt(ctx, VAXT.x, VAXT.y, 'palm') });
      list.push({ fy: BARN.cy - 4, draw: () => ritaBarnmobler(ctx, BARN) });
      for (const q of GASTER) list.push({ fy: q.y + (q.sitter ? 0.6 : 0), draw: () => drawGast(ctx, q) });
      list.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      if (N) { ctx.fillStyle = 'rgba(10,8,30,.12)'; ctx.fillRect(cx, 0, VW, H); }
      talk.draw(ctx, { x0: cx, x1: cx + VW });
      label(ctx, focus, cx);
    },
    down(sx, sy) {
      const x = sx + cam.x, y = sy;
      hover = null;
      const s = spotAt(x, y);
      if (sitter !== null && !(s && s.id === 'bord' + sitter)) { if (las) { toast($t('📖 Du lägger ifrån dig boken – den är inte utläst.')); bok = null; } sitter = null; las = null; }
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { hover = { x: sx + cam.x, y: sy }; hoverT = t; },
    exit() { talk.clear(); },
    _debug: {
      spots: () => spots().map((s) => s.id),
      act: (id) => { const s = spots().find((q) => q.id === id); if (!s) return false; s.act(); return true; },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); cam.x = camTarget(); },
      pos: () => ({ x: Math.round(walker.px), y: Math.round(walker.py) }),
      valj: (amne, i = 0) => { const b = BOCKER[amne]?.[i]; if (!b) return false; if (!g.lasKvar()) { gSay(TROTT); return false; } taBok(b); return true; },
      las: () => ({ sitter, bok: bok?.id || null, laser: !!las, t: las ? +las.t.toFixed(1) : 0 }),
      klar: () => { if (!las) return false; las.t = LASTID; return true; },
      prat: () => talk.text?.() ?? null,
      dewey: () => dewey > 0,
      snurr: () => snurr > 0,
      cam: () => cam.x,
    },
  };
}
