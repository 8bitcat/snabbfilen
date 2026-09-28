// Hundarna i staden: ingen får hoppa (teleport), byta riktning varje bildruta eller
// blinka mellan gå/stå. Följer varje hund via dess id i SF.scene._debug.sim().life.dogs()
// med 50 ms mellan proven tills minst 6 hundsekunder är uppmätta (högst 40 s).
//   node tools/dog-test.mjs          (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${PORT}/index.html?world=dog${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Hundvakt', look: {}, color: '#e04848' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 1, min: 720, money: 100, hunger: 80, energy: 80, home: 'rum', fridge: {}, jobs: { flygplats: 0, frukt: 0, burgare: 0 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
});
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await page.evaluate(() => window.SF.go('city'));
await page.waitForTimeout(1500);
const hasApi = await page.evaluate(() => typeof window.SF.scene._debug?.sim?.()?.life?.dogs === 'function');
ok(hasApi, 'stadslivet exponerar dogs()');
if (hasApi) {
  // följ hundarna: id → lista av prov i följd
  const tracks = new Map();
  let measured = 0, t0 = Date.now(), seen = 0;
  while (Date.now() - t0 < 40000 && measured < 6 * 20) {
    const dogs = await page.evaluate(() => window.SF.scene._debug.sim().life.dogs());
    seen = Math.max(seen, dogs.length);
    for (const d of dogs) {
      const id = String(d.id ?? `${Math.round(d.owner?.x)}:${Math.round(d.owner?.y)}`);
      if (!tracks.has(id)) tracks.set(id, []);
      tracks.get(id).push(d);
    }
    measured = [...tracks.values()].reduce((a, t) => a + Math.max(0, t.length - 1), 0);
    await page.waitForTimeout(50);
  }
  ok(seen >= 1, `hundar ute i staden: som mest ${seen} samtidigt`);
  let jumps = 0, flips = 0, blinks = 0, walked = 0, steps = 0;
  for (const t of tracks.values()) {
    for (let i = 1; i < t.length; i++) {
      const a = t[i - 1], b = t[i];
      steps++;
      if (Math.hypot(b.x - a.x, b.y - a.y) > 9) jumps++;               // > 9 px på 50 ms = hopp
      if (a.dir !== b.dir) flips++;
      if (a.moving !== b.moving) blinks++;
      if (b.moving) walked++;
    }
  }
  const dogSeconds = steps / 20;
  ok(dogSeconds >= 3, `uppmätt hundtid: ${dogSeconds.toFixed(1)} s över ${tracks.size} hund(ar), gick ${walked} rutor`);
  ok(jumps === 0, `inga hopp/teleporter (${jumps} st)`);
  ok(flips <= Math.ceil(dogSeconds / 1.5) + 1, `riktningsbyten med tröghet (${flips} st, högst ${Math.ceil(dogSeconds / 1.5) + 1})`);
  ok(blinks <= Math.ceil(dogSeconds / 1.0) + 1, `gå/stå växlar inte fram och tillbaka (${blinks} växlingar)`);
}
console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga pageerror');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
