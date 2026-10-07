// Min avatar: spelarens egen figur (namn + utseende + markörfärg), sparad i localStorage,
// och redigeraren där man klär ut den. `look` är ett rent JSON-objekt som drawPerson förstår
// (det skickas över nätet i co-op) – kör alltid främmande data genom cleanAvatar/cleanLook.
//
// Redigeraren är byggd för hundratals val: flikar per kategori, täta rutnät som ritas lat
// (bara synliga rutor, i omgångar) och gruppknappar ur registrens `group` som visar en grupp
// i taget, så att den ryms utan att man scrollar ("Alla" visar allt under underrubriker).
// Namnet på det valda står i sektionens rubrik. Val som ritas
// (frisyr, ansikte …) kommer ur registren i js/core/people/*.js, plaggen ur klädkatalogen
// js/data/wardrobe.js – man ser bara plagg man äger (+ gratis basplagg; ett plagg man bär
// utan att äga det syns med 🔒 tills man byter bort det).
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
import { $t } from './i18n.js';

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

// ---------- frisören: frisyr och hårfärg byts i salongen (valbart, av som standard) ----------
// setAvatarSalon(true) ⇒ garderoben hemma visar frisyren och hårfärgen men man kan inte byta
// dem där – det gör man hos 💈 Frisören i stan (js/scenes/shop-frisor.js). Bara frisyren:
// setAvatarSalon({ style: true, color: false }). En ny figur (fresh) väljer fritt som förut,
// och openAvatarEditor({ salon: false }) släpper spärren för ett enskilt anrop.
let SALON = { style: false, color: false };
export function setAvatarSalon(on) {
  SALON = on && typeof on === 'object' ? { style: !!on.style, color: !!on.color } : { style: !!on, color: !!on };
}
export const avatarSalon = () => ({ ...SALON });
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
    // ryggnumret på fotbollströjan (lagets spelare) – bara med när det finns, så att andra figurer är oförändrade
    ...(Number.isInteger(L.shirtNum) && L.shirtNum >= 0 && L.shirtNum <= 99 ? { shirtNum: L.shirtNum } : {}),
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
export function openAvatarPicker({ title = $t('🧑 Vem spelar?'), text = $t('Välj din avatar eller skapa en ny.'), onPick, onCancel } = {}) {
  const list = listAvatars();
  if (!list.length) return openAvatarEditor({ fresh: true, onDone: onPick, onCancel });
  const cur = loadAvatar();
  const body = `<p style="font-size:var(--f2);margin-top:0">${esc(text)}</p>
    <div class="av-pick">${list.map((a, i) => `<div class="av-card ${cur.id === a.id ? 'on' : ''}" style="--pc:${esc(avatarColor(a))}">
        <button class="av-card-main" data-pick="${i}"><span data-face="${i}"></span><b>${esc(a.name)}</b></button>
        <div class="av-card-tools"><button class="btn btn-small" data-edit="${i}" title="${$t`Ändra ${esc(a.name)}`}">✏️</button><button class="btn btn-small" data-del="${i}" title="${$t`Ta bort ${esc(a.name)}`}">🗑</button></div>
      </div>`).join('')}
      <button class="av-card av-new" data-new><span>✚</span><b>${$t('Ny avatar')}</b></button>
    </div>`;
  const dlg = openModal(title, body, [{ label: $t('Avbryt'), onClick: () => { closeModal(); onCancel?.(); } }]);
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
    if (!confirm($t`Ta bort avataren ${a.name}?`)) return;
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
  shirt: $t('Färg'), accent: $t('Detaljfärg'), print2: $t('Tryckfärg'), pants: $t('Färg'), pants2: $t('Mönsterfärg'), shoes: $t('Färg'), shoes2: $t('Detaljfärg'),
  cap: $t('Färg'), bagColor: $t('Färg'), phoneColor: $t('Färg'), neckColor: $t('Färg'), hair: $t('Hårfärg'), hair2: $t('Andra hårfärgen'), skin: $t('Hud'),
  eyeColor: $t('Ögonfärg'), lipColor: $t('Läppfärg'), shadowColor: $t('Ögonskugga'), markColor: $t('Färg på målningen'),
};

