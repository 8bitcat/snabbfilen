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
import { JOBS, JOB_TITLES, levelOf, payMult, fmt, shiftPlan, canLongShift, rollOf } from '../game.js';
import { karriarRad, openIntervju, chefOf } from '../core/karriar.js'; // karriärstegarna
import { SMALL, BIG, ctxText, textW } from '../core/floor-pix.js';
import { play } from '../core/sound.js';
import { shiftInStrip } from '../core/hud-pix.js';
import { $t } from '../core/i18n.js';
import { guideStep } from '../core/startguide.js'; // 🧭 första dagen: knappen att trycka på pulserar

export const SHIFT_SECONDS = 60; // (nybörjarens vanliga pass – minispelen läser planOf(A).seconds)
export const planOf = (A) => A?.shiftPlan || shiftPlan(1);
// Jobb där man kan jobba ihop på riktigt (delat pass: en kör kunderna, alla serverar)
export const COOP_JOBS = new Set(['burgare', 'kafe', 'pizzeria', 'kok', 'posten', 'bensinmack', 'tvatteri', 'bilverkstad', 'vard', 'incheckning', 'flygplats', 'frukt', 'datorbygge', 'finans']);
const newSid = () => Math.random().toString(36).slice(2, 10).replace(/[^a-z0-9]/g, '') || 'pass';
// får man ta ett längre pass nu? (vanliga jobb stänger 24 – ett långt pass börjar senast 18)
const longOk = (g, jobId) => !!JOBS[jobId]?.nattoppet || g.min <= 18 * 60;

// KARRIÄRSTEGARNA: skiftledare och uppåt bestämmer inför passet. Fokus: tempo (fler kunder, +10 %
// lön) eller noggrannhet (fel kostar hälften). Chefen sätter också priserna: låga (fler kunder,
// lägre styckpris) eller höga (färre kunder, högre styckpris). A.beslut minns valet mellan passen.
const FOKUS = { tempo: { pace: 0.9, lon: 1.1, oops: 1 }, noggrann: { pace: 1, lon: 1, oops: 0.5 } };
const PRISER = { lag: { pace: 0.85, styck: 0.85 }, vanlig: { pace: 1, styck: 1 }, hog: { pace: 1.2, styck: 1.3 } };
const beslutOf = (A, jobId) => {
  const R = rollOf(A.game, jobId), idx = A.game.roller?.[jobId] | 0;
  if (!idx) return null;
  const b = A.beslut || {};
  return { fokus: FOKUS[b.fokus] ? b.fokus : 'noggrann', pris: R.id === 'chef' && PRISER[b.pris] ? b.pris : 'vanlig', chef: R.id === 'chef' };
};
const withBeslut = (plan, B) => (B ? { ...plan, pace: plan.pace * FOKUS[B.fokus].pace * PRISER[B.pris].pace } : plan);

