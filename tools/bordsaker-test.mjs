// SMÅSAKER PÅ BORD: i Möblera-läget ställs en småsak (dator, bordslampa, brödrost …) som hålls
// över en bordsskiva uppe på skivan (posten får up), två saker får inte stå i varandra, datorn på
// skrivbordet går att använda, bordet tar med sig sakerna när det flyttas, allt finns kvar efter
// en omladdning – och läggs bordet i förrådet hamnar sakerna på golvet där det stod.
//   node tools/bordsaker-test.mjs          (servern på 8788; annan port: SMOKE_PORT=8791)
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
page.on('console', (m) => m.type() === 'error' && !/peer|ERR_|Failed to load resource/i.test(m.text()) && errors.push(m.text()));
const KEY = 'villa:0';
await page.goto(`http://localhost:${PORT}/index.html?world=bord${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Inredare', look: {}, color: '#e04848' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 1, min: 600, money: 100, hunger: 80, energy: 80, home: 'villa', fridge: {}, jobs: {}, earned: 0, wardrobe: [],
    storage: [{ k: 'skrivbord', v: 0 }, { k: 'laptop', v: 0 }, { k: 'bordslampa', v: 0 }, { k: 'brodrost', v: 0 }], deco: {}, won: false }));
});
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
const enterRoom = async () => {
  await page.evaluate(() => { window.SF.roomSub = 0; window.SF.go('room'); });
  await page.waitForTimeout(900);
  // atlasen måste vara laddad för att skivans höjd ska kunna mätas
  await page.waitForFunction(() => window.SF.scene._debug?.surfaceUp && true, null, { timeout: 10000 });
};
await enterRoom();
await page.evaluate(() => window.SF.scene.toggleDecor?.(true));
await page.waitForTimeout(200);
const D = (fn, arg) => page.evaluate(([src, a]) => (0, eval)(src)(window.SF.scene._debug, window.SF.game, a), [fn.toString(), arg]);
const deco = () => page.evaluate((k) => (window.SF.game.deco[k] || []).map((d) => ({ ...d })), KEY);
const storageIdx = (k) => page.evaluate((k) => window.SF.game.storage.findIndex((it) => it.k === k), k);

// 1) skrivbordet ut på golvet (första lediga plats nere i rummet)
await D((d, g, i) => d.pickStorage(i), await storageIdx('skrivbord'));
const spot = await D((d) => { for (let y = 190; y > 120; y -= 4) for (let x = 60; x < 300; x += 4) if (d.canPlace(x, y)) return { x, y }; return null; });
ok(!!spot, `en ledig plats för skrivbordet (${spot?.x},${spot?.y})`);
await page.evaluate(([x, y]) => { window.SF.scene.move(x, y); window.SF.scene.down(x, y); }, [spot.x, spot.y]);
let list = await deco();
const deskI = list.findIndex((d) => d.k === 'skrivbord');
let desk = list[deskI];
ok(!!desk && !desk.up, `skrivbordet står på golvet (${desk?.x},${desk?.y})`);
const up = await D((d, g, i) => d.surfaceUp(i), deskI);
ok(up > 3 && up < 30, `skivans höjd mätt ur bilden: sakerna står ${up} px upp`);

// 2) datorn ställs på skrivbordet: pekaren över skivan → posten får up och står på bordet
await D((d, g, i) => d.pickStorage(i), await storageIdx('laptop'));
const onDesk = (dx) => [desk.x + dx, desk.y - 12];
let pf = await D((d, g, a) => d.placeFor(a[0], a[1]), onDesk(8));
ok(pf && pf.up === up && pf.y === desk.y + 1, `över skivan hamnar datorn på bordet (y ${pf?.y}, up ${pf?.up})`);
ok(await D((d, g, a) => d.canPlace(a[0], a[1]), onDesk(8)), 'det går att ställa den där (grön linje)');
await page.evaluate(([x, y]) => { window.SF.scene.move(x, y); window.SF.scene.down(x, y); }, onDesk(8));
list = await deco();
const pc = list.find((d) => d.k === 'laptop');
ok(pc && pc.up === up && pc.y === desk.y + 1, `datorn står på skrivbordet (x ${pc?.x}, up ${pc?.up})`);
let riders = await D((d) => d.riders());
ok(riders.length === 1 && riders[0].on === deskI, 'rummet vet att datorn står på skrivbordet');

// 3) bordslampan: inte i datorn, men bredvid den på samma skiva
await D((d, g, i) => d.pickStorage(i), await storageIdx('bordslampa'));
ok(!(await D((d, g, a) => d.canPlace(a[0], a[1]), [pc.x + 8, desk.y - 12])), 'lampan får inte stå i datorn (röd linje)');
const lampX = desk.x + 26;
ok(await D((d, g, a) => d.canPlace(a[0], a[1]), [lampX, desk.y - 12]), 'bredvid datorn går det bra');
await page.evaluate(([x, y]) => { window.SF.scene.move(x, y); window.SF.scene.down(x, y); }, [lampX, desk.y - 12]);
list = await deco();
ok(list.filter((d) => d.up > 0).length === 2, 'två saker på skrivbordet');
ok(await D((d) => d.allFit()), 'allt står rätt enligt rummets egen kontroll');

// 4) brödrosten på golvet (utanför bordet) blir en vanlig golvsak
await D((d, g, i) => d.pickStorage(i), await storageIdx('brodrost'));
const floorSpot = await D((d, g, desk) => { for (let y = 196; y > 120; y -= 4) for (let x = 40; x < 330; x += 4) { const p = d.placeFor(x, y); if (!p.up && d.canPlace(x, y)) return { x, y }; } return null; }, desk);
await page.evaluate(([x, y]) => { window.SF.scene.move(x, y); window.SF.scene.down(x, y); }, [floorSpot.x, floorSpot.y]);
list = await deco();
ok(list.find((d) => d.k === 'brodrost' && !d.up), 'brödrosten utanför bordet står på golvet');
await page.evaluate(() => window.SF.scene.toggleDecor?.(false));

// 5) datorn på bordet går att använda (klickytan är bilden, man går fram till bordets framkant)
const props = await D((d) => d.props());
const pcProp = props.find((p) => p.k === 'laptop');
ok(pcProp && !pcProp.solid && pcProp.hit && pcProp.fn === 'tv', 'datorn har ingen golvyta men en klickyta och funktionen TV/dator');
const shot1 = 'tools/out/bordsaker.png';
await page.locator('#scene').screenshot({ path: shot1 }).catch(() => {});

// 6) flytta skrivbordet: sakerna följer med
await page.evaluate(() => window.SF.scene.toggleDecor?.(true));
list = await deco();
desk = list.find((d) => d.k === 'skrivbord');
const before = list.filter((d) => d.up > 0).map((d) => ({ k: d.k, dx: d.x - desk.x }));
await D((d, g, i) => d.pick(i), list.findIndex((d) => d.k === 'skrivbord'));
const spot2 = await D((d, g, desk) => { for (let y = 196; y > 120; y -= 4) for (let x = 40; x < 330; x += 4) if (Math.abs(x - desk.x) > 50 && d.canPlace(x, y)) return { x, y }; return null; }, desk);
ok(!!spot2, `en ny plats för skrivbordet (${spot2?.x},${spot2?.y})`);
await page.evaluate(([x, y]) => { window.SF.scene.move(x, y); window.SF.scene.down(x, y); }, [spot2.x, spot2.y]);
list = await deco();
const desk2 = list.find((d) => d.k === 'skrivbord');
const after = list.filter((d) => d.up > 0);
ok(desk2.x !== desk.x && after.length === 2 && after.every((d) => d.y === desk2.y + 1 && before.some((b) => b.k === d.k && d.x - desk2.x === b.dx)),
  `skrivbordet flyttat (${desk.x} → ${desk2.x}) – datorn och lampan följde med på samma ställen`);

// 7) omladdning: sakerna står kvar på bordet
await page.evaluate(() => window.SF.game.save());
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await enterRoom();
list = await deco();
ok(list.filter((d) => d.up > 0).length === 2 && (await D((d) => d.allFit())), 'efter omladdningen står datorn och lampan kvar på skrivbordet');

// 8) skrivbordet i förrådet: sakerna ner på golvet där bordet stod
await page.evaluate(() => window.SF.scene.toggleDecor?.(true));
// ett riktigt klick på bordets nederkant (under sakerna) plockar upp bordet – knapparna vaknar
const deskNow = list.find((d) => d.k === 'skrivbord');
await page.evaluate(([x, y]) => { window.SF.scene.down(x, y); window.SF.scene.up(x, y); }, [deskNow.x + 3, deskNow.y - 2]);
ok(await page.evaluate(() => !document.querySelector('#decor-store').disabled), 'klick på bordet (under sakerna) lyfter bordet – 📦 går att trycka');
await page.evaluate(() => document.querySelector('#decor-store')?.click());
await page.waitForTimeout(200);
list = await deco();
const fell = list.filter((d) => d.k === 'laptop' || d.k === 'bordslampa');
ok(!list.some((d) => d.k === 'skrivbord') && fell.length === 2 && fell.every((d) => !d.up), 'skrivbordet i förrådet – datorn och lampan står på golvet');
ok(await D((d) => d.allFit()), 'och de står rätt där');
await page.evaluate(() => window.SF.scene.toggleDecor?.(false));

console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga konsolfel');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
