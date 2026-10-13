// 🐾 djurNET i mobilen – köpa och sälja djur (logiken: js/pets/djurnet.js). Carl 2026-10-13: "göra hela katt-
// uppgraderingen, man ska kunna köpa och sälja djur, appen ska heta djurNET".
//   • 🏷️ SÄLJ: dina annonser (bud från köpare: ✅ Sälj · 🤝 Pruta · ✖ Nej tack) och dina djur med värdet – Lägg ut
//     öppnar värderingen (raden för raden) och prisväljaren (50–200 %).
//   • 🛒 KÖP: dagens sex djur från uppfödarna – flyttar hem till en direkt.
//   • 💌 BREVLÅDAN: hälsningarna från familjerna som köpt ens djur, med ett litet foto av djuret i sitt nya hem.
// När man säljer kommer familjen och hämtar djuret: en liten scen vid dörren (transportburen, vinkningar, hjärtan).
// Köparna hör av sig medan man spelar (djurnetStart: var annan sekund) – en toast och en siffra på appen.
// 👥 MELLAN VÄNNER (v0.130, js/net/djurvan.js): har man vänner läggs annonsen också ut på servern – vänner åt båda hållen
// ser den under 🛒 Köp ("Från dina vänner") och köper djuret direkt. Säljarens spel frågar servern var 30:e sekund om
// något har sålts (djurnetVanKoll): djuret flyttar, pengarna kommer. En annons som ligger hos vännerna tas bort på
// servern först (Ta bort, eller när man säljer till en familj) – hann en vän före gäller vännens köp.
import { $t } from './i18n.js';
import { openModal, closeModal, toast, esc } from './ui.js';
import { play } from './sound.js';
import { fmt } from '../game.js';
import { petStore, MAX_PETS } from '../pets/sim.js';
import { drawPetIcon, drawPet, breedOf, ICON_W, ICON_H } from '../pets/sprites.js';
import { SPECIES } from '../pets/sprite-data.js';
import { drawPerson, makeLook } from './people.js';
import { seededRng } from '../pets/sim.js';
import { djurVanKan, djurVanAnnonsera, djurVanTaBort, djurVanLista, djurVanKop, djurVanSalda, djurVanKvittera } from '../net/djurvan.js';
import { tvatta } from '../net/skydd.js';
import { dn, varde, annonsera, taBortAnnons, djurnetTick, pruta, tackaNej, saljTill, halsningText, utbud, kopFranUppfodare, djurnetNytt, MAX_ANNONSER, MIN_PRIS, MAX_PRIS } from '../pets/djurnet.js';

let A = null, flik = 'salj';
export const djurnetBadge = (A0) => (A0?.game ? djurnetNytt(A0.game) : 0);

// köparna och hälsningarna medan man spelar
let startad = false;
export function djurnetStart(A0) {
  A = A0;
  if (startad) return; startad = true;
  let n = 0;
  setInterval(() => {
    const g = A?.game;
    if (!g || A.attract) return;
    if (++n % 15 === 0 && dn(g).annonser.some((a) => a.van)) djurnetVanKoll(A);   // 👥 såldes något till en vän?
    let ev = [];
    try { ev = djurnetTick(g); } catch (e) { console.error('djurNET:', e); return; }
    if (!ev.length) return;
    g.save();
    for (const e of ev) {
      play('sms');
      if (e.typ === 'bud') toast($t`📬 djurNET: ${e.annons.bud.familj} vill köpa ${e.pet.name} för ${fmt(e.annons.bud.belopp)}! Öppna djurNET i mobilen.`, 'good wrap');
      else toast($t`💌 djurNET: En hälsning från ${e.h.familj} om ${e.h.namn}!`, 'good wrap');
    }
  }, 2000);
}

