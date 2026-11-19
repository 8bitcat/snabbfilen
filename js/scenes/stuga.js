// 🏡 RÖDA STUGAN – sommarstugan på Solön (Carl 2026-11-18: "sommarstuga på ön"). Man hyr den för natten vid dörren
// (js/scenes/solon.js, STUGA_PRIS) och kliver in: ett rum med furupanel, det stora fönstret mot havet (vågorna,
// segelbåten, måsarna, fyren som blinkar om natten), sängen med lapptäcket, kaminen, bordet med kaffepannan och
// gästboken, bänken under fönstret, bokhyllan med Huldas dagbok, gungstolen och verandadörren.
//   • SÄNGEN: sov till i morgon (A.sleepFlow – scenen spelar natten själv, bedtime) – en natt i stugan ger extra lycka
//   • KAMINEN: lägg i ved (värmen piggar upp), BORDET: kaffe och bulle ingår (en gång om dagen), GÄSTBOKEN: läs
//   • VERANDAN: sitt och titta på havet (lycka), FÖNSTRET: ibland en delfin
//   • UT: tillbaka till Solön framför stugan
// Hyran gäller natten och morgonen därpå (g.stugaHyrd). _debug-API för tools/stuga-test.mjs.
import { drawPerson } from '../core/people.js';
import { SMALL, ctxText, textW } from '../core/floor-pix.js';
import { toast } from '../core/ui.js';
import { play } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables, createSpeech } from './walkable.js';
import { STUGA, paintStugaBg, ritaUtsikt, ritaSang, ritaNattbord, ritaKamin, ritaVedkorg, ritaBank, ritaBord, ritaBokhylla, ritaGungstol, ritaFiltkorg, ritaStovlar, ritaSpo, ritaLampsken } from '../solon/stuga-inne.js';
import { $t } from '../core/i18n.js';

const { W, H, WALL_Y, DOOR, FONSTER, VERANDA, SANG, NATTBORD, KAMIN, VEDKORG, BANK, BORD, BOKHYLLA, GUNGSTOL, FILTKORG, STOVLAR, SPO, HYLLA } = STUGA;
const GASTBOK = [
  $t('"Bästa veckan i mitt liv. Delfinen kom varje kväll." – Familjen Berg'), $t('"Vi fiskade fjorton abborrar och åt dem alla." – Sixten, 7 år'),
  $t('"Kaminen är varm, havet är kallt. Perfekt." – Hulda'), $t('"Måsen tog min bulle på verandan. Kommer tillbaka ändå!" – Majken'),
  $t('"Sov som en stock. Vågorna är bättre än vaggvisor." – Pricken'),
];
const DAGBOK = [$t('Ur Huldas dagbok, 1902: "I natt förliste skonaren Hoppet. Jag rodde ut tre gånger. Alla kom i land."'), $t('Ur Huldas dagbok, 1911: "Katterna är nu fjorton. Den fjortonde heter Måns och sover på fyrens trappa."'), $t('Ur Huldas dagbok, 1920: "Stugan är klar. Röd, som jag ville. Härifrån ser jag både fyren och färjan."')];

