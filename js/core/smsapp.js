// 💬 SMS – meddelanden mellan vänner i figurens mobil (Carl 2026-10-13: "de vill också kunna skicka sms till sina
// kompisar via mobiltelefonen i spelet").
//   • Bara mellan vänner åt båda hållen (💛 Vänner). Meddelandet går via pushservern (js/net/vanpush.js, /van/sms) och
//     ligger i vännens brevlåda tills vännens spel hämtar det (högst 14 dagar) – vännens telefon får en notis.
//   • Högst 120 tecken. Fula ord blir *** (js/net/skydd.js) när man skriver och när det visas, och servern stryker
//     länkar, e-postadresser och telefonnummer. Blockerade spelare kommer inte fram. ⚑ Anmäl finns i samtalet.
//   • Snabbknappar (Hej! 👋, Vill du spela? 🎮 …) – de minsta behöver inte skriva själva.
//   • Samtalen sparas på enheten, per figur: snabbfilen_sms = { [figurens id]: { [vännens vid]: { m: [{ id, ut, text, t }],
//     olast } } } – högst 60 meddelanden per vän. Siffran på appen = olästa meddelanden.
//   • Nya SMS hämtas var 30:e sekund, var 6:e när ett samtal är öppet och direkt när telefonen får en notis (vanpush.js).
//     Ett nytt SMS läggs till i samtalet utan att rutan ritas om – tangentbordet stängs inte mitt i en mening.
import { $t, LANG } from './i18n.js';
import { openModal, closeModal, toast, esc, modalOpen } from './ui.js';
import { play } from './sound.js';
import { avatarPortrait } from './avatar.js';
import { vanLista, VID_RE } from '../net/vanner.js';
import { vanSmsSkicka, vanSmsHamta, vanSmsOnNytt } from '../net/vanpush.js';
import { tvatta, isBlockedKey, loggaSay, openAnmal } from '../net/skydd.js';
import { worldInfo } from '../net/world.js';
import { openVannerApp } from './vannerapp.js';

