// Arbetspasset: samma flöde för alla jobb. Intro-dialog → minispel (60 s verklig
// tid = 4 h speltid) → lönebesked. Lön = rätt × styckpris − fel × avdrag, gånger
// nivåbonusen. Är man utsvulten halveras lönen (yr i huvudet).
import { openModal, closeModal, toast } from '../core/ui.js';
import { JOBS, JOB_TITLES, levelOf, payMult, fmt } from '../game.js';
import { SMALL, BIG, ctxText, textW } from '../core/floor-pix.js';
import { play } from '../core/sound.js';

export const SHIFT_SECONDS = 60;

// Rakt in i passet (t.ex. via 💼 Jobba ihop-inbjudan): samma öppettids- och
// ork-kontroller som vanligt, men utan introdialogen – man har redan tackat ja.
export function startShiftNow(A, jobId, sceneName) {
  const chk = A.game.canWork();
  if (!chk.ok) { toast(chk.msg, 'bad'); return false; }
  A.go(sceneName, { onDone: (stats) => finishShift(A, jobId, stats) });
  return true;
}

export function startJobFlow(A, jobId, sceneName) {
  const g = A.game, job = JOBS[jobId];
  const chk = g.canWork();
  if (!chk.ok) {
    if (chk.waitTo) {
      openModal(`${job.icon} ${job.name}`, `<p style="font-size:20px;margin-top:0">${chk.msg}</p>`, [
        { label: 'Gå därifrån', onClick: closeModal },
        { label: '⏩ Vänta tills det öppnar', cls: 'btn-go', onClick: () => { closeModal(); g.waitUntil(chk.waitTo); startJobFlow(A, jobId, sceneName); } },
      ]);
    } else toast(chk.msg, 'bad');
    return;
  }
  const lvl = levelOf(g.jobs[jobId]);
  const dubbel = g.eventIs('dubbel') && g.event.job === jobId;
  const rows = [
    `💵 ${job.wage} kr per rätt · −${job.oops} kr per fel${job.bonus ? ` · +${job.bonus} kr per färdig låda` : ''}`,
    `⭐ Din nivå: <b>${JOB_TITLES[lvl - 1]}</b> (lön ×${payMult(lvl).toFixed(2).replace('.', ',')})`,
    g.best[jobId].ok ? `🏅 Ditt rekord: <b>${g.best[jobId].ok} rätt</b> · bästa lön ${fmt(g.best[jobId].pay)}` : null,
    dubbel ? `💰 <b class="ok">EXTRAPASS I DAG – DUBBEL LÖN!</b>` : null,
    `⏱️ Ett pass tar 4 timmar.`,
  ].filter(Boolean);
  openModal(`${job.icon} ${job.name}`, `<p style="font-size:21px;margin-top:0"><b>${job.verb}!</b></p>
    <p style="font-size:19px">${rows.join('<br>')}</p>
    ${g.hunger <= 0 ? '<p class="bad" style="font-size:18px">🥴 Du är utsvulten – du jobbar yr och får halv lön!</p>' : ''}
    ${g.energy < 40 ? '<p style="font-size:18px">😪 Du är ganska trött – sista passet för i dag?</p>' : ''}`, [
    { label: 'En annan gång', onClick: closeModal },
    { label: '🔨 Jobba ett pass', cls: 'btn-go', onClick: () => { closeModal(); A.go(sceneName, { onDone: (stats) => finishShift(A, jobId, stats) }); } },
  ]);
}

function finishShift(A, jobId, stats) {
  const job = JOBS[jobId];
  const lvl = levelOf(A.game.jobs[jobId]);
  const mult = payMult(lvl);
  const base = Math.max(0, stats.ok * job.wage + (stats.boxes || 0) * (job.bonus || 0) - stats.fel * job.oops);
  const res = A.game.endShift(jobId, base * mult, stats);
  play('coin');
  const line = (l, r) => `<div style="display:flex;justify-content:space-between;font-size:20px"><span>${l}</span><b>${r}</b></div>`;
  openModal(`${job.icon} Passet är slut!`, `
    ${line('✅ Rätt', stats.ok + (res.newRecord ? ' 🏅 NYTT REKORD!' : ''))}
    ${line('❌ Fel', stats.fel)}
    ${stats.boxes !== undefined ? line('📦 Färdiga lådor', stats.boxes) : ''}
    ${stats.miss ? line('💨 Missade', stats.miss) : ''}
    <div style="border-top:3px dashed var(--ink);margin:8px 0"></div>
    ${line('Grundlön', fmt(base))}
    ${mult > 1 ? line(`⭐ ${JOB_TITLES[lvl - 1]}-bonus`, '×' + mult.toFixed(2).replace('.', ',')) : ''}
    ${res.starving ? line('🥴 Yr av hunger', 'halv lön!') : ''}
    ${res.doubled ? line('💰 Extrapass', 'DUBBEL LÖN!') : ''}
    ${line('💰 Lön', fmt(res.finalPay))}`, [
    { label: '💰 Ta lönen', cls: 'btn-go', onClick: () => { closeModal(); A.go('city'); } },
  ], { closable: false });
}

// Avbryt mitt i (Escape i minispelet): ingen lön, men en timme och lite ork försvann.
export function abortShift(A) {
  openModal('🚪 Sluta i förtid?', '<p style="font-size:20px">Går du hem nu får du ingen lön för passet.</p>', [
    { label: 'Jobba vidare', cls: 'btn-go', onClick: closeModal },
    { label: 'Gå hem', cls: 'btn-red', onClick: () => { closeModal(); A.game.passTime(60); A.game.energy = Math.max(0, A.game.energy - 10); A.game.save(); toast('Du smet från jobbet…', 'bad'); A.go('city'); } },
  ]);
}

// Gemensam topplist i minispelen: tidsstapel + räkneverk.
export function drawShiftHud(ctx, A, { t, dur, ok, fel, title }) {
  ctx.fillStyle = 'rgba(23,21,26,0.85)'; ctx.fillRect(0, 0, A.W, 18);
  ctxText(ctx, BIG, title, 4, 5, '#f4f1ea');
  const bw = 110, bx = A.W - bw - 4;
  ctx.fillStyle = '#17151a'; ctx.fillRect(bx - 2, 4, bw + 4, 10);
  const left = Math.max(0, 1 - t / dur);
  ctx.fillStyle = left < 0.2 ? '#d9433b' : '#45b964';
  ctx.fillRect(bx, 6, bw * left | 0, 6);
  const s = `+${ok}  -${fel}`;
  ctxText(ctx, SMALL, s, bx - textW(SMALL, s) - 8, 6, '#f4f1ea');
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
