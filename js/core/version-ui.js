// Versionen i spelet: numret i HUD:en, nyhetsrutan (läser CHANGELOG.md), automatisk
// omladdning när en ny version publiceras och säkerhetskopior av sparningen.
//
// Laddas FÖRE main.js (se index.html) så att sparningen hinner kopieras innan en ny
// version läser in och kanske gör om den. Spelarens data ligger i localStorage och
// överlever alltid en omladdning – här ser vi bara till att allt är sparat först och
// att omladdningen sker när det passar (aldrig mitt i ett arbetspass eller en dialog).
import { VERSION, TITLE } from '../version.js';
import { openModal, modalOpen, toast, esc } from './ui.js';
import { $t } from './i18n.js';

const SEEN_KEY = 'snabbfilen_seen_version';
const BACKUPS_KEY = 'snabbfilen_backups';
const BACKUP_PREFIX = 'snabbfilen_backup_';
const MAX_BACKUPS = 3;
const POLL_MS = 60 * 1000;
const COUNTDOWN_S = 10;
const MAX_TRIES = 3;
const SHOW_RELEASES = 6;

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ok */ } },
  keys() { try { return Object.keys(localStorage); } catch { return []; } },
};
const ss = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ok */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* ok */ } },
};

// ---------------------------------------------------------------- appen (Pixelcity, iOS)
// I appen (Capacitor, app/) ligger spelet inbyggt. Nya versioner hämtas som ett paket – app/www
// packat av app/paket.mjs och uppladdat till GitHub-releasen v<version> – med samma ruta och
// samma väntan som på webben, men i stället för att ladda om sidan byter uppdateringspluginet
// (@capgo/capacitor-updater) till det nya paketet. Svarar ett nytt paket inte med notifyAppReady
// inom tio sekunder går pluginet själv tillbaka till det förra. Appen går aldrig bakåt i version.
const APP = (() => { try { return window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins?.CapacitorUpdater || null : null; } catch { return null; } })();
const WEBB = 'https://8bitcat.github.io/snabbfilen/';
const PAKET = (v) => `https://github.com/8bitcat/snabbfilen/releases/download/v${v}/pixelcity-${v}.zip`;
const APP_FEL_MAX = 5;   // misslyckade nedladdningar av samma version innan appen slutar försöka (tills nästa start)
const nyare = (a, b) => {
  const x = String(a).split('.').map((n) => +n || 0), y = String(b).split('.').map((n) => +n || 0);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};
// "paketet fungerar" sägs först när spelet är igång – kraschar ett nytt paket innan dess går pluginet
// tillbaka till det förra (appReadyTimeout 15 s i app/capacitor.config.json)
if (APP) {
  const t0 = Date.now();
  const iv = setInterval(() => {
    if (window.SF?.game) { clearInterval(iv); try { APP.notifyAppReady(); } catch { /* ok */ } } else if (Date.now() - t0 > 14000) clearInterval(iv);
  }, 300);
}

// ---------------------------------------------------------------- säkerhetskopior
// Allt spelet sparar ligger under nycklar som börjar med "snabbfilen" (sparning, avatar,
// ljud, djur …). En kopia tas varje gång versionen byts, de tre senaste sparas.
const isDataKey = (k) => k.startsWith('snabbfilen') && !k.startsWith(BACKUP_PREFIX) && k !== BACKUPS_KEY && k !== SEEN_KEY && !k.includes('_undanlagd_');

export function listBackups() {
  try { return (JSON.parse(ls.get(BACKUPS_KEY) || '[]') || []).filter((b) => b && ls.get(b.key)); } catch { return []; }
}

export function makeBackup(label) {
  const data = {};
  for (const k of ls.keys()) if (isDataKey(k)) data[k] = ls.get(k);
  if (!Object.keys(data).length) return null;
  const key = BACKUP_PREFIX + Date.now().toString(36);
  const entry = { key, label, date: new Date().toISOString() };
  const list = listBackups();
  // får inte plats → släpp de äldsta kopiorna tills den nya ryms
  while (!ls.set(key, JSON.stringify(data))) {
    const old = list.shift();
    if (!old) return null;
    ls.del(old.key);
  }
  list.push(entry);
  while (list.length > MAX_BACKUPS) ls.del(list.shift().key);
  ls.set(BACKUPS_KEY, JSON.stringify(list));
  return entry;
}

function restoreBackup(entry) {
  let data;
  try { data = JSON.parse(ls.get(entry.key) || 'null'); } catch { data = null; }
  if (!data) { toast($t('Säkerhetskopian gick inte att läsa.'), 'bad'); return; }
  makeBackup($t`före återställning (v${VERSION})`);
  for (const k of ls.keys()) if (isDataKey(k)) ls.del(k);
  for (const [k, v] of Object.entries(data)) ls.set(k, v);
  ss.set('sf_restored', entry.label);
  location.reload();
}

