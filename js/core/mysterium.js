// 🕵️ MYSTERIET I PIXELSTADEN – "Kattstatyns krona" ("bygg allting" 2026-10-12: mysteriet i kapitel). Sju kapitel, ett
// nytt varje dag från kl. 6 (samma dygn som presenterna, js/core/presenter.js dagNu) – så att man vill komma tillbaka.
//   Kronan på bronskatten i Tassbacken är borta. Ledtrådarna leder via kattcaféet, BLING BLING, Sjöboden och
//   pantbanken till de höga träden i Parken – där en skata samlar allt som glittrar i sitt bo. Ingen skurk: man byter
//   till sig kronan med en glitterknapp och lämnar tillbaka den.
// Stegen (ett kapitel = några steg på samma eller olika platser):
//   prata  – ett vittne berättar (öppnas av sig själv när man kommer till platsen)
//   leta   – letaspelet: en ren ögonblicksbild av platsen (foto.js ogonblicksbild) med ledtråden och två falska spår
//            gömda i bilden – tryck på ledtråden (efter en stund glimmar den till)
//   svara  – en fråga i anteckningsboken: dra en slutsats av ledtrådarna (fel svar = prova igen)
//   foto   – ta en bild med 📷 Kamera på platsen (foto.js efterFoto) → bilden av boet visas
//   skatan – bytet i Parken: lägg fram glitterknappen
// 🔍 Mysteriet i mobilen = anteckningsboken: kapitlen, vad man ska göra nu, ledtrådarna man hittat – och knappen för
// steget när man står på rätt plats. "NY" på appen när ett kapitel väntar. Sista kapitlet: 1 000 kr och meriten
// 🕵️ Mästerdetektiv i troféskåpet (game.js merit 'mysterium').
// Sparas i g.mysterium = { kap, steg, klar (dagen då senaste kapitlet blev klart), hittat: [ledtrådar] }.
import { $t } from './i18n.js';
import { openModal, closeModal, toast, esc, modalOpen } from './ui.js';
import { play } from './sound.js';
import { avatarPortrait } from './avatar.js';
import { dagNu } from './presenter.js';
import { foto } from './fotolage.js';
import { ogonblicksbild, efterFoto } from './foto.js';
import { SAKER, SKRAP, ritaKarta, sakURL, ritaBoet } from './mysterium-art.js';
import { fmt } from '../game.js';

// ---------- vittnena ----------
const VEM = {
  gunnel: { namn: 'Gunnel', titel: $t('parkvakten i Tassbacken'), look: { skin: '#f1c7a3', hair: '#c8c4cf', style: 'bun', top: 'tee', shirt: '#2f7a3e', cap: '#2f7a3e', glasses: true, pants: '#4a4452' } },
  fia: { namn: 'Fia', titel: $t('på kattcaféet'), look: { skin: '#d89a72', hair: '#d19a1c', style: 'ponytail', top: 'tee', shirt: '#f08a2a', apron: true, pants: '#2d3a5c' } },
  nova: { namn: 'Nova', titel: $t('i BLING BLING-ateljén'), look: { skin: '#f1c7a3', hair: '#ff9cc4', style: 'long', top: 'tee', shirt: '#9a6ad8', pants: '#2d3a5c' } },
  saga: { namn: 'Saga', titel: $t('fiskar vid Sjöboden'), look: { skin: '#a0643c', hair: '#1e1a24', style: 'curly', top: 'tee', shirt: '#f4f1ea', cap: '#2a5aa8', pants: '#4a8de0' } },
  pelle: { namn: 'Pelle', titel: $t('på pantbanken'), look: { skin: '#f1c7a3', hair: '#4a2c18', style: 'short', top: 'tee', shirt: '#7a4a2a', glasses: true, beard: true, pants: '#1e1a24' } },
};
const PLATS = { tassbacken: $t('Tassbacken'), kattcafe: $t('kattcaféet i Tassbacken'), bling: $t('BLING BLING i Linnéstaden'), sjoboden: $t('Sjöboden vid piren'), pantbank: $t('pantbanken'), parken: $t('Parken (fontänen och de höga träden)') };
const SAK_NAMN = { fjader: $t('En svartvit fjäder'), glitter: $t('Glitter på fönsterbrädan'), parla: $t('En tappad pärla'), spar: $t('Fågelspår i sanden'), knapp: $t('Glitterknappen'), krona: $t('Kattstatyns krona') };
const SKRAP_NAMN = { lov: $t('🍂 Bara ett löv.'), sten: $t('🪨 Bara en sten.'), papper: $t('📄 Bara ett skrynkligt papper.') };

