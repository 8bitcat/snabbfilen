// Förhandsvisning av djuraffären (scenen 'djur') i riktiga spelet (Playwright).
//   node tools/pets-shop-snap.mjs --out tools/out/djur-1.png                 (hela skärmen vid dörren)
//   node tools/pets-shop-snap.mjs --cam 0 --out …                            (kameran låst på x = 0)
//   node tools/pets-shop-snap.mjs --pano --out …                             (hela butiken, 768 px bred)
//   node tools/pets-shop-snap.mjs --teleport 90,82 --cam 0 --wait 3000 --out …
//   node tools/pets-shop-snap.mjs --open katt-tigrerad --out …               (köpdialog, hela sidan)
//   node tools/pets-shop-snap.mjs --click hund --out …                       (klicka som en spelare, vänta, skärmbild)
//   node tools/pets-shop-snap.mjs --frames 10 --every 80 --crop 540,70,120,60 --scale 4 --out …  (bildsekvens)
//   --eval "SF.scene._debug.clerkStep(6)"  (kör kod i sidan innan väntan)
//   --hover id  (namnskylten för en vara/ett djur) · --money 5000 · --buy (trycker Köp i dialogen)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
import fs from 'fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const port = arg('port', '8788');
const out = arg('out', 'tools/out/djur.png');
const wait = +arg('wait', 1500);
const cam = arg('cam', null);
const tele = arg('teleport', null);
const open = arg('open', null);
const click = arg('click', null);
const hover = arg('hover', null);
const frames = +arg('frames', 0);
const every = +arg('every', 80);
const crop = arg('crop', null);
const scale = +arg('scale', 3);
const money = +arg('money', 3000);
const pano = !!arg('pano', false);
const buy = !!arg('buy', false);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1240, height: 820 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`http://localhost:${port}/index.html?world=djur${Date.now().toString(36)}`);
await page.evaluate(({ money }) => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Snap', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money, hunger: 90, energy: 90, home: 'lagenhet', fridge: {}, jobs: {}, earned: 0 }));
  localStorage.removeItem('snabbfilen_pets1');
}, { money });
await page.reload();
await page.waitForTimeout(900);
await page.evaluate(() => { const S = window.SF; S.game.min = 12 * 60; S.go('djur'); });
await page.evaluate(() => { const S = window.SF; const keep = () => { S.game.min = 12 * 60; requestAnimationFrame(keep); }; keep(); });
if (tele) { const [x, y] = String(tele).split(',').map(Number); await page.evaluate(([x, y]) => window.SF.scene._debug.teleport(x, y), [x, y]); }
if (cam) await page.evaluate((x) => window.SF.scene._debug.lockCam(x), +cam);
const ev = arg('eval', null);
if (ev) await page.evaluate((code) => { const SF = window.SF; return eval(code); }, String(ev));
await page.waitForTimeout(wait);

const canvasPng = async () => {
  const url = await page.evaluate(({ crop, scale, pano }) => {
    const cv = document.querySelector('#scene');
    const pxs = cv.width / 384;
    let [x, y, w, h] = crop ? String(crop).split(',').map(Number) : [0, 0, 384, 216];
    const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(cv, x * pxs, y * pxs, w * pxs, h * pxs, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }, { crop, scale, pano });
  return url;
};

let png;
if (pano) {
  // två halvor med låst kamera, ihopsatta
  const halves = [];
  for (const x of [0, 384]) {
    await page.evaluate((x) => window.SF.scene._debug.lockCam(x), x);
    await page.waitForTimeout(120);
    halves.push(await page.evaluate(() => document.querySelector('#scene').toDataURL('image/png')));
  }
  const url = await page.evaluate(async ({ halves, scale }) => {
    const ims = await Promise.all(halves.map((u) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = u; })));
    const pxs = ims[0].width / 384;
    const c = document.createElement('canvas'); c.width = 768 * scale; c.height = 216 * scale;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    ims.forEach((im, i) => g.drawImage(im, 0, 0, im.width, im.height, i * 384 * scale, 0, 384 * scale, 216 * scale));
    return c.toDataURL('image/png');
  }, { halves, scale: scale > 2 ? 2 : scale });
  png = Buffer.from(url.split(',')[1], 'base64');
} else if (open || click) {
  if (open) await page.evaluate((id) => window.SF.scene._debug.open(id), open);
  else {
    const p = await page.evaluate((id) => window.SF.scene._debug.spot(id), click);
    if (!p) throw new Error('ingen plats ' + click);
    const box = await page.locator('#scene').boundingBox();
    await page.mouse.click(box.x + p.x / 384 * box.width, box.y + p.y / 216 * box.height);
    await page.waitForTimeout(+arg('walk', 6000));
  }
  await page.waitForTimeout(700);
  if (buy) {
    await page.locator('.dlg-foot .btn-go').click();
    await page.waitForTimeout(500);
    console.log('köpt:', JSON.stringify(await page.evaluate(() => window.SF.scene._debug.bought())));
    console.log('pengar:', await page.evaluate(() => window.SF.game.money));
    console.log('djur:', await page.evaluate(() => JSON.parse(localStorage.getItem('snabbfilen_pets1') || '{}').pets?.map((p) => `${p.name}/${p.species}/${p.breed}/${p.sex}/${p.home}`)));
  }
  png = await page.screenshot();
} else if (frames > 0) {
  const shots = [];
  if (hover) await page.evaluate((id) => window.SF.scene._debug.hover(id), hover);
  for (let i = 0; i < frames; i++) { shots.push(await canvasPng()); await page.waitForTimeout(every); }
  const url = await page.evaluate(async (shots) => {
    const ims = await Promise.all(shots.map((u) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = u; })));
    const cols = Math.min(ims.length, Math.max(1, Math.floor(1900 / (ims[0].width + 4))));
    const rows = Math.ceil(ims.length / cols);
    const c = document.createElement('canvas'); c.width = cols * (ims[0].width + 4); c.height = rows * (ims[0].height + 4);
    const g = c.getContext('2d'); g.fillStyle = '#ff00ff'; g.fillRect(0, 0, c.width, c.height);
    ims.forEach((im, i) => g.drawImage(im, (i % cols) * (im.width + 4), Math.floor(i / cols) * (im.height + 4)));
    return c.toDataURL('image/png');
  }, shots);
  png = Buffer.from(url.split(',')[1], 'base64');
} else {
  if (hover) { await page.evaluate((id) => window.SF.scene._debug.hover(id), hover); await page.waitForTimeout(100); }
  png = Buffer.from((await canvasPng()).split(',')[1], 'base64');
}
fs.mkdirSync(out.replace(/[\\/][^\\/]*$/, '') || '.', { recursive: true });
fs.writeFileSync(out, png);
console.log('skrev', out);
console.log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'Inga konsolfel.');
await browser.close();
