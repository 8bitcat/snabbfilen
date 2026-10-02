// KARRIÄRSTEGARNA – intervjun hos chefen (game.js ROLLER/KLADKOD/befordran/befordra). Man söker
// befordran efter ett pass (js/jobs/shift.js, lönebeskedet) när vanan och utbildningen räcker:
//   1. chefen tittar på kläderna – fel klädkod = kom tillbaka rätt klädd (ingen intervju förbrukad)
//   2. tre frågor om hur man leder ett lag och tar hand om kunderna; två rätt = befordrad
//   3. underkänd = sök igen i morgon (g.sokt[jobb] = dagen)
import { openModal, closeModal, toast, esc } from './ui.js';
import { play } from './sound.js';
import { JOBS, ROLLER, KLADKOD, rollOf, fmt } from '../game.js';

// chefen på varje ställe (påhittade namn)
const CHEFER = { flygplats: 'Bertil', incheckning: 'Aisha', frukt: 'Gunnel', burgare: 'Doris', pizzeria: 'Luigi', posten: 'Yusuf', bensinmack: 'Kent',
  bilverkstad: 'Majken', tvatteri: 'Sonja', kafe: 'Kajsa', vard: 'Doktor Lind', kok: 'Doris', datorbygge: 'Ines', finans: 'Fredrik' };
export const chefOf = (jobId) => CHEFER[jobId] || 'Chefen';
// [fråga, rätt svar, fel, fel] – tre slumpas per intervju, svaren blandas
export const FRAGOR = [
  ['En ny kollega vet inte var sakerna står. Vad gör du?', 'Visar runt och förklarar', 'Låter hen klura ut det själv', 'Skrattar åt hen'],
  ['Det är jättelång kö och alla stressar. Vad är viktigast?', 'Lugn och en sak i taget', 'Springa fortare än alla andra', 'Ta en rast'],
  ['En kund är arg för att det tog lång tid. Vad gör du?', 'Ber om ursäkt och fixar det snabbt', 'Säger att det är någon annans fel', 'Låtsas att du inte hör'],
  ['Två kollegor vill vara lediga samma dag. Vad gör du?', 'Pratar med båda och hittar en lösning', 'Den som tjatar mest får ledigt', 'Ingen får vara ledig'],
  ['Kassan stämmer inte på kvällen. Vad gör du?', 'Räknar igen och skriver upp vad som hänt', 'Lägger i egna pengar och säger inget', 'Struntar i det'],
  ['Vad gör en bra chef?', 'Lyssnar och hjälper laget', 'Bestämmer allt själv', 'Är aldrig på jobbet'],
  ['Någon i laget har gjort ett jättebra jobb. Vad gör du?', 'Säger tack och berömmer hen', 'Säger ingenting', 'Tar åt dig äran själv'],
  ['Golvet är vått efter disken. Vad gör du?', 'Ställer ut en varningsskylt och torkar', 'Hoppar över pölen', 'Väntar tills någon halkar'],
  ['En kollega är sjuk och kan inte komma. Vad gör du?', 'Ringer in någon annan och fördelar jobbet', 'Stänger hela stället', 'Blir sur på den sjuka'],
  ['Ett barn har tappat bort sin mamma i lokalen. Vad gör du?', 'Tar hand om barnet och ropar ut', 'Säger åt barnet att gå ut', 'Fortsätter jobba'],
  ['Hur lägger man ett bra schema?', 'Så att alla pass har tillräckligt många', 'Så att chefen alltid är ledig', 'Man slumpar fram det'],
  ['Någon har glömt sin plånbok på ett bord. Vad gör du?', 'Lämnar den till hittegods och letar ägaren', 'Behåller pengarna', 'Slänger den'],
];
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// raden i passdialogerna: befattningen och vad nästa steg kräver
export function karriarRad(g, jobId) {
  const R = rollOf(g, jobId), b = g.befordran(jobId);
  let s = `${R.icon} Befattning: <b>${esc(R.namn)}</b>${R.lon > 1 ? ` (lön ×${R.lon.toFixed(1).replace('.', ',')})` : ''}`;
  if (b.nasta) s += b.ok ? ` · ⭐ du kan söka befordran till <b>${esc(b.nasta.namn)}</b>!` : ` · nästa: ${esc(b.nasta.namn)} – kräver ${esc(b.saknas.join(', '))}`;
  return s;
}

