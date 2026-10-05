// Tryggheten i den öppna världen (App Store-riktlinje 1.2, innehåll från andra spelare):
//   FILTER   fula ord i namn och pratbubblor blir *** – för de andra spelarna och för det man själv skriver
//   BLOCKERA en blockerad spelare (spelarnyckeln, world.js key) finns inte längre för en: ingen figur,
//            pratbubbla, röst, inbjudan eller "är i Pixelstaden". Listan sparas i webbläsaren/appen
//            och ångras i 👥-rutan.
//   ANMÄL    öppnar e-posten till hello@8bitcat.io med vem, varför och vad hen skrivit senast –
//            och blockerar spelaren direkt
// world.js filtrerar (worldFolksHere, playersList, jobbkanalen, pratbubblorna), voice.js vägrar röst.
import { openModal, closeModal, toast, esc } from '../core/ui.js';

export const SUPPORT = 'hello@8bitcat.io';
const KEY = 'snabbfilen_blockerade';

// ---------- blockerade spelare: nyckel → { namn, at } ----------
let blocked = new Map();
try { blocked = new Map(Object.entries(JSON.parse(localStorage.getItem(KEY) || '{}') || {})); } catch { /* tom lista */ }
const spara = () => { try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(blocked))); } catch { /* ok */ } };
export const isBlockedKey = (k) => !!k && blocked.has(String(k));
export function block(key, namn) {
  if (!key) return false;
  blocked.set(String(key), { namn: String(namn || '?').slice(0, 24), at: Date.now() });
  spara();
  return true;
}
export function unblock(key) { blocked.delete(String(key)); spara(); }
export const blockedList = () => [...blocked].map(([key, b]) => ({ key, namn: b.namn, at: b.at })).sort((a, b) => b.at - a.at);

// ---------- ordfiltret: ordstammar (svenska + engelska) som gör hela ordet till *** ----------
// En stam med * matchar ordets början (jävl* = jävla, jävlar, jävligt …), annars hela ordet.
const ORD = [
  'fan', 'faan', 'fanskap*', 'jävl*', 'javl*', 'jäv*l', 'satan', 'satans', 'helvete*', 'skit', 'skitstövel*', 'skitunge*',
  'fitt*', 'kuk', 'kukar*', 'kuken', 'kukhuvud*', 'hora', 'horan', 'horor*', 'horunge*', 'knull*', 'knulla*', 'rövhål*', 'rovhal*', 'arsel*',
  'mongo', 'mongol*', 'cp', 'cpunge*', 'cp-unge*', 'efterbliven*', 'neger*', 'negr*', 'blatte*', 'svartskall*', 'bögjävel*', 'hitler*', 'nazist*',
  'fuck*', 'fck', 'fuk', 'motherfuck*', 'shit*', 'bitch*', 'bastard*', 'asshole*', 'dick', 'dickhead*', 'cunt*', 'pussy', 'whore*', 'slut*',
  'nigg*', 'faggot*', 'retard*', 'twat*', 'wanker*', 'cock', 'cocks*', 'kys', 'killyourself',
];
const RE = new RegExp(`(^|[^\\p{L}\\p{N}])(${ORD.map((w) => w.replace(/\*/g, '[\\p{L}\\p{N}]*')).join('|')})(?=$|[^\\p{L}\\p{N}])`, 'giu');
export function tvatta(t) {
  const s = String(t ?? '');
  return s.replace(RE, (m, pre, w) => pre + '*'.repeat(Math.min(6, Math.max(3, [...w].length))));
}

// ---------- det senaste varje spelare skrivit (till anmälan) ----------
const LOGG = new Map();   // nyckel → [{ t, text }]
export function loggaSay(key, text) {
  if (!key || !text) return;
  const k = String(key), l = LOGG.get(k) || [];
  l.push({ t: Date.now(), text: String(text).slice(0, 120) });
  while (l.length > 12) l.shift();
  LOGG.set(k, l);
}
const tid = (t) => new Date(t).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

// ---------- anmäl ----------
const SKAL = [
  ['elak', 'Var elak mot mig eller andra'],
  ['ord', 'Fula ord eller ett olämpligt namn'],
  ['stor', 'Stör, följer efter eller tjatar'],
  ['annat', 'Något annat'],
];
// p = { key, namn } · info = { mig, version, world }
export function openAnmal(p, info = {}) {
  const namn = String(p?.namn || '?');
  const dlg = openModal(`⚑ Anmäl ${esc(namn)}`, `
    <p style="font-size:var(--f2);margin-top:0">Vad hände? Anmälan går till oss som gör spelet (<b>${SUPPORT}</b>) och <b>${esc(namn)}</b> blir blockerad direkt – du ser och hör inte hen längre.</p>
    <div class="anmal-skal" style="display:grid;gap:6px;margin:8px 0">${SKAL.map(([id, txt], i) => `<label style="font-size:var(--f2);display:flex;gap:8px;align-items:center"><input type="radio" name="anmal-skal" value="${id}"${i === 0 ? ' checked' : ''}> ${esc(txt)}</label>`).join('')}</div>
    <textarea class="anmal-text" maxlength="400" rows="3" placeholder="Berätta gärna lite mer (frivilligt)" style="width:100%;font:var(--f2) var(--font);padding:6px;border:3px solid var(--ink)"></textarea>
    <p style="font-size:var(--f1);color:#6b6474">Öppnas ingen e-post kan du skriva själv till ${SUPPORT}. Be gärna en vuxen om hjälp.</p>`,
  [
    { label: 'Avbryt', onClick: closeModal },
    { label: '⚑ Anmäl och blockera', cls: 'btn-red', onClick: () => {
      const skal = dlg.querySelector('input[name="anmal-skal"]:checked')?.value || 'annat';
      const extra = String(dlg.querySelector('.anmal-text')?.value || '').slice(0, 400);
      const logg = (LOGG.get(String(p.key)) || []).map((l) => `  ${tid(l.t)}  "${l.text}"`).join('\n') || '  (inget skrivet)';
      const body = [
        `Spelare: ${namn}`, `Spelarnyckel: ${p.key || '-'}`, `Skäl: ${SKAL.find((s) => s[0] === skal)?.[1] || skal}`,
        `Vad hände: ${extra || '-'}`, '', 'Senast skrivet:', logg, '',
        `Anmält av: ${info.mig || '-'} · värld ${info.world || '-'} · v${info.version || '-'} · ${new Date().toISOString()}`,
      ].join('\n');
      block(p.key, namn);
      closeModal();
      toast(`⚑ Tack! ${namn} är blockerad. Skicka mejlet som öppnas så tittar vi på det.`, 'good wrap');
      const url = `mailto:${SUPPORT}?subject=${encodeURIComponent(`Anmälan: ${namn}`)}&body=${encodeURIComponent(body)}`;
      try { if (window.__sfMailto) window.__sfMailto(url); else window.location.href = url; } catch { /* adressen står i rutan */ }   // (__sfMailto: tools/skydd-test.mjs)
      info.efter?.();
    } },
  ]);
  return dlg;
}
