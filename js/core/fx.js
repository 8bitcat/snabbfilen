// Små partikeleffekter i skärmpixlar: rök ur datorn, gnistor, pipnoter, damm och
// värmedaller. Röken är 2×2-blobbar som växer och byter palettsteg i stället för
// äkta genomskinlighet – det ser pixlat ut i stället för suddigt.
const SMOKE = ['#d8d4cc', '#9a968e', '#6a6660', '#3a3834'];
const BROWN = ['#c8b090', '#9a7a50', '#6a5030', '#3a2a18'];
const NOTE = ['#f4f2ec', '#f0e030'];

export class Fx {
  constructor() { this.p = []; this.max = 300; }
  clear() { this.p = []; }
  // kind: smoke | brown | spark | note | dust ; x,y i skärmpixlar ; s = skala (px per logisk px)
  spawn(kind, x, y, n = 1, s = 2) {
    for (let i = 0; i < n && this.p.length < this.max; i++) {
      const r = Math.random;
      if (kind === 'smoke' || kind === 'brown') this.p.push({ k: kind, x: x + (r() - 0.5) * 8 * s, y, vx: (r() - 0.5) * 8 * s, vy: -(14 + r() * 14) * s, life: 1.6 + r() * 1.2, age: 0, size: 2 * s, grow: 4 * s });
      else if (kind === 'spark') this.p.push({ k: kind, x, y, vx: (r() - 0.5) * 120 * s, vy: -(30 + r() * 90) * s, life: 0.3 + r() * 0.4, age: 0, size: s });
      else if (kind === 'note') this.p.push({ k: kind, x: x + (r() - 0.5) * 6 * s, y, vx: (r() - 0.5) * 10 * s, vy: -(24 + r() * 10) * s, life: 1.2, age: 0, size: s, wob: r() * 6 });
      else if (kind === 'dust') this.p.push({ k: kind, x, y, vx: (r() - 0.5) * 60 * s, vy: -(10 + r() * 40) * s, life: 1 + r(), age: 0, size: s });
    }
  }
  update(dt) {
    for (const q of this.p) {
      q.age += dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.k === 'spark' || q.k === 'dust') q.vy += 180 * dt * (q.k === 'dust' ? 0.35 : 1);
      if (q.k === 'smoke' || q.k === 'brown') { q.vx *= 1 - dt * 0.6; q.vy *= 1 - dt * 0.25; q.size += q.grow * dt; }
      if (q.k === 'note') q.x += Math.sin(q.age * 6 + q.wob) * 20 * dt;
    }
    this.p = this.p.filter((q) => q.age < q.life);
  }
  draw(ctx) {
    for (const q of this.p) {
      const f = q.age / q.life, x = Math.round(q.x), y = Math.round(q.y), s = q.size;
      if (q.k === 'smoke' || q.k === 'brown') {
        const pal = q.k === 'smoke' ? SMOKE : BROWN, step = Math.min(3, Math.floor(f * 4));
        const r = Math.round(s), half = r >> 1;
        ctx.fillStyle = pal[step];
        // klump av fyra rutor så att röken ser knölig ut
        ctx.fillRect(x - half, y - half, r, r); ctx.fillRect(x - half + (r >> 1), y - half - (r >> 2), r, r); ctx.fillRect(x - half - (r >> 2), y - half + (r >> 2), r - 1, r - 1);
        if (step === 0) { ctx.fillStyle = '#f4f2ec'; ctx.fillRect(x - half + 1, y - half + 1, Math.max(1, r >> 2), Math.max(1, r >> 2)); }
      } else if (q.k === 'spark') { ctx.fillStyle = f < 0.5 ? '#fff4b0' : '#f0a020'; ctx.fillRect(x, y, s, s); ctx.fillRect(x - Math.round(q.vx * 0.01), y - Math.round(q.vy * 0.01), s, s); }
      else if (q.k === 'dust') { ctx.fillStyle = f < 0.6 ? '#b8b4aa' : '#8a867c'; ctx.fillRect(x, y, s, s); }
      else if (q.k === 'note') {
        ctx.fillStyle = f < 0.7 ? NOTE[Math.floor(q.age * 8) % 2] : '#8a8f9c';
        ctx.fillRect(x, y - 4 * s, s, 5 * s); ctx.fillRect(x - 2 * s, y, 3 * s, 2 * s); ctx.fillRect(x, y - 4 * s, 3 * s, s); ctx.fillRect(x + 2 * s, y - 4 * s, s, 2 * s);
      }
    }
  }
}
// värmedaller: sinusvågor ovanför en punkt (ritas direkt, ingen partikel)
export function heatShimmer(ctx, x, y, w, h, t, s = 2) {
  ctx.save();
  for (let i = 0; i < h; i += s) {
    const a = 0.16 * (1 - i / h), off = Math.round(Math.sin(t * 9 + i * 0.35) * 2 * s);
    ctx.fillStyle = `rgba(255,220,180,${a})`; ctx.fillRect(Math.round(x - w / 2 + off), Math.round(y - i), Math.round(w), s);
  }
  ctx.restore();
}