// ---------- kapitlen ----------
export const KAPITEL = [
  { titel: $t('Kronan är borta!'), steg: [
    { typ: 'prata', plats: 'tassbacken', vem: 'gunnel', mal: $t('Gå till Tassbacken och prata med parkvakten Gunnel vid kattstatyn.'),
      text: [$t('Åh, tur att du kom! Kronan på kattstatyn är BORTA!'), $t('I går kväll satt den där som vanligt. I morse var den bara … borta. Ingen har sett något.'), $t('Kan du hjälpa mig? Titta dig omkring – det kanske finns ledtrådar.')] },
    { typ: 'leta', plats: 'tassbacken', sak: 'fjader', mal: $t('Leta efter ledtrådar i Tassbacken.') },
    { typ: 'svara', mal: $t('Fundera på fjädern.'), fraga: $t('En svartvit fjäder med blågrön glans … Var kommer den ifrån, tror du?'),
      svar: [$t('Från en fågel'), $t('Från en kudde'), $t('Från en hatt')], sen: $t('En fågel! Men vilken? Och vad skulle en fågel med en krona till? Det här måste vi ta reda på.') },
  ] },
  { titel: $t('Vittnet på kattcaféet'), steg: [
    { typ: 'prata', plats: 'kattcafe', vem: 'fia', mal: $t('Gå till kattcaféet i Tassbacken och fråga Fia om hon har sett något.'),
      text: [$t('Kronan? Oj då! Vänta … i morse, precis när solen gick upp, blev katterna HELT galna.'), $t('De jamade och hoppade mot fönstret. Något flög förbi där ute – något som blänkte i solen!'), $t('Titta vid fönstret om du vill.')] },
    { typ: 'leta', plats: 'kattcafe', sak: 'glitter', mal: $t('Leta efter ledtrådar på kattcaféet.') },
    { typ: 'svara', mal: $t('Fundera på det Fia såg.'), fraga: $t('Katterna såg något flyga förbi i gryningen. Vad var det som blänkte?'),
      svar: [$t('Något glittrigt som någon bar på'), $t('Ett flygplan'), $t('En regnbåge')], sen: $t('Något glittrigt flög förbi – precis som kronan. Någon flyger omkring med blanka saker!') },
  ] },
  { titel: $t('Fler saker försvinner'), steg: [
    { typ: 'prata', plats: 'bling', vem: 'nova', mal: $t('Gå till BLING BLING i Linnéstaden och prata med Nova.'),
      text: [$t('Har det försvunnit en krona? Hos MIG har det försvunnit tre pärlor!'), $t('De låg på fönsterbänken medan jag gjorde ett halsband. Fönstret stod på glänt …'), $t('När jag vände mig om var de borta. Bara ett litet ljud – flaxande?')] },
    { typ: 'leta', plats: 'bling', sak: 'parla', mal: $t('Leta efter ledtrådar i BLING BLING.') },
    { typ: 'svara', mal: $t('Jämför ledtrådarna.'), fraga: $t('Kronan, glittret och pärlorna. Vad har de gemensamt?'),
      svar: [$t('De glittrar och blänker'), $t('De är gjorda av choklad'), $t('De är gröna')], sen: $t('Alla blänker! Tjuven gillar bara saker som glittrar. Och den kan flyga …') },
  ] },
  { titel: $t('Fiskarens blanka drag'), steg: [
    { typ: 'prata', plats: 'sjoboden', vem: 'saga', mal: $t('Gå till Sjöboden vid piren och prata med Saga.'),
      text: [$t('Mitt fiskedrag är borta! Det blanka, det bästa jag har.'), $t('Jag la det på bryggan en sekund. Då kom en fågel med lång stjärt, svartvit, och bara – SNAPP!'), $t('Den lämnade spår efter sig i sanden.')] },
    { typ: 'leta', plats: 'sjoboden', sak: 'spar', mal: $t('Leta efter spåren vid Sjöboden.') },
    { typ: 'svara', mal: $t('Vilken fågel är det?'), fraga: $t('Svartvita fjädrar, en lång blågrön stjärt – och den älskar blanka saker. Vilken fågel är det?'),
      svar: [$t('En skata'), $t('En mås'), $t('En duva')], sen: $t('En skata! Skator samlar på blanka saker och gömmer dem i sitt bo. Men var bor den?') },
  ] },
  { titel: $t('Kartan på pantbanken'), steg: [
    { typ: 'prata', plats: 'pantbank', vem: 'pelle', mal: $t('Gå till pantbanken och fråga Pelle – han vet allt om blanka saker.'),
      text: [$t('En skata, säger du? Ha! Den har varit här också – den försökte ta en ring från disken.'), $t('Folk kommer hit hela tiden och frågar efter blanka saker de tappat. Jag har prickat in dem på min karta.'), $t('Tassbacken, kattcaféet, BLING BLING, Sjöboden … titta, de ligger i en ring runt samma ställe!')] },
    { typ: 'svara', mal: $t('Titta på Pelles karta.'), fraga: $t('Platserna ligger i en ring. Vad ligger i mitten av ringen – där en skata kan ha sitt bo i ett högt träd?'),
      svar: [$t('Parken med de höga träden'), $t('Flygplatsen'), $t('Bensinmacken')], sen: $t('Parken! De högsta träden i stan står där. Om boet finns där borde man kunna se det …') },
  ] },
  { titel: $t('Boet i trädtoppen'), steg: [
    { typ: 'foto', plats: 'parken', mal: $t('Gå till Parken i stan, öppna 📷 Kamera i mobilen och ta en bild av de höga träden.') },
    { typ: 'svara', mal: $t('Hur får vi tillbaka kronan?'), fraga: $t('Där är boet – fullt av glitter, och kronan mitt i! Hur får vi tillbaka den utan att skrämma skatan?'),
      svar: [$t('Byta till oss den mot något annat blankt'), $t('Klättra upp och ta den'), $t('Skrika åt skatan')], sen: $t('Ett byte! Skator vill ha något blankt i stället. Nova på BLING BLING har säkert något glittrigt …') },
  ] },
  { titel: $t('Bytet'), steg: [
    { typ: 'prata', plats: 'bling', vem: 'nova', mal: $t('Gå till BLING BLING och fråga Nova om något blankt att byta med.'), ger: 'knapp',
      text: [$t('Ett bo fullt av glitter? Och mina pärlor där? Haha, vilken skata!'), $t('Här – ta den här glitterknappen. Den blänker mer än allt annat i hela ateljén.'), $t('Skator kan inte låta bli sådant. Lycka till!')] },
    { typ: 'skatan', plats: 'parken', mal: $t('Gå till Parken och lägg fram glitterknappen till skatan.') },
    { typ: 'prata', plats: 'tassbacken', vem: 'gunnel', mal: $t('Gå tillbaka till Tassbacken och ge kronan till Gunnel.'), slut: true,
      text: [$t('Är det … KRONAN?! Du hittade den!'), $t('En skata?! Och den bytte bort den mot en knapp? Vilken historia!'), $t('Tack, du är en riktig mästerdetektiv. Nu sitter kronan där den ska – och kattstatyn ger tur igen!')] },
  ] },
];
const MYST_KLAR = 1000, KAPITEL_PENGAR = 100;

