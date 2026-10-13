// DJURKLINIKEN i Tassbacken – veterinären Vera (Carl 2026-10-12: "bygg allting inklusive stadsdelarna").
// 480 px bred mottagning som rullar med figuren. Från vänster: dörren UT, VÄNTRUMMET (stolar, en kund med
// en kattbur och papegojan Kakan i sin bur), VÅGEN på golvet, UNDERSÖKNINGSBORDET där Vera står,
// LJUSSKÅPET med röntgenbilden av en hund och MEDICINSKÅPET.
//
// Behandlingar (välj djur och behandling vid bordet): 🩺 HÄLSOKOLL, 💉 VACCINATION (räcker 60 dagar),
// ✂️ KLOKLIPPNING och 🦷 TANDBORSTNING. Djuret blir gladare, och ett djur som varit på hälsokoll eller
// vaccinerats den senaste veckan får extra poäng för hälsan på utställningen (utstallning.js showPoang
// läser pet.klinik). Vågen väger ett djur för skojs skull.
//
// _debug-API för tools/djurklinik-test.mjs.
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { fmt } from '../game.js';
import { createWalker, selfDrawable, folkDrawables, createSpeech } from './walkable.js';
import { drawPet, petBox } from '../pets/sprites.js';
import { petStore } from '../pets/sim.js';
import { $t } from '../core/i18n.js';
import { tavla, affisch, anslagstavla, vaggklocka, eluttag, brandslackare, dorrmatta, matta, lysror, ritaKrukvaxt, ritaPapperskorg, ritaVattenautomat, ritaLampsken } from '../tassbacken/inne-kit.js';   // 🧰 inredningen (v0.134)

const W = 480, H = 216, WALL_Y = 72;
const DOOR = { x0: 14, x1: 46 };
const STOLAR = { x0: 58, n: 3, y: 108 };
const BUR = { x: 150, y: 60 };                      // papegojans bur (hänger på väggen)
const VAG = { x: 196, y: 170 };
const BORD = { x: 296, y: 128 };
const LJUS = { x: 350, y: 14 };
const SKAP = { x0: 404, x1: 470 };
const VERA = { skin: '#e0a97f', hair: '#1d1714', style: 'ponytail', top: 'tee', shirt: '#7ab8e0', accent: '#7ab8e0', bottom: 'pants', pants: '#7ab8e0', shoes: '#f2f2f2', glasses: 'round', beard: false, phones: false, bag: null, hat: null, apron: true, build: 4, blush: false, kid: false };
export const BEHANDLINGAR = [
  { id: 'koll', icon: '🩺', namn: $t('Hälsokoll'), pris: 120, glad: 8, text: $t('Vera lyssnar på hjärtat, tittar i öronen och känner på magen.') },
  { id: 'vaccin', icon: '💉', namn: $t('Vaccination'), pris: 200, glad: 4, text: $t('Skyddar i 60 dagar. Ett litet stick – sen en godisbit!') },
  { id: 'klor', icon: '✂️', namn: $t('Kloklippning'), pris: 60, glad: 6, text: $t('Korta, fina klor – inga fler repor i soffan.') },
  { id: 'tander', icon: '🦷', namn: $t('Tandborstning'), pris: 80, glad: 6, text: $t('Blanka tänder och frisk andedräkt.') },
];
export const VACCIN_DAGAR = 60;
// klinikbesöket ger extra poäng för hälsan på utställningen i en vecka
export const klinikBonus = (pet, day) => (Number.isFinite(pet?.klinik) && day - pet.klinik <= 7 ? 4 : 0);
const VERA_SAY = [
  $t('Hej! Jag är Vera, veterinär. Klicka på undersökningsbordet så tittar vi på ditt djur.'),
  $t('Ett djur som varit på hälsokoll den senaste veckan får extra poäng för hälsan på utställningen!'),
  $t('Vaccinationen räcker i 60 dagar.'),
  $t('Kakan i buren pratar mer än alla mina patienter tillsammans.'),
];
const KAKAN = [$t('HEJ HEJ!'), $t('KAKAN VILL HA KAKA!'), $t('VOFF! … nej, MJAU!'), $t('DOKTORN KOMMER!')];