// Ny version sedan förra besöket (eller första gången med versionshantering) →
// kopiera sparningen innan den nya koden läser den.
const seen = ls.get(SEEN_KEY);
if (seen !== VERSION) {
  if (ls.get('snabbfilen_save1')) makeBackup(seen ? $t`från v${seen}` : $t('före versionshanteringen'));
  ls.set(SEEN_KEY, VERSION);
}

// ---------------------------------------------------------------- nyhetsrutan
const inline = (s) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .replace(/`(.+?)`/g, '<code>$1</code>');

// "## [0.14.0] – 2026-09-28 – Rubrik" följt av "- punkter"
export function parseChangelog(md) {
  const out = [];
  let cur = null;
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(/^##\s*\[([^\]]+)\]\s*[–-]\s*([0-9-]+)\s*(?:[–-]\s*(.*))?$/);
    if (h) { cur = { version: h[1], date: h[2], title: (h[3] || '').trim(), items: [] }; out.push(cur); continue; }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (cur && li) cur.items.push(li[1]);
  }
  return out;
}

const fmtDate = (iso) => { try { return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }); } catch { return iso; } };

function newsHtml(list) {
  const rel = list.map((r) => `
    <section class="${r.version === VERSION ? 'nu' : ''}">
      <h3><span class="ver">v${esc(r.version)}</span> ${inline(r.title)}${r.version === VERSION ? ` <span class="du">${$t('← du spelar den här')}</span>` : ''}</h3>
      <div class="datum">${esc(r.date)}</div>
      <ul>${r.items.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>
    </section>`).join('');
  const backups = listBackups().slice().reverse();
  const bk = backups.length ? `
    <section class="backup">
      <h3>${$t('💾 Säkerhetskopior av din sparning')}</h3>
      <div class="datum">${$t('Tas automatiskt när spelet uppdateras. Återställ bara om något har blivit fel.')}</div>
      <ul>${backups.map((b) => `<li>${esc(fmtDate(b.date))} – ${esc(b.label)} <button class="btn btn-small" data-restore="${esc(b.key)}">${$t('Återställ')}</button></li>`).join('')}</ul>
    </section>` : '';
  return `<div class="nyheter">${rel}${bk}</div>`;
}

export async function openNews() {
  let list = [];
  try {
    const res = await fetch('CHANGELOG.md?' + Date.now(), { cache: 'no-store' });
    if (res.ok) list = parseChangelog(await res.text()).slice(0, SHOW_RELEASES);
  } catch { /* offline – visa det vi vet */ }
  if (!list.length) list = [{ version: VERSION, date: '', title: TITLE, items: [] }];
  const dlg = openModal($t('Nyheter i Snabbfilen'), newsHtml(list));
  for (const b of dlg.querySelectorAll('[data-restore]')) {
    b.onclick = () => {
      const entry = listBackups().find((x) => x.key === b.dataset.restore);
      if (!entry) return;
      openModal($t('Återställa sparningen?'), `<p>${$t`Spelet går tillbaka till hur det var <b>${esc(fmtDate(entry.date))}</b> (${esc(entry.label)}).`}</p><p>${$t('Det du har nu sparas först som en egen säkerhetskopia, så du kan ångra dig.')}</p>`, [
        { label: $t('Avbryt'), onClick: () => openNews() },
        { label: $t('Återställ'), cls: 'btn-go', onClick: () => restoreBackup(entry) },
      ]);
    };
  }
}

// ---------------------------------------------------------------- HUD-knappen
function mountButton() {
  const host = document.querySelector('#hud .hud-btns');
  if (!host || document.getElementById('hud-version')) return;
  const b = document.createElement('button');
  b.id = 'hud-version';
  b.className = 'btn btn-small hud-version';
  b.title = $t('Nyheter – vad är nytt i spelet?');
  b.textContent = 'v' + VERSION;
  b.onclick = () => openNews();
  host.prepend(b);
}

// ---------------------------------------------------------------- automatisk uppdatering
let pending = null;       // { version, title, critical } från version.json
let countdown = COUNTDOWN_S;
let banner = null;

