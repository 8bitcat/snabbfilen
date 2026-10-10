// ⚽ KBK – LAGKOMPISAR. Carl 2026-10-10: "de som spelar i KBK kan få en notis när en lagkompis loggar in".
// Under ⚙ Inställningar säger man att man spelar i Kungsladugård: man skriver sitt förnamn och sitt nummer,
// och det stäms av mot laget (js/data/kbk.js). Sedan:
//   • figuren skickar sitt nummer med i Pixelstaden (fältet kb i world.js – äldre versioner ignorerar det)
//   • kommer en lagkompis in får man en egen hälsning: "⚽ Julia 34 från KBK är i Pixelstaden!"
//   • kommer man själv in och lagkompisar redan är där står de i välkomsthälsningen
//   • ligger spelet i bakgrunden (en annan flik, eller appen nyss lagd åt sidan) kommer det som en notis
//     i datorn/telefonen – om man har sagt ja till notiser
// Bara förnamn och nummer, som i klädaffärens lag. Valet gäller figuren (syskon på samma iPad har var sin).
// Samma lagkompis hälsas högst en gång i halvtimmen (tappad uppkoppling och omladdning ger annars nya hälsningar).
// En riktig pushnotis när appen är STÄNGD kräver en server – den finns inte (än).
import { KUNGS_PLAYERS } from '../data/kbk.js';
import { $t } from '../core/i18n.js';
import { toast } from '../core/ui.js';
import { play } from '../core/sound.js';

const NYCKEL = 'snabbfilen_kbk';         // { [figurens id]: nummer }
const OM_IGEN_MS = 30 * 60 * 1000;
let minne = null;   // (världen frågar varje bildruta – läs lagringen en gång)
const ls = {
  get() { if (minne) return minne; try { const v = JSON.parse(localStorage.getItem(NYCKEL) || '{}'); minne = v && typeof v === 'object' ? v : {}; } catch { minne = {}; } return minne; },
  set(v) { minne = { ...v }; try { localStorage.setItem(NYCKEL, JSON.stringify(v)); } catch { /* ok */ } },
};
const enkel = (s) => String(s ?? '').normalize('NFC').trim().toLocaleLowerCase('sv');
export const spelare = (nr) => KUNGS_PLAYERS.find(([n]) => n === +nr) || null;

// Stämmer förnamnet och numret? → [nr, namn] ur laget, annars null
export function kbkStammer(namn, nr) {
  const n = parseInt(String(nr ?? '').replace(/\D+/g, ''), 10);
  const p = spelare(n);
  return p && enkel(p[1]) === enkel(namn) ? p : null;
}
// Figurens lagnummer (0 = spelar inte i KBK / inte avstämt)
export function kbkNr(av) {
  const nr = av?.id ? +ls.get()[av.id] || 0 : 0;
  return spelare(nr) ? nr : 0;
}
export function kbkSpara(av, nr) { if (!av?.id || !spelare(nr)) return false; ls.set({ ...ls.get(), [av.id]: +nr }); return true; }
export function kbkTaBort(av) { const v = { ...ls.get() }; delete v[av?.id]; ls.set(v); }
export const kbkEtikett = (nr) => etikett(nr);

const etikett = (nr) => { const p = spelare(nr); return p ? `${p[1]} ${p[0]}` : ''; };
const halsad = new Map();   // nyckel → senaste hälsningen

// En annan spelare kom in. p = närvaron ur world.js (p.kb, p.key). true = det var en lagkompis och hälsningen är gjord.
export function kbkKomIn(A, p) {
  const mitt = kbkNr(A?.avatar), deras = spelare(p?.kb) ? +p.kb : 0;
  if (!mitt || !deras) return false;
  const k = p.key || 'nr' + deras, nu = Date.now();
  if (nu - (halsad.get(k) || 0) < OM_IGEN_MS) return true;   // samma lagkompis nyss – ingen ny hälsning
  halsad.set(k, nu);
  const text = $t`⚽ ${etikett(deras)} från KBK är i Pixelstaden!`;
  play('knock');
  toast(text, 'good');
  bakgrundsnotis(text);
  return true;
}
// Man kom själv in: lagkompisar som redan är där (players = världens andra spelare)
export function kbkRedanHar(A, players) {
  if (!kbkNr(A?.avatar)) return;
  const nu = Date.now(), namn = [];
  for (const p of players) {
    if (!spelare(p?.kb)) continue;
    halsad.set(p.key || 'nr' + p.kb, nu);
    namn.push(etikett(p.kb));
  }
  if (namn.length) setTimeout(() => toast($t`⚽ Lagkompisar i Pixelstaden: ${namn.join(', ')}`, 'good'), 1600);
}

// Spelet ligger i bakgrunden → en notis i datorn (webbens notiser) eller i telefonen (appens notiser)
async function bakgrundsnotis(text) {
  if (typeof document === 'undefined' || !document.hidden) return;
  try {
    const C = window.Capacitor;
    if (C?.isNativePlatform?.()) {
      const P = C.Plugins?.LocalNotifications;
      if (P && (await P.checkPermissions()).display === 'granted') await P.schedule({ notifications: [{ id: 7900 + (Date.now() % 90), title: 'Pixelcity', body: text, schedule: { at: new Date(Date.now() + 500) } }] });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Pixelstaden', { body: text, tag: 'kbk' });
    }
  } catch { /* ingen notis – hälsningen i spelet räcker */ }
}
// Be om lov att visa notiser (på webben – appen frågar via 🔔 Notiser)
export async function kbkFragaNotiser() {
  try {
    if (window.Capacitor?.isNativePlatform?.()) return;
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
  } catch { /* ok */ }
}
