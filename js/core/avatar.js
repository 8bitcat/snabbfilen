// Min avatar: spelarens egen figur (namn + utseende + markörfärg), sparad i localStorage,
// och redigeraren där man klär ut den. `look` är ett rent JSON-objekt som drawPerson förstår
// (det skickas över nätet i co-op) – kör alltid främmande data genom cleanAvatar/cleanLook.
//
// Redigeraren är byggd för hundratals val: flikar per kategori, rutnät som ritas lat
// (bara synliga rutor, i omgångar), underrubriker ur registrens `group`. Val som ritas
// (frisyr, ansikte …) kommer ur registren i js/core/people/*.js, plaggen ur klädkatalogen
// js/data/wardrobe.js – man ser bara plagg man äger (+ gratis basplagg).
import {
  makeLook, drawPerson, portrait, FIRST_NAMES,
  SKIN, HAIR, SHIRT, PANTS, SHOES, PHONE_COLORS, BAG_COLORS,
  HAIR_STYLES, BUILDS, LOOK_FIELDS, LOOK_COLORS, idOf, valueOf, isValid, entryOf, listOf,
} from './people.js';
import { EYE_COLORS, LIP_COLORS, SHADOW_COLORS, MARK_COLORS } from './people/face.js';
import {
  SLOTS, SLOT_FIELDS, SLOT_CAN_BE_EMPTY, itemsForSlot, itemById, lookForItem, lookWithoutSlot, wornItem, slotIsEmpty, groupOf,
} from '../data/wardrobe.js';
import { openModal, closeModal, toast, esc } from './ui.js';

export const AVATAR_KEY = 'snabbfilen_avatar';

// ---------- garderoben: vad får spelaren ha på sig? ----------
// Nytt system: setAvatarWardrobe(() => [ägda katalog-id]) – gratis basplagg ingår alltid.
// Gammalt system (fortfarande stött): setAvatarLocks((kind, v) => null | { price }) där
// kind/v är de gamla sortimentsnycklarna ('hat', 'cap'). Nya plagg utan gammal nyckel
// räknas då som låsta tills main.js kopplats om till setAvatarWardrobe.
// Inget inkopplat (verktyg/test) ⇒ allt är upplåst.
let AVLOCKS = null, AVOWNED = null;
export function setAvatarLocks(fn) { AVLOCKS = fn; }
export function setAvatarWardrobe(getOwnedIds) { AVOWNED = getOwnedIds; }
function ownedIds() {
  try { const v = AVOWNED?.(); return new Set(v instanceof Set ? v : Array.isArray(v) ? v : []); } catch { return new Set(); }
}
// Får man ha plagget (katalogpost eller id) på sig i redigeraren?
export function avatarCanWear(item, owned = null) {
  const it = typeof item === 'string' ? itemById(item) : item;
  if (!it) return false;
  if (it.free) return true;
  if (AVOWNED) return (owned || ownedIds()).has(it.id);
  if (AVLOCKS) {
    if (!it.legacy) return false;
    const i = it.legacy.indexOf(':'), kind = it.legacy.slice(0, i), raw = it.legacy.slice(i + 1);
    try { return !AVLOCKS(kind, raw === 'true' ? true : raw); } catch { return false; }
  }
  return true;
}
const anyLocks = () => !!(AVOWNED || AVLOCKS);

export const NAME_MAX = 12;
// Markörfärger: namnskylt, muspekare i co-op m.m. – klara färger som syns mot golvet
export const MARKER_COLORS = ['#ff4d4d', '#ff9f1c', '#ffd23f', '#8ee03c', '#22c7a9', '#3fc4ff', '#4f7dff', '#a66bff', '#ff5dc8', '#f4f1ea'];

// ---------- rensning / lagring ----------
const HEX = /^#[0-9a-f]{6}$/i;
const col = (v, fb) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : fb);
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
// giltigt registervärde (normaliserat, t.ex. hörlurar 'over' ⇒ true), annars fb
const reg = (f, v, fb) => (isValid(f, v) ? valueOf(f, idOf(f, v)) : fb);

function cleanName(v) {
  const s = Array.from(String(v ?? '')).filter((ch) => { const c = ch.codePointAt(0); return c >= 32 && c !== 127 && ch !== '<' && ch !== '>'; }).join('').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, NAME_MAX).join('').trim();
}

// Validerar varje fält mot registren/färgformatet. Okänt ⇒ standard. Resultatet innehåller
// alltid alla fält (gamla + nya), så redigeraren kan jämföra direkt.
export function cleanLook(raw) {
  const L = raw && typeof raw === 'object' ? raw : {};
  let style = L.style, hat = L.hat ?? null;
  if (style === 'cap') { style = 'short'; hat = hat || 'cap'; } // gammalt format
  const kid = !!L.kid;
  const cheeks = reg('cheeks', L.cheeks, L.blush ? 'blush' : 'none');
  const phones = typeof L.phones === 'string' ? reg('phones', L.phones, false) : !!L.phones;
  return {
    skin: col(L.skin, LOOK_COLORS.skin), hair: col(L.hair, LOOK_COLORS.hair), style: reg('style', style, 'short'),
    top: reg('top', L.top, 'tee'), shirt: col(L.shirt, LOOK_COLORS.shirt), accent: col(L.accent, LOOK_COLORS.accent),
    bottom: reg('bottom', L.bottom, 'jeans'), pants: col(L.pants, LOOK_COLORS.pants), shoes: col(L.shoes, LOOK_COLORS.shoes),
    hat: reg('hat', hat, null), cap: col(L.cap, LOOK_COLORS.cap),
    glasses: reg('glasses', L.glasses === true ? 'square' : L.glasses || false, false),
    beard: kid ? false : reg('beard', L.beard === true ? 'full' : L.beard || false, false),
    phones, phoneColor: col(L.phoneColor, LOOK_COLORS.phoneColor),
    bag: reg('bag', L.bag ?? null, null), bagColor: col(L.bagColor, LOOK_COLORS.bagColor),
    build: kid ? 4 : (BUILDS.includes(L.build) ? L.build : 5),
    blush: cheeks === 'blush', apron: !!L.apron, kid,
    // hår
    hairFx: reg('hairFx', L.hairFx, 'none'), hair2: col(L.hair2, null), hairAcc: reg('hairAcc', L.hairAcc, 'none'),
    // ansikte
    eyes: reg('eyes', L.eyes, 'normal'), eyeColor: col(L.eyeColor, null), brows: reg('brows', L.brows, 'normal'),
    nose: reg('nose', L.nose, 'normal'), mouth: reg('mouth', L.mouth, 'normal'), ears: reg('ears', L.ears, 'normal'),
    cheeks, makeup: reg('makeup', L.makeup, 'none'), lipColor: col(L.lipColor, null), shadowColor: col(L.shadowColor, null),
    marks: reg('marks', L.marks, 'none'), markColor: col(L.markColor, null),
    // kläder
    topPrint: reg('topPrint', L.topPrint, 'none'), print2: col(L.print2, null),
    bottomPrint: reg('bottomPrint', L.bottomPrint, 'none'), pants2: col(L.pants2, null),
    shoeType: reg('shoeType', L.shoeType, 'normal'), shoes2: col(L.shoes2, null),
    neck: reg('neck', L.neck, 'none'), neckColor: col(L.neckColor, null), jewel: reg('jewel', L.jewel, 'none'),
  };
}

