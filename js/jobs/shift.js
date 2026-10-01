// Arbetspasset: samma flöde för alla jobb. Intro-dialog → minispel (60 s verklig
// tid = 4 h speltid; längre med vanan, se shiftPlan i game.js) → lönebesked. Lön = rätt ×
// styckpris − fel × avdrag, gånger nivåbonusen. Är man utsvulten halveras lönen (yr i huvudet).
//
// Passets plan (A.shiftPlan = shiftPlan(nivå, längd)) läses av minispelen med planOf(A):
// P.seconds (passets längd), P.pace (gånger väntetiden mellan kunder), P.extra (extra platser),
// P.gameMin (speltiden passet motsvarar). Jobbar man ihop (A.coop = { sid, job, scene, host })
// kommer planen från den som bjöd in.
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { sendInvite } from '../net/coop.js';
import { JOBS, JOB_TITLES, levelOf, payMult, fmt, shiftPlan, canLongShift } from '../game.js';
import { SMALL, BIG, ctxText, textW } from '../core/floor-pix.js';
import { play } from '../core/sound.js';
import { shiftInStrip } from '../core/hud-pix.js';

export const SHIFT_SECONDS = 60; // (nybörjarens vanliga pass – minispelen läser planOf(A).seconds)
export const planOf = (A) => A?.shiftPlan || shiftPlan(1);
// Jobb där man kan jobba ihop på riktigt (delat pass: en kör kunderna, alla serverar)
export const COOP_JOBS = new Set(['burgare', 'kafe', 'pizzeria', 'kok', 'posten', 'bensinmack', 'tvatteri', 'bilverkstad', 'vard', 'incheckning', 'flygplats', 'frukt', 'datorbygge', 'finans']);
const newSid = () => Math.random().toString(36).slice(2, 10).replace(/[^a-z0-9]/g, '') || 'pass';
// får man ta ett längre pass nu? (vanliga jobb stänger 24 – ett långt pass börjar senast 18)
const longOk = (g, jobId) => !!JOBS[jobId]?.nattoppet || g.min <= 18 * 60;

// In i passet med planen (och det gemensamma passet, om man jobbar ihop)
function beginShift(A, jobId, sceneName, plan, coop = null) {
  A.shiftJob = jobId;
  A.shiftPlan = plan;
  A.coop = coop;
  A.go(sceneName, { onDone: (stats) => finishShift(A, jobId, stats) });
}

// Jobb där gästerna ger dricks (minispelet räknar stats.dricksKr). Dricksen läggs
// på lönen efter nivåbonusen – den följer bara med i hunger-halveringen och extrapasset.
const TIP_JOBS = new Set(['kok']);

// Rakt in i passet via 💼-inbjudan: samma öppettids- och ork-kontroller som vanligt, men utan
// introdialogen – man har redan tackat ja. inv = inbjudan { sid, len, lvl, from }: passets
// längd och nivå är den inbjudandes.
export function startShiftNow(A, jobId, sceneName, inv = null) {
  const chk = A.game.canWork(jobId);
  if (!chk.ok) { toast(chk.msg, 'bad'); return false; }
  const plan = inv ? shiftPlan(inv.lvl, inv.len) : shiftPlan(levelOf(A.game.jobs[jobId]));
  beginShift(A, jobId, sceneName, plan, inv?.sid ? { sid: inv.sid, job: jobId, scene: sceneName, host: inv.from || null } : null);
  return true;
}

