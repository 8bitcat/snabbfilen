// LANDET – scenen öster om förorten (kartan och marken: js/landet/karta.js, djuren: js/landet/djur.js).
// Man kommer hit genom att gå österut på Pixelgatan förbi ortsskylten (city.js) – landsvägen ligger på
// samma höjd – och tillbaka genom att gå västerut. Himlen och de bortre kullarna glider med parallax.
// Kossor, får, hästar och höns betar och går i sina hagar (klicka: de svarar); traktorn skördar
// vetefältet rad för rad och lämnar stubb efter sig. GÅRDEN och STALLET är till salu/öppnar snart
// (nästa steg: bli bonde och rida). Busshållplatsen LANDET tar en tillbaka till Betongtorget.
// Fordonen (cykel/moppe) går att åka här också.
import { createCityWalker } from '../city/walk.js';
import { selfDrawable, folkDrawables, createSpeech, nameTag } from './walkable.js';
import { worldFolksHere } from '../net/world.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { SMALL, BIG, ctxText, textW } from '../core/floor-pix.js';
import { CITY, busStopById } from '../city/map.js';
import { fmt, homeOf, GARDSDJUR, GARD_PRIS, HAST_PRIS, HAST_STALL, HAST_MAT, HASTFARGER, HASTNAMN, HOPPKLASSER } from '../game.js';
import { drawHastEnsam, drawHastRyttare } from '../landet/hast-art.js';   // din egen häst (rida, hinderbanan)
import { LW, LH, L, KOHAGE, FARHAGE, HONSGARD, VETE, HASTHAGE, RIDBANA, HUS, HINDER, HALLPLATS, ORTSSKYLT, SPANG, GRIND, landHinder, paintLand, skyCanvas, hillsCanvas, husBild, husPos } from '../landet/karta.js';
import { drawKo, drawFar, drawHast, drawHona, drawTraktor, drawTrad } from '../landet/djur.js';

const GANG = 110;
const BUTIK = { x: 660, y: 206 };   // gårdsbutiken vid vägen (norra renen, väster om gården)
// träden: lövträd längs vägen och i hagarna, granskogen i öster
const TRAD = [
  ...[[60, 176, 'lov'], [380, 108, 'lov'], [660, 112, 'lov'], [1230, 116, 'lov'], [1730, 110, 'lov'], [540, 316, 'lov'], [930, 330, 'lov'], [1040, 480, 'lov'], [1380, 506, 'lov']],
  ...Array.from({ length: 18 }, (_, i) => [1780 + (i % 6) * 30 + (i >> 1) % 3 * 7, 112 + Math.floor(i / 6) * 22 + (i % 2) * 6, 'gran']),
  ...Array.from({ length: 10 }, (_, i) => [2180 + (i % 5) * 38, 330 + Math.floor(i / 5) * 90 + (i % 2) * 20, 'gran']),
].map(([x, y, s]) => ({ x, y, s }));