const TABS = [
  { id: 'skin', icon: '✋', label: $t('Hud'), title: $t('Hudton') },
  { id: 'hair', icon: '💇', label: $t('Hår'), title: $t('Frisyr') },
  { id: 'hairColor', icon: '🎨', label: $t('Hårfärg'), title: $t('Hårfärg, slingor och toppar') },
  { id: 'eyes', icon: '👁️', label: $t('Ögon'), title: $t('Ögon och ögonfärg') },
  { id: 'brows', icon: '🤨', label: $t('Bryn'), title: $t('Ögonbryn') },
  { id: 'mouth', icon: '👄', label: $t('Mun'), title: $t('Mun och näsa') },
  { id: 'makeup', icon: '💄', label: $t('Smink'), title: $t('Smink') },
  { id: 'face', icon: '🙂', label: $t('Ansikte'), title: $t('Kinder, fräknar, ansiktsmålning och öron') },
  { id: 'beard', icon: '🧔', label: $t('Skägg'), title: $t('Skägg och mustasch') },
  { id: 'top', icon: '👕', label: $t('Överdel'), title: $t('Tröjor, skjortor och jackor') },
  { id: 'bottom', icon: '👖', label: $t('Underdel'), title: $t('Byxor, kjolar och klänningar') },
  { id: 'shoes', icon: '👟', label: $t('Skor'), title: $t('Skor') },
  { id: 'hat', icon: '🧢', label: $t('Huvud'), title: $t('Huvudbonader, hårspännen och hörlurar') },
  { id: 'glasses', icon: '👓', label: $t('Glasögon'), title: $t('Glasögon') },
  { id: 'bag', icon: '🎒', label: $t('Väska'), title: $t('Väskor') },
  { id: 'neck', icon: '📿', label: $t('Hals'), title: $t('Hals och smycken: halsdukar, slipsar, halsband, örhängen') },
  { id: 'size', icon: '📏', label: $t('Storlek'), title: $t('Ålder och kroppsbyggnad') },
];
const OLD_TAB = { face: 'face', phones: 'hat' }; // gamla sparade flikar
// vilka fält varje flik visar (för färgfält som posterna anger i `uses`)
const TAB_FIELDS = {
  hair: ['style'], hairColor: ['hairFx'], eyes: ['eyes'], brows: ['brows'], mouth: ['mouth', 'nose'], makeup: ['makeup'],
  face: ['cheeks', 'marks', 'ears'], beard: ['beard'], top: ['top', 'topPrint'], bottom: ['bottom', 'bottomPrint'],
  shoes: ['shoeType'], hat: ['hat', 'hairAcc', 'phones'], glasses: ['glasses'], bag: ['bag'], neck: ['neck', 'jewel'],
};

const LBL = {
  blush: { false: $t('Utan'), true: $t('Rosiga') },
  kid: { false: $t('Vuxen'), true: $t('Barn') },
  build: { 4: $t('Smal'), 5: $t('Mellan'), 6: $t('Bred') },
};

// Utsnitt ur spriten (24×41, fötterna vid 12,39) för småbilderna i knapparna.
// scale = heltalsskala på dator, cscale = i tätt läge (mobil/låg skärm). Alla utsnitt utom
// 'full' blir lika stora rutor (60 px på dator, 40–45 px tätt), så rutnätet blir jämnt.
const VIEWS = {
  head: { dir: 'down', crop: (L) => [2, L.kid ? 9 : 1, 20, 20], scale: 3, cscale: 2 },
  face: { dir: 'down', crop: (L) => [4, L.kid ? 12 : 4, 15, 15], scale: 4, cscale: 3 },
  neck: { dir: 'down', crop: (L) => [2, L.kid ? 16 : 8, 20, 20], scale: 3, cscale: 2 },
  torso: { dir: 'down', crop: (L) => [2, L.kid ? 16 : 12, 20, 20], scale: 3, cscale: 2 },
  legs: { dir: 'down', crop: (L) => [2, L.kid ? 21 : 20, 20, 20], scale: 3, cscale: 2 },
  side: { dir: 'right', crop: (L) => [2, L.kid ? 16 : 12, 20, 20], scale: 3, cscale: 2 },
  full: { dir: 'down', crop: () => [0, 0, 24, 41], scale: 2, cscale: 2 },
};
// En registerpost eller ett katalogplagg kan välja eget utsnitt med `tile: 'torso'` o.s.v.
// (t.ex. handskar och klockor under Smycken, som annars visas som huvud).
const viewFor = (fallback, ...hints) => { for (const h of hints) if (h && Object.hasOwn(VIEWS, h)) return VIEWS[h]; return fallback; };
// Tätt läge: mindre rutor på mobil och låga skärmar (samma brytpunkter som style.css)
const isCompact = () => typeof matchMedia === 'function' && matchMedia('(max-width: 639px), (max-height: 540px)').matches;

// s = skalan i CSS-pixlar; bitmappen ritas i s × enhetens pixeltäthet så att pixlarna blir skarpa
function tileCanvas(look, view, s) {
  const src = document.createElement('canvas'); src.width = 24; src.height = 41;
  drawPerson(src.getContext('2d'), 12, 39, look, view.dir, 0);
  const [sx, sy, sw, sh] = view.crop(look), k = s * Math.max(1, Math.round(globalThis.devicePixelRatio || 1));
  const c = document.createElement('canvas'); c.width = sw * k; c.height = sh * k;
  c.style.width = sw * s + 'px'; c.style.height = sh * s + 'px';
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(src, sx, sy, sw, sh, 0, 0, sw * k, sh * k);
  return c;
}

