// 🔔 Notiser i appen (Pixelcity): telefonen visar själv en notis på bestämda datum – ingen server,
// och ingenting lämnar telefonen. Listan HANDELSER följer med spelpaketen, så nya händelser
// (Halloween, jul …) når appen utan nytt App Store-bygge: varje gång spelet startar läggs
// spelets notiser om efter listan. Varje händelse upprepas varje år (UNCalendarNotificationTrigger),
// så de kommer även om man inte har öppnat appen på länge.
// Spelaren väljer själv: en fråga en gång (efter första dagen) och PÅ/AV under ⚙ Inställningar.
// På webben (och i app-byggen utan insticksmodulen) gör modulen ingenting.
import { openModal, closeModal, modalOpen, toast } from './ui.js';

// { id (1–899, ändras aldrig), datum 'MM-DD', kl (timme), titel, text, fran 'YYYY-MM-DD' (valfri: först från) }
export const HANDELSER = [];

const NYCKEL = 'snabbfilen_notiser';   // 'pa' | 'av' (saknas = inte frågat än)
const BAS = 7000, PROV = 7999;         // spelets notis-id:n: BAS + händelsens id, PROV = provnotisen
const ls = {
  get() { try { return localStorage.getItem(NYCKEL); } catch { return null; } },
  set(v) { try { localStorage.setItem(NYCKEL, v); } catch { /* ok */ } },
};
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
  if (!lista.length) return 0;
  try { await P.schedule({ notifications: lista }); return lista.length; } catch { return 0; }
}

export async function slaPa() {
  const t = await tillatelse(true);
  if (t !== 'granted') {
    ls.set('av');
    toast('🔕 Telefonen tillåter inga notiser från Pixelcity. Slå på dem under Inställningar → Notiser → Pixelcity.', 'wrap');
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
    await P.schedule({ notifications: [{ id: PROV, title: 'Pixelcity', body: '🔔 Så här ser det ut när det händer något i Pixelstaden!', schedule: { at: new Date(Date.now() + 5000) } }] });
    return true;
  } catch { return false; }
}

// Vid start: lägg om notiserna, och fråga en gång när spelaren har levt minst en dag i stan.
export function startNotiser(A) {
  if (!notiserFinns()) return;
  planera();
  if (ls.get()) return;
  const koll = setInterval(() => {
    if (ls.get()) { clearInterval(koll); return; }
    if ((A.game?.day | 0) < 2 || modalOpen() || A.attract || !/^(room|city)$/.test(A.sceneName || '')) return;
    clearInterval(koll);
    openModal('🔔 Vill du få notiser?', `<p style="font-size:var(--f2);margin-top:0">Pixelcity kan säga till när det händer något i Pixelstaden – som när det blir Halloween eller jul.</p><p style="font-size:var(--f2)">Det blir bara några gånger om året. Du kan ändra dig under ⚙ Inställningar.</p>`, [
      { label: 'Nej tack', onClick: () => { ls.set('av'); closeModal(); } },
      { label: '🔔 Ja tack', cls: 'btn-go', onClick: async () => { closeModal(); if (await slaPa()) toast('🔔 Notiserna är på!', 'good'); } },
    ], { closable: false });
  }, 5000);
}
