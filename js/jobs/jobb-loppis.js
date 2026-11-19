// 🧸 GARAGELOPPISEN – lördagsjobbet på uppfarten vid Äppelvägen 9 i Villaområdet (Carl 2026-11-18: "jobb/minispel …
// garageloppis"). Familjen Rosén har burit ut allt ur garaget på bord: lampor, radioapparater, skridskor, böcker, nallar,
// vaser och en cykel – och grannarna strömmar till. Varje kund håller upp en sak och ger ett bud. Man ser sakens
// RIKTVÄRDE på prislappen och väljer: SÅLT (ta budet) eller PRUTA (be om mer). Prutar man höjer kunden budet – men för
// varje gång växer risken att hen tröttnar och går. Sålt till minst 80 % av riktvärdet = bra affär (rätt, lönen tickar);
// under 50 % = bortslumpat (avdrag); kund som går = osåld (missad). Fem bra affärer i rad = LOPPISKUNGEN (bonus).
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, hash, mix } from '../core/floor-pix.js';
import { planOf, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';
import { $t } from '../core/i18n.js';

const FW = 384, FH = 216;
export const SAKER = [
  { id: 'lampa', namn: $t('Golvlampa med fransar'), varde: 120, pal: { k: 0xf0c030, s: 0x8a6a40, l: 0xffe070 }, ikon: ['.kkkkk.', 'kkkkkkk', 'klkkkkk', '.kkkkk.', '...s...', '...s...', '..sss..'] },
  { id: 'radio', namn: $t('Gammal radio – fungerar!'), varde: 90, pal: { k: 0x8a5a30, s: 0x3a3a42, l: 0xd8d4cc }, ikon: ['kkkkkkk', 'kllllsk', 'klllksk', 'kllllsk', 'kkkkkkk', 'k.....k', '.......'] },
  { id: 'skridskor', namn: $t('Skridskor, strl 38'), varde: 150, pal: { k: 0xf4f1ea, s: 0x8a8a94, l: 0x3a7bd5 }, ikon: ['..kk...', '..kkk..', '..kkkk.', 'lkkkkkk', 'kkkkkkk', '.sssss.', '.......'] },
  { id: 'bocker', namn: $t('Tio deckare i kartong'), varde: 60, pal: { k: 0xd8343c, s: 0x3a7bd5, l: 0xf0c030 }, ikon: ['kkk.lll', 'kkk.lll', 'kkk.lll', 'sss.kkk', 'sss.kkk', 'sss.kkk', 'sss.kkk'] },
  { id: 'nalle', namn: $t('Nalle med ett öga'), varde: 40, pal: { k: 0xb88448, s: 0x1a1414, l: 0xd8a860 }, ikon: ['k.....k', 'kkkkkkk', 'kskkksk', 'kkkkkkk', '.kklkk.', 'kkklkkk', '.kk.kk.'] },
  { id: 'vas', namn: $t('Blå vas, farmors'), varde: 200, pal: { k: 0x2a5aa8, s: 0x1e4a90, l: 0x8ab4e8 }, ikon: ['..kkk..', '...k...', '..klk..', '.kkllk.', '.kkklk.', '.kkkkk.', '..sss..'] },
  { id: 'cykel', namn: $t('Barncykel med stödhjul'), varde: 350, pal: { k: 0xd8343c, s: 0x1a1414, l: 0xf4f1ea }, ikon: ['....kk.', '...kk..', 'ss.kkss', 'sskkkss', 'ss.k.ss', 'ss...ss', '.......'] },
  { id: 'tavla', namn: $t('Tavla: älg i solnedgång'), varde: 80, pal: { k: 0x8a6a40, s: 0xf07e24, l: 0x3a2a1a }, ikon: ['kkkkkkk', 'ksssssk', 'ksslssk', 'ksllssk', 'klllllk', 'kkkkkkk', '.......'] },
];
const PLATS = { x: 150, y: 112 };
const KNAPP = { salt: { x: 60, y: 184, w: 120, h: 22 }, pruta: { x: 204, y: 184, w: 120, h: 22 } };

export function makeJobbLoppis(A, { onDone } = {}) {
  const g = A.game, P = planOf(A), DUR = P.seconds;
  const stats = { ok: 0, fel: 0, miss: 0, boxes: 0 };
  const pops = makePops();
  let t = 0, done = false, doneT = 0, reported = false;
  let seed = ((g?.day || 1) * 6151 + 4711) % 233280;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const wage = 13;
  let kund = null, streak = 0, nextT = 1.4, auto = true, salda = [], kassa = 0;
  const patience = () => Math.max(5, 9 / (P.pace || 1));
  const gap = () => (1.4 + rnd() * 1.2) / (P.pace || 1);
  function nyKund(sakId = null, andel = null) {
    if (kund) return false;
    const sak = SAKER.find((s) => s.id === sakId) || SAKER[(rnd() * SAKER.length) | 0];
    const a = andel ?? (0.4 + rnd() * 0.5);
    kund = { look: { ...makeLook(), kid: rnd() < 0.2 }, sak, bud: Math.max(5, Math.round(sak.varde * a / 5) * 5), prut: 0, risk: 0.2, t: patience(), dur: patience(), st: 'in', k: 0, text: null, textT: 0 };
    play('click');
    return true;
  }
  function avsluta(st) {
    const K = kund; K.st = st; K.k = 1.3;
    if (st === 'salt') {
      const andel = K.bud / K.sak.varde; kassa += K.bud; salda.push(K.sak.id);
      if (andel >= 0.8) { stats.ok++; streak++; pops.add(PLATS.x, 56, $t`SÅLD FÖR ${K.bud} KR!`, '#8ae08a'); pops.add(PLATS.x, 68, `+${wage} kr`, '#ffd23f'); play('ok'); if (streak % 5 === 0) { stats.boxes++; pops.add(FW / 2, 36, $t('LOPPISKUNGEN!'), '#ffd23f'); play('fanfare'); } }
      else if (andel >= 0.5) { streak = 0; pops.add(PLATS.x, 56, $t`SÅLD FÖR ${K.bud} KR – SÅDÄR.`, '#f4f1ea'); play('click'); }
      else { stats.fel++; streak = 0; pops.add(PLATS.x, 56, $t('BORTSLUMPAT!'), '#ff6a6a'); play('miss'); }
    } else { stats.miss++; streak = 0; pops.add(PLATS.x, 56, $t('GICK UTAN ATT KÖPA …'), '#ff6a6a'); play('miss'); }
  }
  function salt() { if (done || !kund || kund.st !== 'vantar') return null; avsluta('salt'); return 'salt'; }
  function pruta() {
    if (done || !kund || kund.st !== 'vantar') return null;
    const K = kund; K.prut++;
    if (rnd() < K.risk) { avsluta('gick'); return 'gick'; }
    K.bud = Math.min(K.sak.varde * 1.1, Math.round(K.bud * (1.15 + rnd() * 0.15) / 5) * 5); K.risk += 0.25; K.t = Math.max(K.t, 2.5);
    K.text = [$t('Hm … okej då.'), $t('Du är hård!'), $t('Sista budet.')][Math.min(2, K.prut - 1)]; K.textT = 1.6; play('click');
    return 'hojde';
  }
  function update(dt) {
    pops.update(dt);
    if (kund) {
      const K = kund;
      if (K.textT > 0) { K.textT -= dt; if (K.textT <= 0) K.text = null; }
      if (K.st === 'in') { K.k += dt * 2; if (K.k >= 1) { K.k = 1; K.st = 'vantar'; } }
      else if (K.st === 'salt' || K.st === 'gick') { K.k -= dt; if (K.k <= 0) { kund = null; nextT = gap(); } }
      else if (K.st === 'vantar' && !done) { K.t -= dt; if (K.t <= 0) avsluta('gick'); }
    }
    if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone?.({ ...stats }); } return; }
    t += dt;
    if (t >= DUR) { done = true; play('fanfare'); return; }
    if (auto && !kund && (nextT -= dt) <= 0) nyKund();
  }

  // ---------- bilden ----------
  const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
  const ikon = (ctx, s, x, y, sc = 1) => { s.ikon.forEach((r, j) => { for (let i = 0; i < 7; i++) { const c = s.pal[r[i]]; if (c != null) { ctx.fillStyle = css(c); ctx.fillRect(x + i * sc, y + j * sc, sc, sc); } } }); };
  let BG = null;
  function paintBg() {
    if (BG) return BG;
    const Pz = new Pix(FW, FH);
    // himlen, villan med det öppna garaget, uppfarten, gräs vid sidorna, borden med saker, skylten GARAGELOPPIS
    for (let y = 0; y < 56; y++) for (let x = 0; x < FW; x++) Pz.px(x, y, mix(0x7ab8e8, 0xd0e8f8, y / 56));
    for (const [cx, cy] of [[40, 12], [300, 18]]) { Pz.rect(cx, cy, 20, 5, 0xffffff); Pz.rect(cx + 4, cy - 2, 12, 2, 0xffffff); }
    for (let y = 24; y < 96; y++) for (let x = 90; x < 300; x++) Pz.px(x, y, mix(0xe8c0a0, 0xd8a888, ((y % 7) === 6 ? 0.6 : 0) + (hash(x >> 3, y >> 3, 3) - 0.5) * 0.1));   // rosa villan
    for (let j = 0; j < 12; j++) Pz.hl(84 + j, 12 + j, 222 - j * 2, j % 3 === 2 ? 0x8a3a2a : 0xa84c34);
    Pz.rect(110, 36, 22, 18, 0xf4f1ea); Pz.rect(111, 37, 20, 16, 0x8ab4d8); Pz.vl(121, 37, 16, 0xf4f1ea);
    Pz.rect(168, 40, 110, 56, 0x2a2a30); for (let y = 40; y < 96; y += 2) Pz.hl(168, y, 110, mix(0x2a2a30, 0x4a4a52, hash(1, y, 4) * 0.4));   // öppna garaget (mörkt inne)
    Pz.rect(168, 36, 110, 6, 0xf4f1ea); for (let x = 170; x < 278; x += 8) Pz.rect(x, 42, 6, 10, 0xe0dcd4);   // uppvikt port
    for (let k = 0; k < 6; k++) { const bx = 176 + k * 17; Pz.rect(bx, 70 + (k % 2) * 8, 12, 14, [0x8a6a40, 0x6a4a28][k % 2]); Pz.hl(bx, 70 + (k % 2) * 8, 12, 0xa88450); }   // kartonger
    for (let y = 56; y < FH; y++) for (let x = 0; x < FW; x++) { const upp = x >= 100 && x < 290; Pz.px(x, y, upp ? mix(0xb8b4ac, 0xa8a49c, hash(x >> 2, y >> 2, 5) * 0.6 + ((y % 12) === 11 ? 0.4 : 0)) : mix(0x4a8a3a, 0x6aa848, hash(x >> 1, y >> 1, 6) * 0.6)); }
    // borden med sakerna (till vänster och höger om kunden)
    for (const [bx, by, w] of [[14, 130, 110], [250, 130, 120]]) { Pz.rect(bx, by, w, 24, 0xf4f1ea); for (let y = by; y < by + 24; y += 6) for (let x = bx; x < bx + w; x += 6) if (((x / 6 + y / 6) | 0) & 1) Pz.rect(x, y, 6, 6, 0xe060a0); Pz.rect(bx - 2, by - 3, w + 4, 4, 0xa87848); Pz.rect(bx + 4, by + 24, 4, 12, 0x8a6236); Pz.rect(bx + w - 8, by + 24, 4, 12, 0x8a6236); }
    Pz.rect(0, 100, 0, 0, 0);
    const s = $t('GARAGELOPPIS'); Pz.rect(292, 100, textW(SMALL, s) + 10, 12, 0xf4f1ea); Pz.box(292, 100, textW(SMALL, s) + 10, 12, 0xd8343c); text(Pz, SMALL, s, 297, 103, 0xd8343c);
    Pz.rect(20, 100, 60, 3, 0xf0c030); for (let k = 0; k < 6; k++) Pz.rect(22 + k * 10, 103, 6, 6, [0xd8343c, 0x3a7bd5, 0xf0c030, 0x46a35a][k % 4]);   // vimplar
    for (let y = 176; y < FH; y++) Pz.hl(0, y, FW, 0x17151a);
    BG = Pz.flush(); return BG;
  }
  function drawBord(ctx) {
    SAKER.forEach((s, i) => { if (salda.includes(s.id) && (!kund || kund.sak.id !== s.id)) return; const bx = i < 4 ? 20 + i * 26 : 256 + (i - 4) * 28; ikon(ctx, s, bx, 112, 2); });
    const k = $t`KASSAN ${kassa} KR`; ctxText(ctx, SMALL, k, 8, 164, '#ffd23f');
  }
  function drawKund(ctx) {
    if (!kund) return;
    const K = kund, dy = K.st === 'in' ? Math.round((1 - K.k) * 40) : (K.st === 'gick' ? Math.round((1.3 - K.k) * 30) : 0);
    drawPerson(ctx, PLATS.x, PLATS.y - dy, K.look, 'down', K.st === 'salt' ? 10 : K.st === 'gick' ? 4 : 9);
    ikon(ctx, K.sak, PLATS.x + 8, PLATS.y - dy - 26, 2);   // saken i handen
    if (K.st !== 'vantar') return;
    // prislappen med riktvärdet (till vänster) och budet i bubblan (till höger)
    const r = $t`RIKTVÄRDE ${K.sak.varde} KR`, rw = textW(SMALL, r) + 10;
    ctx.fillStyle = '#ffe070'; ctx.fillRect(PLATS.x - 60 - rw, PLATS.y - 52, rw, 20); ctx.fillStyle = '#8a6a10'; ctx.fillRect(PLATS.x - 60 - rw, PLATS.y - 52, rw, 1); ctx.fillRect(PLATS.x - 60 - rw, PLATS.y - 33, rw, 1);
    ctxText(ctx, SMALL, K.sak.namn, PLATS.x - 60 - rw + 5, PLATS.y - 49, '#5a3a20'); ctxText(ctx, SMALL, r, PLATS.x - 60 - rw + 5, PLATS.y - 40, '#1c1a20');
    const b = K.text || $t`Jag ger ${K.bud} kr!`, w = textW(SMALL, b) + 10, x = PLATS.x + 24, y = PLATS.y - 62;
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x, y, w, 12); ctx.fillStyle = '#1c1a20'; ctx.fillRect(x - 1, y + 1, 1, 10); ctx.fillRect(x + w, y + 1, 1, 10); ctx.fillRect(x + 1, y - 1, w - 2, 1); ctx.fillRect(x + 1, y + 12, w - 2, 1);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 2, y + 8, 2, 2); ctx.fillRect(x - 4, y + 10, 2, 2);
    ctxText(ctx, SMALL, b, x + 5, y + 3, '#1c1a20');
    const bud = $t`BUD ${K.bud} KR · ${Math.round(K.bud / K.sak.varde * 100)} %`; ctxText(ctx, BIG, bud, PLATS.x + 24, y + 16, K.bud / K.sak.varde >= 0.8 ? '#8ae08a' : K.bud / K.sak.varde >= 0.5 ? '#ffd23f' : '#ff8a8a');
    const kk = Math.max(0, K.t / K.dur); ctx.fillStyle = '#2a2430'; ctx.fillRect(x, y + 30, 60, 3); ctx.fillStyle = kk > 0.5 ? '#46a35a' : kk > 0.25 ? '#f0c030' : '#e04848'; ctx.fillRect(x, y + 30, Math.round(60 * kk), 3);
    if (K.prut > 0) { ctxText(ctx, SMALL, $t`RISK ${Math.round(K.risk * 100)} %`, x + 66, y + 28, '#ff8a8a'); }
  }
  function drawKnappar(ctx) {
    const rita = (B, txt, nr, c, aktiv) => { ctx.fillStyle = aktiv ? '#2a2436' : '#1e1a26'; ctx.fillRect(B.x, B.y, B.w, B.h); ctx.fillStyle = aktiv ? c : '#3a3a42'; ctx.fillRect(B.x, B.y, B.w, 1); ctx.fillRect(B.x, B.y + B.h - 1, B.w, 1); ctx.fillRect(B.x, B.y, 1, B.h); ctx.fillRect(B.x + B.w - 1, B.y, 1, B.h); ctxText(ctx, BIG, txt, B.x + 12, B.y + 7, aktiv ? '#f4f1ea' : '#6a6a72'); ctxText(ctx, SMALL, nr, B.x + B.w - 8, B.y + 3, '#8a8a92'); };
    const aktiv = !!kund && kund.st === 'vantar';
    rita(KNAPP.salt, $t('SÅLT!'), '1', '#46a35a', aktiv); rita(KNAPP.pruta, $t('PRUTA'), '2', '#f0c030', aktiv);
    if (streak >= 2) { const s = $t`${streak} BRA AFFÄRER I RAD`; ctxText(ctx, SMALL, s, FW - textW(SMALL, s) - 8, 164, '#ffd23f'); }
    const h = $t('MINST 80 % AV RIKTVÄRDET = BRA AFFÄR · UNDER 50 % = BORTSLUMPAT'); ctxText(ctx, SMALL, h, (FW - textW(SMALL, h)) >> 1, 178, '#8a8a92');
  }
  function drawJag(ctx) {
    const look = A.avatar?.look || makeLook();
    drawPerson(ctx, 226, 168, look, 'up', kund && kund.st === 'vantar' ? 0 : 4);
  }

  return {
    get worldX() { return 226; }, get worldY() { return 168; },
    update,
    down(x, y) {
      if (done) return;
      if (x >= KNAPP.salt.x && x <= KNAPP.salt.x + KNAPP.salt.w && y >= KNAPP.salt.y - 2 && y <= KNAPP.salt.y + KNAPP.salt.h + 2) { salt(); return; }
      if (x >= KNAPP.pruta.x && x <= KNAPP.pruta.x + KNAPP.pruta.w && y >= KNAPP.pruta.y - 2 && y <= KNAPP.pruta.y + KNAPP.pruta.h + 2) { pruta(); return; }
    },
    key(k) {
      if (k === 'Escape' && !done) { abortShift(A); return; }
      if (k === '1' || k === ' ' || k === 'Enter') salt(); else if (k === '2') pruta();
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(paintBg(), 0, 0);
      drawBord(ctx);
      drawKund(ctx);
      drawJag(ctx);
      drawKnappar(ctx);
      pops.draw(ctx);
      drawShiftHud(ctx, A, { t, dur: DUR, ok: stats.ok, fel: stats.fel + stats.miss, title: $t('GARAGELOPPISEN') });
      if (done) { ctx.fillStyle = 'rgba(200,120,60,.45)'; ctx.fillRect(0, 0, FW, Math.min(FH, doneT * 300)); drawTimeUp(ctx, A); }
    },
    _debug: {
      stats,
      state: () => ({ t: +t.toFixed(2), done, stats: { ...stats }, streak, kassa, kund: kund ? { sak: kund.sak.id, varde: kund.sak.varde, bud: kund.bud, prut: kund.prut, risk: +kund.risk.toFixed(2), st: kund.st, t: +kund.t.toFixed(1) } : null }),
      force: (sakId, andel) => { if (kund) kund = null; nyKund(sakId, andel); if (kund) { kund.st = 'vantar'; kund.k = 1; } return kund ? { sak: kund.sak.id, bud: kund.bud } : null; },
      auto: (on) => { auto = !!on; },
      salt: () => salt(),
      pruta: () => pruta(),
      risk: (r) => { if (kund) kund.risk = r; },
      knapp: (id) => { const B = KNAPP[id]; return { x: B.x + (B.w >> 1), y: B.y + (B.h >> 1) }; },
      tick: (sec) => { for (let k = 0; k < sec * 30; k++) update(1 / 30); },
      finish: () => { t = DUR - 0.01; update(0.02); for (let k = 0; k < 60; k++) update(0.05); },
      time: () => t,
    },
  };
}
