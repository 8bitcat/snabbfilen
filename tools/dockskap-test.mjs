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
ok(await p.evaluate(() => document.body.classList.contains('dock-on') && !document.getElementById('dock-panel').classList.contains('hidden')), 'lådan syns, body.dock-on');
const rooms = await dbg('d.rooms()');
ok(rooms.length === 5 && rooms[4].id === 'badrum', `fem rum, badrummet sist (${rooms.map((r) => r.id).join(', ')})`);
const seed0 = await dbg('d.deco(0).length');
ok(seed0 >= 5, `startmöbleringen i vardagsrummet: ${seed0} möbler`);
ok(await p.$$eval('#dock-panel .dock-item', (els) => els.length) >= 20, 'lådan: vardagsrumsfliken har minst 20 möbler');
ok(await p.$$eval('#dock-panel [data-flik]', (els) => els.length) === 11, 'lådan: elva flikar');
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
ok(saved && saved.natt === true && saved.rooms?.length === 5 && saved.rooms[1].deco.some((d) => d.k === 'soffa'), 'sparat i snabbfilen_dockskap (natt + soffan i köket)');
await p.click('#dock-panel [data-ut]');
await p.waitForTimeout(600);
ok(await p.evaluate(() => document.body.classList.contains('menu-open') && !document.body.classList.contains('dock-on')), '⬅ Tillbaka: huvudmenyn igen, lådan borta');
// samma hus efter omladdning
await p.reload(); await p.waitForFunction(() => !!document.querySelector('#menu [data-dockskap]'), null, { timeout: 30000 });
await p.click('#menu [data-dockskap]');
await p.waitForFunction(() => window.SF?.sceneName === 'dockskap' && !!window.SF.scene?._debug?.rooms, null, { timeout: 15000 });
await p.waitForTimeout(300);
ok((await dbg("d.deco(1).some((d) => d.k === 'soffa')")) && (await dbg('d.natt()')) === true, 'efter omladdning: soffan i köket och natten kvar');

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
