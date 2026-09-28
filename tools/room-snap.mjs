// Förhandsbilder av hemmet (Playwright, servern på 8788):
//   node tools/room-snap.mjs
// Skriver tools/out/rum-*.png: Lilla rummet dag/natt, villans vardagsrum med nya möbler,
// Möblera-läget (väggtavla + flyttad säng), soffan i alla fyra vyer + speglad lampa,
// villans kök som det seedas, fönsterregeln (tavla nekas, gardin får), förrådspanelen
// bredvid canvasen i 1366×768 och en gammal sparfil som knuffas in i Lilla rummet.
// Skriver ut konsolfel – "Inga konsolfel." betyder rent.
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
import fs from 'fs';

const OUT = 'D:/GamesProjects/snabbfilen/tools/out/';
const PORT = process.env.SMOKE_PORT || '8788';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 700 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`http://localhost:${PORT}/index.html?world=rs${Date.now().toString(36)}`);
const SAVE = (home, deco = {}, storage = []) => ({ v: 1, day: 3, min: 600, money: 5000, hunger: 90, energy: 90, home, fridge: { pizza: 1 }, jobs: {}, earned: 0, wardrobe: [], storage, deco, won: false });
await page.evaluate((save) => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Snap', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify(save));
}, SAVE('rum'));
await page.reload();
await page.waitForFunction(() => !!window.SF?.game && window.SF.sceneName === 'room', null, { timeout: 15000 });
await page.waitForTimeout(700);

