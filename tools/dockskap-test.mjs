// 🧸 Dockskåpet (js/scenes/dockskap.js): menyvalet, huset med fem rum, lådan, dra-och-släpp,
// bordsskivor, menyn för en möbel, natt, sparningen och vägen tillbaka.
//   node tools/dockskap-test.mjs          (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || '8788';
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 900, height: 600 } });
const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
const dbg = (expr) => p.evaluate(`(() => { const d = window.SF.scene._debug; return (${expr}); })()`);

// ---------- 1. huvudmenyn har knappen, och den öppnar Dockskåpet utan att spelet startar ----------
await p.goto(`http://localhost:${PORT}/index.html?menu&world=dock${Date.now().toString(36)}`);
await p.evaluate(() => { localStorage.clear(); });
await p.reload(); await p.waitForFunction(() => !!document.querySelector('#menu [data-dockskap]'), null, { timeout: 30000 });
ok(await p.$eval('#menu [data-dockskap]', (el) => /Dockskåpet/.test(el.textContent)), 'huvudmenyn: knappen 🧸 Dockskåpet');
await p.click('#menu [data-dockskap]');
await p.waitForFunction(() => window.SF?.sceneName === 'dockskap' && !!window.SF.scene?._debug?.rooms, null, { timeout: 15000 });
await p.waitForTimeout(600);
ok(await p.evaluate(() => window.SF.scene.dockskap === true), 'scenen är dockskap (spelklockan står still)');
// huset öppnas i Leka (v0.166): lådan är borta, de två stora knapparna syns; Bygga tar fram lådan
ok((await dbg('d.lage()')) === 'leka' && await p.evaluate(() => document.body.classList.contains('dock-on') && document.body.classList.contains('dock-leka') && document.getElementById('dock-panel').classList.contains('hidden')), 'huset öppnas i Leka: lådan är undan, body.dock-leka');
ok(await p.$$eval('#dock-lage [data-lage]', (els) => els.length === 2 && els[0].classList.contains('on') && /Leka/.test(els[0].textContent) && /Bygga/.test(els[1].textContent)), 'två stora knappar: 🧸 Leka (vald) och 🔨 Bygga');
ok(await p.$$eval('#dock-lage .dl-sma .btn', (els) => els.length === 2 && getComputedStyle(els[0].parentElement).display === 'flex'), 'i Leka ligger 🌙 och ⬅ bredvid knapparna');
await p.click('#dock-lage [data-lage="bygga"]'); await p.waitForTimeout(300);
ok((await dbg('d.lage()')) === 'bygga' && await p.evaluate(() => document.body.classList.contains('dock-bygga') && !document.getElementById('dock-panel').classList.contains('hidden')), 'Bygga: lådan syns, body.dock-bygga');
const rooms = await dbg('d.rooms()');
ok(rooms.length === 8 && rooms[4].id === 'badrum' && rooms[5].id === 'tradgard' && rooms[6].id === 'slott' && rooms[7].id === 'rymd', `åtta rum: badrummet, sedan 🌳 trädgården, 🏰 slottsvåningen och 🚀 rymdstationen (${rooms.map((r) => r.id).join(', ')})`);
const seed0 = await dbg('d.deco(0).length');
ok(seed0 >= 5, `startmöbleringen i vardagsrummet: ${seed0} möbler`);
ok(await p.$$eval('#dock-panel .dock-item', (els) => els.length) >= 20, 'lådan: vardagsrumsfliken har minst 20 möbler');
ok(await p.$$eval('#dock-panel [data-flik]', (els) => els.length) === 17, 'lådan: sjutton flikar (figurer, djur, saker, teman + elva möbelflikar + 🏆 Priser + ⚽ KBK)');
await p.click('#dock-panel [data-flik="vagg"]'); await p.waitForTimeout(100);
ok(await p.$$eval('#dock-panel .dock-item', (els) => els.length) >= 25, 'väggfliken: minst 25 väggsaker');
ok(await p.evaluate(() => getComputedStyle(document.getElementById('hud-money')).display === 'none'), 'spelets mätare (pengar) är dolda');

// ---------- 2. ställa ut, dra, släppa ----------
ok(await dbg("d.place('soffa', 0, 40, 200)"), 'place: en soffa i vardagsrummet');
const n0 = await dbg('d.deco(0).length');
const idx = n0 - 1;
const sp = await dbg(`d.spot(0, ${idx})`);
ok(!!sp && sp.x > 0 && sp.y > 0, `möbelns skärmläge (${sp?.x | 0}, ${sp?.y | 0})`);
await p.evaluate(([x, y]) => window.SF.scene.down(x, y), [sp.x, sp.y]);
const lifted = await dbg('d.drag()');
ok(lifted && lifted.idx === idx && !lifted.moved, 'tryck på möbeln lyfter den (inte flyttad än)');
for (let k = 1; k <= 8; k++) await p.evaluate(([x, y]) => window.SF.scene.move(x, y), [sp.x + 10 * k, sp.y - 2 * k]);
const ghost = await dbg('d.drag()');
ok(ghost && ghost.moved && ghost.groom === 0, `spöket följer med (rum ${ghost?.groom}, x ${ghost?.gx})`);
await p.evaluate(([x, y]) => window.SF.scene.up(x, y), [sp.x + 80, sp.y - 16]);
await p.waitForTimeout(100);
const after = await dbg(`d.deco(0)[${idx}]`);
ok(after && after.x > 40 + 60, `släppt: soffan flyttad till x ${after?.x}`);
ok(await p.evaluate(() => document.getElementById('modal').classList.contains('hidden')), 'ingen meny efter en dragning');

// kort tryck = menyn
const sp2 = await dbg(`d.spot(0, ${idx})`);
await p.evaluate(([x, y]) => { window.SF.scene.down(x, y); window.SF.scene.up(x, y); }, [sp2.x, sp2.y]);
await p.waitForTimeout(150);
ok(await p.evaluate(() => !document.getElementById('modal').classList.contains('hidden') && /Soffa/.test(document.querySelector('#modal h2')?.textContent || '')), 'kort tryck öppnar menyn för soffan');
const knappar = await p.$$eval('#modal .dlg-foot .btn', (els) => els.map((e) => e.textContent));
ok(knappar.some((t) => /Vrid/.test(t)) && knappar.some((t) => /Byt modell/.test(t)) && knappar.some((t) => /Färg/.test(t)) && knappar.some((t) => /Ta bort/.test(t)), `menyn: ${knappar.join(' · ')}`);
await p.click('#modal .dlg-foot .btn:has-text("Vrid")'); await p.waitForTimeout(100);
ok((await dbg(`d.deco(0)[${idx}].r`)) === 1, 'Vrid: rotationen blev 1');
await p.click('#modal .dlg-foot .btn:has-text("Byt modell")'); await p.waitForTimeout(100);
ok((await dbg(`d.deco(0)[${idx}].v`)) === 1, 'Byt modell: varianten blev 1');
await p.click('#modal .dlg-foot .btn:has-text("Stäng")'); await p.waitForTimeout(100);

// ---------- 3. dra till ett annat rum (köket ligger till höger om vardagsrummet) ----------
await dbg('d.goRoom(0)');
const sp3 = await dbg(`d.spot(0, ${idx})`);
await p.evaluate(([x, y]) => window.SF.scene.down(x, y), [sp3.x, sp3.y]);
for (let k = 1; k <= 10; k++) await p.evaluate(([x, y]) => window.SF.scene.move(x, y), [sp3.x + 8 * k, sp3.y]);
// bilden rullar med när man drar mot kanten – vänta några bildrutor
await p.waitForTimeout(900);
await p.evaluate(() => { const d = window.SF.scene._debug.drag(); window.SF.scene.move(window.SF.W - 10, 170); return d; });
await p.waitForTimeout(1200);
const g2 = await dbg('d.drag()');
await p.evaluate(() => window.SF.scene.up(window.SF.W - 10, 170));
await p.waitForTimeout(100);
ok(g2 && g2.groom === 1, `dragen mot kanten rullade bilden in i köket (rum ${g2?.groom}, kamera ${(await dbg('d.cam()')) | 0})`);
ok((await dbg('d.deco(0).length')) === n0 - 1 && (await dbg("d.deco(1).some((d) => d.k === 'soffa')")), 'soffan står nu i köket');

