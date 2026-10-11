// Regressionstest för 💎 BLING BLING (js/scenes/shop-bling.js, fasaden i js/city/buildings-linne.js) –
// Carl 2026-10-11: Pixelskolans smyckesbutik som egen butik i staden (Linnéstaden, där LINNÉGATAN 11 stod), dubbla priser:
//   • huset finns i Linnéstaden och dörren leder in i butiken
//   • glasmontern öppnar katalogen, ett kort öppnar provningen (openBuy)
//   • ateljén: ett eget halsband (silverkedja + enhörning + ametist + 6 pärlor = 560 kr) köps, sparas i g.designs och sitter på figuren
//   • samma design igen ger "Ta på – den är redan din" i stället för att kosta en gång till
//   • väskateljén (nalleryggsäck i guld med hjärtan och nalle = 550 kr) och spegeln som visar båda designerna
//   • allt finns kvar efter omladdning, dörren leder ut i staden
//   • på engelska heter allt engelska saker, och på telefonen följer bilden med ner till ateljéborden
// Kör: node tools/bling-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const browser = await chromium.launch();
const errs = [];

async function start(opt, q = '') {
  const ctx = await browser.newContext(opt);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/index.html?nomenu${q}&world=bl${Date.now().toString(36)}`);
  await p.evaluate(() => {
    localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-bl', name: 'Bling', look: { skin: '#f1c7a3', hair: '#6b4226', style: 'long', kid: true }, color: '#ff5dc8' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 3000, hunger: 90, energy: 100, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' } }));
  });
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
  await p.waitForTimeout(700);
  await stang(p);
  return { ctx, p };
}
const stang = (p) => p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const rubrik = (p) => p.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '');
// gå in i butiken från gatan
async function inIButiken(p) {
  await p.evaluate(() => window.SF.go('city')); await p.waitForTimeout(1200);
  await p.evaluate(() => window.SF.scene._debug.teleport(-504, 150)); await p.waitForTimeout(600);
  await p.evaluate(() => window.SF.scene._debug.enter('l_bling')); await p.waitForTimeout(1800);
}
// klicka på en plats i butiken (figuren går dit och plockar fram rutan)
async function klicka(p, spot) {
  await stang(p);
  await p.evaluate((spot) => { const [x0, y0, x1, y1] = window.SF.scene._debug.spots()[spot]; window.SF.scene.down((x0 + x1) / 2, (y0 + y1) / 2); }, spot);
  await p.waitForFunction(() => !!document.querySelector('#modal:not(.hidden) .dlg-head h2'), null, { timeout: 15000 });
  await p.waitForTimeout(300);
}
const valj = (p, val) => p.evaluate(async (val) => {
  for (const [k, v] of Object.entries(val)) { document.querySelector(`#modal [data-k="${k}"][data-v="${v}"]`).click(); await new Promise((r) => setTimeout(r, 120)); }
}, val);
const knapp = (p) => p.evaluate(() => { const b = document.querySelector('#modal .btn-go'); return { text: b?.textContent.trim() || '', disabled: !!b?.disabled }; });