let A = null;
const M = () => {
  const g = A?.game;
  if (!g) return null;
  if (!g.mysterium || typeof g.mysterium !== 'object') g.mysterium = { kap: 0, steg: 0, klar: '', hittat: [] };
  return g.mysterium;
};
const steg = () => { const m = M(); return m && KAPITEL[m.kap]?.steg[m.steg] || null; };
export const mysteriumLost = (A0) => (A0?.game?.mysterium?.kap | 0) >= KAPITEL.length;
// väntar ett kapitel (eller pågår ett)? – ny dag sedan förra kapitlet blev klart
export function kapitelVantar(A0) {
  const m = A0?.game?.mysterium || { kap: 0, steg: 0, klar: '' };
  if ((m.kap | 0) >= KAPITEL.length) return false;
  return (m.steg | 0) > 0 || m.klar !== dagNu();
}
function platsOk(s) {
  if (!s?.plats || !A) return false;
  if (s.plats === 'parken') return A.sceneName === 'city' && A.scene?.distrikt?.() === 'parken';
  return A.sceneName === s.plats;
}
function framat() { const m = M(); m.steg += 1; A.game.save(); if (m.steg >= KAPITEL[m.kap].steg.length) kapitelKlart(); else nasta(); }
// öppna nästa steg direkt om det går (samma plats eller en fråga)
function nasta() {
  const s = steg();
  if (!s || !kapitelVantar(A)) return;
  if (s.typ === 'svara') { setTimeout(() => fraga(s), 250); return; }
  if (platsOk(s) && (s.typ === 'leta' || s.typ === 'prata' || s.typ === 'skatan')) setTimeout(() => gor(s), 250);
}
function gor(s) {
  if (s.typ === 'prata') vittne(s);
  else if (s.typ === 'leta') leta(s);
  else if (s.typ === 'svara') fraga(s);
  else if (s.typ === 'skatan') skatan();
}