// ---------- 4. småsaker ställs på bordsskivan ----------
await dbg('d.goRoom(1)');
const bordIdx = await dbg("d.deco(1).findIndex((d) => d.k === 'bordM')");
const bord = await dbg(`d.deco(1)[${bordIdx}]`);
ok(bordIdx >= 0, `matbordet i köket (x ${bord?.x}, y ${bord?.y})`);
const cam1 = await dbg('d.cam()');
const ox1 = rooms[1].ox;
// dra en tårta från lådan: spöket landar på skivan när pekaren är över bordet
await p.evaluate(() => window.SF.scene._debug.arm('tarta'));
await p.evaluate(([x, y]) => window.SF.scene.down(x, y), [bord.x + 20 + ox1 - cam1, bord.y - 6]);
await p.waitForTimeout(100);
const tarta = await dbg("d.deco(1).find((d) => d.k === 'tarta')");
ok(tarta && tarta.up > 0 && tarta.y === bord.y + 1, `tårtan står uppe på skivan (up ${tarta?.up}, y ${tarta?.y})`);
// tar man bort bordet hamnar tårtan på golvet
await dbg(`d.remove(1, ${bordIdx})`);
const tarta2 = await dbg("d.deco(1).find((d) => d.k === 'tarta')");
ok(tarta2 && !(tarta2.up > 0), 'bordet borta: tårtan står på golvet');

// ---------- 5. natt, sparning, tillbaka ----------
await p.click('#dock-panel [data-natt]'); await p.waitForTimeout(500);
ok(await dbg('d.natt()') === true, '🌙 Natt är på');
const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('snabbfilen_dockskap') || 'null'));
ok(saved && saved.natt === true && saved.rooms?.length === 8 && saved.rooms[1].deco.some((d) => d.k === 'soffa'), 'sparat i snabbfilen_dockskap (natt + soffan i köket, sju rum)');
await p.click('#dock-panel [data-ut]');
await p.waitForTimeout(600);
ok(await p.evaluate(() => document.body.classList.contains('menu-open') && !document.body.classList.contains('dock-on')), '⬅ Tillbaka: huvudmenyn igen, lådan borta');
// samma hus efter omladdning
await p.reload(); await p.waitForFunction(() => !!document.querySelector('#menu [data-dockskap]'), null, { timeout: 30000 });
await p.click('#menu [data-dockskap]');
await p.waitForFunction(() => window.SF?.sceneName === 'dockskap' && !!window.SF.scene?._debug?.rooms, null, { timeout: 15000 });
await p.waitForTimeout(300);
ok((await dbg("d.deco(1).some((d) => d.k === 'soffa')")) && (await dbg('d.natt()')) === true, 'efter omladdning: soffan i köket och natten kvar');

// ---------- 5b. figurerna (v0.163) ----------
await p.click('#dock-panel [data-flik="figurer"]'); await p.waitForTimeout(150);
const gang = await dbg('d.gang()');
ok(gang.length >= 6 && gang.some((g) => g.id === 'bot0'), `gänget: ${gang.length} figurer (sex bottar)`);
ok(await p.$$eval('#dock-panel .dock-fig', (els) => els.length) === gang.length, 'figurfliken visar hela gänget med porträtt');
const dolls0 = await dbg('d.dolls()');
ok(dolls0.length === 2 && dolls0.every((d) => d.room === 0), 'två bottar står i vardagsrummet från början');
ok(await p.$$eval('#dock-panel .dock-fig.on', (els) => els.length) === 2, 'de två är markerade i lådan');
await dbg('d.goRoom(0)');
ok(await dbg("d.placeDoll('bot2', 0, 60, 200)"), 'placeDoll: bot2 ställs i vardagsrummet');
const soffa = await dbg("d.deco(0).find((x) => x.k === 'soffa')");
const spD = await dbg("d.spotDoll('bot2')");
await p.evaluate(([x, y]) => window.SF.scene.down(x, y), [spD.x, spD.y]);
ok((await dbg('d.drag()'))?.typ === 'docka', 'tryck på figuren lyfter den');
const cam0 = await dbg('d.cam()');
// greppet sitter 20 px över fötterna (spotDoll) – släpp så att FÖTTERNA hamnar på sätet
const grepp = 200 - spD.y;
const tx = soffa.x + 14 + rooms[0].ox - cam0, ty = soffa.y - 4 - grepp;
for (let k = 1; k <= 8; k++) await p.evaluate(([x, y]) => window.SF.scene.move(x, y), [spD.x + (tx - spD.x) * k / 8, spD.y + (ty - spD.y) * k / 8]);
await p.evaluate(([x, y]) => window.SF.scene.up(x, y), [tx, ty]);
await p.waitForTimeout(100);
const bot2 = (await dbg('d.dolls()')).find((d) => d.id === 'bot2');
ok(bot2 && bot2.sitter, `släppt på soffan: bot2 sitter (x ${bot2?.x}, y ${bot2?.y})`);
const spD2 = await dbg("d.spotDoll('bot2')");
await p.evaluate(([x, y]) => { window.SF.scene.down(x, y); window.SF.scene.up(x, y); }, [spD2.x, spD2.y]);
await p.waitForTimeout(150);
ok(await p.evaluate(() => !document.getElementById('modal').classList.contains('hidden') && /🧑/.test(document.querySelector('#modal h2')?.textContent || '')), 'kort tryck öppnar figurens meny');
await p.click('#modal .dlg-foot .btn:has-text("Prata")'); await p.waitForTimeout(100);
ok(await dbg('d.talking()'), '💬 Prata: en pratbubbla syns');
const fras = await dbg("d.prata('bot0')");
ok(typeof fras === 'string' && fras.length > 2, `prata() ger en fras: "${fras}"`);
ok((await dbg("d.removeDoll('bot2')")) && (await dbg('d.dolls()')).length === 2, 'Till lådan: bot2 är borta ur huset');
await p.waitForTimeout(400);
ok(await p.evaluate(() => (JSON.parse(localStorage.getItem('snabbfilen_dockskap')).dockor || []).length === 2), 'figurerna sparas i huset');

// ---------- 5c. husdjuren (v0.163) ----------
await p.click('#dock-panel [data-flik="djur"]'); await p.waitForTimeout(200);
ok(await p.$$eval('#dock-panel [data-ras]', (els) => els.length) >= 25, 'djurfliken: alla raser (katt, hund, kanin)');
ok(await p.$$eval('#dock-panel [data-pryl]', (els) => els.length) === 14, 'djurfliken: fjorton prylar');
await dbg('d.goRoom(0)');
const katt = await dbg("d.placePet('katt', 'tigrerad', 0, 200, 190)");
ok(!!katt, `placePet: en tigrerad katt i vardagsrummet (${katt})`);
await p.waitForTimeout(300);
const pets1 = await dbg('d.pets()');
ok(pets1.length === 1 && pets1[0].room === 0 && typeof pets1[0].name === 'string' && pets1[0].name.length > 0, `katten bor i huset och har ett namn (${pets1[0]?.name})`);
ok((await dbg('d.layer(0).pets()')).length === 1, 'lagret i vardagsrummet har katten');
ok(await p.$$eval('#dock-panel .dock-hemma', (els) => els.length) === 1, 'lådan visar katten under I huset');
const spK = await dbg(`d.spotPet('${katt}')`);
const kattFore = (await dbg('d.layer(0).pets()'))[0];
await p.evaluate(([x, y]) => window.SF.scene.down(x, y), [spK.x, spK.y]);
ok((await dbg('d.drag()'))?.typ === 'djur', 'tryck på katten lyfter den');
for (let k = 1; k <= 8; k++) await p.evaluate(([x, y]) => window.SF.scene.move(x, y), [spK.x + 6 * k, spK.y]);
await p.evaluate(([x, y]) => window.SF.scene.up(x, y), [spK.x + 48, spK.y]);
await p.waitForTimeout(250);
const kattEfter = (await dbg('d.layer(0).pets()'))[0];
ok(kattEfter && Math.abs(kattEfter.x - (kattFore.x + 48)) <= 10, `dragen 48 px åt höger: katten står vid x ${kattEfter?.x | 0} (förut ${kattFore.x | 0})`);
ok(await dbg(`d.movePet('${katt}', 1, 150, 180)`), 'movePet: katten till köket');
await p.waitForTimeout(250);
ok((await dbg('d.pets()'))[0].room === 1 && (await dbg('d.layer(1).pets()')).length === 1 && (await dbg('d.layer(0).pets()')).length === 0, 'katten bytte lager: i köket, inte i vardagsrummet');
await dbg('d.goRoom(1)');
const skal = await dbg("d.placePetItem('matskal', 1, 100, 200)");
ok(!!skal, 'placePetItem: en matskål i köket');
const spS = await dbg(`d.spotPetItem('${skal}')`);
await p.evaluate(([x, y]) => window.SF.scene.down(x, y), [spS.x, spS.y]);
ok((await dbg('d.drag()'))?.typ === 'pryl', 'tryck på skålen lyfter den');
for (let k = 1; k <= 8; k++) await p.evaluate(([x, y]) => window.SF.scene.move(x, y), [spS.x + 5 * k, spS.y]);
await p.evaluate(([x, y]) => window.SF.scene.up(x, y), [spS.x + 40, spS.y]);
await p.waitForTimeout(100);
const skal2 = (await dbg('d.petItems()')).find((it) => it.id === skal);
ok(skal2 && skal2.x === 140 && skal2.room === 1, `skålen flyttad till x ${skal2?.x}`);
const spK2 = await dbg(`d.spotPet('${katt}')`);
await p.evaluate(([x, y]) => { window.SF.scene.down(x, y); window.SF.scene.up(x, y); }, [spK2.x, spK2.y]);
await p.waitForTimeout(150);
ok(await p.evaluate(() => !document.getElementById('modal').classList.contains('hidden') && /Klappa/.test(document.querySelector('#modal .dlg-foot')?.textContent || '')), 'kort tryck på katten: menyn med Klappa');
await p.click('#modal .dlg-foot .btn:has-text("Klappa")'); await p.waitForTimeout(100);
ok(await p.evaluate(() => JSON.parse(localStorage.getItem('snabbfilen_dockskap_pets') || 'null')?.pets?.length === 1), 'djuren sparas i snabbfilen_dockskap_pets');
ok((await dbg(`d.removePet('${katt}')`)) && (await dbg('d.pets()')).length === 0, 'Till lådan: katten är borta');

