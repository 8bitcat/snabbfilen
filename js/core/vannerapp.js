// 💛 VÄNNER – förfrågan och appen i mobilen (Carl 2026-10-12: "så man kan bli vänner och att man får en ikon i
// mobilen … och att man får notiser när en vän spelar"). Vänlistan och hälsningarna: js/net/vanner.js, pushen till
// vännernas telefoner: js/net/vanpush.js.
//   • 💛 Bli vänner (i 👥 Kompisar): frågan går till den andra spelaren via jobbkanalen (world.js), som "Flytta ihop".
//     Hen svarar Ja eller Nej tack. Säger hen ja sparar båda varandra – i appen frågar telefonen sedan om lov att visa
//     notiser, så att man får veta när vännen börjar spela även när appen är stängd.
//   • 💛 Vänner i mobilen: vännerna med figur – i Pixelstaden nu (🚶 Gå dit / 🚗 Åk hem till) eller när de sågs senast –
//     och 💔 Ta bort (då försvinner man från varandras listor). Siffran på appen = vänner i stan nu.
// Meddelandena: { k: 'van', t: 'fraga' | 'ja' | 'nej' | 'bort', to, key, vi, namn }. Blockerade spelare når en inte
// (world.js filtrerar jobbkanalen). Äldre versioner har inget vi – de får ingen 💛-knapp.
import { $t } from './i18n.js';
import { openModal, closeModal, toast, esc } from './ui.js';
import { play } from './sound.js';
import { avatarPortrait } from './avatar.js';
import { sendJob, onJob, worldMyId, worldMyKey, playersList } from '../net/world.js';
import { vanEgen, vanLista, arVan, vanLaggTill, vanTaBortLokalt, vanInne, vanBorttagen, vanGlomBorttagen, vanKrokar, VID_RE, MAX_VANNER } from '../net/vanner.js';
import { vanPushRegistrera, vanPushLage } from '../net/vanpush.js';

let A = null;
const send = (m) => sendJob({ k: 'van', key: worldMyKey(), vi: vanEgen(A?.avatar)?.vid || '', namn: String(A?.avatar?.name || '').slice(0, 16), ...m });
const fragat = new Map();   // spelar-id → tills när frågan gäller (två minuter)
const namnPa = (p) => String(p?.av?.name || $t('Kompisen')).slice(0, 16);

// 💛 Bli vänner (från 👥 Kompisar). p = en spelare ur playersList()
export function vanFraga(A0, p) {
  A = A0;
  if (!p?.vi || !VID_RE.test(p.vi)) { toast($t('💛 Den spelaren har en för gammal version – be hen ladda om sidan.'), 'bad'); return false; }
  if (arVan(A.avatar, p)) { toast($t`💛 Ni är redan vänner, du och ${namnPa(p)}!`, 'good'); return false; }
  if (vanLista(A.avatar).length >= MAX_VANNER) { toast($t`💛 Du har redan ${MAX_VANNER} vänner – ta bort någon först.`, 'bad'); return false; }
  fragat.set(p.id, Date.now() + 120000);
  send({ t: 'fraga', to: p.id });
  toast($t`💛 Du har frågat ${namnPa(p)} om ni ska bli vänner. Väntar på svar …`, 'good');
  return true;
}
const looken = (from) => playersList().find((x) => x.id === from)?.av?.look || null;
function blevVanner(m, from) {
  vanLaggTill(A.avatar, { vid: m.vi, key: m.key, namn: m.namn, look: looken(from) });
  play('ok');
  // i appen: lov att visa notiser (frågan kommer bara en gång – sedan finns 🔔 i Vänner-appen)
  setTimeout(() => vanPushRegistrera(A, { fraga: true }), 1200);
}

