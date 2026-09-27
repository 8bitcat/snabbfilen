// Pixelstaden – navet. En gata i sidovy med stadens byggnader. Klicka på en
// byggnad så går avataren dit och kliver in (det kostar en stunds klocktid).
// Himlen skiftar med klockan och fönstren tänds på kvällen.
import { drawPerson, makeLook } from '../core/people.js';
import { avatarTagColors } from '../core/avatar.js';
import { SMALL, ctxText, textW, mix, css, hash } from '../core/floor-pix.js';
import { toast } from '../core/ui.js';

const WALK_SEQ = [1, 3, 2, 3];
const WALK_MIN = 20; // minuter det kostar att gå in någonstans

// x/w = fasad, färgerna är fasta per hus. Ordningen är gatans ordning.
const SPOTS = [
  { id: 'hem', label: 'HEM', x: 6, w: 56, c: 0x8a6a4a },
  { id: 'bostad', label: 'BOSTAD', x: 68, w: 56, c: 0x5a6e8c, open: [8, 18] },
  { id: 'mat', label: 'MAT', x: 130, w: 60, c: 0x2f8f46, open: [8, 21] },
  { id: 'flyg', label: 'FLYG', x: 196, w: 62, c: 0x6d7480, open: [8, 20] },
  { id: 'frukt', label: 'FRUKT', x: 264, w: 58, c: 0xc06a2a, open: [8, 20] },
  { id: 'klader', label: 'KLÄDER', x: 328, w: 52, c: 0xb83d7a, open: [8, 20] },
];
const GROUND = 160, FEET = 174;

// Himlens nyckelfärger över dygnet: [timme, topp, botten]
const SKY = [
  [0, 0x0b1026, 0x1c2140], [5, 0x0b1026, 0x1c2140], [7, 0xc7743f, 0xe8b06a],
  [9, 0x7ec8e8, 0xbfe6f2], [17, 0x7ec8e8, 0xbfe6f2], [20, 0xd06a3a, 0x5a3a6e],
  [22, 0x0b1026, 0x1c2140], [24, 0x0b1026, 0x1c2140],
];
function skyAt(hour) {
  let i = 1;
  while (SKY[i][0] < hour) i++;
  const [h0, t0, b0] = SKY[i - 1], [h1, t1, b1] = SKY[i];
  const t = (hour - h0) / Math.max(0.01, h1 - h0);
  return [mix(t0, t1, t), mix(b0, b1, t)];
}
const isNight = (hour) => hour >= 19.5 || hour < 6.5;