// ---------- 5d. lösa saker (v0.164) ----------
await p.click('#dock-panel [data-flik="saker"]'); await p.waitForTimeout(300);
ok(await p.$$eval('#dock-panel [data-sak][data-slag="leksak"]', (els) => els.length) >= 45, 'sakfliken: alla leksaker ur leksaksaffären');
ok(await p.$$eval('#dock-panel [data-sak][data-slag="mat"]', (els) => els.length) >= 40, 'sakfliken: alla råvaror ur mataffären');
const saker0 = await dbg('d.saker()');
ok(saker0.length >= 3 && saker0.some((s) => s.room === 2 && s.slag === 'leksak'), `startsakerna: ${saker0.length} (leksaker i barnrummet)`);
await dbg('d.goRoom(0)');
const nalle = await dbg("d.placeSak('leksak', 'nalle-liten', 0, 60, 205)");
ok(!!nalle, `placeSak: en liten nalle på vardagsrumsgolvet (${nalle})`);
const bord0 = await dbg("d.deco(0).find((x) => x.k === 'soffbord')");
ok(await dbg(`d.moveSak('${nalle}', 0, ${bord0.x + 12}, ${bord0.y - 5})`), 'moveSak: nallen upp på soffbordet');
const nalle2 = (await dbg('d.saker()')).find((s) => s.id === nalle);
ok(nalle2 && nalle2.up > 0 && nalle2.y === bord0.y + 1, `nallen står på skivan (up ${nalle2?.up}, y ${nalle2?.y})`);
// dra nallen till en figur: hon håller den
const spN = await dbg(`d.spotSak('${nalle}')`);
await p.evaluate(([x, y]) => window.SF.scene.down(x, y), [spN.x, spN.y]);
ok((await dbg('d.drag()'))?.typ === 'sak', 'tryck på nallen lyfter den');
const spB0 = await dbg("d.spotDoll('bot0')");
for (let k = 1; k <= 8; k++) await p.evaluate(([x, y]) => window.SF.scene.move(x, y), [spN.x + (spB0.x - spN.x) * k / 8, spN.y + (spB0.y - spN.y) * k / 8]);
ok((await dbg('d.drag()'))?.mal?.id === 'bot0', 'spöket över figuren: hon får den när man släpper');
await p.evaluate(([x, y]) => window.SF.scene.up(x, y), [spB0.x, spB0.y]);
await p.waitForTimeout(100);
ok((await dbg("d.heldBy('bot0')")) === nalle, 'släppt på figuren: bot0 håller nallen');
const spB0b = await dbg("d.spotDoll('bot0')");
await p.evaluate(([x, y]) => { window.SF.scene.down(x, y); window.SF.scene.up(x, y); }, [spB0b.x, spB0b.y]);
await p.waitForTimeout(150);
ok(await p.evaluate(() => /Lägg ner/.test(document.querySelector('#modal .dlg-foot')?.textContent || '')), 'figurens meny har 🧸 Lägg ner');
await p.click('#modal .dlg-foot .btn:has-text("Lägg ner")'); await p.waitForTimeout(100);
const nalle3 = (await dbg('d.saker()')).find((s) => s.id === nalle);
ok(!(await dbg("d.heldBy('bot0')")) && nalle3 && !nalle3.hos && nalle3.room === 0, 'Lägg ner: nallen ligger på golvet igen');
// mat till en figur äts upp
const banan = await dbg("d.placeSak('mat', 'banan', 0, 300, 205)");
ok((await dbg(`d.giveSak('${banan}', 'docka', 'bot1')`)) && (await dbg("d.heldBy('bot1')")) === banan && (await dbg(`d.eating('${banan}')`)) > 0, 'giveSak: bot1 äter bananen');
await p.waitForTimeout(5200);
ok(!(await dbg('d.saker()')).some((s) => s.id === banan) && (await dbg('d.talking()')), 'efter fem sekunder: bananen uppäten – "Mums!"');
// till ett djur: leksaken vid tassarna, maten uppäten, djuret glatt
const katt2 = await dbg("d.placePet('katt', 'svart', 0, 150, 200)");
await p.waitForTimeout(200);
const boll = await dbg("d.placeSak('leksak', 'boll-fot', 0, 60, 205)");
ok(await dbg(`d.giveSak('${boll}', 'djur', '${katt2}')`), 'giveSak: bollen till katten');
const kattA = (await dbg('d.layer(0).pets()')).find((a) => a.id === katt2);
const boll2 = (await dbg('d.saker()')).find((s) => s.id === boll);
ok(kattA && kattA.pose === 'happy' && boll2 && Math.abs(boll2.x - (kattA.x + 12)) <= 6, `katten blev glad (${kattA?.pose}) och bollen ligger vid tassarna (x ${boll2?.x}, katten ${kattA?.x | 0})`);
const morot = await dbg("d.placeSak('mat', 'morot', 0, 60, 205)");
await dbg(`d.giveSak('${morot}', 'djur', '${katt2}')`);
ok(!(await dbg('d.saker()')).some((s) => s.id === morot), 'moroten till katten: uppäten');
ok((await dbg(`d.removeSak('${boll}')`)) && !(await dbg('d.saker()')).some((s) => s.id === boll), 'removeSak: bollen borta');
await p.waitForTimeout(400);
ok(await p.evaluate(() => (JSON.parse(localStorage.getItem('snabbfilen_dockskap')).saker || []).some((s) => s.k === 'nalle-liten')), 'sakerna sparas i huset');
await dbg(`d.removePet('${katt2}')`);

