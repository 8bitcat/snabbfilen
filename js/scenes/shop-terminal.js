// FLYGTERMINALEN – platshållare, byggs av en agent. Scen 'terminal' i js/main.js.
export function makeShopTerminal(A, opts = {}) {
  return {
    update() {},
    draw(ctx) { ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0); ctx.fillStyle = '#1c1a22'; ctx.fillRect(0, 0, A.W, A.H); ctx.fillStyle = '#fff'; ctx.font = '8px monospace'; ctx.fillText('FLYGTERMINALEN byggs …', 20, 100); },
    down() { A.go('city'); },
  };
}
