// 🧍 FIGURSKAPAREN STEG FÖR STEG – en ny figur skapas en sak i taget.
// Carl 2026-10-10 valde förslag A ur artefakten "Ny start i Pixelstaden" (claude.ai/artifact/VWQbA2Zh64F2WAAwmKuuna):
// den gamla redigeraren (17 flikar med små rutor) var för plottrig på telefonen. Här syns figuren hela tiden
// till vänster, stegen står som stora pixelikoner överst (tryck för att hoppa), varje steg har stora rutor
// med förhandsbilder och längst ner Tillbaka / 🎲 / Nästa.
//
//   • Bläddringspilarna har en egen mörk list med gula knappar och FLER-text (Carl: "hon såg inte dem –
//     kanske en bakgrund uppe där"). Pilen hoppar tills man har bläddrat en gång.
//   • Frisyr, ögon och mun har många val i grupper (151 frisyrer): pilarna bläddrar genom gruppernas sidor
//     i tur och ordning och grupperna står som knappar under listen – inget val försvinner.
//   • Kläderna är de en ny figur har (gratisplaggen); fler köps i klädaffären. "Fler detaljer" på sista
//     steget öppnar den stora redigeraren (bryn, näsa, smink, skägg …) med figuren man har gjort.
//   • Används för NYA figurer (openAvatarEditor({ fresh: true }) skickar hit). Garderoben hemma och ✏️ Ändra
//     använder fortfarande den stora redigeraren.
import { drawPerson, LOOK_FIELDS, idOf, valueOf, entryOf, FIRST_NAMES, makeLook } from './people.js';
import { SLOTS, itemsForSlot, lookForItem, lookWithoutSlot, wornItem } from '../data/wardrobe.js';
import { openModal, closeModal, esc } from './ui.js';
import { $t } from './i18n.js';
import { ikonURL } from './pixikon.js';
import { cleanLook, cleanName, saveAvatar, MARKER_COLORS, NAME_MAX, avatarTagColors, AVATAR_PAL, openAvatarEditor } from './avatar.js';

const ik = (namn, px, cls = '') => `<img class="fs-ik ${cls}" src="${ikonURL(namn)}" width="${px}" height="${px}" alt="">`;
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const STEG = [
  { id: 'namn', ik: 'penna', namn: $t('Namn') },
  { id: 'skin', ik: 'hud', namn: $t('Hudton'), typ: 'farg', falt: 'skin', vy: 'huvud' },
  { id: 'style', ik: 'frisyr', namn: $t('Frisyr'), typ: 'reg', falt: 'style', vy: 'huvud' },
  { id: 'hair', ik: 'palett', namn: $t('Hårfärg'), typ: 'farg', falt: 'hair', vy: 'huvud' },
  { id: 'eyes', ik: 'ogon', namn: $t('Ögon'), typ: 'reg', falt: 'eyes', vy: 'ansikte' },
  { id: 'mouth', ik: 'mun', namn: $t('Mun'), typ: 'reg', falt: 'mouth', vy: 'ansikte' },
  { id: 'kropp', ik: 'kropp', namn: $t('Storlek'), typ: 'kropp', vy: 'hel' },
  { id: 'top', ik: 'troja', namn: $t('Överdel'), typ: 'plagg', slot: 'top', farg: () => 'shirt', vy: 'overkropp' },
  { id: 'bottom', ik: 'byxor', namn: $t('Underdel'), typ: 'plagg', slot: 'bottom', farg: (L) => entryOf('bottom', L.bottom)?.colorField || 'pants', vy: 'ben' },
  { id: 'shoes', ik: 'skor', namn: $t('Skor'), typ: 'plagg', slot: 'shoes', farg: (L) => (L.shoeType === 'barefoot' ? null : 'shoes'), vy: 'ben' },
  { id: 'klart', ik: 'bock', namn: $t('Klar') },
];
// utsnitt ur spriten (24×41, fötterna vid 12,39) i "rutenheter" om 20×24 – ansiktet förstoras dubbelt
const VY = {
  huvud: (L) => [2, L.kid ? 10 : 2, 20, 24, 1],
  ansikte: (L) => [7, L.kid ? 14 : 7, 10, 12, 2],
  overkropp: (L) => [2, L.kid ? 15 : 11, 20, 24, 1],
  ben: (L) => [2, L.kid ? 17 : 16, 20, 24, 1],
  hel: () => [0, 0, 24, 41, 0.8],
};
const KROPP = [
  { id: 'smal', namn: $t('Smal'), patch: { kid: false, build: 4 } },
  { id: 'mellan', namn: $t('Mellan'), patch: { kid: false, build: 5 } },
  { id: 'bred', namn: $t('Bred'), patch: { kid: false, build: 6 } },
  { id: 'barn', namn: $t('Barn'), patch: { kid: true, beard: false } },
];
// (läses när den behövs – avatar.js och den här filen importerar varandra)
const FARGER = (falt) => (falt === 'skin' ? [...AVATAR_PAL.skin, '#8fd14f', '#7aa7ff'] : AVATAR_PAL[falt]);
const GRATIS = (slot) => itemsForSlot(slot).filter((it) => it.free);