function colorFromName(name) {
  let h = 7;
  for (const ch of String(name || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return MARKER_COLORS[h % MARKER_COLORS.length];
}

// Varje figur har ett eget id, så att flera kan heta samma sak. Figurer från tiden före
// id:na får namnets slug – samma nyckel som deras parkerade sparning redan ligger under.
const ID_RE = /^[a-z0-9åäö-]{1,32}$/;
export const legacyId = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9åäö]/g, '').slice(0, 24) || 'figur';
export const newAvatarId = () => 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Rensar ett avatarobjekt (t.ex. från nätet): { id, name, look, color } med giltiga värden
export function cleanAvatar(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const name = cleanName(a.name);
  const out = { name, look: cleanLook(a.look), color: col(a.color, null) || colorFromName(name) };
  if (typeof a.id === 'string' && ID_RE.test(a.id)) out.id = a.id;
  return out;
}

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};

// Tar av plagg man inte äger (platsen återställs till bas: t-shirt, jeans, ingen hatt …)
function stripLocked(look) {
  if (!anyLocks()) return look;
  const owned = AVOWNED ? ownedIds() : null;
  let L = look;
  for (const slot of SLOTS) {
    if (slotIsEmpty(L, slot)) continue;
    const it = wornItem(L, slot);
    if (!it || !avatarCanWear(it, owned)) L = lookWithoutSlot(slot, L);
  }
  return cleanLook(L);
}

// Slumpat vuxet utseende (utgångsläge innan spelaren klätt ut sig).
// Nya spelare börjar i det man äger – inget låst plagg på kroppen.
function defaultLook() {
  const L = makeLook();
  L.kid = false; L.bag = null; L.apron = false;
  return stripLocked(cleanLook(L));
}

// Senast lästa/sparade avatar. loadAvatar() ger samma look-objekt så länge inget ändrats –
// drawPerson cachar spritarna per objekt, så man kan anropa den ofta utan att allt ritas om.
let memo = null; // { raw, av }

export function loadAvatar() {
  const raw = store.get(AVATAR_KEY);
  if (raw && memo && memo.raw === raw) return { ...memo.av };
  if (raw) {
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object' && p.look && typeof p.look === 'object') {
        const av = cleanAvatar(p);
        if (av.name && !av.id) return { ...saveAvatar({ ...av, id: legacyId(av.name) }) }; // figur från före id:na
        memo = { raw, av }; return { ...av };
      }
    } catch { /* trasig – skapa ny */ }
  }
  if (!raw && memo) { store.set(AVATAR_KEY, memo.raw); return { ...memo.av }; } // lagringen tömd/blockerad: behåll avataren
  return { ...saveAvatar({ name: '', look: defaultLook(), color: rnd(MARKER_COLORS) }) };
}

export function saveAvatar(av) {
  const c = cleanAvatar(av);
  if (c.name && !c.id) c.id = newAvatarId(); // ny figur (eller namngiven för första gången)
  const raw = JSON.stringify(c);
  store.set(AVATAR_KEY, raw);
  memo = { raw, av: c };
  if (c.name) upsertProfile(c);
  return { ...c };
}

// ---------- Sparade avatarer (flera personer kan dela en dator) ----------
export const PROFILES_KEY = 'snabbfilen_avatars';
const PROFILE_MAX = 24;
export function listAvatars() {
  let list = [];
  try { list = JSON.parse(store.get(PROFILES_KEY) || '[]'); } catch { list = []; }
  list = (Array.isArray(list) ? list : []).map(cleanAvatar).filter((a) => a.name);
  let dirty = false;
  const seen = new Set();
  list = list.filter((a) => {
    if (!a.id) { a.id = legacyId(a.name); dirty = true; } // profil från före id:na
    if (seen.has(a.id)) { dirty = true; return false; }
    seen.add(a.id);
    return true;
  });
  // den nuvarande avataren (från tiden före listan) följer med
  try {
    const cur = JSON.parse(store.get(AVATAR_KEY) || 'null');
    if (cur?.name && cur.look) {
      const c = cleanAvatar(cur);
      if (!c.id) c.id = legacyId(c.name);
      if (!seen.has(c.id)) { list.unshift(c); dirty = true; }
    }
  } catch { /* ingen */ }
  if (dirty) store.set(PROFILES_KEY, JSON.stringify(list));
  return list;
}
function upsertProfile(av) {
  const list = listAvatars().filter((a) => a.id !== av.id);
  list.unshift({ id: av.id, name: av.name, look: av.look, color: av.color });
  store.set(PROFILES_KEY, JSON.stringify(list.slice(0, PROFILE_MAX)));
}
export function deleteAvatar(id) {
  const list = listAvatars().filter((a) => a.id !== id);
  store.set(PROFILES_KEY, JSON.stringify(list));
  const cur = loadAvatar();
  if (cur.id === id) saveAvatar(list[0] || { name: '', look: defaultLook(), color: rnd(MARKER_COLORS) });
}

