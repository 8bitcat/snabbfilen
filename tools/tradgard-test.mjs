// Funktionstest av TRÄDGÅRDEN (game.js GRODOR/TRADGARD/plant/waterGarden/harvest/growGarden,
// js/scenes/tradgard.js, room.js ytterdörrens val, week.js morgonrutan):
//   1. radhuset: ytterdörren frågar "stan eller trädgården" (robotar bara med ?tradgard)
//   2. så: fröpåsen kostar, bädden är vattnad direkt; för dyrt = knappen är grå
//   3. natten: vattnad bädd växer en dag; morgonrutan berättar och listar "vattna trädgården"
//   4. vattenkannan på bänken vattnar allt på en gång (och tar lite tid); regnet vattnar gratis
//   5. mogen bädd skördas till skafferiet; två torra nätter = vissen, rensa och så igen
//   6. villan: äppelträdet ger äpplen var tredje dag; husvagnen 3 pallkragar, terrassen 4 krukor
//   7. lägenheten (ingen uteplats) går rakt ut i stan; dörren i trädgården leder in igen
//   8. allt sparas: bäddarna finns kvar efter omladdning
//   node tools/tradgard-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'tradgard') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const errs = [];
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1200, height: 760 } });
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
const SAVE = (home, extra = {}) => ({ v: 1, day: 3, min: 10 * 60, money: 500, hunger: 80, energy: 90, home, fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false, ...extra });
const start = async (save, q = '&tradgard') => {
  await p.goto(`http://localhost:${PORT}/index.html?nomenu${q}&world=tg${Date.now().toString(36)}`);
  await p.evaluate((s) => { localStorage.clear(); localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Odlaren', look: { skin: '#eec3a0', hair: '#d9a95c', style: 'wavy', shirt: '#3a8a5a', pants: '#2d3a5c' }, color: '#ffd23f' })); localStorage.setItem('snabbfilen_save1', JSON.stringify(s)); }, save);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await p.waitForTimeout(700);
};
const sleep = (ms) => p.waitForTimeout(ms);
const D = (fn, arg) => p.evaluate(fn, arg);
const until = async (fn, ms = 9000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg)) return true; await sleep(80); } return false; };
const modalTitle = () => D(() => (document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''));
const modalText = () => D(() => document.querySelector('#modal')?.innerText || '');
const clickBtn = (re) => D((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll('#modal button')].find((x) => r.test(x.textContent) && !x.disabled); if (!b) return false; b.click(); return true; }, re.source);
const lastToast = () => D(() => [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent).pop() || '');
const beds = () => D(() => SF.scene._debug.beds());
const shot = async (name) => { const bb = await p.locator('#scene').boundingBox(); await p.screenshot({ path: OUT + name + '.png', clip: bb }); };
// (en slumpad regnig dag skulle vattna åt testet – regnet prövas för sig)
const sleepNight = () => D(() => { const g = SF.game, o = g.eventIs; g.eventIs = (id) => id !== 'regn' && o.call(g, id); try { return g.sleep().odlat; } finally { delete g.eventIs; } });
// ut genom ytterdörren hemma (figuren går dit)
const outDoor = async () => { await D(() => { const s = SF.scene._debug.spot('dorr'); SF.scene.down(s.x, s.y); }); };

// ---------- 1. radhuset: ytterdörren ----------
await start(SAVE('radhus'));
ok((await D(() => SF.sceneName)) === 'room', 'radhuset: man börjar hemma');
await outDoor();
ok(await until(() => /Vart vill du gå/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '')), 'ytterdörren frågar: stan eller trädgården');
ok(/Trädgården/.test(await modalText()) && /Ut i stan/.test(await modalText()), 'valen: 🏡 Trädgården och 🏙️ Ut i stan');
await clickBtn(/Trädgården/);
ok(await until(() => SF.sceneName === 'tradgard'), 'in i trädgården');
await sleep(400);
ok((await D(() => SF.scene._debug.kind())) === 'radhus', 'radhusets trädgård');
let B = await beds();
ok(B.length === 6 && B.every((b) => b.st === 'tom'), `sex tomma bäddar (${B.map((b) => b.st).join(',')})`);

