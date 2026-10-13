// Regressionstest: KÖKET tål att man gör stegen i "fel" ordning (Carl 2026-10-13: "jag kan inte hälla av vattnet …
// problemet är att man kan göra saker i en ordning som gör att det blir fel"):
//   A. pastan i en torr gryta på spisen FÖRE vattnet → vattensteget är kvar, pilen pekar på grytan → kranen fyller
//      grytan fast pastan redan ligger i → man kan hälla av → hela receptet går att laga klart
//   B. fel gryta först: gryta 2 på spisen (bunden), sedan gryta 1 till kranen → gryta 1 tar över rollen
//   C. formen in i ugnen tom, sedan råvarorna → de går att lägga i formen där den står i ugnen
//   D. grytan med vatten OCH pastan i kranen före pastan är klar: "ÄR INTE KLAR ÄN" – inget händer
//   node tools/kok-ordning-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const errs = [];
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1200, height: 760 } });
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
const sleep = (ms) => p.waitForTimeout(ms);
const SAVE = { v: 1, day: 3, min: 10 * 60, money: 3000, hunger: 40, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } };
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=kord${Date.now().toString(36)}`);
await p.evaluate((s) => { localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1'); localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Kocken', look: { skin: '#eec3a0', hair: '#d9a95c', style: 'wavy', shirt: '#7a1e2e', pants: '#1c1c1c' }, color: '#ffd23f' })); localStorage.setItem('snabbfilen_save1', JSON.stringify(s)); }, SAVE);
await p.reload().catch(() => {});
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(700);
const K0 = (fn, ...a) => p.evaluate(([fn, a]) => SF.scene._debug[fn](...a), [fn, a]);
// (stegen bockas av i spelets update – läs läget först efter ett par bildrutor, annars är provet beroende av tajming)
const K = async (fn, ...a) => { if (fn === 'state') await K0('skip', 0.1); return K0(fn, ...a); };
const laga = async (id) => {
  await p.evaluate(async (id) => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; const g = SF.game, { receptOf } = await import('/js/game.js'); if (!g.recept.includes(id)) g.recept.push(id); for (const x of receptOf(id).ing) g.skafferi[x] = (g.skafferi[x] | 0) + 1; SF.kokPlan = { id, n: 1 }; SF.go('koket'); }, id);
  await sleep(300);
};
// följ pilen tills rätten är klar (som kok-test)
const foljPilen = async () => { let n = 0; while (n++ < 300) { const s = await K('state'); if (s.finished) return true; if (!s.target) { await K('skip', 1); continue; } await K('click', s.target); await K('skip', 0.1); } return false; };
const klart = async () => { await sleep(1800); await p.evaluate(() => { const b = [...document.querySelectorAll('#modal button')].find((x) => /Tack för maten/.test(x.textContent)); b?.click(); }); await sleep(300); };

// ---- A. pastan före vattnet ----
await laga('pastapomodoro');
await K('click', 'rack:gryta1'); await K('click', 'platta0'); await K('click', 'vred0');
await K('click', 'ing:pasta'); await K('click', 'platta0');
let s = await K('state');
ok(s.ves.gryta1.items.some((it) => it.ing === 'pasta') && !s.ves.gryta1.water, 'A: pastan ligger i en torr gryta på spisen');
ok(s.step?.t === 'vatten' && s.target === 'platta0', `A: vattensteget är kvar – pilen pekar på grytan (${s.target})`);
await K('click', 'platta0');   // ta upp grytan
s = await K('state');
ok(s.hand?.id === 'gryta1' && s.target === 'diskho', 'A: grytan i handen – pilen pekar på kranen');
await K('click', 'diskho');
s = await K('state');
ok(s.ves.gryta1.water && s.ves.gryta1.items.length === 1 && s.cur >= 1, 'A: kranen fyllde grytan fast pastan redan låg i – vattensteget avbockat');
ok(await foljPilen(), 'A: resten av receptet gick att laga klart genom att följa pilen');
await klart();

// ---- B. fel gryta först ----
await laga('kottfarssas');
await K('click', 'rack:gryta2'); await K('click', 'platta1');
s = await K('state');
ok(s.bind.gryta === 'gryta2', 'B: gryta 2 på spisen blev "grytan"');
await K('click', 'rack:gryta1'); await K('click', 'diskho');
s = await K('state');
ok(s.ves.gryta1.water && s.bind.gryta === 'gryta1', 'B: gryta 1 till kranen – den tar över rollen (gryta 2 var tom)');
ok(await foljPilen(), 'B: receptet gick att laga klart');
await klart();

// ---- C. tom form i ugnen, sedan råvarorna ----
await laga('ugnskyckling');
await K('click', 'rack:form'); await K('click', 'ugn');
s = await K('state');
ok(s.ves.form.place === 'ugn' && !s.ves.form.items.length, 'C: formen står tom i ugnen');
await K('click', 'ing:kyckling'); await K('click', 'ugn');
s = await K('state');
ok(s.ves.form.items.some((it) => it.ing === 'kyckling'), 'C: kycklingen gick att lägga i formen i ugnen');
ok(await foljPilen(), 'C: receptet gick att laga klart');
await klart();

// ---- D. hälla av innan pastan är klar ----
await laga('pastapomodoro');
await K('click', 'rack:gryta1'); await K('click', 'diskho'); await K('click', 'platta0'); await K('click', 'vred0'); await K('click', 'ing:pasta'); await K('click', 'platta0');
await K('skip', 1);
await K('click', 'platta0'); await K('click', 'diskho');
s = await K('state');
ok(s.ves.gryta1.water && s.hand?.id === 'gryta1', 'D: vattnet är kvar – pastan var inte klar (grytan i handen)');
await K('click', 'platta0');   // tillbaka på plattan
ok(await foljPilen(), 'D: receptet gick att laga klart');
await klart();

ok(errs.length === 0, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