const NYCKEL = 'snabbfilen_sms', MAX = 120, SPARA = 60;
const lsGet = () => { try { const v = JSON.parse(localStorage.getItem(NYCKEL) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const mina = (av) => { const s = lsGet()[av?.id]; return s && typeof s === 'object' ? s : {}; };
const spara = (av, s) => { try { localStorage.setItem(NYCKEL, JSON.stringify({ ...lsGet(), [av.id]: s })); } catch { /* ok */ } };
const tradOf = (s, vid) => { const t = s[vid]; return t && Array.isArray(t.m) ? t : (s[vid] = { m: [], olast: 0 }); };
const vanner = (av) => vanLista(av).filter((v) => !isBlockedKey(v.key));
const kapa = (t) => [...String(t ?? '').replace(/\s+/g, ' ').trim()].slice(0, MAX).join('');
const FRASER = () => [$t('Hej! 👋'), $t('Vill du spela? 🎮'), $t('Var är du?'), $t('Kom till torget!'), $t('Tack för presenten! 🎁'), $t('Ses i morgon! 😊'), '😂', '💛'];
function tid(ms) {
  const d = new Date(ms), kl = d.toLocaleTimeString(LANG, { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? kl : `${d.toLocaleDateString(LANG, { day: 'numeric', month: 'numeric' })} ${kl}`;
}
const bubbla = (m) => `<div class="sms-b ${m.ut ? 'ut' : 'in'}"><span>${esc(tvatta(m.text))}</span><small>${esc(tid(m.t))}</small></div>`;

let A = null, oppen = null, snabbKoll = null;   // oppen = vännens vid när ett samtal visas
const tradEl = () => (oppen && modalOpen() ? document.querySelector(`#modal .sms-trad[data-vid="${oppen}"]`) : null);
const nerst = (el) => { if (el) el.scrollTop = el.scrollHeight; };

// olästa SMS (siffran på appen och pricken på mobilen)
export function smsOlast(A0) {
  const av = A0?.avatar;
  if (!av?.id) return 0;
  const s = mina(av);
  let n = 0;
  for (const v of vanner(av)) n += s[v.vid]?.olast | 0;
  return n;
}

// nya SMS från servern (vanpush.js) → in i samtalen. true = sparade (servern får tömma brevlådan)
vanSmsOnNytt((A0, lista) => {
  const av = A0?.avatar;
  if (!av?.id) return false;
  const s = mina(av), nya = [];
  for (const x of lista) {
    if (!x || typeof x.id !== 'string' || !VID_RE.test(String(x.fvid || ''))) continue;
    const v = vanLista(av).find((y) => y.vid === x.fvid);
    if (!v || isBlockedKey(v.key)) continue;   // (inte vän längre eller blockerad – meddelandet kommer inte fram)
    const t = tradOf(s, v.vid);
    if (t.m.some((m) => m.id === x.id)) continue;
    const m = { id: x.id.slice(0, 24), ut: false, text: kapa(x.text), t: Number(x.t) || Date.now() };
    if (!m.text) continue;
    t.m.push(m);
    t.m.sort((a, b) => a.t - b.t);
    while (t.m.length > SPARA) t.m.shift();
    const el = oppen === v.vid ? tradEl() : null;
    if (el) { el.querySelector('.sms-tom')?.remove(); el.insertAdjacentHTML('beforeend', bubbla(m)); nerst(el); }
    else t.olast = (t.olast | 0) + 1;
    nya.push({ v, m, syns: !!el });
  }
  spara(av, s);
  if (nya.length) play('sms');
  if (nya.length && !tradEl() && modalOpen() && document.querySelector('#modal .sms-rad')) openSmsApp(A0);   // (listan är öppen: nya siffror)
  const andra = nya.filter((n) => !n.syns);
  if (andra.length === 1) toast(`💬 ${andra[0].v.namn}: ${tvatta(andra[0].m.text)}`, 'good');
  else if (andra.length) toast($t`💬 Du har fått ${andra.length} nya SMS – läs dem i mobilen 📱`, 'good');
  return true;
});

// ---------- 💬 SMS i mobilen: vännerna, senaste meddelandet först ----------
export function openSmsApp(A0) {
  A = A0; oppen = null;
  vanSmsHamta(A);
  const av = A.avatar, s = mina(av), lista = [...vanner(av)];
  const sist = (v) => s[v.vid]?.m?.at(-1) || null;
  lista.sort((a, b) => (sist(b)?.t || 0) - (sist(a)?.t || 0) || String(a.namn).localeCompare(String(b.namn)));
  const rad = (v, i) => {
    const m = sist(v), ol = s[v.vid]?.olast | 0;
    return `<div class="prow sms-rad" data-ssam="${i}"><span data-sface="${i}"></span>
      <span class="nm">${esc(v.namn)}<br><small class="sp">${m ? esc((m.ut ? $t('Du: ') : '') + tvatta(m.text)) : esc($t('Inga SMS än – säg hej!'))}</small></span>
      <span class="pbtns">${ol ? `<span class="sms-olast">${ol}</span>` : ''}<button class="btn btn-small btn-go">${$t('💬 Skriv')}</button></span></div>`;
  };
  const dlg = openModal($t('💬 SMS'), lista.length
    ? `<p style="font-size:var(--f2);margin-top:0">${$t('Skicka SMS till dina vänner – de får dem även när de inte spelar.')}</p><div class="plist">${lista.map(rad).join('')}</div>`
    : `<p style="font-size:var(--f2);margin-top:0">${$t('Du har inga vänner att skicka SMS till än.')}</p>
       <p style="font-size:var(--f2)">${$t('Träffar du någon i Pixelstaden: öppna 👥 Kompisar i mobilen och tryck 💛 Bli vänner. Sedan kan ni skicka SMS till varandra.')}</p>`,
  [
    { label: $t('💛 Vänner'), onClick: () => openVannerApp(A) },
    { label: $t('Stäng'), cls: 'btn-go', onClick: closeModal },
  ]);
  dlg.querySelectorAll('[data-sface]').forEach((el) => { const v = lista[+el.dataset.sface]; el.replaceWith(avatarPortrait({ name: v.namn, look: v.look || {} }, 40)); });
  dlg.querySelectorAll('[data-ssam]').forEach((el) => (el.onclick = () => { play('click'); openSamtal(A, lista[+el.dataset.ssam]); }));
}

// ---------- 💬 samtalet med en vän ----------
export function openSamtal(A0, v) {
  A = A0;
  if (!v?.vid) return;
  oppen = v.vid;
  const av = A.avatar, s = mina(av), t = tradOf(s, v.vid);
  if (t.olast) { t.olast = 0; spara(av, s); }
  const dlg = openModal($t`💬 ${esc(v.namn)}`, `
    <div class="sms-trad" data-vid="${v.vid}">${t.m.length ? t.m.map(bubbla).join('') : `<p class="sp sms-tom">${$t`Inga SMS än. Säg hej till ${esc(v.namn)}!`}</p>`}</div>
    <div class="sms-snabb">${FRASER().map((f, i) => `<button type="button" class="btn btn-small" data-sfras="${i}">${esc(f)}</button>`).join('')}</div>
    <div class="sms-skriv"><input type="text" maxlength="${MAX}" placeholder="${esc($t('Skriv ett SMS …'))}" autocomplete="off" enterkeyhint="send"><button type="button" class="btn btn-small btn-go" data-sskicka>${$t('Skicka')}</button></div>
    <p class="sp sms-tips">${$t('🔒 Bara dina vänner kan skicka SMS till dig. Skriv aldrig ditt efternamn, var du bor eller ditt telefonnummer.')}</p>`,
  [
    { label: $t('← Alla SMS'), onClick: () => openSmsApp(A) },
    { label: $t('⚑ Anmäl'), onClick: () => anmal(v) },
    { label: $t('Stäng'), cls: 'btn-go', onClick: () => { oppen = null; closeModal(); } },
  ]);
  const el = dlg.querySelector('.sms-trad'), inp = dlg.querySelector('.sms-skriv input'), knapp = dlg.querySelector('[data-sskicka]');
  nerst(el);
  let skickar = false;
  async function skicka(text0, franRutan) {
    const text = kapa(tvatta(text0));
    if (!text || skickar) return;
    skickar = true; knapp.disabled = true;
    const r = await vanSmsSkicka(A, v.vid, text);
    skickar = false; knapp.disabled = false;
    if (!r?.ok) {
      toast(r === null ? $t('💬 SMS:et kom inte iväg – prova igen när du har internet.')
        : String(r.fel || '').includes('inte vänner') ? $t`💬 ${v.namn} måste ha dig som vän också – fråga hen igen i 👥 Kompisar.`
          : String(r.fel || '').includes('många') ? $t('💬 Nu har du skickat väldigt många SMS i dag – vila tummarna till i morgon!')
            : $t('💬 SMS:et kom inte iväg.'), 'bad');
      return;
    }
    const s2 = mina(A.avatar), t2 = tradOf(s2, v.vid);
    const m = { id: String(r.id || Date.now().toString(36)).slice(0, 24), ut: true, text: kapa(r.text || text), t: Date.now() };
    t2.m.push(m);
    while (t2.m.length > SPARA) t2.m.shift();
    spara(A.avatar, s2);
    play('click');
    if (franRutan) inp.value = '';
    const e2 = tradEl();
    if (e2) { e2.querySelector('.sms-tom')?.remove(); e2.insertAdjacentHTML('beforeend', bubbla(m)); nerst(e2); }
  }
  knapp.onclick = () => skicka(inp.value, true);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); skicka(inp.value, true); } });
  dlg.querySelectorAll('[data-sfras]').forEach((b) => (b.onclick = () => skicka(FRASER()[+b.dataset.sfras], false)));
  // medan samtalet är öppet: titta efter svar var 6:e sekund
  clearInterval(snabbKoll);
  snabbKoll = setInterval(() => { if (!tradEl()) { clearInterval(snabbKoll); snabbKoll = null; return; } vanSmsHamta(A); }, 6000);
}

// ⚑ Anmäl: de senaste SMS:en följer med anmälan, och vännen blockeras (syns inte i SMS och Vänner längre)
function anmal(v) {
  const t = tradOf(mina(A.avatar), v.vid);
  t.m.filter((m) => !m.ut).slice(-12).forEach((m) => loggaSay(v.key, `SMS ${tid(m.t)}: ${m.text}`));
  const info = worldInfo() || {};
  oppen = null;
  openAnmal({ key: v.key, namn: v.namn }, { mig: A.avatar?.name, version: info.version, world: info.world, efter: () => openSmsApp(A) });
}