// ---------- 5e. teman (v0.165) ----------
await dbg('d.goRoom(0)');
await p.click('#dock-panel [data-flik="teman"]'); await p.waitForTimeout(300);
const nT = async (sel) => p.$$eval(`#dock-panel ${sel}`, (els) => els.length);
ok((await nT('[data-tapet]')) >= 12 && (await nT('[data-golv]')) >= 12 && (await nT('[data-utsikt]')) >= 7 && (await nT('[data-tema]')) >= 8, `temafliken: ${await nT('[data-tapet]')} tapeter, ${await nT('[data-golv]')} golv, ${await nT('[data-utsikt]')} utsikter, ${await nT('[data-tema]')} färdiga teman`);
ok(await p.evaluate(() => /vardagsrum/i.test(document.querySelector('#dock-items .dock-rubrik')?.textContent || '')), 'fliken gäller rummet i bild (vardagsrummet)');
const vagg0 = await dbg('d.pixel(0, 192, 40)'), golv0 = await dbg('d.pixel(0, 192, 190)');
await p.click('#dock-panel [data-tapet="marin"]'); await p.waitForTimeout(300);
const vagg1 = await dbg('d.pixel(0, 192, 40)');
ok((await dbg('d.tema(0)')).tapet === 'marin' && vagg1 !== vagg0, `tapeten Marinblå: väggen bytte färg (${vagg0} → ${vagg1})`);
await p.click('#dock-panel [data-golv="schack"]'); await p.waitForTimeout(300);
const golv1 = await dbg('d.pixel(0, 192, 190)');
ok((await dbg('d.tema(0)')).golv === 'schack' && golv1 !== golv0, `golvet Schackrutigt: golvet bytte färg (${golv0} → ${golv1})`);
await p.click('#dock-panel [data-utsikt="stad"]'); await p.waitForTimeout(300);
ok((await dbg('d.tema(0)')).utsikt === 'stad', 'utsikten Staden vald');
await p.click('#dock-panel [data-tema="skogen"]'); await p.waitForTimeout(300);
const tema0 = await dbg('d.tema(0)');
ok(tema0.tapet === 'skog' && tema0.golv === 'gras' && tema0.utsikt === 'landet', `färdiga temat Skogen: ${JSON.stringify(tema0)}`);
ok((await nT('[data-tema="skogen"].on')) === 1, 'Skogen är markerat i lådan');
await p.click('#dock-panel [data-tapet=""]'); await p.waitForTimeout(300);
ok(!(await dbg('d.tema(0)')).tapet && (await dbg('d.pixel(0, 192, 40)')) === vagg0, 'Rummets egen: väggen är som från början igen');
// badrummet: kakel i stället för tapet och golv – fliken ritas om när kameran står i ett annat rum
await dbg('d.goRoom(4)'); await p.waitForTimeout(500);
ok((await dbg('d.roomInView()')) === 4 && (await nT('[data-kakel]')) === 6 && (await nT('[data-tapet]')) === 0 && await p.evaluate(() => /badrum/i.test(document.querySelector('#dock-items .dock-rubrik')?.textContent || '')), 'badrummet i bild: sex kakelstilar, inga tapeter');
const kak0 = await dbg('d.pixel(4, 192, 40)');
await p.click('#dock-panel [data-kakel="skiffer"]'); await p.waitForTimeout(300);
const kak1 = await dbg('d.pixel(4, 192, 40)');
ok((await dbg('d.tema(4)')).kakel === 'skiffer' && kak1 !== kak0, `kaklet Skiffer: badrumsväggen bytte färg (${kak0} → ${kak1})`);
await p.waitForTimeout(400);
ok(await p.evaluate(() => { const h = JSON.parse(localStorage.getItem('snabbfilen_dockskap')); return h.rooms[0].tema?.golv === 'gras' && h.rooms[4].tema?.kakel === 'skiffer'; }), 'temana sparas i huset');
await p.click('#dock-panel [data-flik="vardagsrum"]'); await p.waitForTimeout(100);

// ---------- 5f. leka och bygga (v0.166): i Leka svarar allt man trycker på, möblerna står fast ----------
await dbg('d.goRoom(0)'); await p.waitForTimeout(200);
// möblerna att trycka på: ett piano, en brödrost och lampan ur startmöbleringen; soffan med bot2 på
ok(await dbg("d.place('piano', 0, 300, 200)") && await dbg("d.place('brodrost', 0, 20, 205)"), 'Leka-förberedelse: ett piano och en brödrost i vardagsrummet');
const iPiano = await dbg("d.findDeco(0, 'piano')"), iRost = await dbg("d.findDeco(0, 'brodrost')"), iLampa = await dbg("d.findDeco(0, 'lampa')"), iSoffa = await dbg("d.findDeco(0, 'soffa')");
ok(iPiano >= 0 && iRost >= 0 && iLampa >= 0 && iSoffa >= 0, `möblerna finns (piano ${iPiano}, brödrost ${iRost}, lampa ${iLampa}, soffa ${iSoffa})`);
await p.click('#dock-lage [data-lage="leka"]'); await p.waitForTimeout(300);
ok((await dbg('d.lage()')) === 'leka' && await p.evaluate(() => document.getElementById('dock-panel').classList.contains('hidden') && JSON.parse(localStorage.getItem('snabbfilen_dockskap')).lage === 'leka'), 'Leka igen: lådan undan, läget sparat i huset');
const tryck = async (sx, sy) => { await p.evaluate(([x, y]) => { window.SF.scene.down(x, y); window.SF.scene.up(x, y); }, [sx, sy]); await p.waitForTimeout(80); };
// pianot spelar en melodi: noter stiger, ingen meny
const spP = await dbg(`d.spot(0, ${iPiano})`);
await tryck(spP.x, spP.y);
const sen1 = await dbg('d.senaste()');
ok(sen1?.typ === 'deco' && /^piano:\d+/.test(sen1.k) && sen1.ljud === 'melodi' && (await dbg('d.fx(0, "not")')) >= 5 && (await dbg('d.anims()')).includes(`deco:0:${iPiano}`), `pianot: melodi (${sen1?.k}), ${await dbg('d.fx(0, "not")')} noter, animation`);
ok(await p.evaluate(() => document.getElementById('modal').classList.contains('hidden')), 'ingen meny öppnas i Leka');
// brödrosten poppar två skivor
const spR = await dbg(`d.spot(0, ${iRost})`);
await tryck(spR.x, spR.y);
ok((await dbg('d.senaste()'))?.ljud === 'toast' && (await dbg('d.fx(0, "rost")')) === 2, 'brödrosten: två brödskivor poppar upp');
// lampan tänds och släcks
const spL = await dbg(`d.spot(0, ${iLampa})`);
await tryck(spL.x, spL.y);
ok((await dbg(`d.lit(0, ${iLampa})`)) === true && (await dbg('d.senaste()')).k === 'lampa:tand', 'lampan tänds med ett tryck');
await tryck(spL.x, spL.y);
ok((await dbg(`d.lit(0, ${iLampa})`)) === false, 'och släcks med nästa');
// soffan studsar – och figuren som sitter i den hoppar
const soffaD = await dbg(`d.deco(0)[${iSoffa}]`);
await dbg(`d.placeDoll('bot2', 0, ${soffaD.x + 10}, ${soffaD.y - 2})`);
ok((await dbg('d.dolls()')).find((d) => d.id === 'bot2')?.sitter === true, 'bot2 sitter i soffan (vänstra delen)');
const spSof0 = await dbg(`d.spot(0, ${iSoffa})`), spSof = { x: spSof0.x + 14, y: spSof0.y };   // (högra delen av soffan – inte på figuren)
await tryck(spSof.x, spSof.y);
const an = await dbg('d.anims()');
ok((await dbg('d.senaste()')).ljud === 'boing' && an.includes(`deco:0:${iSoffa}`) && an.includes('docka:bot2'), `soffan studsar och bot2 som sitter där hoppar (${an.join(', ')})`);
// ett drag på en möbel flyttar den inte i Leka – det panorerar
const sofX = (await dbg(`d.deco(0)[${iSoffa}]`)).x, kam0 = await dbg('d.cam()');
await p.evaluate(([x, y]) => window.SF.scene.down(x, y), [spSof.x, spSof.y]);
for (let k = 1; k <= 8; k++) await p.evaluate(([x, y]) => window.SF.scene.move(x, y), [spSof.x - 10 * k, spSof.y]);
await p.evaluate(([x, y]) => window.SF.scene.up(x, y), [spSof.x - 80, spSof.y]);
await p.waitForTimeout(100);
ok((await dbg(`d.deco(0)[${iSoffa}]`)).x === sofX && (await dbg('d.cam()')) !== kam0 && !(await dbg('d.drag()')), `i Leka står soffan fast (x ${sofX}) och draget panorerade (kamera ${kam0 | 0} → ${(await dbg('d.cam()')) | 0})`);
await dbg('d.goRoom(0)');
// figuren hoppar och säger något
const spB = await dbg("d.spotDoll('bot0')");
await tryck(spB.x, spB.y);
ok((await dbg('d.anims()')).includes('docka:bot0') && await dbg('d.talking()') && (await dbg('d.senaste()')).typ === 'docka', 'figuren bot0: hoppar och säger något');
// djuret blir kärleksfullt
const katt3 = await dbg("d.placePet('katt', 'svart', 0, 60, 200)");
await p.waitForTimeout(200);
const spKatt3 = await dbg(`d.spotPet('${katt3}')`);
await tryck(spKatt3.x, spKatt3.y);
const kattPos = (await dbg('d.layer(0).pets()')).find((q) => q.id === katt3)?.pose;
ok((await dbg('d.senaste()')).typ === 'djur' && (kattPos === 'love' || kattPos === 'happy') && (await dbg('d.fx(0, "hjarta")')) >= 1, `katten: ${kattPos} med hjärtan`);
// bollen studsar, bilen tutar (barnrummet)
await dbg('d.goRoom(2)'); await p.waitForTimeout(400);
const spBoll = await dbg("d.spotSak('s3')"), spBil = await dbg("d.spotSak('s2')");
await tryck(spBoll.x, spBoll.y);
ok((await dbg('d.senaste()')).ljud === 'boing' && (await dbg('d.anims()')).includes('sak:s3'), 'bollen studsar');
await tryck(spBil.x, spBil.y);
ok((await dbg('d.senaste()')).ljud === 'honk' && (await dbg('d.anims()')).includes('sak:s2'), 'bilen tutar och kör');
ok((await dbg('d.reaktioner()')) >= 9, `${await dbg('d.reaktioner()')} reaktioner räknade`);
await p.click('#dock-lage [data-lage="bygga"]'); await p.waitForTimeout(300);
await dbg('d.goRoom(0)');
const spS2 = await dbg(`d.spot(0, ${iSoffa})`);
await tryck(spS2.x, spS2.y); await p.waitForTimeout(150);
ok(await p.evaluate(() => !document.getElementById('modal').classList.contains('hidden')), 'i Bygga öppnar trycket menyn igen');
await p.click('#modal .dlg-foot .btn:has-text("Stäng")'); await p.waitForTimeout(100);
await dbg(`d.removePet('${katt3}')`);

