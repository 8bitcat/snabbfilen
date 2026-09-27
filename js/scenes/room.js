// Hemma. Rummet ritas efter bostadstyp (rum/lägenhet/villa) plus köpta möbler,
// och har fyra klickytor: sängen (sova), kylskåpet (äta), garderoben (klä om)
// och dörren (ut). Samma scen ritar besök: hos en kompis visas värdens rum och
// alla figurer som är där (visit.js sköter nätet).
import { drawPerson } from '../core/people.js';
import { openAvatarEditor, avatarTagColors } from '../core/avatar.js';
import { SMALL, ctxText, textW, mix, css, hash } from '../core/floor-pix.js';
import { openModal, closeModal, toast } from '../core/ui.js';
import { foodOf } from '../game.js';
import { play } from '../core/sound.js';
import { visitTick, visitFolks, visitSession, stopVisit } from '../net/visit.js';

const WALK_SEQ = [1, 3, 2, 3];
const FLOOR_Y = 140, FEET = 192;

// Utseendet per bostad: tapet, golv och vilka möbler som ingår.
const STYLES = {
  rum: { wall: 0x8c8270, wall2: 0x7a7160, floor: 0x9a7a50, sofa: false, plant: false, tv: false, matta: false },
  lagenhet: { wall: 0x7a94a8, wall2: 0x6a8294, floor: 0xb08a58, sofa: true, plant: true, tv: false, matta: false },
  villa: { wall: 0xc0b090, wall2: 0xaa9a7c, floor: 0x8a6a42, sofa: true, plant: true, tv: true, matta: true },
};