export function makeCity(A) {
  const g = A.game;
  // Avataren minns var på gatan den stod
  if (A.cityX === undefined) A.cityX = SPOTS[0].x + SPOTS[0].w / 2;
  let px = A.cityX, target = null, onArrive = null, dir = 'down', t = 0;

  // Folk på stan: några förbipasserande med slumpade utseenden
  const folk = Array.from({ length: 3 }, (_, i) => ({
    look: makeLook(), x: 40 + i * 130 + hash(i, 7) * 60, sp: (14 + hash(i, 3) * 10) * (i % 2 ? 1 : -1), y: FEET - 3 + i * 2,
  }));

  function walkTo(x, cb) { target = Math.max(12, Math.min(A.W - 12, x)); onArrive = cb || null; }

  function enter(spot) {
    const hour = g.min / 60;
    if (spot.open && (hour < spot.open[0] || hour >= spot.open[1])) {
      toast(`🔒 ${spot.label} har stängt (öppet ${spot.open[0]}–${spot.open[1]}).`, 'bad');
      return;
    }
    g.passTime(WALK_MIN);
    g.save();
    if (g.collapsed) return; // midnatt: main tar hand om det
    if (spot.id === 'hem') A.go('room');
    else if (spot.id === 'bostad') A.openHousing();
    else if (spot.id === 'mat') A.openFoodShop();
    else A.startJob(spot.id);
  }

  return {
    update(dt) {
      t += dt;
      if (target !== null) {
        const d = target - px, step = 65 * dt;
        dir = d < 0 ? 'left' : 'right';
        if (Math.abs(d) <= step) {
          px = target; target = null; dir = 'down';
          A.cityX = px;
          const cb = onArrive; onArrive = null; cb?.();
        } else px += Math.sign(d) * step;
      }
      for (const f of folk) {
        f.x += f.sp * dt;
        if (f.x < -20) f.x = A.W + 20;
        if (f.x > A.W + 20) f.x = -20;
      }
    },

    down(x, y) {
      const spot = SPOTS.find((s) => x >= s.x && x <= s.x + s.w && y < GROUND + 16);
      if (spot) walkTo(spot.x + spot.w / 2, () => enter(spot));
      else walkTo(x);
    },

    draw(ctx) {
      const { W, H } = A;
      const hour = g.min / 60;
      const night = isNight(hour);
      const [top, bot] = skyAt(hour);
      // himmel i band + stjärnor om natten
      for (let y = 0; y < GROUND; y += 4) {
        ctx.fillStyle = css(mix(top, bot, y / GROUND));
        ctx.fillRect(0, y, W, 4);
      }
      if (night) {
        ctx.fillStyle = '#e8ecff';
        for (let i = 0; i < 40; i++) {
          const sx = hash(i, 1) * W, sy = hash(i, 2) * 110;
          if (hash(i, 3) > 0.3 || Math.sin(t * 2 + i) > 0) ctx.fillRect(sx | 0, sy | 0, 1, 1);
        }
        ctx.fillStyle = '#f4f1d8'; // månen
        ctx.beginPath(); ctx.fillRect(320, 22, 14, 14); ctx.fillRect(322, 20, 10, 18); ctx.fillRect(318, 24, 18, 10);
      } else if (hour >= 7 && hour < 19) {
        ctx.fillStyle = '#fff3b8'; // solen
        const sx = 20 + (hour - 7) / 12 * (W - 60);
        ctx.fillRect(sx | 0, 18, 14, 14); ctx.fillRect((sx | 0) + 2, 16, 10, 18); ctx.fillRect((sx | 0) - 2, 22, 18, 10);
      }
      // bakgrundssiluett av staden
      ctx.fillStyle = css(mix(bot, 0x1a1a2e, night ? 0.8 : 0.25));
      for (let i = 0; i < 10; i++) {
        const bw = 24 + hash(i, 11) * 30, bx = i * 40 - 8, bh = 30 + hash(i, 12) * 45;
        ctx.fillRect(bx, GROUND - 62 - bh + 62, bw, bh); // står bakom husen
      }

      for (const s of SPOTS) drawBuilding(ctx, s, g, night, t);

      // trottoar + gata
      ctx.fillStyle = '#9a9284'; ctx.fillRect(0, GROUND, W, 16);
      ctx.fillStyle = '#b5ac9c'; ctx.fillRect(0, GROUND, W, 2);
      ctx.fillStyle = '#7d766a'; for (let x = 0; x < W; x += 24) ctx.fillRect(x, GROUND + 2, 1, 14);
      ctx.fillStyle = '#3a3a40'; ctx.fillRect(0, GROUND + 16, W, H - GROUND - 16);
      ctx.fillStyle = '#d8d2c0'; for (let x = 6; x < W; x += 34) ctx.fillRect(x, GROUND + 34, 16, 3);

      // folk + spelaren (y-sorterat: folk lite högre upp först)
      for (const f of folk) {
        if (night) continue; // gatan är tom på natten
        drawPerson(ctx, f.x, f.y, f.look, f.sp < 0 ? 'left' : 'right', WALK_SEQ[Math.floor(t * 7 + f.x) % 4]);
      }
      const frame = target !== null ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2) > 0.9 ? 4 : 0);
      drawPerson(ctx, px, FEET, A.avatar.look, dir, frame);
      drawTag(ctx, px, FEET - 46, A.avatar);

      // natt: lägg en mörk ton över gata + hus (inte himlen)
      if (night) { ctx.fillStyle = 'rgba(10,12,40,0.28)'; ctx.fillRect(0, 60, W, H - 60); }
    },
  };
}

function drawTag(ctx, x, y, av) {
  const c = avatarTagColors(av);
  const w = textW(SMALL, av.name) + 6;
  ctx.fillStyle = c.bg; ctx.fillRect(x - w / 2 | 0, y, w, 9);
  ctxText(ctx, SMALL, av.name, (x - w / 2 | 0) + 3, y + 2, c.fg);
}

