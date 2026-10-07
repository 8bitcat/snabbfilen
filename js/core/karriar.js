// KARRIÄRSTEGARNA – intervjun hos chefen (game.js ROLLER/KLADKOD/befordran/befordra). Man söker
// befordran efter ett pass (js/jobs/shift.js, lönebeskedet) när vanan och utbildningen räcker:
//   1. chefen tittar på kläderna – fel klädkod = kom tillbaka rätt klädd (ingen intervju förbrukad)
//   2. tre frågor om hur man leder ett lag och tar hand om kunderna; två rätt = befordrad
//   3. underkänd = sök igen i morgon (g.sokt[jobb] = dagen)
import { openModal, closeModal, toast, esc } from './ui.js';
import { play } from './sound.js';
import { JOBS, ROLLER, KLADKOD, rollOf, fmt } from '../game.js';
import { $t } from './i18n.js';

// chefen på varje ställe (påhittade namn)
const CHEFER = { flygplats: $t('Bertil'), incheckning: $t('Aisha'), frukt: $t('Gunnel'), burgare: $t('Doris'), pizzeria: $t('Luigi'), posten: $t('Yusuf'), bensinmack: $t('Kent'),
  bilverkstad: $t('Majken'), tvatteri: $t('Sonja'), kafe: $t('Kajsa'), vard: $t('Doktor Lind'), kok: $t('Doris'), datorbygge: $t('Ines'), finans: $t('Fredrik') };
export const chefOf = (jobId) => CHEFER[jobId] || $t('Chefen');
// [fråga, rätt svar, fel, fel] – tre slumpas per intervju, svaren blandas
export const FRAGOR = [
  [$t('En ny kollega vet inte var sakerna står. Vad gör du?'), $t('Visar runt och förklarar'), $t('Låter hen klura ut det själv'), $t('Skrattar åt hen')],
  [$t('Det är jättelång kö och alla stressar. Vad är viktigast?'), $t('Lugn och en sak i taget'), $t('Springa fortare än alla andra'), $t('Ta en rast')],
  [$t('En kund är arg för att det tog lång tid. Vad gör du?'), $t('Ber om ursäkt och fixar det snabbt'), $t('Säger att det är någon annans fel'), $t('Låtsas att du inte hör')],
  [$t('Två kollegor vill vara lediga samma dag. Vad gör du?'), $t('Pratar med båda och hittar en lösning'), $t('Den som tjatar mest får ledigt'), $t('Ingen får vara ledig')],
  [$t('Kassan stämmer inte på kvällen. Vad gör du?'), $t('Räknar igen och skriver upp vad som hänt'), $t('Lägger i egna pengar och säger inget'), $t('Struntar i det')],
  [$t('Vad gör en bra chef?'), $t('Lyssnar och hjälper laget'), $t('Bestämmer allt själv'), $t('Är aldrig på jobbet')],
  [$t('Någon i laget har gjort ett jättebra jobb. Vad gör du?'), $t('Säger tack och berömmer hen'), $t('Säger ingenting'), $t('Tar åt dig äran själv')],
  [$t('Golvet är vått efter disken. Vad gör du?'), $t('Ställer ut en varningsskylt och torkar'), $t('Hoppar över pölen'), $t('Väntar tills någon halkar')],
  [$t('En kollega är sjuk och kan inte komma. Vad gör du?'), $t('Ringer in någon annan och fördelar jobbet'), $t('Stänger hela stället'), $t('Blir sur på den sjuka')],
  [$t('Ett barn har tappat bort sin mamma i lokalen. Vad gör du?'), $t('Tar hand om barnet och ropar ut'), $t('Säger åt barnet att gå ut'), $t('Fortsätter jobba')],
  [$t('Hur lägger man ett bra schema?'), $t('Så att alla pass har tillräckligt många'), $t('Så att chefen alltid är ledig'), $t('Man slumpar fram det')],
  [$t('Någon har glömt sin plånbok på ett bord. Vad gör du?'), $t('Lämnar den till hittegods och letar ägaren'), $t('Behåller pengarna'), $t('Slänger den')],
];
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// raden i passdialogerna: befattningen och vad nästa steg kräver
export function karriarRad(g, jobId) {
  const R = rollOf(g, jobId), b = g.befordran(jobId);
  let s = $t`${R.icon} Befattning: <b>${esc(R.namn)}</b>${R.lon > 1 ? $t` (lön ×${R.lon.toFixed(1).replace('.', ',')})` : ''}`;
  if (b.nasta) s += b.ok ? $t` · ⭐ du kan söka befordran till <b>${esc(b.nasta.namn)}</b>!` : $t` · nästa: ${esc(b.nasta.namn)} – kräver ${esc(b.saknas.join(', '))}`;
  return s;
}