// En ny figurs utgångsläge: slumpad hud/frisyr/hårfärg, vanligt ansikte och gratiskläderna (inget låst plagg)
function nyLook() {
  const M = makeLook();
  let L = cleanLook({ skin: M.skin, hair: M.hair, style: M.style, shirt: M.shirt, pants: M.pants, shoes: M.shoes, kid: false, build: 5 });
  for (const s of SLOTS) if (!['top', 'bottom', 'shoes'].includes(s)) L = lookWithoutSlot(s, L);
  L = lookForItem(rnd(GRATIS('top')), L); L = lookForItem(GRATIS('bottom')[0], L); L = lookForItem(GRATIS('shoes')[0], L);
  return cleanLook(L);
}

let stil = false;
function injectStyle() {
  if (stil || typeof document === 'undefined') return;
  stil = true;
  const st = document.createElement('style');
  st.id = 'fs-style';
  st.textContent = `
#modal:has(.dlg-steg) { padding: 8px; }
.dlg.dlg-steg { width: min(1240px, 100%); height: min(720px, 100%); background: repeating-conic-gradient(#100e15 0% 25%, #151221 0% 50%) 0 0 / 16px 16px; box-shadow: 0 0 0 3px #000, 8px 8px 0 #000; }
.dlg-steg .dlg-head, .dlg-steg .dlg-foot { display: none; }
.dlg-steg .dlg-body { padding: 0; overflow: hidden; display: grid; }
.fs { min-height: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 20px; padding: 10px 16px 10px 22px; box-sizing: border-box; }
.fs-ik { image-rendering: pixelated; display: block; flex: none; }
.fs-vanster { display: grid; justify-items: center; align-content: center; gap: 10px; }
.fs-stall { position: relative; background: #e3d6bd; border: 3px solid var(--ink); box-shadow: 4px 4px 0 #000; display: grid; place-items: end center; padding: 18px 26px 16px;
  background-image: linear-gradient(#d6c7a9 2px, transparent 2px), linear-gradient(90deg, #d6c7a9 2px, transparent 2px); background-size: 24px 24px; cursor: pointer; }
.fs-stall canvas { image-rendering: pixelated; position: relative; }
.fs-stall .fs-skugga { position: absolute; bottom: 12px; left: 50%; width: 46%; height: 12px; transform: translateX(-50%); background: rgba(20,12,30,.25); border-radius: 50%; }
.fs-skylt { font: var(--f2) var(--font); line-height: 1; border: 3px solid var(--ink); padding: 6px 14px 5px; min-width: 140px; text-align: center; box-shadow: 3px 3px 0 var(--ink); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fs-vrid { display: flex; gap: 10px; }
.fs .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; }
.fs-hoger { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; grid-template-columns: minmax(0, 1fr); gap: 8px; min-height: 0; min-width: 0; }
.fs-stegrad { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.fs-steg { width: 46px; height: 46px; padding: 0; border: 3px solid var(--ink); background: #f4f1ea; cursor: pointer; display: grid; place-items: center; box-shadow: 2px 2px 0 #000; }
.fs-steg.klar { background: var(--green2); }
.fs-steg.nu { background: var(--gold); transform: translateY(-3px); box-shadow: 2px 5px 0 #000; }
.fs-x { margin-left: auto; font-size: var(--f2); min-height: 44px !important; }
.fs-kort { background: var(--paper); border: 3px solid var(--ink); box-shadow: 4px 4px 0 #000; display: flex; flex-direction: column; min-height: 0; min-width: 0; overflow: hidden; }
/* listen överst i kortet: mörk, med rubriken och de gula bläddringspilarna */
.fs-list { display: flex; align-items: center; gap: 12px; background: var(--ink); color: #fff; padding: 5px 8px 5px 14px; min-height: 48px; box-sizing: border-box; border-bottom: 3px solid #000; flex: none; }
.fs-rubrik { font: var(--f3) var(--head); line-height: 1; display: flex; align-items: center; gap: 12px; min-width: 0; white-space: nowrap; text-shadow: 3px 3px 0 #000; }
.fs-sidor { margin-left: auto; display: flex; align-items: center; gap: 10px; font: var(--f2) var(--font); }
.fs-sidnr { min-width: 3.2em; text-align: center; color: var(--gold); }
.fs-pil { min-height: 46px !important; padding: 2px 14px !important; background: var(--gold) !important; color: var(--ink); box-shadow: 3px 3px 0 #000 !important; border-color: #000 !important; }
.fs-pil:hover:not(:disabled) { background: #ffd862 !important; }
.fs-pil:disabled { opacity: .3; }
.fs-pil b { font: var(--f2) var(--head); font-weight: 400; letter-spacing: .5px; }
@media (prefers-reduced-motion: no-preference) {
  .fs-pil.lockar { animation: fs-hopp .8s ease-in-out infinite; }
  .fs-steg.nu { transition: transform .15s; }
}
@keyframes fs-hopp { 50% { transform: translateX(5px); box-shadow: 0 0 0 4px #fff, 3px 3px 0 #000; } }
.fs-grupper { display: flex; gap: 6px; padding: 7px 10px 0; overflow-x: auto; flex: none; min-width: 0; scrollbar-width: none; }
.fs-grupp { font: var(--f15, var(--f2)) var(--font); line-height: 1; padding: 5px 9px 4px; border: 2px solid var(--ink); background: var(--paper2); color: var(--ink); cursor: pointer; white-space: nowrap; box-shadow: 2px 2px 0 var(--ink); flex: none; }
.fs-grupp.nu { background: var(--gold); transform: translate(1px, 1px); box-shadow: none; }
.fs-yta { flex: 1; min-height: 0; min-width: 0; padding: 10px; display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
.fs-plagg { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px 22px; align-content: start; }
.fs-plagg > div { display: grid; gap: 8px; align-content: start; min-width: 0; }
.fs-rutor { flex: 1; min-height: 0; display: grid; gap: 10px; justify-content: center; align-content: start; }
.fs-ruta { position: relative; padding: 0; border: 3px solid var(--ink); background: #fff; cursor: pointer; display: grid; place-items: center; line-height: 0; }
.fs-ruta canvas { image-rendering: pixelated; }
.fs-ruta.vald { outline: 5px solid var(--gold); outline-offset: -2px; }
.fs-ruta .fs-bock { position: absolute; top: -14px; right: -14px; z-index: 2; }
.fs-etikett { position: absolute; left: 0; right: 0; bottom: 0; font: var(--f15, var(--f1)) var(--font); line-height: 1.1; background: rgba(23,21,26,.78); color: #fff; padding: 2px 2px 1px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fs-del { font: var(--f2) var(--font); line-height: 1; color: var(--muted); display: flex; align-items: center; gap: 8px; }
.fs-farger { display: flex; flex-wrap: wrap; gap: 8px; }
.fs-farg { width: 52px; height: 52px; border: 3px solid var(--ink); background: var(--c); cursor: pointer; padding: 0; box-shadow: 2px 2px 0 var(--ink); position: relative; }
.fs-farg.vald { outline: 4px solid var(--gold); outline-offset: 1px; }
.fs-farg.vald::after { content: ""; position: absolute; inset: 14px; background: #fff; border: 3px solid var(--ink); }
.fs-rad { display: flex; gap: 10px; flex-wrap: wrap; }
.fs-namn { display: grid; gap: 14px; align-content: center; max-width: 640px; }
.fs-namn h3, .fs-klart h3 { margin: 0; font: var(--f3) var(--head); line-height: 1; color: var(--ink); }
.fs-namnrad { display: flex; gap: 10px; flex-wrap: wrap; }
.fs-namnfalt { font: var(--f3) var(--font); line-height: 1; padding: 8px 12px; border: 3px solid var(--ink); background: #fff; color: var(--ink); min-width: 0; flex: 1 1 260px; }
.fs-namnfalt.fel { border-color: var(--red2); background: #ffe9e6; }
.fs-fel { font: var(--f2) var(--font); color: var(--red2); min-height: 1em; }
.fs-klart { display: grid; gap: 16px; align-content: center; justify-items: start; padding: 8px; }
.fs-klart p { font: var(--f2) var(--font); line-height: 1.15; margin: 0; max-width: 34em; color: var(--ink); }
.fs-botten { display: flex; gap: 12px; align-items: center; justify-content: space-between; }
.fs-tarning { background: var(--gold) !important; min-width: 76px; }
.fs-nasta { min-width: 160px; }
@media (max-width: 760px), (max-height: 470px) {
  .fs { gap: 10px; padding: 8px 10px; }
  .fs-steg { width: 38px; height: 38px; }
  .fs-steg img { width: 24px; height: 24px; }
  .fs .btn { min-height: 40px; }
  .fs-pil { min-height: 40px !important; }
  .fs-rubrik { font-size: var(--f2); }
  .fs-farg { width: 40px; height: 40px; }
}`;
  document.head.appendChild(st);
}