// ================= bakgrunden =================
let BG = null;
function paintBg() {
  const P = new Pix(W, H);
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < W; x++) P.px(x, y, mix(0xe8f4f8, 0xd8ecf2, ((x >> 4) & 1) * 0.3 + (bayer(x, y) - 0.5) * 0.1));
  for (let x = 0; x < W; x++) for (let y = WALL_Y - 14; y < WALL_Y; y++) P.px(x, y, y === WALL_Y - 14 ? 0x2a9a5a : y >= WALL_Y - 2 ? 0x8a929c : mix(0xc8e0d8, 0xb8d4cc, hash(x >> 2, y, 3) * 0.4));
  P.rect(0, 0, W, 3, 0x8a929c); P.hl(0, 3, W, 0xffffff);
  // dörren UT (glas)
  P.rect(DOOR.x0 - 3, 18, DOOR.x1 - DOOR.x0 + 6, WALL_Y - 18, 0x8a929c);
  for (let y = 20; y < WALL_Y; y++) for (let x = DOOR.x0; x < DOOR.x1; x++) P.px(x, y, mix(0xb8e0f0, 0x8ab8d8, (y - 20) / 52));
  P.vl(DOOR.x0 + 16, 20, WALL_Y - 20, 0x8a929c); P.rect(DOOR.x0 + 6, 44, 20, 9, 0x1d2b1f); text(P, SMALL, $t('UT'), DOOR.x0 + 12, 46, 0x6fe08a);
  // skyltarna och korset
  const kx = 250, ky = 8; P.rect(kx + 5, ky, 6, 16, 0x2a9a5a); P.rect(kx, ky + 5, 16, 6, 0x2a9a5a);
  for (const [dx, dy] of [[0, 1], [1, 1], [0, 2], [1, 2], [-1, 0], [2, 0], [-1, -2], [2, -2]]) P.px(kx + 7 + dx, ky + 7 + dy, 0xffffff);
  sign(P, $t('DJURKLINIKEN'), 196, 8, 0x2a9a5a, 0xffffff, true);
  sign(P, $t('VÄNTRUM'), 96, 24, 0x2a6a8a, 0xffffff);
  // ljusskåpet med röntgenbilden av en hund (ben i vitt mot blått)
  P.rect(LJUS.x - 2, LJUS.y - 2, 48, 34, 0x8a929c); P.rect(LJUS.x, LJUS.y, 44, 30, 0x2a4a7a);
  const BEN = ['............', '..#.....##..', '.###...####.', '#############', '.###########.', '..#..#..#..#.', '..#..#..#..#.', '.##.##.##.##.'];
  BEN.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') { P.px(LJUS.x + 8 + i * 2, LJUS.y + 6 + j * 2, 0xe8f0ff); P.px(LJUS.x + 9 + i * 2, LJUS.y + 6 + j * 2, 0xc8d8f8); } });
  // medicinskåpet: vitt med glasdörrar och flaskor
  P.rect(SKAP.x0, 10, SKAP.x1 - SKAP.x0, 50, 0xf4f6f8); P.box(SKAP.x0, 10, SKAP.x1 - SKAP.x0, 50, 0xa8b0bc);
  for (const sy of [24, 40]) P.hl(SKAP.x0 + 2, sy, SKAP.x1 - SKAP.x0 - 4, 0xa8b0bc);
  for (let i = 0; i < 9; i++) { const c = [0xd8343c, 0x3a7bd5, 0xf0b429, 0x46a35a, 0xa87ae8][i % 5], x = SKAP.x0 + 5 + (i % 5) * 12, y = i < 5 ? 15 : 31; P.rect(x, y, 5, 9, c); P.rect(x + 1, y - 2, 3, 2, 0xf4f1ea); }
  P.vl((SKAP.x0 + SKAP.x1) >> 1, 10, 50, 0xa8b0bc);
  // 🧰 mer på väggen (v0.134): lysrören, affischerna, väggklockan, bentavlan, anslagstavlan, brandsläckaren, eluttagen
  for (const lx of [80, 236, 400]) lysror(P, lx - 20, 4, 40);
  affisch(P, 54, 8, 18, 26, 'vaccin'); affisch(P, 116, 8, 18, 26, 'mat');
  vaggklocka(P, 196, 34, 6); tavla(P, 274, 12, 18, 14, 'ben', 0xd8ecf8, [0x8a929c, 0xa8b0bc, 0xc8ccd4, 0xe0e4ec, 0xf4f6f8]);
  anslagstavla(P, 298, 8, 44, 32, 3);
  brandslackare(P, 238, 56); eluttag(P, 130, 62); eluttag(P, 462, 62);
  // sidobordet med tidningar bredvid stolarna
  P.rect(126, 100, 16, 3, 0xc8ccd4); P.hl(126, 100, 16, 0xf4f6f8); P.vl(127, 103, 5, 0x8a929c); P.vl(140, 103, 5, 0x8a929c);
  P.rect(128, 97, 7, 3, 0xd8343c); P.rect(133, 96, 7, 3, 0x3a7bd5); P.hl(129, 98, 4, 0xffffff);
  // golvet: ljusa kakelplattor
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) { let c = (((x / 16) | 0) + (((y - WALL_Y) / 12) | 0)) % 2 ? 0xe8eef0 : 0xf4f8f8; if (x % 16 === 15 || (y - WALL_Y) % 12 === 11) c = mul(c, 0.9); P.px(x, y, c); }
  for (let i = 0; i < 5; i++) P.darken(0, WALL_Y + i, W, 1, 0.8 + i * 0.04);
  dorrmatta(P, DOOR.x0 - 4, 76, DOOR.x1 - DOOR.x0 + 8, 10, 0x6a8a9a, 0x4a6a7a);
  matta(P, 56, 116, 76, 30, 0xb8d4e8, 0xd8ecf8, 0x2a6a8a);
  for (let y = 120; y < 150; y++) for (let x = 426; x < 460; x++) P.px(x, y, x === 426 || x === 459 || y === 120 || y === 149 ? 0x8a929c : mix(0xf4c8d0, 0xe8b8c0, hash(x >> 1, y >> 1, 9) * 0.4));   // filten i hörnet
  return P.flush();
}
function sign(P, lbl, cx, y, bg, fg, big = false) {
  const F = big ? BIG : SMALL, tw = textW(F, lbl), w = tw + 10, x0 = Math.round(cx - w / 2), h = F.h + 5;
  P.rect(x0, y, w, h, bg); P.box(x0, y, w, h, mix(bg, 0xffffff, 0.3)); text(P, F, lbl, x0 + 5, y + 3, fg);
}