// Välj vem du är: sparade avatarer + skapa ny. onPick(av) när man valt.
export function openAvatarPicker({ title = '🧑 Vem spelar?', text = 'Välj din avatar eller skapa en ny.', onPick, onCancel } = {}) {
  const list = listAvatars();
  if (!list.length) return openAvatarEditor({ fresh: true, onDone: onPick, onCancel });
  const cur = loadAvatar();
  const body = `<p style="font-size:19px;margin-top:0">${esc(text)}</p>
    <div class="av-pick">${list.map((a, i) => `<div class="av-card ${cur.id === a.id ? 'on' : ''}" style="--pc:${esc(avatarColor(a))}">
        <button class="av-card-main" data-pick="${i}"><span data-face="${i}"></span><b>${esc(a.name)}</b></button>
        <div class="av-card-tools"><button class="btn btn-small" data-edit="${i}" title="Ändra ${esc(a.name)}">✏️</button><button class="btn btn-small" data-del="${i}" title="Ta bort ${esc(a.name)}">🗑</button></div>
      </div>`).join('')}
      <button class="av-card av-new" data-new><span>✚</span><b>Ny avatar</b></button>
    </div>`;
  const dlg = openModal(title, body, [{ label: 'Avbryt', onClick: () => { closeModal(); onCancel?.(); } }]);
  dlg.classList.add('dlg-wide');
  const x = dlg.querySelector('[data-close]');
  if (x) x.onclick = () => { closeModal(); onCancel?.(); };
  dlg.querySelectorAll('[data-face]').forEach((el) => el.replaceWith(avatarPortrait(list[+el.dataset.face], 64)));
  dlg.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => { const av = saveAvatar(list[+b.dataset.pick]); closeModal(); onPick?.(av); }));
  dlg.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => {
    saveAvatar(list[+b.dataset.edit]);
    openAvatarEditor({ onDone: (av) => onPick?.(av), onCancel: () => openAvatarPicker({ title, text, onPick, onCancel }) });
  }));
  dlg.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => {
    const a = list[+b.dataset.del];
    if (!confirm(`Ta bort avataren ${a.name}?`)) return;
    deleteAvatar(a.id);
    openAvatarPicker({ title, text, onPick, onCancel });
  }));
  dlg.querySelector('[data-new]').onclick = () => openAvatarEditor({ fresh: true, onDone: (av) => onPick?.(av), onCancel: () => openAvatarPicker({ title, text, onPick, onCancel }) });
}

export function avatarColor(av) {
  return col(av?.color, null) || colorFromName(av?.name);
}

// Namnskyltens färger (mörk eller vit text beroende på markörfärgen)
export function avatarTagColors(av) {
  const bg = avatarColor(av), n = parseInt(bg.slice(1), 16);
  const lum = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255);
  return { bg, fg: lum > 150 ? '#17151a' : '#ffffff', border: '#17151a' };
}

const hexMix = (a, b, t) => {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((x >> s) & 255) + ((((y >> s) & 255) - ((x >> s) & 255)) * t));
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
};
const portraitBg = (av) => hexMix(avatarColor(av), '#efe6d6', 0.62);

// Kvadratiskt porträtt (huvud + axlar) för lobbylistor; `size` = CSS-pixlar
export function avatarPortrait(av, size = 48) {
  const look = av && av.look && typeof av.look === 'object' ? av.look : {};
  const p = portrait(look, portraitBg(av));
  const k = Math.max(1, Math.round(globalThis.devicePixelRatio || 1));
  const c = document.createElement('canvas');
  c.width = c.height = size * k;
  c.style.width = c.style.height = size + 'px';
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(p, 0, 0, 80, 80, 0, 0, size * k, size * k);
  return c;
}

// ---------- redigeraren ----------
const uniq = (a) => [...new Set(a.map((c) => c.toLowerCase()))];
const CLOTH = uniq([...SHIRT, '#f28bb3', '#9fd356', '#1d1d22']);
const PAL = {
  skin: uniq([...SKIN, '#ffe3cc', '#3f2618']),
  hair: uniq([...HAIR, '#7b4fb8', '#e0702a']),
  hair2: uniq([...HAIR, '#7b4fb8', '#e0702a', '#f28bb3', '#3fc4ff']),
  shirt: CLOTH, accent: CLOTH, cap: CLOTH, print2: CLOTH, neckColor: CLOTH,
  pants: uniq([...PANTS, '#d9433b', '#3a7bd5', '#8e5bd1', '#b83d7a', '#f0b429', '#e8e3d6']),
  pants2: CLOTH,
  shoes: uniq([...SHOES, '#46a35a', '#8e5bd1', '#f28bb3']),
  shoes2: uniq([...SHOES, '#46a35a', '#8e5bd1', '#f28bb3', '#f0b429']),
  bagColor: uniq([...BAG_COLORS, '#2aa39a', '#f28bb3', '#e8e3d6']),
  phoneColor: uniq([...PHONE_COLORS, '#f0b429', '#46a35a', '#f28bb3', '#8e5bd1']),
  eyeColor: uniq(EYE_COLORS), lipColor: uniq(LIP_COLORS), shadowColor: uniq(SHADOW_COLORS), markColor: uniq(MARK_COLORS),
};
// färgfält som får vara tomma (null = motorns standard) – får en "Std"-ruta
const OPTIONAL = new Set(Object.keys(LOOK_COLORS).filter((k) => LOOK_COLORS[k] === null));
const COLOR_TITLE = {
  shirt: 'Färg', accent: 'Detaljfärg', print2: 'Tryckfärg', pants: 'Färg', pants2: 'Mönsterfärg', shoes: 'Färg', shoes2: 'Detaljfärg',
  cap: 'Färg', bagColor: 'Färg', phoneColor: 'Färg', neckColor: 'Färg', hair: 'Hårfärg', hair2: 'Andra hårfärgen', skin: 'Hud',
  eyeColor: 'Ögonfärg', lipColor: 'Läppfärg', shadowColor: 'Ögonskugga', markColor: 'Färg på målningen',
};

const TABS = [
  { id: 'skin', icon: '✋', label: 'Hud', title: 'Hudton' },
  { id: 'hair', icon: '💇', label: 'Hår', title: 'Frisyr' },
  { id: 'hairColor', icon: '🎨', label: 'Hårfärg', title: 'Hårfärg, slingor och toppar' },
  { id: 'eyes', icon: '👁️', label: 'Ögon', title: 'Ögon och ögonfärg' },
  { id: 'brows', icon: '🤨', label: 'Bryn', title: 'Ögonbryn' },
  { id: 'mouth', icon: '👄', label: 'Mun', title: 'Mun och näsa' },
  { id: 'makeup', icon: '💄', label: 'Smink', title: 'Smink' },
  { id: 'face', icon: '🙂', label: 'Ansikte', title: 'Kinder, fräknar, ansiktsmålning och öron' },
  { id: 'beard', icon: '🧔', label: 'Skägg', title: 'Skägg och mustasch' },
  { id: 'top', icon: '👕', label: 'Överdel', title: 'Tröjor, skjortor och jackor' },
  { id: 'bottom', icon: '👖', label: 'Underdel', title: 'Byxor, kjolar och klänningar' },
  { id: 'shoes', icon: '👟', label: 'Skor', title: 'Skor' },
  { id: 'hat', icon: '🧢', label: 'Huvud', title: 'Huvudbonader, hårspännen och hörlurar' },
  { id: 'glasses', icon: '👓', label: 'Glasögon', title: 'Glasögon' },
  { id: 'bag', icon: '🎒', label: 'Väska', title: 'Väskor' },
  { id: 'neck', icon: '📿', label: 'Hals', title: 'Hals och smycken: halsdukar, slipsar, halsband, örhängen' },
  { id: 'size', icon: '📏', label: 'Storlek', title: 'Ålder och kroppsbyggnad' },
];
const OLD_TAB = { face: 'face', phones: 'hat' }; // gamla sparade flikar
// vilka fält varje flik visar (för färgfält som posterna anger i `uses`)
const TAB_FIELDS = {
  hair: ['style'], hairColor: ['hairFx'], eyes: ['eyes'], brows: ['brows'], mouth: ['mouth', 'nose'], makeup: ['makeup'],
  face: ['cheeks', 'marks', 'ears'], beard: ['beard'], top: ['top', 'topPrint'], bottom: ['bottom', 'bottomPrint'],
  shoes: ['shoeType'], hat: ['hat', 'hairAcc', 'phones'], glasses: ['glasses'], bag: ['bag'], neck: ['neck', 'jewel'],
};