// ---------- på svenska, vid datorn ----------
{
  const { ctx, p } = await start({ viewport: { width: 1280, height: 720 } });
  await inIButiken(p);
  ok(await p.evaluate(() => window.SF.sceneName) === 'bling', 'dörren i Linnéstaden leder in i BLING BLING');

  // glasmontern: katalogen och provningen
  await klicka(p, 'halsband');
  const kat = await p.evaluate(() => ({ h: document.querySelector('#modal .dlg-head h2')?.textContent, kort: document.querySelectorAll('#modal .bl-card').length }));
  ok(kat.h === '📿 Halsband' && kat.kort >= 5, `glasmontern öppnar halsbanden (${kat.kort} kort)`);
  const kortNamn = await p.evaluate(() => { const b = document.querySelector('#modal .bl-card'); const n = b.querySelector('b').textContent.replace(/\u00ad/g, ''); b.click(); return n; });
  await p.waitForTimeout(500);
  const prov = await rubrik(p);
  ok(prov.replace(/\u00ad/g, '').includes(kortNamn), `ett kort öppnar provningen ("${prov}")`);

  // ateljén: ett eget halsband
  await klicka(p, 'neck');
  ok(await rubrik(p) === '📿 Designa ditt halsband', 'ateljébordet öppnar halsbandsdesignen');
  await valj(p, { kedja: 'silver', hange: 'enhorning', sten: 'lila', parlor: '6' });
  const pris = await p.evaluate(() => document.querySelector('#modal .bl-sum b')?.textContent || '');
  ok(/560/.test(pris), `silverkedja + enhörning + ametist + 6 pärlor kostar ${pris} (dubbla Pixelskolans 280)`);
  const k1 = await knapp(p);
  ok(/^Köp för 560/.test(k1.text) && !k1.disabled, `knappen: "${k1.text}"`);
  await p.evaluate(() => document.querySelector('#modal .btn-go').click()); await p.waitForTimeout(500);
  const efter = await p.evaluate(() => { const g = window.SF.game, d = g.designs[0]; return { money: g.money, n: g.designs.length, d, neck: window.SF.avatar.look.neck, open: !document.querySelector('#modal').classList.contains('hidden') }; });
  ok(efter.money === 2440 && efter.n === 1, `köpet drog 560 kr (kvar ${efter.money} kr), designer: ${efter.n}`);
  ok(efter.d?.kind === 'neck' && efter.d.sel.kedja === 'silver' && efter.d.sel.hange === 'enhorning' && efter.d.price === 560, 'designen sparas med sina delar och sitt pris');
  ok(!!efter.neck && efter.neck === efter.d?.look?.neck, `halsbandet sitter på figuren (${efter.neck})`);
  ok(!efter.open, 'rutan stängs efter köpet');

  // samma design igen: ta på i stället för att köpa
  await klicka(p, 'neck');
  const k2 = await knapp(p);
  ok(k2.text.startsWith('Ta på – den är redan din'), `samma design igen: "${k2.text}"`);   // (knapparna slutar med sin kortkommandobokstav)
  ok(await p.evaluate(() => document.querySelectorAll('#modal [data-mine]').length) === 1, 'ateljén visar "Dina egna halsband"');

  // väskateljén
  await klicka(p, 'bag');
  ok(await rubrik(p) === '👜 Designa din väska', 'det andra bordet öppnar väskdesignen');
  await valj(p, { modell: 'nalle', farg: 'guld', monster: 'hjartan', berlock: 'nalle' });
  const pris2 = await p.evaluate(() => document.querySelector('#modal .bl-sum b')?.textContent || '');
  ok(/550/.test(pris2), `nalleryggsäck i guld med hjärtan och nalle kostar ${pris2}`);
  await p.evaluate(() => document.querySelector('#modal .btn-go').click()); await p.waitForTimeout(500);
  const v = await p.evaluate(() => ({ money: window.SF.game.money, n: window.SF.game.designs.length, bag: window.SF.avatar.look.bag }));
  ok(v.money === 1890 && v.n === 2 && !!v.bag, `väskan köpt (kvar ${v.money} kr, ${v.n} designer, väska: ${v.bag})`);

  // spegeln
  await klicka(p, 'spegel');
  const sp = await p.evaluate(() => ({ h: document.querySelector('#modal .dlg-head h2')?.textContent, des: [...document.querySelectorAll('#modal [data-des]')].map((b) => b.textContent.trim()) }));
  ok(sp.h === '🪞 Spegeln' && sp.des.length === 2, `spegeln visar de egna designerna: ${sp.des.join(' | ')}`);
  ok(sp.des[0] === '📿 Silverkedja · Enhörning' && sp.des[1] === '👜 Nalleryggsäck · Guld', 'designerna heter efter sina delar');

  // omladdning: allt finns kvar
  await stang(p);
  await p.reload(); await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 }); await p.waitForTimeout(700);
  const kvar = await p.evaluate(() => ({ n: window.SF.game.designs.length, money: window.SF.game.money, neck: window.SF.avatar.look.neck, bag: window.SF.avatar.look.bag }));
  ok(kvar.n === 2 && kvar.money === 1890 && !!kvar.neck && !!kvar.bag, `efter omladdning: ${kvar.n} designer, ${kvar.money} kr, halsband och väska på`);

  // dörren ut
  await stang(p);
  await inIButiken(p);
  await p.evaluate(() => { const [x0, y0, x1, y1] = window.SF.scene._debug.spots().door; window.SF.scene.down((x0 + x1) / 2, (y0 + y1) / 2); });
  await p.waitForFunction(() => window.SF.sceneName === 'city', null, { timeout: 15000 }).catch(() => {});
  ok(await p.evaluate(() => window.SF.sceneName) === 'city', 'dörren leder ut i staden igen');
  await ctx.close();
}

// ---------- på engelska, på telefonen ----------
{
  const { ctx, p } = await start({ viewport: { width: 812, height: 375 }, screen: { width: 812, height: 375 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, '&lang=en&mobfill=1');
  await inIButiken(p);
  ok(await p.evaluate(() => window.SF.sceneName) === 'bling', 'telefonen: in i butiken');
  const safeIn = await p.evaluate(() => ({ ...window.SF.view.safe, crop: !!window.SF.view.crop }));
  await klicka(p, 'neck');
  const safeBord = await p.evaluate(() => ({ ...window.SF.view.safe }));
  const tableBottom = await p.evaluate(() => window.SF.scene._debug.spots().neck[3]);
  ok(!safeIn.crop || safeBord.y1 >= tableBottom - 2, `telefonen: bilden följer med ner till ateljébordet (synligt t.o.m. rad ${safeBord.y1}, bordet slutar på ${tableBottom})`);
  const en = await p.evaluate(() => ({ h: document.querySelector('#modal .dlg-head h2')?.textContent, b: document.querySelector('#modal .btn-go')?.textContent.trim(), txt: document.querySelector('#modal').textContent }));
  ok(en.h === '📿 Design your necklace' && /^Buy for/.test(en.b), `engelska: "${en.h}" / "${en.b}"`);
  ok(!/Kostar|Halsband|Kedja|Hänge|Pärlor|gratis/.test(en.txt), 'engelska: inga svenska ord i ateljén');
  await ctx.close();
}

await browser.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
