// Min avatar: spelarens egen figur (namn + utseende + markörfärg), sparad i localStorage,
// och redigeraren där man klär ut den. `look` är ett rent JSON-objekt som drawPerson förstår
// (det skickas över nätet i co-op) – kör alltid främmande data genom cleanAvatar/cleanLook.
import {
  makeLook, drawPerson, portrait, FIRST_NAMES,
  SKIN, HAIR, SHIRT, PANTS, SHOES, PHONE_COLORS, BAG_COLORS,
  HAIR_STYLES, TOP_TYPES, BOTTOM_TYPES, HAT_TYPES, GLASSES_TYPES, BEARD_TYPES, BAG_TYPES, BUILDS,
} from './people.js';
import { openModal, closeModal, toast, esc } from './ui.js';

export const AVATAR_KEY = 'snabbfilen_avatar';
export const NAME_MAX = 12;
// Markörfärger: namnskylt, muspekare i co-op m.m. – klara färger som syns mot golvet
export const MARKER_COLORS = ['#ff4d4d', '#ff9f1c', '#ffd23f', '#8ee03c', '#22c7a9', '#3fc4ff', '#4f7dff', '#a66bff', '#ff5dc8', '#f4f1ea'];

// ---------- rensning / lagring ----------
const HEX = /^#[0-9a-f]{6}$/i;
const col = (v, fb) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : fb);
const oneOf = (v, list, fb) => (list.includes(v) ? v : fb);
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

function cleanName(v) {
  const s = Array.from(String(v ?? '')).filter((ch) => { const c = ch.codePointAt(0); return c >= 32 && c !== 127 && ch !== '<' && ch !== '>'; }).join('').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, NAME_MAX).join('').trim();
}

export function cleanLook(raw) {
  const L = raw && typeof raw === 'object' ? raw : {};
  let style = L.style, hat = L.hat ?? null;
  if (style === 'cap') { style = 'short'; hat = hat || 'cap'; } // gammalt format
  const kid = !!L.kid;
  return {
    skin: col(L.skin, '#eabf98'), hair: col(L.hair, '#3b2619'), style: oneOf(style, HAIR_STYLES, 'short'),
    top: oneOf(L.top, TOP_TYPES, 'tee'), shirt: col(L.shirt, '#3a7bd5'), accent: col(L.accent, '#f4f1ea'),
    bottom: oneOf(L.bottom, BOTTOM_TYPES, 'jeans'), pants: col(L.pants, '#2d3a5c'), shoes: col(L.shoes, '#1c1c1c'),
    hat: oneOf(hat, HAT_TYPES, null), cap: col(L.cap, '#c9323a'),
    glasses: oneOf(L.glasses === true ? 'square' : L.glasses || false, GLASSES_TYPES, false),
    beard: kid ? false : oneOf(L.beard === true ? 'full' : L.beard || false, BEARD_TYPES, false),
    phones: !!L.phones, phoneColor: col(L.phoneColor, '#222228'),
    bag: oneOf(L.bag ?? null, BAG_TYPES, null), bagColor: col(L.bagColor, '#2f3440'),
    build: kid ? 4 : oneOf(L.build, BUILDS, 5),
    blush: !!L.blush, apron: !!L.apron, kid,
  };
}

function colorFromName(name) {
  let h = 7;
  for (const ch of String(name || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return MARKER_COLORS[h % MARKER_COLORS.length];
}

// Rensar ett avatarobjekt (t.ex. från nätet): { name, look, color } med giltiga värden
export function cleanAvatar(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const name = cleanName(a.name);
  return { name, look: cleanLook(a.look), color: col(a.color, null) || colorFromName(name) };
}

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};

// Slumpat vuxet utseende i butiksförkläde (utgångsläge innan spelaren klätt ut sig)
function defaultLook() {
  const L = makeLook();
  L.kid = false; L.bag = null; L.apron = false;
  return cleanLook(L);
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
      if (p && typeof p === 'object' && p.look && typeof p.look === 'object') { const av = cleanAvatar(p); memo = { raw, av }; return { ...av }; }
    } catch { /* trasig – skapa ny */ }
  }
  if (!raw && memo) { store.set(AVATAR_KEY, memo.raw); return { ...memo.av }; } // lagringen tömd/blockerad: behåll avataren
  return { ...saveAvatar({ name: '', look: defaultLook(), color: rnd(MARKER_COLORS) }) };
}