// ================= scenen =================
export function makeShopDjurklinik(A) {
  const g = A.game, S = petStore();
  if (!BG) BG = paintBg();
  let VW = 384;
  const syncView = () => { VW = Math.max(384, Math.min(A.W || 384, W)); };
  const walker = createWalker({ W, H, left: 6, right: W - 6, top: WALL_Y + 6, bottom: H - 4, spawn: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 12] });
  walker.speed = 72;
  walker.setObstacles([[STOLAR.x0, STOLAR.y - 10, STOLAR.x0 + STOLAR.n * 22, STOLAR.y + 2], [BORD.x - 22, BORD.y - 8, BORD.x + 22, BORD.y + 2], [SKAP.x0, WALL_Y, SKAP.x1, WALL_Y + 8],
    [124, 96, 142, 108], [142, 116, 154, 126], [458, 118, 474, 130], [354, 108, 366, 118], [64, 162, 92, 174]]);   // sidobordet, vattenautomaten, fikusen, papperskorgen, kunden med hunden
  walker.snapFree();
  let t = 0, hover = null, hoverT = 0, sayIdx = 0, greeted = false, kakIdx = 0, vag = null;
  let beh = null;   // { pet, b, t, klar }
  const talk = createSpeech();
  const vSay = (s, secs = 4) => talk.say(s, () => ({ x: BORD.x - 30, y: BORD.y - 40 }), secs, { voice: VERA });
  const camTarget = () => Math.max(0, Math.min(W - VW, walker.px - VW / 2));
  syncView();
  const cam = { x: camTarget() };
  const egna = () => (S.pets || []).filter((p) => p && p.species);
  const kund = { look: makeLook(() => hash(3, 4, 5)), katt: { id: 'kl-k', species: 'katt', breed: 'tigrerad', sex: 'hona', stage: 'vuxen', seed: 'klk' } };
  // 🩹 Nina, sköterskan, går med brickan mellan skåpet och bordet; en kund står och väntar med sin hund; en kattunge sover på filten
  const NINA = { skin: '#f0c8a8', hair: '#d8a040', style: 'bun', top: 'tee', shirt: '#7ab8e0', accent: '#7ab8e0', bottom: 'pants', pants: '#7ab8e0', shoes: '#f2f2f2', glasses: false, beard: false, phones: false, bag: null, hat: null, apron: true, build: 4, blush: true, kid: false };
  const NINAV = [[420, 150], [BORD.x + 40, BORD.y + 14], [200, 150], [BORD.x + 40, BORD.y + 14]];
  const nina = { x: 420, y: 150, i: 1, vila: 2, dir: 'left' };
  const rnd2 = (a, b) => a + Math.random() * (b - a);
  function updNina(dt) {
    if (nina.vila > 0) { nina.vila -= dt; return; }
    const [tx, ty] = NINAV[nina.i], dx = tx - nina.x, dy = ty - nina.y, d = Math.hypot(dx, dy), step = 22 * dt;
    if (Math.abs(dx) > 0.5) nina.dir = dx < 0 ? 'left' : 'right';
    if (d <= step) { nina.x = tx; nina.y = ty; nina.vila = rnd2(2, 5); nina.i = (nina.i + 1) % NINAV.length; return; }
    nina.x += dx / d * step; nina.y += dy / d * step;
  }
  const KUND2 = { look: makeLook(() => hash(7, 8, 9)), hund: { id: 'kl-h', species: 'hund', breed: 'tax', sex: 'hane', stage: 'vuxen', seed: 'klh' } };
  const UNGE = { id: 'kl-u', species: 'katt', breed: 'vit', sex: 'hona', stage: 'unge', seed: 'klu' };

  let valt = null;
  function oppna() {
    const djur = egna();
    if (!djur.length) { vSay($t('Du har inget djur än – men kom gärna och hälsa på Kakan!'), 3.5); return; }
    if (beh && !beh.klar) { vSay($t('Ett ögonblick, jag har en patient!'), 2.5); return; }
    if (!djur.some((p) => p.id === valt)) valt = (djur.find((p) => p.out) || djur[0]).id;
    play('click'); rita();
  }
  function rita() {
    const djur = egna(), pet = djur.find((p) => p.id === valt) || djur[0];
    const emo = { katt: '🐈', hund: '🐕', kanin: '🐇' };
    const vacc = Number.isFinite(pet.vacc) && g.day - pet.vacc < VACCIN_DAGAR;
    const valj = djur.length > 1 ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">${djur.map((p) => `<button class="btn btn-small ${p.id === pet.id ? 'btn-gold' : ''}" data-pet="${esc(p.id)}">${emo[p.species] || '🐾'} ${esc(p.name)}</button>`).join('')}</div>` : '';
    const rader = BEHANDLINGAR.map((b) => {
      const spar = b.id === 'vaccin' && vacc;
      return `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:20px">${b.icon}</span><span class="nm">${esc(b.namn)} <small class="sp">${fmt(b.pris)}</small><br><small class="sp">${spar ? $t`✓ Vaccinerad – skyddet räcker ${VACCIN_DAGAR - (g.day - pet.vacc)} dagar till` : esc(b.text)}</small></span><button class="btn btn-small btn-go" data-beh="${b.id}" ${spar || g.money < b.pris ? 'disabled' : ''}>${$t('Välj')}</button></div>`;
    }).join('');
    const dlg = openModal($t('🩺 Djurkliniken'), `${valj}<p style="font-size:var(--f2);margin-top:0">${$t`<b>${esc(pet.name)}</b> · 😊 ${Math.round(pet.happy || 0)} · 🍖 ${Math.round(pet.hunger || 0)}`}${vacc ? ` · 💉 ✓` : ''}</p><div class="plist">${rader}</div><p style="font-size:var(--f2);margin-bottom:0">${$t`💰 Du har <b>${fmt(g.money)}</b>`}</p>`, [{ label: $t('Stäng'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-pet]').forEach((b) => (b.onclick = () => { valt = b.dataset.pet; play('click'); rita(); }));
    dlg.querySelectorAll('[data-beh]').forEach((x) => (x.onclick = () => { const b = BEHANDLINGAR.find((q) => q.id === x.dataset.beh); if (!b || g.money < b.pris) return; g.money -= b.pris; g.save(); closeModal(); play('coin'); beh = { pet, b, t: 0, klar: false }; vSay($t`Upp på bordet, ${pet.name}! ${b.icon}`, 2); }));
  }
  function klart() {
    const { pet, b } = beh; beh.klar = true;
    const p = S.petById(pet.id) || pet;
    p.happy = Math.min(100, (+p.happy || 0) + b.glad);
    if (b.id === 'koll' || b.id === 'vaccin') p.klinik = g.day;
    if (b.id === 'vaccin') p.vacc = g.day;
    S.save();
    const h = g.glad?.(2, $t('Djurkliniken'), 'klinik', 3) || 0;
    g.save(); play('fanfare');
    const svar = { koll: $t`🩺 ${p.name} är frisk och glad! Hjärtat slår som det ska. (Extra hälsopoäng på utställningen i en vecka.)`, vaccin: $t`💉 ${p.name} är vaccinerad i ${VACCIN_DAGAR} dagar – och fick en godisbit.`, klor: $t`✂️ ${p.name} har korta, fina klor nu.`, tander: $t`🦷 ${p.name} har skinande rena tänder!` }[b.id];
    toast(svar + (h ? ` +${h} 😊` : ''), 'good wrap');
    vSay($t('Klart! Allt ser fint ut.'), 2.5);
  }
  function vaga() {
    const djur = egna();
    play('click');
    if (!djur.length) { vag = { txt: $t('0,0 KG'), t: 0 }; return; }
    const p = djur[(vag?.i ?? -1) + 1] || djur[0], i = djur.indexOf(p), b = petBox(p, 'idle', 'right');
    const kg = Math.max(0.8, (Math.abs(b.x1 - b.x0) * Math.abs(b.y0)) / (p.species === 'hund' ? 9 : p.species === 'katt' ? 30 : 45));
    vag = { txt: `${p.name.toUpperCase()}: ${kg.toFixed(1).replace('.', ',')} KG`, t: 0, i };
  }

  const spots = () => [
    { id: 'dorr', r: [DOOR.x0, 18, DOOR.x1, WALL_Y + 6], go: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 10], label: $t('UT'), act: () => { play('door'); A.tassFran = { klinik: true }; A.go('tassbacken'); } },
    { id: 'bord', r: [BORD.x - 24, BORD.y - 40, BORD.x + 24, BORD.y + 4], go: [BORD.x, BORD.y + 14], label: $t('UNDERSÖKNINGSBORDET'), act: oppna },
    { id: 'vera', r: [BORD.x - 42, BORD.y - 34, BORD.x - 24, BORD.y + 2], go: [BORD.x - 30, BORD.y + 14], label: $t('VETERINÄREN VERA'), act: () => vSay(VERA_SAY[sayIdx++ % VERA_SAY.length]) },
    { id: 'kakan', r: [BUR.x - 10, BUR.y - 26, BUR.x + 10, BUR.y + 2], go: [BUR.x, WALL_Y + 12], label: $t('PAPEGOJAN KAKAN'), act: () => { play('click'); talk.say(KAKAN[kakIdx++ % KAKAN.length], () => ({ x: BUR.x, y: BUR.y - 28 }), 2.4, { animal: true, silent: true }); } },
    { id: 'vag', r: [VAG.x - 12, VAG.y - 8, VAG.x + 12, VAG.y + 2], go: [VAG.x, VAG.y + 10], label: $t('VÅGEN'), act: vaga },
  ];
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const focusSpot = () => {
    const h = hover && t - hoverT < 4 && spotAt(hover.x, hover.y);
    if (h) return h;
    if (walker.path.length) return null;
    return spots().find((s) => s.id !== 'dorr' && Math.abs(walker.px - s.go[0]) < 7 && Math.abs(walker.py - s.go[1]) < 7) || null;
  };

  function drawBord(ctx) {
    const { x, y } = BORD;
    ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(x - 20, y - 1, 40, 3);
    ctx.fillStyle = '#8a929c'; ctx.fillRect(x - 2, y - 16, 4, 16); ctx.fillRect(x - 10, y - 2, 20, 2);
    ctx.fillStyle = '#c8ccd4'; ctx.fillRect(x - 20, y - 20, 40, 4); ctx.fillStyle = '#f4f6f8'; ctx.fillRect(x - 20, y - 20, 40, 1);
    if (beh) {
      const f = beh.t;
      drawPet(ctx, x - 2, y - 20, beh.pet, beh.klar ? 'happy' : f < 1 ? 'idle' : 'sit', t, 'right');
      if (!beh.klar && f > 0.8) { ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - 16, y - 32 + Math.round(Math.sin(t * 4) * 2), 8, 1); ctx.fillStyle = '#c8ccd4'; ctx.fillRect(x - 9, y - 33 + Math.round(Math.sin(t * 4) * 2), 3, 3); }   // stetoskopet
      if (beh.klar) for (let k = 0; k < 4; k++) { if (Math.sin(t * 6 + k * 2) < 0.2) continue; ctx.fillStyle = '#e8405a'; const hx = x - 4 + k * 4, hy = y - 40 - ((t * 10 + k * 5) % 14); ctx.fillRect(Math.round(hx), Math.round(hy), 3, 2); ctx.fillRect(Math.round(hx) + 1, Math.round(hy) + 2, 1, 1); }
    }
    drawPerson(ctx, x - 30, y + 2, VERA, 'right', beh && !beh.klar ? 9 : Math.sin(t * 1.7) > 0.93 ? 4 : 0);
  }
  function drawVantrum(ctx) {
    for (let i = 0; i < STOLAR.n; i++) { const x = STOLAR.x0 + i * 22; ctx.fillStyle = '#2a6a8a'; ctx.fillRect(x + 2, STOLAR.y - 18, 16, 8); ctx.fillRect(x + 2, STOLAR.y - 10, 16, 3); ctx.fillStyle = '#5a5e66'; ctx.fillRect(x + 3, STOLAR.y - 7, 2, 7); ctx.fillRect(x + 15, STOLAR.y - 7, 2, 7); }
    drawPerson(ctx, STOLAR.x0 + 32, STOLAR.y - 2, kund.look, 'down', 5);
    // kattburen bredvid kunden, katten tittar ut
    const bx = STOLAR.x0 + 50, by = STOLAR.y + 6;
    ctx.fillStyle = '#d8d4c8'; ctx.fillRect(bx, by - 12, 18, 12); ctx.fillStyle = '#8a867c'; ctx.fillRect(bx, by - 13, 18, 2);
    drawPet(ctx, bx + 9, by - 1, kund.katt, 'sit', t, 'down');
    ctx.fillStyle = '#8a867c'; for (let k = bx + 2; k < bx + 18; k += 3) ctx.fillRect(k, by - 11, 1, 10);
  }
  function drawBur(ctx) {
    const { x, y } = BUR;
    ctx.fillStyle = '#c8a040'; ctx.fillRect(x, y - 34, 1, 8);
    ctx.fillStyle = '#c8a040'; for (let i = -8; i <= 8; i += 3) ctx.fillRect(x + i, y - 24 + Math.abs(i) / 3, 1, 24 - Math.abs(i) / 3);
    ctx.fillRect(x - 9, y, 19, 2);
    // Kakan: grön papegoja med röd panna och gul näbb, gungar lite
    const s = Math.round(Math.sin(t * 2) * 1);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x - 5, y - 8, 10, 1);
    ctx.fillStyle = '#2aa84a'; ctx.fillRect(x - 2 + s, y - 16, 5, 8); ctx.fillStyle = '#1e8a3a'; ctx.fillRect(x + 1 + s, y - 13, 2, 6); ctx.fillStyle = '#d8343c'; ctx.fillRect(x - 2 + s, y - 17, 4, 2);
    ctx.fillStyle = '#f0c040'; ctx.fillRect(x - 3 + s, y - 15, 1, 2); ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 1 + s, y - 15, 1, 1); ctx.fillStyle = '#3a7bd5'; ctx.fillRect(x + s, y - 8, 2, 3);
  }
  function drawVag(ctx) {
    const { x, y } = VAG;
    ctx.fillStyle = '#8a929c'; ctx.fillRect(x - 12, y - 4, 24, 4); ctx.fillStyle = '#c8ccd4'; ctx.fillRect(x - 12, y - 4, 24, 1);
    ctx.fillStyle = '#2a3a3a'; ctx.fillRect(x - 6, y - 2, 12, 2);
    if (vag && vag.t < 4) { const w = textW(SMALL, vag.txt) + 8; ctx.fillStyle = 'rgba(20,30,30,.92)'; ctx.fillRect(x - w / 2, y - 22, w, 11); ctxText(ctx, SMALL, vag.txt, x - w / 2 + 4, y - 19, '#7ee07e'); }
  }
  function label(ctx, s, cx) {
    if (!s) return;
    const txt = s.label, w = textW(SMALL, txt) + 10, x = Math.round(Math.max(cx + 2, Math.min(cx + VW - w - 2, (s.r[0] + s.r[2]) / 2 - w / 2))), y = Math.max(2, s.r[1] - 13);
    ctx.fillStyle = 'rgba(20,40,40,.92)'; ctx.fillRect(x, y, w, 11); ctx.fillStyle = '#2a9a5a'; ctx.fillRect(x, y + 10, w, 1);
    ctxText(ctx, SMALL, txt, x + 5, y + 3, '#ffd23f');
  }

  return {
    viewMax: { w: W, h: H },
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    update(dt) {
      dt = Math.min(0.1, Math.max(0, dt));
      t += dt; syncView(); walker.update(dt);
      if (beh && !beh.klar) { beh.t += dt; if (beh.t > 3.2) klart(); }
      if (vag) vag.t += dt;
      updNina(dt);
      if (!greeted && t > 0.8) { greeted = true; vSay(VERA_SAY[0], 5); sayIdx = 1; }
      cam.x += (camTarget() - cam.x) * Math.min(1, dt * 6);
    },
    draw(ctx) {
      syncView();
      const cx = Math.round(cam.x);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(BG, cx, 0, VW, H, cx, 0, VW, H);
      const focus = focusSpot();
      ritaLampsken(ctx, [80, 236, 400], 8, '235,248,255');
      drawBur(ctx);
      const list = [...folkDrawables(A, t), selfDrawable(A, walker, t)];
      list.push({ fy: 126, draw: () => ritaVattenautomat(ctx, 148, 126) }, { fy: 128, draw: () => ritaKrukvaxt(ctx, 466, 128, 'ficus') }, { fy: 118, draw: () => ritaPapperskorg(ctx, 360, 118, 0x8a929c) });
      list.push({ fy: 142, draw: () => drawPet(ctx, 443, 142, UNGE, 'sleep', t, 'left') });
      list.push({ fy: 172, draw: () => { drawPerson(ctx, 72, 172, KUND2.look, 'right', Math.sin(t * 1.3) > 0.9 ? 4 : 0); drawPet(ctx, 88, 174, KUND2.hund, 'sit', t, 'right'); ctx.fillStyle = '#d8343c'; for (let k = 0; k <= 6; k++) ctx.fillRect(Math.round(75 + k * 2), Math.round(160 + Math.sin(k / 6 * Math.PI) * 3 + k), 1, 1); } });
      list.push({ fy: nina.y, draw: () => { drawPerson(ctx, nina.x, nina.y, NINA, nina.dir, nina.vila > 0 ? 9 : [7, 8, 7, 9][Math.floor(t * 7) % 4]); const hx = Math.round(nina.x) + (nina.dir === 'left' ? -8 : 1), hy = Math.round(nina.y) - 16; ctx.fillStyle = '#c8ccd4'; ctx.fillRect(hx, hy, 8, 2); ctx.fillStyle = '#d8343c'; ctx.fillRect(hx + 1, hy - 2, 2, 2); ctx.fillStyle = '#3a7bd5'; ctx.fillRect(hx + 5, hy - 2, 2, 2); } });
      list.push({ fy: STOLAR.y, draw: () => drawVantrum(ctx) });
      list.push({ fy: BORD.y, draw: () => drawBord(ctx) });
      list.push({ fy: VAG.y - 4, draw: () => drawVag(ctx) });
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
      act: (id) => { const s = spots().find((q) => q.id === id); if (!s) return false; s.act(); return true; },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); cam.x = camTarget(); },
      beh: () => (beh ? { id: beh.b.id, t: beh.t, klar: beh.klar, pet: beh.pet.id } : null),
      snabba: () => { if (beh && !beh.klar) beh.t = 3.19; },
      vag: () => vag?.txt ?? null,
      tova: () => talk.text?.() ?? null,
    },
  };
}
