// RÖSTCHATTENS GRÄNSSNITT: 🎙️-knappen i verktygsraden och röstpanelen (js/net/voice.js
// gör allt ljud). Panelen: 🗣️ Röst i närheten PÅ/AV, 👥 röstgruppen (skapa, bjud in, lämna),
// tysta sin mikrofon, vilka man hör just nu (🗣️ när de pratar) och tysta enskilda.
// Inbjudningar till en röstgrupp kommer som en egen dialog – den som bjuds måste tacka ja.
import { openModal, closeModal, toast, modalOpen, esc } from '../core/ui.js';
import { playersList, worldInfo } from './world.js';
import { initVoice, onVoiceChange, onVoiceInvite, voiceState, voiceSupported, setNara, createGroup, inviteToGroup, leaveGroup, toggleMic, toggleHush } from './voice.js';

const TITLE = '🎙️ Röstchatt';
let btn = null, A = null;

export function initVoiceUI(app) {
  A = app;
  initVoice(A);
  mountButton();
  onVoiceChange(() => { refreshButton(); refreshPanel(); });
  onVoiceInvite(showInvite);
  setInterval(() => { refreshButton(); refreshPanel(); }, 600); // vem pratar just nu
}

function mountButton() {
  if (btn || typeof document === 'undefined') return;
  const friends = document.querySelector('#hud-friends');
  if (!friends) return;
  btn = document.createElement('button');
  btn.id = 'hud-voice';
  btn.className = 'btn btn-small voice-off';
  btn.title = 'Röstchatt – prata med de andra';
  btn.textContent = '🎙️';
  btn.onclick = () => openVoicePanel();
  friends.before(btn);
}
function refreshButton() {
  if (!btn) return;
  const s = voiceState(), on = s.nara || !!s.group;
  const n = s.links.filter((l) => l.got).length;
  btn.classList.toggle('voice-off', !on);
  btn.classList.toggle('voice-on', on && !s.micMuted);
  btn.classList.toggle('voice-muted', on && s.micMuted);
  btn.classList.toggle('voice-talk', s.talkingSelf || s.links.some((l) => l.talking));
  const txt = on ? `${s.micMuted ? '🔇' : '🎙️'}${n ? ' ' + n : ''}` : '🎙️';
  if (btn.textContent !== txt) btn.textContent = txt;
}

