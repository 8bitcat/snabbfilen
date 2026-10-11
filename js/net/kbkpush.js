// ⚽ KBK-PUSH i spelet – Carl 2026-10-11: "XXX har precis hoppat in i Pixelcity, så alla KBK-spelare kan få en notis."
// Servern (server/kbk-push, kbk.8bitcat.io) skickar pushnotisen via Apple till lagets telefoner – även när appen är
// stängd. Spelet gör två saker:
//   • i appen (1.2+, @capacitor/push-notifications): har figuren stämt av sig i KBK-appen frågar telefonen om lov
//     att visa notiser, och pushkoden registreras hos servern med numret och förnamnet (servern stämmer av mot laget)
//   • när en avstämd KBK-spelare startar spelet – i appen eller på webben – säger spelet "inne" till servern, en gång
//     per start (servern spärrar dessutom samma nummer i 30 minuter)
// "Inte jag – ta bort" i KBK-appen avregistrerar telefonen. Testrobotarna pratar aldrig med den riktiga servern
// (?kbkpush=<adress> pekar dem mot en låtsasserver).
import { kbkNr } from './kbk.js';
import { KUNGS_PLAYERS } from '../data/kbk.js';
import { LANG } from '../core/i18n.js';

const robot = () => typeof navigator !== 'undefined' && !!navigator.webdriver;
const SERVER = () => {
  try { const q = new URLSearchParams(location.search).get('kbkpush'); if (q) return q.replace(/\/+$/, ''); } catch { /* ok */ }
  return robot() ? null : 'https://kbk.8bitcat.io';
};
const PUSH = () => { try { const C = window.Capacitor; return C?.isNativePlatform?.() ? C.Plugins?.PushNotifications || null : null; } catch { return null; } };
const namnFor = (nr) => KUNGS_PLAYERS.find(([n]) => n === nr)?.[1] || '';
const NYCKEL = 'snabbfilen_kbk_push';   // { token, nr } – telefonens registrerade pushkod
const ls = {
  get() { try { return JSON.parse(localStorage.getItem(NYCKEL) || 'null'); } catch { return null; } },
  set(v) { try { if (v) localStorage.setItem(NYCKEL, JSON.stringify(v)); else localStorage.removeItem(NYCKEL); } catch { /* ok */ } },
};
async function post(path, data) {
  const s = SERVER();
  if (!s) return null;
  try {
    const r = await fetch(s + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    return await r.json().catch(() => null);
  } catch { return null; }   // offline – nästa start försöker igen
}

let A0 = null, lyssnar = false;
// Telefonen: lov att visa notiser + pushkoden till servern. fraga = visa telefonens fråga om man inte svarat än.
export async function kbkPushRegistrera(A, { fraga = true } = {}) {
  A0 = A;
  const P = PUSH(), nr = kbkNr(A?.avatar);
  if (!P || !nr) return false;
  try {
    let perm = await P.checkPermissions();
    if (perm.receive !== 'granted' && perm.receive !== 'denied' && fraga) perm = await P.requestPermissions();
    if (perm.receive !== 'granted') return false;
    if (!lyssnar) {
      lyssnar = true;
      await P.addListener('registration', async ({ value } = {}) => {
        const nu = kbkNr(A0?.avatar);
        if (!nu || !value) return;
        const r = await post('/registrera', { token: value, nr: nu, namn: namnFor(nu), lang: LANG });
        if (r?.ok) ls.set({ token: value, nr: nu });
      });
    }
    await P.register();
    return true;
  } catch { return false; }
}
// "Inte jag – ta bort": telefonen ska inte få lagets notiser längre
export async function kbkPushAv() {
  const s = ls.get();
  if (s?.token) await post('/avregistrera', { token: s.token });
  ls.set(null);
}
// En KBK-spelare har hoppat in i Pixelstaden (en gång per start)
let sagt = false;
export async function kbkPushInne(A) {
  const nr = kbkNr(A?.avatar);
  if (!nr || sagt) return;
  sagt = true;
  await post('/inne', { nr, namn: namnFor(nr), token: ls.get()?.token || '' });
}