// In i passet med planen (och det gemensamma passet, om man jobbar ihop)
function beginShift(A, jobId, sceneName, plan, coop = null) {
  A.shiftJob = jobId;
  // jobb med många moment får längre tid att spela (JOBS[id].tid) – samma 4 timmar på klockan (plan.gameMin)
  const tid = JOBS[jobId]?.tid || 1;
  if (tid !== 1 && !plan.tid) plan = { ...plan, seconds: Math.round(plan.seconds * tid), tid };
  // (inbjuden till någon annans pass: deras plan gäller – ens egna beslut bara när man leder själv)
  A.shiftBeslut = coop?.host ? null : beslutOf(A, jobId);
  plan = withBeslut(plan, A.shiftBeslut);
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
        { label: $t('Gå därifrån'), onClick: closeModal },
        { label: $t('⏩ Vänta tills det öppnar'), cls: 'btn-go', onClick: () => { closeModal(); g.waitUntil(chk.waitTo); startJobFlow(A, jobId, sceneName); } },
      ]);
    } else toast(chk.msg, 'bad');
    return;
  }
  const lvl = levelOf(g.jobs[jobId]);
  const plan = shiftPlan(lvl), canLong = canLongShift(lvl), longNow = canLong && longOk(g, jobId);
  const dubbel = g.eventIs('dubbel') && g.event.job === jobId;
  const bonusPer = job.bonusPer || $t('färdig låda'), missPer = job.missPer || $t('missad');
  const rows = [
    `${$t`💵 ${job.wage} kr per rätt · −${job.oops} kr per fel`}${job.bonus ? ' · ' + $t`+${job.bonus} kr per ${bonusPer}` : ''}`,
    job.missOops ? $t`💨 −${job.missOops} kr per ${missPer}` : null,
    $t`⭐ Din nivå: <b>${JOB_TITLES[lvl - 1]}</b> (lön ×${payMult(lvl).toFixed(2).replace('.', ',')})`,
    g.best[jobId].ok ? $t`🏅 Ditt rekord: <b>${g.best[jobId].ok} rätt</b> · bästa lön ${fmt(g.best[jobId].pay)}` : null,
    dubbel ? `💰 <b class="ok">${$t('EXTRAPASS I DAG – DUBBEL LÖN!')}</b>` : null,
    TIP_JOBS.has(jobId) ? $t`🪙 Snabb service ger <b>dricks</b> – den går rakt ner i lönen` : null,
    lvl > 1 ? (plan.extra ? $t`👥 Som ${JOB_TITLES[lvl - 1].toLowerCase()} får du <b>fler kunder</b> och fler platser – passet är lite längre` : $t`👥 Som ${JOB_TITLES[lvl - 1].toLowerCase()} får du <b>fler kunder</b> – passet är lite längre`)
      : $t`👥 Ju fler pass du jobbar, desto fler kunder och platser`,
    job.tid === 2 ? $t('⏳ Här får du dubbelt så lång tid på dig att hinna med – passet är ändå 4 timmar på klockan.') : null,
    canLong ? (longNow ? $t`⏱️ Ett pass tar 4 timmar – ett <b>längre pass</b> 6 timmar.` : $t`⏱️ Ett pass tar 4 timmar – ett <b>längre pass</b> 6 timmar (börjar senast 18:00).`) : $t`⏱️ Ett pass tar 4 timmar.`,
    COOP_JOBS.has(jobId) ? $t`💼 Jobba ihop: bjud in en kompis till passet` : null,
    karriarRad(g, jobId),
  ].filter(Boolean);
  // skiftledare och uppåt: dagens beslut (sparas i A.beslut)
  const B0 = beslutOf(A, jobId);
  const beslut = B0 ? `<div class="kr-beslut" style="font-size:var(--f2);margin:6px 0">📋 <b>${$t('Dagens fokus:')}</b>
      <button class="btn btn-small ${B0.fokus === 'tempo' ? 'btn-gold' : ''}" data-fokus="tempo">${$t('🏃 Tempo – fler kunder, +10 % lön')}</button>
      <button class="btn btn-small ${B0.fokus === 'noggrann' ? 'btn-gold' : ''}" data-fokus="noggrann">${$t('🎯 Noggrannhet – fel kostar hälften')}</button>
      ${B0.chef ? `<br>👔 <b>${$t('Priserna i dag:')}</b>
      <button class="btn btn-small ${B0.pris === 'lag' ? 'btn-gold' : ''}" data-pris="lag">${$t('Låga – fler kunder, −15 % per rätt')}</button>
      <button class="btn btn-small ${B0.pris === 'vanlig' ? 'btn-gold' : ''}" data-pris="vanlig">${$t('Vanliga')}</button>
      <button class="btn btn-small ${B0.pris === 'hog' ? 'btn-gold' : ''}" data-pris="hog">${$t('Höga – färre kunder, +30 % per rätt')}</button>` : ''}</div>` : '';
  const sgGo = guideStep() === 'jobb' ? 'btn-go sg-pulse' : 'btn-go';
  const dlg0 = openModal(`${job.icon} ${job.name}`, `<p style="font-size:var(--f2);margin-top:0"><b>${job.verb}!</b></p>
    <p style="font-size:var(--f2)">${rows.join('<br>')}</p>${beslut}
    ${g.hunger <= 0 ? `<p class="bad" style="font-size:var(--f2)">${$t('🥴 Du är utsvulten – du jobbar yr och får halv lön!')}</p>` : ''}
    ${g.energy < 40 ? `<p style="font-size:var(--f2)">${$t('😪 Du är ganska trött – sista passet för i dag?')}</p>` : ''}`, [
    { label: $t('En annan gång'), onClick: closeModal },
    ...(COOP_JOBS.has(jobId) ? [{ label: $t('💼 Jobba ihop'), onClick: () => coopPicker(A, jobId, sceneName) }] : []),
    ...(canLong ? [
      { label: $t('🔨 Vanligt pass'), cls: sgGo, onClick: () => { closeModal(); beginShift(A, jobId, sceneName, shiftPlan(lvl)); } },
      ...(longNow ? [{ label: $t('💪 Längre pass'), cls: 'btn-go', onClick: () => { closeModal(); beginShift(A, jobId, sceneName, shiftPlan(lvl, 'langt')); } }] : []),
    ] : [
      { label: $t('🔨 Jobba ett pass'), cls: sgGo, onClick: () => { closeModal(); beginShift(A, jobId, sceneName, shiftPlan(lvl)); } },
    ]),
  ]);
  dlg0?.querySelectorAll('[data-fokus],[data-pris]').forEach((b) => (b.onclick = () => {
    A.beslut = { ...(A.beslut || {}), ...(b.dataset.fokus ? { fokus: b.dataset.fokus } : { pris: b.dataset.pris }) };
    const key = b.dataset.fokus ? 'fokus' : 'pris';
    dlg0.querySelectorAll(`[data-${key}]`).forEach((o) => o.classList.toggle('btn-gold', o === b));
    play('click');
  }));
}