onJob((ev) => {
  const m = ev?.m;
  if (!A || m?.k !== 'van' || m.to !== worldMyId() || !VID_RE.test(String(m.vi || ''))) return;
  const from = ev.from, namn = String(m.namn || $t('En kompis')).slice(0, 16);
  if (m.t === 'fraga') {
    if (arVan(A.avatar, { vi: m.vi, key: m.key })) { send({ t: 'ja', to: from }); return; }   // redan vänner (t.ex. den andra tappade listan)
    if (vanLista(A.avatar).length >= MAX_VANNER) { send({ t: 'nej', to: from }); return; }
    play('knock');
    openModal($t('💛 Bli vänner?'), `<p style="font-size:var(--f2);margin-top:0">${$t`<b>${esc(namn)}</b> vill bli din vän!`}</p>
      <p style="font-size:var(--f2)">${$t('Vänner ser varandra i 💛 Vänner i mobilen och får en hälsning när den andra hoppar in i Pixelstaden – i appen även när den är stängd.')}</p>`, [
      { label: $t('💛 Ja, vi blir vänner!'), cls: 'btn-go', onClick: () => { closeModal(); send({ t: 'ja', to: from }); blevVanner(m, from); toast($t`💛 Du och ${namn} är vänner nu!`, 'good'); } },
      { label: $t('Nej tack'), onClick: () => { closeModal(); send({ t: 'nej', to: from }); } },
    ]);
    return;
  }
  if (m.t === 'ja') {
    if ((fragat.get(from) || 0) < Date.now()) return;   // (svar på en fråga vi aldrig ställde)
    fragat.delete(from);
    blevVanner(m, from);
    toast($t`💛 ${namn} sa ja – ni är vänner nu!`, 'good');
    return;
  }
  if (m.t === 'nej') { if (fragat.delete(from)) toast($t`💛 ${namn} vill inte bli vänner just nu.`); return; }
  if (m.t === 'bort') vanTaBortLokalt(A.avatar, m.vi);   // vännen tog bort en – tyst, åt båda hållen
});