// 👥 har en vän köpt något? Djuret flyttar, pengarna kommer (varje besked bara en gång – vanKlara minns de senaste).
let kollar = false;
export async function djurnetVanKoll(A0) {
  const g = A0?.game;
  if (!g || kollar) return 0;
  kollar = true;
  try {
    const salda = await djurVanSalda(A0);
    if (!salda?.length) return 0;
    const D = dn(g), store = petStore(), klara = new Set(D.vanKlara || []);
    let n = 0;
    for (const s of salda) {
      if (klara.has(s.id)) continue;
      const a = D.annonser.find((x) => x.id === s.id);
      if (a) { if (store.petById(a.pet)) store.removePet(a.pet); D.annonser = D.annonser.filter((x) => x.id !== s.id); }
      const pris = Math.max(0, Math.min(100000, s.pris | 0));
      g.money += pris; D.salda += 1; n += 1;
      if (D.salda === 5 && g.merit) g.merit('uppfodare', 1, { vem: String(s.namn || '').slice(0, 16) });
      klara.add(s.id);
      play('coin');
      toast($t`🐾 ${tvatta(String(s.kopare || '?').slice(0, 16))} köpte ${tvatta(String(s.namn || '?').slice(0, 16))} på djurNET – du fick ${fmt(pris)}!`, 'good wrap');
    }
    D.vanKlara = [...klara].slice(-30);
    g.save();
    await djurVanKvittera(A0, salda.map((s) => s.id));
    return n;
  } finally { kollar = false; }
}
// en annons som ligger hos vännerna: ta bort den på servern först → true = klart att fortsätta
async function vanBort(A0, a) {
  if (!a?.van) return true;
  const r = await djurVanTaBort(A0, a.id);
  if (!r?.ok) { toast($t('📡 djurNET når inte servern just nu – försök igen när du är uppkopplad.'), 'bad'); return false; }
  if (r.fanns === false) { toast($t('🐾 En vän hann före och köpte djuret!'), 'good'); await djurnetVanKoll(A0); return false; }
  return true;
}

// ---------- bilder ----------
// porträttet: djuret sittande framifrån i en liten ruta (drawPetIcon), förstorat med heltal i CSS
function portratt(pet) {
  const c = document.createElement('canvas'); c.width = ICON_W; c.height = ICON_H;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  drawPetIcon(x, 0, 0, pet, 1);
  return c.toDataURL();
}
const stadie = (p) => { const S = SPECIES[p.species] || SPECIES.katt; return p.stage === 'unge' ? S.unge : p.stage === 'ung' ? S.ung : S.vuxen; };
const kon = (p) => (p.sex === 'hona' ? $t('hona') : $t('hane'));
const beskr = (p) => `${esc(breedOf(p).namn)} · ${esc(stadie(p).toLowerCase())} · ${kon(p)}`;
function extra(p) {
  const u = p.utst || {}, n = Object.entries(u).filter(([k]) => Array.isArray(u[k])).reduce((s, [, v]) => s + v.reduce((a, b) => a + (b | 0), 0), 0);
  return [n ? $t`🏆 ${n} rosetter` : '', u.bis ? $t('✨ Best in Show') : '', p.frisyr ? $t('✂️ frisyr') : '', p.breed2 ? $t('🌈 blandkull') : ''].filter(Boolean).join(' · ');
}

// hälsningens foto: djuret i fönstret i sitt nya hem (64 × 48, himmel, fönsterkarm, en krukväxt)
function halsningFoto(h) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 48;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const r = seededRng(h.namn.length * 131 + (h.text | 0) * 17 + 7);
  for (let y = 0; y < 48; y++) { x.fillStyle = y < 30 ? `rgb(${120 + y * 3},${178 + y * 2},${230 - y})` : '#e8dcc4'; x.fillRect(0, y, 64, 1); }
  x.fillStyle = '#ffffff'; for (let k = 0; k < 3; k++) { const mx = 6 + Math.floor(r() * 46), my = 4 + Math.floor(r() * 12); x.fillRect(mx, my, 9, 2); x.fillRect(mx + 2, my - 1, 5, 1); }
  x.fillStyle = '#6aa04a'; for (let i = 0; i < 64; i++) x.fillRect(i, 24 + Math.round(Math.sin(i / 7) * 2), 1, 7);   // kullarna
  x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, 64, 3); x.fillRect(0, 0, 3, 34); x.fillRect(61, 0, 3, 34); x.fillRect(31, 0, 2, 31);   // karmen
  x.fillStyle = '#c8bca4'; x.fillRect(0, 31, 64, 3); x.fillStyle = '#fffaf0'; x.fillRect(0, 30, 64, 1);   // fönsterbrädan
  x.fillStyle = '#d8d0c0'; x.fillRect(0, 34, 64, 14); x.fillStyle = '#c8bca4'; for (let i = 0; i < 64; i += 8) x.fillRect(i, 34, 1, 14);
  x.fillStyle = '#c86a3a'; x.fillRect(50, 24, 8, 7); x.fillStyle = '#a8502a'; x.fillRect(50, 29, 8, 2); x.fillStyle = '#4a9a3a'; x.fillRect(51, 18, 2, 6); x.fillRect(54, 16, 2, 8); x.fillRect(56, 19, 2, 5); x.fillStyle = '#e04848'; x.fillRect(54, 15, 2, 2);
  drawPet(x, 22, 31, { ...h.snap, id: 'foto-' + h.id }, 'sit', 1.3, 'down');
  return c.toDataURL();
}

