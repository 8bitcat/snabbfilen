// VÄRLDEN MED MÅNGA: sex spelare (egna webbläsare) kommer in i samma värld och ser alla –
// ingen gräns på fyra. Två figurer i SAMMA webbläsare (syskon i var sin flik) är två spelare
// och knuffar inte ut varandra (spelarnyckeln = webbläsarens nyckel + figurens id). 👥-dialogen
// säger "ansluten" först när man är inne, och worldInfo har diagnosfälten (tries, relay).
//   node tools/natverk-test.mjs          (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || '8788';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const world = 'natverk' + Date.now().toString(36);
const errors = [];
const save = { v: 1, day: 2, min: 660, money: 500, hunger: 90, energy: 90, home: 'husvagn', fridge: {}, jobs: {}, earned: 0 };
async function join(ctx, name, id) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(name + ': ' + e.message));
  await p.goto(`http://localhost:${PORT}/index.html?world=${world}`);
  await p.evaluate(([n, id, s]) => { localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id, name: n, look: {}, color: '#e04848' })); localStorage.setItem('snabbfilen_save1', JSON.stringify(s)); }, [name, id, save]);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
  await p.evaluate(() => { document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click(); window.SF.go('city'); });
  await p.waitForTimeout(1200);
  return p;
}
const info = (p) => p.evaluate(async () => { const w = await import('./js/net/world.js'); return w.worldInfo(); });
async function allSee(pages, n, ms = 60000) {
  const t0 = Date.now();
  let res = [];
  while (Date.now() - t0 < ms) {
    res = await Promise.all(pages.map(info));
    if (res.every((r) => r.open && r.online === n)) return res;
    await sleep(1000);
  }
  return res;
}

// 1) sex spelare i var sin webbläsare
const names = ['Carl', 'Julia', 'Alice', 'Märta', 'Nina', 'Saga'];
const pages = [];
for (const [i, n] of names.entries()) pages.push(await join(await browser.newContext({ viewport: { width: 900, height: 560 } }), n, 'id-sex' + i));
let res = await allSee(pages, 6);
ok(res.every((r) => r.open && r.online === 6), `sex spelare ser alla sex (${res.map((r, i) => names[i] + ' ' + r.online).join(', ')})`);
ok(res.filter((r) => r.role === 'host').length === 1, 'exakt en håller i världen');
ok(res.every((r) => r.tries === 0 && typeof r.relay === 'boolean'), 'diagnosen: inga misslyckade försök, relay-flaggan finns');
const dlg = await pages[4].evaluate(() => { document.getElementById('hud-friends').click(); return document.querySelector('#modal .world-diag')?.textContent || ''; });
ok(/ansluten|håller i världen/.test(dlg), `👥 hos Nina: "${dlg.trim()}"`);
const others = await pages[4].evaluate(() => [...document.querySelectorAll('#modal .plist .nm')].map((e) => e.textContent.trim().split(/\s/)[0]));
ok(others.length === 5, `Nina ser de fem andra i listan (${others.join(', ')})`);
for (const p of pages) await p.context().close();

// 2) två figurer i samma webbläsare (två flikar) + en tredje spelare
const solo = await join(await browser.newContext(), 'Värd', 'id-vard');
const shared = await browser.newContext();
const a = await join(shared, 'Syster', 'id-syster');
const b = await join(shared, 'Bror', 'id-bror'); // samma localStorage (samma webbläsarnyckel), annan figur
res = await allSee([solo, a, b], 3, 40000);
ok(res.every((r) => r.open && r.online === 3), `två figurer i samma webbläsare syns båda (${res.map((r) => r.online).join(', ')})`);
await sleep(8000); // ingen knuffar ut den andra efter en stund heller
res = await Promise.all([solo, a, b].map(info));
ok(res.every((r) => r.online === 3), `efter 8 s är alla tre kvar (${res.map((r) => r.online).join(', ')})`);
// samma figur i en ny flik ersätter den gamla (ingen dubblett)
const b2 = await join(shared, 'Bror', 'id-bror');
res = await allSee([solo, a, b2], 3, 30000);
await sleep(6000); // ingen evig knuffloop mellan flikarna
res = await Promise.all([solo, a, b2].map(info));
const old = await info(b);
ok(res.every((r) => r.open && r.online === 3), `samma figur i en ny flik tar över – de tre ser varandra (${res.map((r) => r.online).join(', ')})`);
ok(old.idle && !old.open, 'den gamla fliken är pausad (kopplar inte upp igen och knuffar ut den nya)');

console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga pageerror');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
