// PLATSHÅLLARE – interiören byggs här (se interiör-workflown).
import { SMALL, ctxText } from '../core/floor-pix.js';
export function makeShopBostad(A) {
  return {
    _debug: { spot: () => null },
    down() { A.go('city'); },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.fillStyle = '#2a2430'; ctx.fillRect(0, 0, 384, 216);
      ctxText(ctx, SMALL, 'INTERIÖREN BYGGS – KLICKA FÖR ATT GÅ UT', 60, 100, '#f4f1ea');
    },
  };
}