export function makeRoom(A, { visit = false } = {}) {
  const g = A.game;
  let px = visit ? 330 : 190, target = null, onArrive = null, dir = 'down', t = 0;

  const homeId = () => (visit ? visitSession()?.home || 'rum' : g.home);
  const furn = () => (visit ? visitSession()?.furniture || [] : g.furniture);
  const has = (id) => (STYLES[homeId()] || STYLES.rum)[id] || furn().includes(id);

  // klickytorna [x0, x1, etikett, handling] – på besök funkar bara dörren
  const spots = visit
    ? [{ x0: 322, x1: 362, label: 'ÅK HEM', act: () => { stopVisit(A); play('door'); toast('🚗 Hemma igen.'); A.go('city'); } }]
    : [
      { x0: 16, x1: 92, label: 'SÄNG', act: () => A.sleepFlow() },
      { x0: 116, x1: 162, label: 'GARDEROB', act: () => { play('click'); openAvatarEditor({ onDone: (av) => { A.avatar = av; toast('👕 Snyggt!', 'good'); } }); } },
      { x0: 216, x1: 256, label: 'KYLSKÅP', act: () => openFridge(A) },
      { x0: 322, x1: 362, label: 'UT', act: () => { play('door'); A.go('city'); } },
    ];

  function walkTo(x, cb) { target = Math.max(20, Math.min(A.W - 20, x)); onArrive = cb || null; }

  return {
    update(dt) {
      t += dt;
      if (target !== null) {
        const d = target - px, step = 70 * dt;
        dir = d < 0 ? 'left' : 'right';
        if (Math.abs(d) <= step) { px = target; target = null; dir = 'down'; const cb = onArrive; onArrive = null; cb?.(); }
        else px += Math.sign(d) * step;
      }
      visitTick(A, px, dt);
      // om besöket bryts medan man är där skickas man hem (visit.js visar toast)
      if (visit && !visitSession()) A.go('city');
    },

    down(x) {
      const s = spots.find((s) => x >= s.x0 && x <= s.x1);
      if (s) walkTo((s.x0 + s.x1) / 2, s.act);
      else walkTo(x);
    },

    draw(ctx) {
      const { W, H } = A;
      const st = STYLES[homeId()] || STYLES.rum;
      const hour = g.min / 60, night = hour >= 19.5 || hour < 6.5;

      // tapet med rand + golvplankor
      ctx.fillStyle = css(st.wall); ctx.fillRect(0, 0, W, FLOOR_Y);
      ctx.fillStyle = css(st.wall2);
      for (let x = 0; x < W; x += 16) ctx.fillRect(x, 0, 2, FLOOR_Y);
      ctx.fillStyle = css(mix(st.wall, 0x000000, 0.3)); ctx.fillRect(0, FLOOR_Y - 3, W, 3);
      for (let y = FLOOR_Y; y < H; y += 10) {
        ctx.fillStyle = css(mix(st.floor, 0x000000, (y - FLOOR_Y) / (H - FLOOR_Y) * 0.25));
        ctx.fillRect(0, y, W, 10);
        ctx.fillStyle = css(mix(st.floor, 0x000000, 0.4));
        for (let x = (y / 10 % 2) * 32; x < W; x += 64) ctx.fillRect(x, y, 1, 10);
        ctx.fillRect(0, y, W, 1);
      }
      // trasmattan
      if (has('matta')) {
        ctx.fillStyle = '#b83d3d'; ctx.fillRect(150, 176, 90, 26);
        ctx.fillStyle = '#d96a5a'; ctx.fillRect(154, 179, 82, 20);
        ctx.fillStyle = '#b83d3d'; ctx.fillRect(158, 182, 74, 14);
        ctx.fillStyle = '#e8b230'; ctx.fillRect(150, 176, 90, 1); ctx.fillRect(150, 201, 90, 1);
      }

      // fönster med himlen utanför
      const wx = 176, ww = homeId() === 'villa' ? 56 : 36;
      ctx.fillStyle = '#241a12'; ctx.fillRect(wx - 2, 22, ww + 4, 44);
      ctx.fillStyle = night ? '#101838' : hour < 8 || hour > 17 ? '#e8a05a' : '#8ed0ea';
      ctx.fillRect(wx, 24, ww, 40);
      if (night) { ctx.fillStyle = '#e8ecff'; for (let i = 0; i < 8; i++) ctx.fillRect(wx + 2 + hash(i, 4) * (ww - 4) | 0, 26 + hash(i, 5) * 34 | 0, 1, 1); }
      ctx.fillStyle = '#241a12'; ctx.fillRect(wx + ww / 2 - 1 | 0, 24, 2, 40); ctx.fillRect(wx, 42, ww, 2);

      // säng
      ctx.fillStyle = '#5a4632'; ctx.fillRect(18, 158, 72, 30);          // ram
      ctx.fillStyle = '#e8e3d6'; ctx.fillRect(20, 152, 68, 12);          // madrass
      ctx.fillStyle = '#f4f1ea'; ctx.fillRect(22, 148, 16, 10);          // kudde
      ctx.fillStyle = '#c9323a'; ctx.fillRect(40, 150, 48, 14);          // täcke
      ctx.fillStyle = css(mix(0xc9323a, 0x000000, 0.3)); ctx.fillRect(40, 156, 48, 2);
      ctx.fillStyle = '#3a2a18'; ctx.fillRect(18, 186, 4, 6); ctx.fillRect(86, 186, 4, 6);

      // garderob
      ctx.fillStyle = '#3a2a18'; ctx.fillRect(116, 76, 48, 108);
      ctx.fillStyle = '#5a4632'; ctx.fillRect(118, 78, 21, 104); ctx.fillRect(141, 78, 21, 104);
      ctx.fillStyle = '#e8b230'; ctx.fillRect(136, 126, 2, 8); ctx.fillRect(144, 126, 2, 8);
      ctx.fillStyle = css(mix(0x5a4632, 0xffffff, 0.15)); ctx.fillRect(118, 78, 21, 3); ctx.fillRect(141, 78, 21, 3);

      // kylskåp (+ köksbänk i större bostäder)
      if (st.sofa) { ctx.fillStyle = '#8a8478'; ctx.fillRect(258, 138, 46, 10); ctx.fillStyle = '#6a655c'; ctx.fillRect(258, 148, 46, 34); }
      ctx.fillStyle = '#d8d4cc'; ctx.fillRect(216, 96, 40, 88);
      ctx.fillStyle = '#b5b0a6'; ctx.fillRect(216, 128, 40, 3);
      ctx.fillStyle = '#8a857c'; ctx.fillRect(248, 104, 3, 18); ctx.fillRect(248, 136, 3, 26);
      ctx.fillStyle = css(mix(0xd8d4cc, 0xffffff, 0.4)); ctx.fillRect(218, 98, 3, 84);

      // soffa + växt + TV (ingår i finare bostäder eller köps i Möbelhörnan)
      if (has('soffa')) {
        ctx.fillStyle = '#2c6fb7'; ctx.fillRect(276, 156, 62, 26);
        ctx.fillStyle = css(mix(0x2c6fb7, 0xffffff, 0.2)); ctx.fillRect(276, 150, 62, 10);
        ctx.fillStyle = css(mix(0x2c6fb7, 0x000000, 0.3)); ctx.fillRect(276, 156, 8, 26); ctx.fillRect(330, 156, 8, 26);
      }
      if (has('vaxt')) {
        ctx.fillStyle = '#8e5bd1'; ctx.fillRect(296, 120, 12, 10);
        ctx.fillStyle = '#2f8f46'; ctx.fillRect(298, 104, 3, 16); ctx.fillRect(303, 108, 3, 12); ctx.fillRect(293, 110, 4, 4); ctx.fillRect(306, 102, 4, 5);
      }
      if (has('tv')) {
        ctx.fillStyle = '#17151a'; ctx.fillRect(266, 60, 44, 26);
        ctx.fillStyle = night ? '#3fc4ff' : '#2a3038'; ctx.fillRect(268, 62, 40, 22);
      }

      // dörren
      ctx.fillStyle = '#241a12'; ctx.fillRect(322, 100, 40, 84);
      ctx.fillStyle = '#5a4632'; ctx.fillRect(325, 103, 34, 81);
      ctx.fillStyle = '#e8b230'; ctx.fillRect(352, 140, 4, 4);

      // etiketter under klickytorna
      for (const s of spots) label(ctx, (s.x0 + s.x1) / 2, 206, s.label);

      // kompisar i rummet (besökare hos värden, alla hos gästen)
      const folks = visitFolks();
      for (const f of folks) {
        drawPerson(ctx, f.x, FEET - 2, f.av.look, 'down', f.walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2 + f.x) > 0.9 ? 4 : 0));
        nameTag(ctx, f.x, FEET - 48, f.av);
      }

      // jag själv
      const frame = target !== null ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2) > 0.9 ? 4 : 0);
      drawPerson(ctx, px, FEET, A.avatar.look, dir, frame);
      if (folks.length) nameTag(ctx, px, FEET - 46, A.avatar);

      if (night) { ctx.fillStyle = 'rgba(10,12,40,0.18)'; ctx.fillRect(0, 0, W, H); }
    },
  };
}

