// INCHECKNINGEN – platshållare, byggs av en agent. Scen 'jobbincheck' i js/main.js.
export function makeJobbIncheck(A, opts = {}) {
  return {
    update() {},
    draw(ctx) { ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0); ctx.fillStyle = '#1c1a22'; ctx.fillRect(0, 0, A.W, A.H); ctx.fillStyle = '#fff'; ctx.font = '8px monospace'; ctx.fillText('INCHECKNINGEN byggs …', 20, 100); },
    down() { A.go('city'); },
  };
}