const LBL = {
  blush: { false: 'Utan', true: 'Rosiga' },
  kid: { false: 'Vuxen', true: 'Barn' },
  build: { 4: 'Smal', 5: 'Mellan', 6: 'Bred' },
};

// Utsnitt ur spriten (24×41, fötterna vid 12,39) för småbilderna i knapparna
const VIEWS = {
  head: { dir: 'down', crop: (L) => [2, L.kid ? 9 : 1, 20, 20], scale: 3 },
  face: { dir: 'down', crop: (L) => [4, L.kid ? 12 : 4, 15, 15], scale: 4 },
  neck: { dir: 'down', crop: (L) => [4, L.kid ? 18 : 10, 16, 16], scale: 4 },
  torso: { dir: 'down', crop: (L) => [2, L.kid ? 16 : 12, 20, 20], scale: 3 },
  legs: { dir: 'down', crop: (L) => [2, L.kid ? 21 : 20, 20, 20], scale: 3 },
  side: { dir: 'right', crop: (L) => [2, L.kid ? 16 : 12, 20, 20], scale: 3 },
  full: { dir: 'down', crop: () => [0, 0, 24, 41], scale: 2 },
};
// En registerpost eller ett katalogplagg kan välja eget utsnitt med `tile: 'torso'` o.s.v.
// (t.ex. handskar och klockor under Smycken, som annars visas som huvud).
const viewFor = (fallback, ...hints) => { for (const h of hints) if (h && Object.hasOwn(VIEWS, h)) return VIEWS[h]; return fallback; };

function tileCanvas(look, view) {
  const src = document.createElement('canvas'); src.width = 24; src.height = 41;
  drawPerson(src.getContext('2d'), 12, 39, look, view.dir, 0);
  const [sx, sy, sw, sh] = view.crop(look), s = view.scale;
  const c = document.createElement('canvas'); c.width = sw * s; c.height = sh * s;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(src, sx, sy, sw, sh, 0, 0, sw * s, sh * s);
  return c;
}

// Extra stilar för de nya delarna (style.css ägs av andra – håll redigerarens tillägg här)
function injectStyle() {
  if (typeof document === 'undefined' || document.getElementById('av-style-v2')) return;
  const st = document.createElement('style');
  st.id = 'av-style-v2';
  st.textContent = `
.dlg-avatar .av-tabs { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 4px; }
.dlg-avatar .av-tab { flex-direction: row; justify-content: center; gap: 4px; padding: 3px 4px 2px; font-size: 15px; }
.dlg-avatar .av-tab i { font-size: 16px; }
.dlg-avatar .av-sub { font: 16px var(--head); font-weight: 400; text-transform: uppercase; letter-spacing: .8px; color: var(--muted); margin: 4px 0 5px; }
.dlg-avatar .av-tile i[data-c] { display: block; width: 60px; height: 60px; background: #ece4d5; }
.dlg-avatar .av-tiles.tall .av-tile i[data-c] { width: 48px; height: 82px; background: none; }
.dlg-avatar .av-more { font-size: 17px; line-height: 1; color: var(--muted); margin: -2px 0 8px; }
.dlg-avatar .av-sw.av-std { background: repeating-linear-gradient(45deg, #fff 0 4px, #dcd6cc 4px 8px); font: 14px/30px var(--head); color: var(--ink); text-align: center; }
@media (max-width: 639px) {
  .dlg-avatar .av-tabs { grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 3px; }
  .dlg-avatar .av-tab { font-size: 13px; padding: 1px 2px 0; }
  .dlg-avatar .av-tab i { font-size: 14px; }
}`;
  document.head.appendChild(st);
}

// Scen: rutigt butiksgolv som rullar när figuren går på stället
const STAGE_W = 40, STAGE_H = 54, FEET_Y = 43, TILE = 10;
const DIRS = ['down', 'left', 'up', 'right'];
const WALK_SEQ = [1, 3, 2, 3];
const MOVE = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

function drawFloor(ctx, camX, camY) {
  const cx = Math.round(camX), cy = Math.round(camY);
  const i0 = Math.floor(cx / TILE), j0 = Math.floor(cy / TILE);
  for (let j = j0; j * TILE < cy + STAGE_H; j++) for (let i = i0; i * TILE < cx + STAGE_W; i++) {
    const x = i * TILE - cx, y = j * TILE - cy, h = ((i * 73856093) ^ (j * 19349663)) >>> 0;
    ctx.fillStyle = (i + j) & 1 ? '#e2d7c3' : '#eae1d0'; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#f3ecdf'; ctx.fillRect(x, y, TILE - 1, 1);
    ctx.fillStyle = '#cbbda5'; ctx.fillRect(x + TILE - 1, y, 1, TILE); ctx.fillRect(x, y + TILE - 1, TILE, 1);
    ctx.fillStyle = '#d6cab4'; ctx.fillRect(x + 2 + (h % 6), y + 2 + ((h >> 3) % 6), 1, 1); ctx.fillRect(x + 1 + ((h >> 6) % 7), y + 3 + ((h >> 9) % 5), 1, 1);
  }
  // mjuk skugga i kanterna (trappsteg, inga halvpixlar)
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = `rgba(40,28,52,${0.14 - k * 0.04})`;
    ctx.fillRect(0, k, STAGE_W, 1); ctx.fillRect(0, STAGE_H - 1 - k, STAGE_W, 1);
    ctx.fillRect(k, 0, 1, STAGE_H); ctx.fillRect(STAGE_W - 1 - k, 0, 1, STAGE_H);
  }
}

let lastTab = 'skin';
const clean = (s) => String(s ?? '').replace(/\u00ad/g, '');

