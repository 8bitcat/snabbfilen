// 🔔 Notiser i appen (Pixelcity): telefonen visar själv en notis på bestämda datum – ingen server,
// och ingenting lämnar telefonen. Listan HANDELSER följer med spelpaketen, så nya händelser
// (Halloween, jul …) når appen utan nytt App Store-bygge: varje gång spelet startar läggs
// spelets notiser om efter listan. Varje händelse upprepas varje år (UNCalendarNotificationTrigger),
// så de kommer även om man inte har öppnat appen på länge.
// Spelaren väljer själv: en fråga en gång (efter första dagen) och PÅ/AV under ⚙ Inställningar.
// På webben (och i app-byggen utan insticksmodulen) gör modulen ingenting.
import { openModal, closeModal, modalOpen, toast } from './ui.js';
import { $t } from './i18n.js';

// { id (1–899, ändras aldrig), datum 'MM-DD', kl (timme), titel, text, fran 'YYYY-MM-DD' (valfri: först från) }
export const HANDELSER = [
  { id: 4, datum: '10-24', kl: 17, titel: $t('Halloween-veckan! 🎃'), text: $t('Maskeradbutiken i förorten har dräkter, pumpor och skelett. Tänd en pumplykta hemma!') },
  { id: 5, datum: '10-31', kl: 16, titel: $t('Glad Halloween! 👻'), text: $t('Klä ut dig och skräm dina kompisar i Pixelstaden!') },
  { id: 1, datum: '12-01', kl: 17, titel: $t('Det är december! 🎄'), text: $t('Julvåningen i klädaffären är full av pynt – klä granen, tänd brasan och grilla marshmallows.') },
  { id: 2, datum: '12-13', kl: 8, titel: $t('Glad Lucia! 🕯️'), text: $t('Luciakläderna hänger på klädaffärens julvåning i Pixelstaden.') },
  { id: 3, datum: '12-24', kl: 10, titel: $t('God jul! 🎅'), text: $t('God jul från Pixelstaden! Tänd brasan och ha det mysigt.') },
];

const NYCKEL = 'snabbfilen_notiser';   // 'pa' | 'av' (saknas = inte frågat än)
const BAS = 7000, PROV = 7999;         // spelets notis-id:n: BAS + händelsens id, PROV = provnotisen
const ls = {
  get() { try { return localStorage.getItem(NYCKEL); } catch { return null; } },
  set(v) { try { localStorage.setItem(NYCKEL, v); } catch { /* ok */ } },
};
// fler notiser utöver HANDELSER: (nu) → [{ id 100–199, title, body, schedule }] – en källa per nyckel
// ('presenter' = morgonnotiserna i js/core/presenter.js, 'fest' = lördagsfesten i js/city/fest.js)
const extras = new Map();
export const setExtraNotiser = (fn, nyckel = 'presenter') => { if (typeof fn === 'function') extras.set(nyckel, fn); else extras.delete(nyckel); };
const plugin = () => {
  const C = window.Capacitor;
  return C?.isNativePlatform?.() ? C.Plugins?.LocalNotifications || null : null;
};
export const notiserFinns = () => !!plugin();
export const notiserPa = () => notiserFinns() && ls.get() === 'pa';

// tillåtelsen i telefonen: 'granted' | 'denied' | 'prompt'
async function tillatelse(fraga) {
  const P = plugin();
  if (!P) return 'denied';
  try {
    let r = await P.checkPermissions();
    if (fraga && r.display !== 'granted' && r.display !== 'denied') r = await P.requestPermissions();
    return r.display === 'granted' ? 'granted' : r.display === 'denied' ? 'denied' : 'prompt';
  } catch { return 'denied'; }
}

async function rensa() {
  const P = plugin();
  if (!P) return;
  try {
    const { notifications = [] } = await P.getPending();
    const vara = notifications.filter((n) => +n.id >= BAS && +n.id <= PROV).map((n) => ({ id: +n.id }));
    if (vara.length) await P.cancel({ notifications: vara });
  } catch { /* ok */ }
}