// ---------- vittnet ----------
function vittne(s) {
  const v = VEM[s.vem];
  let i = 0;
  const visa = () => {
    const sista = i >= s.text.length - 1;
    const dlg = openModal(`💬 ${esc(v.namn)}`, `<div class="my-vittne"><span class="my-portratt"></span><div><small class="sp">${esc(v.namn)}, ${esc(v.titel)}</small><p class="my-repl">${esc(s.text[i])}</p></div></div>`, [
      { label: sista ? (s.slut ? $t('👑 Ge kronan till Gunnel') : KAPITEL[M().kap].steg[M().steg + 1]?.typ === 'leta' ? $t('🔍 Leta efter ledtrådar') : $t('OK')) : $t('Vidare ▶'), cls: 'btn-go', onClick: () => {
        if (!sista) { i += 1; play('click'); visa(); return; }
        closeModal();
        if (s.ger) { const m = M(); if (!m.hittat.includes(s.ger)) m.hittat.push(s.ger); toast($t`🔍 Du fick: ${SAK_NAMN[s.ger]}`, 'good'); }
        framat();
      } },
    ], { closable: false });
    dlg.querySelector('.my-portratt').replaceWith(avatarPortrait({ name: v.namn, look: v.look }, 56));
  };
  play('knock');
  visa();
}

