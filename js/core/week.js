// Veckosammanfattningen: visas alltid först när man vaknar (och med 📅 i HUD:en).
// Måndag–söndag med avklarade dagar grå och dagens dag markerad, hyresdagen tydligt
// utmärkt med belopp, en prognos om pengarna räcker till hyran, en checklista för dagen
// och ett sparmål mot nästa bostad. Läser bara spelets tillstånd – ändrar ingenting.
import { openModal, closeModal, esc } from './ui.js';
import { DAY_NAMES, HOMES, JOBS, fmt, WIN_MONEY, levelOf, payMult } from '../game.js';

const SHORT = ['MÅN', 'TIS', 'ONS', 'TOR', 'FRE', 'LÖR', 'SÖN'];
const weekday = (day) => (day - 1) % 7;            // 0 = måndag
const weekNo = (day) => Math.floor((day - 1) / 7) + 1;

// ungefärlig lön för ett pass: bästa passet hittills, annars ett normalt pass (≈ 12 rätt)
function payPerShift(g) {
  let best = 0;
  for (const [id, b] of Object.entries(g.best || {})) if (b?.pay) best = Math.max(best, b.pay);
  if (best) return best;
  const j = JOBS.burgare || Object.values(JOBS)[0];
  return Math.round(j.wage * 12 * payMult(levelOf(g.jobs?.[j.id] || 0)));
}

export function weekInfo(g) {
  const wd = weekday(g.day);
  const rent = g.homeInfo.rent;
  const daysToRent = wd === 0 ? 7 : 7 - wd;          // hyran dras måndag morgon
  const need = Math.max(0, rent - g.money);
  const perShift = payPerShift(g);
  const shifts = need ? Math.ceil(need / Math.max(1, perShift)) : 0;
  const fridge = Object.values(g.fridge || {}).reduce((a, n) => a + n, 0);
  const idx = HOMES.findIndex((h) => h.id === g.home);
  const next = HOMES.slice(idx + 1).find((h) => h.deposit > 0) || null;
  return { wd, rent, daysToRent, need, perShift, shifts, fridge, next };
}

export function openWeek(A, { morning = false, rentPaid = 0, eventText = '' } = {}) {
  const g = A.game;
  const w = weekInfo(g);
  const cells = SHORT.map((d, i) => {
    const past = i < w.wd, today = i === w.wd, isRent = i === 0;
    const firstWeek = g.day - w.wd === 1; // vecka 1: man flyttade in på måndagen, ingen hyra dragen
    const rentTxt = !isRent ? '' : firstWeek ? '<small class="wk-paid">🔑 inflyttning</small>' : (past || (today && rentPaid) ? `<small class="wk-paid">💸 ${fmt(rentPaid || w.rent)} betald</small>` : `<small class="wk-rent">💸 HYRA ${fmt(w.rent)}</small>`);
    return `<div class="wk-day ${past ? 'past' : ''} ${today ? 'today' : ''} ${isRent ? 'rentday' : ''}">
      <b>${d}</b><span class="wk-n">dag ${g.day - w.wd + i}</span>${today ? '<i class="wk-now">I DAG</i>' : past ? '<i class="wk-done">✓</i>' : ''}${rentTxt}</div>`;
  }).join('');
  // nästa hyra
  const nextRent = w.wd === 0 && !rentPaid ? 'i dag' : `på måndag – om ${w.daysToRent} ${w.daysToRent === 1 ? 'dag' : 'dagar'}`;
  const enough = g.money >= w.rent;
  const forecast = enough
    ? `<p class="wk-ok">✅ Du har <b>${fmt(g.money)}</b> – det räcker till hyran (${fmt(w.rent)}) ${nextRent}.</p>`
    : `<p class="wk-bad">⚠️ Du har <b>${fmt(g.money)}</b> men hyran är <b>${fmt(w.rent)}</b> ${nextRent}. Du behöver tjäna <b>${fmt(w.need)}</b> till – ungefär <b>${w.shifts} ${w.shifts === 1 ? 'pass' : 'pass'}</b> (≈ ${fmt(w.perShift)} per pass).</p>`;
  // checklista
  const todo = [];
  if (g.money < 0) todo.push([false, `Betala skulden: ${fmt(-g.money)}`]);
  todo.push([enough, enough ? 'Hyran är täckt' : `Jobba ihop till hyran (${w.shifts} pass)`]);
  todo.push([g.hunger >= 50, g.hunger >= 50 ? 'Du är mätt' : 'Ät något – du är hungrig']);
  todo.push([w.fridge > 0, w.fridge > 0 ? `Mat i kylen (${w.fridge} st)` : 'Handla mat till kylen']);
  todo.push([g.energy >= 40, g.energy >= 40 ? 'Du är utvilad' : 'Du är trött – sov i tid i kväll']);
  if (g.event?.id) todo.push([true, 'Dagens händelse: ' + esc(eventText || g.event.id)]);
  const list = todo.map(([ok, t]) => `<li class="${ok ? 'ok' : ''}"><span>${ok ? '✓' : '☐'}</span>${t}</li>`).join('');
  // sparmål: nästa bostad, sedan slutmålet
  let goal = '';
  if (w.next) {
    const target = w.next.deposit + w.rent; // insatsen + en veckas marginal
    const pct = Math.max(0, Math.min(100, Math.round(g.money / target * 100)));
    goal = `<div class="wk-goal"><b>🎯 Sparmål: ${esc(w.next.icon)} ${esc(w.next.name)}</b><span>insats ${fmt(w.next.deposit)} + en veckas hyra = ${fmt(target)}</span>
      <div class="wk-bar"><i style="width:${pct}%"></i></div><small>${fmt(Math.max(0, g.money))} av ${fmt(target)} (${pct} %)</small></div>`;
  } else {
    const pct = Math.max(0, Math.min(100, Math.round(g.money / WIN_MONEY * 100)));
    goal = `<div class="wk-goal"><b>🏆 Slutmålet: ${fmt(WIN_MONEY)} på fickan</b><div class="wk-bar"><i style="width:${pct}%"></i></div><small>${fmt(Math.max(0, g.money))} av ${fmt(WIN_MONEY)} (${pct} %)</small></div>`;
  }
  const head = morning ? `☀️ God morgon! ${esc(DAY_NAMES[w.wd])}, dag ${g.day}` : `📅 Vecka ${weekNo(g.day)}`;
  const body = `<div class="wk">
    ${morning && rentPaid ? `<p class="wk-bad" style="margin-top:0">💸 Hyran för veckan är dragen: ${fmt(rentPaid)}.</p>` : ''}
    <div class="wk-grid">${cells}</div>
    ${forecast}
    <div class="wk-cols"><ul class="wk-todo">${list}</ul>${goal}</div>
    <p class="wk-tip">Tips: hyran dras varje måndag morgon. Har du inte råd blir du skyldig hyresvärden – jobba ett extra pass innan söndag.</p>
  </div>`;
  const dlg = openModal(head, body, [{ label: morning ? '☀️ Ut i dagen!' : 'Stäng', cls: 'btn-go', onClick: closeModal }]);
  dlg.classList.add('dlg-wide');
  return dlg;
}