// ---------- 2. så ----------
// klick på bädd 0 → figuren går dit → fröpåsarna
await D(() => { const s = SF.scene._debug.spot('badd0'); SF.scene.down(s.x, s.y); });
ok(await until(() => /Så i bädden/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '')), 'klick på en tom bädd: figuren går dit och fröpåsarna kommer fram');
ok((await D(() => document.querySelectorAll('#modal [data-gr]').length)) === 6, 'sex sorters frön (potatis, morötter, lök, rödlök, tomater, paprika)');
let m0 = await D(() => SF.game.money);
await D(() => document.querySelector('#modal [data-gr="potatis"]').click());
await sleep(300);
B = await beds();
ok(B[0].st === 'vattnad' && B[0].b.g === 'potatis', 'potatisen är sådd och vattnad');
ok((await D(() => SF.game.money)) === m0 - 15, 'fröpåsen kostade 15 kr');
ok(/Sådde potatis/.test(await lastToast()), 'besked: Sådde potatis');
// morötter i bädd 1, tomater i bädd 2
for (const [i, gr] of [[1, 'morot'], [2, 'tomat']]) {
  await D((i) => SF.scene._debug.act('badd' + i), i);
  await until(() => !!document.querySelector('#modal [data-gr]'));
  await D((gr) => document.querySelector(`#modal [data-gr="${gr}"]`).click(), gr);
  await sleep(200);
}
B = await beds();
ok(B[1].b?.g === 'morot' && B[2].b?.g === 'tomat', 'morötter och tomater sådda');
// info om en vattnad bädd
await D(() => SF.scene._debug.act('badd0'));
await sleep(100);
ok(/dag 0 av 4/.test(await lastToast()), `vattnad bädd visar läget ("${await lastToast()}")`);
await shot('01-sadd');
// för lite pengar → knapparna grå
await D(() => { SF.game.money = 5; });
await D(() => SF.scene._debug.act('badd3'));
await until(() => !!document.querySelector('#modal [data-gr]'));
ok((await D(() => [...document.querySelectorAll('#modal [data-gr]')].every((b) => b.disabled))), 'utan pengar är alla fröpåsar grå');
await clickBtn(/Inte nu/);
await D(() => { SF.game.money = 500; });

// ---------- 3. natten ----------
let od = await sleepNight();
ok(od && od.vaxte === 3 && !od.vissnade, `natten: tre bäddar växte (${JSON.stringify(od)})`);
B = await beds();
ok(B[0].b.v === 1 && B[0].st === 'torr', 'ny dag: potatisen växte en dag och behöver vatten igen');
// morgonrutan
await D(async (od) => { const m = await import('./js/core/week.js'); m.openWeek(SF, { morning: true, odlat: od }); }, od);
await sleep(300);
let txt = await modalText();
ok(/I natt i trädgården: 3 växte en dag till/.test(txt), 'morgonrutan: "I natt i trädgården: 3 växte en dag till"');
ok(/Vattna trädgården \(3 bäddar\)/.test(txt), 'att göra: Vattna trädgården (3 bäddar)');
await D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });

// ---------- 4. vattenkannan och regnet ----------
const tA = await D(() => SF.game.min);
await D(() => SF.scene._debug.act('bank'));
await sleep(150);
ok(/vattnade 3 bäddar/.test(await lastToast()), 'vattenkannan vattnar alla tre bäddarna');
B = await beds();
ok(B.slice(0, 3).every((b) => b.st === 'vattnad'), 'alla tre är vattnade');
ok((await D(() => SF.game.min)) - tA >= 9, 'vattnandet tog en stund');
await D(() => SF.scene._debug.act('bank'));
await sleep(100);
ok(/redan vattnat/.test(await lastToast()), 'en gång till: allt är redan vattnat');
await shot('02-vattnat');
// regnet: vattnar utan att tiden går
od = await sleepNight();
const tR = await D(() => SF.game.min);
const nR = await D(() => SF.game.waterGarden(-1, true));
ok(nR === 3 && (await D(() => SF.game.min)) === tR, 'regnet vattnar alla bäddar utan att klockan går');

// ---------- 5. mogen, skörd, vissen ----------
// potatisen (4 dagar) och moroten (3 dagar): vattna två nätter till; tomaten lämnas torr
await sleepNight();                                                  // dag 3 (regnet vattnade dag 2)
B = await beds();
ok(B[1].st === 'mogen', `morötterna är mogna efter tre nätter (${B[1].st}, v ${B[1].b?.v})`);
await D(() => SF.game.waterGarden(0));
od = await sleepNight();                                             // potatisen dag 4 → mogen; tomaten torr 1
B = await beds();
ok(B[0].st === 'mogen', 'potatisen är mogen efter fyra nätter');
ok(B[2].b.torr === 1 && B[2].st === 'torr', 'tomaten fick inget vatten: ett torrt dygn');
ok(od.mogna === 1, 'morgonen räknar den mogna bädden');
await shot('03-mogen');
const potA = await D(() => SF.game.skafferi.potatis | 0), glA = await D(() => SF.game.lycka);
await D(() => SF.scene._debug.act('badd0'));
await sleep(150);
const potB = await D(() => SF.game.skafferi.potatis | 0);
ok(potB - potA >= 4 && potB - potA <= 6, `skörden: ${potB - potA} potatisar i skafferiet`);
ok(/potatis till skafferiet/.test(await lastToast()), 'besked: … potatis till skafferiet');
ok((await D(() => SF.game.lycka)) >= glA, 'odlandet gör en gladare');
ok((await beds())[0].st === 'tom', 'bädden är tom efter skörden');
await D(() => SF.scene._debug.act('badd1'));
await sleep(100);
ok((await D(() => SF.game.skafferi.morot | 0)) >= 4, 'morötterna skördade');
// ännu en torr natt → tomaten vissnar
od = await sleepNight();
B = await beds();
ok(B[2].st === 'vissen' && od.vissnade === 1, 'två torra dygn: tomaten vissnade');
ok(!B.some((b) => b.st === 'mogen'), 'en mogen bädd vissnar aldrig (de är skördade)');
await shot('04-vissen');
await D(() => SF.scene._debug.act('badd2'));
await sleep(100);
ok((await beds())[2].st === 'tom' && /vissnade/.test(await lastToast()), 'vissen bädd rensas med ett klick');
// en mogen bädd står kvar hur länge som helst
await D(() => { SF.game.garden().beds[3] = { g: 'lok', dag: 1, v: 3, vat: 1, torr: 0, vissen: false }; });
await sleepNight(); await sleepNight();
ok((await beds())[3].st === 'mogen', 'mogen lök står kvar fast ingen vattnar');

