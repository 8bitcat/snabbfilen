// 💛 VÄNNER-PUSH – notis till vännernas telefoner när man hoppar in (appen 1.2+, även när den är stängd), via
// pushservern (server/kbk-push, adresserna /van/…). Spelet:
//   • vid varje start: skickar figurens vänlista till servern om den har ändrats sedan sist (/van/vanner) och – om man
//     har vänner – säger "inne" (/van/inne). Servern skickar bara till vänner åt BÅDA hållen, högst var 30:e minut.
//   • i appen: har figuren vänner och har man sagt ja till notiser registreras telefonens pushkod för figuren
//     (/van/registrera). Telefonen frågar om lov när man får sin första vän, eller via 🔔 i Vänner-appen.
//   • ändras listan (ny vän, borttagen vän) går den nya listan till servern direkt.
// Samma server och pushmodul som KBK (js/net/kbkpush.js). Testrobotarna pratar aldrig med den riktiga servern
// (?kbkpush=<adress> pekar dem mot en låtsasserver).
import { vanEgen, vanLista, vanOnAndrad } from './vanner.js';
import { pushPost, pushPlugin } from './kbkpush.js';
import { LANG, $t } from '../core/i18n.js';
import { toast } from '../core/ui.js';
import { play } from '../core/sound.js';

const SYNK = 'snabbfilen_van_synk';   // { [vid]: vänlistan som servern har (fingeravtryck) }
const REG = 'snabbfilen_van_push';    // { [vid]: pushkoden som är registrerad för figuren }
const lsGet = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ok */ } };
const auth = (A) => { const e = vanEgen(A?.avatar); return e ? { vid: e.vid, hemlig: e.hemlig, namn: String(A.avatar.name || '?').slice(0, 16) } : null; };

let A0 = null, lyssnar = false;
// vänlistan till servern (bara när den har ändrats sedan sist)
export async function vanPushSynka(A) {
  const a = auth(A);
  if (!a) return;
  const vanner = vanLista(A.avatar).map((v) => v.vid).sort(), avtryck = vanner.join(',');
  const s = lsGet(SYNK);
  if (s[a.vid] === avtryck || (!vanner.length && s[a.vid] === undefined)) return;   // (aldrig haft vänner – inget att säga)
  const r = await pushPost('/van/vanner', { ...a, vanner });
  if (r?.ok) lsSet(SYNK, { ...lsGet(SYNK), [a.vid]: avtryck });
}
// Telefonen: lov att visa notiser + pushkoden till servern. fraga = visa telefonens fråga om man inte svarat än.
export async function vanPushRegistrera(A, { fraga = false } = {}) {
  A0 = A;
  const P = pushPlugin();
  if (!P || !vanLista(A?.avatar).length) return false;
  try {
    let perm = await P.checkPermissions();
    if (perm.receive !== 'granted' && perm.receive !== 'denied' && fraga) perm = await P.requestPermissions();
    if (perm.receive !== 'granted') return false;
    if (!lyssnar) {
      lyssnar = true;
      await P.addListener('registration', async ({ value } = {}) => {
        const a = auth(A0);
        if (!a || !value || !vanLista(A0.avatar).length || lsGet(REG)[a.vid] === value) return;   // (redan registrerad)
        const r = await pushPost('/van/registrera', { ...a, token: value, lang: LANG });
        if (r?.ok) lsSet(REG, { ...lsGet(REG), [a.vid]: value });
      });
    }
    await P.register();
    return true;
  } catch { return false; }
}
// 'granted' | 'denied' | 'prompt' … eller null när det inte är appen
export async function vanPushLage() {
  const P = pushPlugin();
  if (!P) return null;
  try { return (await P.checkPermissions()).receive; } catch { return null; }
}
// ---------- 🎁 vänskapspresenter (Carl 2026-10-12: "vänskapspresenter … notiser om man skickar en vänskapspresent") ----------
// Skicka: servern lägger presenten i vännens brevlåda och skickar en pushnotis. Svar { ok } eller { ok:false, fel } (null = offline).
export async function vanPresentSkicka(A, till, { fri = false, gavor = [] } = {}) {
  const a = auth(A);
  if (!a) return null;
  await vanPushSynka(A);   // (servern måste veta att vi är vänner)
  return pushPost('/van/present', { ...a, till, fri, gavor });
}
// Hämta: presenterna i brevlådan hamnar i 🎁 Presenter (g.presenter.ko, typ 'van') – sedan töms brevlådan
let hamtar = false;
export async function vanPresentHamta(A) {
  const a = auth(A), G = A?.game;
  if (!a || !G || hamtar || !vanLista(A.avatar).length) return 0;
  hamtar = true;
  try {
    const r = await pushPost('/van/hamta', a);
    const lista = Array.isArray(r?.presenter) ? r.presenter.slice(0, 30) : [];
    if (!lista.length) return 0;
    if (!G.presenter || typeof G.presenter !== 'object') G.presenter = { dag: '', antal: 0, ko: [] };
    const ko = G.presenter.ko, nya = [];
    for (const x of lista) {
      if (!x || typeof x.id !== 'string' || ko.some((k) => k.id === x.id)) continue;
      ko.push({ typ: 'van', id: x.id.slice(0, 24), fran: String(x.fran || '?').slice(0, 16), fri: !!x.fri, gavor: Array.isArray(x.gavor) ? x.gavor.slice(0, 3) : [] });
      nya.push(String(x.fran || '?').slice(0, 16));
    }
    while (ko.length > 10) ko.shift();
    G.save();
    await pushPost('/van/kvittera', { ...a, ids: lista.map((x) => x?.id).filter(Boolean) });
    if (nya.length) {
      play('knock');
      toast(nya.length === 1 ? $t`🎁 ${nya[0]} har skickat en present till dig! Öppna den i mobilen 📱` : $t`🎁 Du har fått ${nya.length} presenter från dina vänner! Öppna dem i mobilen 📱`, 'good');
    }
    return nya.length;
  } finally { hamtar = false; }
}
// En gång per start: listan (om ändrad), "inne" om man har vänner, telefonens registrering (utan att fråga) och
// brevlådan – sedan tittar spelet i brevlådan var 90:e sekund
let sagt = false, koll = null;
export async function vanPushStart(A) {
  A0 = A;
  await vanPushSynka(A);
  if (!sagt && vanLista(A?.avatar).length) { sagt = true; const a = auth(A); if (a) await pushPost('/van/inne', a); }
  await vanPushRegistrera(A, { fraga: false });
  await vanPresentHamta(A);
  if (!koll) koll = setInterval(() => { if (A0 && !A0.attract) vanPresentHamta(A0); }, 90000);
}
// listan ändrades → till servern direkt (lite fördröjt, så att flera ändringar blir ett anrop)
let vantar = null;
vanOnAndrad(() => { if (!A0) return; clearTimeout(vantar); vantar = setTimeout(() => vanPushSynka(A0), 600); });