const typing = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
// Startmenyn (eller spelet har inte startat än): ingen är mitt i något, så den nya versionen kan
// laddas direkt – utan nedräkning (Carl 2026-10-07: "den senaste versionen laddas in direkt").
const T_START = Date.now();
const atStart = () => !typing() && (document.body.classList.contains('menu-open') || (!window.SF?.game && Date.now() - T_START < 20000));
function blocker() {
  const SF = window.SF;
  if (typing()) return $t('Spelet sparas och laddas om när du skrivit klart.');
  if (pending?.critical) return null;
  if ((SF?.sceneName || '').startsWith('jobb')) return $t('Spelet sparas och laddas om när passet är slut.');
  if (modalOpen()) return $t('Spelet sparas och laddas om när du stängt rutan.');
  if (document.querySelector('#decor-panel:not(.hidden)')) return $t('Spelet sparas och laddas om när du möblerat klart.');
  return null;
}

function showBanner() {
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'sf-update';
    banner.innerHTML = `<span class="txt"></span><button class="btn btn-small btn-go">${$t('Ladda om nu')}</button>`;
    banner.querySelector('button').onclick = () => reloadNow();
    document.body.append(banner);
  }
  // appen hämtar paketet: läget står kvar i rutan (nedräkningen skrev annars över det varje sekund)
  if (reloading) { banner.querySelector('.txt').innerHTML = $t`⬇️ Hämtar v${esc(pending.version)} …`; return; }
  const why = blocker();
  const spel = APP ? 'Pixelcity' : $t('Snabbfilen');
  const head = pending.title ? $t`✨ ${spel} v${esc(pending.version)} har kommit: ${esc(pending.title)}!` : $t`✨ ${spel} v${esc(pending.version)} har kommit!`;   // (appen heter Pixelcity)
  banner.querySelector('.txt').innerHTML = why
    ? `${head} <span class="sub">${why}</span>`
    : `${head} <span class="sub">${$t`Sparar och laddar om om ${countdown} s – allt du har är kvar.`}</span>`;
}

// Frågar service workern vilken version den har (null = ingen / svarar inte)
function swVersion(reg) {
  return new Promise((resolve) => {
    const w = reg?.active || reg?.waiting || reg?.installing;
    if (!w) return resolve(null);
    const ch = new MessageChannel();
    const t = setTimeout(() => resolve(null), 1500);
    ch.port1.onmessage = (e) => { clearTimeout(t); resolve(e.data?.version || null); };
    try { w.postMessage({ t: 'version' }, [ch.port2]); } catch { clearTimeout(t); resolve(null); }
  });
}
// Innan omladdningen: hämta alla filer i den nya versionen förbi webbläsarens cache
// (fungerar även utan service worker) och vänta in att den nya service workern tagit över,
// så att omladdningen får en komplett ny version – aldrig gamla moduler ur cachen.
async function prefetchNew() {
  let reg = null;
  try { reg = await navigator.serviceWorker?.getRegistration(); } catch { /* ok */ }
  if (reg && navigator.serviceWorker.controller) {
    // service workern förladdar hela nya versionen själv när den installeras – vänta in den
    try { await reg.update(); } catch { /* ok */ }
    const end = Date.now() + 30000;
    while (Date.now() < end) {
      if ((await swVersion(reg)) === pending.version) return;
      await new Promise((r) => setTimeout(r, 400));
    }
    return;
  }
  // ingen service worker: hämta filerna förbi webbläsarens cache själva
  const files = Array.isArray(pending?.files) ? pending.files : [];
  const deadline = Date.now() + 20000;
  const queue = files.slice();
  const worker = async () => { while (queue.length && Date.now() < deadline) { const f = queue.shift(); try { await fetch(f, { cache: 'reload', credentials: 'same-origin' }); } catch { /* nästa */ } } };
  await Promise.all(Array.from({ length: 6 }, worker));
}
let reloading = false;
async function reloadNow() {
  if (!pending || reloading) return;
  const v = pending.version;
  const tries = +(ss.get('sf_upd_tries_' + v) || 0);
  if (tries >= MAX_TRIES) return;
  reloading = true;
  ss.set('sf_upd_tries_' + v, String(tries + 1));
  ss.set('sf_upd_target', v);
  if (!pending.atStart) ss.set('sf_quiet_start', '1'); // efter omladdningen: rakt tillbaka in, ingen veckoruta (från startmenyn: menyn igen)
  window.dispatchEvent(new Event('sf:before-reload')); // andra moduler (t.ex. djuren) sparar sig
  try { window.SF?.game?.save(); } catch { /* spelet sparar ändå regelbundet */ }
  if (banner) banner.querySelector('.txt').innerHTML = $t`⬇️ Hämtar v${esc(v)} …`;
  if (APP) { await bytPaket(v); return; }
  try { await prefetchNew(); } catch { /* ladda om ändå */ }
  location.reload();
}
// paketets SHA-256 – uppdateringspluginet kräver den ("Checksum required") och GitHub anger den
// (digest) för varje releasefil; api.github.com svarar med CORS för alla ursprung
async function paketSumma(v) {
  const r = await fetch(`https://api.github.com/repos/8bitcat/snabbfilen/releases/tags/v${v}`, { cache: 'no-store' });
  if (!r.ok) throw new Error($t`releasen v${v} finns inte än`);
  const a = ((await r.json()).assets || []).find((x) => x.name === `pixelcity-${v}.zip`);
  const m = /^sha256:([0-9a-f]{64})$/.exec(a?.digest || '');
  if (!m) throw new Error($t('paketet finns inte på releasen än'));
  return m[1];
}
// appen: ladda ner paketet och byt till det (set() laddar om i det nya paketet – inget efter körs).
// Finns paketet inte än (det laddas upp strax efter pushen) försöker nästa versionskoll igen.
async function bytPaket(v) {
  try {
    const checksum = await paketSumma(v);
    const b = await Promise.race([
      APP.download({ url: PAKET(v), version: v, checksum }),
      new Promise((_, nej) => setTimeout(() => nej(new Error($t('nedladdningen tog för lång tid'))), 120000)),
    ]);
    await APP.set({ id: b.id });
  } catch (e) {
    toast($t`Kunde inte hämta v${esc(v)} just nu – försöker igen om en stund. (${esc(String(e?.message || e).slice(0, 90))})`, 'wrap');
    const fel = +(ss.get('sf_app_fel_' + v) || 0) + 1;
    ss.set('sf_app_fel_' + v, String(fel));
    ss.del('sf_upd_tries_' + v); ss.del('sf_upd_target'); ss.del('sf_quiet_start');
    reloading = false; pending = null;
    if (banner) { banner.remove(); banner = null; }
  }
}