// ---------- 8. sparas ----------
await D(() => SF.game.save());
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await sleep(500);
ok((await D(() => SF.game.garden().beds[3]?.g)) === 'lok', 'bäddarna finns kvar efter omladdning');

// ---------- 7. dörren in igen ----------
await D(() => SF.go('tradgard'));
await sleep(500);
await D(() => SF.scene._debug.act('dorr'));
ok(await until(() => SF.sceneName === 'room'), 'dörren i trädgården leder in i bostaden');

// ---------- 6. villan, husvagnen, terrassen ----------
await start(SAVE('villa', { odling: { villa: { beds: [], trad: { skord: 0 } } } }));
await D(() => SF.go('tradgard'));
await sleep(600);
ok((await beds()).length === 8, 'villan: åtta bäddar');
ok(await D(() => SF.game.treeReady()), 'äppelträdet har mogna äpplen');
await shot('05-villa');
const apA = await D(() => SF.game.skafferi.applR | 0);
await D(() => SF.scene._debug.act('trad'));
await sleep(150);
const apB = await D(() => SF.game.skafferi.applR | 0);
ok(apB - apA >= 3 && apB - apA <= 5, `äppelträdet gav ${apB - apA} äpplen`);
ok(!(await D(() => SF.game.treeReady())), 'sedan är det tomt ett tag');
await D(() => SF.scene._debug.act('trad'));
await sleep(100);
ok(/mognar om 3 dagar/.test(await lastToast()), 'trädet säger när nästa skörd är');
await D(() => { SF.game.sleep(); SF.game.sleep(); SF.game.sleep(); });
ok(await D(() => SF.game.treeReady()), 'tre dagar senare: nya äpplen');
for (const [home, n] of [['husvagn', 3], ['takvaning', 4]]) {
  await start(SAVE(home));
  await D(() => SF.go('tradgard'));
  await sleep(600);
  ok((await D(() => SF.scene._debug.kind())) === home && (await beds()).length === n, `${home}: ${n} bäddar`);
  await D(() => SF.scene._debug.act('badd0'));
  await until(() => !!document.querySelector('#modal [data-gr]'));
  await D(() => document.querySelector('#modal [data-gr="tomat"]').click());
  await sleep(200);
  ok((await beds())[0].b?.g === 'tomat', `${home}: tomater sådda`);
  ok(!(await D(() => SF.scene._debug.spot('trad'))), `${home}: inget äppelträd`);
  await shot('06-' + home);
}
// takvåningen: in genom terrassdörren och ut genom ytterdörren → "Terrassen"
await D(() => SF.scene._debug.act('dorr'));
await until(() => SF.sceneName === 'room');
await sleep(400);
await outDoor();
ok(await until(() => /Terrassen/.test(document.querySelector('#modal')?.innerText || '')), 'takvåningen: ytterdörren erbjuder Terrassen');
await clickBtn(/Ut i stan/);
ok(await until(() => SF.sceneName === 'city'), '"Ut i stan" går ut i stan');

// ---------- 7. lägenheten: ingen uteplats ----------
await start(SAVE('lagenhet'));
ok(!(await D(() => SF.game.garden())), 'lägenheten har ingen trädgård');
await outDoor();
ok(await until(() => SF.sceneName === 'city'), 'lägenheten: ytterdörren går rakt ut i stan');
ok(!(await modalTitle()), 'ingen fråga om trädgården');
// robotar utan ?tradgard går också rakt ut (de andra testerna förlitar sig på det)
await start(SAVE('radhus'), '');
await outDoor();
ok(await until(() => SF.sceneName === 'city'), 'utan ?tradgard går testroboten rakt ut i stan');

ok(!errs.length, `inga fel i konsolen${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLA OK');
process.exit(fails ? 1 : 0);