// ---------- letaspelet ----------
async function leta(s) {
  const bild = await ogonblicksbild(A);
  if (!bild) { hittad(s); return; }
  const w = bild.width, h = bild.height, x = bild.getContext('2d');
  // ledtråden och två falska spår på olika ställen i den nedre delen av bilden (där man går)
  const fria = [];
  const plats = () => { for (let f = 0; f < 40; f++) { const p = { x: 16 + Math.floor(Math.random() * (w - 44)), y: Math.floor(h * 0.4) + Math.floor(Math.random() * (h * 0.6 - 26)) }; if (fria.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 40)) { fria.push(p); return p; } } const p = { x: 16 + fria.length * 40, y: h - 30 }; fria.push(p); return p; };
  const skrap = Object.keys(SKRAP).sort(() => Math.random() - 0.5).slice(0, 2);
  const saker = [{ id: s.sak, ratt: true, ...plats() }, ...skrap.map((id) => ({ id, ratt: false, ...plats() }))];
  mysteriumHook.leta = { saker, w, h };   // (testerna: var ledtråden ligger)
  const ren = document.createElement('canvas'); ren.width = w; ren.height = h; ren.getContext('2d').drawImage(bild, 0, 0);
  const rita = (glimt) => {
    x.drawImage(ren, 0, 0);
    for (const q of saker) ritaKarta(x, SAKER[q.id] || SKRAP[q.id], q.x, q.y);
    if (glimt) { const q = saker[0]; x.fillStyle = '#fffde0'; for (const [dx, dy] of [[-2, -2], [13, -1], [6, 13], [-3, 9]]) { x.fillRect(q.x + dx, q.y + dy - 1, 1, 3); x.fillRect(q.x + dx - 1, q.y + dy, 3, 1); } }
  };
  rita(false);
  const dlg = openModal($t('🔍 Leta efter ledtrådar'), `<p style="font-size:var(--f2);margin-top:0">${$t('Något här ser konstigt ut … Tryck på det du tror är en ledtråd!')}</p><canvas class="my-leta" width="${w}" height="${h}"></canvas>`, [
    { label: $t('Senare'), onClick: closeModal },
  ]);
  const cv = dlg.querySelector('.my-leta'), cx = cv.getContext('2d');
  cx.drawImage(bild, 0, 0);
  let t0 = performance.now(), glimt = 0;
  const tick = setInterval(() => {
    if (!document.body.contains(cv)) { clearInterval(tick); return; }
    const ga = performance.now() - t0 > 9000 && Math.floor(performance.now() / 500) % 2 === 0;   // efter nio sekunder glimmar ledtråden
    if (ga !== !!glimt) { glimt = ga ? 1 : 0; rita(ga); cx.drawImage(bild, 0, 0); }
  }, 120);
  cv.addEventListener('click', (e) => {
    const r = cv.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * w, py = (e.clientY - r.top) / r.height * h;
    const traff = saker.find((q) => px >= q.x - 3 && px <= q.x + 15 && py >= q.y - 3 && py <= q.y + 15);
    if (!traff) { play('click'); return; }
    if (!traff.ratt) { play('miss'); toast(SKRAP_NAMN[traff.id] || '…'); return; }
    clearInterval(tick); closeModal(); hittad(s);
  });
}
function hittad(s) {
  const m = M();
  if (!m.hittat.includes(s.sak)) m.hittat.push(s.sak);
  play('ok');
  openModal($t('🔍 En ledtråd!'), `<div class="my-sak"><img src="${sakURL(s.sak, 5)}" alt=""></div><p style="font-size:var(--f2);text-align:center">${esc(SAK_NAMN[s.sak])}</p><p class="sp" style="font-size:var(--f1);text-align:center">${$t('Den hamnar bland ledtrådarna i 🔍 Mysteriet.')}</p>`, [
    { label: $t('Vidare ▶'), cls: 'btn-go', onClick: () => { closeModal(); framat(); } },
  ], { closable: false });
}

// ---------- frågan ----------
function fraga(s) {
  if (modalOpen()) return;
  const ord = s.svar.map((t, i) => ({ t, i })).sort(() => Math.random() - 0.5);
  const dlg = openModal($t('🕵️ Vad tror du?'), `<p style="font-size:var(--f2);margin-top:0">${esc(s.fraga)}</p>
    <div class="my-ledtradar">${M().hittat.map((id) => `<img src="${sakURL(id, 3)}" alt="" title="${esc(SAK_NAMN[id] || '')}">`).join('')}</div>
    <div class="my-svar">${ord.map((o) => `<button type="button" class="btn" data-mysvar="${o.i}">${esc(o.t)}</button>`).join('')}</div>`, [
    { label: $t('Senare'), onClick: closeModal },
  ]);
  dlg.querySelectorAll('[data-mysvar]').forEach((b) => (b.onclick = () => {
    if (+b.dataset.mysvar !== 0) { play('miss'); b.disabled = true; toast($t('🤔 Hmm, inte riktigt. Titta på ledtrådarna och prova igen!')); return; }
    play('ok');
    openModal($t('🕵️ Rätt!'), `<p style="font-size:var(--f2);margin-top:0">${esc(s.sen)}</p>`, [{ label: $t('Vidare ▶'), cls: 'btn-go', onClick: () => { closeModal(); framat(); } }], { closable: false });
  }));
}