// En byggnad: fasad, tak, fönster (tända på kvällen), dörr och skylt.
// Hemma-huset byter utseende efter vilken bostad man har.
function drawBuilding(ctx, s, g, night, t) {
  let h = 88, c = s.c;
  if (s.id === 'hem') h = { rum: 62, lagenhet: 96, villa: 78 }[g.home] || 62;
  const y0 = GROUND - h, lit = night || (g.min / 60) < 7;

  // fasad + enkel skuggsida
  ctx.fillStyle = css(c); ctx.fillRect(s.x, y0, s.w, h);
  ctx.fillStyle = css(mix(c, 0x000000, 0.25)); ctx.fillRect(s.x + s.w - 4, y0, 4, h);
  ctx.fillStyle = css(mix(c, 0xffffff, 0.18)); ctx.fillRect(s.x, y0, 2, h);
  // tak
  if (s.id === 'hem' && g.home !== 'lagenhet') { // sadeltak på hus/villa
    ctx.fillStyle = '#7d3b30';
    for (let i = 0; i < 10; i++) ctx.fillRect(s.x - 3 + i, y0 - 10 + i, s.w + 6 - i * 2, 2);
  } else {
    ctx.fillStyle = css(mix(c, 0x000000, 0.45)); ctx.fillRect(s.x - 2, y0 - 4, s.w + 4, 5);
  }

  // fönster i rutnät
  const rows = Math.max(1, Math.floor((h - 34) / 22));
  const cols = Math.max(2, Math.floor(s.w / 20));
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const wx = s.x + 6 + k * ((s.w - 12) / cols) + 2, wy = y0 + 8 + r * 22;
    const on = lit && hash(s.x + k, r, 5) > 0.35;
    ctx.fillStyle = on ? '#ffd97a' : css(mix(c, 0x101828, 0.72));
    ctx.fillRect(wx | 0, wy, 10, 12);
    ctx.fillStyle = css(mix(c, 0x000000, 0.4));
    ctx.fillRect(wx | 0, wy + 5, 10, 1); ctx.fillRect((wx | 0) + 5, wy, 1, 12);
  }

  // dörr + skylt
  const dx = s.x + s.w / 2 - 7 | 0;
  ctx.fillStyle = '#241a12'; ctx.fillRect(dx, GROUND - 21, 14, 21);
  ctx.fillStyle = s.id === 'bostad' ? '#e8b230' : '#5a4632'; ctx.fillRect(dx + 1, GROUND - 20, 12, 20);
  ctx.fillStyle = '#241a12'; ctx.fillRect(dx + 10, GROUND - 12, 2, 2); // handtag
  const tw = textW(SMALL, s.label) + 8;
  const sx = s.x + s.w / 2 - tw / 2 | 0;
  ctx.fillStyle = '#17151a'; ctx.fillRect(sx, y0 + (s.id === 'hem' && g.home !== 'lagenhet' ? -20 : -14) + 10, tw, 11);
  ctxText(ctx, SMALL, s.label, sx + 4, y0 + (s.id === 'hem' && g.home !== 'lagenhet' ? -20 : -14) + 13, night ? '#7ee8fa' : '#f4f1ea');

  // små kännetecken per hus
  if (s.id === 'mat') { // randig markis
    for (let i = 0; i < s.w - 8; i += 4) {
      ctx.fillStyle = i % 8 ? '#e8e3d6' : '#c9323a';
      ctx.fillRect(s.x + 4 + i, GROUND - 26, 4, 4);
    }
  }
  if (s.id === 'frukt') { // skorsten med rök
    ctx.fillStyle = '#5a4632'; ctx.fillRect(s.x + s.w - 16, y0 - 14, 8, 14);
    ctx.fillStyle = 'rgba(220,220,215,0.7)';
    for (let i = 0; i < 3; i++) {
      const ph = (t * 8 + i * 9) % 26;
      ctx.fillRect(s.x + s.w - 14 + Math.sin(t + i) * 2 | 0, y0 - 16 - ph, 3, 3);
    }
  }
  if (s.id === 'flyg') { // liten trafikledartorn-lampa som blinkar
    ctx.fillStyle = '#4a505a'; ctx.fillRect(s.x + 6, y0 - 16, 10, 16);
    ctx.fillStyle = Math.sin(t * 4) > 0 ? '#ff5050' : '#601818';
    ctx.fillRect(s.x + 10, y0 - 20, 3, 3);
  }
  if (s.id === 'klader') { // skyltfönster med en tröja
    ctx.fillStyle = '#f4efe2'; ctx.fillRect(s.x + 8, GROUND - 34, 22, 26);
    ctx.fillStyle = '#3fc4ff';
    ctx.fillRect(s.x + 14, GROUND - 27, 10, 10); ctx.fillRect(s.x + 11, GROUND - 27, 3, 5); ctx.fillRect(s.x + 24, GROUND - 27, 3, 5);
  }
}
