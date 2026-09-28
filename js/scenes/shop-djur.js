// PLATSHÅLLARE – djuraffären byggs här.
import { SMALL, ctxText } from '../core/floor-pix.js';
export function makeShopDjur(A) {
  return {
    _debug: { spot: () => null },
    down() { A.go('city'); },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.fillStyle = '#2a2430'; ctx.fillRect(0, 0, 384, 216);
      ctxText(ctx, SMALL, 'DJURAFFÄREN BYGGS – KLICKA FÖR ATT GÅ UT', 50, 100, '#f4f1ea');
    },
  };
}
