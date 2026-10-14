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
import { vanPushRegistrera, vanPushLage, vanPresentSkicka } from '../net/vanpush.js';
import { FOOD, foodOf, katalogOf, fmt } from '../game.js';
import { openSamtal } from './smsapp.js';   // 💬 SMS till vännen (Carl 2026-10-13)
import { dubbletter } from './pixelkort.js';   // 🃏 dubbletterna kan bli vänskapspresenter

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
      <span class="pbtns">${p && p.scene === 'city' ? `<button class="btn btn-small" data-vgoto="${esc(p.id)}">${$t('🚶 Gå dit')}</button>` : ''}${p ? `<button class="btn btn-small btn-go" data-vvisit="${esc(p.id)}">${$t('🚗 Åk hem till')}</button>` : ''}<button class="btn btn-small" data-vsms="${i}" title="${esc($t('Skicka ett SMS'))}">💬</button><button class="btn btn-small btn-gold" data-vpres="${i}" title="${esc($t('Skicka en present'))}">🎁</button><button class="btn btn-small" data-vbort="${i}" title="${esc($t('Ta bort vännen'))}">💔</button></span>
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
  dlg.querySelectorAll('[data-vpres]').forEach((b) => (b.onclick = () => openSkickaPresent(A, lista[+b.dataset.vpres])));
  dlg.querySelectorAll('[data-vsms]').forEach((b) => (b.onclick = () => openSamtal(A, lista[+b.dataset.vsms])));
  dlg.querySelectorAll('[data-vbort]').forEach((b) => (b.onclick = () => {
    const v = lista[+b.dataset.vbort];
    openModal($t('💔 Ta bort vännen?'), `<p style="font-size:var(--f2);margin-top:0">${$t`Vill du ta bort <b>${esc(v.namn)}</b> som vän? Ni försvinner från varandras listor och får inga hälsningar när den andra hoppar in.`}</p>`, [
      { label: $t('💔 Ja, ta bort'), cls: 'btn-red', onClick: () => { const p = p0(v); if (p) send({ t: 'bort', to: p.id }); vanTaBortLokalt(A.avatar, v.vid, !p); toast($t`💔 ${v.namn} är inte din vän längre.`); openVannerApp(A); } },
      { label: $t('Nej'), onClick: () => openVannerApp(A) },
    ]);
  }));
}
export const vanAppInit = (A0) => { A = A0; };

// 💛 SPELARKORTET: tryck på en annan spelare ute i världen (walkable.js folkTapAt → scenerna) – porträtt, namn och
// knappen "Bli vänner" (eller "Skicka SMS" om ni redan är vänner). Carl 2026-10-14: "jag stod bredvid någon men jag
// vet inte hur man blir vän" – förut fanns knappen bara i 👥 Kompisar i mobilen.
// f = figuren ur worldFolksHere (id, av) – spelaren slås upp i playersList() för vid/nyckel/version.
export function openSpelarkort(A0, f) {
  A = A0;
  const p = playersList().find((q) => q.id === f.id) || { id: f.id, av: f.av };
  const namn = p.av?.name || $t('En kompis'), van = arVan(A.avatar, p);
  const v = van ? vanLista(A.avatar).find((x) => x.vid === p.vi) : null;
  const rad = van ? $t('Ni är vänner! 💛 Skicka ett SMS här, eller en vänskapspresent i 💛 Vänner i mobilen.')
    : p.vi ? $t('Tryck 💛 Bli vänner så får hen en fråga – säger hen ja ses ni i 💛 Vänner i mobilen och kan skicka SMS till varandra.')
    : $t('💛 Den spelaren har en för gammal version – be hen ladda om sidan.');
  const knappar = [];
  if (van && v) knappar.push({ label: $t('💬 Skicka SMS'), cls: 'btn-go', onClick: () => { closeModal(); openSamtal(A, v); } });
  else if (!van && p.vi) knappar.push({ label: $t('💛 Bli vänner'), cls: 'btn-gold', onClick: () => { if (vanFraga(A, p)) closeModal(); } });
  knappar.push({ label: $t('Stäng'), onClick: closeModal });
  play('click');
  const dlg = openModal(esc(namn), `<div style="display:flex;gap:10px;align-items:center"><span data-kort-face></span><p style="font-size:var(--f2);margin:0">${rad}</p></div>`, knappar);
  const el = dlg?.querySelector?.('[data-kort-face]');
  if (el && p.av) el.replaceWith(avatarPortrait({ name: p.av.name, look: p.av.look, color: p.av.color }, 48));
}

