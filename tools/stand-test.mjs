// Regressionstest för 🥫 BURKTORNET och 🎯 SKJUTBANAN på Pixelberg (js/pixelberg/stand.js, karta.js STAND):
//   • burktornet: 15 kr; en boll mitt i nedersta raden fäller fyra burkar (de som stod på den ramlar med), två till
//     fäller resten → "STORA VINSTEN" och en leksak i leksakslådan; mellanslaget kastar också
//   • skjutbanan: 20 kr; tio korkar mot spökena (30 p) → 300 p → stora vinsten; en bom ger inga poäng
// Kör: node tools/stand-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT) · SHOTS=1 sparar bilder i tools/out/
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788, SHOTS = !!process.env.SHOTS;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const errs = [];
const p = await (await browser.newContext({ viewport: { width: 1200, height: 760 } })).newPage();
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=st${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-st', name: 'Prick', look: { skin: '#e0a97f', hair: '#3b2619', style: 'ponytail', shirt: '#e04848' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 4, min: 13 * 60, money: 600, hunger: 60, energy: 90, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
});
await p.reload().catch(() => {});
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(800);
const D = (fn, a) => p.evaluate(fn, a);
await D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; SF.pixelbergFran = { buss: 'x' }; SF.go('pixelberg'); });
await p.waitForFunction(() => SF.sceneName === 'pixelberg', null, { timeout: 15000 });
await sleep(1200);
await D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; SF.scene._debug.teleport(2050, 400); });
await sleep(800);
if (SHOTS) await p.screenshot({ path: 'tools/out/stand-utanfor.png' });
const leksaker = () => D(() => Object.values(SF.game.toys || {}).reduce((a, b) => a + b, 0));

// ---- burktornet ----
const m0 = await D(() => SF.game.money), l0 = await leksaker();
ok(await D(() => SF.scene._debug.act('kast')), 'burktornet finns på tivolit');
await p.waitForFunction(() => !!window.__burktornet && !!document.querySelector('#modal:not(.hidden) .pb-spel'), null, { timeout: 5000 }).catch(() => {});
ok((await D(() => SF.game.money)) === m0 - 15, 'en omgång kostar 15 kr');
await D(() => { __burktornet.sikta(81, 57); }); await p.keyboard.press(' ');   // mellanslaget kastar
await sleep(1300);
const n1 = await D(() => __burktornet.burkar.filter((b) => b.ner).length);
ok(n1 >= 4 && (await D(() => __burktornet.bollar())) === 2, `mellanslaget kastar; mitt i nedersta raden: ${n1} burkar ramlar (de ovanpå följer med)`);
for (const x of [68, 92]) { await D((x) => { if (__burktornet.burkar.some((b) => !b.ner && Math.abs(b.x + 5 - x) < 3)) { __burktornet.sikta(x, 57); __burktornet.kasta(); } else { __burktornet.sikta(5, 5); __burktornet.kasta(); } }, x); await sleep(900); }
await p.waitForFunction(() => __burktornet.klar(), null, { timeout: 6000 }).catch(() => {});
const kt = await D(() => document.querySelector('#modal .pb-spel-text')?.textContent || '');
ok(/STORA VINSTEN/.test(kt) && (await leksaker()) === l0 + 1, `alla sex nere: "${kt.slice(0, 70)}…" och en leksak till i lådan`);
if (SHOTS) await p.screenshot({ path: 'tools/out/stand-burk.png' });
ok(await D(() => !!document.querySelector('#modal [data-igen]')), 'knappen "En omgång till"');
await D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });

// ---- skjutbanan ----
const m1 = await D(() => SF.game.money), l1 = await leksaker();
ok(await D(() => SF.scene._debug.act('skjut')), 'skjutbanan finns på tivolit');
await p.waitForFunction(() => !!window.__skjutbanan && !!document.querySelector('#modal:not(.hidden) .pb-spel'), null, { timeout: 5000 }).catch(() => {});
ok((await D(() => SF.game.money)) === m1 - 20, 'en omgång kostar 20 kr');
await sleep(400);
if (SHOTS) await p.screenshot({ path: 'tools/out/stand-skjut.png' });
// en bom först (uppe i taket) – sedan nio spöken (figurerna får resa sig direkt, annars tar spökena slut i bild)
await D(() => { __skjutbanan.sikt.x = 90; __skjutbanan.sikt.y = 12; __skjutbanan.skjut(); });
ok((await D(() => __skjutbanan.poang())) === 0 && (await D(() => __skjutbanan.kvar())) === 9, 'en bom: inga poäng, nio korkar kvar');
for (let k = 0; k < 9; k++) {
  await D(() => { __skjutbanan.nere.clear(); const f = __skjutbanan.figurer().find((q) => q.r.typ === 'spoke' && !__skjutbanan.nere.has(q.key) && q.x > 10 && q.x < 160); if (f) { __skjutbanan.sikt.x = f.x + 4; __skjutbanan.sikt.y = f.y - 5; } __skjutbanan.skjut(); });
  await sleep(120);
}
await p.waitForFunction(() => __skjutbanan.klar(), null, { timeout: 5000 }).catch(() => {});
const sp = await D(() => __skjutbanan.poang()), st = await D(() => document.querySelector('#modal .pb-spel-text')?.textContent || '');
ok(sp === 270 && /STORA VINSTEN/.test(st) && (await leksaker()) === l1 + 1, `nio spöken = ${sp} p: "${st.slice(0, 60)}…" och en leksak till`);
if (SHOTS) await p.screenshot({ path: 'tools/out/stand-skjut-slut.png' });

await browser.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