// intervjun: done() körs när rutan stängs (vad som än hände)
export function openIntervju(A, jobId, done = () => {}) {
  const g = A.game, job = JOBS[jobId], b = g.befordran(jobId), chef = chefOf(jobId);
  if (!b.nasta || !b.ok) { toast($t('Du kan inte söka befordran här just nu.'), 'bad'); done(); return; }
  if (b.soktIdag) { toast($t`📝 Du har redan pratat med ${chef} i dag – sök igen i morgon!`, 'bad'); done(); return; }
  const kod = KLADKOD[b.nasta.klader], top = A.avatar?.look?.top || 'tee';
  play('knock');
  if (kod && !kod.ok(top)) {
    openModal($t`📝 ${esc(chef)} på ${esc(job.name)}`, `<p style="font-size:var(--f2);margin-top:0">${$t`${esc(chef)} tittar på dina kläder och höjer på ögonbrynen.`}</p>
      <p style="font-size:var(--f2)">${$t`"Som <b>${esc(b.nasta.namn.toLowerCase())}</b> behöver du <b>${esc(kod.namn)}</b> – ${esc(kod.tips)}. Kom tillbaka när du klätt dig för jobbet, så pratar vi!"`}</p>
      <p class="sp" style="font-size:var(--f1)">${$t('👕 Klädaffären i centrum har det mesta. Byt kläder hemma i garderoben.')}</p>`, [{ label: $t('Okej!'), cls: 'btn-go', onClick: () => { closeModal(); done(); } }]);
    return;
  }
  g.sokt[jobId] = g.day;
  g.save();
  const qs = shuffle(FRAGOR).slice(0, 3);
  let i = 0, right = 0;
  const ask = () => {
    const [q, ok, ...fel] = qs[i], opts = shuffle([ok, ...fel]);
    const dlg = openModal($t`📝 Intervju: ${esc(b.nasta.namn)} (${i + 1}/3)`, `<p style="font-size:var(--f2);margin-top:0">${$t`${esc(chef)}: "${esc(q)}"`}</p>
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
      openModal($t`${R.icon} Befordrad!`, `<p style="font-size:var(--f2);margin-top:0">${$t`${esc(chef)} skakar hand: "Grattis! Från i dag är du <b>${esc(R.namn.toLowerCase())}</b> på ${esc(job.name)}!"`}</p>
        <p style="font-size:var(--f2)">${$t`💰 Lön ×${R.lon.toFixed(1).replace('.', ',')}`}${R.veckolon ? $t` · 💼 chefslön ${fmt(R.veckolon)} varje måndag (jobba minst 2 pass i veckan)` : ''}<br>${R.id === 'chef' ? $t('📋 Inför varje pass bestämmer du <b>fokus</b> och <b>priserna</b>.') : $t('📋 Inför varje pass bestämmer du <b>dagens fokus</b>.')}</p>
        <p class="sp" style="font-size:var(--f1)">${$t`${right} av 3 rätt på intervjun.`}</p>`, [{ label: $t('🎉 Tack!'), cls: 'btn-go', onClick: () => { closeModal(); done(); } }]);
      toast($t`${R.icon} Du är ${R.namn.toLowerCase()} på ${job.name}!`, 'good');
    } else {
      openModal($t('📝 Inte den här gången'), `<p style="font-size:var(--f2);margin-top:0">${$t`${esc(chef)}: "Tack för att du sökte! Du fick ${right} av 3 – vi tar ett nytt samtal i morgon."`}</p>`, [{ label: $t('Okej …'), cls: 'btn-go', onClick: () => { closeModal(); done(); } }]);
    }
  };
  ask();
}
export { ROLLER };