// ---------- 🎁 skicka en present till en vän ----------
// En gratis vänskapspresent per vän och dag (en liten överraskning, som dagens present) – och man kan lägga till
// något eget: pengar, en möbel ur förrådet eller mat ur kylskåpet. Det man lägger till lämnar ens eget förråd.
const SKICKAT = 'snabbfilen_van_skickat';   // { [vännens vid]: dagen den gratis presenten skickades }
const skickatGet = () => { try { return JSON.parse(localStorage.getItem(SKICKAT) || '{}') || {}; } catch { return {}; } };
const idagStr = () => new Date().toISOString().slice(0, 10);
function openSkickaPresent(A0, v, val = { fri: skickatGet()[v.vid] !== idagStr(), pengar: 0, sak: null }) {
  A = A0;
  const G = A.game, friOk = skickatGet()[v.vid] !== idagStr();
  if (!friOk) val.fri = false;
  const mobler = G.storage.map((it, i) => ({ i, it, kat: katalogOf(it.k) })).filter((x) => x.kat).slice(0, 12);
  const mat = Object.entries(G.fridge || {}).filter(([id, n]) => n > 0 && foodOf(id));
  const kort = dubbletter(G).slice(0, 16);   // 🃏 byteshandel: dubbletterna i albumet
  const chip = (attr, v2, label, on, dis = false) => `<button type="button" class="btn btn-small${on ? ' btn-gold' : ''}" data-${attr}="${v2}"${dis ? ' disabled' : ''}>${label}</button>`;
  const dlg = openModal($t`🎁 Present till ${v.namn}`, `
    <p style="font-size:var(--f2);margin-top:0">${chip('pfri', 1, esc($t('💛 Vänskapspresent – en liten överraskning')), val.fri, !friOk)} <small class="sp">${esc(friOk ? $t('gratis, en om dagen') : $t('i dag redan skickad'))}</small></p>
    <div class="bl-lbl">${esc($t('Lägg till något eget'))} <small>${esc($t('(valfritt)'))}</small></div>
    <div class="bl-opts">${[0, 50, 100, 200].map((n) => chip('ppeng', n, n ? esc(fmt(n)) : esc($t('Inga pengar')), val.pengar === n, n > G.money)).join('')}</div>
    ${mobler.length ? `<div class="bl-lbl">${esc($t('🛋️ Ur förrådet'))}</div><div class="bl-opts">${mobler.map((x) => chip('pmob', x.i, esc(`${x.kat.icon || ''} ${x.kat.name}`), val.sak?.slag === 'mobel' && val.sak.i === x.i)).join('')}</div>` : ''}
    ${kort.length ? `<div class="bl-lbl">${esc($t('🃏 Dubbletter ur albumet'))}</div><div class="bl-opts">${kort.map((k) => chip('pkort', k.id, esc(`${k.namn} ×${G.kort[k.id]}`), val.sak?.slag === 'kort' && val.sak.id === k.id)).join('')}</div>` : ''}
    ${mat.length ? `<div class="bl-lbl">${esc($t('🍽️ Ur kylskåpet'))}</div><div class="bl-opts">${mat.map(([id]) => chip('pmat', id, esc(`${foodOf(id).icon} ${foodOf(id).name}`), val.sak?.slag === 'mat' && val.sak.id === id)).join('')}</div>` : ''}`,
  [{ label: $t('🎁 Skicka present'), cls: 'btn-go', disabled: !val.fri && !val.pengar && !val.sak, onClick: () => skicka() },
   { label: $t('Avbryt'), onClick: () => openVannerApp(A) }]);
  dlg.querySelector('[data-pfri]')?.addEventListener('click', () => { val.fri = !val.fri; play('click'); openSkickaPresent(A, v, val); });
  dlg.querySelectorAll('[data-ppeng]').forEach((b) => (b.onclick = () => { val.pengar = +b.dataset.ppeng; play('click'); openSkickaPresent(A, v, val); }));
  dlg.querySelectorAll('[data-pmob]').forEach((b) => (b.onclick = () => { const i = +b.dataset.pmob; val.sak = val.sak?.slag === 'mobel' && val.sak.i === i ? null : { slag: 'mobel', i }; play('click'); openSkickaPresent(A, v, val); }));
  dlg.querySelectorAll('[data-pkort]').forEach((b) => (b.onclick = () => { const id = b.dataset.pkort; val.sak = val.sak?.slag === 'kort' && val.sak.id === id ? null : { slag: 'kort', id }; play('click'); openSkickaPresent(A, v, val); }));
  dlg.querySelectorAll('[data-pmat]').forEach((b) => (b.onclick = () => { const id = b.dataset.pmat; val.sak = val.sak?.slag === 'mat' && val.sak.id === id ? null : { slag: 'mat', id }; play('click'); openSkickaPresent(A, v, val); }));
  async function skicka() {
    // det man lägger till tas ur ens eget förråd direkt (och kommer tillbaka om presenten inte gick iväg)
    const gavor = [], tillbaka = [];
    if (val.pengar && G.money >= val.pengar) { G.money -= val.pengar; gavor.push({ slag: 'pengar', n: val.pengar }); tillbaka.push(() => { G.money += val.pengar; }); }
    if (val.sak?.slag === 'mobel' && G.storage[val.sak.i]) { const [it] = G.storage.splice(val.sak.i, 1); gavor.push({ slag: 'mobel', k: it.k, v: it.v | 0 }); tillbaka.push(() => G.storage.push(it)); }
    if (val.sak?.slag === 'kort' && (G.kort?.[val.sak.id] | 0) > 1) { const id = val.sak.id; G.kort[id] -= 1; gavor.push({ slag: 'kort', id }); tillbaka.push(() => { G.kort[id] = (G.kort[id] | 0) + 1; }); }
    if (val.sak?.slag === 'mat' && G.fridge[val.sak.id] > 0) { const id = val.sak.id; G.fridge[id] -= 1; if (!G.fridge[id]) delete G.fridge[id]; gavor.push({ slag: 'mat', id, n: 1 }); tillbaka.push(() => { G.fridge[id] = (G.fridge[id] || 0) + 1; }); }
    G.save();
    closeModal();
    const r = await vanPresentSkicka(A, v.vid, { fri: val.fri, gavor });
    if (!r?.ok) {
      tillbaka.forEach((f) => f()); G.save();
      toast(r === null ? $t('🎁 Presenten kom inte iväg – prova igen när du har internet.') : r.fel?.includes('inte vänner') ? $t`🎁 ${v.namn} måste ha dig som vän också – fråga hen igen i 👥 Kompisar.` : $t`🎁 ${v.namn} har fått så många presenter i dag – prova i morgon!`, 'bad');
      return;
    }
    if (val.fri) { const s2 = skickatGet(); s2[v.vid] = idagStr(); try { localStorage.setItem(SKICKAT, JSON.stringify(s2)); } catch { /* ok */ } }
    play('buy');
    G.glad?.(3, '', 'vanpresent', 6);
    toast($t`🎁 Presenten är på väg till ${v.namn}!`, 'good');
  }
}
// en spelare man har tagit bort (när hen inte var inne) dyker upp → hen får veta det, en gång
vanKrokar.kom = (A0, p, id) => {
  if (!A0?.avatar || !id || !p?.vi || !vanBorttagen(A0.avatar, p.vi)) return;
  A = A0;
  send({ t: 'bort', to: id });
  vanGlomBorttagen(A0.avatar, p.vi);
};