// ---------- panelen ----------
function panelHtml() {
  const s = voiceState(), info = worldInfo();
  if (!s.supported) return '<p style="font-size:var(--f2);margin-top:0">Den här webbläsaren kan tyvärr inte skicka röst. Prova Chrome, Edge eller Safari.</p>';
  const others = playersList();
  const inGroup = new Set((s.group?.members || []).map((m) => m.id).filter(Boolean));
  const pending = new Set(s.sent.map((x) => x.id));
  const rows = others.map((p) => {
    const state = inGroup.has(p.id) ? '<small class="ok">✓ i gruppen</small>' : pending.has(p.id) ? '<small class="sp">väntar på svar…</small>'
      : `<button class="btn btn-small btn-gold" data-vbjud="${esc(p.id)}">🎙️ Bjud in</button>`;
    return `<div class="vrow"><span class="nm">${esc(p.av?.name || '?')}</span>${state}</div>`;
  }).join('');
  const members = (s.group?.members || []).map((m) => `${esc(m.name)}${m.online ? '' : ' 💤'}`).join(', ');
  const heard = s.links.filter((l) => l.got).map((l) => `<div class="vrow"><span class="nm">${l.talking ? '🗣️' : '🙂'} ${esc(l.name)}<br><small class="sp">${l.grupp ? '👥 gruppen' : '📍 nära'}${l.nara && !l.grupp ? ` · ${Math.round(l.vol * 100)} %` : ''}</small></span>
      <button class="btn btn-small" data-vhush="${esc(l.id)}">${l.hushed ? '🔈 Hör igen' : '🔇 Tysta'}</button></div>`).join('');
  return `
    <p style="font-size:var(--f2);margin-top:0">Prata med de andra i Pixelstaden! Mikrofonen är <b>alltid avstängd</b> tills du själv slår på den.</p>
    <div class="vbox">
      <div class="vhead"><b>🗣️ Röst i närheten</b>
        <button class="btn btn-small ${s.nara ? 'btn-red' : 'btn-go'}" data-vnara>${s.nara ? 'Stäng av' : 'Slå på'}</button></div>
      <small class="sp">Du hör – och hörs av – andra som också har rösten på och står nära dig. Ljudet tonar bort när ni går ifrån varandra.</small>
    </div>
    <div class="vbox">
      <div class="vhead"><b>👥 Röstgrupp</b>${s.group ? '<button class="btn btn-small btn-red" data-vlamna>🚪 Lämna</button>' : '<button class="btn btn-small btn-go" data-vskapa>➕ Skapa grupp</button>'}</div>
      <small class="sp">${s.group ? (members ? `Med i gruppen: <b>${members}</b>. Ni hörs överallt i stan, var ni än är.` : 'Gruppen är skapad – bjud in kompisar nedan. Ni hörs överallt i stan, var ni än är.') : 'En grupp hörs överallt i stan, var ni än är. Den du bjuder in måste tacka ja.'}</small>
      ${others.length ? `<div class="vlist">${rows}</div>` : `<p class="sp" style="font-size:var(--f1);margin:6px 0 0">${info.open ? 'Ingen annan är i Pixelstaden just nu.' : '📡 Kopplar upp mot världen…'}</p>`}
    </div>
    ${s.mic ? `<div class="vbox"><div class="vhead"><b>${s.micMuted ? '🔇 Din mikrofon är tyst' : s.talkingSelf ? '🗣️ Du pratar' : '🎙️ Din mikrofon är på'}</b>
      <button class="btn btn-small" data-vmic>${s.micMuted ? '🎙️ Slå på' : '🔇 Tysta'}</button></div></div>` : ''}
    ${heard ? `<div class="vbox"><b>🔊 Du hör nu</b><div class="vlist">${heard}</div></div>` : ''}
    <p class="world-diag">Tips: använd hörlurar så slipper ni eko. Första gången frågar webbläsaren om mikrofonen.</p>`;
}
let lastHtml = '';
function bind(dlg) {
  const on = (sel, fn) => dlg.querySelectorAll(sel).forEach((b) => (b.onclick = fn(b)));
  on('[data-vnara]', () => async () => { await setNara(!voiceState().nara); });
  on('[data-vskapa]', () => async () => { if (await createGroup()) toast('👥 Röstgruppen är skapad – bjud in kompisar!', 'good'); });
  on('[data-vlamna]', () => () => leaveGroup());
  on('[data-vmic]', () => () => toggleMic());
  on('[data-vbjud]', (b) => async () => { b.disabled = true; await inviteToGroup(b.dataset.vbjud); });
  on('[data-vhush]', (b) => () => toggleHush(b.dataset.vhush));
}
export function openVoicePanel() {
  if (!voiceSupported()) { openModal(TITLE, panelHtml(), [{ label: 'Stäng', cls: 'btn-go', onClick: closeModal }]); return; }
  lastHtml = panelHtml();
  const dlg = openModal(TITLE, lastHtml, [{ label: 'Stäng', cls: 'btn-go', onClick: closeModal }]);
  bind(dlg);
}
// panelen ritas om när något ändras (bara om den är öppen och innehållet faktiskt ändrats)
function refreshPanel() {
  if (!modalOpen()) return;
  const dlg = document.querySelector('#modal .dlg');
  if (!dlg || dlg.dataset.title !== TITLE) return;
  const html = panelHtml();
  if (html === lastHtml) return;
  lastHtml = html;
  const body = dlg.querySelector('.dlg-body');
  if (!body) return;
  body.innerHTML = html;
  bind(dlg);
}

// ---------- inbjudan till en röstgrupp ----------
function showInvite({ namn, accept, decline }) {
  let answered = false;
  const ask = () => {
    openModal('🎙️ Prata ihop?', `<p style="font-size:var(--f2);margin-top:0"><b>${esc(namn)}</b> bjuder in dig till en röstgrupp – ni hör varandra överallt i stan.</p>
      <p style="font-size:var(--f2)">Går du med slås din mikrofon på (webbläsaren frågar första gången). Du kan lämna gruppen när du vill via 🎙️.</p>`, [
      { label: '🎙️ Gå med', cls: 'btn-go', onClick: async () => { answered = true; closeModal(); await accept(); } },
      { label: 'Nej tack', onClick: () => { answered = true; closeModal(); decline(); } },
    ], { closable: false });
  };
  // stör inte mitt i en annan dialog – vänta tills den stängts (högst ~25 s, sedan nej)
  if (!modalOpen()) { ask(); return; }
  let tries = 0;
  const wait = setInterval(() => {
    tries++;
    if (!modalOpen()) { clearInterval(wait); ask(); } else if (tries > 50) { clearInterval(wait); if (!answered) decline(); }
  }, 500);
}