function label(ctx, cx, y, s) {
  const w = textW(SMALL, s) + 6;
  ctx.fillStyle = 'rgba(23,21,26,0.75)'; ctx.fillRect(cx - w / 2 | 0, y, w, 9);
  ctxText(ctx, SMALL, s, (cx - w / 2 | 0) + 3, y + 2, '#f4f1ea');
}

function nameTag(ctx, x, y, av) {
  const c = avatarTagColors(av);
  const w = textW(SMALL, av.name || '?') + 6;
  ctx.fillStyle = c.bg; ctx.fillRect(x - w / 2 | 0, y, w, 9);
  ctxText(ctx, SMALL, av.name || '?', (x - w / 2 | 0) + 3, y + 2, c.fg);
}

// Kylskåpet: ät något du köpt. Att äta tar en kvart.
function openFridge(A) {
  const g = A.game;
  const items = Object.entries(g.fridge).filter(([, n]) => n > 0);
  const body = items.length
    ? `<p style="font-size:19px;margin-top:0">Mätthet: <b>${Math.round(g.hunger)}/100</b></p><div class="plist">${items.map(([id, n]) => {
      const f = foodOf(id);
      return `<div class="prow"><span style="font-size:28px;text-align:center">${f.icon}</span>
        <span class="nm">${f.name} ×${n}<br><small class="sp">+${f.fill} mätthet</small></span>
        <button class="btn btn-small btn-go" data-eat="${id}">Ät</button></div>`;
    }).join('')}</div>`
    : `<p style="font-size:20px">Kylskåpet är tomt! 🕸️<br><small>Gå till MAT-butiken i Pixelstaden och handla.</small></p>`;
  const dlg = openModal('🧊 Kylskåpet', body, [{ label: 'Stäng', onClick: closeModal }]);
  dlg.querySelectorAll('[data-eat]').forEach((b) => (b.onclick = () => {
    const f = foodOf(b.dataset.eat);
    if (A.game.eatFromFridge(b.dataset.eat)) { play('ok'); toast(`${f.icon} Mums! +${f.fill} mätthet`, 'good'); openFridge(A); }
  }));
}