// ---------- fotot av boet (foto.js anropar efter varje sparad bild) ----------
efterFoto((A0) => {
  A = A0;
  const s = steg();
  if (!s || s.typ !== 'foto' || !kapitelVantar(A) || !platsOk(s)) return;
  setTimeout(() => {
    const dlg = openModal($t('📸 Vad är det där uppe?!'), `<canvas class="my-boet" width="72" height="44"></canvas><p style="font-size:var(--f2)">${$t('Du zoomar in på trädtoppen i bilden … Ett BO! Fullt av glitter – pärlor, ett fiskedrag och mitt i alltihop: kattstatyns krona. Och där sitter skatan och vaktar.')}</p>`, [
      { label: $t('Vidare ▶'), cls: 'btn-go', onClick: () => { closeModal(); framat(); } },
    ], { closable: false });
    ritaBoet(dlg.querySelector('.my-boet').getContext('2d'), { med: 'allt' });
    play('fanfare');
  }, 900);
});

// ---------- bytet med skatan ----------
function skatan() {
  const m = M();
  const dlg = openModal($t('🐦 Skatan i Parken'), `<canvas class="my-boet" width="72" height="44"></canvas><p style="font-size:var(--f2)">${$t('Skatan sitter på grenen och tittar på dig med sina blanka ögon. Den har sett glitterknappen i din hand …')}</p>`, [
    { label: $t('✨ Lägg fram glitterknappen på bänken'), cls: 'btn-go', onClick: () => {
      play('chirp');
      const d2 = openModal($t('🐦 Skatan i Parken'), `<canvas class="my-boet" width="72" height="44"></canvas><p style="font-size:var(--f2)">${$t('FLAX! Skatan dyker ner, nappar åt sig knappen – och tappar kronan rakt ner i gräset framför dig. Bytet är klart!')}</p>`, [
        { label: $t('👑 Ta upp kronan'), cls: 'btn-go', onClick: () => { closeModal(); m.hittat = m.hittat.filter((x) => x !== 'knapp'); if (!m.hittat.includes('krona')) m.hittat.push('krona'); toast($t`🔍 Du fick: ${SAK_NAMN.krona}`, 'good'); framat(); } },
      ], { closable: false });
      ritaBoet(d2.querySelector('.my-boet').getContext('2d'), { med: 'knapp' });
    } },
  ], { closable: false });
  ritaBoet(dlg.querySelector('.my-boet').getContext('2d'), { med: 'allt' });
}

// ---------- ett kapitel klart ----------
function kapitelKlart() {
  const m = M(), g = A.game, nr = m.kap + 1, K = KAPITEL[m.kap];
  m.kap += 1; m.steg = 0; m.klar = dagNu();
  const sista = m.kap >= KAPITEL.length;
  const pengar = sista ? MYST_KLAR : KAPITEL_PENGAR;
  g.money += pengar; g.earned = (g.earned || 0) + pengar;
  g.glad?.(sista ? 10 : 3, '', 'mysterium', sista ? 10 : 4);
  if (sista) g.merit?.('mysterium', 1, { vem: A.avatar?.name || '' });
  g.save();
  play(sista ? 'fanfare' : 'coin');
  const N = KAPITEL[m.kap];
  openModal(sista ? $t('🕵️ Mysteriet är löst!') : $t`📗 Kapitel ${nr} klart!`, `<p style="font-size:var(--f2);margin-top:0"><b>${esc(K.titel)}</b></p>
    <p style="font-size:var(--f2)">${sista ? $t`Kronan sitter på kattstatyn igen, och hela Tassbacken pratar om dig. Belöning: <b>${fmt(pengar)}</b> – och meriten 🕵️ Mästerdetektiv i ditt troféskåp!` : $t`Bra jobbat, detektiv! Belöning: <b>${fmt(pengar)}</b>.`}</p>
    ${N ? `<p class="sp" style="font-size:var(--f2)">${$t`📅 Kapitel ${nr + 1}, «${N.titel}», kommer i morgon från kl. 6.`}</p>` : ''}`,
  [{ label: $t('Härligt!'), cls: 'btn-go', onClick: closeModal }]);
}

