// Regressionstest för 💎 BLING BLING (js/scenes/shop-bling.js, bilderna i js/scenes/bling/dream.js, fasaden i js/city/buildings-linne.js) –
// Carl 2026-10-11: Pixelskolans smyckesbutik som egen butik i staden (Linnéstaden, där LINNÉGATAN 11 stod), dubbla priser:
//   • huset finns i Linnéstaden och dörren leder in i butiken
//   • glasmontern öppnar katalogen, ett kort öppnar provningen (openBuy)
//   • ateljén: ett eget halsband (silverkedja + enhörning + ametist + 6 pärlor = 560 kr) köps, sparas i g.designs och sitter på figuren
//   • samma design igen ger "Ta på – den är redan din" i stället för att kosta en gång till
//   • väskateljén (nalleryggsäck i guld med hjärtan och nalle = 550 kr) och spegeln som visar designerna
// Carl 2026-10-12 (Pixelskolans DREAM LAND, väntade värden ×2 mot pixelskolan/docs/HANDOVER-PIXELCITY-DREAMLAND.md):
//   • butiken är 576 px bred: kameran följer figuren åt höger, mössväggen öppnar 🧶 Mössor (nio nya mössor)
//   • pärlbaren: MIRA + rosa, lila, ljusblå, rött hjärta, upprepat till 16 = 188 kr – pärlhalsbandet sitter på figuren
//     (look.beads), samma halsband igen är gratis, och ett halsband ur katalogen tar bort de egna pärlorna (lookForItem)
//   • strykbordet: hjärta och LOVE på tröjan = 90 kr (look.patches), färgbytet är gratis
//   • mobilskal: mintgrönt, regnbågsband, dino, rosa diamant och M = 300 kr (look.mobil syns i handen), samma skal igen gratis
//   • spegeln visar alla fyra sorternas designer och lägger mobilen i fickan
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
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 5000, hunger: 90, energy: 100, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' } }));
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
// klicka på en plats i butiken (figuren går dit och plockar fram rutan). Butiken är bredare än bilden: klicket
// räknas om från butikens koordinater till skärmens med kameran – står platsen utanför bild flyttas figuren dit först.
async function klicka(p, spot, nara) {
  await stang(p);
  if (nara) { await p.evaluate(([x, y]) => window.SF.scene._debug.teleport(x, y), nara); await p.waitForTimeout(300); }
  await p.evaluate((spot) => { const [x0, y0, x1, y1] = window.SF.scene._debug.spots()[spot], c = window.SF.scene._debug.cam(); window.SF.scene.down((x0 + x1) / 2 - c, (y0 + y1) / 2); }, spot);
  await p.waitForFunction(() => !!document.querySelector('#modal:not(.hidden) .dlg-head h2'), null, { timeout: 20000 });
  await p.waitForTimeout(300);
}
const valj = (p, val) => p.evaluate(async (val) => {
  for (const [k, v] of Object.entries(val)) { document.querySelector(`#modal [data-k="${k}"][data-v="${v}"]`).click(); await new Promise((r) => setTimeout(r, 120)); }
}, val);
const tryck = (p, sel) => p.evaluate(async (sel) => { document.querySelector(sel).click(); await new Promise((r) => setTimeout(r, 120)); }, sel);
const knapp = (p) => p.evaluate(() => { const b = document.querySelector('#modal .btn-go'); return { text: b?.textContent.trim() || '', disabled: !!b?.disabled }; });
const summa = (p) => p.evaluate(() => document.querySelector('#modal .bl-sum b')?.textContent || '');
const kopa = async (p) => { await p.evaluate(() => document.querySelector('#modal .btn-go').click()); await p.waitForTimeout(500); };
const look = (p) => p.evaluate(() => ({ ...window.SF.avatar.look, money: window.SF.game.money, kinds: window.SF.game.designs.map((d) => d.kind) }));

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
  const pris = await summa(p);
  ok(/560/.test(pris), `silverkedja + enhörning + ametist + 6 pärlor kostar ${pris} (dubbla Pixelskolans 280)`);
  const k1 = await knapp(p);
  ok(/^Köp för 560/.test(k1.text) && !k1.disabled, `knappen: "${k1.text}"`);
  await kopa(p);
  const efter = await p.evaluate(() => { const g = window.SF.game, d = g.designs[0]; return { money: g.money, n: g.designs.length, d, neck: window.SF.avatar.look.neck, open: !document.querySelector('#modal').classList.contains('hidden') }; });
  ok(efter.money === 4440 && efter.n === 1, `köpet drog 560 kr (kvar ${efter.money} kr), designer: ${efter.n}`);
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
  const pris2 = await summa(p);
  ok(/550/.test(pris2), `nalleryggsäck i guld med hjärtan och nalle kostar ${pris2}`);
  await kopa(p);
  const v = await p.evaluate(() => ({ money: window.SF.game.money, n: window.SF.game.designs.length, bag: window.SF.avatar.look.bag }));
  ok(v.money === 3890 && v.n === 2 && !!v.bag, `väskan köpt (kvar ${v.money} kr, ${v.n} designer, väska: ${v.bag})`);

  // ---- DREAM LAND-delarna ----
  // den bredare butiken och mössväggen
  const bredd = await p.evaluate(async () => { const d = window.SF.scene._debug; d.teleport(500, 140); await new Promise((r) => setTimeout(r, 300)); return { cam: d.cam(), max: window.SF.scene.viewMax?.w }; });
  ok(bredd.max === 576 && bredd.cam > 0, `butiken är ${bredd.max} px bred och kameran följer figuren åt höger (kameran på x ${bredd.cam})`);
  await klicka(p, 'mossor', [434, 104]);
  const moss = await p.evaluate(() => ({ h: document.querySelector('#modal .dlg-head h2')?.textContent, kort: [...document.querySelectorAll('#modal .bl-card b')].map((b) => b.textContent.replace(/\u00ad/g, '')) }));
  ok(moss.h === '🧶 Mössor' && moss.kort.length >= 12 && moss.kort.includes('Kattmössa') && moss.kort.includes('Dinomössa'), `mössväggen öppnar ${moss.h} (${moss.kort.length} mössor, bl.a. ${moss.kort.slice(0, 3).join(', ')})`);

  // pärlbaren: MIRA
  await klicka(p, 'parlor', [192, 124]);
  ok(await rubrik(p) === '📿 Pärla för pärla', 'pärlbaren öppnar Pärla för pärla');
  for (const id of ['b-12', 'b-8', 'b-17', 'b-0']) { await tryck(p, '#modal [data-bcat="abc"]'); await tryck(p, `#modal [data-bead="${id}"]`); }
  await tryck(p, '#modal [data-bcat="glas"]');
  for (const id of ['g-rosa', 'g-lila', 'g-ljusbla']) await tryck(p, `#modal [data-bead="${id}"]`);
  await tryck(p, '#modal [data-bcat="form"]'); await tryck(p, '#modal [data-bead="f-hjarta"]');
  await tryck(p, '#modal [data-bt="rep"]'); await p.waitForTimeout(200);
  const pp = await summa(p);
  ok(/188/.test(pp), `pärlhalsbandet MIRA (16 pärlor) kostar ${pp} (Pixelskolans 94 × 2)`);
  await kopa(p);
  const bl = await look(p);
  ok(bl.neck === 'pearls' && bl.beads?.length === 16 && bl.money === 3702 && bl.kinds.includes('beads'), `pärlhalsbandet sitter på figuren (${bl.beads?.length} pärlor, kvar ${bl.money} kr)`);
  ok(await p.evaluate(() => window.SF.game.ownsWardrobe('neck-pearls')), 'pärlhalsbandet räknas som ägt (figurskaparen låter det sitta kvar)');
  await klicka(p, 'parlor', [192, 124]);
  ok((await knapp(p)).text.startsWith('Ta på – det är redan ditt'), 'samma pärlhalsband igen är gratis');
  const katalogPerlor = await p.evaluate(async () => { const w = await import('/js/data/wardrobe.js'); const L = w.lookForItem('neck-pearls', window.SF.avatar.look); return [L.neck, L.beads]; });
  ok(katalogPerlor[0] === 'pearls' && katalogPerlor[1] === null, 'ett pärlhalsband ur katalogen tar bort de egna pärlfärgerna');

  // strykbordet: hjärta och LOVE på tröjan, sedan gratis färgbyte
  await klicka(p, 'stryk', [338, 170]);
  ok(await rubrik(p) === '✨ Strykmärken och färg', 'strykbordet öppnar Strykmärken och färg');
  await tryck(p, '#modal [data-area="top"]'); await tryck(p, '#modal [data-patch="hjarta"]');
  await tryck(p, '#modal [data-pcat="ord"]'); await tryck(p, '#modal [data-patch="t-love"]');
  const ps = await summa(p);
  ok(/90/.test(ps) && (await knapp(p)).text.startsWith('Stryk fast'), `hjärta och LOVE på tröjan kostar ${ps} (Pixelskolans 45 × 2)`);
  await kopa(p);
  const sl = await look(p);
  ok(sl.patches?.length === 2 && sl.patches.every((q) => q.a === 'top') && sl.money === 3612, `märkena sitter på tröjan (${sl.patches?.length} st, kvar ${sl.money} kr)`);
  await klicka(p, 'stryk', [338, 170]);
  await tryck(p, '#modal [data-area="top"]'); await tryck(p, '#modal [data-col="#46a35a"]');
  ok((await knapp(p)).text.startsWith('Spara'), 'färgbytet kostar inget ("Spara")');
  await kopa(p);
  const fl = await look(p);
  ok(fl.shirt === '#46a35a' && fl.money === 3612 && fl.patches?.length === 2, `tröjan blev grön utan kostnad och märkena sitter kvar (${fl.shirt})`);

  // mobilskal: mint, regnbågsband, dino, rosa diamant och M
  await klicka(p, 'mobil', [505, 170]);
  ok(await rubrik(p) === '📱 Designa ditt mobilskal', 'bordet längst bort öppnar mobilskalen');
  await tryck(p, '#modal [data-case="mint"]'); await tryck(p, '#modal [data-strap="regnbage"]'); await tryck(p, '#modal [data-charm="c-dino"]');
  await tryck(p, '#modal [data-mcat="glitter"]'); await tryck(p, '#modal [data-charm="c-diamant-rosa"]');
  await tryck(p, '#modal [data-mcat="abc"]'); await tryck(p, '#modal [data-charm="c-l-12"]');
  const pm = await summa(p);
  ok(/300/.test(pm), `mobilskalet kostar ${pm} (Pixelskolans 150 × 2)`);
  await kopa(p);
  const ml = await look(p);
  ok(ml.mobil?.[0] === '#6fd0aa' && ml.money === 3312 && ml.kinds.includes('phone'), `mobilen i handen har det mintgröna skalet (kvar ${ml.money} kr)`);
  const ritas = await p.evaluate(async () => {
    const P = await import('/js/core/people.js'), L = window.SF.avatar.look;
    const px = (look) => { const c = P.personSprite(look, 'down', 0); return [...c.getContext('2d').getImageData(0, 0, c.width, c.height).data].join(','); };
    return { mobil: px(L) !== px({ ...L, mobil: null }), marken: px(L) !== px({ ...L, patches: null }), parlor: px(L) !== px({ ...L, beads: null }) };
  });
  ok(ritas.mobil && ritas.marken && ritas.parlor, `figuren ritar mobilen, märkena och pärlorna (${JSON.stringify(ritas)})`);
  await klicka(p, 'mobil', [505, 170]);
  ok((await knapp(p)).text.startsWith('Ta fram den – den är din'), 'samma mobilskal igen är gratis');

  // spegeln
  await klicka(p, 'spegel', [156, 104]);
  const sp = await p.evaluate(() => ({ h: document.querySelector('#modal .dlg-head h2')?.textContent, des: [...document.querySelectorAll('#modal [data-des]')].map((b) => b.textContent.trim()), ficka: !!document.querySelector('#modal [data-mx="ficka"]') }));
  ok(sp.h === '🪞 Spegeln' && sp.des.length === 4, `spegeln visar de egna designerna: ${sp.des.join(' | ')}`);
  ok(sp.des[0] === '📿 Silverkedja · Enhörning' && sp.des[1] === '👜 Nalleryggsäck · Guld' && sp.des[2] === '📿 Pärlhalsband MIRA' && /^📱 Mobilskal · Mintgrön · ✨3$/.test(sp.des[3]), 'designerna heter efter sina delar');
  await tryck(p, '#modal [data-mx="ficka"]'); await p.waitForTimeout(200);
  ok(sp.ficka && !(await look(p)).mobil, 'spegeln lägger mobilen i fickan');

  // omladdning: allt finns kvar
  await stang(p);
  await p.reload(); await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 }); await p.waitForTimeout(700);
  const kvar = await p.evaluate(() => ({ kinds: window.SF.game.designs.map((d) => d.kind).join(','), money: window.SF.game.money, L: window.SF.avatar.look, beadSel: window.SF.game.designs[2]?.sel?.beads?.length, charms: window.SF.game.designs[3]?.sel?.charms?.length }));
  ok(kvar.kinds === 'neck,bag,beads,phone' && kvar.money === 3312 && kvar.beadSel === 16 && kvar.charms === 3, `efter omladdning: designerna ${kvar.kinds} (16 pärlor, 3 berlocker), ${kvar.money} kr`);
  ok(kvar.L.beads?.length === 16 && kvar.L.patches?.length === 2 && kvar.L.shirt === '#46a35a', 'efter omladdning: pärlorna, märkena och tröjans färg sitter kvar');

  // dörren ut
  await stang(p);
  await inIButiken(p);
  await p.evaluate(() => { const [x0, y0, x1, y1] = window.SF.scene._debug.spots().door, c = window.SF.scene._debug.cam(); window.SF.scene.down((x0 + x1) / 2 - c, (y0 + y1) / 2); });
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
  await klicka(p, 'stryk', [338, 170]);
  const enS = await p.evaluate(() => ({ h: document.querySelector('#modal .dlg-head h2')?.textContent, txt: document.querySelector('#modal').textContent }));
  ok(enS.h === '✨ Patches and colour' && !/Strykmärken|märken|Tröjan|Väskan|Byxorna|Bästsäljare/.test(enS.txt), `engelska: strykbordet heter "${enS.h}" och har inga svenska ord`);
  await klicka(p, 'mobil', [505, 170]);
  const enM = await p.evaluate(() => ({ h: document.querySelector('#modal .dlg-head h2')?.textContent, txt: document.querySelector('#modal').textContent }));
  ok(enM.h === '📱 Design your phone case' && !/Skal|Mobilband|Berlocker|Sockervadd|Bokstaven/.test(enM.txt), `engelska: mobilskalen heter "${enM.h}" och har inga svenska ord`);
  await ctx.close();
}

await browser.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