// ---------- 💛 Vänner i mobilen ----------
const DAG = 86400000;
function senast(ms) {
  if (!ms) return $t('har inte setts än');
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const dagar = Math.ceil((d0.getTime() - ms) / DAG);
  return dagar <= 0 ? $t('sågs senast i dag') : dagar === 1 ? $t('sågs senast i går') : $t`sågs senast för ${dagar} dagar sedan`;
}
export const vanInneAntal = (A0) => (A0?.avatar ? vanInne(A0.avatar, playersList()).length : 0);
export async function openVannerApp(A0) {
  A = A0;
  const lista = [...vanLista(A.avatar)], inne = vanInne(A.avatar, playersList());
  const p0 = (v) => inne.find((x) => x.v.vid === v.vid)?.p || null;
  lista.sort((a, b) => (p0(b) ? 1 : 0) - (p0(a) ? 1 : 0) || (b.sett || 0) - (a.sett || 0));
  const lage = await vanPushLage();   // null = webben
  const rad = (v, i) => {
    const p = p0(v);
    return `<div class="prow"><span data-vface="${i}"></span>
      <span class="nm">${esc(p?.av?.name || v.namn)}<br><small class="sp">${p ? `🟢 ${esc(A.placeOf ? A.placeOf(p) : $t('i Pixelstaden'))}` : esc(senast(v.sett))}</small></span>
      <span class="pbtns">${p && p.scene === 'city' ? `<button class="btn btn-small" data-vgoto="${esc(p.id)}">${$t('🚶 Gå dit')}</button>` : ''}${p ? `<button class="btn btn-small btn-go" data-vvisit="${esc(p.id)}">${$t('🚗 Åk hem till')}</button>` : ''}<button class="btn btn-small" data-vbort="${i}" title="${esc($t('Ta bort vännen'))}">💔</button></span>
    </div>`;
  };
  const notisRad = lage === null ? `<p class="sp" style="font-size:var(--f2)">${$t('🔔 I appen Pixelcity får du en notis när en vän börjar spela – även när appen är stängd.')}</p>`
    : lage === 'granted' ? `<p class="sp" style="font-size:var(--f2)">${$t('🔔 Notiserna är på: du får en notis när en vän börjar spela.')}</p>`
      : `<p style="font-size:var(--f2)"><button class="btn btn-small btn-gold" data-vnotis>${$t('🔔 Slå på notiser när en vän börjar spela')}</button>${lage === 'denied' ? `<br><small class="sp">${$t('Notiserna är avstängda för Pixelcity – slå på dem i telefonens Inställningar → Notiser.')}</small>` : ''}</p>`;
  const dlg = openModal($t('💛 Vänner'), lista.length
    ? `<p style="font-size:var(--f2);margin-top:0">${lista.length === 1 ? (inne.length ? $t('Din vän är i Pixelstaden nu!') : $t('Du har en vän. Hen är inte i Pixelstaden just nu.')) : inne.length ? $t`<b>${inne.length}</b> av dina ${lista.length} vänner är i Pixelstaden nu.` : $t`Du har ${lista.length} vänner. Ingen av dem är i Pixelstaden just nu.`}</p>
       <div class="plist">${lista.map(rad).join('')}</div>${notisRad}`
    : `<p style="font-size:var(--f2);margin-top:0">${$t('Du har inga vänner här än.')}</p>
       <p style="font-size:var(--f2)">${$t('Träffar du någon i Pixelstaden: öppna 👥 Kompisar i mobilen och tryck 💛 Bli vänner. Säger hen ja hamnar ni här – och ni får en hälsning när den andra hoppar in.')}</p>`,
  [
    { label: $t('👥 Kompisar'), onClick: () => { closeModal(); A.openFriends?.(); } },
    { label: $t('Stäng'), cls: 'btn-go', onClick: closeModal },
  ]);
  dlg.querySelectorAll('[data-vface]').forEach((el) => { const v = lista[+el.dataset.vface], p = p0(v); el.replaceWith(avatarPortrait({ name: p?.av?.name || v.namn, look: p?.av?.look || v.look || {}, color: p?.av?.color }, 40)); });
  dlg.querySelectorAll('[data-vgoto]').forEach((b) => (b.onclick = () => A.followTo?.(b.dataset.vgoto)));
  dlg.querySelectorAll('[data-vvisit]').forEach((b) => (b.onclick = () => A.visitTo?.(b.dataset.vvisit)));
  dlg.querySelector('[data-vnotis]')?.addEventListener('click', async () => { await vanPushRegistrera(A, { fraga: true }); openVannerApp(A); });
  dlg.querySelectorAll('[data-vbort]').forEach((b) => (b.onclick = () => {
    const v = lista[+b.dataset.vbort];
    openModal($t('💔 Ta bort vännen?'), `<p style="font-size:var(--f2);margin-top:0">${$t`Vill du ta bort <b>${esc(v.namn)}</b> som vän? Ni försvinner från varandras listor och får inga hälsningar när den andra hoppar in.`}</p>`, [
      { label: $t('💔 Ja, ta bort'), cls: 'btn-red', onClick: () => { const p = p0(v); if (p) send({ t: 'bort', to: p.id }); vanTaBortLokalt(A.avatar, v.vid, !p); toast($t`💔 ${v.namn} är inte din vän längre.`); openVannerApp(A); } },
      { label: $t('Nej'), onClick: () => openVannerApp(A) },
    ]);
  }));
}
export const vanAppInit = (A0) => { A = A0; };
// en spelare man har tagit bort (när hen inte var inne) dyker upp → hen får veta det, en gång
vanKrokar.kom = (A0, p, id) => {
  if (!A0?.avatar || !id || !p?.vi || !vanBorttagen(A0.avatar, p.vi)) return;
  A = A0;
  send({ t: 'bort', to: id });
  vanGlomBorttagen(A0.avatar, p.vi);
};