export function startJobFlow(A, jobId, sceneName) {
  const g = A.game, job = JOBS[jobId];
  const chk = g.canWork(jobId);
  if (!chk.ok) {
    if (chk.waitTo) {
      openModal(`${job.icon} ${job.name}`, `<p style="font-size:var(--f2);margin-top:0">${chk.msg}</p>`, [
        { label: 'Gå därifrån', onClick: closeModal },
        { label: '⏩ Vänta tills det öppnar', cls: 'btn-go', onClick: () => { closeModal(); g.waitUntil(chk.waitTo); startJobFlow(A, jobId, sceneName); } },
      ]);
    } else toast(chk.msg, 'bad');
    return;
  }
  const lvl = levelOf(g.jobs[jobId]);
  const plan = shiftPlan(lvl), canLong = canLongShift(lvl), longNow = canLong && longOk(g, jobId);
  const dubbel = g.eventIs('dubbel') && g.event.job === jobId;
  const rows = [
    `💵 ${job.wage} kr per rätt · −${job.oops} kr per fel${job.bonus ? ` · +${job.bonus} kr per ${job.bonusPer || 'färdig låda'}` : ''}`,
    job.missOops ? `💨 −${job.missOops} kr per ${job.missPer || 'missad'}` : null,
    `⭐ Din nivå: <b>${JOB_TITLES[lvl - 1]}</b> (lön ×${payMult(lvl).toFixed(2).replace('.', ',')})`,
    g.best[jobId].ok ? `🏅 Ditt rekord: <b>${g.best[jobId].ok} rätt</b> · bästa lön ${fmt(g.best[jobId].pay)}` : null,
    dubbel ? `💰 <b class="ok">EXTRAPASS I DAG – DUBBEL LÖN!</b>` : null,
    TIP_JOBS.has(jobId) ? `🪙 Snabb service ger <b>dricks</b> – den går rakt ner i lönen` : null,
    lvl > 1 ? `👥 Som ${JOB_TITLES[lvl - 1].toLowerCase()} får du <b>fler kunder</b>${plan.extra ? ' och fler platser' : ''} – passet är lite längre`
      : `👥 Ju fler pass du jobbar, desto fler kunder och platser`,
    canLong ? `⏱️ Ett pass tar 4 timmar – ett <b>längre pass</b> 6 timmar${longNow ? '' : ' (börjar senast 18:00)'}.` : `⏱️ Ett pass tar 4 timmar.`,
    COOP_JOBS.has(jobId) ? `💼 Jobba ihop: bjud in en kompis till passet` : null,
  ].filter(Boolean);
  openModal(`${job.icon} ${job.name}`, `<p style="font-size:var(--f2);margin-top:0"><b>${job.verb}!</b></p>
    <p style="font-size:var(--f2)">${rows.join('<br>')}</p>
    ${g.hunger <= 0 ? '<p class="bad" style="font-size:var(--f2)">🥴 Du är utsvulten – du jobbar yr och får halv lön!</p>' : ''}
    ${g.energy < 40 ? '<p style="font-size:var(--f2)">😪 Du är ganska trött – sista passet för i dag?</p>' : ''}`, [
    { label: 'En annan gång', onClick: closeModal },
    ...(COOP_JOBS.has(jobId) ? [{ label: '💼 Jobba ihop', onClick: () => coopPicker(A, jobId, sceneName) }] : []),
    ...(canLong ? [
      { label: '🔨 Vanligt pass', cls: 'btn-go', onClick: () => { closeModal(); beginShift(A, jobId, sceneName, shiftPlan(lvl)); } },
      ...(longNow ? [{ label: '💪 Längre pass', cls: 'btn-go', onClick: () => { closeModal(); beginShift(A, jobId, sceneName, shiftPlan(lvl, 'langt')); } }] : []),
    ] : [
      { label: '🔨 Jobba ett pass', cls: 'btn-go', onClick: () => { closeModal(); beginShift(A, jobId, sceneName, shiftPlan(lvl)); } },
    ]),
  ]);
}

// 💼 Välj vem du vill jobba ihop med INNAN passet: inbjudan skickas och du går
// direkt in – kompisen hoppar in bredvid dig. Ni delar lönen, borden dubbleras
// och kunderna strömmar in. (Carls design: väljaren hör hemma i startdialogen.)
// Den som bjuder in bestämmer passet: är man van väljer man vanligt eller längre pass här, och
// kompisen (även en nybörjare) jobbar på ens nivå – fler kunder och platser – och lika länge.
function coopPicker(A, jobId, sceneName) {
  const g = A.game, list = A.playersList?.() || [];
  if (!list.length) {
    toast('Ingen annan är i Pixelstaden just nu – börja passet, så kan kompisar hoppa in via 👥!', 'bad');
    return;
  }
  const lvl = levelOf(g.jobs[jobId]), longNow = canLongShift(lvl) && longOk(g, jobId);
  let len = 'vanligt';
  const rows = list.map((p) => `<div class="prow"><span class="nm">${esc(p.av?.name || '?')}</span>
    <button class="btn btn-small btn-go" data-bjud="${esc(p.id)}">💼 Bjud & börja</button></div>`).join('');
  const lenRow = longNow ? `<p style="font-size:var(--f2)" class="coop-len">
    <button class="btn btn-small btn-go" data-len="vanligt">🔨 Vanligt pass</button>
    <button class="btn btn-small" data-len="langt">💪 Längre pass</button></p>` : '';
  const dlg = openModal('💼 Jobba ihop – med vem?', `
    <p style="font-size:var(--f2);margin-top:0">Kompisen får en inbjudan och hoppar rakt in på ditt pass.
    Ni <b>delar på lönen</b>, extraborden rullas fram och kunderna strömmar in!${lvl > 1 ? ` Ni jobbar på din nivå (${JOB_TITLES[lvl - 1]}).` : ''}</p>
    ${lenRow}
    <div class="plist">${rows}</div>`, [
    { label: 'Tillbaka', onClick: () => { closeModal(); startJobFlow(A, jobId, sceneName); } },
  ]);
  dlg.querySelectorAll('[data-len]').forEach((b) => (b.onclick = () => {
    len = b.dataset.len;
    dlg.querySelectorAll('[data-len]').forEach((o) => o.classList.toggle('btn-go', o === b));
  }));
  dlg.querySelectorAll('[data-bjud]').forEach((b) => (b.onclick = () => {
    closeModal();
    const sid = newSid();
    sendInvite(b.dataset.bjud, jobId, A.avatar?.name || '', { sid, len, lvl });
    toast(`💼 Inbjudan skickad – in på ${len === 'langt' ? 'det långa ' : ''}passet med dig!`, 'good');
    beginShift(A, jobId, sceneName, shiftPlan(lvl, len), { sid, job: jobId, scene: sceneName, host: null });
  }));
}

