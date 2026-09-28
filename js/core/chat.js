// Chatten: tryck Enter (eller 💬 i HUD:en) → en inmatningsrad längst ner; Enter skickar,
// Esc stänger. Det man skriver visas som en pratbubbla ovanför ens figur i några
// sekunder och skickas till alla andra i världen (de ser den om de är på samma plats).
import { modalOpen } from './ui.js';
import { isMenuOpen } from './menu.js';

const MAX = 80;
let A = null, bar = null, input = null;
// Emojiväljaren (alla emoji går också att skriva in direkt, t.ex. Win + . eller mobilens tangentbord)
const EMOJIS = [
  ['Glad', '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😋 😛 😜 🤪 😎 🤩 🥳 😏 🤗 🤭 🫡 🤔 🤫'],
  ['Känslor', '😐 😑 😶 🙄 😬 😴 🤤 😪 😮 😲 😳 🥺 😢 😭 😤 😠 😡 🤯 😱 😨 😰 🤢 🤮 🤧 🥶 🥵 😵 💀 👻 🤖 👽 💩'],
  ['Hjärtan', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💖 💗 💓 💞 💕 💘 💝 💔 ❣️ 💯 ✨ ⭐ 🌟 💫 🔥 💥 🎉 🎊'],
  ['Händer', '👋 🤚 ✋ 👌 🤌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 👍 👎 ✊ 👊 👏 🙌 🫶 👐 🤝 🙏 💪'],
  ['Djur', '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦆 🦉 🐴 🦄 🐝 🦋 🐢 🐍 🐙 🐬 🐳 🐟'],
  ['Mat', '🍎 🍊 🍋 🍌 🍉 🍇 🍓 🍒 🥝 🍍 🥕 🌽 🍞 🧀 🍔 🍟 🍕 🌭 🥪 🌮 🍝 🍣 🍩 🍪 🎂 🍰 🧁 🍫 🍭 🍦 ☕ 🧃 🥤'],
  ['Saker', '⚽ 🏀 🏈 🎾 🏐 🎮 🕹️ 🎲 🎨 🎵 🎶 🎸 🎤 🎧 📱 💻 🖥️ 💡 🎁 🎈 🏆 🥇 👑 💎 💰 🔑 🏠 🚗 🚌 ✈️ 🚀 🌈 ☀️ 🌙 ⛄ 🌧️'],
];

function mount() {
  if (bar) return;
  bar = document.createElement('div');
  bar.id = 'chat';
  bar.className = 'hidden';
  bar.innerHTML = `<div class="chat-emojis hidden">${EMOJIS.map(([cat, list]) => `<div class="chat-cat"><b>${cat}</b><div>${[...list].filter((c) => c.trim()).map((e) => `<button type="button" data-emo="${e}">${e}</button>`).join('')}</div></div>`).join('')}</div>
    <button class="btn btn-small" data-emopick title="Emoji">😀</button><input type="text" maxlength="${MAX}" placeholder="Skriv något till de andra …" autocomplete="off" spellcheck="false"><button class="btn btn-small btn-go" data-send>Skicka</button><button class="btn btn-small" data-close title="Stäng (Esc)">✕</button>`;
  document.body.append(bar);
  input = bar.querySelector('input');
  const pick = bar.querySelector('.chat-emojis');
  bar.querySelector('[data-emopick]').onclick = () => { pick.classList.toggle('hidden'); input.focus(); };
  pick.addEventListener('click', (e) => {
    const b = e.target.closest('[data-emo]');
    if (!b) return;
    const at = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? at;
    input.value = (input.value.slice(0, at) + b.dataset.emo + input.value.slice(end)).slice(0, MAX);
    const pos = Math.min(MAX, at + b.dataset.emo.length);
    input.focus(); input.setSelectionRange(pos, pos);
  });
  bar.querySelector('[data-send]').onclick = () => send();
  bar.querySelector('[data-close]').onclick = () => close();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); send(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  });
}
export const isChatOpen = () => !!bar && !bar.classList.contains('hidden');
export function openChat() {
  mount();
  bar.classList.remove('hidden');
  setTimeout(() => input.focus(), 20);
}
export function close() { bar?.classList.add('hidden'); input?.blur(); }
function send() {
  const text = String(input.value || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, MAX);
  input.value = '';
  close();
  if (text) A.sendSay?.(text);
}

export function mountChat(app) {
  A = app;
  mount();
  const host = document.querySelector('#hud .hud-btns');
  if (host && !document.getElementById('hud-chat')) {
    const b = document.createElement('button');
    b.id = 'hud-chat'; b.className = 'btn btn-small'; b.title = 'Chatta (Enter)';
    b.textContent = '💬';
    b.onclick = () => (isChatOpen() ? close() : openChat());
    host.insertBefore(b, host.querySelector('#hud-friends') || null);
  }
  // Enter öppnar chatten när ingen dialog eller meny är öppen och man inte redan skriver
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || isChatOpen() || modalOpen() || isMenuOpen() || e.ctrlKey || e.altKey || e.metaKey) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    if (!A?.avatar?.name || A.attract) return;
    e.preventDefault();
    openChat();
  });
}
