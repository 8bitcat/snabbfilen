// Grund-UI utbrutet ur Pixelverkstan: toast, modal med bokstavsgenvägar och esc().
// Ingen spellogik här – bara DOM.

const $ = (s) => document.querySelector(s);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.textContent = text;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 3100);
}

// ---------- Modal ----------
export function openModal(title, bodyHtml, buttons = [], { closable = true } = {}) {
  const m = $('#modal');
  const keepScroll = m.querySelector('.dlg')?.dataset.title === title ? m.querySelector('.dlg')?.scrollTop : 0;
  m.innerHTML = `<div class="dlg"><div class="dlg-head"><h2>${title}</h2>${closable ? '<button class="btn btn-small x" data-close>✕</button>' : ''}</div>
    <div class="dlg-body">${bodyHtml}</div><div class="dlg-foot"></div></div>`;
  const foot = m.querySelector('.dlg-foot');
  for (const b of buttons) {
    if (b.hidden) continue;
    const el = document.createElement('button');
    el.className = 'btn ' + (b.cls || ''); el.innerHTML = b.label; el.disabled = !!b.disabled;
    el.onclick = () => b.onClick?.();
    foot.append(el);
  }
  const x = m.querySelector('[data-close]');
  if (x) x.onclick = closeModal;
  m.onclick = (e) => { if (e.target === m && closable) closeModal(); };
  m.classList.remove('hidden');
  const dlg = m.querySelector('.dlg');
  dlg.dataset.title = title;
  if (keepScroll) dlg.scrollTop = keepScroll;
  assignKeys(dlg);
  return dlg;
}
export function closeModal() { $('#modal').classList.add('hidden'); $('#modal').innerHTML = ''; }

// Bokstavsgenvägar: varje knapp i dialogens fot får en bokstav ur sin egen text (visas som
// en liten tangent), flikarna får siffror. Knappar som redan har data-key behåller sin.
function assignKeys(dlg) {
  const used = new Set([...dlg.querySelectorAll('[data-key]')].map((b) => b.dataset.key));
  const foot = [...dlg.querySelectorAll('.dlg-foot .btn')].sort((a, b) => b.classList.contains('btn-go') - a.classList.contains('btn-go'));
  for (const el of foot) {
    if (el.dataset.key) continue;
    const txt = el.textContent.toUpperCase(), ok = (c) => /[A-ZÅÄÖ]/.test(c) && !used.has(c);
    const ch = txt.split(/[^A-ZÅÄÖ]+/).map((w) => w[0]).find((c) => c && ok(c)) || [...txt].find(ok);
    if (!ch) continue;
    used.add(ch); el.dataset.key = ch; el.insertAdjacentHTML('beforeend', ` <kbd>${ch}</kbd>`);
  }
  [...dlg.querySelectorAll('[data-tab]')].slice(0, 9).forEach((t, i) => { if (t.dataset.key) return; t.dataset.key = String(i + 1); t.insertAdjacentHTML('beforeend', ` <kbd>${i + 1}</kbd>`); });
}
const typingNow = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || !!document.activeElement?.isContentEditable;
window.addEventListener('keydown', (e) => {
  if (!modalOpen() || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
  const m = $('#modal');
  let el = null;
  if (e.key === 'Escape') el = m.querySelector('[data-close]');
  else if (typingNow()) return;
  else if (e.key === 'Enter') { const go = [...m.querySelectorAll('.dlg-foot .btn-go:not(:disabled)')]; if (go.length === 1) el = go[0]; }
  else if (e.key.length === 1) {
    const k = e.key.toUpperCase();
    el = [...m.querySelectorAll('[data-key]')].find((b) => b.dataset.key === k && !b.disabled) || null;
  }
  if (!el) return;
  e.preventDefault(); e.stopImmediatePropagation();
  el.click();
}, true);
export const modalOpen = () => !$('#modal').classList.contains('hidden');
