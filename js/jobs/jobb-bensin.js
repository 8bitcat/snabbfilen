// PLATSHÅLLARE – jobbet bensin byggs här.
import { SMALL, ctxText } from '../core/floor-pix.js';
export function makeJobbBensin(A, { onDone } = {}) {
  let t = 0, sent = false;
  return {
    _debug: { stats: { ok: 0, fel: 0, miss: 0 } },
    update(dt) { t += dt; if (t > 2 && !sent) { sent = true; onDone?.({ ok: 0, fel: 0, miss: 0 }); } },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.fillStyle = '#2a2430'; ctx.fillRect(0, 0, 384, 216);
      ctxText(ctx, SMALL, 'JOBBET BYGGS', 150, 100, '#f4f1ea');
    },
  };
}