export function saveAvatar(av) {
  const c = cleanAvatar(av), raw = JSON.stringify(c);
  store.set(AVATAR_KEY, raw);
  memo = { raw, av: c };
  if (c.name) upsertProfile(c, av.oldName);
  return { ...c };
}

// ---------- Sparade avatarer (flera personer kan dela en dator) ----------
export const PROFILES_KEY = 'snabbfilen_avatars';
const PROFILE_MAX = 12;
export function listAvatars() {
  let list = [];
  try { list = JSON.parse(store.get(PROFILES_KEY) || '[]'); } catch { list = []; }
  list = (Array.isArray(list) ? list : []).map(cleanAvatar).filter((a) => a.name);
  // den nuvarande avataren (från tiden före listan) följer med
  try {
    const cur = JSON.parse(store.get(AVATAR_KEY) || 'null');
    if (cur?.name && cur.look && !list.some((a) => a.name.toLowerCase() === String(cur.name).toLowerCase())) { list.unshift(cleanAvatar(cur)); store.set(PROFILES_KEY, JSON.stringify(list)); }
  } catch { /* ingen */ }
  return list;
}
function upsertProfile(av, oldName) {
  const list = listAvatars().filter((a) => a.name.toLowerCase() !== String(oldName || '').toLowerCase() || !oldName);
  const i = list.findIndex((a) => a.name.toLowerCase() === av.name.toLowerCase());
  if (i >= 0) list.splice(i, 1);
  list.unshift({ name: av.name, look: av.look, color: av.color });
  store.set(PROFILES_KEY, JSON.stringify(list.slice(0, PROFILE_MAX)));
}
export function deleteAvatar(name) {
  const list = listAvatars().filter((a) => a.name.toLowerCase() !== String(name).toLowerCase());
  store.set(PROFILES_KEY, JSON.stringify(list));
  const cur = loadAvatar();
  if (cur.name && cur.name.toLowerCase() === String(name).toLowerCase()) saveAvatar(list[0] || { name: '', look: defaultLook(), color: rnd(MARKER_COLORS) });
}

// Välj vem du är: sparade avatarer + skapa ny. onPick(av) när man valt.
export function openAvatarPicker({ title = '🧑 Vem spelar?', text = 'Välj din avatar eller skapa en ny.', onPick, onCancel } = {}) {
  const list = listAvatars();
  if (!list.length) return openAvatarEditor({ fresh: true, onDone: onPick, onCancel });
  const cur = loadAvatar();
  const body = `<p style="font-size:19px;margin-top:0">${esc(text)}</p>
    <div class="av-pick">${list.map((a, i) => `<div class="av-card ${cur.name === a.name ? 'on' : ''}" style="--pc:${esc(avatarColor(a))}">
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
    deleteAvatar(a.name);
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
  shirt: CLOTH, accent: CLOTH, cap: CLOTH,
  pants: uniq([...PANTS, '#d9433b', '#3a7bd5', '#8e5bd1', '#b83d7a', '#f0b429', '#e8e3d6']),
  shoes: uniq([...SHOES, '#46a35a', '#8e5bd1', '#f28bb3']),
  bagColor: uniq([...BAG_COLORS, '#2aa39a', '#f28bb3', '#e8e3d6']),
  phoneColor: uniq([...PHONE_COLORS, '#f0b429', '#46a35a', '#f28bb3', '#8e5bd1']),
};