// ---------- 5g. belysningen (v0.167): ljusfärg, discokula, jultema, släckbar julbelysning ----------
await dbg('d.goRoom(0)');
const spL2 = await dbg(`d.spot(0, ${iLampa})`);
await tryck(spL2.x, spL2.y); await p.waitForTimeout(150);
const knL = await p.$$eval('#modal .dlg-foot .btn', (els) => els.map((e) => e.textContent));
ok(knL.some((t) => /💡 (Tänd|Släck)/.test(t)) && knL.some((t) => /Ljus: Varmt/.test(t)), `lampans meny i Bygga: ${knL.filter((t) => /Tänd|Släck|Ljus/.test(t)).join(' · ')}`);
await p.click('#modal .dlg-foot .btn:has-text("Ljus:")'); await p.waitForTimeout(150);
ok((await dbg(`d.deco(0)[${iLampa}]`)).ljus === 'vit' && (await dbg(`d.lit(0, ${iLampa})`)) === true && await p.evaluate(() => /Ljus: Vitt/.test(document.querySelector('#modal')?.textContent || '')), 'Ljus: nästa färg är Vitt och lampan tänds');
await p.click('#modal .dlg-foot .btn:has-text("Stäng")'); await p.waitForTimeout(100);
ok((await dbg(`d.setLjus(0, ${iLampa}, 'rosa')`)) === 'rosa' && (await dbg('d.ljusfarger')).length === 7, 'setLjus: rosa – sju ljusfärger');
ok(await dbg("d.place('discokula', 0, 180, 60)"), 'place: discokulan hänger i taket');
const iDisko = await dbg("d.findDeco(0, 'discokula')");
ok(iDisko >= 0 && (await dbg(`d.deco(0)[${iDisko}]`)).y <= 83 && (await dbg(`d.deco(0)[${iDisko}]`)).y >= 34, `discokulan finns på väggen (idx ${iDisko}, y ${(await dbg(`d.deco(0)[${iDisko}]`)).y})`);
await p.click('#dock-lage [data-lage="leka"]'); await p.waitForTimeout(300);
const spDk = await dbg(`d.spot(0, ${iDisko})`);
await tryck(spDk.x, spDk.y);
ok((await dbg(`d.lit(0, ${iDisko})`)) === true && (await dbg('d.disco(0)')) === true && (await dbg('d.senaste()')).ljud === 'disco', 'tryck i Leka: discokulan igång (disco-ljud, figurerna dansar)');
await tryck(spDk.x, spDk.y);
ok((await dbg(`d.lit(0, ${iDisko})`)) === false && (await dbg('d.disco(0)')) === false, 'tryck igen: stopp');
await p.click('#dock-lage [data-lage="bygga"]'); await p.waitForTimeout(300);
await p.click('#dock-panel [data-flik="teman"]'); await p.waitForTimeout(300);
ok((await p.$$eval('#dock-panel [data-tema]', (els) => els.length)) === 9 && (await p.$$eval('#dock-panel [data-tema="jul"]', (els) => els.length)) === 1, 'temafliken: nio färdiga teman, 🎄 Jul finns');
await p.click('#dock-panel [data-tema="jul"]'); await p.waitForTimeout(300);
const temaJul = await dbg('d.tema(0)');
ok(temaJul.tapet === 'korsbar' && temaJul.golv === 'morkek' && (await dbg("d.deco(0).some((d) => d.k === 'kulgran')")) && (await dbg("d.deco(0).some((d) => d.k === 'ljusgirlang')")), 'temat Jul: röd tapet, mörkt golv, gran och girlang framställda');
const iGirl = await dbg("d.findDeco(0, 'ljusgirlang')");
await p.click('#dock-lage [data-lage="leka"]'); await p.waitForTimeout(300);
const spG = await dbg(`d.spot(0, ${iGirl})`);
await tryck(spG.x, spG.y);
ok((await dbg(`d.deco(0)[${iGirl}]`)).slackt === true && (await dbg('d.senaste()')).k === 'ljusgirlang:slack', 'girlangen släcks med ett tryck');
await tryck(spG.x, spG.y);
ok(!(await dbg(`d.deco(0)[${iGirl}]`)).slackt, 'och tänds igen');
await p.waitForTimeout(400);
ok(await p.evaluate(() => { const h = JSON.parse(localStorage.getItem('snabbfilen_dockskap')); return h.rooms[0].deco.some((d) => d.k === 'lampa' && d.ljus === 'rosa' && d.lit) && h.rooms[0].deco.some((d) => d.k === 'discokula'); }), 'ljusfärgen och discokulan sparas i huset');
await p.click('#dock-lage [data-lage="bygga"]'); await p.waitForTimeout(200);
await p.click('#dock-panel [data-flik="vardagsrum"]'); await p.waitForTimeout(100);