const canvasPng = async (name, scale = 3) => {
  const url = await page.evaluate((s) => {
    const c = document.querySelector('#scene');
    const o = document.createElement('canvas'); o.width = 384 * s; o.height = 216 * s;
    const x = o.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(c, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  }, scale);
  fs.writeFileSync(OUT + name + '.png', Buffer.from(url.split(',')[1], 'base64'));
  console.log('→', name);
};
const setRoom = async (home, sub, deco, storage, min = 600) => {
  await page.evaluate(({ home, sub, deco, storage, min }) => {
    const g = window.SF.game;
    g.home = home; g.min = min;
    for (const [k, v] of Object.entries(deco)) g.deco[k] = v;
    if (storage) g.storage = storage;
    g.save();
    window.SF.roomSub = sub;
    window.SF.go('room');
  }, { home, sub, deco, storage, min });
  await page.waitForTimeout(500);
};

// 1. Lilla rummet dag + natt (startmöbleringen seedas)
await setRoom('rum', 0, {}, [], 10 * 60);
await page.waitForTimeout(1200); // spindeln hinner ner på sin tråd
await canvasPng('rum-lilla-dag');
await page.evaluate(() => { const d = window.SF.scene._debug; const p = d.spot('dass'); if (p) window.SF.scene.down(p.x, p.y); });
await page.waitForTimeout(2600);
const toiletOk = await page.evaluate(() => [...document.querySelectorAll('#toasts *')].map((e) => e.textContent).join(' | '));
console.log('toalett-toast:', toiletOk.slice(0, 120));
await page.evaluate(() => { window.SF.game.min = 22 * 60; window.SF.scene.down(60, 200); });
await page.waitForTimeout(2200);
await canvasPng('rum-lilla-natt');
// dasset i närbild (6×)
{
  const url = await page.evaluate(() => {
    const c = document.querySelector('#scene'), s = window.SF.pxs;
    const o = document.createElement('canvas'); o.width = 60 * 6; o.height = 50 * 6;
    const x = o.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(c, 120 * s, 138 * s, 60 * s, 50 * s, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  });
  fs.writeFileSync(OUT + 'rum-dass-narbild.png', Buffer.from(url.split(',')[1], 'base64'));
  console.log('→ rum-dass-narbild');
}
console.log('spot dass:', JSON.stringify(await page.evaluate(() => window.SF.scene._debug.spot('dass'))), 'partition', await page.evaluate(() => window.SF.scene._debug.partition));

// 2. Villans vardagsrum med nya möbler (väggsaker + golvsaker + matta ur arken)
const villa0 = [
  { k: 'kuddsoffa', v: 1, x: 100, y: 184 }, { k: 'soffbord', v: 2, x: 104, y: 202 }, { k: 'fatolj', v: 4, x: 150, y: 168, r: 1 },
  { k: 'hoghylla', v: 0, x: 200, y: 96 }, { k: 'piano', v: 1, x: 250, y: 100 }, { k: 'tegelspis', v: 1, x: 330, y: 118 },
  { k: 'golvlampa', v: 0, x: 300, y: 150 }, { k: 'kattrad', v: 0, x: 40, y: 150 }, { k: 'stormatta', v: 2, x: 130, y: 210 },
  { k: 'julgran', v: 1, x: 340, y: 205 }, { k: 'moraklocka', v: 0, x: 176, y: 96 }, { k: 'tv', v: 2, x: 60, y: 120 },
  // väggsakerna på den fria väggbiten mellan fönster 2 och 3 (174..238) – inte över fönster eller dörrar; gardinen får hänga över fönster 3
  { k: 'landskap', v: 0, x: 176, y: 44 }, { k: 'vaggklocka', v: 0, x: 200, y: 30 }, { k: 'gardin', v: 3, x: 240, y: 52 },
  { k: 'vaggsvard', v: 0, x: 215, y: 50 }, { k: 'blomkruka', v: 1, x: 240, y: 160 }, { k: 'djurbadd', v: 3, x: 70, y: 200 },
];
await setRoom('villa', 0, { 'villa:0': villa0 }, [], 14 * 60);
await canvasPng('rum-villa-nya-mobler');

// 3. Möblera-läget i sovrummet: flytta sängen, häng en tavla ur förrådet på väggen
await setRoom('villa', 1, { 'villa:1': [{ k: 'sang', v: 7, x: 40, y: 133, fx: 1 }, { k: 'garderob', v: 5, x: 250, y: 96, fx: 1 }, { k: 'nattduksbord', v: 1, x: 84, y: 120 }] },
  [{ k: 'blomtavla', v: 0 }, { k: 'enkelsang', v: 3 }, { k: 'rundspegel', v: 2 }], 11 * 60);
await page.evaluate(() => window.SF.scene.toggleDecor(true));
await page.waitForTimeout(300);
const moved = await page.evaluate(() => {
  const d = window.SF.scene._debug;
  const ok1 = d.pick(0) && d.rotate() === undefined && d.drop(200, 190);      // sängen: lyft, vrid (→ från sidan), släpp
  const ok2 = d.pickStorage(0) && d.canPlace(150, 60) === false && d.drop(180, 60); // blomstertavlan ur förrådet upp på väggen (inte över fönstret, bredvid)
  const ok3 = d.pickStorage(0) && d.canPlace(150, 60) === false && d.drop(100, 170); // enkelsängen (nu först i förrådet): går inte på väggen, men på golvet
  const g = window.SF.game;
  return { ok1, ok2, ok3, deco: g.deco['villa:1'], walls: d.walls(), storage: g.storage };
});
console.log('möblera:', JSON.stringify(moved));
await page.evaluate(() => window.SF.scene._debug.pick(0)); // håll i sängen (spöket syns)
await page.mouse.move(400, 500);
await page.waitForTimeout(300);
await page.screenshot({ path: OUT + 'rum-moblera.png' });
console.log('→ rum-moblera');
await page.evaluate(() => window.SF.scene.toggleDecor(false));

// 4. Soffan i alla fyra vyer + speglad lampa (och en fåtölj/enkelsäng runt)
const showroom = [
  { k: 'soffa', v: 7, x: 30, y: 150 }, { k: 'soffa', v: 7, x: 80, y: 150, r: 1 }, { k: 'soffa', v: 7, x: 110, y: 150, r: 2 }, { k: 'soffa', v: 7, x: 160, y: 150, r: 3 },
  { k: 'lampa', v: 1, x: 200, y: 150 }, { k: 'lampa', v: 1, x: 224, y: 150, r: 1 },
  { k: 'fatolj', v: 1, x: 30, y: 200 }, { k: 'fatolj', v: 1, x: 60, y: 200, r: 1 }, { k: 'fatolj', v: 1, x: 90, y: 200, r: 2 }, { k: 'fatolj', v: 1, x: 120, y: 200, r: 3 },
  { k: 'enkelsang', v: 4, x: 260, y: 150 }, { k: 'enkelsang', v: 4, x: 290, y: 150, r: 1 }, { k: 'enkelsang', v: 4, x: 330, y: 150, r: 2 },
  { k: 'sang', v: 9, x: 160, y: 205, r: 1 }, { k: 'sang', v: 9, x: 200, y: 205 }, { k: 'toalett', v: 2, x: 250, y: 205 }, { k: 'toalett', v: 2, x: 270, y: 205, r: 1 },
  { k: 'ramtavla', v: 1, x: 300, y: 40 }, { k: 'ramtavla', v: 1, x: 320, y: 40, r: 1 },
];
await setRoom('villa', 2, { 'villa:2': showroom }, [], 12 * 60);
await canvasPng('rum-rotation');

const toasts = () => page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((e) => e.textContent).join(' | '));
const fresh = async (home, sub, storage = [], min = 12 * 60) => {
  await page.evaluate(({ home, sub, storage, min }) => {
    document.querySelector('#toasts').innerHTML = '';
    const g = window.SF.game; g.home = home; g.min = min; g.deco = {}; g.storage = storage; g.save();
    window.SF.roomSub = sub; window.SF.go('room');
  }, { home, sub, storage, min });
  await page.waitForTimeout(500);
};

// 5. Villans kök som en ny villa får det: kylskåpet bredvid SOVRUM-dörren, matstolar vid bordet
await fresh('villa', 2);
await canvasPng('rum-villa-kok-farsk');
console.log('färsk villa:2 toast:', (await toasts()) || '(ingen)');

// 6. Fönsterregeln: landskapsmålningen nekas över fönstret (rött streck), gardinen får (grönt)
await fresh('villa', 0, [{ k: 'landskap', v: 0 }, { k: 'gardin', v: 3 }]);
await page.evaluate(() => { const sc = window.SF.scene; sc.toggleDecor(true); sc._debug.pickStorage(0); sc.move(100, 45); });
await page.waitForTimeout(200);
await canvasPng('rum-fonster-tavla-nekas');
await page.evaluate(() => { const sc = window.SF.scene; sc._debug.pickStorage(1); sc.move(100, 45); });
await page.waitForTimeout(200);
await canvasPng('rum-fonster-gardin-ok');
await page.evaluate(() => window.SF.scene.toggleDecor(false));

// 7. Förrådspanelen bredvid canvasen (1366×768 – där den förut dolde 25 spelpixlar)
await page.setViewportSize({ width: 1366, height: 768 });
await fresh('villa', 0, [{ k: 'blomtavla', v: 0 }]);
await page.evaluate(() => window.SF.scene.toggleDecor(true));
await page.waitForTimeout(300);
const geo = await page.evaluate(() => { const c = document.querySelector('#scene').getBoundingClientRect(), p = document.querySelector('#decor-panel').getBoundingClientRect(); return { canvasRight: Math.round(c.right), panelLeft: Math.round(p.left), pxs: window.SF.pxs }; });
console.log('panel 1366×768:', JSON.stringify(geo));
await page.screenshot({ path: OUT + 'rum-moblera-panel.png' });
console.log('→ rum-moblera-panel');
await page.evaluate(() => window.SF.scene.toggleDecor(false));
await page.setViewportSize({ width: 1180, height: 700 });

// 8. Gammal sparfil i Lilla rummet (var 225 px brett): allt knuffas in, skåpen står kvar vid väggen
await setRoom('rum', 0, { 'rum:0': [{ k: 'sang', v: 0, x: 14, y: 133, fx: 1 }, { k: 'kylskap', v: 0, x: 150, y: 94, fx: 1 }, { k: 'garderob', v: 0, x: 180, y: 96, fx: 1 },
  { k: 'bokhylla', v: 0, x: 195, y: 140 }, { k: 'spis', v: 1, x: 190, y: 180 }, { k: 'smatavla', v: 1, x: 90, y: 40 }] }, [], 11 * 60);
await page.waitForTimeout(300);
console.log('gammal sparfil rum:0 →', JSON.stringify(await page.evaluate(() => window.SF.game.deco['rum:0'].map((d) => [d.k, d.x, d.y]))), 'toast:', await toasts());
await canvasPng('rum-gammal-sparfil');

console.log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'Inga konsolfel.');
await browser.close();
