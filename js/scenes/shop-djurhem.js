// TASSARNAS HEM – djurhemmet i Tassbacken (Carl 2026-10-12: "bygg allting inklusive stadsdelarna").
// 560 px bred lokal som rullar med figuren. Från vänster: dörren UT, RECEPTIONEN med Ingrid och
// insamlingsbössan, HUNDGÅRDARNA (fyra boxar med galler och namnskyltar), MATSTATIONEN, KATTRUMMET bakom
// glas (klösträd) och KANINHAGEN.
//
// Djuren här väntar på ett nytt hem. Klicka på ett djur: läs om det och ADOPTERA (300 kr, vaccinerat –
// det flyttar hem till dig som vuxet/ungt djur, inte som unge). HJÄLP TILL vid matstationen en gång om
// dagen (mata och ge vatten – en timme, gör en glad). Lägg pengar i INSAMLINGSBÖSSAN. Nya djur kommer
// varje vecka (urvalet byts per vecka, de man adopterat är borta).
//
// _debug-API för tools/djurhem-test.mjs. Sparas i g.djurhem = { adopterade: [id …], hjalp: dag, gav: dag }.
import { drawPerson } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { fmt } from '../game.js';
import { createWalker, selfDrawable, folkDrawables, createSpeech } from './walkable.js';
import { drawPet } from '../pets/sprites.js';
import { petStore, MAX_PETS } from '../pets/sim.js';
import { $t } from '../core/i18n.js';
import { tavla, affisch, anslagstavla, vaggklocka, hyllplan, burkrad, eluttag, brandslackare, dorrmatta, leksaker, ritaKrukvaxt, ritaPapperskorg, ritaVattenautomat, lysror, ritaLampsken } from '../tassbacken/inne-kit.js';   // 🧰 inredningen (v0.134)
import { propKit } from '../city/props.js';

const W = 560, H = 216, WALL_Y = 72;
const DOOR = { x0: 14, x1: 46 };
const DISK = { x: 58, y: 84, w: 70, h: 26 };
const BOXAR = { x0: 146, w: 50, n: 4, y: 108 };         // hundgårdarna (gallret framför i y)
const MAT = { x: 362, y: 104 };
const KATTRUM = { x0: 396, x1: 476, y: 112 };
const KANINHAGE = { x0: 488, x1: 552, y0: 150, y1: 200 };
export const ADOPTION = 300;
const INGRID = { skin: '#c68a5c', hair: '#3b2619', style: 'ponytail', top: 'hoodie', shirt: '#a8382a', accent: '#f4f1ea', bottom: 'jeans', pants: '#3f5f8f', shoes: '#6b3e1e', glasses: false, beard: false, phones: false, bag: null, hat: null, build: 5, blush: true, kid: false };
const INGRID_SAY = [
  $t('Hej och välkommen till Tassarnas hem! Alla djuren här väntar på någon som vill ta hand om dem.'),
  $t('Klicka på ett djur så berättar jag om det. Adoptionen kostar 300 kr – då är djuret vaccinerat och klart.'),
  $t('Vill du hjälpa till? Vid matstationen kan du mata djuren en gång om dagen.'),
  $t('Nya djur kommer hit varje vecka. Titta in igen!'),
  $t('Katterna på kattcaféet kommer också härifrån.'),
];
// djuren som kan bo här (urvalet för veckan väljs ur listan): art, ras, namn, kön, stadium, berättelse
const DJUR = [
  ['hund', 'blandras', 'Bamse', 'hane', 'vuxen', $t('Hittades i parken en regnig natt. Älskar att apportera och sover gärna i soffan.')],
  ['hund', 'labrador', 'Stina', 'hona', 'vuxen', $t('Lugn och snäll. Hennes förra matte flyttade utomlands.')],
  ['hund', 'tax', 'Gösta', 'hane', 'vuxen', $t('En gammal gentleman som gillar korta promenader och långa tupplurar.')],
  ['hund', 'jack', 'Pixie', 'hona', 'ung', $t('Full av energi! Behöver någon som orkar leka – mycket.')],
  ['hund', 'blandras', 'Ludde', 'hane', 'ung', $t('Lite blyg först, men sen världens bästa vän.')],
  ['hund', 'husky', 'Storm', 'hane', 'vuxen', $t('Pratar och ylar. Drömmer om snö.')],
  ['katt', 'tigrerad', 'Musse', 'hane', 'vuxen', $t('En riktig gårdskatt som vill bli innekatt på äldre dagar.')],
  ['katt', 'svart', 'Nova', 'hona', 'ung', $t('Smyger och leker. Har gula ögon som lyser i mörkret.')],
  ['katt', 'vit', 'Snöboll', 'hane', 'vuxen', $t('Mjuk som en kudde och lika lat.')],
  ['katt', 'skoldpadd', 'Fia', 'hona', 'vuxen', $t('Vet vad hon vill. Spinner högt när hon får sin vilja igenom.')],
  ['katt', 'smoking', 'Frasse', 'hane', 'ung', $t('Bär alltid smoking. Har ännu inte hittat festen.')],
  ['kanin', 'vadur', 'Hoppsan', 'hona', 'vuxen', $t('Hängöron och en liten nos som aldrig står still.')],
  ['kanin', 'brun', 'Kalle', 'hane', 'ung', $t('Gräver gärna. Älskar morötter mer än något annat.')],
  ['kanin', 'prickig', 'Prickan', 'hona', 'vuxen', $t('Har en prick på nosen och en i hjärtat för dig.')],
].map(([species, breed, namn, sex, stage, text], i) => ({ id: 'dh' + i, species, breed, namn, sex, stage, text }));