// intervjun: done() körs när rutan stängs (vad som än hände)
export function openIntervju(A, jobId, done = () => {}) {
  const g = A.game, job = JOBS[jobId], b = g.befordran(jobId), chef = chefOf(jobId);
  if (!b.nasta || !b.ok) { toast('Du kan inte söka befordran här just nu.', 'bad'); done(); return; }
  if (b.soktIdag) { toast(`📝 Du har redan pratat med ${chef} i dag – sök igen i morgon!`, 'bad'); done(); return; }
  const kod = KLADKOD[b.nasta.klader], top = A.avatar?.look?.top || 'tee';
  play('knock');
  if (kod && !kod.ok(top)) {
    openModal(`📝 ${esc(chef)} på ${esc(job.name)}`, `<p style="font-size:var(--f2);margin-top:0">${esc(chef)} tittar på dina kläder och höjer på ögonbrynen.</p>
      <p style="font-size:var(--f2)">"Som <b>${esc(b.nasta.namn.toLowerCase())}</b> behöver du <b>${esc(kod.namn)}</b> – ${esc(kod.tips)}. Kom tillbaka när du klätt dig för jobbet, så pratar vi!"</p>
      <p class="sp" style="font-size:var(--f1)">👕 Klädaffären i centrum har det mesta. Byt kläder hemma i garderoben.</p>`, [{ label: 'Okej!', cls: 'btn-go', onClick: () => { closeModal(); done(); } }]);
    return;
  }
  g.sokt[jobId] = g.day;
  g.save();
  const qs = shuffle(FRAGOR).slice(0, 3);
  let i = 0, right = 0;
  const ask = () => {
    const [q, ok, ...fel] = qs[i], opts = shuffle([ok, ...fel]);
    const dlg = openModal(`📝 Intervju: ${esc(b.nasta.namn)} (${i + 1}/3)`, `<p style="font-size:var(--f2);margin-top:0">${esc(chef)}: "${esc(q)}"</p>
      ${opts.map((o, k) => `<button class="btn" data-o="${k}" style="display:block;width:100%;margin:6px 0;text-align:left">${esc(o)}</button>`).join('')}`, [], { closable: false });
    dlg.querySelectorAll('[data-o]').forEach((btn) => (btn.onclick = () => {
      const svar = opts[+btn.dataset.o];
      if (svar === ok) { right++; play('ok'); } else play('fel');
      i++;
      if (i < qs.length) ask(); else result();
    }));
  };
  const result = () => {
    if (right >= 2) {
      const R = g.befordra(jobId);
      play('fanfare');
      openModal(`${R.icon} Befordrad!`, `<p style="font-size:var(--f2);margin-top:0">${esc(chef)} skakar hand: "Grattis! Från i dag är du <b>${esc(R.namn.toLowerCase())}</b> på ${esc(job.name)}!"</p>
        <p style="font-size:var(--f2)">💰 Lön ×${R.lon.toFixed(1).replace('.', ',')}${R.veckolon ? ` · 💼 chefslön ${fmt(R.veckolon)} varje måndag (jobba minst 2 pass i veckan)` : ''}<br>📋 Inför varje pass bestämmer du ${R.id === 'chef' ? '<b>fokus</b> och <b>priserna</b>' : '<b>dagens fokus</b>'}.</p>
        <p class="sp" style="font-size:var(--f1)">${right} av 3 rätt på intervjun.</p>`, [{ label: '🎉 Tack!', cls: 'btn-go', onClick: () => { closeModal(); done(); } }]);
      toast(`${R.icon} Du är ${R.namn.toLowerCase()} på ${job.name}!`, 'good');
    } else {
      openModal('📝 Inte den här gången', `<p style="font-size:var(--f2);margin-top:0">${esc(chef)}: "Tack för att du sökte! Du fick ${right} av 3 – vi tar ett nytt samtal i morgon."</p>`, [{ label: 'Okej …', cls: 'btn-go', onClick: () => { closeModal(); done(); } }]);
    }
  };
  ask();
}
export { ROLLER };