export function openFigurSteg({ onDone, onCancel, init = null } = {}) {
  injectStyle();
  const cur = init ? { name: init.name || '', look: cleanLook(init.look), color: init.color || rnd(MARKER_COLORS) }
    : { name: '', look: nyLook(), color: rnd(MARKER_COLORS) };
  let i = init?.steg ?? 0, sida = 0, bladdrat = false;
  const dlg = openModal($t('Skapa din figur'), `<div class="fs">
      <div class="fs-vanster">
        <div class="fs-stall" title="${esc($t('Vrid åt höger'))}"><div class="fs-skugga"></div><canvas></canvas></div>
        <div class="fs-skylt"></div>
        <div class="fs-vrid"><button type="button" class="btn" data-v="-1" title="${esc($t('Vrid åt vänster'))}" aria-label="${esc($t('Vrid åt vänster'))}">${ik('pilVm', 32)}</button><button type="button" class="btn" data-v="1" title="${esc($t('Vrid åt höger'))}" aria-label="${esc($t('Vrid åt höger'))}">${ik('pilHm', 32)}</button></div>
      </div>
      <div class="fs-hoger"></div>
    </div>`, [], { closable: false });
  dlg.classList.add('dlg-steg');
  const $ = (s) => dlg.querySelector(s);
  const H = $('.fs-hoger'), cv = $('.fs-stall canvas'), ctx = cv.getContext('2d'), skylt = $('.fs-skylt');

  // ---------- figuren till vänster: andas och kan vridas ----------
  const DIR = ['down', 'right', 'up', 'left'];
  let d = 0, t = 0, S = 0;
  const skala = () => (innerHeight >= 700 ? 7 : innerHeight >= 540 ? 6 : innerHeight >= 430 ? 4 : 3);
  function rita() {
    const s = skala();
    if (s !== S) {
      S = s; const k = S * Math.max(1, Math.round(devicePixelRatio || 1));
      cv.width = 24 * k; cv.height = 41 * k; cv.style.width = 24 * S + 'px'; cv.style.height = 41 * S + 'px';
      ctx.setTransform(k, 0, 0, k, 0, 0); ctx.imageSmoothingEnabled = false;
    }
    ctx.clearRect(0, 0, 24, 41);
    drawPerson(ctx, 12, 39, cur.look, DIR[d], t % 2 ? 4 : 0);
    const c = avatarTagColors(cur);
    skylt.textContent = cleanName(cur.name) || '???';
    skylt.style.background = c.bg; skylt.style.color = c.fg;
  }
  const iv = setInterval(() => { if (!dlg.isConnected) { stang(); return; } t++; rita(); }, 700);
  const vrid = (v) => { d = (d + v + 4) % 4; rita(); };
  dlg.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => vrid(+b.dataset.v)));
  $('.fs-stall').onclick = () => vrid(1);

  // ---------- rutorna ----------
  const kompakt = () => innerWidth < 760 || innerHeight < 470;
  const f = () => (kompakt() ? 3 : 5);   // rutenhetens skala (20×24 → 60×72 eller 100×120)
  const skalaFor = (m) => Math.max(1, Math.round(f() * m));   // alltid hela pixlar
  function rutBild(look, vy) {
    const [sx, sy, sw, sh, m] = VY[vy](look), s = skalaFor(m), k = Math.max(1, Math.round(devicePixelRatio || 1));
    const src = document.createElement('canvas'); src.width = 24; src.height = 41;
    drawPerson(src.getContext('2d'), 12, 39, look, 'down', 0);
    const c = document.createElement('canvas');
    c.width = sw * s * k; c.height = sh * s * k;
    c.style.width = sw * s + 'px'; c.style.height = sh * s + 'px';
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#e6dcc8'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#dccfb6'; const ruta = Math.round(4 * s * k / 2);
    for (let y = 0; y < c.height; y += ruta) for (let x = 0; x < c.width; x += ruta) if (((x + y) / ruta) % 2 === 0) g.fillRect(x, y, ruta, ruta);
    g.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c;
  }
  const rutMatt = (vy) => { const [, , sw, sh, m] = VY[vy](cur.look), s = skalaFor(m); return [sw * s + 6, sh * s + 6]; };
  function ruta({ look, vy, namn, vald, onVal }) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'fs-ruta' + (vald ? ' vald' : '');
    if (namn) { b.title = namn; b.setAttribute('aria-label', namn); }
    b.setAttribute('aria-pressed', String(!!vald));
    b.append(rutBild(look, vy));
    if (vald) b.insertAdjacentHTML('beforeend', `<span class="fs-bock">${ik('bock', 32)}</span>`);
    if (namn) { const e = document.createElement('span'); e.className = 'fs-etikett'; e.textContent = namn; b.append(e); }
    b.onclick = onVal;
    return b;
  }
  const lika = (a, b) => (a ?? null) === (b ?? null) || (a === false && b === null) || (a === null && b === false);
  const satt = (patch) => { cur.look = cleanLook({ ...cur.look, ...patch }); rita(); render(); };
  const utanHuvud = { hat: null, phones: false, hairAcc: 'none' };

  // valen i ett steg: [{ grupp, id, namn, look, vald, patch }]
  function valFor(st) {
    const L = cur.look;
    if (st.typ === 'farg') return FARGER(st.falt).map((c) => ({ grupp: '', id: c, namn: '', look: { ...L, ...utanHuvud, [st.falt]: c }, vald: lika(L[st.falt], c), patch: { [st.falt]: c } }));
    if (st.typ === 'kropp') return KROPP.map((o) => ({ grupp: '', id: o.id, namn: o.namn, look: { ...L, ...o.patch }, vald: !!L.kid === o.patch.kid && (L.kid || L.build === o.patch.build), patch: o.patch }));
    if (st.typ === 'reg') {
      const F = LOOK_FIELDS[st.falt], nu = idOf(st.falt, L[st.falt]), ids = Object.keys(F.reg);
      const forsta = ids.map((id) => F.reg[id].group).find(Boolean) || '';
      const extra = st.falt === 'style' ? utanHuvud : st.falt === 'eyes' ? { glasses: false } : {};
      return ids.map((id) => { const v = valueOf(st.falt, id); return { grupp: F.reg[id].group || forsta, id, namn: String(F.reg[id].label || id).replace(/­/g, ''), look: { ...L, ...extra, [st.falt]: v }, vald: nu === id, patch: { [st.falt]: v } }; });
    }
    return [];
  }
  // sidorna: varje grupp delas i sidor om `per` rutor, och pilarna går genom alla i ordning
  function sidorFor(val, per) {
    const ut = [], grupper = [];
    for (const v of val) { let g = grupper.find((x) => x.namn === v.grupp); if (!g) grupper.push(g = { namn: v.grupp, val: [] }); g.val.push(v); }
    for (const g of grupper) for (let n = 0; n < g.val.length; n += per) ut.push({ grupp: g.namn, val: g.val.slice(n, n + per) });
    return { sidor: ut, grupper: grupper.map((g) => g.namn).filter(Boolean) };
  }
  let sistaSteg = -1;

  // ---------- ett steg ----------
  function render() {
    const st = STEG[i], forsta = i === 0, sista = i === STEG.length - 1;
    if (sistaSteg !== i) { sistaSteg = i; bladdrat = false; }
    H.innerHTML = `<div class="fs-stegrad">${STEG.map((s, n) => `<button type="button" class="fs-steg ${n === i ? 'nu' : n < i ? 'klar' : ''}" data-n="${n}" data-steg="${s.id}" title="${esc(s.namn)}" aria-label="${esc(s.namn)}" ${n === i ? 'aria-current="step"' : ''}>${ik(s.ik, 32)}</button>`).join('')}
        <button type="button" class="btn btn-small fs-x" data-close title="${esc($t('Avbryt'))}" aria-label="${esc($t('Avbryt'))}">✕</button></div>
      <div class="fs-kort"><div class="fs-list"><div class="fs-rubrik">${ik(st.ik, 40)}<span>${esc(st.namn)}</span></div></div><div class="fs-yta"></div></div>
      <div class="fs-botten">
        <button type="button" class="btn" data-b="tillbaka" ${forsta ? 'disabled' : ''}>${ik('pilVm', 24)}${esc($t('Tillbaka'))}</button>
        ${st.typ ? `<button type="button" class="btn fs-tarning" data-b="slump" title="${esc($t('Slumpa'))}" aria-label="${esc($t('Slumpa'))}">${ik('tarning', 40)}</button>` : ''}
        ${sista ? `<span class="fs-rad"><button type="button" class="btn" data-b="mer">${ik('penna', 24)}${esc($t('Fler detaljer'))}</button><button type="button" class="btn btn-go fs-nasta fs-spela" data-b="spela">${ik('pilH', 24)}${esc($t('Spela!'))}</button></span>`
          : `<button type="button" class="btn btn-go fs-nasta" data-b="nasta">${esc($t('Nästa'))}${ik('pilH', 24)}</button>`}
      </div>`;
    const yta = $('.fs-yta'), list = $('.fs-list');
    if (st.id === 'namn') namnSteg(yta);
    else if (st.id === 'klart') klartSteg(yta);
    else if (st.typ === 'plagg') plaggSteg(st, yta);
    else valSteg(st, yta, list);
    H.querySelectorAll('[data-n]').forEach((b) => (b.onclick = () => ga(+b.dataset.n)));
    $('[data-close]').onclick = avbryt;
    $('[data-b="tillbaka"]').onclick = () => ga(i - 1);
    $('[data-b="nasta"]')?.addEventListener('click', () => ga(i + 1));
    $('[data-b="slump"]')?.addEventListener('click', () => slumpa(st));
    $('[data-b="spela"]')?.addEventListener('click', spela);
    $('[data-b="mer"]')?.addEventListener('click', merDetaljer);
  }
  function ga(n) { i = Math.max(0, Math.min(STEG.length - 1, n)); sida = -1; render(); }

  function valSteg(st, yta, list) {
    const val = valFor(st);
    const [tw, th] = rutMatt(st.vy), gap = 10;
    // hur många rutor ryms? (ytan mäts med en tom grupprad om fältet har grupper)
    const harGrupper = st.typ === 'reg';
    let gr = null;
    if (harGrupper) { gr = document.createElement('div'); gr.className = 'fs-grupper'; gr.innerHTML = '<button class="fs-grupp">&nbsp;</button>'; yta.before(gr); }
    const W = yta.clientWidth - 20, Hh = yta.clientHeight - 20;
    const kol = Math.max(1, Math.floor((W + gap) / (tw + gap))), rad = Math.max(1, Math.floor((Hh + gap) / (th + gap)));
    const per = kol * rad;
    const { sidor, grupper } = sidorFor(val, per);
    if (sida < 0 || sida >= sidor.length) sida = Math.max(0, sidor.findIndex((s) => s.val.some((v) => v.vald)));
    const nu = sidor[sida];
    if (harGrupper && grupper.length > 1) {
      gr.innerHTML = grupper.map((g) => `<button type="button" class="fs-grupp ${g === nu.grupp ? 'nu' : ''}" data-g="${esc(g)}">${esc($t(g))}</button>`).join('');
      gr.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => { sida = sidor.findIndex((s) => s.grupp === b.dataset.g); bladdrat = true; render(); }));
      const pa = gr.querySelector('.nu'); if (pa && gr.scrollWidth > gr.clientWidth) gr.scrollLeft = Math.max(0, pa.offsetLeft - 40);
    } else gr?.remove();
    if (sidor.length > 1) {
      const s = document.createElement('div'); s.className = 'fs-sidor';
      s.innerHTML = `<button type="button" class="btn fs-pil" data-p="-1" ${sida === 0 ? 'disabled' : ''} title="${esc($t('Föregående sida'))}" aria-label="${esc($t('Föregående sida'))}">${ik('pilV', 32)}</button>`
        + `<span class="fs-sidnr">${sida + 1}/${sidor.length}</span>`
        + `<button type="button" class="btn fs-pil ${!bladdrat && sida < sidor.length - 1 ? 'lockar' : ''}" data-p="1" ${sida >= sidor.length - 1 ? 'disabled' : ''} title="${esc($t('Nästa sida'))}" aria-label="${esc($t('Nästa sida'))}"><b>${esc($t('FLER'))}</b>${ik('pilH', 32)}</button>`;
      list.append(s);
      s.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { sida = Math.max(0, Math.min(sidor.length - 1, sida + +b.dataset.p)); bladdrat = true; render(); }));
    }
    const rutor = document.createElement('div'); rutor.className = 'fs-rutor';
    rutor.style.gridTemplateColumns = `repeat(${kol}, ${tw}px)`;
    for (const v of nu.val) rutor.append(ruta({ look: v.look, vy: st.vy, namn: v.namn, vald: v.vald, onVal: () => satt(v.patch) }));
    yta.append(rutor);
  }

  function plaggSteg(st, yta) {
    const L = cur.look, worn = wornItem(L, st.slot);
    const del = (ikon, text) => `<div class="fs-del">${ikon ? ik(ikon, 24) : ''}${esc(text)}</div>`;
    const box = document.createElement('div'); box.className = 'fs-plagg';
    box.innerHTML = `<div>${del('', $t('Modell'))}</div><div></div>`;
    const [vm, hm] = box.children;
    yta.append(box);
    const rad = document.createElement('div'); rad.className = 'fs-rad';
    for (const it of GRATIS(st.slot)) rad.append(ruta({ look: lookForItem(it, L), vy: st.vy, namn: String(it.name).replace(/­/g, ''), vald: worn === it, onVal: () => { cur.look = cleanLook(lookForItem(it, cur.look)); rita(); render(); } }));
    vm.append(rad);
    const ff = st.farg(L);
    if (!ff) return;
    hm.insertAdjacentHTML('beforeend', del('palett', $t('Färg')));
    const pal = AVATAR_PAL[ff] || AVATAR_PAL.shirt;
    const fr = document.createElement('div'); fr.className = 'fs-farger';
    fr.innerHTML = pal.map((c) => `<button type="button" class="fs-farg ${lika(L[ff], c) ? 'vald' : ''}" style="--c:${c}" data-c="${c}" aria-label="${esc($t('Färg'))} ${c}" aria-pressed="${lika(L[ff], c)}"></button>`).join('');
    fr.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => satt({ [ff]: b.dataset.c })));
    hm.append(fr);
  }

  function namnSteg(yta) {
    yta.innerHTML = `<div class="fs-namn">
        <h3>${esc($t('Vad heter du?'))}</h3>
        <div class="fs-namnrad"><input id="fs-namn" class="fs-namnfalt" type="text" maxlength="${NAME_MAX}" autocomplete="off" spellcheck="false" placeholder="${esc($t('Ditt namn'))}"><button type="button" class="btn btn-gold" data-namn>${ik('tarning', 32)}${esc($t('Föreslå ett namn'))}</button></div>
        <div class="fs-fel" aria-live="polite"></div>
        <div class="fs-del">${esc($t('Namnskylt'))}</div>
        <div class="fs-farger">${MARKER_COLORS.map((c) => `<button type="button" class="fs-farg ${c === cur.color ? 'vald' : ''}" style="--c:${c}" data-m="${c}" aria-label="${esc($t('Namnskylt'))} ${c}" aria-pressed="${c === cur.color}"></button>`).join('')}</div>
      </div>`;
    const inp = yta.querySelector('input'), fel = yta.querySelector('.fs-fel');
    inp.value = cur.name;
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); ga(i + 1); } });
    inp.addEventListener('keyup', (e) => e.stopPropagation());
    inp.oninput = () => { cur.name = inp.value; if (cleanName(cur.name)) { fel.textContent = ''; inp.classList.remove('fel'); } rita(); };
    yta.querySelector('[data-namn]').onclick = () => { cur.name = inp.value = rnd(FIRST_NAMES.filter((n) => n !== cur.name)); fel.textContent = ''; inp.classList.remove('fel'); rita(); };
    yta.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { cur.color = b.dataset.m; rita(); yta.querySelectorAll('[data-m]').forEach((x) => { const on = x.dataset.m === cur.color; x.classList.toggle('vald', on); x.setAttribute('aria-pressed', String(on)); }); }));
    if (namnFel) { fel.textContent = $t('Skriv ett namn först!'); inp.classList.add('fel'); namnFel = false; setTimeout(() => inp.focus(), 30); }
  }
  let namnFel = false;

  function klartSteg(yta) {
    const n = cleanName(cur.name);
    yta.innerHTML = `<div class="fs-klart"><h3>${esc(n ? $t`Snyggt, ${n}!` : $t('Snyggt!'))}</h3><p>${esc($t('Så här ser du ut. Fler kläder köper du i klädaffären och frisyren byter du hos frisören. Hemma i garderoben kan du byta när du vill.'))}</p></div>`;
  }

  function slumpa(st) {
    const val = st.typ === 'plagg' ? null : valFor(st);
    const andra = val?.filter((v) => !v.vald) || [];
    if (andra.length) { sida = -1; satt(rnd(andra).patch); return; }
    if (st.typ === 'plagg') {
      let L = lookForItem(rnd(GRATIS(st.slot)), cur.look);
      const ff = st.farg(L); if (ff) L = { ...L, [ff]: rnd(AVATAR_PAL[ff] || AVATAR_PAL.shirt) };
      cur.look = cleanLook(L); rita(); render();
    }
  }

  function spela() {
    const name = cleanName(cur.name);
    if (!name) { namnFel = true; ga(0); return; }
    const av = saveAvatar({ name, look: cur.look, color: cur.color });
    stang(); closeModal();
    onDone?.(av);
  }
  function merDetaljer() {
    stang();
    openAvatarEditor({
      fresh: true, full: true, init: { name: cur.name, look: cur.look, color: cur.color },
      onDone, onCancel: () => openFigurSteg({ onDone, onCancel, init: { ...cur, steg: STEG.length - 1 } }),
    });
  }
  function avbryt() { stang(); closeModal(); onCancel?.(); }

  // tangenterna: ← → bläddrar, Enter = Nästa (inte när man skriver namnet)
  const tangent = (e) => {
    if (!dlg.isConnected) { stang(); return; }
    if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '') || e.ctrlKey || e.altKey || e.metaKey) return;
    const klick = (sel) => { const b = $(sel); if (b && !b.disabled) { e.preventDefault(); e.stopImmediatePropagation(); b.click(); } };
    if (e.key === 'ArrowRight') klick('[data-p="1"]');
    else if (e.key === 'ArrowLeft') klick('[data-p="-1"]');
    else if (e.key === 'Enter') klick('[data-b="nasta"], [data-b="spela"]');
  };
  const omMatt = () => { if (!dlg.isConnected) { stang(); return; } rita(); render(); };
  let stangd = false;
  function stang() { if (stangd) return; stangd = true; clearInterval(iv); removeEventListener('keydown', tangent, true); removeEventListener('resize', omMatt); }
  addEventListener('keydown', tangent, true);
  addEventListener('resize', omMatt);

  rita();
  sida = -1;
  render();
  return dlg;
}