// ---------- 🔍 Mysteriet i mobilen: anteckningsboken ----------
export function openMysteriet(A0) {
  A = A0;
  const m = M(), s = steg(), vantar = kapitelVantar(A), lost = m.kap >= KAPITEL.length;
  const kap = KAPITEL.map((K, i) => {
    const klar = i < m.kap, nu = i === m.kap;
    return `<div class="my-kap${klar ? ' klar' : nu ? ' nu' : ''}">${klar ? '✅' : nu ? (vantar ? '🔎' : '🔒') : '🔒'} <b>${$t`Kapitel ${i + 1}`}</b> ${klar || nu ? esc(K.titel) : '???'}</div>`;
  }).join('');
  let nuText = '';
  if (lost) nuText = $t('🕵️ Mysteriet är löst – kronan sitter på kattstatyn igen. Du är en mästerdetektiv!');
  else if (!vantar) nuText = $t`📅 Nästa kapitel, «${KAPITEL[m.kap].titel}», kommer i morgon från kl. 6.`;
  else nuText = s.mal;
  const hjalp = !lost && vantar && s && (s.typ === 'svara' || platsOk(s)) && s.typ !== 'foto';
  openModal($t('🔍 Mysteriet: Kattstatyns krona'), `
    <p style="font-size:var(--f2);margin-top:0">${$t('Kronan på kattstatyn i Tassbacken har försvunnit. Ett nytt kapitel varje dag – kan du lösa mysteriet?')}</p>
    <div class="my-kapitel">${kap}</div>
    <p class="my-nu">${esc(nuText)}</p>
    ${m.hittat.length ? `<div class="bl-lbl">${$t('🔍 Ledtrådar')}</div><div class="my-ledtradar">${m.hittat.map((id) => `<span><img src="${sakURL(id, 3)}" alt=""><small>${esc(SAK_NAMN[id] || '')}</small></span>`).join('')}</div>` : ''}`,
  [
    { label: s?.typ === 'svara' ? $t('🕵️ Svara') : s?.typ === 'leta' ? $t('🔍 Leta här') : s?.typ === 'skatan' ? $t('✨ Byt med skatan') : $t('💬 Prata'), cls: 'btn-go', hidden: !hjalp, onClick: () => { closeModal(); gor(s); } },
    { label: $t('Stäng'), onClick: closeModal },
  ]);
}

// ---------- vakten: kommer man till rätt plats öppnas steget av sig självt, en gång per besök ----------
let senast = '', erbjudet = '', vantarPa = null;
export function mysteriumStart(A0) {
  A = A0;
  setInterval(() => {
    if (!A?.game || A.attract || foto.pa) return;
    const s = steg(), har = kapitelVantar(A);
    // en gång om dagen: ett nytt kapitel väntar
    if (har && !modalOpen()) {
      const idag = dagNu();
      let sagt = '';
      try { sagt = localStorage.getItem('snabbfilen_mysterium_sagt') || ''; } catch { /* ok */ }
      if (sagt !== idag && (A.game.day | 0) >= 2 && /^(city|room)$/.test(A.sceneName || '')) {
        try { localStorage.setItem('snabbfilen_mysterium_sagt', idag); } catch { /* ok */ }
        toast(M().kap === 0 && M().steg === 0 ? $t('🕵️ Något har hänt i Tassbacken! Öppna 🔍 Mysteriet i mobilen.') : $t('🕵️ Ett nytt kapitel i mysteriet väntar – öppna 🔍 Mysteriet i mobilen!'), 'good wrap');
      }
    }
    const har0 = `${A.sceneName}:${A.sceneName === 'city' ? A.scene?.distrikt?.() : ''}`;
    if (har0 !== senast) { senast = har0; erbjudet = ''; }
    if (!har || !s || modalOpen() || !platsOk(s) || erbjudet === har0) return;
    // (är en annan dialog öppen när vittnet ska fram försöker vakten igen nästa gång)
    if (s.typ === 'prata' || s.typ === 'skatan') { if (!vantarPa) vantarPa = setTimeout(() => { vantarPa = null; if (!modalOpen() && !foto.pa && platsOk(s) && steg() === s) { erbjudet = har0; gor(s); } }, 1200); }
    else if (s.typ === 'leta') { erbjudet = har0; toast($t('🔍 Här finns ledtrådar – öppna 🔍 Mysteriet i mobilen och leta!'), 'good'); }
    else if (s.typ === 'foto') { erbjudet = har0; toast($t('📸 Här står de höga träden! Öppna 📷 Kamera i mobilen och ta en bild av dem.'), 'good'); }
  }, 800);
}
export const mysteriumHook = { SAKER };   // (för testerna: ledtrådarnas kartor)
