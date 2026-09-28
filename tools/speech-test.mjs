// Repliker och beskrivningar i butikerna visas som pratbubblor i scenen, inte som rutor överst.
//   node tools/speech-test.mjs          (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || '8788';
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`http://localhost:${PORT}/index.html?world=sp${Date.now().toString(36)}`);
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Kalle', look: {}, color: '#3a78d8' })); localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 1, min: 600, money: 900, hunger: 80, energy: 80, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false })); });
await p.reload(); await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
const toasts = () => p.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '));
async function clickSpot(scene, id) {
  await p.evaluate((sc) => window.SF.go(sc), scene); await p.waitForTimeout(1200);
  const before = await toasts();
  await p.evaluate((i) => { const d = window.SF.scene._debug; const s = d.spot(i); if (!s) return; const x = Array.isArray(s) ? s[0] : s.x, y = Array.isArray(s) ? s[1] : s.y; window.SF.scene.down(x, y); }, id);
  for (let k = 0; k < 40; k++) { await p.waitForTimeout(250); }
  await p.screenshot({ path: `tools/out/speech-${scene}-${id}.png` });
  return { before, after: await toasts() };
}
for (const [scene, id, word] of [['kafe', 'hund', 'farmor'], ['kafe', 'katt', 'Kanel'], ['bostad', 'hund', 'Kanelbulle'], ['klader', 'kassa', 'docka']]) {
  const r = await clickSpot(scene, id);
  ok(!r.after.includes(word), `${scene}/${id}: ingen ruta överst med repliken`);
}
console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga pageerror');
await b.close(); console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT'); process.exit(fails ? 1 : 0);