export function makeStuga(A) {
  const g = A.game;
  const natt = () => { const h = g.min / 60; return h >= 20 || h < 6; };
  const kvall = () => { const h = g.min / 60; return (h >= 18 && h < 20) || (h >= 6 && h < 7.5); };
  const walker = createWalker({ W, H, left: 6, right: W - 6, top: WALL_Y + 6, bottom: H - 4, spawn: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 14] });
  walker.speed = 72;
  walker.setObstacles([
    [SANG.x - 34, SANG.y - 36, SANG.x + 34, SANG.y + 1], [NATTBORD.x - 7, NATTBORD.y - 10, NATTBORD.x + 7, NATTBORD.y + 1],
    [KAMIN.x - 12, KAMIN.y - 20, KAMIN.x + 11, KAMIN.y + 1], [VEDKORG.x - 10, VEDKORG.y - 8, VEDKORG.x + 10, VEDKORG.y + 1],
    [BANK.x - 31, WALL_Y, BANK.x + 31, BANK.y + 1], [BORD.x - 28, BORD.y - 14, BORD.x + 28, BORD.y + 3],
    [BOKHYLLA.x - 16, WALL_Y, BOKHYLLA.x + 16, BOKHYLLA.y + 1], [GUNGSTOL.x - 14, GUNGSTOL.y - 10, GUNGSTOL.x + 14, GUNGSTOL.y + 1],
    [FILTKORG.x - 10, FILTKORG.y - 8, FILTKORG.x + 10, FILTKORG.y + 1], [STOVLAR.x - 6, STOVLAR.y - 6, STOVLAR.x + 8, STOVLAR.y + 1],
  ]);
  walker.snapFree();
  let t = 0, hover = null, hoverT = 0, eld = true, seq = null, sitter = null;
  const talk = createSpeech();
  const BG = paintStugaBg();
  const dagKey = (k) => `${k}:${g.day}`;
  const minne = A.stugaMinne || (A.stugaMinne = {});   // en gång om dagen: kaffet, veden

  // ---------- natten: scenen spelar den själv (A.sleepFlow → bedtime) ----------
  function bedtime(onWake) {
    if (seq) return false;
    g.min = Math.min(g.min, 24 * 60 - 2);
    seq = { t: 0, onWake, klar: false };
    walker.stop(); walker.px = SANG.x - 2; walker.py = SANG.y + 6; sitter = 'sang';
    play('sleep');
    return true;
  }
  function vakna() {
    if (!seq || seq.klar) return;
    seq.klar = true;
    const h = g.glad?.(3, $t('En natt i sommarstugan'), 'stuganatt', 3) || 0;
    const cb = seq.onWake; seq = null; sitter = null;
    walker.px = SANG.x + 40; walker.py = SANG.y + 8; walker.snapFree(); walker.dir = 'down';
    cb?.();
    setTimeout(() => { play('morning'); if (h) toast($t`🌅 God morgon! Havet glittrar utanför fönstret. +${h} 😊`, 'good'); }, 700);
  }

  // ---------- platserna ----------
  const spots = () => [
    { id: 'ut', r: [DOOR.x0, 14, DOOR.x1, WALL_Y + 6], go: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 12], label: $t('UT'), act: () => { play('door'); A.solonFran = { stuga: 'rod' }; A.go('solon'); } },
    { id: 'sang', r: [SANG.x - 34, SANG.y - 44, SANG.x + 34, SANG.y + 2], go: [SANG.x + 42, SANG.y - 6], label: $t('SÄNGEN – SOV TILL I MORGON'), act: () => { walker.dir = 'left'; A.sleepFlow(); } },
    { id: 'kamin', r: [KAMIN.x - 12, KAMIN.y - 58, KAMIN.x + 12, KAMIN.y + 2], go: [KAMIN.x + 18, KAMIN.y + 10], label: $t('KAMINEN – LÄGG I VED'), act: () => { eld = true; play('click'); const k = dagKey('ved'); if (!minne[k]) { minne[k] = true; g.energy = Math.min(100, (g.energy || 0) + 6); const h = g.glad?.(1, $t('Värmen från kaminen'), 'stugakamin', 1) || 0; g.save(); toast($t('🔥 Du lägger i ett vedträ. Kaminen sprakar och värmen sprider sig i stugan. +6 ⚡') + (h ? ` +${h} 😊` : ''), 'good'); } else toast($t('🔥 Kaminen brinner fint. Kaffepannan puttrar på plattan.')); } },
    { id: 'bord', r: [BORD.x - 28, BORD.y - 30, BORD.x + 28, BORD.y + 4], go: [BORD.x - 22, BORD.y + 6], label: $t('BORDET – KAFFE OCH BULLE'), act: () => { walker.dir = 'right'; const k = dagKey('kaffe'); if (!minne[k]) { minne[k] = true; g.hunger = Math.min(100, (g.hunger || 0) + 12); const h = g.glad?.(1, $t('Kaffe i stugan'), 'stugakaffe', 1) || 0; g.save(); play('ok'); toast($t('☕ Kaffe ur pannan och en bulle från korgen – det ingår i hyran. +12 🍔') + (h ? ` +${h} 😊` : ''), 'good'); } else toast($t('☕ Pannan är tom tills i morgon. Men utsikten kostar inget.')); } },
    { id: 'gastbok', r: [BORD.x + 8, BORD.y - 26, BORD.x + 22, BORD.y - 16], go: [BORD.x + 22, BORD.y + 6], label: $t('GÄSTBOKEN'), act: () => { walker.dir = 'left'; play('slide'); talk.say(GASTBOK[(g.day + Math.floor(t)) % GASTBOK.length], () => ({ x: walker.px, y: walker.py - 26 }), 6, { voice: 'self' }); } },
    { id: 'veranda', r: [VERANDA.x0 - 4, 10, VERANDA.x1 + 4, WALL_Y + 6], go: [(VERANDA.x0 + VERANDA.x1) / 2, WALL_Y + 12], label: $t('VERANDAN – SITT OCH TITTA PÅ HAVET'), act: () => { walker.dir = 'up'; const h = g.glad?.(2, $t('Kvällen på verandan'), 'stugaveranda', 2) || 0; toast(natt() ? $t('🌙 Du sitter på verandan. Fyren blinkar, vågorna skvalpar och stjärnorna är fler än i stan.') : $t('🌊 Du sitter på verandan med fötterna på räcket. Färjan tutar långt borta.') + (h ? ` +${h} 😊` : ''), 'good'); } },
    { id: 'fonster', r: [FONSTER.x0 - 4, FONSTER.y0 - 6, FONSTER.x1 + 4, FONSTER.y1 + 6], go: [(FONSTER.x0 + FONSTER.x1) / 2, WALL_Y + 12], label: $t('FÖNSTRET MOT HAVET'), act: () => { walker.dir = 'up'; const delfin = Math.random() < 0.25; if (delfin) { const h = g.glad?.(2, $t('En delfin utanför fönstret'), 'stugadelfin', 2) || 0; toast($t('🐬 En delfin! Den hoppar två gånger utanför fönstret och försvinner.') + (h ? ` +${h} 😊` : ''), 'good'); } else toast(natt() ? $t('🪟 Fyren blinkar var tredje sekund. Hulda räknade dem varje natt.') : $t('🪟 En segelbåt glider förbi. Måsarna följer färjan in mot stan.')); } },
    { id: 'bokhylla', r: [BOKHYLLA.x - 16, BOKHYLLA.y - 46, BOKHYLLA.x + 16, BOKHYLLA.y + 2], go: [BOKHYLLA.x, BOKHYLLA.y + 10], label: $t('BOKHYLLAN – HULDAS DAGBOK'), act: () => { walker.dir = 'up'; play('slide'); talk.say(DAGBOK[(g.day + Math.floor(t / 7)) % DAGBOK.length], () => ({ x: walker.px, y: walker.py - 26 }), 7, { voice: 'self' }); } },
    { id: 'gungstol', r: [GUNGSTOL.x - 14, GUNGSTOL.y - 36, GUNGSTOL.x + 14, GUNGSTOL.y + 2], go: [GUNGSTOL.x - 20, GUNGSTOL.y + 4], label: $t('GUNGSTOLEN'), act: () => toast($t('🪑 Gungstolen knarrar. Här satt Hulda och stickade sockor åt alla fjorton katterna.')) },
    { id: 'hylla', r: [HYLLA.x0, 24, HYLLA.x1, 66], go: [(HYLLA.x0 + HYLLA.x1) / 2, WALL_Y + 12], label: $t('HYLLAN'), act: () => toast($t('🫙 Hallonsylt, snäckor från stranden och ett skepp i en flaska. Fotot är Hulda – fyrvaktaren som byggde stugan.')) },
  ];
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const focusSpot = () => {
    const h = hover && t - hoverT < 4 && spotAt(hover.x, hover.y);
    if (h) return h;
    if (walker.path.length || seq) return null;
    return spots().find((s) => s.id !== 'ut' && Math.abs(walker.px - s.go[0]) < 7 && Math.abs(walker.py - s.go[1]) < 7) || null;
  };
  function label(ctx, s) {
    if (!s) return;
    const txt = s.label, w = textW(SMALL, txt) + 10, x = Math.round(Math.max(2, Math.min(W - w - 2, (s.r[0] + s.r[2]) / 2 - w / 2))), y = Math.max(2, s.r[1] - 13);
    ctx.fillStyle = 'rgba(40,26,20,.92)'; ctx.fillRect(x, y, w, 11); ctx.fillStyle = '#d8343c'; ctx.fillRect(x, y + 10, w, 1);
    ctxText(ctx, SMALL, txt, x + 5, y + 3, '#ffd23f');
  }

  return {
    viewMax: { w: W, h: H },
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    bedtime,
    get asleep() { return !!seq; },
    update(dt) {
      dt = Math.min(0.1, Math.max(0, dt));
      t += dt;
      if (seq) { seq.t += dt; if (seq.t >= 4.2) vakna(); return; }
      walker.update(dt);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const N = natt(), K = kvall();
      ctx.drawImage(BG, 0, 0);
      ritaUtsikt(ctx, t, N, K);
      const focus = focusSpot();
      const list = [...folkDrawables(A, t)];
      if (!seq) list.push(selfDrawable(A, walker, t));
      list.push({ fy: SANG.y, draw: () => ritaSang(ctx, SANG.x, SANG.y, !!seq, t) }, { fy: NATTBORD.y, draw: () => ritaNattbord(ctx, NATTBORD.x, NATTBORD.y, N) });
      list.push({ fy: KAMIN.y, draw: () => ritaKamin(ctx, KAMIN.x, KAMIN.y, t, eld) }, { fy: VEDKORG.y, draw: () => ritaVedkorg(ctx, VEDKORG.x, VEDKORG.y) });
      list.push({ fy: BANK.y, draw: () => ritaBank(ctx, BANK.x, BANK.y) }, { fy: BORD.y, draw: () => ritaBord(ctx, BORD.x, BORD.y, !minne[dagKey('kaffe')]) });
      list.push({ fy: BOKHYLLA.y, draw: () => ritaBokhylla(ctx, BOKHYLLA.x, BOKHYLLA.y) }, { fy: GUNGSTOL.y, draw: () => ritaGungstol(ctx, GUNGSTOL.x, GUNGSTOL.y, t) });
      list.push({ fy: FILTKORG.y, draw: () => ritaFiltkorg(ctx, FILTKORG.x, FILTKORG.y) }, { fy: STOVLAR.y, draw: () => ritaStovlar(ctx, STOVLAR.x, STOVLAR.y) }, { fy: SPO.y, draw: () => ritaSpo(ctx, SPO.x, SPO.y) });
      list.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      if (N) { ctx.fillStyle = 'rgba(10,8,30,.3)'; ctx.fillRect(0, 0, W, H); ritaLampsken(ctx, true); }
      else if (K) { ctx.fillStyle = 'rgba(255,150,80,.08)'; ctx.fillRect(0, 0, W, H); }
      if (seq) { const a = seq.t < 1.2 ? seq.t / 1.2 : seq.t < 3.2 ? 1 : Math.max(0, (4.2 - seq.t)); ctx.fillStyle = `rgba(6,6,14,${(a * 0.92).toFixed(2)})`; ctx.fillRect(0, 0, W, H); if (seq.t > 1 && seq.t < 3.4) { const s = '💤'; ctxText(ctx, SMALL, $t('Natten på Solön …'), (W - textW(SMALL, $t('Natten på Solön …'))) >> 1, 100, '#f4f1ea'); void s; } }
      talk.draw(ctx, { x0: 0, x1: W });
      label(ctx, focus);
    },
    down(sx, sy) {
      if (seq) return;
      hover = null;
      const s = spotAt(sx, sy);
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      if (sy > WALL_Y) walker.walkTo(sx, sy);
    },
    move(sx, sy) { hover = { x: sx, y: sy }; hoverT = t; },
    exit() { talk.clear(); },
    _debug: {
      spots: () => spots().map((s) => s.id),
      act: (id) => { const s = spots().find((q) => q.id === id); if (!s) return false; s.act(); return true; },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); },
      pos: () => ({ x: Math.round(walker.px), y: Math.round(walker.py) }),
      prat: () => talk.text?.() ?? null,
      sover: () => !!seq,
      natt: () => { if (!seq) return false; seq.t = 4.2; vakna(); return true; },
      eld: () => eld,
    },
  };
}