// veckans djur: fyra hundar, tre katter och två kaniner (byts varje vecka; adopterade är borta)
export function veckansDjur(day, adopterade = []) {
  const v = Math.floor(day / 7), ut = [];
  for (const [art, n] of [['hund', 4], ['katt', 3], ['kanin', 2]]) {
    const pool = DJUR.filter((d) => d.species === art).sort((a, b) => hash(+a.id.slice(2), v, 3) - hash(+b.id.slice(2), v, 3));
    ut.push(...pool.slice(0, n));
  }
  return ut.filter((d) => !adopterade.includes(d.id + ':' + Math.floor(day / 7)) && !adopterade.includes(d.id));
}

// ================= bakgrunden =================
let BG = null;
function paintBg() {
  const P = new Pix(W, H);
  // väggen: ljusgrön puts med vit list, tassar målade av barn längs nederkanten
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < W; x++) P.px(x, y, mix(0xd8ecd8, 0xc8e0c8, ((x >> 4) & 1) * 0.3 + (bayer(x, y) - 0.5) * 0.12));
  for (let x = 0; x < W; x++) for (let y = WALL_Y - 16; y < WALL_Y; y++) P.px(x, y, y === WALL_Y - 16 ? 0xf4f1ea : y >= WALL_Y - 2 ? 0x8a8a7a : mix(0xa8c8a8, 0x98b898, hash(x >> 2, y, 3) * 0.4));
  const TASS = ['.#.#.', '#...#', '.###.', '.###.'], TF = [0xd84a6a, 0x3a7bd5, 0xf0b429, 0x46a35a, 0x8e5bd1];
  for (let x = 8; x < W - 8; x += 15) TASS.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') P.px(x + i, WALL_Y - 12 + j + ((x / 15) & 1) * 2, TF[(x / 15 | 0) % TF.length]); });
  P.rect(0, 0, W, 3, 0x6a8a6a); P.hl(0, 3, W, 0xf4f1ea);
  // dörren UT
  P.rect(DOOR.x0 - 3, 18, DOOR.x1 - DOOR.x0 + 6, WALL_Y - 18, 0xf4f1ea);
  for (let y = 20; y < WALL_Y; y++) for (let x = DOOR.x0; x < DOOR.x1; x++) P.px(x, y, mix(0x3a6a4a, 0x2a5a3a, ((x - DOOR.x0) % 8 === 0 ? 0.6 : 0) + hash(x >> 2, y, 3) * 0.2));
  P.rect(DOOR.x0 + 6, 24, 20, 14, 0xb8e4f4); P.rect(DOOR.x0 + 6, 44, 20, 9, 0x1d2b1f); text(P, SMALL, $t('UT'), DOOR.x0 + 12, 46, 0x6fe08a);
  // anslagstavlan med bilder på djur som fått nya hem
  P.rect(DISK.x + 4, 12, 62, 30, 0xb07a48); P.rect(DISK.x + 6, 14, 58, 26, 0xd8b888);
  text(P, SMALL, $t('NYA HEM!'), DISK.x + 10, 16, 0xa8382a);
  for (let k = 0; k < 4; k++) { const x = DISK.x + 9 + k * 14, y = 24; P.rect(x, y, 11, 12, 0xf4f1ea); P.rect(x + 1, y + 1, 9, 7, [0xf4c8d0, 0xb8e0d0, 0xc8d4f4, 0xf8e4a0][k]); P.rect(x + 3, y + 4, 5, 4, [0x9a7650, 0x2a2630, 0xe2bc78, 0xf2efe8][k]); P.px(x + 4 + (k & 1), y + 2, 0xd8343c); }
  // skyltarna
  sign(P, $t('TASSARNAS HEM'), 280, 4, 0xa8382a, 0xf4f1ea, true);
  sign(P, $t('HUNDGÅRDARNA'), BOXAR.x0 + 100, 22, 0x3a6a4a, 0xf4f1ea);
  sign(P, $t('KATTRUMMET'), (KATTRUM.x0 + KATTRUM.x1) / 2, 22, 0x3a6a4a, 0xf4f1ea);
  // kattrummets glasvägg och klösträd (katterna ritas live)
  for (let y = 34; y < WALL_Y + 40; y++) for (let x = KATTRUM.x0; x < KATTRUM.x1; x++) { const kant = x === KATTRUM.x0 || x === KATTRUM.x1 - 1 || y === 34; P.px(x, y, kant ? 0xc8ccd4 : mix(0xe8f0e0, 0xd8e8d0, (y - 34) / 80), kant ? 1 : 0.9); }
  for (let x = KATTRUM.x0 + 6; x < KATTRUM.x1 - 6; x += 18) P.line(x, 38, x + 10, 60, 0xffffff, 0.5);
  // 🧰 mer på väggen (v0.134): lysrör i taket, efterlysningen, kopplen på krokar, hyllan med foder, tavlor över
  // kattrummet, adoptera-affischen, väggklockan, brandsläckaren och eluttagen
  for (const lx of [100, 250, 420]) lysror(P, lx - 20, 4, 40);
  affisch(P, 128, 10, 16, 30, 'hitta');
  P.rect(150, 36, 96, 2, 0xb07a48); P.hl(150, 36, 96, 0xd8a070);
  [0xd8343c, 0x3a7bd5, 0xf0c030, 0x46a35a, 0xa87ae8, 0xf07ab8].forEach((c, i) => { const hx = 156 + i * 15; P.px(hx, 38, 0x5a5e66); P.px(hx, 39, 0x8a929c); for (let j = 0; j < 20 + (i % 3) * 3; j++) P.px(hx + Math.round(Math.sin(j / 5 + i) * 1.5), 40 + j, j % 7 === 6 ? mul(c, 0.7) : c); P.rect(hx - 2, 58 + (i % 3) * 3, 5, 2, mul(c, 0.8)); });
  hyllplan(P, 258, 44, 84); burkrad(P, 262, 43, 5, 2); P.rect(300, 36, 9, 7, 0xc8a870); P.hl(300, 36, 9, 0xa88850); P.px(304, 39, 0xa8382a); P.rect(312, 37, 9, 6, 0xd8b888); P.hl(312, 37, 9, 0xb89868);
  hyllplan(P, 258, 60, 84); for (let i = 0; i < 4; i++) { const c = [0xd8343c, 0x3a7bd5, 0x46a35a, 0xf0c030][i]; P.rect(262 + i * 20, 56, 12, 4, c); P.hl(263 + i * 20, 56, 10, mix(c, 0xffffff, 0.4)); P.hl(264 + i * 20, 57, 8, 0xf0d8a0); }
  tavla(P, 400, 8, 14, 12, 'katt', 0xf4c8d0); tavla(P, 418, 6, 12, 10, 'tass', 0xf8e4a0); tavla(P, 458, 8, 14, 12, 'hjarta', 0xf4f1ea, 0xf4f1ea);
  affisch(P, 484, 10, 26, 36, 'adoptera'); vaggklocka(P, 532, 22, 7); affisch(P, 520, 36, 28, 22, 'vaccin');
  brandslackare(P, 52, 60); eluttag(P, 250, 62); eluttag(P, 480, 64);
  // golvet: linoleum i rutor (lätt att städa), gröna och vita
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    const tx = (x / 20) | 0, ty = ((y - WALL_Y) / 12) | 0;
    let c = (tx + ty) % 2 ? 0xd0e4c8 : 0xe8f0e0;
    if (x % 20 === 19 || (y - WALL_Y) % 12 === 11) c = mul(c, 0.9);
    P.px(x, y, c);
  }
  for (let i = 0; i < 5; i++) P.darken(0, WALL_Y + i, W, 1, 0.8 + i * 0.04);
  dorrmatta(P, DOOR.x0 - 4, 76, DOOR.x1 - DOOR.x0 + 8, 10, 0x6a8a6a, 0x4a6a4a);
  leksaker(P, [[226, 132, 'ben'], [300, 146, 'boll'], [440, 128, 'mus'], [72, 190, 'boll'], [250, 200, 'ben']]);
  for (let y = 150; y < 200; y++) for (let x = 60; x < 130; x++) { const e = x === 60 || x === 129 || y === 150 || y === 199; P.px(x, y, e ? 0x3a6a4a : (((y - 150) >> 2) & 1) ? mix(0xa8c8a8, 0x98b898, hash(x >> 2, y, 6) * 0.4) : mix(0xe0ecd8, 0xd0dcc8, hash(x >> 2, y, 7) * 0.4)); }   // mattan i hörnet
  for (let y = KANINHAGE.y0 - 2; y < KANINHAGE.y1; y++) for (let x = 464; x < 486; x++) P.px(x, y, mix(0xe8c870, 0xd8b860, hash(x, y, 8)));   // höet utanför hagen
  // kaninhagens halm
  for (let y = KANINHAGE.y0; y < KANINHAGE.y1; y++) for (let x = KANINHAGE.x0; x < KANINHAGE.x1; x++) P.px(x, y, mix(0xe8c870, 0xd8b860, hash(x, y, 8)));
  P.box(0, 0, W, H, 0x0e0d12);
  return P.flush();
}
function sign(P, lbl, cx, y, bg, fg, big = false) {
  const F = big ? BIG : SMALL, tw = textW(F, lbl), w = tw + 10, x0 = Math.round(cx - w / 2), h = F.h + 5;
  P.rect(x0, y, w, h, bg); P.box(x0, y, w, h, mix(bg, 0xffffff, 0.3)); P.hl(x0, y + h, w, 0x000000, 0.3);
  text(P, F, lbl, x0 + 5, y + 3, fg);
}