// ---------- 5h. 🌳 trädgården (v0.172): låst tills den är köpt, sedan utesakerna, säten, årstider ----------
ok((await dbg('d.locked(5)')) === true && (await dbg('d.deco(5).length')) >= 5 && await p.$eval('#dock-panel [data-rum="5"]', (el) => /🔒/.test(el.textContent)), `trädgården är låst från början men möblerad (${await dbg('d.deco(5).length')} saker), rumsknappen visar 🔒`);
ok((await p.$$eval('#dock-panel [data-flik]', (els) => els.length)) === 17 && !(await p.$('#dock-panel [data-flik="tradgard"]')), 'ingen trädgårdsflik i lådan när rummet inte är köpt');
ok(!(await dbg("d.place('parasoll', 5, 100, 200)")) && await p.evaluate(() => !document.getElementById('modal').classList.contains('hidden') && /Trädgården/.test(document.querySelector('#modal h2')?.textContent || '')), 'ställa något i det låsta rummet: nej – rutan "🌳 Trädgården" öppnas i stället');
ok(await p.evaluate(() => /Finns att köpa i appen/.test(document.querySelector('#modal')?.textContent || '')), 'på webben: "Finns att köpa i appen Pixelcity"');
await p.click('#modal .dlg-foot .btn:has-text("Stäng")'); await p.waitForTimeout(100);
await dbg('d.goRoom(5)'); await p.waitForTimeout(500);
await p.evaluate(([x, y]) => { window.SF.scene.down(x, y); window.SF.scene.up(x, y); }, [200, 150]); await p.waitForTimeout(150);
ok(await p.evaluate(() => !document.getElementById('modal').classList.contains('hidden') && /Trädgården/.test(document.querySelector('#modal h2')?.textContent || '')), 'ett tryck i det låsta rummet öppnar samma ruta');
await p.click('#modal .dlg-foot .btn:has-text("Stäng")'); await p.waitForTimeout(100);
// köpt (testet låser upp direkt; i appen skriver kop.js snabbfilen_kop.dock)
await dbg("d.unlock('tradgard')"); await p.waitForTimeout(200);
ok((await dbg('d.locked(5)')) === false && (await p.$$eval('#dock-panel [data-flik]', (els) => els.length)) === 18 && await p.$eval('#dock-panel [data-rum="5"]', (el) => /🌳/.test(el.textContent)), 'upplåst: 🌳 på rumsknappen och trädgårdsfliken i lådan');
await p.click('#dock-panel [data-flik="tradgard"]'); await p.waitForTimeout(200);
ok((await p.$$eval('#dock-panel .dock-item', (els) => els.length)) >= 10 && await p.$eval('#dock-panel .dock-item[data-k="pool"] canvas', (c) => c.width > 10), 'trädgårdsfliken: minst tio utesaker med miniatyrer (poolen)');
ok(await dbg("d.place('parasoll', 5, 100, 200)") && await dbg("d.place('studsmatta', 5, 200, 200)"), 'parasollet och studsmattan ställs ut');
const iGunga = await dbg("d.findDeco(5, 'gunga')"), iTrad = await dbg("d.findDeco(5, 'appeltrad')"), iGrill = await dbg("d.findDeco(5, 'grill')"), iMatta = await dbg("d.findDeco(5, 'studsmatta')");
const gungaD = await dbg(`d.deco(5)[${iGunga}]`);
ok(await dbg(`d.placeDoll('bot4', 5, ${gungaD.x + 24}, ${gungaD.y - 2})`) && (await dbg('d.dolls()')).find((d) => d.id === 'bot4')?.sitter === true && (await dbg('d.dolls()')).find((d) => d.id === 'bot4').ry < gungaD.y - 10, 'bot4 sitter på gungans säte (högre upp än marken)');
await p.click('#dock-lage [data-lage="leka"]'); await p.waitForTimeout(300);
const tryckU = async (i, idx, dx = 0) => { const s = await dbg(`d.spot(5, ${idx})`); await p.evaluate(([x, y]) => { window.SF.scene.down(x, y); window.SF.scene.up(x, y); }, [s.x + dx, s.y]); await p.waitForTimeout(80); };
await tryckU(5, iTrad);
ok((await dbg('d.senaste()'))?.k === 'appeltrad' && (await dbg('d.fx(5, "apple")')) >= 3 && (await dbg('d.fx(5, "lov")')) >= 4, 'äppelträdet: äpplen och löv faller');
await tryckU(5, iGrill);
ok((await dbg(`d.deco(5)[${iGrill}]`)).lit === true && (await dbg('d.senaste()')).ljud === 'sizzle' && (await dbg('d.fx(5, "rok")')) >= 6, 'grillen tänds och ryker');
await tryckU(5, iGunga, -14);
ok((await dbg('d.anims()')).includes(`deco:5:${iGunga}`) && (await dbg('d.anims()')).includes('docka:bot4'), 'gungan gungar och bot4 på sätet hoppar till');
const iPool = await dbg("d.findDeco(5, 'pool')");
await tryckU(5, iPool);
ok((await dbg('d.senaste()')).ljud === 'splash' && (await dbg('d.fx(5, "bubbla")')) >= 8, 'poolen plaskar');
// årstiden i temafliken: vinter = vit gräsmatta
await p.click('#dock-lage [data-lage="bygga"]'); await p.waitForTimeout(300);
await p.click('#dock-panel [data-flik="teman"]'); await p.waitForTimeout(300);
ok((await p.$$eval('#dock-panel [data-arstid]', (els) => els.length)) === 3 && (await p.$$eval('#dock-panel [data-tapet]', (els) => els.length)) === 0, 'temafliken i trädgården: tre årstider, inga tapeter');
const gras0 = await dbg('d.pixel(5, 192, 180)');
await p.click('#dock-panel [data-arstid="vinter"]'); await p.waitForTimeout(300);
const gras1 = await dbg('d.pixel(5, 192, 180)');
const lum = (h) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
ok((await dbg('d.tema(5)')).arstid === 'vinter' && gras1 !== gras0 && lum(gras1) > lum(gras0) + 60, `vinter: gräsmattan blev snövit, ljusare (${gras0} → ${gras1}${await dbg('d.natt()') ? ', natt' : ''})`);
await p.click('#dock-panel [data-arstid="sommar"]'); await p.waitForTimeout(200);
await dbg("d.removeDoll('bot4')"); await dbg('d.goRoom(0)');
// ---------- 5i. 🏰 slottsvåningen (v0.173): andra köpbara rummet – tron, fontän, drake, facklor, kristallkronan lyser ----------
ok((await dbg('d.locked(6)')) === true && (await dbg('d.deco(6).length')) >= 8 && (await p.$$eval('#dock-panel [data-flik]', (els) => els.length)) === 18, `slottsvåningen är låst och möblerad (${await dbg('d.deco(6).length')} saker), ingen slottsflik än`);
await dbg("d.unlock('slott')"); await p.waitForTimeout(200);
ok((await dbg('d.locked(6)')) === false && (await p.$$eval('#dock-panel [data-flik]', (els) => els.length)) === 19 && await p.$eval('#dock-panel [data-rum="6"]', (el) => /🏰/.test(el.textContent)), 'upplåst: 🏰 på rumsknappen och slottsfliken i lådan');
await p.click('#dock-panel [data-flik="slott"]'); await p.waitForTimeout(200);
ok((await p.$$eval('#dock-panel .dock-item', (els) => els.length)) >= 10 && await p.$eval('#dock-panel .dock-item[data-k="drake"] canvas', (c) => c.width > 10), 'slottsfliken: minst tio saker med miniatyrer (draken)');
await dbg('d.goRoom(6)'); await p.waitForTimeout(400);
ok(await dbg("d.place('himmelssang', 6, 100, 206)") && await dbg("d.place('riddarskold', 6, 300, 60)"), 'himmelssängen och riddarskölden ställs ut');   // (sängen till vänster – inte framför fontänen)
const iTron = await dbg("d.findDeco(6, 'tron')"), iFont = await dbg("d.findDeco(6, 'fontan')"), iDrake = await dbg("d.findDeco(6, 'drake')"), iFack = await dbg("d.findDeco(6, 'fackla')"), iKrona = await dbg("d.findDeco(6, 'kristallkrona')");
const tronD = await dbg(`d.deco(6)[${iTron}]`);
ok(await dbg(`d.placeDoll('bot4', 6, ${tronD.x + 15}, ${tronD.y - 2})`) && (await dbg('d.dolls()')).find((d) => d.id === 'bot4')?.sitter === true, 'bot4 sitter på tronen');
await p.click('#dock-lage [data-lage="leka"]'); await p.waitForTimeout(300);
const tryckS = async (idx, dx = 0) => { const s = await dbg(`d.spot(6, ${idx})`); await p.evaluate(([x, y]) => { window.SF.scene.down(x, y); window.SF.scene.up(x, y); }, [s.x + dx, s.y]); await p.waitForTimeout(80); };
await tryckS(iFont);
ok((await dbg('d.senaste()'))?.k === 'fontan' && (await dbg('d.senaste()')).ljud === 'splash' && (await dbg('d.fx(6, "bubbla")')) >= 8, 'fontänen plaskar');
await tryckS(iDrake);
ok((await dbg('d.senaste()')).ljud === 'bu' && (await dbg('d.fx(6, "rok")')) >= 6, 'draken ryker ur näsborrarna');
await tryckS(iFack);
ok((await dbg(`d.deco(6)[${iFack}]`)).lit === true && (await dbg('d.senaste()')).k === 'fackla:tand', 'facklan tänds');
await tryckS(iKrona);
ok((await dbg('d.senaste()')).ljud === 'pling' && (await dbg('d.fx(6, "gnista")')) >= 8, 'kristallkronan glittrar');
await p.click('#dock-lage [data-lage="bygga"]'); await p.waitForTimeout(300);
await p.click('#dock-panel [data-flik="teman"]'); await p.waitForTimeout(300);
ok((await p.$$eval('#dock-panel [data-arstid]', (els) => els.length)) === 0 && (await p.$$eval('#dock-panel [data-tapet]', (els) => els.length)) === 0 && await p.evaluate(() => /eget utseende/.test(document.querySelector('#dock-items')?.textContent || '')), 'temafliken i slottet: inget att byta, bara en förklaring');
await dbg("d.removeDoll('bot4')"); await dbg('d.goRoom(0)');
await p.click('#dock-panel [data-flik="vardagsrum"]'); await p.waitForTimeout(100);