// 💼 Välj vem du vill jobba ihop med INNAN passet: inbjudan skickas och du går
// direkt in – kompisen hoppar in bredvid dig. Ni delar lönen, borden dubbleras
// och kunderna strömmar in. (Carls design: väljaren hör hemma i startdialogen.)
// Den som bjuder in bestämmer passet: är man van väljer man vanligt eller längre pass här, och
// kompisen (även en nybörjare) jobbar på ens nivå – fler kunder och platser – och lika länge.
function coopPicker(A, jobId, sceneName) {
  const g = A.game, list = A.playersList?.() || [];
  if (!list.length) {
    toast($t('Ingen annan är i Pixelstaden just nu – börja passet, så kan kompisar hoppa in via 👥!'), 'bad');
    return;
  }
  const lvl = levelOf(g.jobs[jobId]), longNow = canLongShift(lvl) && longOk(g, jobId);
  let len = 'vanligt';
  const rows = list.map((p) => `<div class="prow"><span class="nm">${esc(p.av?.name || '?')}</span>
    <button class="btn btn-small btn-go" data-bjud="${esc(p.id)}">${$t('💼 Bjud & börja')}</button></div>`).join('');
  const lenRow = longNow ? `<p style="font-size:var(--f2)" class="coop-len">
    <button class="btn btn-small btn-go" data-len="vanligt">${$t('🔨 Vanligt pass')}</button>
    <button class="btn btn-small" data-len="langt">${$t('💪 Längre pass')}</button></p>` : '';
  const dlg = openModal($t('💼 Jobba ihop – med vem?'), `
    <p style="font-size:var(--f2);margin-top:0">${$t`Kompisen får en inbjudan och hoppar rakt in på ditt pass.
    Ni <b>delar på lönen</b>, extraborden rullas fram och kunderna strömmar in!`}${lvl > 1 ? ' ' + $t`Ni jobbar på din nivå (${JOB_TITLES[lvl - 1]}).` : ''}</p>
    ${lenRow}
    <div class="plist">${rows}</div>`, [
    { label: $t('Tillbaka'), onClick: () => { closeModal(); startJobFlow(A, jobId, sceneName); } },
  ]);
  dlg.querySelectorAll('[data-len]').forEach((b) => (b.onclick = () => {
    len = b.dataset.len;
    dlg.querySelectorAll('[data-len]').forEach((o) => o.classList.toggle('btn-go', o === b));
  }));
  dlg.querySelectorAll('[data-bjud]').forEach((b) => (b.onclick = () => {
    closeModal();
    const sid = newSid();
    sendInvite(b.dataset.bjud, jobId, A.avatar?.name || '', { sid, len, lvl });
    toast(len === 'langt' ? $t`💼 Inbjudan skickad – in på det långa passet med dig!` : $t`💼 Inbjudan skickad – in på passet med dig!`, 'good');
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

// (testerna: avsluta passet direkt med de här siffrorna, som om minispelet tagit slut)
export const endShiftNow = (A, stats) => { if (A.shiftJob) finishShift(A, A.shiftJob, { ok: 0, fel: 0, ...stats }); };
function finishShift(A, jobId, stats) {
  const job = JOBS[jobId];
  const lvl = levelOf(A.game.jobs[jobId]);
  // karriärstegarna: rollens lönelyft och dagens beslut (priserna ändrar styckpriset, noggrannhet halverar avdraget)
  const R = rollOf(A.game, jobId), B = A.shiftBeslut || null;
  const styck = B ? PRISER[B.pris].styck : 1, oopsK = B ? FOKUS[B.fokus].oops : 1, fokusK = B ? FOKUS[B.fokus].lon : 1;
  const mult = payMult(lvl) * R.lon * fokusK;
  const base = Math.max(0, Math.round(stats.ok * job.wage * styck) + (stats.boxes || 0) * (job.bonus || 0) - Math.round(stats.fel * job.oops * oopsK) - (stats.miss || 0) * (job.missOops || 0));
  const tips = Math.max(0, Math.round(stats.dricksKr || 0));
  const res = A.game.endShift(jobId, base * mult + tips, stats, planOf(A));
  const bf = A.game.befordran(jobId);
  play('coin');
  const line = (l, r) => `<div style="display:flex;justify-content:space-between;font-size:var(--f2)"><span>${l}</span><b>${r}</b></div>`;
  openModal($t`${job.icon} Passet är slut!`, `
    ${line($t('✅ Rätt'), stats.ok + (res.newRecord ? ' ' + $t('🏅 NYTT REKORD!') : ''))}
    ${line($t('❌ Fel'), stats.fel)}
    ${stats.boxes !== undefined ? line(job.boxLabel || $t('📦 Färdiga lådor'), stats.boxes) : ''}
    ${stats.miss ? line($t('💨 Missade'), stats.miss + (job.missOops ? ` (−${fmt(stats.miss * job.missOops)})` : '')) : ''}
    <div style="border-top:3px dashed var(--ink);margin:8px 0"></div>
    ${stats.delat ? line($t('👥 Jobbat ihop'), $t`${stats.delat} pers – lagets ${stats.lagOk || 0} rätt delas lika`) : ''}
    ${line($t('Grundlön'), fmt(base))}
    ${payMult(lvl) > 1 ? line($t`⭐ ${JOB_TITLES[lvl - 1]}-bonus`, '×' + payMult(lvl).toFixed(2).replace('.', ',')) : ''}
    ${R.lon > 1 ? line(`${R.icon} ${R.namn}`, '×' + R.lon.toFixed(1).replace('.', ',')) : ''}
    ${B && B.fokus === 'tempo' ? line($t('🏃 Tempo'), '+10 %') : B ? line($t('🎯 Noggrannhet'), $t('fel kostar hälften')) : ''}
    ${B && B.pris !== 'vanlig' ? line(B.pris === 'hog' ? $t('👔 Höga priser') : $t('👔 Låga priser'), B.pris === 'hog' ? $t('+30 % per rätt') : $t('−15 % per rätt')) : ''}
    ${tips ? line($t`🪙 Dricks (${stats.dricks} ggr)`, '+' + fmt(tips)) : ''}
    ${res.starving ? line($t('🥴 Yr av hunger'), $t('halv lön!')) : ''}
    ${res.doubled ? line($t('💰 Extrapass'), $t('DUBBEL LÖN!')) : ''}
    ${res.gladMult > 1 ? line($t('😊 Glad på jobbet'), $t('+5 % dricks')) : res.gladMult < 1 ? line($t('😞 Nere i dag'), $t('−10 % lön')) : ''}
    ${planOf(A).len === 'langt' ? line($t('💪 Längre pass'), $t`${Math.round(planOf(A).gameMin / 60)} timmar`) : ''}
    ${line($t('💰 Lön'), fmt(res.finalPay))}
    ${res.gladPass ? line(res.passIdag >= 3 ? $t`😊 Lycka (${res.passIdag}:e passet i dag)` : planOf(A).len === 'langt' ? $t('😊 Lycka (långt pass)') : $t('😊 Lycka'), `${res.gladPass} → ${Math.round(A.game.lycka)}`) : ''}
    ${res.nightEnd ? `<p style="font-size:var(--f2);margin-bottom:0">${$t('🌙 Nattpasset tog slut vid midnatt – nattbussen tar dig hem till sängen.')}</p>` : ''}
    ${bf.nasta && bf.ok && !bf.soktIdag ? `<p style="font-size:var(--f2);margin-bottom:0" class="ok">${$t`⭐ ${chefOf(jobId)} har sett att du är duktig – sök befordran till <b>${bf.nasta.namn.toLowerCase()}</b>!`}</p>` : ''}`, [
    ...(bf.nasta && bf.ok && !bf.soktIdag && !res.nightEnd ? [{ label: $t`📝 Sök befordran (${bf.nasta.namn.toLowerCase()})`, cls: 'btn-gold', onClick: () => { closeModal(); openIntervju(A, jobId, () => afterShift(A, jobId)); } }] : []),
    { label: res.nightEnd ? $t('🌙 Ta lönen och åk hem') : $t('💰 Ta lönen'), cls: 'btn-go', onClick: () => { closeModal(); afterShift(A, jobId, res.nightEnd); } },
  ], { closable: false });
}

// Efter passet: kvar där jobbet ligger (flygjobben: terminalen, annars staden) – eller, när
// nattpasset tog slut vid midnatt, hem till sängen (sömnfrågan öppnas direkt).
function afterShift(A, jobId, nightEnd = false) {
  A.shiftJob = null;
  A.shiftPlan = null;
  A.shiftBeslut = null;
  A.coop = null;
  if (nightEnd) { A.roomSub = 0; A.go('room'); setTimeout(() => A.sleepFlow?.(), 350); return; }
  A.go(JOBS[jobId]?.back || 'city');
}

// Avbryt mitt i (Escape i minispelet): ingen lön, men en timme och lite ork försvann.
export function abortShift(A) {
  openModal($t('🚪 Sluta i förtid?'), `<p style="font-size:var(--f2)">${$t('Går du hem nu får du ingen lön för passet.')}</p>`, [
    { label: $t('Jobba vidare'), cls: 'btn-go', onClick: closeModal },
    { label: $t('Gå hem'), cls: 'btn-red', onClick: () => { closeModal(); A.game.passTime(60); A.game.energy = Math.max(0, A.game.energy - 10); A.game.save(); toast($t('Du smet från jobbet…'), 'bad'); afterShift(A, A.shiftJob); } },
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
  const s = $t('SLUT!');
  const w = textW(BIG, s, 3);
  ctx.fillStyle = '#17151a'; ctx.fillRect(A.W / 2 - w / 2 - 8 | 0, 84, w + 16, 37);
  ctxText(ctx, BIG, s, A.W / 2 - w / 2 | 0, 92, '#ffd23f', 3);
}