// ---------- appen ----------
export function openDjurnet(A0, f) {
  A = A0; if (f) flik = f;
  const g = A.game, D = dn(g), store = petStore();
  play('click');
  const flikar = [['salj', $t('🏷️ Sälj')], ['kop', $t('🛒 Köp')], ['brev', $t('💌 Brevlådan')]];
  const nyBrev = D.halsningar.filter((h) => h.ny).length, nyBud = D.annonser.filter((a) => a.bud?.ny).length;
  let html = `<div class="dn-logo">djur<b>NET</b><span>${$t('Köp och sälj djur')}</span></div><div class="dn-flikar">${flikar.map(([id, n]) => `<button type="button" class="btn btn-small${flik === id ? ' btn-go' : ''}" data-flik="${id}">${n}${id === 'brev' && nyBrev ? ` <span class="dn-ny">${nyBrev}</span>` : id === 'salj' && nyBud ? ` <span class="dn-ny">${nyBud}</span>` : ''}</button>`).join('')}</div>`;
  if (flik === 'salj') {
    const annonser = D.annonser.map((a) => ({ a, p: store.petById(a.pet) })).filter((x) => x.p);
    html += `<div class="dn-lista">`;
    if (annonser.length) {
      html += `<p class="dn-rubrik">${$t`Dina annonser (${annonser.length}/${MAX_ANNONSER})`}</p>`;
      for (const { a, p } of annonser) {
        const b = a.bud, mot = b && !b.prutat && b.belopp < a.pris ? Math.max(10, Math.round((b.belopp + a.pris) / 20) * 10) : 0;
        html += `<div class="dn-rad${b ? ' dn-bud' : ''}"><img src="${portratt(p)}" alt=""><div class="dn-text"><b>${esc(p.name)}</b> <small>${beskr(p)}</small><br>${$t`Pris: ${fmt(a.pris)}`}
          ${a.van ? `<div class="dn-vansyns">${$t('👥 Syns för dina vänner också')}</div>` : ''}
          ${b ? `<div class="dn-budtext">${esc($t`💬 ${b.familj} vill köpa ${p.name} för ${fmt(b.belopp)}!`)}</div>` : `<div class="dn-vantar">${$t('⏳ Väntar på köpare …')}</div>`}</div>
          <div class="dn-knappar">${b ? `<button class="btn btn-small btn-go" data-salj="${a.id}">${$t`✅ Sälj · ${fmt(b.belopp)}`}</button>${mot ? `<button class="btn btn-small" data-pruta="${a.id}">${$t`🤝 Pruta · ${fmt(mot)}`}</button>` : ''}<button class="btn btn-small" data-nej="${a.id}">${$t('✖ Nej tack')}</button>` : `<button class="btn btn-small" data-tabort="${a.id}">${$t('Ta bort annonsen')}</button>`}</div></div>`;
        if (b) b.ny = false;
      }
    }
    const egna = store.pets.filter((p) => !D.annonser.some((a) => a.pet === p.id));
    html += `<p class="dn-rubrik">${$t('Dina djur')}</p>`;
    if (!store.pets.length) html += `<p class="dn-tom">${$t('Du har inga djur än. Köp ett här i djurNET eller i djuraffären!')}</p>`;
    else if (!egna.length) html += `<p class="dn-tom">${$t('Alla dina djur har en annons.')}</p>`;
    for (const p of egna) {
      const V = varde(p);
      html += `<div class="dn-rad${V.saljbar ? '' : ' dn-av'}"><img src="${portratt(p)}" alt=""><div class="dn-text"><b>${esc(p.name)}</b> <small>${beskr(p)}</small><br>${$t`Värde: ${fmt(V.pris)}`}${extra(p) ? `<br><small>${extra(p)}</small>` : ''}${V.saljbar ? '' : `<div class="dn-varfor">${esc(V.varfor)}</div>`}</div>
        <div class="dn-knappar"><button class="btn btn-small${V.saljbar ? ' btn-go' : ''}" data-lagg="${p.id}" ${V.saljbar && D.annonser.length < MAX_ANNONSER ? '' : 'disabled'}>${$t('📢 Lägg ut')}</button></div></div>`;
    }
    html += `</div><p class="dn-tips">${$t('Köparna hör av sig medan du spelar – ju lägre pris, desto fortare. Du kan sälja ett djur om dagen.')}</p>`;
    g.save();
  } else if (flik === 'kop') {
    const u = utbud(g), fullt = store.pets.length >= MAX_PETS;
    if (djurVanKan(A)) html += `<p class="dn-rubrik">${$t('👥 Från dina vänner')}</p><div class="dn-lista dn-van" data-vanlista><p class="dn-tom">${$t('Hämtar vännernas annonser …')}</p></div>`;
    html += `<p class="dn-rubrik">${$t('Dagens djur från uppfödarna')}</p><div class="dn-lista">`;
    if (!u.length) html += `<p class="dn-tom">${$t('Alla dagens djur är sålda – nya kommer i morgon!')}</p>`;
    for (const x of u) {
      const p = x.snap;
      html += `<div class="dn-rad"><img src="${portratt(p)}" alt=""><div class="dn-text"><b>${esc(p.name)}</b> <small>${beskr(p)}</small>${extra(p) ? `<br><small>${extra(p)}</small>` : ''}<br><small class="dn-saljare">${esc($t`Säljs av ${x.saljare}`)}</small></div>
        <div class="dn-knappar"><button class="btn btn-small btn-go" data-kop="${x.id}" ${g.money < x.pris || fullt ? 'disabled' : ''}>${$t`🛒 Köp · ${fmt(x.pris)}`}</button></div></div>`;
    }
    html += `</div>${fullt ? `<p class="dn-tips">${$t`Du har ${MAX_PETS} djur – det får inte plats fler.`}</p>` : `<p class="dn-tips">${$t('Nya djur varje dag. Djuret flyttar hem till dig direkt.')}</p>`}`;
  } else {
    const brev = D.halsningar.filter((h) => h.kom).slice().reverse();
    html += `<p class="dn-rubrik">${$t('Hälsningar från de nya familjerna')}</p><div class="dn-lista">`;
    if (!brev.length) html += `<p class="dn-tom">${$t('Inga hälsningar än. När du har sålt ett djur hör den nya familjen av sig efter en dag.')}</p>`;
    for (const h of brev) { html += `<div class="dn-rad dn-brev"><img class="dn-foto" src="${halsningFoto(h)}" alt=""><div class="dn-text"><b>💌 ${esc(h.familj)}</b><br>${esc(halsningText(h))}</div></div>`; h.ny = false; }
    html += `</div>`;
    g.save();
  }
  const dlg = openModal('🐾 djurNET', html, [{ label: $t('Stäng'), onClick: closeModal }]);
  dlg.querySelectorAll('[data-flik]').forEach((b) => (b.onclick = () => openDjurnet(A, b.dataset.flik)));
  dlg.querySelectorAll('[data-lagg]').forEach((b) => (b.onclick = () => prisDialog(b.dataset.lagg)));
  dlg.querySelectorAll('[data-tabort]').forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    if (!(await vanBort(A, D.annonser.find((x) => x.id === b.dataset.tabort)))) { openDjurnet(A); return; }
    taBortAnnons(g, b.dataset.tabort); g.save(); openDjurnet(A);
  }));
  dlg.querySelectorAll('[data-nej]').forEach((b) => (b.onclick = () => { tackaNej(g, b.dataset.nej); g.save(); openDjurnet(A); }));
  dlg.querySelectorAll('[data-pruta]').forEach((b) => (b.onclick = () => {
    const a = D.annonser.find((x) => x.id === b.dataset.pruta), fam = a?.bud?.familj, r = pruta(g, b.dataset.pruta);
    g.save();
    if (r.ok && r.kvar) { play('ok'); toast($t`🤝 ${fam} gick med på ${fmt(r.mot)}!`, 'good'); }
    else if (r.ok) { play('miss'); toast($t`😕 ${r.familj} tyckte att det blev för dyrt och tackade nej. Fler köpare hör av sig.`); }
    openDjurnet(A);
  }));
  dlg.querySelectorAll('[data-salj]').forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    const a = D.annonser.find((x) => x.id === b.dataset.salj);
    if (!(await vanBort(A, a))) { openDjurnet(A); return; }
    const r = saljTill(g, b.dataset.salj);
    if (!r.ok) { toast(r.fel, 'bad'); return; }
    g.save(); closeModal(); avsked(r);
  }));
  // 👥 vännernas annonser fylls i när servern har svarat
  const vl = dlg.querySelector('[data-vanlista]');
  if (vl) djurVanLista(A).then((vanner) => {
    if (!document.body.contains(vl)) return;
    const rader = (vanner || []).flatMap((v) => v.annonser.map((x) => ({ ...x, vid: v.vid, saljare: tvatta(String(v.namn || '?').slice(0, 16)) })));
    if (!vanner) { vl.innerHTML = `<p class="dn-tom">${$t('📡 Kunde inte hämta vännernas annonser just nu.')}</p>`; return; }
    if (!rader.length) { vl.innerHTML = `<p class="dn-tom">${$t('Dina vänner har inga djur till salu just nu.')}</p>`; return; }
    const fullt = store.pets.length >= MAX_PETS;
    vl.innerHTML = rader.map((x) => { const p = { ...x.snap, name: tvatta(String(x.snap?.name || '?')) }; return `<div class="dn-rad dn-vanrad"><img src="${portratt(p)}" alt=""><div class="dn-text"><b>${esc(p.name)}</b> <small>${beskr(p)}</small>${extra(p) ? `<br><small>${extra(p)}</small>` : ''}<br><small class="dn-saljare">${esc($t`Säljs av din vän ${x.saljare}`)}</small></div>
      <div class="dn-knappar"><button class="btn btn-small btn-go" data-vankop="${esc(x.vid)}|${esc(x.id)}|${x.pris | 0}" ${g.money < x.pris || fullt ? 'disabled' : ''}>${$t`🛒 Köp · ${fmt(x.pris)}`}</button></div></div>`; }).join('');
    vl.querySelectorAll('[data-vankop]').forEach((b) => (b.onclick = async () => {
      const [vid, id, pris] = b.dataset.vankop.split('|'), kr = +pris;
      if (g.money < kr) { toast($t('Du har inte råd.'), 'bad'); return; }
      if (store.pets.length >= MAX_PETS) { toast($t`Du kan ha högst ${MAX_PETS} djur.`, 'bad'); return; }
      b.disabled = true;
      const r = await djurVanKop(A, vid, id, kr);
      if (!r) { toast($t('📡 djurNET når inte servern just nu – försök igen när du är uppkopplad.'), 'bad'); b.disabled = false; return; }
      if (!r.ok) { toast(r.sald ? $t('🐾 Någon hann före – djuret är redan sålt.') : r.pris ? $t('🐾 Priset har ändrats – titta igen.') : $t('🐾 Köpet gick inte igenom.'), 'bad'); openDjurnet(A, 'kop'); return; }
      const ny = store.importPet({ ...r.snap, name: tvatta(String(r.snap?.name || '')) }, g.home, { day: g.day });
      if (!ny) { toast(store.lastError || $t('Det gick inte.'), 'bad'); return; }
      g.money -= kr; g.save(); play('buy');
      toast($t`🐾 ${ny.name} har flyttat hem till dig!`, 'good');
      openDjurnet(A, 'kop');
    }));
  });
  dlg.querySelectorAll('[data-kop]').forEach((b) => (b.onclick = () => {
    const r = kopFranUppfodare(g, b.dataset.kop);
    if (!r.ok) { toast(r.fel, 'bad'); return; }
    g.save(); play('buy'); toast($t`🐾 ${r.pet.name} har flyttat hem till dig!`, 'good');
    openDjurnet(A, 'kop');
  }));
}