const TABS = [
  { id: 'skin', icon: '✋', label: 'Hud', title: 'Hudton' },
  { id: 'hair', icon: '💇', label: 'Hår', title: 'Hår' },
  { id: 'face', icon: '👓', label: 'Ansikte', title: 'Ansikte' },
  { id: 'hat', icon: '🧢', label: 'Huvud', title: 'Huvudbonad' },
  { id: 'top', icon: '👕', label: 'Tröja', title: 'Tröja' },
  { id: 'bottom', icon: '👖', label: 'Byxor', title: 'Byxor, kjol & klänning' },
  { id: 'shoes', icon: '👟', label: 'Skor', title: 'Skor' },
  { id: 'bag', icon: '🎒', label: 'Väska', title: 'Väska' },
  { id: 'phones', icon: '🎧', label: 'Lurar', title: 'Hörlurar' },
  { id: 'size', icon: '📏', label: 'Storlek', title: 'Storlek' },
];

const LBL = {
  style: { short: 'Kort', side: 'Sidbena', long: 'Långt', ponytail: 'Häst\u00adsvans', bun: 'Knut', curly: 'Lockigt', afro: 'Afro', spiky: 'Taggigt', bald: 'Flint', mohawk: 'Tuppkam', bob: 'Page', buzz: 'Snaggat', braids: 'Flätor', pigtails: 'Tofsar', wavy: 'Vågigt' },
  top: { tee: 'T-shirt', stripes: 'Randig', hoodie: 'Huv\u00adtröja', jacket: 'Jacka', sweater: 'Tröja', shirt: 'Skjorta' },
  bottom: { jeans: 'Jeans', pants: 'Byxor', shorts: 'Shorts', skirt: 'Kjol', dress: 'Klän\u00adning' },
  hat: { null: 'Ingen', cap: 'Keps', beanie: 'Mössa', headband: 'Hårband', bow: 'Rosett', crown: 'Krona' },
  glasses: { false: 'Inga', square: 'Fyr\u00adkantiga', round: 'Runda', sun: 'Sol\u00adglasögon' },
  beard: { false: 'Inget', full: 'Hel\u00adskägg', mustache: 'Mus\u00adtasch', stubble: 'Stubb', goatee: 'Pip\u00adskägg' },
  blush: { false: 'Utan', true: 'Rosiga' },
  bag: { null: 'Ingen', backpack: 'Rygg\u00adsäck', shoulder: 'Axel\u00adväska' },
  phones: { false: 'Av', true: 'På' },
  apron: { false: 'Utan', true: 'För\u00adkläde' },
  kid: { false: 'Vuxen', true: 'Barn' },
  build: { 4: 'Smal', 5: 'Mellan', 6: 'Bred' },
};

// Utsnitt ur spriten (24×41, fötterna vid 12,39) för småbilderna i knapparna
const VIEWS = {
  head: { dir: 'down', crop: (L) => [2, L.kid ? 9 : 1, 20, 20], scale: 3 },
  face: { dir: 'down', crop: (L) => [4, L.kid ? 12 : 4, 15, 15], scale: 4 },
  torso: { dir: 'down', crop: (L) => [2, L.kid ? 16 : 12, 20, 20], scale: 3 },
  legs: { dir: 'down', crop: (L) => [2, L.kid ? 21 : 20, 20, 20], scale: 3 },
  side: { dir: 'right', crop: (L) => [2, L.kid ? 16 : 12, 20, 20], scale: 3 },
  full: { dir: 'down', crop: () => [0, 0, 24, 41], scale: 2 },
};