// 👥 mitt i ett pass: bjud in fler till samma pass (samma plan). Ett pass man började ensam blir
// ett gemensamt pass nu – kompisen hamnar hos en, ingen annan.
export function inviteToShift(A, toId) {
  const jobId = A.shiftJob;
  if (!jobId || !COOP_JOBS.has(jobId)) return false;
  if (!A.coop) A.coop = { sid: newSid(), job: jobId, scene: A.sceneName, host: null };
  const P = planOf(A);
  sendInvite(toId, jobId, A.avatar?.name || '', { sid: A.coop.sid, len: P.len, lvl: P.lvl });
  return true;
}

function finishShift(A, jobId, stats) {
  const job = JOBS[jobId];
  const lvl = levelOf(A.game.jobs[jobId]);
  const mult = payMult(lvl);
  const base = Math.max(0, stats.ok * job.wage + (stats.boxes || 0) * (job.bonus || 0) - stats.fel * job.oops - (stats.miss || 0) * (job.missOops || 0));
  const tips = Math.max(0, Math.round(stats.dricksKr || 0));
  const res = A.game.endShift(jobId, base * mult + tips, stats, planOf(A));
  play('coin');
  const line = (l, r) => `<div style="display:flex;justify-content:space-between;font-size:var(--f2)"><span>${l}</span><b>${r}</b></div>`;
  openModal(`${job.icon} Passet är slut!`, `
    ${line('✅ Rätt', stats.ok + (res.newRecord ? ' 🏅 NYTT REKORD!' : ''))}
    ${line('❌ Fel', stats.fel)}
    ${stats.boxes !== undefined ? line(job.boxLabel || '📦 Färdiga lådor', stats.boxes) : ''}
    ${stats.miss ? line('💨 Missade', stats.miss + (job.missOops ? ` (−${fmt(stats.miss * job.missOops)})` : '')) : ''}
    <div style="border-top:3px dashed var(--ink);margin:8px 0"></div>
    ${stats.delat ? line('👥 Jobbat ihop', `${stats.delat} pers – lagets ${stats.lagOk || 0} rätt delas lika`) : ''}
    ${line('Grundlön', fmt(base))}
    ${mult > 1 ? line(`⭐ ${JOB_TITLES[lvl - 1]}-bonus`, '×' + mult.toFixed(2).replace('.', ',')) : ''}
    ${tips ? line(`🪙 Dricks (${stats.dricks} ggr)`, '+' + fmt(tips)) : ''}
    ${res.starving ? line('🥴 Yr av hunger', 'halv lön!') : ''}
    ${res.doubled ? line('💰 Extrapass', 'DUBBEL LÖN!') : ''}
    ${res.gladMult > 1 ? line('😊 Glad på jobbet', '+5 % dricks') : res.gladMult < 1 ? line('😞 Nere i dag', '−10 % lön') : ''}
    ${planOf(A).len === 'langt' ? line('💪 Längre pass', `${Math.round(planOf(A).gameMin / 60)} timmar`) : ''}
    ${line('💰 Lön', fmt(res.finalPay))}
    ${res.gladPass ? line(`😊 Lycka${res.passIdag >= 3 ? ` (${res.passIdag}:e passet i dag)` : planOf(A).len === 'langt' ? ' (långt pass)' : ''}`, `${res.gladPass} → ${Math.round(A.game.lycka)}`) : ''}
    ${res.nightEnd ? '<p style="font-size:var(--f2);margin-bottom:0">🌙 Nattpasset tog slut vid midnatt – nattbussen tar dig hem till sängen.</p>' : ''}`, [
    { label: res.nightEnd ? '🌙 Ta lönen och åk hem' : '💰 Ta lönen', cls: 'btn-go', onClick: () => { closeModal(); afterShift(A, jobId, res.nightEnd); } },
  ], { closable: false });
}