// värderingen rad för rad och priset (50–200 % i steg om 10 %)
function prisDialog(petId) {
  const g = A.game, p = petStore().petById(petId);
  if (!p) return;
  const V = varde(p);
  let pct = 100;
  const pris = () => Math.max(10, Math.round(V.pris * pct / 1000) * 10);
  const rader = V.rader.map(([t, d], i) => `<div class="dn-vrad"><span>${esc(t)}</span><span>${i === 0 ? fmt(d) : d ? (d > 0 ? '+' : '−') + fmt(Math.abs(d)) : '–'}</span></div>`).join('');
  const dlg = openModal($t`📢 Sälj ${p.name}`, `<div class="dn-rad"><img src="${portratt(p)}" alt=""><div class="dn-text"><b>${esc(p.name)}</b> <small>${beskr(p)}</small></div></div>
    <div class="dn-varde">${rader}<div class="dn-vrad dn-summa"><span>${$t('Värde')}</span><span>${fmt(V.pris)}</span></div></div>
    <div class="dn-pris"><button class="btn btn-small" data-ned>−</button><span data-pris></span><button class="btn btn-small" data-upp>+</button></div>
    <p class="dn-tips" data-tips></p>`, [
    { label: $t('📢 Lägg ut annonsen'), cls: 'btn-go', onClick: async () => {
      const r = annonsera(g, petId, pris());
      if (!r.ok) { toast(r.fel, 'bad'); return; }
      g.save(); play('ok');
      toast($t`📢 ${p.name} ligger ute på djurNET för ${fmt(r.annons.pris)}. Köparna hör av sig!`, 'good');
      openDjurnet(A, 'salj');
      if (djurVanKan(A)) { const s = await djurVanAnnonsera(A, r.annons.id, r.annons.pris, petStore().snapshot(petId)); if (s?.ok) { r.annons.van = true; g.save(); if (flik === 'salj' && document.querySelector('#modal .dn-logo')) openDjurnet(A, 'salj'); } }
    } },
    { label: $t('Avbryt'), onClick: () => openDjurnet(A, 'salj') },
  ]);
  const visa = () => {
    dlg.querySelector('[data-pris]').textContent = `${fmt(pris())} (${pct} %)`;
    dlg.querySelector('[data-tips]').textContent = pct < 100 ? $t('Lågt pris – köparna hör av sig snabbt.') : pct === 100 ? $t('Rätt pris – en köpare hör av sig inom en stund.') : pct <= 130 ? $t('Lite dyrt – det kan ta längre tid, och köparen vill nog pruta.') : $t('Mycket dyrt – det kan dröja länge innan någon hör av sig.');
    dlg.querySelector('[data-ned]').disabled = pct <= MIN_PRIS * 100; dlg.querySelector('[data-upp]').disabled = pct >= MAX_PRIS * 100;
  };
  dlg.querySelector('[data-ned]').onclick = () => { pct = Math.max(MIN_PRIS * 100, pct - 10); visa(); };
  dlg.querySelector('[data-upp]').onclick = () => { pct = Math.min(MAX_PRIS * 100, pct + 10); visa(); };
  visa();
}