// ================= scenen =================
export function makeShopDjurhem(A) {
  const g = A.game, S = petStore();
  g.djurhem ||= { adopterade: [], hjalp: -1, gav: -1 };
  if (!BG) BG = paintBg();
  let VW = 384;
  const syncView = () => { VW = Math.max(384, Math.min(A.W || 384, W)); };
  const walker = createWalker({ W, H, left: 6, right: W - 6, top: WALL_Y + 6, bottom: H - 4, spawn: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 12] });
  walker.speed = 72;
  walker.setObstacles([
    [DISK.x, DISK.y, DISK.x + DISK.w, DISK.y + DISK.h],
    [BOXAR.x0, WALL_Y, BOXAR.x0 + BOXAR.n * BOXAR.w, BOXAR.y + 2],
    [MAT.x - 14, MAT.y - 8, MAT.x + 14, MAT.y + 2],
    [KATTRUM.x0, WALL_Y, KATTRUM.x1, KATTRUM.y + 2],
    [KANINHAGE.x0, KANINHAGE.y0 - 4, KANINHAGE.x1, KANINHAGE.y1 + 2],
    [540, 108, 556, 122], [130, 118, 144, 126], [60, 116, 72, 124], [84, 160, 116, 168], [464, 186, 486, 200],   // palmen, papperskorgen, vattenautomaten, bänken, höbalen
  ]);
  walker.snapFree();
  let t = 0, hover = null, hoverT = 0, sayIdx = 0, greeted = false;
  const talk = createSpeech();
  const iSay = (s, secs = 4) => talk.say(s, () => ({ x: DISK.x + 32, y: DISK.y - 30 }), secs, { voice: INGRID });
  const camTarget = () => Math.max(0, Math.min(W - VW, walker.px - VW / 2));
  syncView();
  const cam = { x: camTarget() };

  // ---------- djuren ----------
  const vecka = () => Math.floor(g.day / 7);
  const har = () => veckansDjur(g.day, g.djurhem.adopterade);
  const rnd = (a, b) => a + Math.random() * (b - a);
  // var varje djur bor: hundarna i varsin box, katterna i kattrummet, kaninerna i hagen
  const lage = new Map();
  function placera() {
    let h = 0, k = 0, r = 0;
    for (const d of har()) {
      if (lage.has(d.id)) continue;
      if (d.species === 'hund') lage.set(d.id, { x: BOXAR.x0 + (h++) * BOXAR.w + BOXAR.w / 2, y: BOXAR.y - 8, box: true, dir: h % 2 ? 'left' : 'right' });
      else if (d.species === 'katt') lage.set(d.id, { x: KATTRUM.x0 + 16 + (k++) * 24, y: KATTRUM.y - 6 - (k === 2 ? 24 : 0), dir: 'down' });
      else lage.set(d.id, { x: KANINHAGE.x0 + 16 + (r++) * 24, y: KANINHAGE.y0 + 22 + (r % 2) * 10, dir: r % 2 ? 'left' : 'right', hage: true });
    }
  }
  placera();
  const petOf = (d) => ({ id: 'dhp-' + d.id, name: d.namn, species: d.species, breed: d.breed, sex: d.sex, stage: d.stage, seed: d.id });
  const djurAt = (x, y) => har().find((d) => { const L = lage.get(d.id); return L && Math.abs(L.x - x) < 12 && y < L.y + 4 && y > L.y - 20; });
  function visa(d) {
    play('click');
    const L = lage.get(d.id);
    talk.say(d.species === 'hund' ? $t('VOFF! 🐕') : d.species === 'katt' ? $t('Mjau!') : $t('*nos-nos*'), () => ({ x: L.x, y: L.y - 22 }), 2, { animal: true, silent: true });
    const emo = { hund: '🐕', katt: '🐈', kanin: '🐇' }, alder = d.stage === 'ung' ? $t('ung') : $t('vuxen'), kon = d.sex === 'hona' ? $t('hona') : $t('hane');
    const fullt = S.pets.length >= MAX_PETS;
    const dlg = openModal(`${emo[d.species]} ${esc(d.namn)}`, `<div class="fd"><canvas class="fd-big" width="96" height="56"></canvas><div class="fd-side" style="font-size:var(--f2)"><b>${esc(d.namn)}</b><span>${esc(alder)} · ${esc(kon)}</span></div></div>
      <p style="font-size:var(--f2);margin:0">${esc(d.text)}</p>
      <p style="font-size:var(--f2)">${$t`💉 Vaccinerad och chippad · Adoption <b>${fmt(ADOPTION)}</b> · 💰 Du har <b>${fmt(g.money)}</b>`}${fullt ? `<br><span class="bad">${$t`Du har redan ${MAX_PETS} djur – fler får inte plats.`}</span>` : ''}</p>`, [
      { label: $t`🏡 Adoptera ${d.namn} · ${fmt(ADOPTION)}`, cls: 'btn-go', disabled: fullt || g.money < ADOPTION, onClick: () => adoptera(d) },
      { label: $t('Inte nu'), onClick: closeModal },
    ]);
    const c = dlg.querySelector('.fd-big').getContext('2d');
    c.fillStyle = '#e8f0e0'; c.fillRect(0, 0, 96, 56); c.fillStyle = '#d0e4c8'; c.fillRect(0, 44, 96, 12);
    drawPet(c, 34, 50, petOf(d), 'idle', 0, 'right'); drawPet(c, 70, 50, petOf(d), 'sit', 0.5, 'down');
  }
  function adoptera(d) {
    if (S.pets.length >= MAX_PETS) { toast($t`Du kan ha högst ${MAX_PETS} djur.`, 'bad'); return; }
    if (g.money < ADOPTION) { toast($t('Du har inte råd med adoptionen.'), 'bad'); play('fel'); return; }
    const p = S.adopt(d.species, d.breed, d.sex, d.namn, g.home, { day: g.day, stage: d.stage });
    if (!p) { toast(S.lastError || $t('Det gick inte att adoptera.'), 'bad'); return; }
    g.money -= ADOPTION;
    g.djurhem.adopterade.push(d.id + ':' + vecka());
    lage.delete(d.id);
    const h = g.glad?.(12, $t('Du adopterade ett djur'), 'adoption', 12) || 0;
    g.save();
    closeModal(); play('fanfare');
    const han = d.sex === 'hona' ? $t('Hon') : $t('Han');
    toast($t`🏡 ${d.namn} har fått ett nytt hem – hos dig! ${han} väntar hemma.` + (h ? ` +${h} 😊` : ''), 'good wrap');
    iSay($t`Tack! ${d.namn} kommer att trivas hos dig. ❤️`, 3.5);
  }
  function hjalp() {
    if (g.djurhem.hjalp === g.day) { iSay($t('Du har redan hjälpt till i dag – tack! Kom tillbaka i morgon.'), 3); return; }
    g.djurhem.hjalp = g.day;
    g.passTime(60);
    const h = g.glad?.(5, $t('Du hjälpte till på djurhemmet'), 'djurhemhjalp', 5) || 0;
    g.save(); play('ok');
    mattider = 4;
    toast($t('🥣 Du fyllde matskålarna och vattnet åt alla djuren. De viftar och spinner av tacksamhet!') + (h ? ` +${h} 😊` : ''), 'good');
  }
  let mattider = 0;
  function bossan() {
    play('click');
    const dlg = openModal($t('🪙 Insamlingsbössan'), `<p style="font-size:var(--f2);margin-top:0">${$t('Pengarna går till mat, filtar och veterinärbesök åt djuren som väntar på ett hem.')}</p>`, [
      ...[20, 50, 100].map((n) => ({ label: $t`Ge ${fmt(n)}`, cls: n === 50 ? 'btn-go' : '', disabled: g.money < n, onClick: () => ge(n) })),
      { label: $t('Inte nu'), onClick: closeModal },
    ]);
    void dlg;
  }
  function ge(n) {
    if (g.money < n) return;
    g.money -= n;
    const forst = g.djurhem.gav !== g.day; g.djurhem.gav = g.day;
    const h = forst ? g.glad?.(n >= 100 ? 5 : n >= 50 ? 3 : 2, $t('Du skänkte pengar till djurhemmet'), 'djurhemgava', 5) || 0 : 0;
    g.save(); closeModal(); play('coin');
    toast($t`🪙 Tack för ${fmt(n)}! Djuren får det lite bättre i dag.` + (h ? ` +${h} 😊` : ''), 'good');
  }

  // 🧹 Olle, volontären: går runt med hinken mellan hundgårdarna och matstationen
  const OLLE = { skin: '#c68a5c', hair: '#8a5a3a', style: 'short', top: 'tee', shirt: '#3a6a4a', accent: '#f4f1ea', bottom: 'jeans', pants: '#3f5f8f', shoes: '#6b3e1e', glasses: false, beard: 'short', phones: false, bag: null, hat: 'cap', cap: '#a8382a', build: 5, blush: false, kid: false };
  const OLLEV = [[160, 128], [330, 128], [MAT.x - 20, MAT.y + 10], [330, 128]];
  const olle = { x: 160, y: 128, i: 1, vila: 3, dir: 'right' };
  function updOlle(dt) {
    if (olle.vila > 0) { olle.vila -= dt; return; }
    const [tx, ty] = OLLEV[olle.i], dx = tx - olle.x, dy = ty - olle.y, d = Math.hypot(dx, dy), step = 22 * dt;
    if (Math.abs(dx) > 0.5) olle.dir = dx < 0 ? 'left' : 'right';
    if (d <= step) { olle.x = tx; olle.y = ty; olle.vila = rnd(2, 5); olle.i = (olle.i + 1) % OLLEV.length; return; }
    olle.x += dx / d * step; olle.y += dy / d * step;
  }
  function drawOlle(ctx) {
    drawPerson(ctx, olle.x, olle.y, OLLE, olle.dir, olle.vila > 0 ? 9 : [7, 8, 7, 9][Math.floor(t * 7) % 4]);
    const hx = Math.round(olle.x) + (olle.dir === 'left' ? -7 : 2), hy = Math.round(olle.y) - 14;   // hinken i handen
    ctx.fillStyle = '#3a7bd5'; ctx.fillRect(hx, hy, 6, 6); ctx.fillStyle = '#6aa8e8'; ctx.fillRect(hx, hy, 6, 1); ctx.fillStyle = '#8a929c'; ctx.fillRect(hx + 1, hy - 2, 1, 2); ctx.fillRect(hx + 4, hy - 2, 1, 2); ctx.fillRect(hx + 2, hy - 3, 2, 1);
  }
  const KIT = propKit();
  const SOVHUND = { id: 'dh-sov', name: 'Bruno', species: 'hund', breed: 'husky', sex: 'hane', stage: 'vuxen', seed: 'dhsov' };

  // ---------- platserna ----------
  const spots = () => [
    { id: 'dorr', r: [DOOR.x0, 18, DOOR.x1, WALL_Y + 6], go: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 10], label: $t('UT'), act: () => { play('door'); A.tassFran = { hem: true }; A.go('tassbacken'); } },
    { id: 'ingrid', r: [DISK.x + 18, DISK.y - 34, DISK.x + 44, DISK.y + 6], go: [DISK.x + 30, DISK.y + DISK.h + 10], label: $t('INGRID'), act: () => iSay(INGRID_SAY[sayIdx++ % INGRID_SAY.length]) },
    { id: 'bossa', r: [DISK.x + 52, DISK.y - 8, DISK.x + 66, DISK.y + 8], go: [DISK.x + 58, DISK.y + DISK.h + 10], label: $t('INSAMLINGSBÖSSAN'), act: bossan },
    { id: 'mat', r: [MAT.x - 16, MAT.y - 24, MAT.x + 16, MAT.y + 2], go: [MAT.x, MAT.y + 12], label: g.djurhem.hjalp === g.day ? $t('MATSTATIONEN – KLART FÖR I DAG') : $t('MATSTATIONEN – HJÄLP TILL'), act: hjalp },
  ];
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const focusSpot = () => {
    const h = hover && t - hoverT < 4 && spotAt(hover.x, hover.y);
    if (h) return h;
    if (walker.path.length) return null;
    return spots().find((s) => s.id !== 'dorr' && Math.abs(walker.px - s.go[0]) < 7 && Math.abs(walker.py - s.go[1]) < 7) || null;
  };

  // ---------- ritning ----------
  function drawDisk(ctx) {
    drawPerson(ctx, DISK.x + 30, DISK.y + 12, INGRID, 'down', Math.sin(t * 1.5) > 0.93 ? 4 : 0);
    const d = DISK;
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(d.x, d.y + 6, d.w, d.h - 6); ctx.fillStyle = '#a8382a'; ctx.fillRect(d.x, d.y + 6, d.w, 2); ctx.fillStyle = '#e0dcd4'; ctx.fillRect(d.x + 2, d.y + 12, d.w - 4, 1);
    for (let k = 0; k < 3; k++) { ctx.fillStyle = '#a8382a'; ctx.fillRect(d.x + 10 + k * 16, d.y + 16, 2, 2); ctx.fillRect(d.x + 13 + k * 16, d.y + 16, 2, 2); ctx.fillRect(d.x + 10 + k * 16, d.y + 19, 5, 3); }
    // insamlingsbössan
    ctx.fillStyle = '#d8343c'; ctx.fillRect(d.x + 54, d.y - 4, 10, 10); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(d.x + 55, d.y - 2, 8, 2); ctx.fillStyle = '#1e1a24'; ctx.fillRect(d.x + 57, d.y - 4, 4, 1);
    ctx.fillStyle = '#f0c040'; ctx.fillRect(d.x + 57, d.y + 2, 4, 2);
  }
  function drawBoxar(ctx) {
    const hundar = har().filter((d) => d.species === 'hund');
    for (let i = 0; i < BOXAR.n; i++) {
      const x = BOXAR.x0 + i * BOXAR.w, y = BOXAR.y, d = hundar[i];
      ctx.fillStyle = '#c8b890'; ctx.fillRect(x + 2, WALL_Y, BOXAR.w - 4, y - WALL_Y);                      // golvet i boxen
      ctx.fillStyle = '#a89870'; for (let yy = WALL_Y + 4; yy < y; yy += 6) ctx.fillRect(x + 2, yy, BOXAR.w - 4, 1);
      ctx.fillStyle = '#8a5a30'; ctx.fillRect(x + 6, y - 14, 14, 6); ctx.fillStyle = '#d84a6a'; ctx.fillRect(x + 8, y - 15, 10, 2);   // bädden
      ctx.fillStyle = '#3a7bd5'; ctx.fillRect(x + BOXAR.w - 14, y - 6, 7, 3);                              // vattenskålen
      if (d) { const L = lage.get(d.id); drawPet(ctx, L.x, L.y, petOf(d), mattider > 0 ? 'eat' : Math.sin(t * 0.7 + i * 2) > 0.3 ? 'happy' : 'sit', t, L.dir); }
      // gallret framför
      ctx.fillStyle = '#8a929c'; for (let gx = x + 2; gx < x + BOXAR.w - 2; gx += 4) ctx.fillRect(gx, WALL_Y + 2, 1, y - WALL_Y - 2);
      ctx.fillStyle = '#5a5e66'; ctx.fillRect(x, WALL_Y, 2, y - WALL_Y + 2); ctx.fillRect(x, y, BOXAR.w, 2); ctx.fillRect(x, WALL_Y + 14, BOXAR.w, 1);
      // namnskylten
      const n = d ? d.namn.toUpperCase() : $t('LEDIG'), tw = textW(SMALL, n) + 6;
      ctx.fillStyle = d ? '#f4f1ea' : '#c8ccd4'; ctx.fillRect(x + BOXAR.w / 2 - tw / 2, y - 30, tw, 8); ctxText(ctx, SMALL, n, x + BOXAR.w / 2 - tw / 2 + 3, y - 29, '#1e1a24');
    }
  }
  function drawKattrum(ctx) {
    const katter = har().filter((d) => d.species === 'katt');
    // klösträdet i rummet
    const tx = KATTRUM.x0 + 46;
    ctx.fillStyle = '#d8c49a'; ctx.fillRect(tx - 2, KATTRUM.y - 30, 4, 30); ctx.fillStyle = '#8a5a8a'; ctx.fillRect(tx - 10, KATTRUM.y - 30, 20, 3); ctx.fillRect(tx - 12, KATTRUM.y - 2, 24, 3);
    ctx.fillStyle = '#f06aa0'; ctx.fillRect(KATTRUM.x0 + 8, KATTRUM.y - 8, 14, 5); ctx.fillStyle = '#ffb0d0'; ctx.fillRect(KATTRUM.x0 + 8, KATTRUM.y - 8, 14, 1);   // kudden
    ctx.fillStyle = '#3a7bd5'; ctx.fillRect(KATTRUM.x1 - 22, KATTRUM.y - 6, 10, 4); ctx.fillStyle = '#8ad8ff'; ctx.fillRect(KATTRUM.x1 - 22, KATTRUM.y - 6, 10, 1);   // skålen
    ctx.fillStyle = '#9a9aa4'; ctx.fillRect(KATTRUM.x0 + 30, KATTRUM.y - 4, 5, 3); ctx.fillStyle = '#f0a0b0'; ctx.fillRect(KATTRUM.x0 + 35, KATTRUM.y - 3, 1, 1);   // leksaksmusen
    for (const d of katter) { const L = lage.get(d.id); drawPet(ctx, L.x, L.y, petOf(d), mattider > 0 ? 'eat' : Math.sin(t * 0.5 + L.x) > 0 ? 'sit' : 'sleep', t, L.dir); }
    ctx.fillStyle = 'rgba(220,236,248,.25)'; ctx.fillRect(KATTRUM.x0, WALL_Y, KATTRUM.x1 - KATTRUM.x0, KATTRUM.y - WALL_Y);
    ctx.fillStyle = '#c8ccd4'; ctx.fillRect(KATTRUM.x0, KATTRUM.y, KATTRUM.x1 - KATTRUM.x0, 2); ctx.fillRect(KATTRUM.x0, WALL_Y, 2, KATTRUM.y - WALL_Y); ctx.fillRect(KATTRUM.x1 - 2, WALL_Y, 2, KATTRUM.y - WALL_Y);
  }
  function drawHage(ctx, fram) {
    const { x0, x1, y0, y1 } = KANINHAGE;
    const rail = (y) => { for (let x = x0; x < x1; x += 3) { ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x, y - 8, 2, 8); } ctx.fillStyle = '#c8c4b8'; ctx.fillRect(x0, y - 6, x1 - x0, 1); };
    if (!fram) { rail(y0); return; }
    for (const d of har().filter((q) => q.species === 'kanin')) { const L = lage.get(d.id); drawPet(ctx, L.x, L.y, petOf(d), mattider > 0 ? 'eat' : 'idle', t, L.dir); }
    rail(y1);
  }
  function drawMat(ctx) {
    const { x, y } = MAT;
    ctx.fillStyle = 'rgba(20,12,30,.22)'; ctx.fillRect(x - 14, y - 1, 28, 3);
    ctx.fillStyle = '#c8a870'; ctx.fillRect(x - 13, y - 16, 10, 16); ctx.fillStyle = '#a88850'; ctx.fillRect(x - 13, y - 16, 10, 2); ctx.fillStyle = '#a8382a'; for (const [dx, dy] of [[0, 1], [1, 1], [0, 2], [1, 2], [-1, 0], [2, 0]]) ctx.fillRect(x - 8 + dx, y - 9 + dy, 1, 1);   // tassen på säcken
    ctx.fillStyle = '#d8b888'; ctx.fillRect(x + 2, y - 13, 10, 13); ctx.fillStyle = '#b89868'; ctx.fillRect(x + 2, y - 13, 10, 2);
    for (let k = 0; k < 3; k++) { ctx.fillStyle = ['#3a7bd5', '#d8343c', '#46a35a'][k]; ctx.fillRect(x - 12 + k * 9, y + 2, 7, 3); }
  }
  function label(ctx, s, cx) {
    if (!s) return;
    const txt = s.label, w = textW(SMALL, txt) + 10, x = Math.round(Math.max(cx + 2, Math.min(cx + VW - w - 2, (s.r[0] + s.r[2]) / 2 - w / 2))), y = Math.max(2, s.r[1] - 13);
    ctx.fillStyle = 'rgba(30,40,30,.92)'; ctx.fillRect(x, y, w, 11); ctx.fillStyle = '#a8382a'; ctx.fillRect(x, y + 10, w, 1);
    ctxText(ctx, SMALL, txt, x + 5, y + 3, '#ffd23f');
  }

  return {
    viewMax: { w: W, h: H },
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    update(dt) {
      dt = Math.min(0.1, Math.max(0, dt));
      t += dt; syncView(); walker.update(dt);
      if (mattider > 0) mattider -= dt;
      updOlle(dt);
      // kaninerna skuttar runt i hagen
      for (const d of har()) { const L = lage.get(d.id); if (!L?.hage) continue; L.tm = (L.tm ?? rnd(1, 4)) - dt; if (L.tm <= 0) { L.tm = rnd(2, 5); L.x = Math.max(KANINHAGE.x0 + 8, Math.min(KANINHAGE.x1 - 8, L.x + rnd(-14, 14))); L.dir = Math.random() < 0.5 ? 'left' : 'right'; } }
      if (!greeted && t > 0.8) { greeted = true; iSay(INGRID_SAY[0], 5); sayIdx = 1; }
      cam.x += (camTarget() - cam.x) * Math.min(1, dt * 6);
    },
    draw(ctx) {
      syncView();
      const cx = Math.round(cam.x);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(BG, cx, 0, VW, H, cx, 0, VW, H);
      ritaLampsken(ctx, [100, 250, 420], 8, '240,250,255');
      const focus = focusSpot();
      drawBoxar(ctx); drawKattrum(ctx);
      const list = [...folkDrawables(A, t), selfDrawable(A, walker, t)];
      list.push({ fy: DISK.y + DISK.h, draw: () => drawDisk(ctx) });
      list.push({ fy: MAT.y, draw: () => drawMat(ctx) });
      list.push({ fy: 122, draw: () => ritaKrukvaxt(ctx, 548, 122, 'palm') }, { fy: 126, draw: () => ritaPapperskorg(ctx, 137, 126, 0x3a6a4a) }, { fy: 124, draw: () => ritaVattenautomat(ctx, 66, 124) });
      list.push({ fy: 168, draw: () => KIT.bench(ctx, 100, 168) }, { fy: 200, draw: () => { ctx.fillStyle = '#d8b860'; ctx.fillRect(464, 186, 22, 14); ctx.fillStyle = '#e8c870'; ctx.fillRect(464, 186, 22, 2); ctx.fillStyle = '#b89848'; ctx.fillRect(464, 192, 22, 1); ctx.fillRect(464, 197, 22, 1); } });
      list.push({ fy: 198, draw: () => drawPet(ctx, 96, 198, SOVHUND, 'sleep', t, 'right') });
      list.push({ fy: olle.y, draw: () => drawOlle(ctx) });
      list.push({ fy: KANINHAGE.y0, draw: () => drawHage(ctx, false) }, { fy: KANINHAGE.y1, draw: () => drawHage(ctx, true) });
      list.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      talk.draw(ctx, { x0: cx, x1: cx + VW });
      label(ctx, focus, cx);
    },
    down(sx, sy) {
      const x = sx + cam.x, y = sy;
      hover = null;
      const s = spotAt(x, y);
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      const d = djurAt(x, y);
      if (d) { const L = lage.get(d.id); walker.walkTo(L.x, L.hage ? KANINHAGE.y1 + 8 : Math.max(BOXAR.y, KATTRUM.y) + 10, () => visa(d)); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { hover = { x: sx + cam.x, y: sy }; hoverT = t; },
    exit() { talk.clear(); },
    _debug: {
      spots: () => spots().map((s) => s.id),
      act: (id) => { const s = spots().find((q) => q.id === id); if (!s) return false; s.act(); return true; },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); cam.x = camTarget(); },
      djur: () => har().map((d) => ({ id: d.id, namn: d.namn, species: d.species, stage: d.stage })),
      visa: (id) => { const d = har().find((q) => q.id === id); if (!d) return false; visa(d); return true; },
      tova: () => talk.text?.() ?? null,
    },
  };
}
