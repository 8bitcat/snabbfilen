// Versionsnumret i HUD:en, nyhetsrutan (läser CHANGELOG.md) och en tyst koll om en
// nyare version har publicerats medan man spelar. Helt fristående från spellogiken.
import { VERSION, TITLE } from '../version.js';
import { openModal, toast, esc } from './ui.js';

const SEEN_KEY = 'snabbfilen_seen_version';
const CHECK_EVERY = 5 * 60 * 1000;
const SHOW_RELEASES = 6;

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

function releasesHtml(list) {
  return `<div class="nyheter">${list.map((r) => `
    <section class="${r.version === VERSION ? 'nu' : ''}">
      <h3><span class="ver">v${esc(r.version)}</span> ${inline(r.title)}${r.version === VERSION ? ' <span class="du">← du spelar den här</span>' : ''}</h3>
      <div class="datum">${esc(r.date)}</div>
      <ul>${r.items.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>
    </section>`).join('')}</div>`;
}

export async function openNews() {
  let list = [];
  try {
    const res = await fetch('CHANGELOG.md?' + Date.now(), { cache: 'no-store' });
    if (res.ok) list = parseChangelog(await res.text()).slice(0, SHOW_RELEASES);
  } catch { /* offline – visa det vi vet */ }
  if (!list.length) list = [{ version: VERSION, date: '', title: TITLE, items: [] }];
  openModal(`Nyheter i Snabbfilen`, releasesHtml(list));
}

function mountButton() {
  const host = document.querySelector('#hud .hud-btns');
  if (!host || document.getElementById('hud-version')) return;
  const b = document.createElement('button');
  b.id = 'hud-version';
  b.className = 'btn btn-small hud-version';
  b.title = 'Nyheter – vad är nytt i spelet?';
  b.textContent = 'v' + VERSION;
  b.onclick = () => openNews();
  host.prepend(b);
}

// Första start av en ny version för en återvändande spelare → kort toast om nyheten.
function greetNewVersion() {
  let seen = null;
  try { seen = localStorage.getItem(SEEN_KEY); localStorage.setItem(SEEN_KEY, VERSION); } catch { return; }
  if (seen && seen !== VERSION) {
    setTimeout(() => toast(`Nytt i v${VERSION}: ${TITLE}!`, 'good wrap'), 2500);
    document.getElementById('hud-version')?.classList.add('ny');
  }
}

// Har en nyare version publicerats sedan sidan laddades? Säg till en gång.
let told = false;
async function checkForUpdate() {
  if (told || document.hidden) return;
  try {
    const res = await fetch('version.json?' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const v = (await res.json())?.version;
    if (v && v !== VERSION && newer(v, VERSION)) {
      told = true;
      toast(`v${v} har kommit – ladda om sidan!`, 'good wrap');
      const b = document.getElementById('hud-version');
      if (b) { b.classList.add('ny'); b.title = `v${v} finns – ladda om sidan`; }
    }
  } catch { /* offline */ }
}
const newer = (a, b) => {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
};

mountButton();
greetNewVersion();
setInterval(checkForUpdate, CHECK_EVERY);
window.SF_VERSION = VERSION;