// ---------- familjen hämtar djuret ----------
// Vid dörren: familjen (två figurer) med en transportbur, djuret går ut genom dörren och in i buren, alla vinkar.
const BUR = ['..kkkkkkkk..', '.kggggggggk.', 'kgwwwwwwwwGk', 'kgwkkkkkkwGk', 'kgwkdkdkdwGk', 'kgwkkkkkkwGk', 'kgwkdkdkdwGk', 'kgwkkkkkkwGk', 'kgwwwwwwwwGk', 'kGGGGGGGGGGk', '.kkkkkkkkkk.'];
const BURF = { k: '#3a3440', g: '#e8e4dc', w: '#d0cabe', G: '#a8a294', d: '#6a6472' };
function avsked(r) {
  const W = 160, H = 72;
  const dlg = openModal($t`🐾 ${r.familj} hämtar ${r.pet.name}`, `<canvas class="dn-scen" width="${W}" height="${H}"></canvas><p class="dn-avsked">${esc($t`Hej då, ${r.pet.name}! 💛 Du fick ${fmt(r.belopp)}.`)}</p>${r.merit ? `<p class="dn-avsked">${esc($t('🏆 Fem sålda djur – du är Uppfödare! Meriten står i troféskåpet.'))}</p>` : ''}`, [{ label: $t('💛 Hej då!'), cls: 'btn-go', onClick: closeModal }]);
  const cv = dlg.querySelector('.dn-scen'), x = cv.getContext('2d');
  x.imageSmoothingEnabled = false;
  const rng = seededRng((r.fro | 0) + 11), vuxen = makeLook(rng), barn = { ...makeLook(rng), kid: true };
  const pet = { ...r.pet, id: 'avsked' };
  const t0 = performance.now();
  play('door');
  let hj = false;
  const steg = (nu) => {
    if (!document.body.contains(cv)) return;
    const t = (nu - t0) / 1000;
    // väggen med dörren, trappsteget och en krukväxt
    for (let y = 0; y < H; y++) { x.fillStyle = y < 50 ? (y % 9 === 0 ? '#d8c8a8' : '#ecdcbc') : y < 53 ? '#a89a84' : '#c8c0b0'; x.fillRect(0, y, W, 1); }
    x.fillStyle = '#b8b0a0'; for (let i = 0; i < W; i += 12) x.fillRect(i, 53, 1, 19);
    x.fillStyle = '#6a4a2a'; x.fillRect(14, 10, 30, 41); x.fillStyle = '#2a1e18'; x.fillRect(17, 13, 24, 38);   // dörrkarmen och den öppna dörren
    x.fillStyle = '#8a5a32'; x.fillRect(41, 13, 5, 38); x.fillStyle = '#d8b24a'; x.fillRect(42, 32, 2, 2);
    x.fillStyle = '#ffe8b0'; x.fillRect(19, 15, 20, 2); x.fillStyle = 'rgba(255,220,150,.18)'; x.fillRect(17, 13, 24, 38);
    x.fillStyle = '#9a8a74'; x.fillRect(12, 50, 36, 3); x.fillStyle = '#c4b49c'; x.fillRect(12, 50, 36, 1);
    x.fillStyle = '#b05a2a'; x.fillRect(52, 42, 8, 8); x.fillStyle = '#8a4220'; x.fillRect(52, 48, 8, 2); x.fillStyle = '#3e8a34'; x.fillRect(53, 34, 2, 8); x.fillRect(56, 31, 2, 11); x.fillRect(58, 36, 2, 6);
    // buren
    const bx = 92, by = 58;
    BUR.forEach((rad, j) => { for (let i = 0; i < rad.length; i++) { const c = rad[i]; if (c === '.') continue; x.fillStyle = BURF[c]; x.fillRect(bx - 6 + i, by - 11 + j, 1, 1); } });
    x.fillStyle = '#3a3440'; x.fillRect(bx - 3, by - 13, 6, 1); x.fillRect(bx - 3, by - 13, 1, 2); x.fillRect(bx + 2, by - 13, 1, 2);
    // djuret: går ut genom dörren (0,6–2,6 s) och in i buren
    const gang = Math.max(0, Math.min(1, (t - 0.6) / 2));
    if (gang < 1) { const px = 30 + gang * (bx - 6 - 30); drawPet(x, px, 60, pet, gang > 0 ? 'walk' : 'idle', t, 'right'); }
    else { x.save(); x.beginPath(); x.rect(bx - 3, by - 8, 6, 6); x.clip(); drawPet(x, bx, by - 1, pet, 'sit', t, 'down'); x.restore(); BUR.slice(2, 9).forEach((rad, j) => { for (let i = 3; i < 9; i++) if (rad[i] === 'k') { x.fillStyle = BURF.k; x.fillRect(bx - 6 + i, by - 9 + j, 1, 1); } }); }
    // familjen vinkar när djuret är i buren
    const vink = gang >= 1 && Math.floor(t * 3) % 2 === 0;
    drawPerson(x, 116, 64, vuxen, 'left', vink ? 11 : 0);
    drawPerson(x, 132, 64, barn, 'left', gang >= 1 ? (Math.floor(t * 4) % 2 ? 10 : 0) : 0);
    if (gang >= 1 && !hj) { hj = true; play('ok'); }
    if (gang >= 1) for (let k = 0; k < 3; k++) { const ht = (t * 0.8 + k * 0.33) % 1, hx = 108 + k * 10, hy = 30 - ht * 20; x.globalAlpha = 1 - ht; x.fillStyle = '#e04870'; x.fillRect(hx, hy, 2, 2); x.fillRect(hx + 3, hy, 2, 2); x.fillRect(hx, hy + 1, 5, 2); x.fillRect(hx + 1, hy + 3, 3, 1); x.fillRect(hx + 2, hy + 4, 1, 1); x.globalAlpha = 1; }
    requestAnimationFrame(steg);
  };
  requestAnimationFrame(steg);
}