export function makeLandet(A) {
  const g = A.game;
  let VW = Math.max(384, Math.min(A.W || 384, LW)), VH = Math.max(160, Math.min(A.H || 216, LH));
  const from = A.landetFran || null; A.landetFran = null;
  const spawnY = from?.y ? Math.max(L.VERGE_N[0] + 4, Math.min(L.VERGE_S[1] - 4, from.y)) : L.VERGE_S[0] + 10;
  const gardDorr = [(HUS.gard.door.x0 + HUS.gard.door.x1) / 2, HUS.gard.base + 10];
  const walker = createCityWalker({ W: LW, H: LH, left: 2, right: LW - 6, top: L.HORIZON + 10, bottom: L.BOTTOM, spawn: from?.bana ? [(GRIND.bana[0] + GRIND.bana[1]) / 2, RIDBANA[1] - 10] : from?.gard ? gardDorr : from?.buss ? [HALLPLATS.x + 10, HALLPLATS.y + 6] : [14, spawnY] });
  const fordon = () => (A.ridHast ? null : g.aker);
  // rider man sin häst går det fortare (trav/galopp) – hästen följer bara med på landet
  if (from?.bana && g.hast) A.ridHast = true;
  if (!g.hast) A.ridHast = false;
  const applyRide = () => { const F = fordon(); walker.speed = A.ridHast ? GANG * 2.2 : GANG * (F ? F.fart : 1); };
  applyRide();
  walker.setObstacles([...landHinder(), [BUTIK.x - 16, BUTIK.y - 6, BUTIK.x + 16, BUTIK.y + 1]]);
  walker.snapFree();
  const talk = createSpeech();
  let t = 0, hover = null, banner = 0, ridDir = 'right';
  const fade = { a: 1, phase: 2, cb: null };    // tona in när man kommer
  const cam = { x: 0, y: 0 };
  const camTarget = () => ({ x: Math.max(0, Math.min(LW - VW, walker.px - VW / 2)), y: Math.max(0, Math.min(LH - VH, walker.py - VH * 0.66)) });
  Object.assign(cam, camTarget());
  if (!A.attract) { const h = g.glad?.(2, '', 'landet', 2); if (h) setTimeout(() => toast(`🌾 Frisk luft på landet! +${h} 😊`, 'good'), 900); }

  // ---------- djuren ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const inPen = (pen, m = 10) => [rnd(pen[0] + m, pen[2] - m), rnd(pen[1] + m + 8, pen[3] - 4)];
  const djur = [];
  const add = (sort, pen, n, extra = {}) => { for (let i = 0; i < n; i++) { const [x, y] = inPen(pen); djur.push({ sort, pen, x, y, tx: x, ty: y, dir: Math.random() < 0.5 ? 'left' : 'right', state: 'beta', tm: rnd(1, 6), fr: 0, ...extra, flack: i % 3, farg: ['fux', 'svart', 'skimmel', 'brun'][i % 4] }); } };
  // äger man gården är djuren ens egna (antalet i g.bonde.djur), annars den gamle bondens
  const agd = () => g.bondeHar?.();
  const antal = (sort, def) => (agd() ? (g.bonde.djur[sort] | 0) : def);
  add('ko', KOHAGE, antal('ko', 6)); add('far', FARHAGE, antal('far', 9)); add('hona', HONSGARD, antal('hona', 6)); add('hast', HASTHAGE, 4);
  if (g.hast) add('hast', HASTHAGE, 1, { egen: true });
  djur.forEach((d) => { if (d.egen) d.farg = g.hast.farg; });
  // nyköpta djur springer in i hagen
  function synkaDjur() {
    if (!agd()) return;
    for (const [sort, pen] of [['ko', KOHAGE], ['far', FARHAGE], ['hona', HONSGARD]]) {
      const har = djur.filter((d) => d.sort === sort).length, ska = g.bonde.djur[sort] | 0;
      if (ska > har) add(sort, pen, ska - har);
      // (köpte man gården här ute: den gamle bondens överblivna djur följer med honom)
      for (let k = har - ska; k > 0; k--) djur.splice(djur.map((d) => d.sort).lastIndexOf(sort), 1);
    }
  }
  const FART = { ko: 9, far: 11, hona: 14, hast: 16 };
  const LJUD = { ko: ['MUUU!', 'Muu …', 'MUUUU! 🐄'], far: ['BÄÄÄ!', 'Bä bä!', 'BÄÄ 🐑'], hona: ['KLUCK KLUCK!', 'Pip pip!', 'KUCKELIKU!'], hast: ['GNÄGG!', 'Prrrr …', 'GNÄGGG 🐴'] };
  function updDjur(dt) {
    for (const d of djur) {
      d.tm -= dt;
      if (d.state === 'ga') {
        const dx = d.tx - d.x, dy = d.ty - d.y, dist = Math.hypot(dx, dy), step = FART[d.sort] * dt * (d.sort === 'hast' && d.trav ? 2.2 : 1);
        if (Math.abs(dx) > 0.5) d.dir = dx < 0 ? 'left' : 'right';
        if (dist <= step) { d.x = d.tx; d.y = d.ty; d.state = 'beta'; d.tm = rnd(2, 7); } else { d.x += dx / dist * step; d.y += dy / dist * step; }
        d.fr = Math.floor(t * (d.sort === 'hona' ? 10 : 5) + d.x) % 2 ? 1 : 2;
      } else {
        d.fr = d.sort === 'hona' ? (Math.floor(t * 3 + d.x) % 3 === 0 ? 3 : 0) : (Math.floor(t * 0.7 + d.x) % 3 ? 3 : 0);
        if (d.tm <= 0) { [d.tx, d.ty] = inPen(d.pen); d.trav = d.sort === 'hast' && Math.random() < 0.3; d.state = 'ga'; }
      }
    }
  }
  // ---------- traktorn: skördar vetet rad för rad (stubben ligger kvar tills fältet är klart) ----------
  const RADER = []; for (let y = VETE[1] + 16; y < VETE[3] - 2; y += 12) RADER.push(y);
  const trak = { x: VETE[0] + 16, y: RADER[0], rad: 0, dir: 'right', klara: [], vanta: 0 };
  function updTraktor(dt) {
    if (trak.vanta > 0) { trak.vanta -= dt; return; }
    const mal = trak.dir === 'right' ? VETE[2] - 18 : VETE[0] + 18, step = 16 * dt;
    if (Math.abs(trak.y - RADER[trak.rad]) > 0.5) { trak.y += Math.sign(RADER[trak.rad] - trak.y) * Math.min(step, Math.abs(RADER[trak.rad] - trak.y)); return; }
    if (Math.abs(mal - trak.x) <= step) {
      trak.x = mal; trak.klara.push(trak.rad);
      trak.rad++;
      if (trak.rad >= RADER.length) { trak.rad = 0; trak.klara = []; trak.vanta = 6; }
      trak.dir = trak.dir === 'right' ? 'left' : 'right';
    } else trak.x += Math.sign(mal - trak.x) * step;
  }

  // ---------- platserna man kan klicka på ----------
  const busStop = busStopById('betongtorget');
  const spots = () => [
    { id: 'gard', r: [HUS.gard.door.x0 - 6, HUS.gard.base - 40, HUS.gard.door.x1 + 6, HUS.gard.base], go: gardDorr, label: g.home === 'gard' ? 'HEM' : 'GÅRDEN – TILL SALU', act: gardDorren },
    { id: 'lada', r: [HUS.lada.door.x0, HUS.lada.base - 42, HUS.lada.door.x1, HUS.lada.base], go: [(HUS.lada.door.x0 + HUS.lada.door.x1) / 2, HUS.lada.base + 8], label: 'LADUGÅRDEN', act: ladan },
    { id: 'butik', r: [BUTIK.x - 18, BUTIK.y - 30, BUTIK.x + 18, BUTIK.y + 2], go: [BUTIK.x, BUTIK.y + 8], label: 'GÅRDSBUTIKEN', act: butiken },
    { id: 'stall', r: [HUS.stall.door.x0 - 4, HUS.stall.base - 36, HUS.stall.door.x1 + 4, HUS.stall.base], go: [(HUS.stall.door.x0 + HUS.stall.door.x1) / 2, HUS.stall.base + 8], label: 'STALLET', act: stallet },
    { id: 'ridbana', r: [RIDBANA[0], RIDBANA[1], RIDBANA[2], RIDBANA[3]], go: [(GRIND.bana[0] + GRIND.bana[1]) / 2, RIDBANA[1] - 8], label: 'RIDBANAN – HINDERBANAN', act: hinderbanan },
    { id: 'buss', r: [HALLPLATS.x - 12, HALLPLATS.y - 34, HALLPLATS.x + 14, HALLPLATS.y + 2], go: [HALLPLATS.x + 2, HALLPLATS.y + 6], label: 'BUSS TILL STAN', act: bussen },
    { id: 'skylt', r: [ORTSSKYLT.x - 14, ORTSSKYLT.y - 30, ORTSSKYLT.x + 14, ORTSSKYLT.y + 2], go: [ORTSSKYLT.x, ORTSSKYLT.y + 8], label: 'TILLBAKA TILL STAN', act: tillStan },
  ];
  // ---------- gården: köpa, gå hem, ladugården, gårdsbutiken ----------
  function gardDorren() {
    if (g.home === 'gard') { play('door'); A.ridHast = false; A.roomSub = 0; A.go('room'); return; }
    const H = homeOf('gard');
    play('knock');
    openModal('🏡 Gården till salu', `<p style="font-size:var(--f2);margin-top:0">Den gamle bonden ska flytta till stan och säljer Gården: falurött boningshus med lantkök, ladugård, silo, hönsgård och hagar – <b>djuren ingår</b> (6 höns, 2 kor och 4 får)!</p>
      <p style="font-size:var(--f2)">🔑 Insats <b>${fmt(H.deposit)}</b> · hyra <b>${fmt(H.rent)}</b> i veckan · 😴 +${H.restBonus} energi när du sover<br>🐔 Fodra djuren varje dag, samla ägg, mjölka korna och klipp fåren – sälj i gårdsbutiken vid vägen.</p>
      <p style="font-size:var(--f2)">💰 Du har <b>${fmt(g.money)}</b>${g.sambo ? '<br>🏠 Du bor ihop med någon – flytta isär först.' : ''}</p>`, [
      { label: `🔑 Köp gården · ${fmt(H.deposit)}`, cls: 'btn-go', onClick: () => {
        const r = g.moveTo('gard');
        if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return; }
        closeModal(); play('fanfare'); synkaDjur();
        toast('🚜 Grattis – du är bonde! Gå in och titta på ditt nya hem, och glöm inte att fodra djuren i ladugården.', 'good');
      } },
      { label: 'Inte nu', onClick: closeModal },
    ]);
  }
  function ladan() {
    if (!agd()) { play('door'); toast('🐄 I ladugården luktar det hö. Det är den gamle bondens djur – köp Gården så blir de dina.'); return; }
    play('door');
    const draw = () => {
      const B = g.bonde, matta = g.djurMatta(), idag = (B.fodrad | 0) === g.day;
      const rader = Object.entries(GARDSDJUR).map(([k, D]) => `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:22px">${D.icon}</span><span class="nm">${D.fler}: <b>${B.djur[k] | 0}</b> av ${D.max}<br><small class="sp">${fmt(D.pris)} st · foder ${fmt(D.foder)}/dag</small></span><button class="btn btn-small btn-go" data-kop="${k}" ${(B.djur[k] | 0) >= D.max || g.money < D.pris ? 'disabled' : ''}>Köp</button></div>`).join('');
      const dlg = openModal('🐄 Ladugården', `<p style="font-size:var(--f2);margin-top:0">${idag ? '✅ Djuren har fått mat i dag.' : matta ? '🌾 Djuren åt i går – ge dem mat i dag också.' : '<span class="bad">😟 Djuren är hungriga! De ger inga ägg, ingen mjölk och ingen ull förrän de får mat.</span>'}</p>
        <div class="plist">${rader}</div>
        <p style="font-size:var(--f2)">🧶 Ull i ladugården: <b>${B.ull | 0} kg</b> · 💰 Du har <b>${fmt(g.money)}</b></p>`, [
        ...(!idag ? [{ label: `🌾 Fodra djuren · ${fmt(g.fodderKostnad())}`, cls: 'btn-go', onClick: () => { const r = g.fodra(); if (!r.ok) { toast(r.msg, 'bad'); return; } play('ok'); toast(`🌾 Alla djur har fått mat (${fmt(r.kr)}).${r.glad ? ` +${r.glad} 😊` : ''}`, 'good'); draw(); } }] : []),
        { label: 'Klar', onClick: closeModal },
      ]);
      dlg.querySelectorAll('[data-kop]').forEach((b) => (b.onclick = () => { const r = g.kopDjur(b.dataset.kop); if (!r.ok) { toast(r.msg, 'bad'); return; } play('ok'); synkaDjur(); toast(`${r.djur.icon} En ny ${r.djur.namn.toLowerCase()} springer ut i hagen!`, 'good'); draw(); }));
    };
    draw();
  }
  function butiken() {
    if (!agd()) { toast('🥚 Gårdsbutiken: "Ägg och mjölk – lägg pengarna i burken." Burken är tom och hyllorna med.'); return; }
    play('click');
    const draw = () => {
      const har = { agg: g.skafferi.agg | 0, mjolk: g.skafferi.mjolk | 0, ull: g.bonde.ull | 0 };
      const rad = (k, icon, namn, enh) => `<div class="prow" style="grid-template-columns:auto 1fr auto auto"><span style="font-size:22px">${icon}</span><span class="nm">${namn}: <b>${har[k]} ${enh}</b><br><small class="sp">${fmt(GARD_PRIS[k])} per ${enh}</small></span>
        <button class="btn btn-small" data-salj="${k}" data-n="1" ${har[k] < 1 ? 'disabled' : ''}>Sälj 1</button><button class="btn btn-small btn-go" data-salj="${k}" data-n="${har[k]}" ${har[k] < 1 ? 'disabled' : ''}>Sälj allt · ${fmt(har[k] * GARD_PRIS[k])}</button></div>`;
      const dlg = openModal('🧺 Gårdsbutiken', `<p style="font-size:var(--f2);margin-top:0">Förbipasserande köper allt du ställer ut. Ägg och mjölk tas ur skafferiet – spara det du vill laga mat av!</p>
        <div class="plist">${rad('agg', '🥚', 'Ägg', 'st')}${rad('mjolk', '🥛', 'Mjölk', 'l')}${rad('ull', '🧶', 'Ull', 'kg')}</div>`, [{ label: 'Klar', cls: 'btn-go', onClick: closeModal }]);
      dlg.querySelectorAll('[data-salj]').forEach((b) => (b.onclick = () => { const r = g.saljGard(b.dataset.salj, +b.dataset.n); if (!r.ok) { toast(r.msg, 'bad'); return; } play('coin'); toast(`🧺 Sålt för ${fmt(r.kr)}!`, 'good'); draw(); }));
    };
    draw();
  }
  // djuren på ens egen gård: hönsen → ägg, korna → mjölk, fåren → ull
  function sysslan(d) {
    const r = d.sort === 'hona' ? g.samlaAgg() : d.sort === 'ko' ? g.mjolka() : d.sort === 'far' ? g.klippa() : null;
    if (!r) return false;
    if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return true; }
    play('ok');
    const txt = d.sort === 'hona' ? `🥚 ${r.n} ägg till skafferiet!${r.full ? ' (Skafferiet är fullt – sälj i gårdsbutiken.)' : ''}` : d.sort === 'ko' ? `🥛 ${r.n} liter mjölk till skafferiet!${r.full ? ' (Skafferiet är fullt – sälj i gårdsbutiken.)' : ''}` : `🧶 ${r.n} kg ull till ladugården – sälj den i gårdsbutiken!`;
    toast(txt + (r.glad ? ` +${r.glad} 😊` : ''), 'good');
    return true;
  }
  // ---------- hästen: stallet, rida, hinderbanan ----------
  const stars = (v) => '🟩'.repeat(Math.round(v / 20)) + '⬜'.repeat(5 - Math.round(v / 20));
  function stallet() {
    play('door');
    const H = g.hast;
    if (!H) return kopHast();
    const draw = () => {
      const idagMat = (H.matad | 0) === g.day, idagBorst = (H.borstad | 0) === g.day;
      const ros = HOPPKLASSER.map((K) => { const r = H.rosetter?.[K.id] || [0, 0, 0]; return r.some(Boolean) ? `${K.icon} ${r[0] ? '🥇' + r[0] : ''} ${r[1] ? '🥈' + r[1] : ''} ${r[2] ? '🥉' + r[2] : ''}` : ''; }).filter(Boolean).join(' · ');
      const dlg = openModal(`🐴 ${H.namn}`, `<div class="fd"><canvas class="fd-big" width="96" height="56"></canvas>
        <div class="fd-side" style="font-size:var(--f2)">Trivsel<br><b>${stars(H.trivsel)}</b><br>${idagMat ? '✅ har ätit' : '🥕 hungrig'}<br>${idagBorst ? '✅ borstad' : '🪮 vill bli borstad'}</div></div>
        <p style="font-size:var(--f2);margin:0">${H.trivsel < 45 ? '😟 En häst som inte trivs kan vägra vid hindren. Mata och borsta den varje dag!' : '😊 ' + H.namn + ' trivs och är redo att rida.'}${ros ? `<br>🎀 Rosetter: ${ros}` : ''}<br><small class="sp">Stallhyra ${g.home === 'gard' ? 'gratis – du har ju en gård' : fmt(HAST_STALL) + ' i veckan (gratis om du äger Gården)'}.</small></p>`, [
        ...(!idagMat ? [{ label: `🥕 Mata · ${fmt(HAST_MAT)}`, cls: 'btn-go', onClick: () => { const r = g.mataHast(); if (!r.ok) { toast(r.msg, 'bad'); return; } play('ok'); toast(`🥕 ${H.namn} mumsar havre och hö!${r.glad ? ` +${r.glad} 😊` : ''}`, 'good'); draw(); } }] : []),
        ...(!idagBorst ? [{ label: '🪮 Borsta', cls: 'btn-go', onClick: () => { const r = g.borstaHast(); if (!r.ok) { toast(r.msg, 'bad'); return; } play('ok'); toast(`🪮 ${H.namn} blänker!${r.glad ? ` +${r.glad} 😊` : ''}`, 'good'); draw(); } }] : []),
        A.ridHast ? { label: '🏠 Ställ in hästen', onClick: () => { closeModal(); A.ridHast = false; applyRide(); toast(`🐴 ${H.namn} går ut i hagen.`); } } : { label: '🏇 Rid ut', cls: 'btn-gold', onClick: () => { closeModal(); A.ridHast = true; applyRide(); play('fanfare'); toast(`🏇 Du sitter upp på ${H.namn}! Rid till ridbanan för att hoppa.`, 'good'); } },
        { label: 'Stäng', onClick: closeModal },
      ]);
      const c = dlg.querySelector('.fd-big').getContext('2d');
      c.fillStyle = '#e8d4aa'; c.fillRect(0, 0, 96, 56); c.fillStyle = '#c8b48a'; c.fillRect(0, 48, 96, 8);
      drawHastEnsam(c, 48, 50, 'right', 'sta', 0, H.farg, { sadel: true });
    };
    draw();
  }
  function kopHast() {
    let farg = 'fux', namn = HASTNAMN[Math.floor(Math.random() * HASTNAMN.length)];
    const draw = () => {
      const sw = HASTFARGER.map((f) => `<button class="btn btn-small ${f.id === farg ? 'btn-gold' : ''}" data-farg="${f.id}" title="${esc(f.blurb)}">${esc(f.namn)}</button>`).join(' ');
      const dlg = openModal('🐴 Stallet – hästar till salu', `<div class="fd"><canvas class="fd-big" width="96" height="56"></canvas>
        <div class="fd-side"><span class="fb-lbl">Färg</span><div>${sw}</div><span class="fb-lbl" style="margin-top:6px">Namn</span><input class="hast-namn" maxlength="14" value="${esc(namn)}" style="font:var(--f2) var(--font);width:120px;padding:2px 4px"></div></div>
        <p style="font-size:var(--f2);margin:0">Ridskolan säljer en snäll häst som är van vid hinder. Den bor i stallet – mata och borsta den varje dag, rid på landet och hoppa på hinderbanan!<br>💰 Du har <b>${fmt(g.money)}</b> · Pris <b>${fmt(HAST_PRIS)}</b> · stallhyra ${g.home === 'gard' ? 'gratis (du har en gård)' : fmt(HAST_STALL) + '/vecka'}</p>`, [
        { label: `🐴 Köp · ${fmt(HAST_PRIS)}`, cls: 'btn-go', onClick: () => {
          const r = g.buyHast(farg, dlg.querySelector('.hast-namn')?.value || namn);
          if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return; }
          closeModal(); play('fanfare');
          add('hast', HASTHAGE, 1, { egen: true }); djur[djur.length - 1].farg = farg;
          toast(`🐴 Grattis till ${r.hast.namn}! Hästen står i hagen – klicka på stallet för att rida ut.`, 'good');
        } },
        { label: 'Stäng', onClick: closeModal },
      ]);
      dlg.querySelector('.hast-namn').oninput = (e) => { namn = e.target.value; };
      const c = dlg.querySelector('.fd-big').getContext('2d');
      c.fillStyle = '#e8d4aa'; c.fillRect(0, 0, 96, 56); c.fillStyle = '#c8b48a'; c.fillRect(0, 48, 96, 8);
      drawHastEnsam(c, 48, 50, 'right', 'sta', 0, farg, { sadel: true });
      dlg.querySelectorAll('[data-farg]').forEach((b) => (b.onclick = () => { farg = b.dataset.farg; namn = dlg.querySelector('.hast-namn')?.value || namn; play('click'); draw(); }));
    };
    draw();
  }
  function hinderbanan() {
    const H = g.hast;
    if (!H) { toast('🏇 Hinderbanan – köp en häst i stallet så kan du hoppa här!'); return; }
    if (!A.ridHast) { toast(`🏇 Hämta ${H.namn} i stallet och rid hit först!`); return; }
    if (g.energy < 15) { toast('😪 Du är för trött för att hoppa i dag.', 'bad'); return; }
    const rader = HOPPKLASSER.map((K, i) => {
      const last = i > (H.klass | 0), r = H.rosetter?.[K.id] || [0, 0, 0];
      return `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:22px">${K.icon}</span><span class="nm">${esc(K.namn)} – ${K.hinder} hinder<br><small class="sp">${last ? `🔒 gör en felfri runda i ${esc(HOPPKLASSER[i - 1].namn.toLowerCase())} först` : `1:a pris ${fmt(K.pris[0])}${r.some(Boolean) ? ` · 🥇${r[0]} 🥈${r[1]} 🥉${r[2]}` : ''}`}</small></span>
        <button class="btn btn-small btn-go" data-klass="${K.id}" ${last ? 'disabled' : ''}>Hoppa</button></div>`;
    }).join('');
    const dlg = openModal('🏆 Hinderbanan', `<p style="font-size:var(--f2);margin-top:0">Rid runt banan och hoppa över alla hinder – tryck precis innan hindret! Varje rivning eller vägran ger 4 fel. Du tävlar mot ridskolans ryttare om rosetterna och prispengarna.</p><div class="plist">${rader}</div>`, [{ label: 'Inte nu', onClick: closeModal }]);
    dlg.querySelectorAll('[data-klass]').forEach((b) => (b.onclick = () => { closeModal(); startHopp(b.dataset.klass); }));
  }
  function startHopp(klass) {
    if (fade.phase === 1) return;
    fade.phase = 1; fade.cb = () => A.go('hopp', { klass, onDone: (res) => efterHopp(A, res) });
  }
  function bussen() {
    openModal('🚌 Busshållplats LANDET', `<p style="font-size:var(--f2);margin-top:0">Linje 4 går till <b>Betongtorget</b> i förorten. Biljetten kostar ${fmt(10)}.</p>`, [
      { label: '🚌 Åk till stan', cls: 'btn-go', onClick: () => { closeModal(); if (g.money < 10) { toast('Du har inte råd med bussen.', 'bad'); return; } g.money -= 10; g.passTime(15); g.save(); play('door'); toTown(busStop ? [busStop.x, busStop.y + 8] : [CITY.W - 40, 296]); } },
      { label: 'Gå', onClick: closeModal },
    ]);
  }
  // tillbaka in i staden vid stadsgränsen – på närmaste trottoar (inte mitt i körbanan)
  function tillStan() {
    let y = Math.max(CITY.SIDEWALK_N[0] + 4, Math.min(CITY.SIDEWALK_S[1] - 4, walker.py));
    if (y > CITY.ROAD[0] - 2 && y < CITY.ROAD[1] + 2) y = y < (CITY.ROAD[0] + CITY.ROAD[1]) / 2 ? CITY.SIDEWALK_N[0] + 16 : CITY.SIDEWALK_S[0] + 14;
    toTown([CITY.W - 24, y]);
  }
  function toTown(pos) {
    if (fade.phase === 1) return;
    if (A.ridHast) { A.ridHast = false; toast(`🐴 Du ställer in ${g.hast?.namn || 'hästen'} i stallet.`); }
    fade.phase = 1; fade.cb = () => { A.cityPos = pos; A.go('city'); };
  }
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const djurAt = (x, y) => djur.find((d) => Math.abs(d.x - x) < (d.sort === 'hona' ? 6 : 13) && y < d.y + 2 && y > d.y - (d.sort === 'hast' ? 26 : d.sort === 'ko' ? 20 : 12));
  function prata(d) {
    const L2 = LJUD[d.sort];
    talk.say(L2[Math.floor(Math.random() * L2.length)], () => ({ x: d.x, y: d.y - (d.sort === 'hast' ? 30 : d.sort === 'ko' ? 24 : 16) }), 2.5, { animal: true, silent: true });
    play('click');
    d.state = 'beta'; d.tm = 3; d.dir = walker.px < d.x ? 'left' : 'right';
    const h = g.glad?.(1, '', 'landdjur', 3); if (h) toast(`😊 +${h}`);
  }

  // ---------- staketen (y-sorterade bitar) ----------
  function fenceDrawables(pen, color, gap = null, sten = false) {
    const [x0, y0, x1, y1] = pen, out = [];
    const rail = (ctx, ax, bx, y) => { ctx.fillStyle = color[0]; ctx.fillRect(ax, y - 9, bx - ax, 2); ctx.fillRect(ax, y - 5, bx - ax, 2); ctx.fillStyle = color[1]; ctx.fillRect(ax, y - 8, bx - ax, 1); ctx.fillRect(ax, y - 4, bx - ax, 1); for (let x = ax; x < bx; x += 12) { ctx.fillStyle = color[2]; ctx.fillRect(x, y - 11, 2, 11); ctx.fillStyle = color[0]; ctx.fillRect(x, y - 11, 1, 11); } };
    if (gap) out.push({ fy: y0, draw: (ctx) => { rail(ctx, x0, gap[0], y0); rail(ctx, gap[1], x1, y0); } }); else out.push({ fy: y0, draw: (ctx) => rail(ctx, x0, x1, y0) });
    if (!sten) out.push({ fy: y1, draw: (ctx) => rail(ctx, x0, x1, y1) });
    for (const sx of [x0, x1 - 2]) out.push({ fy: y1 - 0.5, draw: (ctx) => { ctx.fillStyle = color[2]; ctx.fillRect(sx, y0 - 11, 2, y1 - y0 + 11); for (let y = y0; y < y1; y += 10) { ctx.fillStyle = color[0]; ctx.fillRect(sx - 1, y - 2, 4, 2); } } });
    return out;
  }
  const TRA = ['#8a5a30', '#b07a48', '#5a3a1e'], VIT = ['#e8e4d8', '#ffffff', '#a8a49a'];
  // ridbanans hinder (färgade bommar på stöd)
  const drawHinder = (ctx, h) => {
    const c = '#' + h.c.toString(16).padStart(6, '0');
    for (const sx of [h.x - 12, h.x + 10]) { ctx.fillStyle = '#f4f1ea'; ctx.fillRect(sx, h.y - 16, 3, 16); ctx.fillStyle = c; ctx.fillRect(sx, h.y - 16, 3, 2); ctx.fillRect(sx, h.y - 10, 3, 2); }
    if (h.typ === 'mur') { for (let j = 0; j < 3; j++) for (let i = 0; i < 5; i++) { ctx.fillStyle = (i + j) % 2 ? '#b85a3a' : '#a04a2e'; ctx.fillRect(h.x - 9 + i * 4 + (j % 2) * 2, h.y - 9 + j * 3, 4, 3); } }
    else for (const yy of h.typ === 'oxer' ? [12, 7] : [11]) for (let x = h.x - 9; x < h.x + 10; x += 2) { ctx.fillStyle = ((x - h.x) >> 2) & 1 ? c : '#f4f1ea'; ctx.fillRect(x, h.y - yy, 2, 2); }
  };
  // skyltarna: ortsskylten och busshållplatsen
  const drawOrtsskylt = (ctx) => {
    const { x, y } = ORTSSKYLT;
    ctx.fillStyle = '#5a5e66'; ctx.fillRect(x - 1, y - 18, 2, 18);
    ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 15, y - 31, 30, 14); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 14, y - 30, 28, 12);
    ctxText(ctx, SMALL, 'PIXEL', x - 10, y - 28, '#1e1a24'); ctxText(ctx, SMALL, 'STADEN', x - 12, y - 23, '#1e1a24');
    ctx.fillStyle = '#d8343c'; for (let i = 0; i < 26; i++) ctx.fillRect(x - 13 + i, y - 19 - Math.round(i * 0.42), 2, 1);
  };
  const drawHallplats = (ctx) => {
    const { x, y } = HALLPLATS;
    ctx.fillStyle = '#5a5e66'; ctx.fillRect(x, y - 30, 2, 30);
    ctx.fillStyle = '#f0c030'; ctx.fillRect(x - 6, y - 34, 14, 10); ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 6, y - 34, 14, 1);
    ctxText(ctx, SMALL, 'BUSS', x - 5, y - 32, '#1e1a24');
    ctx.fillStyle = '#8a5a30'; ctx.fillRect(x + 6, y - 7, 18, 3); ctx.fillRect(x + 7, y - 4, 2, 4); ctx.fillRect(x + 21, y - 4, 2, 4);   // bänken
  };
  // gårdsbutiken: ett litet stånd med tak, lådor med ägg och mjölkflaskor och en skylt
  const drawButik = (ctx, oppen) => {
    const { x, y } = BUTIK;
    ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(x - 17, y - 1, 34, 3);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x - 15, y - 22, 2, 22); ctx.fillRect(x + 13, y - 22, 2, 22);
    ctx.fillStyle = '#8a5a30'; ctx.fillRect(x - 16, y - 9, 32, 3); ctx.fillStyle = '#b07a48'; ctx.fillRect(x - 16, y - 9, 32, 1);
    for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#d8343c' : '#f4f1ea'; ctx.fillRect(x - 18 + i * 4, y - 27, 4, 5); }
    ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 18, y - 22, 36, 1);
    if (oppen) {
      ctx.fillStyle = '#c8a870'; ctx.fillRect(x - 13, y - 13, 10, 4); for (let i = 0; i < 4; i++) { ctx.fillStyle = '#f4ead8'; ctx.fillRect(x - 12 + i * 2, y - 14, 2, 2); }
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#f4f4f0'; ctx.fillRect(x + 2 + i * 4, y - 15, 3, 6); ctx.fillStyle = '#3a7bd5'; ctx.fillRect(x + 2 + i * 4, y - 16, 3, 1); }
    }
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 13, y - 21, 26, 7); ctxText(ctx, SMALL, 'ÄGG', x - 10, y - 20, '#5a3a1e');
  };
  const drawDomartorn = (ctx) => { const p = husPos('domartorn'); ctx.drawImage(husBild('domartorn', false), p.x, p.y); };
  const drawStubb = (ctx) => {
    for (const r of trak.klara) { const y = RADER[r]; ctx.fillStyle = '#c8b070'; ctx.fillRect(VETE[0] + 2, y - 7, VETE[2] - VETE[0] - 4, 9); ctx.fillStyle = '#a89050'; for (let x = VETE[0] + 2; x < VETE[2] - 2; x += 3) ctx.fillRect(x, y - 6 + (x % 2), 1, 1); }
    // den rad den håller på med: stubb bakom traktorn
    const y = RADER[trak.rad]; if (Math.abs(trak.y - y) < 1) { const a = trak.dir === 'right' ? VETE[0] + 2 : trak.x, b = trak.dir === 'right' ? trak.x : VETE[2] - 2; ctx.fillStyle = '#c8b070'; ctx.fillRect(Math.min(a, b), y - 7, Math.abs(b - a), 9); }
  };

  function night() { const h = g.min / 60; return h >= 20 || h < 5.5; }
  function dusk() { const h = g.min / 60; return (h >= 18 && h < 20) || (h >= 5.5 && h < 7); }

  return {
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    get worldRide() { const F = fordon(); return F ? { id: F.id, c: F.c } : null; },
    rideChanged: applyRide,
    update(dt) {
      t += dt; banner += dt;
      VW = Math.max(384, Math.min(A.W || 384, LW)); VH = Math.max(160, Math.min(A.H || 216, LH));
      if (fade.phase === 1) { fade.a = Math.min(1, fade.a + dt * 2.6); if (fade.a >= 1) { fade.phase = 0; const cb = fade.cb; fade.cb = null; cb?.(); return; } }
      else if (fade.phase === 2) { fade.a = Math.max(0, fade.a - dt * 1.8); if (fade.a <= 0) fade.phase = 0; walker.update(dt); }
      else walker.update(dt);
      // västra kanten = tillbaka in i staden
      if (fade.phase === 0 && walker.px <= 8 && walker.path.length) tillStan();
      updDjur(dt); updTraktor(dt);
      const c = camTarget(); cam.x += (c.x - cam.x) * Math.min(1, dt * 8); cam.y += (c.y - cam.y) * Math.min(1, dt * 8);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const N = night(), D = dusk();
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      // himlen och kullarna (parallax)
      ctx.drawImage(skyCanvas(VW, N, D), 0, Math.min(0, -cy * 0.3));
      for (const [layer, k, yy] of [[0, 0.25, L.HORIZON - 58], [1, 0.5, L.HORIZON - 44]]) {
        const img = hillsCanvas(layer, N), off = -Math.round(cx * k) % img.width;
        for (let x = off; x < VW; x += img.width) ctx.drawImage(img, x, yy - cy);
      }
      ctx.drawImage(dayLand(), -cx, -cy);
      ctx.save(); ctx.translate(-cx, -cy);
      drawStubb(ctx);
      // allt som står på marken, y-sorterat
      const items = [];
      for (const id of ['gard', 'lada', 'silo', 'stall']) { const p = husPos(id); items.push({ fy: HUS[id].base, draw: () => ctx.drawImage(husBild(id, false), p.x, p.y) }); }
      items.push({ fy: HUS.domartorn.base, draw: () => drawDomartorn(ctx) });
      for (const tr of TRAD) if (tr.x > cx - 40 && tr.x < cx + VW + 40) items.push({ fy: tr.y, draw: () => drawTrad(ctx, tr.x, tr.y, tr.s, t) });
      for (const d of [...fenceDrawables(KOHAGE, TRA), ...fenceDrawables(FARHAGE, TRA, null, true), ...fenceDrawables(HONSGARD, VIT), ...fenceDrawables(HASTHAGE, VIT, GRIND.hage), ...fenceDrawables(RIDBANA, VIT, GRIND.bana)]) items.push({ fy: d.fy, draw: () => d.draw(ctx) });
      for (const h of HINDER) items.push({ fy: h.y, draw: () => drawHinder(ctx, h) });
      for (const d of djur) if (d.x > cx - 40 && d.x < cx + VW + 40 && !(d.egen && A.ridHast)) items.push({ fy: d.y, draw: () => { if (d.sort === 'ko') drawKo(ctx, d.x, d.y, d.dir, d.fr, d.flack); else if (d.sort === 'far') drawFar(ctx, d.x, d.y, d.dir, d.fr); else if (d.sort === 'hast') drawHast(ctx, d.x, d.y, d.dir, d.fr, d.farg); else drawHona(ctx, d.x, d.y, d.dir, d.fr); } });
      items.push({ fy: trak.y, draw: () => drawTraktor(ctx, trak.x, trak.y, trak.dir, t, trak.vanta <= 0) });
      items.push({ fy: ORTSSKYLT.y, draw: () => drawOrtsskylt(ctx) }, { fy: HALLPLATS.y, draw: () => drawHallplats(ctx) }, { fy: BUTIK.y, draw: () => drawButik(ctx, agd()) });
      items.push(...folkDrawables(A, t));
      const F = fordon();
      if (A.ridHast && g.hast) {
        // på hästen: travar när man rör sig, står still annars (åt det håll man senast red)
        const ror = walker.path.length > 0;
        if (ror && (walker.dir === 'left' || walker.dir === 'right')) ridDir = walker.dir;
        items.push({ fy: walker.py, draw: () => drawHastRyttare(ctx, walker.px, walker.py, ridDir, ror ? 'trav' : 'sta', Math.floor(t * 8) % 4, g.hast.farg, A.avatar.look) });
      } else items.push(selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length, ride: F ? { id: F.id, c: F.c } : null }));
      items.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      // traktorns damm
      if (trak.vanta <= 0) for (let k = 0; k < 4; k++) { const u = (t * 1.6 + k / 4) % 1; ctx.fillStyle = `rgba(200,180,120,${(0.4 * (1 - u)).toFixed(2)})`; ctx.fillRect(Math.round(trak.x + (trak.dir === 'right' ? -26 : 26) * (1 + u * 0.4)), Math.round(trak.y - 6 - u * 10), 3 + Math.round(u * 3), 3); }
      ctx.restore();
      // kvällen och natten: mörker över allt, sedan lyser gårdens fönster och stallets lykta
      if (N || D) {
        ctx.fillStyle = N ? 'rgba(12,16,48,0.58)' : 'rgba(60,40,90,0.22)'; ctx.fillRect(0, 0, VW, VH);
        if (D) { ctx.fillStyle = 'rgba(255,140,80,0.10)'; ctx.fillRect(0, 0, VW, VH); }
        const gp = husPos('gard'), top = gp.y + (HUS.gard.h + 40) - 4 - HUS.gard.h;
        for (const wx of [20, 48, 104, 132]) for (const wy of [24, 44]) {
          const x = gp.x + wx - cx, y = top + wy - cy;
          if (x < -20 || x > VW + 20) continue;
          ctx.fillStyle = 'rgba(255,214,120,0.16)'; ctx.fillRect(x - 3, y - 3, 16, 18);
          ctx.fillStyle = '#f8d878'; ctx.fillRect(x, y, 10, 12); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x + 5, y, 1, 12); ctx.fillRect(x, y + 6, 10, 1);
        }
        const sp = { x: HUS.stall.door.x0 - 6 - cx, y: HUS.stall.base - 38 - cy };
        ctx.fillStyle = 'rgba(255,214,120,0.22)'; ctx.fillRect(sp.x - 5, sp.y - 5, 12, 12); ctx.fillStyle = '#ffe9a0'; ctx.fillRect(sp.x, sp.y, 3, 3);
      }
      ctx.save(); ctx.translate(-cx, -cy); talk.draw(ctx, { x0: cx, x1: cx + VW }); ctx.restore();
      // områdesskylten när man kommer
      if (banner < 4) { const a = banner < 0.4 ? banner / 0.4 : banner > 3.4 ? (4 - banner) / 0.6 : 1; ctx.globalAlpha = Math.max(0, a); const s = 'LANDET', s2 = 'KOR, FÅR OCH FRISK LUFT', w = Math.max(textW(BIG, s, 2), textW(SMALL, s2)) + 20; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect((VW - w) >> 1, 26, w, 30); ctxText(ctx, BIG, s, (VW - textW(BIG, s, 2)) >> 1, 30, '#8edc4c', 2); ctxText(ctx, SMALL, s2, (VW - textW(SMALL, s2)) >> 1, 48, '#f4f1ea'); ctx.globalAlpha = 1; }
      // namnet på det man pekar på
      const s = hover && spotAt(hover.x + cx, hover.y + cy);
      if (s) { const w = textW(SMALL, s.label) + 10, x = Math.round(Math.max(2, Math.min(VW - w - 2, hover.x - w / 2))), y = Math.max(2, hover.y - 22); ctx.fillStyle = 'rgba(20,18,26,.9)'; ctx.fillRect(x, y, w, 11); ctxText(ctx, SMALL, s.label, x + 5, y + 3, '#ffd23f'); }
      if (fade.a > 0) { ctx.fillStyle = `rgba(10,10,16,${fade.a.toFixed(2)})`; ctx.fillRect(0, 0, VW, VH); }
    },
    down(sx, sy) {
      if (fade.phase === 1) return;
      hover = { x: sx, y: sy };
      const x = sx + cam.x, y = sy + cam.y;
      const s = spotAt(x, y);
      if (s && s.id !== 'ridbana') { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      const d = djurAt(x, y);
      if (d) {
        // på den egna gården: man ställer sig vid hagens staket och sköter djuret
        if (d.egen) { walker.walkTo(Math.max(HASTHAGE[0] + 8, Math.min(HASTHAGE[2] - 8, d.x)), HASTHAGE[1] - 8, () => { prata(d); stallet(); }); return; }
        const pen = d.pen, egen = agd() && d.sort !== 'hast';
        if (egen) { walker.walkTo(Math.max(pen[0] + 8, Math.min(pen[2] - 8, d.x)), pen[3] + 8, () => { prata(d); sysslan(d); }); return; }
        walker.walkTo(d.x + (walker.px < d.x ? -16 : 16), Math.min(L.BOTTOM - 2, d.y + 6), () => prata(d));
        return;
      }
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      if (x < 10) { walker.walkTo(4, Math.max(L.VERGE_N[0] + 4, Math.min(L.VERGE_S[1] - 4, y)), tillStan); return; }
      walker.walkTo(x, y);
    },
    move(sx, sy) { hover = { x: sx, y: sy }; },
    exit() { talk.clear(); },
    _debug: {
      pos: () => ({ x: walker.px, y: walker.py }),
      cam: () => ({ ...cam }),
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); Object.assign(cam, camTarget()); },
      walkTo: (x, y) => { walker.walkTo(x, y); return walker.path.length; },
      walkable: (x, y) => walker.walkable(x, y),
      spot: (id) => { const s = spots().find((q) => q.id === id); return s ? { x: Math.round((s.r[0] + s.r[2]) / 2 - cam.x), y: Math.round((s.r[1] + s.r[3]) / 2 - cam.y) } : null; },
      act: (id) => { const s = spots().find((q) => q.id === id); if (!s) return false; s.act(); return true; },
      djur: () => djur.map((d) => ({ sort: d.sort, x: Math.round(d.x), y: Math.round(d.y), state: d.state, pen: d.pen, egen: !!d.egen })),
      rider: () => !!A.ridHast,
      fart: () => walker.speed,
      djurSkarm: (sort) => { const d = djur.find((q) => q.sort === sort); return d ? { x: Math.round(d.x - cam.x), y: Math.round(d.y - 8 - cam.y) } : null; },
      traktor: () => ({ x: Math.round(trak.x), y: Math.round(trak.y), rad: trak.rad, klara: trak.klara.length }),
      prat: () => talk.text(),
      fade: () => fade.phase,
    },
  };
}
// efter hoppningen (js/scenes/hopp.js): placeringen mot ridskolan, rosetten och priset – sedan står man
// vid ridbanans grind på hästen igen
function efterHopp(A, res) {
  const g = A.game, r = g.hoppResultat(res.klass, res.fel, res.tid);
  A.landetFran = { bana: true };
  A.go('landet');
  if (!r) return;
  const K = HOPPKLASSER.find((k) => k.id === res.klass);
  const ros = ['🥇 1:a plats – blå rosett!', '🥈 2:a plats – röd rosett!', '🥉 3:e plats – gul rosett!'][r.plats - 1] || `${r.plats}:e plats`;
  const rows = r.alla.map((x, i) => `<div style="display:flex;justify-content:space-between;font-size:var(--f2)"><span>${i + 1}. ${x.du ? `<b>Du</b> på ${esc(x.hast)}` : `${esc(x.namn)} på ${esc(x.hast)}`}</span><b>${x.fel} fel · ${x.tid.toFixed(1).replace('.', ',')} s</b></div>`).join('');
  play(r.plats === 1 ? 'fanfare' : 'ok');
  setTimeout(() => openModal(`🏆 ${K.namn}: ${ros}`, `${rows}
    <div style="border-top:3px dashed var(--ink);margin:8px 0"></div>
    <p style="font-size:var(--f2);margin:0">${res.rivna ? `🪵 ${res.rivna} ${res.rivna === 1 ? 'rivning' : 'rivningar'}. ` : ''}${res.vagran ? `🐴 ${res.vagran} ${res.vagran === 1 ? 'vägran' : 'vägringar'} – mata och borsta hästen så trivs den bättre. ` : ''}${r.felfri ? '✨ Felfri runda! ' : ''}${r.pris ? `💰 Prispengar: <b>${fmt(r.pris)}</b>. ` : ''}${r.upplast ? `<br>🔓 <b>${esc(HOPPKLASSER[HOPPKLASSER.indexOf(K) + 1].namn)}</b> är öppen nu!` : ''}${r.glad ? ` +${r.glad} 😊` : ''}</p>`,
  [{ label: '🎉 Härligt!', cls: 'btn-go', onClick: closeModal }]), 450);
}
// marken målas en gång (dag) – nattversionen är samma bild, mörkare och blåare
let DAY = null, NIGHT = null;
const dayLand = () => (DAY ||= paintLand());
function paintNightLand() {
  if (NIGHT) return NIGHT;
  const src = dayLand(), c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(14,18,52,0.55)'; x.fillRect(0, 0, c.width, c.height);
  NIGHT = c; return c;
}