// Extra stilar för de nya delarna (style.css ägs av andra – håll redigerarens tillägg här)
function injectStyle() {
  if (typeof document === 'undefined' || document.getElementById('av-style-v2')) return;
  const st = document.createElement('style');
  st.id = 'av-style-v2';
  st.textContent = `
.dlg-avatar .av-tabs { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 4px; }
.dlg-avatar .av-tab { flex-direction: row; justify-content: center; gap: 4px; padding: 3px 4px 2px; font-size: var(--f1); }
.dlg-avatar .av-tab i { font-size: var(--f1); }
.dlg-avatar .av-sub { font: var(--f1) var(--head); font-weight: 400; text-transform: uppercase; letter-spacing: .8px; color: var(--muted); margin: 4px 0 5px; }
.dlg-avatar .av-tile i[data-c] { display: block; width: 60px; height: 60px; background: #ece4d5; }
.dlg-avatar .av-tiles.tall .av-tile i[data-c] { width: 48px; height: 82px; background: none; }
.dlg-avatar .av-more { font-size: var(--f2); line-height: 1; color: var(--muted); margin: -2px 0 8px; }
.dlg-avatar .av-sw.av-std { background: repeating-linear-gradient(45deg, #fff 0 4px, #dcd6cc 4px 8px); font: var(--f1)/26px var(--head); color: var(--ink); text-align: center; }
/* täta rutnät: bara bilder (namnet står i rubriken, i verktygstipset och läses upp) */
.dlg-avatar .av-sec h4 { display: flex; align-items: baseline; gap: 8px; min-width: 0; margin: 8px 0 5px; }
.dlg-avatar .av-now { font: var(--f2) var(--font); line-height: 1.05; text-transform: none; letter-spacing: 0; color: var(--ink); background: #fff4c7;
  border: 2px solid var(--ink); padding: 0 6px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dlg-avatar .av-now.peek { background: #fff; border-style: dashed; }
.dlg-avatar .av-tiles.bare { grid-template-columns: repeat(auto-fill, minmax(var(--tw, 68px), 1fr)); gap: 5px; margin-bottom: 6px; }
.dlg-avatar .av-tiles.bare .av-tile { padding: 2px; }
.dlg-avatar .av-tiles.bare .av-tile span { display: none; }
.dlg-avatar .av-tiles .av-tile.on::after { top: -6px; right: -6px; width: 16px; height: 16px; font-size: var(--f1); line-height: 13px; z-index: 1; }
.dlg-avatar .av-tile .lk { position: absolute; top: -6px; left: -6px; right: auto; width: 16px; height: 16px; font-size: var(--f1); line-height: 14px; font-style: normal;
  text-align: center; background: #fff; border: 2px solid var(--ink); box-sizing: border-box; z-index: 1; }
.dlg-avatar .av-tile.av-notown { border-style: dashed; }
/* grupper: knappar som filtrerar rutnätet, en grupp i taget */
.dlg-avatar .av-chips { position: relative; display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 6px; }
.dlg-avatar .av-chip { font: var(--f1) var(--font); line-height: 1; color: var(--ink); background: var(--paper2); border: 2px solid var(--ink); box-shadow: 1px 1px 0 var(--ink);
  padding: 2px 6px 1px; cursor: pointer; white-space: nowrap; flex: none; }
.dlg-avatar .av-chip b { font-weight: 400; color: var(--muted); margin-left: 4px; }
.dlg-avatar .av-chip.has { background: #fff4c7; }
.dlg-avatar .av-chip.has::before { content: "✓ "; color: var(--green2); }
.dlg-avatar .av-chip.on { background: var(--gold); transform: translate(1px, 1px); box-shadow: none; }
.dlg-avatar .av-chip.on b { color: var(--ink); }
.dlg-avatar .av-chip:hover:not(.on) { background: #fffbe8; }
.dlg-avatar .av-chip:focus-visible { outline: 3px solid var(--blue); outline-offset: 1px; }
.dlg-avatar .av-panel .av-sws { gap: 5px; }
.dlg-avatar .av-panel .av-sw { width: 28px; height: 28px; }
.dlg-avatar .av-panel .av-own b { font-size: var(--f2); }
@media (max-width: 639px) {
  .dlg-avatar .av-tabs { grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 3px; }
  .dlg-avatar .av-tab { font-size: var(--f1); padding: 1px 2px 0; }
  .dlg-avatar .av-tab i { font-size: var(--f1); }
  .dlg-avatar .av-chips { flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; padding-bottom: 4px; scrollbar-width: thin; }
  .dlg-avatar .av-chip { font-size: var(--f1); }
  .dlg-avatar .av-now { font-size: var(--f1); }
  .dlg-avatar .av-panel .av-sw { width: 30px; height: 30px; }
}
@media (max-height: 540px) and (min-width: 640px) {
  .dlg-avatar .av-tabs { grid-template-columns: repeat(auto-fill, minmax(54px, 1fr)); gap: 3px; } /* bara ikoner här */
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

export function openAvatarEditor({ onDone, onCancel, fresh = false, salon = null } = {}) {
  injectStyle();
  // frisyr/hårfärg som bara byts hos frisören (setAvatarSalon) – aldrig för en ny figur
  const salonOn = !fresh && salon !== false;
  const lockStyle = salonOn && SALON.style, lockColor = salonOn && SALON.color;
  const salonLocked = (k) => (lockStyle && k === 'style') || (lockColor && (k === 'hair' || k === 'hairFx' || k === 'hair2'));
  const saved = fresh ? { name: '', look: defaultLook(), color: rnd(MARKER_COLORS) } : loadAvatar();
  const avId = fresh ? '' : saved.id; // en ny figur får ett eget id, även om namnet redan finns
  const cur = { name: saved.name || (fresh ? '' : rnd(FIRST_NAMES)), look: saved.look, color: saved.color };
  const start = { ...cur };
  const want = OLD_TAB[lastTab] || lastTab;
  let tab = TABS.some((t) => t.id === want) ? want : 'skin';
  let adultBuild = cur.look.kid ? 5 : cur.look.build; // kroppsbyggnaden tillbaka när man byter barn → vuxen

  const body = `<div class="av">
    <div class="av-side">
      <div class="av-stage"><canvas class="av-cv" aria-label="${$t('Förhandsvisning av avataren')}"></canvas><div class="av-tag"></div></div>
      <div class="av-ctrl">
        <button class="btn btn-small" data-turn="-1" title="${$t('Vrid åt vänster')}" aria-label="${$t('Vrid åt vänster')}">⟲</button>
        <button class="btn btn-small av-play" data-play title="${$t('Pausa')}" aria-label="${$t('Pausa')}">⏸</button>
        <button class="btn btn-small" data-turn="1" title="${$t('Vrid åt höger')}" aria-label="${$t('Vrid åt höger')}">⟳</button>
      </div>
      <div class="av-id">
        <div class="av-face"></div>
        <div class="av-namebox">
          <label for="av-name" class="av-lbl">${$t('Namn')}</label>
          <div class="av-namerow"><input id="av-name" type="text" maxlength="${NAME_MAX}" autocomplete="off" spellcheck="false" placeholder="${$t('Ditt namn')}"><button class="btn btn-small" data-suggest title="${$t('Föreslå ett namn')}" aria-label="${$t('Föreslå ett namn')}">🎲</button></div>
          <div class="av-err" aria-live="polite"></div>
        </div>
      </div>
      <div class="av-marker"><div class="av-lbl">${$t('Namnskylt')}</div><div class="av-mk"></div></div>
    </div>
    <div class="av-main">
      <div class="av-tabs" role="tablist">${TABS.map((t) => `<button class="av-tab" role="tab" data-tab="${t.id}" title="${esc(t.title)}"><i>${t.icon}</i><span>${esc(t.label)}</span></button>`).join('')}</div>
      <div class="av-panel" role="tabpanel"></div>
    </div>
  </div>`;

  const dlg = openModal($t('🧑 Min avatar'), body, [
    { label: $t('🎲 Slumpa'), cls: 'av-rand', onClick: () => randomize() },
    { label: $t('↺ Återställ'), cls: 'av-reset', onClick: () => { Object.assign(cur, start); input.value = cur.name; setErr(''); groupSel.clear(); changed(); } },
    { label: $t('Avbryt'), cls: 'av-cancel', onClick: () => { closeModal(); onCancel?.(); } },
    { label: `<span class="av-ico">💾 </span>${$t('Spara')}`, cls: 'btn-go av-save', onClick: () => save() },
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
  const onResize = () => { fit(); if (isCompact() !== compact) renderPanel(); }; // tätt läge av/på ⇒ rita om rutorna
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
    playBtn.title = playing ? $t('Pausa') : $t('Spela');
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
    mk.innerHTML = MARKER_COLORS.map((c) => `<button class="av-sw ${c === cur.color ? 'on' : ''}" data-mark="${c}" style="--c:${c}" title="${$t('Markörfärg')}" aria-label="${$t`Markörfärg ${c}`}" aria-pressed="${c === cur.color}"></button>`).join('');
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
        const [look, view, s] = pending[+el.dataset.c] || [];
        if (look) el.replaceWith(tileCanvas(look, view, s));
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
  // Vald grupp per sektion ('style', 'slot:top' …): en grupp i taget ryms utan att man scrollar.
  // Första gången visas gruppen man har på sig; sedan ligger valet kvar tills man slumpar/återställer.
  const groupSel = new Map();
  const ALL = '*', CHIP_MIN = 12; // färre val än så: ett enda rutnät utan grupper
  let compact = isCompact();
  const renderPanel = () => {
    const L = cur.look;
    compact = isCompact();
    tabsEl.querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    const pending = [];
    const shown = new Set(); // färgfält som redan har rutor i fliken
    const owned = AVOWNED ? ownedIds() : null;
    const scaleOf = (view) => (compact ? view.cscale : view.scale);

    // en ruta: look = hur rutan ritas, attrs = data-attribut för klicket, notOwned = bärs men ägs inte
    const tile = ({ look, view, label, on, attrs, disabled = false, title, notOwned = false }) => {
      const s = scaleOf(view), [, , sw, sh] = view.crop(look);
      const i = pending.push([look, view, s]) - 1;
      const name = clean(title || label);
      const tip = notOwned ? $t`${name} – du har den på dig men äger den inte (finns i klädaffären)` : name;
      return `<button class="av-tile ${on ? 'on' : ''} ${notOwned ? 'av-notown' : ''}" ${attrs} aria-pressed="${on}" ${disabled ? 'disabled' : ''} title="${esc(tip)}"${name ? ` aria-label="${esc(tip)}"` : ''}>`
        + `<i data-c="${i}" style="width:${sw * s}px;height:${sh * s}px"></i>${notOwned ? '<i class="lk" aria-hidden="true">🔒</i>' : ''}${label ? `<span>${esc(label)}</span>` : ''}</button>`;
    };
    // rutnät: 'full' (stora figurer med namn) eller täta bildrutor; --tw = minsta rutbredd
    // (bredaste bilden i rutnätet + ram och luft)
    const grid = (html, view) => {
      if (view === VIEWS.full) return `<div class="av-tiles tall">${html}</div>`;
      let w = 0;
      for (const m of html.matchAll(/<i data-c="\d+" style="width:(\d+)px/g)) w = Math.max(w, +m[1]);
      return `<div class="av-tiles bare" style="--tw:${(w || 60) + 8}px">${html}</div>`;
    };
    // [{ group, html, on }] → ett rutnät. Många val i flera grupper ⇒ gruppknappar som filtrerar
    // (grupplösa val som "Ingen" syns alltid), "Alla" visar allt under underrubriker.
    const grouped = (items, view, key) => {
      const order = [], by = new Map();
      let curG = null;
      for (const it of items) {
        const g = it.group || '';
        if (!by.has(g)) { by.set(g, []); order.push(g); }
        by.get(g).push(it.html);
        if (it.on && curG === null) curG = g;
      }
      const named = order.filter(Boolean);
      if (named.length < 2 || items.length <= CHIP_MIN) return grid(items.map((it) => it.html).join(''), view);
      let sel = groupSel.get(key);
      if (sel !== ALL && !named.includes(sel)) sel = curG && named.includes(curG) ? curG : named[0];
      groupSel.set(key, sel);
      const chip = (g, label, n) => `<button class="av-chip${g === sel ? ' on' : ''}${g === curG ? ' has' : ''}" data-grp="${esc(key)}" data-g="${esc(g)}" aria-pressed="${g === sel}"`
        + ` title="${esc(g === curG ? $t`${label} – här finns det du har på dig` : label)}">${esc(label)}<b>${n}</b></button>`;
      const chips = `<div class="av-chips" role="group" aria-label="${$t('Grupper')}">${chip(ALL, $t('Alla'), items.length)}${named.map((g) => chip(g, $t(g), by.get(g).length)).join('')}</div>`;
      if (sel === ALL) return chips + order.map((g) => `${g ? `<h5 class="av-sub">${esc($t(g))}</h5>` : ''}${grid(by.get(g).join(''), view)}`).join('');
      return chips + grid([...(by.get('') || []), ...by.get(sel)].join(''), view);
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
          group: id === 'none' ? '' : e.group, on: curId === id,
          html: tile({ look: { ...L, [field]: v, ...(patch ? patch(v) : {}) }, view: viewFor(view, e.tile), label: e.label, on: curId === id, attrs: `data-k="${field}" data-v="${esc(JSON.stringify(v))}"`, disabled }),
        };
      }), view, field);
    };
    const regNow = (field) => clean(entryOf(field, L[field])?.label || '');
    // plagg ur katalogen – bara de man äger (+ basplagg, + det man har på sig)
    const itemTiles = (slot, view, { patch = null } = {}) => {
      const all = itemsForSlot(slot), worn = wornItem(L, slot), empty = slotIsEmpty(L, slot);
      const usable = all.filter((it) => avatarCanWear(it, owned));
      const wornLocked = !!worn && !usable.includes(worn); // bärs men ägs inte: syns, med 🔒
      const list = wornLocked ? [worn, ...usable] : usable;
      const out = [];
      const main = Object.keys(SLOT_FIELDS[slot])[0];
      if (SLOT_CAN_BE_EMPTY[slot]) out.push({ group: '', on: empty, html: tile({ look: { ...lookWithoutSlot(slot, L), ...(patch ? patch() : {}) }, view, label: entryOf(main, SLOT_FIELDS[slot][main])?.label || $t('Ingen'), on: empty, attrs: `data-empty="${slot}"` }) });
      if (!worn && !empty) out.push({ group: '', on: true, html: tile({ look: { ...L, ...(patch ? patch() : {}) }, view, label: $t('Nuvarande'), on: true, attrs: 'data-keep="1"' }) });
      for (const it of list) out.push({ group: groupOf(it), on: worn === it, html: tile({ look: { ...lookForItem(it, L), ...(patch ? patch() : {}) }, view: viewFor(view, it.tile, entryOf(main, it.look[main])?.tile), label: it.name, on: worn === it, attrs: `data-item="${esc(it.id)}"`, notOwned: wornLocked && it === worn }) });
      const locked = all.filter((it) => !list.includes(it)).length;
      return grouped(out, view, 'slot:' + slot)
        + (wornLocked ? `<p class="av-more">${$t`🔒 ${esc(clean(worn.name))} har du på dig men äger inte – byter du bort den finns den i klädaffären.`}</p>` : '')
        + (locked ? `<p class="av-more">${$t`🔒 ${locked} fler – köps i klädaffären och i stans nya butiker`}</p>` : '');
    };
    const itemNow = (slot) => {
      const worn = wornItem(L, slot);
      if (worn) return clean(worn.name);
      if (!slotIsEmpty(L, slot)) return $t('Nuvarande');
      const main = Object.keys(SLOT_FIELDS[slot])[0];
      return clean(entryOf(main, SLOT_FIELDS[slot][main])?.label || $t('Ingen'));
    };
    const swatches = (key, { dim = false, ownOnly = false } = {}) => {
      shown.add(key);
      const v = L[key], pal = PAL[key] || CLOTH, opt = OPTIONAL.has(key), own = v != null && !pal.includes(v);
      const std = opt ? `<button class="av-sw av-std ${v == null ? 'on' : ''}" data-k="${key}" data-v="null" title="${$t('Standard')}" aria-label="${$t('Standardfärg')}" aria-pressed="${v == null}">${$t('Std')}</button>` : '';
      return `<div class="av-sws ${dim ? 'dim' : ''}">${std}${(ownOnly ? [] : pal).map((c) => `<button class="av-sw ${c === v ? 'on' : ''}" data-k="${key}" data-v="${esc(JSON.stringify(c))}" style="--c:${c}" aria-label="${$t`Färg ${c}`}" aria-pressed="${c === v}"></button>`).join('')}
        <label class="av-sw av-own ${own ? 'on' : ''}" style="--c:${own ? v : '#ffffff'}" title="${$t('Egen färg')}"><input type="color" data-own="${key}" value="${v || '#ffffff'}" aria-label="${$t('Egen färg')}"><b>${own ? '' : '+'}</b></label></div>`;
    };
    // now = namnet på det man har valt (visas i rubriken; byts tillfälligt mot rutan under pekaren)
    const sec = (title, inner, hint = '', now = '') => `<section class="av-sec"><h4>${esc(title)}${now ? `<span class="av-now" data-cur="${esc(now)}">${esc(now)}</span>` : ''}</h4>${hint ? `<p class="av-hint">${hint}</p>` : ''}${inner}</section>`;
    const colorSec = (key, opts = {}, hint = '') => sec(COLOR_TITLE[key] || $t('Färg'), swatches(key, opts), hint);
    // färgfält som de valda posterna säger att de använder (uses: ['accent', …])
    const extraColors = () => {
      let h = '';
      for (const f of TAB_FIELDS[tab] || []) for (const k of entryOf(f, f === 'cheeks' ? L.cheeks : L[f])?.uses || []) {
        if (shown.has(k) || !(k in LOOK_COLORS) || salonLocked(k)) continue; // (hårfärgen byts hos frisören)
        h += colorSec(k);
      }
      return h;
    };
    const noHead = () => ({ hat: null, phones: false, hairAcc: 'none' });

    let html = '';
    switch (tab) {
      case 'skin': html = sec($t('Hudton'), tiles('skin', PAL.skin, VIEWS.head, { labels: null })) + sec($t('Egen färg'), swatches('skin', { ownOnly: true }), $t('Grön rymdvarelse? Välj vilken färg du vill.')); break;
      case 'hair':
        if (lockStyle) { // frisyren byts hos frisören (setAvatarSalon)
          html = sec($t('Frisyr'), grid(tile({ look: { ...L, ...noHead() }, view: VIEWS.head, label: '', on: true, attrs: 'data-salon="style" aria-disabled="true"', title: regNow('style') }), VIEWS.head),
            $t('✂️ Frisyren byter du hos 💈 Frisören i stan – där finns alla frisyrer, och du ser dem på dig innan du bestämmer dig.'), regNow('style'));
          break;
        }
        html = sec($t('Frisyr'), regTiles('style', VIEWS.head, { patch: noHead }), L.hat || L.phones || L.hairAcc !== 'none' ? $t('Bilderna visas utan huvudbonad, hårspänne och hörlurar.') : '', regNow('style'));
        break;
      case 'hairColor':
        if (lockColor) { // hårfärgen fixar frisören (setAvatarSalon)
          html = sec($t('Hårfärg'), `<div class="av-sws"><span class="av-sw on" style="--c:${esc(L.hair)}" aria-label="${$t('Din hårfärg')}"></span>${L.hairFx !== 'none' && L.hair2 ? `<span class="av-sw" style="--c:${esc(L.hair2)}" aria-label="${$t('Andra färgen')}"></span>` : ''}</div>`,
            $t('🎨 Hårfärg, slingor och toppar fixar 💈 Frisören i stan.'), regNow('hairFx') !== $t('Ingen') ? regNow('hairFx') : '');
          break;
        }
        html = colorSec('hair', {}, $t('Gäller även skägg och ögonbryn.'))
          + sec($t('Slingor, toppar & tvåfärgat'), regTiles('hairFx', VIEWS.head, { patch: noHead }), '', regNow('hairFx'))
          + colorSec('hair2', { dim: L.hairFx === 'none' }, $t('Den andra färgen i slingor, toppar och tvåfärgat hår.'));
        break;
      case 'eyes': html = sec($t('Ögon'), regTiles('eyes', VIEWS.face, { patch: () => ({ glasses: false }) }), '', regNow('eyes')) + colorSec('eyeColor', {}, $t('Std = mörka ögon.')); break;
      case 'brows': html = sec($t('Ögonbryn'), regTiles('brows', VIEWS.face, { patch: () => ({ glasses: false }) }), $t('Brynen har samma färg som håret.'), regNow('brows')); break;
      case 'mouth': html = sec($t('Mun'), regTiles('mouth', VIEWS.face), '', regNow('mouth')) + sec($t('Näsa'), regTiles('nose', VIEWS.face), '', regNow('nose')); break;
      case 'makeup':
        html = sec($t('Smink'), regTiles('makeup', VIEWS.face, { patch: () => ({ glasses: false }) }), '', regNow('makeup'))
          + colorSec('lipColor', { dim: L.makeup === 'none' }) + colorSec('shadowColor', { dim: L.makeup === 'none' });
        break;
      case 'face':
        html = sec($t('Kinder'), regTiles('cheeks', VIEWS.face), '', regNow('cheeks'))
          + sec($t('Fräknar, märken & ansiktsmålning'), regTiles('marks', VIEWS.face), '', regNow('marks')) + colorSec('markColor', { dim: L.marks === 'none' })
          + sec($t('Öron'), regTiles('ears', VIEWS.head, { patch: noHead }), '', regNow('ears'));
        break;
      case 'beard': html = sec($t('Skägg & mustasch'), regTiles('beard', VIEWS.face, { disabled: L.kid }), L.kid ? $t('Barn har inget skägg – byt till vuxen under 📏 Storlek.') : $t('Skägget har samma färg som håret.'), regNow('beard')); break;
      case 'top':
        html = sec($t('Överdel'), itemTiles('top', VIEWS.torso, { patch: () => ({ apron: false, bag: null, neck: 'none' }) }), L.apron ? $t('Bilderna visas utan förkläde.') : '', itemNow('top'))
          + colorSec('shirt') + colorSec('accent', {}, $t('Ränder, dragkedja, krage, knappar och tryck.'))
          + (L.topPrint !== 'none' ? colorSec('print2', {}, $t('Mönstrets färg. Std = detaljfärgen.')) : '');
        break;
      case 'bottom': {
        const cf = entryOf('bottom', L.bottom)?.colorField || 'pants';
        html = sec($t('Underdel'), itemTiles('bottom', VIEWS.legs, { patch: () => ({ apron: false, bag: null }) }), L.apron ? $t('Bilderna visas utan förkläde.') : '', itemNow('bottom'))
          + colorSec(cf, {}, cf === 'shirt' ? $t('Samma färg som överdelen.') : '')
          + (L.bottomPrint !== 'none' ? colorSec('pants2', {}, $t('Mönstrets färg. Std = detaljfärgen.')) : '');
        break;
      }
      case 'shoes': html = sec($t('Skor'), itemTiles('shoes', VIEWS.legs), '', itemNow('shoes')) + colorSec('shoes'); break;
      case 'hat':
        html = sec($t('Huvudbonad'), itemTiles('hat', VIEWS.head, { patch: () => ({ phones: false }) }), '', itemNow('hat')) + colorSec('cap', { dim: !L.hat })
          + sec($t('I håret'), itemTiles('hairAcc', VIEWS.head, { patch: () => ({ hat: null }) }), '', itemNow('hairAcc'))
          + sec($t('Hörlurar'), itemTiles('phones', VIEWS.head), '', itemNow('phones')) + colorSec('phoneColor', { dim: !L.phones });
        break;
      case 'glasses': html = sec($t('Glasögon'), itemTiles('glasses', VIEWS.face), '', itemNow('glasses')); break;
      case 'bag': html = sec($t('Väska'), itemTiles('bag', VIEWS.side), '', itemNow('bag')) + colorSec('bagColor', { dim: !L.bag }); break;
      case 'neck':
        html = sec($t('Hals'), itemTiles('neck', VIEWS.neck, { patch: () => ({ bag: null }) }), '', itemNow('neck')) + colorSec('neckColor', { dim: L.neck === 'none' }, $t('Std = detaljfärgen.'))
          + sec($t('Smycken'), itemTiles('jewel', VIEWS.head, { patch: () => ({ hat: null, phones: false }) }), '', itemNow('jewel'));
        break;
      case 'size':
        html = sec($t('Ålder'), tiles('kid', [false, true], VIEWS.full, { patch: (v) => (v ? { beard: false } : { build: adultBuild }) }))
          + sec($t('Kroppsbyggnad'), tiles('build', BUILDS, VIEWS.full, { disabled: L.kid, patch: () => ({ kid: false }) }), L.kid ? $t('Barn har alltid samma kroppsbyggnad.') : '');
        break;
    }
    html += extraColors();
    // behåll fokus + scroll när panelen ritas om
    const act = document.activeElement, ds = act && panel.contains(act) ? act.dataset : null, top = panel.scrollTop;
    const q = (v) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(v) : String(v).replace(/["\\]/g, '\\$&'));
    const fsel = !ds ? null : ds.k ? `[data-k="${q(ds.k)}"][data-v="${q(ds.v)}"]` : ds.item ? `[data-item="${q(ds.item)}"]`
      : ds.empty ? `[data-empty="${q(ds.empty)}"]` : ds.grp ? `[data-grp="${q(ds.grp)}"][data-g="${q(ds.g)}"]` : null;
    panel.innerHTML = html;
    panel.scrollTop = top;
    lazy.start(pending);
    // gruppremsan (mobil: rullar i sidled) visar den valda gruppen
    panel.querySelectorAll('.av-chips').forEach((strip) => {
      const on = strip.querySelector('.av-chip.on');
      if (on && strip.scrollWidth > strip.clientWidth) strip.scrollLeft = Math.max(0, on.offsetLeft - 24);
    });
    if (fsel) {
      try { panel.querySelector(fsel)?.focus({ preventScroll: true }); } catch { /* ogiltig selektor */ }
    }
  };

  // ---------- ändringar ----------
  const firstUsable = (slot) => itemsForSlot(slot).find((it) => avatarCanWear(it));
  const setLook = (L, redraw = true) => { cur.look = cleanLook(L); changed(redraw); }; // nytt objekt → spritecachen ritar om
  const set = (k, v, redraw = true) => {
    if (salonLocked(k)) return; // byts hos frisören
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
    if (b.dataset.grp) { groupSel.set(b.dataset.grp, b.dataset.g); renderPanel(); return; }
    if (b.dataset.item) { const it = itemById(b.dataset.item); if (it) setLook(lookForItem(it, cur.look)); return; }
    if (b.dataset.empty) { setLook(lookWithoutSlot(b.dataset.empty, cur.look)); return; }
    if (b.dataset.k) set(b.dataset.k, JSON.parse(b.dataset.v));
  });
  // namnet på rutan under pekaren (eller med fokus) visas i sektionens rubrik; tillbaka när man lämnar den
  const peek = (e, on) => {
    const b = e.target.closest?.('.av-tile');
    const now = b && panel.contains(b) ? b.closest('.av-sec')?.querySelector('.av-now') : null;
    if (!now) return;
    const name = on ? (b.getAttribute('title') || '').split(' – ')[0] : '';
    now.textContent = name || now.dataset.cur;
    now.classList.toggle('peek', !!name && name !== now.dataset.cur);
  };
  panel.addEventListener('pointerover', (e) => peek(e, true));
  panel.addEventListener('pointerout', (e) => peek(e, false));
  panel.addEventListener('focusin', (e) => peek(e, true));
  panel.addEventListener('focusout', (e) => peek(e, false));
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
    groupSel.clear(); // grupperna följer det nya utseendet
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
    // det som byts hos frisören ligger kvar (setAvatarSalon)
    if (lockStyle) look.style = cur.look.style;
    if (lockColor) Object.assign(look, { hair: cur.look.hair, hairFx: cur.look.hairFx, hair2: cur.look.hair2 });
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
      <h3>${$t('Vad heter du?')}</h3>
      <p>${$t('Namnet står på din namnskylt när andra ser dig i Pixelstaden.')}</p>
      <input type="text" maxlength="14" placeholder="${$t('Ditt namn')}" autocomplete="off" spellcheck="false">
      <div class="av-nameask-err"></div>
      <div class="av-nameask-btns"><button class="btn" data-esc>${$t('Avbryt')}</button><button class="btn btn-go" data-ok>${$t('💾 Spara')}</button></div>
    </div>`;
    dlg.append(box);
    const inp = box.querySelector('input'), err = box.querySelector('.av-nameask-err');
    inp.value = input.value;
    setTimeout(() => inp.focus(), 30);
    const done = () => {
      const n = cleanName(inp.value);
      if (!n) { err.textContent = $t('Skriv ett namn först!'); inp.focus(); return; }
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
    try { toast($t`Sparat! Hej ${av.name} 👋`, 'good'); } catch { /* ingen toast-yta */ }
    onDone?.(av);
  }

  changed();
  return dlg;
}