export function openAvatarEditor({ onDone, onCancel, fresh = false } = {}) {
  injectStyle();
  const saved = fresh ? { name: '', look: defaultLook(), color: rnd(MARKER_COLORS) } : loadAvatar();
  const avId = fresh ? '' : saved.id; // en ny figur får ett eget id, även om namnet redan finns
  const cur = { name: saved.name || (fresh ? '' : rnd(FIRST_NAMES)), look: saved.look, color: saved.color };
  const start = { ...cur };
  const want = OLD_TAB[lastTab] || lastTab;
  let tab = TABS.some((t) => t.id === want) ? want : 'skin';
  let adultBuild = cur.look.kid ? 5 : cur.look.build; // kroppsbyggnaden tillbaka när man byter barn → vuxen

  const body = `<div class="av">
    <div class="av-side">
      <div class="av-stage"><canvas class="av-cv" aria-label="Förhandsvisning av avataren"></canvas><div class="av-tag"></div></div>
      <div class="av-ctrl">
        <button class="btn btn-small" data-turn="-1" title="Vrid åt vänster" aria-label="Vrid åt vänster">⟲</button>
        <button class="btn btn-small av-play" data-play title="Pausa" aria-label="Pausa">⏸</button>
        <button class="btn btn-small" data-turn="1" title="Vrid åt höger" aria-label="Vrid åt höger">⟳</button>
      </div>
      <div class="av-id">
        <div class="av-face"></div>
        <div class="av-namebox">
          <label for="av-name" class="av-lbl">Namn</label>
          <div class="av-namerow"><input id="av-name" type="text" maxlength="${NAME_MAX}" autocomplete="off" spellcheck="false" placeholder="Ditt namn"><button class="btn btn-small" data-suggest title="Föreslå ett namn" aria-label="Föreslå ett namn">🎲</button></div>
          <div class="av-err" aria-live="polite"></div>
        </div>
      </div>
      <div class="av-marker"><div class="av-lbl">Namnskylt</div><div class="av-mk"></div></div>
    </div>
    <div class="av-main">
      <div class="av-tabs" role="tablist">${TABS.map((t) => `<button class="av-tab" role="tab" data-tab="${t.id}" title="${esc(t.title)}"><i>${t.icon}</i><span>${esc(t.label)}</span></button>`).join('')}</div>
      <div class="av-panel" role="tabpanel"></div>
    </div>
  </div>`;

  const dlg = openModal('🧑 Min avatar', body, [
    { label: '🎲 Slumpa', cls: 'av-rand', onClick: () => randomize() },
    { label: '↺ Återställ', cls: 'av-reset', onClick: () => { Object.assign(cur, start); input.value = cur.name; setErr(''); changed(); } },
    { label: 'Avbryt', cls: 'av-cancel', onClick: () => { closeModal(); onCancel?.(); } },
    { label: '<span class="av-ico">💾 </span>Spara', cls: 'btn-go av-save', onClick: () => save() },
  ]);
  dlg.classList.add('dlg-avatar');
  // Klick utanför ska inte kasta bort ändringarna – stäng med ✕ eller Avbryt
  if (dlg.parentElement) dlg.parentElement.onclick = null;
  const xBtn = dlg.querySelector('[data-close]');
  if (xBtn) xBtn.onclick = () => { closeModal(); onCancel?.(); };

  const $ = (s) => dlg.querySelector(s);
  const cv = $('.av-cv'), ctx = cv.getContext('2d'), tagEl = $('.av-tag'), faceEl = $('.av-face');
  const input = $('#av-name'), errEl = $('.av-err'), panel = $('.av-panel'), mk = $('.av-mk'), playBtn = $('[data-play]');
  input.value = cur.name;

  // ---------- förhandsvisning ----------
  let S = 0, dirIdx = 0, playing = true, segT = 0, camX = 0, camY = 0, last = performance.now(), drawn = '';
  const fit = () => {
    const w = window.innerWidth, h = window.innerHeight;
    const s = w < 640 || h < 520 ? 3 : h < 720 ? 5 : 6; // mobil 3×, skrivbord 5–6×
    if (s === S) return;
    S = s;
    const k = S * Math.max(1, Math.round(window.devicePixelRatio || 1));
    cv.width = STAGE_W * k; cv.height = STAGE_H * k;
    cv.style.width = STAGE_W * S + 'px'; cv.style.height = STAGE_H * S + 'px';
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = false;
    drawn = '';
  };
  fit();
  const onResize = () => fit();
  window.addEventListener('resize', onResize);

  const tick = (now) => {
    if (!cv.isConnected) { window.removeEventListener('resize', onResize); lazy.stop(); return; } // dialogen stängd
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    let frame = 0;
    const dir = DIRS[dirIdx];
    if (playing) {
      segT += dt;
      if (segT >= 3.4) { segT = 0; dirIdx = (dirIdx + 1) % 4; }
      if (segT < 2.4) {
        frame = WALK_SEQ[Math.floor(segT * 8.5) % 4];
        camX += MOVE[dir][0] * 14 * dt; camY += MOVE[dir][1] * 14 * dt;
      } else frame = segT > 2.9 && segT < 3.05 ? 4 : 0;
    } else frame = Math.sin(now / 480) > 0.86 ? 4 : 0;
    const key = `${S}|${DIRS[dirIdx]}|${frame}|${Math.round(camX)}|${Math.round(camY)}`;
    if (key !== drawn || !drawn) {
      drawn = key;
      drawFloor(ctx, camX, camY);
      drawPerson(ctx, STAGE_W / 2, FEET_Y, cur.look, DIRS[dirIdx], frame);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const turn = (d) => { dirIdx = (dirIdx + d + 4) % 4; segT = 0; drawn = ''; };
  dlg.querySelectorAll('[data-turn]').forEach((b) => (b.onclick = () => turn(+b.dataset.turn)));
  playBtn.onclick = () => {
    playing = !playing; segT = 0; drawn = '';
    playBtn.textContent = playing ? '⏸' : '▶';
    playBtn.title = playing ? 'Pausa' : 'Spela';
    playBtn.setAttribute('aria-label', playBtn.title);
  };
  cv.onclick = () => turn(1);

  // ---------- namn + markörfärg ----------
  const setErr = (t) => { errEl.textContent = t; input.classList.toggle('bad', !!t); };
  input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') input.blur(); });
  input.addEventListener('keyup', (e) => e.stopPropagation());
  input.oninput = () => { cur.name = input.value; if (cleanName(cur.name)) setErr(''); updateTag(); };
  $('[data-suggest]').onclick = () => { cur.name = input.value = rnd(FIRST_NAMES.filter((n) => n !== cur.name)); setErr(''); updateTag(); };

  const updateTag = () => {
    const c = avatarTagColors(cur);
    tagEl.textContent = cleanName(cur.name) || '???';
    tagEl.style.background = c.bg; tagEl.style.color = c.fg;
  };
  const renderMarkers = () => {
    mk.innerHTML = MARKER_COLORS.map((c) => `<button class="av-sw ${c === cur.color ? 'on' : ''}" data-mark="${c}" style="--c:${c}" title="Markörfärg" aria-label="Markörfärg ${c}" aria-pressed="${c === cur.color}"></button>`).join('');
  };
  mk.onclick = (e) => { const b = e.target.closest('[data-mark]'); if (!b) return; cur.color = b.dataset.mark; renderMarkers(); updateTag(); updateFace(); };

  const updateFace = () => { faceEl.replaceChildren(portrait(cur.look, portraitBg(cur))); };

  // ---------- lat rutritning: bara synliga rutor, några per bildruta ----------
  const lazy = (() => {
    let queue = [], pending = [], io = null, raf = 0;
    const pump = () => {
      raf = 0;
      const t0 = performance.now();
      while (queue.length && performance.now() - t0 < 10) {
        const el = queue.shift();
        if (!el.isConnected) continue;
        const [look, view] = pending[+el.dataset.c] || [];
        if (look) el.replaceWith(tileCanvas(look, view));
      }
      if (queue.length) raf = requestAnimationFrame(pump);
    };
    const want = (el) => { if (!queue.includes(el)) queue.push(el); if (!raf) raf = requestAnimationFrame(pump); };
    return {
      start(list) {
        this.stop();
        pending = list;
        const els = [...panel.querySelectorAll('i[data-c]')];
        if (typeof IntersectionObserver === 'undefined') { els.forEach(want); return; }
        io = new IntersectionObserver((ents) => {
          for (const en of ents) if (en.isIntersecting) { io.unobserve(en.target); want(en.target); }
        }, { root: panel, rootMargin: '160px 0px' });
        els.forEach((el) => io.observe(el));
      },
      stop() { io?.disconnect(); io = null; queue = []; if (raf) cancelAnimationFrame(raf); raf = 0; },
    };
  })();

  // ---------- flikar + val ----------
  const tabsEl = $('.av-tabs');
  tabsEl.onclick = (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    tab = lastTab = b.dataset.tab; panel.scrollTop = 0; renderPanel();
  };

  const same = (a, b) => (a ?? null) === (b ?? null) || (a === false && b === null) || (a === null && b === false);
  const renderPanel = () => {
    const L = cur.look;
    tabsEl.querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    const pending = [];
    const shown = new Set(); // färgfält som redan har rutor i fliken
    const owned = AVOWNED ? ownedIds() : null;

    // en ruta: look = hur rutan ritas, attrs = data-attribut för klicket
    const tile = ({ look, view, label, on, attrs, disabled = false, title }) => {
      const i = pending.push([look, view]) - 1;
      return `<button class="av-tile ${on ? 'on' : ''}" ${attrs} aria-pressed="${on}" ${disabled ? 'disabled' : ''} title="${esc(clean(title || label))}"><i data-c="${i}"></i>${label ? `<span>${esc(label)}</span>` : ''}</button>`;
    };
    const grid = (html, view) => `<div class="av-tiles ${view === VIEWS.full ? 'tall' : ''}">${html}</div>`;
    // grupperar [{ group, html }] under underrubriker om det finns fler än en grupp
    const grouped = (items, view) => {
      const order = [], by = new Map();
      for (const it of items) { const g = it.group || ''; if (!by.has(g)) { by.set(g, []); order.push(g); } by.get(g).push(it.html); }
      if (order.length < 2) return grid(items.map((it) => it.html).join(''), view);
      return order.map((g) => `${g ? `<h5 class="av-sub">${esc(g)}</h5>` : ''}${grid(by.get(g).join(''), view)}`).join('');
    };
    // enkla värden (hud, ålder …)
    const tiles = (key, values, view, { labels = LBL[key], disabled = false, patch = null } = {}) =>
      grid(values.map((v) => tile({
        look: { ...L, [key]: v, ...(patch ? patch(v) : {}) }, view, label: labels ? labels[String(v)] : '', on: same(L[key], v),
        attrs: `data-k="${key}" data-v="${esc(JSON.stringify(v))}"`, disabled,
      })).join(''), view);
    // registerval (frisyr, ögon, skägg …) – alla poster, grupperade
    const regTiles = (field, view, { disabled = false, patch = null } = {}) => {
      const F = LOOK_FIELDS[field], curId = idOf(field, L[field]);
      return grouped(Object.keys(F.reg).map((id) => {
        const v = valueOf(field, id), e = F.reg[id];
        return {
          group: id === 'none' ? '' : e.group,
          html: tile({ look: { ...L, [field]: v, ...(patch ? patch(v) : {}) }, view: viewFor(view, e.tile), label: e.label, on: curId === id, attrs: `data-k="${field}" data-v="${esc(JSON.stringify(v))}"`, disabled }),
        };
      }), view);
    };
    // plagg ur katalogen – bara de man äger (+ basplagg, + det man har på sig)
    const itemTiles = (slot, view, { patch = null } = {}) => {
      const all = itemsForSlot(slot), worn = wornItem(L, slot), empty = slotIsEmpty(L, slot);
      const usable = all.filter((it) => avatarCanWear(it, owned));
      const list = worn && !usable.includes(worn) ? [worn, ...usable] : usable;
      const out = [];
      const main = Object.keys(SLOT_FIELDS[slot])[0];
      if (SLOT_CAN_BE_EMPTY[slot]) out.push({ group: '', html: tile({ look: { ...lookWithoutSlot(slot, L), ...(patch ? patch() : {}) }, view, label: entryOf(main, SLOT_FIELDS[slot][main])?.label || 'Ingen', on: empty, attrs: `data-empty="${slot}"` }) });
      if (!worn && !empty) out.push({ group: '', html: tile({ look: { ...L, ...(patch ? patch() : {}) }, view, label: 'Nuvarande', on: true, attrs: 'data-keep="1"' }) });
      for (const it of list) out.push({ group: groupOf(it), html: tile({ look: { ...lookForItem(it, L), ...(patch ? patch() : {}) }, view: viewFor(view, it.tile, entryOf(main, it.look[main])?.tile), label: it.name, on: worn === it, attrs: `data-item="${esc(it.id)}"` }) });
      const locked = all.filter((it) => !list.includes(it)).length;
      return grouped(out, view) + (locked ? `<p class="av-more">🔒 ${locked} fler i klädaffären</p>` : '');
    };
    const swatches = (key, { dim = false, ownOnly = false } = {}) => {
      shown.add(key);
      const v = L[key], pal = PAL[key] || CLOTH, opt = OPTIONAL.has(key), own = v != null && !pal.includes(v);
      const std = opt ? `<button class="av-sw av-std ${v == null ? 'on' : ''}" data-k="${key}" data-v="null" title="Standard" aria-label="Standardfärg" aria-pressed="${v == null}">Std</button>` : '';
      return `<div class="av-sws ${dim ? 'dim' : ''}">${std}${(ownOnly ? [] : pal).map((c) => `<button class="av-sw ${c === v ? 'on' : ''}" data-k="${key}" data-v="${esc(JSON.stringify(c))}" style="--c:${c}" aria-label="Färg ${c}" aria-pressed="${c === v}"></button>`).join('')}
        <label class="av-sw av-own ${own ? 'on' : ''}" style="--c:${own ? v : '#ffffff'}" title="Egen färg"><input type="color" data-own="${key}" value="${v || '#ffffff'}" aria-label="Egen färg"><b>${own ? '' : '+'}</b></label></div>`;
    };
    const sec = (title, inner, hint = '') => `<section class="av-sec"><h4>${esc(title)}</h4>${hint ? `<p class="av-hint">${hint}</p>` : ''}${inner}</section>`;
    const colorSec = (key, opts = {}, hint = '') => sec(COLOR_TITLE[key] || 'Färg', swatches(key, opts), hint);
    // färgfält som de valda posterna säger att de använder (uses: ['accent', …])
    const extraColors = () => {
      let h = '';
      for (const f of TAB_FIELDS[tab] || []) for (const k of entryOf(f, f === 'cheeks' ? L.cheeks : L[f])?.uses || []) {
        if (shown.has(k) || !(k in LOOK_COLORS)) continue;
        h += colorSec(k);
      }
      return h;
    };
    const noHead = () => ({ hat: null, phones: false, hairAcc: 'none' });

    let html = '';
    switch (tab) {
      case 'skin': html = sec('Hudton', tiles('skin', PAL.skin, VIEWS.head, { labels: null })) + sec('Egen färg', swatches('skin', { ownOnly: true }), 'Grön rymdvarelse? Välj vilken färg du vill.'); break;
      case 'hair':
        html = sec('Frisyr', regTiles('style', VIEWS.head, { patch: noHead }), L.hat || L.phones || L.hairAcc !== 'none' ? 'Bilderna visas utan huvudbonad, hårspänne och hörlurar.' : '');
        break;
      case 'hairColor':
        html = colorSec('hair', {}, 'Gäller även skägg och ögonbryn.')
          + sec('Slingor, toppar & tvåfärgat', regTiles('hairFx', VIEWS.head, { patch: noHead }))
          + colorSec('hair2', { dim: L.hairFx === 'none' }, 'Den andra färgen i slingor, toppar och tvåfärgat hår.');
        break;
      case 'eyes': html = sec('Ögon', regTiles('eyes', VIEWS.face, { patch: () => ({ glasses: false }) })) + colorSec('eyeColor', {}, 'Std = mörka ögon.'); break;
      case 'brows': html = sec('Ögonbryn', regTiles('brows', VIEWS.face, { patch: () => ({ glasses: false }) }), 'Brynen har samma färg som håret.'); break;
      case 'mouth': html = sec('Mun', regTiles('mouth', VIEWS.face)) + sec('Näsa', regTiles('nose', VIEWS.face)); break;
      case 'makeup':
        html = sec('Smink', regTiles('makeup', VIEWS.face, { patch: () => ({ glasses: false }) }))
          + colorSec('lipColor', { dim: L.makeup === 'none' }) + colorSec('shadowColor', { dim: L.makeup === 'none' });
        break;
      case 'face':
        html = sec('Kinder', regTiles('cheeks', VIEWS.face))
          + sec('Fräknar, märken & ansiktsmålning', regTiles('marks', VIEWS.face)) + colorSec('markColor', { dim: L.marks === 'none' })
          + sec('Öron', regTiles('ears', VIEWS.head, { patch: noHead }));
        break;
      case 'beard': html = sec('Skägg & mustasch', regTiles('beard', VIEWS.face, { disabled: L.kid }), L.kid ? 'Barn har inget skägg – byt till vuxen under 📏 Storlek.' : 'Skägget har samma färg som håret.'); break;
      case 'top':
        html = sec('Överdel', itemTiles('top', VIEWS.torso, { patch: () => ({ apron: false, bag: null, neck: 'none' }) }), L.apron ? 'Bilderna visas utan förkläde.' : '')
          + colorSec('shirt') + colorSec('accent', {}, 'Ränder, dragkedja, krage, knappar och tryck.')
          + (L.topPrint !== 'none' ? colorSec('print2', {}, 'Mönstrets färg. Std = detaljfärgen.') : '');
        break;
      case 'bottom': {
        const cf = entryOf('bottom', L.bottom)?.colorField || 'pants';
        html = sec('Underdel', itemTiles('bottom', VIEWS.legs, { patch: () => ({ apron: false, bag: null }) }), L.apron ? 'Bilderna visas utan förkläde.' : '')
          + colorSec(cf, {}, cf === 'shirt' ? 'Samma färg som överdelen.' : '')
          + (L.bottomPrint !== 'none' ? colorSec('pants2', {}, 'Mönstrets färg. Std = detaljfärgen.') : '');
        break;
      }
      case 'shoes': html = sec('Skor', itemTiles('shoes', VIEWS.legs)) + colorSec('shoes'); break;
      case 'hat':
        html = sec('Huvudbonad', itemTiles('hat', VIEWS.head, { patch: () => ({ phones: false }) })) + colorSec('cap', { dim: !L.hat })
          + sec('I håret', itemTiles('hairAcc', VIEWS.head, { patch: () => ({ hat: null }) }))
          + sec('Hörlurar', itemTiles('phones', VIEWS.head)) + colorSec('phoneColor', { dim: !L.phones });
        break;
      case 'glasses': html = sec('Glasögon', itemTiles('glasses', VIEWS.face)); break;
      case 'bag': html = sec('Väska', itemTiles('bag', VIEWS.side)) + colorSec('bagColor', { dim: !L.bag }); break;
      case 'neck':
        html = sec('Hals', itemTiles('neck', VIEWS.neck, { patch: () => ({ bag: null }) })) + colorSec('neckColor', { dim: L.neck === 'none' }, 'Std = detaljfärgen.')
          + sec('Smycken', itemTiles('jewel', VIEWS.head, { patch: () => ({ hat: null, phones: false }) }));
        break;
      case 'size':
        html = sec('Ålder', tiles('kid', [false, true], VIEWS.full, { patch: (v) => (v ? { beard: false } : { build: adultBuild }) }))
          + sec('Kroppsbyggnad', tiles('build', BUILDS, VIEWS.full, { disabled: L.kid, patch: () => ({ kid: false }) }), L.kid ? 'Barn har alltid samma kroppsbyggnad.' : '');
        break;
    }
    html += extraColors();
    // behåll fokus + scroll när panelen ritas om
    const act = document.activeElement, fk = act?.dataset?.k || act?.dataset?.item || act?.dataset?.empty, top = panel.scrollTop;
    const fsel = act?.dataset ? (act.dataset.k ? `[data-k="${act.dataset.k}"][data-v='${act.dataset.v}']` : act.dataset.item ? `[data-item="${act.dataset.item}"]` : act.dataset.empty ? `[data-empty="${act.dataset.empty}"]` : null) : null;
    panel.innerHTML = html;
    panel.scrollTop = top;
    lazy.start(pending);
    if (fk && fsel && panel.contains(act) === false) {
      try { panel.querySelector(fsel)?.focus({ preventScroll: true }); } catch { /* ogiltig selektor */ }
    }
  };

  // ---------- ändringar ----------
  const firstUsable = (slot) => itemsForSlot(slot).find((it) => avatarCanWear(it));
  const setLook = (L, redraw = true) => { cur.look = cleanLook(L); changed(redraw); }; // nytt objekt → spritecachen ritar om
  const set = (k, v, redraw = true) => {
    const L = cur.look, patch = { [k]: v };
    if (k === 'kid') Object.assign(patch, v ? { beard: false } : { build: adultBuild });
    // färg på något man inte har på sig: ta på det första plagget man äger
    const wear = { cap: 'hat', bagColor: 'bag', phoneColor: 'phones', neckColor: 'neck' }[k];
    if (wear && slotIsEmpty(L, wear)) { const it = firstUsable(wear); if (it) Object.assign(patch, lookForItem(it, {})); }
    setLook({ ...L, ...patch }, redraw);
  };
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled || !panel.contains(b)) return;
    if (b.dataset.item) { const it = itemById(b.dataset.item); if (it) setLook(lookForItem(it, cur.look)); return; }
    if (b.dataset.empty) { setLook(lookWithoutSlot(b.dataset.empty, cur.look)); return; }
    if (b.dataset.k) set(b.dataset.k, JSON.parse(b.dataset.v));
  });
  // egen färg: uppdatera figuren medan man drar, rita om panelen när man släpper
  panel.addEventListener('input', (e) => { const k = e.target.dataset?.own; if (k && HEX.test(e.target.value)) set(k, e.target.value, false); });
  panel.addEventListener('change', (e) => { const k = e.target.dataset?.own; if (k && HEX.test(e.target.value)) set(k, e.target.value, true); });

  function changed(redraw = true) {
    drawn = '';
    if (!cur.look.kid) adultBuild = cur.look.build;
    updateFace(); updateTag(); renderMarkers();
    if (redraw) renderPanel();
  }

  function randomize() {
    const L = makeLook(), kid = cur.look.kid;
    const owned = AVOWNED ? ownedIds() : null;
    const usable = (slot) => itemsForSlot(slot).filter((it) => avatarCanWear(it, owned));
    const chance = (p) => Math.random() < p;
    const other = (field) => rnd(listOf(field).filter((v) => idOf(field, v) !== idOf(field, LOOK_FIELDS[field].def)));
    let look = { ...L, kid, apron: cur.look.apron, build: kid ? 4 : rnd(BUILDS), style: rnd(HAIR_STYLES) };
    // plagg: bara sådant man äger
    const bottoms = usable('bottom'), dress = bottoms.find((it) => it.look.bottom === 'dress'), rest = bottoms.filter((it) => it !== dress);
    look = lookForItem(rnd(usable('top')), look);
    look = lookForItem(chance(0.12) && dress ? dress : rnd(rest.length ? rest : bottoms), look);
    look = lookForItem(rnd(usable('shoes')), look);
    const hats = usable('hat');
    look = chance(0.55) || !hats.length ? lookWithoutSlot('hat', look) : lookForItem(rnd(hats), look);
    look = lookWithoutSlot('bag', look);
    for (const slot of ['glasses', 'phones']) { const it = wornItem(look, slot); if (it && !avatarCanWear(it, owned)) look = lookWithoutSlot(slot, look); }
    for (const [slot, p] of [['neck', 0.2], ['jewel', 0.2], ['hairAcc', 0.15]]) { const list = usable(slot); look = chance(p) && list.length ? lookForItem(rnd(list), look) : lookWithoutSlot(slot, look); }
    // ansikte: oftast standard, ibland något annat
    for (const [f, p] of [['eyes', 0.4], ['brows', 0.4], ['mouth', 0.4], ['nose', 0.3], ['ears', 0.15], ['makeup', 0.15], ['marks', 0.1], ['hairFx', 0.12]]) {
      const v = chance(p) ? other(f) : undefined;
      look[f] = v === undefined ? LOOK_FIELDS[f].def : v;
    }
    look.cheeks = L.blush ? 'blush' : 'none';
    if (look.hairFx !== 'none') look.hair2 = rnd(PAL.hair2);
    look.beard = kid || Math.random() > 0.3 ? false : rnd(listOf('beard').filter(Boolean));
    if (look.hat === 'crown' && chance(0.7)) look.cap = '#f0b429';
    setLook(look);
  }

  // Inget namn när man trycker Spara → en ruta ovanpå redigeraren frågar efter det
  // (i stället för ett litet rött meddelande som är lätt att missa).
  function askName() {
    if (dlg.querySelector('.av-nameask')) return;
    setErr('');
    const box = document.createElement('div');
    box.className = 'av-nameask';
    box.innerHTML = `<div class="av-nameask-box">
      <h3>Vad heter du?</h3>
      <p>Namnet står på din namnskylt när andra ser dig i Pixelstaden.</p>
      <input type="text" maxlength="14" placeholder="Ditt namn" autocomplete="off" spellcheck="false">
      <div class="av-nameask-err"></div>
      <div class="av-nameask-btns"><button class="btn" data-esc>Avbryt</button><button class="btn btn-go" data-ok>💾 Spara</button></div>
    </div>`;
    dlg.append(box);
    const inp = box.querySelector('input'), err = box.querySelector('.av-nameask-err');
    inp.value = input.value;
    setTimeout(() => inp.focus(), 30);
    const done = () => {
      const n = cleanName(inp.value);
      if (!n) { err.textContent = 'Skriv ett namn först!'; inp.focus(); return; }
      input.value = n;
      box.remove();
      changed();
      save();
    };
    box.querySelector('[data-ok]').onclick = done;
    box.querySelector('[data-esc]').onclick = () => { box.remove(); input.focus(); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(); } });
  }

  function save() {
    const name = cleanName(input.value);
    if (!name) { askName(); return; }
    const av = saveAvatar({ id: avId, name, look: cur.look, color: cur.color });
    closeModal();
    try { toast(`Sparat! Hej ${av.name} 👋`, 'good'); } catch { /* ingen toast-yta */ }
    onDone?.(av);
  }

  changed();
  return dlg;
}