function tick() {
  if (!pending) return;
  if (+(ss.get('sf_upd_tries_' + pending.version) || 0) >= MAX_TRIES) {
    if (banner) { banner.remove(); banner = null; }
    return;
  }
  const why = blocker();
  if (!why) {
    if (document.hidden) { reloadNow(); return; } // ingen tittar – ladda om direkt
    countdown = Math.max(0, countdown - 1);
    if (countdown === 0) { reloadNow(); return; }
  }
  showBanner();
}

async function checkForUpdate() {
  try {
    const res = await fetch((APP ? WEBB : '') + 'version.json?' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const d = await res.json();
    if (!d?.version || d.version === VERSION) return;
    if (APP && (!nyare(d.version, VERSION) || +(ss.get('sf_app_fel_' + d.version) || 0) >= APP_FEL_MAX)) return;
    if (pending?.version === d.version) return;
    if (+(ss.get('sf_upd_tries_' + d.version) || 0) >= MAX_TRIES) return;
    pending = { version: String(d.version), title: String(d.title || ''), critical: !!d.critical, files: Array.isArray(d.files) ? d.files.map(String) : [] };
    countdown = COUNTDOWN_S;
    document.getElementById('hud-version')?.classList.add('ny');
    showBanner();
    if (atStart()) { pending.atStart = true; reloadNow(); }   // på startmenyn: direkt, ingen nedräkning
  } catch { /* offline */ }
}

// Efter en omladdning: kom vi fram till rätt version? Annars försöker nästa koll igen.
function afterReload() {
  const target = ss.get('sf_upd_target');
  const restored = ss.get('sf_restored');
  if (restored) { ss.del('sf_restored'); setTimeout(() => toast($t`Sparningen återställd (${restored}).`, 'good wrap'), 1200); }
  if (!target) return;
  if (target === VERSION) {
    ss.del('sf_upd_target');
    setTimeout(() => toast($t`Uppdaterat till v${VERSION}! Allt du hade är kvar.`, 'good wrap'), 1200);
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => { /* t.ex. privat läge */ });
}

// ---------------------------------------------------------------- start
mountButton();
afterReload();
if (seen && seen !== VERSION && !ss.get('sf_upd_target')) {
  setTimeout(() => toast($t`Nytt i v${VERSION}: ${TITLE}!`, 'good wrap'), 2500);
  document.getElementById('hud-version')?.classList.add('ny');
}
registerServiceWorker();
setInterval(checkForUpdate, POLL_MS);
setInterval(tick, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
window.addEventListener('focus', () => checkForUpdate());
window.addEventListener('online', () => checkForUpdate());
setTimeout(checkForUpdate, 300);   // direkt vid start (förr efter 5 s) – en ny version hinner laddas innan man börjar spela
window.SF_VERSION = VERSION;
window.SF_UPDATE = { check: checkForUpdate, pending: () => pending, backups: listBackups, makeBackup, reloadNow };