// ---------- 5j. 🚀 rymdstationen (v0.181): tredje köpbara rummet – raket, kontrollbord, robot, sovkapsel, planetlampan lyser ----------
ok((await dbg('d.locked(7)')) === true && (await dbg('d.deco(7).length')) >= 8 && (await p.$$eval('#dock-panel [data-flik]', (els) => els.length)) === 19, `rymdstationen är låst och möblerad (${await dbg('d.deco(7).length')} saker, låst ${await dbg('d.locked(7)')}, ${await p.$$eval('#dock-panel [data-flik]', (els) => els.map((e) => e.dataset.flik).join('/'))}), ingen rymdflik än`);
await dbg("d.unlock('rymd')"); await p.waitForTimeout(200);
ok((await dbg('d.locked(7)')) === false && (await p.$$eval('#dock-panel [data-flik]', (els) => els.length)) === 20 && await p.$eval('#dock-panel [data-rum="7"]', (el) => /🚀/.test(el.textContent)), 'upplåst: 🚀 på rumsknappen och rymdfliken i lådan');
await p.click('#dock-panel [data-flik="rymd"]'); await p.waitForTimeout(200);
ok((await p.$$eval('#dock-panel .dock-item', (els) => els.length)) >= 12 && await p.$eval('#dock-panel .dock-item[data-k="raket"] canvas', (c) => c.width > 10), 'rymdfliken: tolv saker med miniatyrer (raketen)');
await dbg('d.goRoom(7)'); await p.waitForTimeout(400);
ok(await dbg("d.place('utomjording', 7, 230, 200)") && await dbg("d.place('manesten', 7, 260, 200)"), 'utomjordingen och månstenen ställs ut');
const iRak = await dbg("d.findDeco(7, 'raket')"), iKont = await dbg("d.findDeco(7, 'kontrollbord')"), iRob = await dbg("d.findDeco(7, 'robot')"), iKap = await dbg("d.findDeco(7, 'sovkapsel')");
const kapD = await dbg(`d.deco(7)[${iKap}]`);
ok(await dbg(`d.placeDoll('bot4', 7, ${kapD.x + 28}, ${kapD.y - 2})`) && (await dbg('d.dolls()')).find((d) => d.id === 'bot4')?.sitter === true, 'bot4 lägger sig i sovkapseln');
await p.click('#dock-lage [data-lage="leka"]'); await p.waitForTimeout(300);
const tryckR = async (idx) => { const s = await dbg(`d.spot(7, ${idx})`); await p.evaluate(([x, y]) => { window.SF.scene.down(x, y); window.SF.scene.up(x, y); }, [s.x, s.y]); await p.waitForTimeout(80); };
await tryckR(iRak);
ok((await dbg('d.senaste()'))?.k === 'raket' && (await dbg('d.fx(7, "rok")')) >= 6, 'raketen lyfter och ryker');
await tryckR(iKont);
ok((await dbg('d.senaste()')).ljud === 'pling' && (await dbg('d.fx(7, "gnista")')) >= 6, 'kontrollbordet blinkar och plingar');
await tryckR(iRob);
ok((await dbg('d.senaste()')).ljud === 'pop' && (await dbg('d.fx(7, "hjarta")')) >= 3, 'roboten piper och sprider hjärtan');
await p.click('#dock-lage [data-lage="bygga"]'); await p.waitForTimeout(300);
await dbg("d.removeDoll('bot4')"); await dbg('d.goRoom(0)');
await p.click('#dock-panel [data-flik="vardagsrum"]'); await p.waitForTimeout(100);

// ---------- 5j. ⚽🏆 KBK-hörnan och priserna (v0.174): flikarna, vitrinskåpets hyllor, namn och nummer, skyltdockan vrids, Leka ----------
ok((await p.$$eval('#dock-panel [data-flik="priser"], #dock-panel [data-flik="kbk"]', (els) => els.length)) === 2 && (await dbg('d.kbkSyns()')) === true, 'lådan har flikarna 🏆 Priser och ⚽ KBK (på svenska)');
await p.click('#dock-panel [data-flik="priser"]'); await p.waitForTimeout(200);
ok((await p.$$eval('#dock-panel .dock-item', (els) => els.length)) >= 13 && await p.$eval('#dock-panel .dock-item[data-k="vitrinskap"] canvas', (c) => c.width > 10), 'prisfliken: minst tretton saker med miniatyrer (vitrinskåpet)');
await p.click('#dock-panel [data-flik="kbk"]'); await p.waitForTimeout(200);
ok((await p.$$eval('#dock-panel .dock-item', (els) => els.length)) >= 10 && await p.$eval('#dock-panel .dock-item[data-k="kbk-troja"] canvas', (c) => c.width > 10), 'KBK-fliken: minst tio saker (matchtröjan)');
// vitrinskåpet i badrummet (inga andra bord där): pokalen på översta hyllan, lagbilden i mitten, bollen längst ner – hyllan närmast pekaren
await dbg('d.goRoom(4)'); await p.waitForTimeout(300);
ok(await dbg("d.placeAt('vitrinskap', 4, 300, 205)"), 'vitrinskåpet ställs i badrummet');
const iSkap = await dbg("d.findDeco(4, 'vitrinskap')"), skap = await dbg(`d.deco(4)[${iSkap}]`);
ok(await dbg(`d.placeAt('pokal-silver', 4, ${skap.x + 12}, ${skap.y - 50})`) && await dbg(`d.placeAt('kbk-lagbild', 4, ${skap.x + 39}, ${skap.y - 25})`) && await dbg(`d.placeAt('kbk-boll', 4, ${skap.x + 27}, ${skap.y - 3})`), 'silverpokalen, lagbilden och bollen ställs i skåpet');
const iPok = await dbg("d.findDeco(4, 'pokal-silver')"), pok = await dbg(`d.deco(4)[${iPok}]`), lb = await dbg("d.deco(4)[d.findDeco(4, 'kbk-lagbild')]"), bl = await dbg("d.deco(4)[d.findDeco(4, 'kbk-boll')]");
ok(pok.up === 53 && lb.up === 29 && bl.up === 5 && pok.y === skap.y + 1 && pok.x >= skap.x + 5 && pok.x + 16 <= skap.x + 49, `hyllorna: pokalen överst (up ${pok.up}), lagbilden i mitten (${lb.up}), bollen nederst (${bl.up}), innanför glaset`);
// tröjan och skyltdockan får namn och nummer (ingen avstämning: figurens förnamn och 10), byts, och skyltdockan vrids
ok(await dbg("d.place('kbk-troja', 4, 20, 80)") && await dbg("d.place('kbk-mannekang', 4, 160, 205)"), 'matchtröjan på väggen och skyltdockan på golvet');
const iTr = await dbg("d.findDeco(4, 'kbk-troja')"), iMan = await dbg("d.findDeco(4, 'kbk-mannekang')"), tr = await dbg(`d.deco(4)[${iTr}]`);
ok(tr.sp && tr.sp.n === 10 && typeof tr.sp.namn === 'string' && tr.sp.namn.length > 0, `tröjan bär namn och nummer (${tr.sp?.namn} ${tr.sp?.n})`);
const nySp = await dbg(`d.setSp(4, ${iTr}, 34, 'Julia')`);
ok(nySp && nySp.n === 34 && nySp.namn === 'Julia' && (await dbg(`d.deco(4)[${iTr}]`)).sp.n === 34, 'namn och nummer byts: Julia 34');
ok((await dbg(`d.setSp(4, ${iTr}, 0, '')`)) === null, 'tomt namn eller nummer 0 avvisas');
ok(await dbg(`d.rotate(4, ${iMan})`) && (await dbg(`d.deco(4)[${iMan}]`)).r === 1 && await dbg(`d.rotate(4, ${iMan})`) && !(await dbg(`d.deco(4)[${iMan}]`)).r, 'skyltdockan vrids: framsidan, sedan ryggen igen');
// Leka: pokalen i skåpet, tröjan och medaljen svarar
await dbg("d.place('medalj-guld', 4, 100, 60)");
const iMed = await dbg("d.findDeco(4, 'medalj-guld')");
await p.click('#dock-lage [data-lage="leka"]'); await p.waitForTimeout(300);
const tryckK = async (idx) => { const s = await dbg(`d.spot(4, ${idx})`); await p.evaluate(([x, y]) => { window.SF.scene.down(x, y); window.SF.scene.up(x, y); }, [s.x, s.y]); await p.waitForTimeout(80); };
await tryckK(iPok);
ok((await dbg('d.senaste()'))?.k === 'pokal-silver' && (await dbg('d.senaste()')).ljud === 'pling' && (await dbg('d.fx(4, "gnista")')) >= 5, 'pokalen i skåpet glittrar när man trycker på den');
await tryckK(iTr);
ok((await dbg('d.senaste()'))?.k === 'kbk-troja' && (await dbg('d.senaste()')).ljud === 'shake', 'tröjan svajar');
await tryckK(iMed);
ok((await dbg('d.senaste()'))?.k === 'medalj-guld' && (await dbg('d.senaste()')).ljud === 'ding', 'medaljen pinglar');
await p.click('#dock-lage [data-lage="bygga"]'); await p.waitForTimeout(300);
// skåpet tas bort → det som stod i det står på golvet; namn och nummer följer med i sparningen
await dbg(`d.remove(4, ${iSkap})`); await p.waitForTimeout(500);
ok(!(await dbg("d.deco(4)[d.findDeco(4, 'pokal-silver')]")).up && !(await dbg("d.deco(4)[d.findDeco(4, 'kbk-boll')]")).up, 'utan skåpet står pokalen och bollen på golvet');
const sparatK = await p.evaluate(() => JSON.parse(localStorage.getItem('snabbfilen_dockskap')));
ok(sparatK.rooms[4].deco.some((d) => d.k === 'kbk-troja' && d.sp && d.sp.n === 34 && d.sp.namn === 'Julia'), 'huset sparas med tröjans namn och nummer');