function tileCanvas(look, view) {
  const src = document.createElement('canvas'); src.width = 24; src.height = 41;
  drawPerson(src.getContext('2d'), 12, 39, look, view.dir, 0);
  const [sx, sy, sw, sh] = view.crop(look), s = view.scale;
  const c = document.createElement('canvas'); c.width = sw * s; c.height = sh * s;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(src, sx, sy, sw, sh, 0, 0, sw * s, sh * s);
  return c;
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

export function openAvatarEditor({ onDone, onCancel, fresh = false } = {}) {
  const saved = fresh ? { name: '', look: defaultLook(), color: rnd(MARKER_COLORS) } : loadAvatar();
  const oldName = fresh ? '' : saved.name;
  const cur = { name: saved.name || (fresh ? '' : rnd(FIRST_NAMES)), look: saved.look, color: saved.color };
  const start = { ...cur };
  let tab = TABS.some((t) => t.id === lastTab) ? lastTab : 'skin';
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
    if (!cv.isConnected) { window.removeEventListener('resize', onResize); return; } // dialogen stängd
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
    const tiles = (key, values, view, { labels = LBL[key], disabled = false, patch = null } = {}) =>
      `<div class="av-tiles ${view === VIEWS.full ? 'tall' : ''}">${values.map((v) => {
        const look = { ...L, [key]: v, ...(patch ? patch(v) : {}) };
        const i = pending.push([look, view]) - 1, label = labels ? labels[String(v)] : '';
        const on = same(L[key], v);
        return `<button class="av-tile ${on ? 'on' : ''}" data-k="${key}" data-v="${esc(JSON.stringify(v))}" aria-pressed="${on}" ${disabled ? 'disabled' : ''} title="${esc((label || String(v)).replace(/\u00ad/g, ''))}"><i data-c="${i}"></i>${label ? `<span>${esc(label)}</span>` : ''}</button>`;
      }).join('')}</div>`;
    const swatches = (key, { dim = false, ownOnly = false } = {}) => {
      const v = L[key], pal = PAL[key], own = !pal.includes(v);
      return `<div class="av-sws ${dim ? 'dim' : ''}">${(ownOnly ? [] : pal).map((c) => `<button class="av-sw ${c === v ? 'on' : ''}" data-k="${key}" data-v="${esc(JSON.stringify(c))}" style="--c:${c}" aria-label="Färg ${c}" aria-pressed="${c === v}"></button>`).join('')}
        <label class="av-sw av-own ${own ? 'on' : ''}" style="--c:${own ? v : '#ffffff'}" title="Egen färg"><input type="color" data-own="${key}" value="${v}" aria-label="Egen färg"><b>${own ? '' : '+'}</b></label></div>`;
    };
    const sec = (title, inner, hint = '') => `<section class="av-sec"><h4>${esc(title)}</h4>${hint ? `<p class="av-hint">${hint}</p>` : ''}${inner}</section>`;

    let html = '';
    switch (tab) {
      case 'skin': html = sec('Hudton', tiles('skin', PAL.skin, VIEWS.head, { labels: null })) + sec('Egen färg', swatches('skin', { ownOnly: true }), 'Grön rymdvarelse? Välj vilken färg du vill.'); break;
      case 'hair': html = sec('Frisyr', tiles('style', HAIR_STYLES, VIEWS.head, { patch: () => ({ hat: null, phones: false }) }), L.hat || L.phones ? 'Bilderna visas utan huvudbonad och hörlurar.' : '') + sec('Hårfärg', swatches('hair'), 'Gäller även skägg och ögonbryn.'); break;
      case 'face':
        html = sec('Glasögon', tiles('glasses', GLASSES_TYPES, VIEWS.face))
          + sec('Skägg & mustasch', tiles('beard', BEARD_TYPES, VIEWS.face, { disabled: L.kid }), L.kid ? 'Barn har inget skägg – byt till vuxen under 📏 Storlek.' : '')
          + sec('Kinder', tiles('blush', [false, true], VIEWS.face));
        break;
      case 'hat': html = sec('Huvudbonad', tiles('hat', HAT_TYPES, VIEWS.head)) + sec('Färg', swatches('cap', { dim: !L.hat })); break;
      case 'top':
        html = sec('Modell', tiles('top', TOP_TYPES, VIEWS.torso, { patch: () => ({ apron: false, bag: null }) }), L.apron ? 'Bilderna visas utan förkläde.' : '')
          + sec('Färg', swatches('shirt'))
          + sec('Detaljfärg', swatches('accent'), 'Ränder, dragkedja, krage, knappar och tryck.');
        break;
      case 'bottom':
        html = sec('Modell', tiles('bottom', BOTTOM_TYPES, VIEWS.legs, { patch: () => ({ apron: false, bag: null }) }), L.apron ? 'Bilderna visas utan förkläde.' : '')
          + (L.bottom === 'dress' ? sec('Färg', swatches('shirt'), 'Klänningen har samma färg som tröjan.') : sec('Färg', swatches('pants')));
        break;
      case 'shoes': html = sec('Skornas färg', swatches('shoes')); break;
      case 'bag': html = sec('Väska', tiles('bag', BAG_TYPES, VIEWS.side)) + sec('Färg', swatches('bagColor', { dim: !L.bag })); break;
      case 'phones': html = sec('Hörlurar', tiles('phones', [false, true], VIEWS.head)) + sec('Färg', swatches('phoneColor', { dim: !L.phones })); break;
      case 'size':
        html = sec('Ålder', tiles('kid', [false, true], VIEWS.full, { patch: (v) => (v ? { beard: false } : { build: adultBuild }) }))
          + sec('Kroppsbyggnad', tiles('build', BUILDS, VIEWS.full, { disabled: L.kid, patch: () => ({ kid: false }) }), L.kid ? 'Barn har alltid samma kroppsbyggnad.' : '');
        break;
    }
    // behåll fokus + scroll när panelen ritas om
    const act = document.activeElement, fk = act?.dataset?.k, fv = act?.dataset?.v, top = panel.scrollTop;
    panel.innerHTML = html;
    panel.querySelectorAll('[data-c]').forEach((el) => { const [look, view] = pending[+el.dataset.c]; el.replaceWith(tileCanvas(look, view)); });
    panel.scrollTop = top;
    if (fk && panel.contains(act) === false) {
      const again = [...panel.querySelectorAll('[data-k]')].find((b) => b.dataset.k === fk && b.dataset.v === fv);
      again?.focus({ preventScroll: true });
    }
  };

  const set = (k, v, redraw = true) => {
    const L = cur.look, patch = { [k]: v };
    if (k === 'kid') Object.assign(patch, v ? { beard: false } : { build: adultBuild });
    if (k === 'cap' && !L.hat) patch.hat = 'cap';
    if (k === 'bagColor' && !L.bag) patch.bag = 'backpack';
    if (k === 'phoneColor' && !L.phones) patch.phones = true;
    cur.look = cleanLook({ ...L, ...patch }); // nytt objekt → spritecachen ritar om
    changed(redraw);
  };
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-k]');
    if (!b || b.disabled) return;
    set(b.dataset.k, JSON.parse(b.dataset.v));
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
    const r = Math.random();
    Object.assign(L, {
      kid, apron: cur.look.apron,
      style: rnd(HAIR_STYLES), top: rnd(TOP_TYPES),
      bottom: Math.random() < 0.12 ? 'dress' : rnd(BOTTOM_TYPES.filter((b) => b !== 'dress')),
      hat: r < 0.55 ? null : rnd(HAT_TYPES.filter(Boolean)),
      beard: kid || Math.random() > 0.3 ? false : rnd(BEARD_TYPES.filter(Boolean)),
      build: kid ? 4 : rnd(BUILDS),
    });
    if (L.hat === 'crown' && Math.random() < 0.7) L.cap = '#f0b429';
    cur.look = cleanLook(L);
    changed();
  }

  function save() {
    const name = cleanName(input.value);
    if (!name) {
      setErr('Skriv ett namn först!');
      input.focus();
      return;
    }
    const av = saveAvatar({ name, look: cur.look, color: cur.color, oldName });
    closeModal();
    try { toast(`Sparat! Hej ${av.name} 👋`, 'good'); } catch { /* ingen toast-yta */ }
    onDone?.(av);
  }

  changed();
  return dlg;
}