// Efter passet: kvar där jobbet ligger (flygjobben: terminalen, annars staden) – eller, när
// nattpasset tog slut vid midnatt, hem till sängen (sömnfrågan öppnas direkt).
function afterShift(A, jobId, nightEnd = false) {
  A.shiftJob = null;
  A.shiftPlan = null;
  A.coop = null;
  if (nightEnd) { A.roomSub = 0; A.go('room'); setTimeout(() => A.sleepFlow?.(), 350); return; }
  A.go(JOBS[jobId]?.back || 'city');
}

// Avbryt mitt i (Escape i minispelet): ingen lön, men en timme och lite ork försvann.
export function abortShift(A) {
  openModal('🚪 Sluta i förtid?', '<p style="font-size:var(--f2)">Går du hem nu får du ingen lön för passet.</p>', [
    { label: 'Jobba vidare', cls: 'btn-go', onClick: closeModal },
    { label: 'Gå hem', cls: 'btn-red', onClick: () => { closeModal(); A.game.passTime(60); A.game.energy = Math.max(0, A.game.energy - 10); A.game.save(); toast('Du smet från jobbet…', 'bad'); afterShift(A, A.shiftJob); } },
  ]);
}

// Gemensam topplist i minispelen: tidsstapel + räkneverk. (Telefonen i liggande läge: i
// pixelremsan ovanför bilden i stället – överst i scenen skymde den disken, se hud-pix.js.)
export function drawShiftHud(ctx, A, { t, dur, ok, fel, title }) {
  const SF = globalThis.SF;
  if (SF && shiftInStrip()) { SF.shiftHud = { t, dur, ok, fel, title, at: performance.now() }; return; }
  const sy = (SF?.view?.safe?.y0 | 0); // fyll-lägets beskärning: remsan nedanför kanten
  ctx.fillStyle = 'rgba(23,21,26,0.85)'; ctx.fillRect(0, sy, A.W, 18);
  ctxText(ctx, BIG, title, 4, sy + 5, '#f4f1ea');
  const bw = 110, bx = A.W - bw - 4;
  ctx.fillStyle = '#17151a'; ctx.fillRect(bx - 2, sy + 4, bw + 4, 10);
  const left = Math.max(0, 1 - t / dur);
  ctx.fillStyle = left < 0.2 ? '#d9433b' : '#45b964';
  ctx.fillRect(bx, sy + 6, bw * left | 0, 6);
  const s = `+${ok}  -${fel}`;
  ctxText(ctx, SMALL, s, bx - textW(SMALL, s) - 8, sy + 6, '#f4f1ea');
}

// Små sifferpuffar ("+7", "FEL") som stiger och tonar bort.
export function makePops() {
  const list = [];
  return {
    add(x, y, txt, color) { list.push({ x, y, txt, color, age: 0 }); },
    update(dt) { for (const p of list) { p.age += dt; p.y -= 14 * dt; } for (let i = list.length - 1; i >= 0; i--) if (list[i].age > 0.9) list.splice(i, 1); },
    draw(ctx) {
      for (const p of list) {
        const w = textW(SMALL, p.txt) + 4;
        ctx.fillStyle = 'rgba(23,21,26,0.7)'; ctx.fillRect(p.x - w / 2 | 0, p.y | 0, w, 9);
        ctxText(ctx, SMALL, p.txt, (p.x - w / 2 | 0) + 2, (p.y | 0) + 2, p.color);
      }
    },
  };
}

// "SLUT!"-skylten när tiden gått ut, innan lönebeskedet.
export function drawTimeUp(ctx, A) {
  ctx.fillStyle = 'rgba(23,21,26,0.6)'; ctx.fillRect(0, 0, A.W, A.H);
  const s = 'SLUT!';
  const w = textW(BIG, s, 3);
  ctx.fillStyle = '#17151a'; ctx.fillRect(A.W / 2 - w / 2 - 8 | 0, 84, w + 16, 37);
  ctxText(ctx, BIG, s, A.W / 2 - w / 2 | 0, 92, '#ffd23f', 3);
}