// ---------- 5k. saker på saker (v0.175): nallen på sängen, stolen på sängen, bollen på stolen; basen flyttas och tas bort ----------
while ((await dbg('d.deco(4).length')) > 0) await dbg('d.remove(4, 0)');   // (badrummet töms så inget annat fångar sakerna)
ok(await dbg("d.place('sang', 4, 60, 200)"), 'badrummet tomt, en säng ställs på golvet');
const iSangK = await dbg("d.findDeco(4, 'sang')"), sangK = await dbg(`d.deco(4)[${iSangK}]`);
const nalleIdK = await dbg(`d.placeSak('leksak', 'nalle-mellan', 4, ${sangK.x + 16}, ${sangK.y - 15})`);
const nalleK = await dbg(`d.saker().find((s) => s.id === '${nalleIdK}')`);
ok(nalleK && nalleK.up > 0 && nalleK.up < 34 && nalleK.y === sangK.y + 1, `nallen ligger uppe på sängen (up ${nalleK?.up})`);
ok(await dbg(`d.placeAt('stol', 4, ${sangK.x + 16}, ${sangK.y - 15})`), 'stolen ställs på sängen');
const iStolK = await dbg("d.findDeco(4, 'stol')"), stolK = await dbg(`d.deco(4)[${iStolK}]`);
ok(stolK.up > 0 && stolK.y === sangK.y + 1 && stolK.x >= sangK.x && stolK.x + 13 <= sangK.x + 33, `stolen står på sängen (up ${stolK.up})`);
ok(await dbg(`d.placeAt('basketboll', 4, ${stolK.x + 6}, ${stolK.y - stolK.up - 10})`), 'bollen ställs på stolen');
const iBollK = await dbg("d.findDeco(4, 'basketboll')"), bollK = await dbg(`d.deco(4)[${iBollK}]`);
ok(bollK.up > stolK.up && bollK.y === stolK.y + 1 && bollK.x >= stolK.x && bollK.x + 8 <= stolK.x + 13, `bollen står på stolen på sängen (up ${bollK.up})`);
// sängen bär från madrassen upp till karmen: gosedjuret släppt högre upp ligger högre upp
ok(await dbg(`d.placeAt('gosedjur', 4, ${sangK.x + 6}, ${sangK.y - 28})`), 'gosedjuret läggs högre upp på sängen');
const gosK = await dbg("d.deco(4)[d.findDeco(4, 'gosedjur')]");
ok(gosK.y === sangK.y + 1 && gosK.up > stolK.up && gosK.up <= 32, `gosedjuret ligger där det släpptes (up ${gosK.up}, stolen ${stolK.up})`);
// sängen dras åt höger: stolen och bollen följer med (samma höjder), nallen (lös sak) läggs på golvet
const spSK = await dbg(`d.spot(4, ${iSangK})`);
await p.evaluate(([x, y]) => window.SF.scene.down(x, y), [spSK.x, spSK.y]);
ok((await dbg('d.drag()'))?.idx === iSangK, 'trycket mitt på sängen lyfter sängen, inte stolen');
for (let k = 1; k <= 6; k++) await p.evaluate(([x, y]) => window.SF.scene.move(x, y), [spSK.x + 10 * k, spSK.y]);
await p.evaluate(([x, y]) => window.SF.scene.up(x, y), [spSK.x + 60, spSK.y]); await p.waitForTimeout(100);
const sangK2 = await dbg(`d.deco(4)[${iSangK}]`), stolK2 = await dbg(`d.deco(4)[${iStolK}]`), bollK2 = await dbg(`d.deco(4)[${iBollK}]`);
ok(sangK2.x > sangK.x + 30 && !sangK2.up, `sängen flyttad till x ${sangK2.x}`);
ok(stolK2.x === sangK2.x + (stolK.x - sangK.x) && stolK2.y === sangK2.y + 1 && stolK2.up === stolK.up && bollK2.x === sangK2.x + (bollK.x - sangK.x) && bollK2.y === sangK2.y + 2 && bollK2.up === bollK.up, 'stolen och bollen följde med sängen, på samma höjder');
const nalleK2 = await dbg(`d.saker().find((s) => s.id === '${nalleIdK}')`);
ok(nalleK2 && !nalleK2.up && nalleK2.room === 4, 'nallen följer inte med – den ligger på golvet');
// sängen tas bort: stolen står på golvet, bollen står kvar på stolen (lägre nu)
await dbg(`d.remove(4, ${iSangK})`); await p.waitForTimeout(200);
const stolK3 = await dbg("d.deco(4)[d.findDeco(4, 'stol')]"), bollK3 = await dbg("d.deco(4)[d.findDeco(4, 'basketboll')]");
ok(!stolK3.up && bollK3.up === bollK.up - stolK.up && bollK3.y === stolK3.y + 1, `utan sängen står stolen på golvet och bollen kvar på stolen (up ${bollK3.up})`);
// för brett får inte plats: enkelsängen (18) går inte på stolen (13) – den hamnar på golvet
ok(await dbg(`d.placeAt('enkelsang', 4, ${stolK3.x + 6}, ${stolK3.y - 10})`) && !(await dbg("d.deco(4)[d.findDeco(4, 'enkelsang')]")).up, 'enkelsängen är bredare än stolen – står på golvet');
await p.waitForTimeout(400);   // (sparningen är fördröjd 300 ms)
const sparatS = await p.evaluate(() => JSON.parse(localStorage.getItem('snabbfilen_dockskap')));
ok(sparatS.rooms[4].deco.some((d) => d.k === 'basketboll' && d.up > 0), 'huset sparas med bollen uppe på stolen');
await dbg('d.goRoom(0)'); await p.click('#dock-panel [data-flik="vardagsrum"]'); await p.waitForTimeout(100);

// ---------- 6. från pausmenyn mitt i spelet: tillbaka till rummet ----------
await p.goto(`http://localhost:${PORT}/index.html?world=dock${Date.now().toString(36)}`);
await p.evaluate(() => { localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Docka', look: {}, color: '#e04848' })); localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 600, money: 500, hunger: 80, energy: 80, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false })); });
await p.reload(); await p.waitForFunction(() => !!window.SF?.game && window.SF.sceneName === 'room', null, { timeout: 30000 });
await p.evaluate(() => window.SF.openDockskap());
await p.waitForFunction(() => window.SF?.sceneName === 'dockskap' && !!window.SF.scene?._debug?.rooms, null, { timeout: 15000 });
await p.waitForTimeout(300);
const minFore = await p.evaluate(() => window.SF.game.min);
await p.waitForTimeout(1500);
ok((await p.evaluate(() => window.SF.game.min)) === minFore, `spelklockan står still i Dockskåpet (${minFore.toFixed(1)})`);
await p.evaluate(() => window.SF.leaveDockskap());
await p.waitForTimeout(400);
ok(await p.evaluate(() => window.SF.sceneName === 'room' && !document.body.classList.contains('menu-open')), 'från pausmenyn: tillbaka till rummet, inte menyn');

console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga pageerror');
await b.close(); console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT'); process.exit(fails ? 1 : 0);