// lägg om alla spelets notiser efter HANDELSER (anropas vid start och när man slår på)
export async function planera(nu = new Date()) {
  const P = plugin();
  if (!P || ls.get() !== 'pa') return 0;
  if (await tillatelse(false) !== 'granted') return 0;
  await rensa();
  const idag = nu.toISOString().slice(0, 10);
  const lista = HANDELSER.filter((h) => !h.fran || h.fran <= idag).map((h) => {
    const [month, day] = h.datum.split('-').map(Number);
    return { id: BAS + h.id, title: h.titel, body: h.text, schedule: { on: { month, day, hour: h.kl ?? 17, minute: 0 } } };
  });
  for (const fn of extras.values()) { try { for (const n of fn(nu) || []) if (n && +n.id >= 100 && +n.id < 200) lista.push({ ...n, id: BAS + +n.id }); } catch { /* ok */ } }
  if (!lista.length) return 0;
  try { await P.schedule({ notifications: lista }); return lista.length; } catch { return 0; }
}

export async function slaPa() {
  const t = await tillatelse(true);
  if (t !== 'granted') {
    ls.set('av');
    toast($t('🔕 Telefonen tillåter inga notiser från Pixelcity. Slå på dem under Inställningar → Notiser → Pixelcity.'), 'wrap');
    return false;
  }
  ls.set('pa');
  await planera();
  return true;
}
export async function slaAv() {
  ls.set('av');
  await rensa();
}

// en provnotis om fem sekunder – så man ser att det funkar
export async function provNotis() {
  const P = plugin();
  if (!P || await tillatelse(false) !== 'granted') return false;
  try {
    await P.schedule({ notifications: [{ id: PROV, title: 'Pixelcity', body: $t('🔔 Så här ser det ut när det händer något i Pixelstaden!'), schedule: { at: new Date(Date.now() + 5000) } }] });
    return true;
  } catch { return false; }
}

// Frågan (Carl 2026-10-13: "har man inte sagt ja till notiser så ska man få frågan efter man har öppnat en present"):
// efter en öppnad present (presenter.js) och vid start – bara i appen, bara om notiserna inte är på, högst en gång om dagen.
const FRAGAD = 'snabbfilen_notiser_fragad';   // dagen (YYYY-MM-DD) frågan senast visades
export function fragaNotiser(A) {
  if (!notiserFinns() || ls.get() === 'pa' || modalOpen()) return false;
  const idag = new Date().toISOString().slice(0, 10);
  try { if (localStorage.getItem(FRAGAD) === idag) return false; localStorage.setItem(FRAGAD, idag); } catch { /* ok */ }
  openModal($t('🔔 Vill du få notiser?'), `<p style="font-size:var(--f2);margin-top:0">${$t('Pixelcity kan säga till när en ny present väntar på dig – en på morgonen och en på kvällen – och när det händer något i Pixelstaden.')}</p><p style="font-size:var(--f2)">${$t('Högst två notiser om dagen. Du kan ändra dig under ⚙ Inställningar.')}</p>`, [
    { label: $t('Nej tack'), onClick: () => { ls.set('av'); closeModal(); } },
    { label: $t('🔔 Ja tack'), cls: 'btn-go', onClick: async () => { closeModal(); if (await slaPa()) toast($t('🔔 Notiserna är på! Mobilen säger till kl. 7 och kl. 19.'), 'good'); } },
  ], { closable: false });
  return true;
}
// Vid start: lägg om notiserna, och fråga – när spelaren har öppnat sin första present eller levt en dag i stan.
export function startNotiser(A) {
  if (!notiserFinns()) return;
  planera();
  if (ls.get() === 'pa') return;
  const koll = setInterval(() => {
    if (ls.get() === 'pa') { clearInterval(koll); return; }
    if (((A.game?.day | 0) < 2 && !(A.game?.presenter?.antal > 0)) || modalOpen() || A.attract || !/^(room|city)$/.test(A.sceneName || '')) return;
    clearInterval(koll);
    if (!ls.get()) fragaNotiser(A);   // (har man sagt nej frågar spelet igen först efter nästa öppnade present)
  }, 5000);
}
