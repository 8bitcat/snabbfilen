// Förhandsvisning av Pixelstaden i riktiga spelet (Playwright).
//   node tools/city-snap.mjs --pano --hour 12 --out tools/out/pano.png
//   node tools/city-snap.mjs --cam 300,120 --hour 21 --wait 3000 --out tools/out/x.png
//   node tools/city-snap.mjs --cam 300,120 --teleport 410,200 --out …   (figuren vid en plats)
//   --district SÖDER|FÖRORTEN|PARKEN|CENTRUM   (figuren och kameran till områdets startpunkt)
//   --weather sol|moln|regn|snö|dimma|blåst  --snow 0..1  --season vår|sommar|höst|vinter  --temp N
//   --rain      (dagshändelsen 'regn' – samma som --weather regn)
//   --scale 3   förstora bilden (default 2 för --cam, 1 för --pano)
//   --scene jobbburgare   (annan scen än staden; --cam/--teleport gäller bara staden)
//   --port 8788 (servern: python -m http.server 8788 i spelmappen)
// Skriver ut konsolfel från sidan – "Inga konsolfel." betyder rent.
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
import fs from 'fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const port = arg('port', '8788');
const out = arg('out', 'tools/out/city.png');
const hour = +arg('hour', 12);
const wait = +arg('wait', 1500);
const pano = !!arg('pano', false);
const cam = arg('cam', null);
const tele = arg('teleport', null);
const district = arg('district', null);
const scale = +arg('scale', pano ? 1 : 2);
const rain = !!arg('rain', false);
const weather = arg('weather', null), snow = arg('snow', null), season = arg('season', null), temp = arg('temp', null);
const sceneName = arg('scene', 'city'); // t.ex. jobbburgare, jobbfrukt, klader, mobler

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`http://localhost:${port}/index.html?world=snap${Date.now().toString(36)}`);
await page.evaluate(({ hour }) => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Snap', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: hour * 60, money: 500, hunger: 90, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
}, { hour });
await page.reload();
await page.waitForTimeout(900);
await page.evaluate(({ hour, rain, sceneName }) => {
  const S = window.SF;
  S.game.min = hour * 60;
  if (rain) S.game.event = { id: 'regn' };
  S.go(sceneName, sceneName.startsWith('jobb') ? { onDone: () => {} } : undefined);
}, { hour, rain, sceneName });
// vädret tvingas via scenens _debug.weather (env.forceWeather) – bara i staden
if (sceneName === 'city' && (weather || snow !== null || season || temp !== null)) {
  const f = {};
  if (weather) f.kind = weather;
  if (snow !== null) f.snow = +snow;
  if (season) f.season = season;
  if (temp !== null) f.temp = +temp;
  await page.evaluate((f) => window.SF.scene._debug.weather?.(f), f);
}
if (district && sceneName === 'city') await page.evaluate((d) => window.SF.scene._debug.district?.(d), String(district));
if (tele) { const [x, y] = String(tele).split(',').map(Number); await page.evaluate(([x, y]) => window.SF.scene._debug.teleport(x, y), [x, y]); }
if (cam) { const [x, y] = String(cam).split(',').map(Number); await page.evaluate(([x, y]) => window.SF.scene._debug.lockCam(x, y), [x, y]); }
// håll klockan still medan simuleringen får gå
await page.evaluate((hour) => { const S = window.SF; const keep = () => { S.game.min = hour * 60; requestAnimationFrame(keep); }; keep(); }, hour);
await page.waitForTimeout(wait);

let png;
if (pano) {
  const url = await page.evaluate(() => window.SF.scene._debug.panorama());
  png = Buffer.from(url.split(',')[1], 'base64');
} else {
  const url = await page.evaluate(() => document.querySelector('#scene').toDataURL('image/png'));
  png = Buffer.from(url.split(',')[1], 'base64');
}
// skala upp med närmaste granne (i sidan) om scale > 1 och panorama
if (scale !== 1 && pano) {
  const url = await page.evaluate(({ b64, s }) => new Promise((res) => {
    const im = new Image(); im.onload = () => {
      const c = document.createElement('canvas'); c.width = im.width * s; c.height = im.height * s;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(im, 0, 0, c.width, c.height);
      res(c.toDataURL('image/png'));
    }; im.src = 'data:image/png;base64,' + b64;
  }), { b64: png.toString('base64'), s: scale });
  png = Buffer.from(url.split(',')[1], 'base64');
}
fs.mkdirSync(out.replace(/[\\/][^\\/]*$/, '') || '.', { recursive: true });
fs.writeFileSync(out, png);
console.log('skrev', out);
if (sceneName === 'city') console.log('väder:', await page.evaluate(() => JSON.stringify(window.SF.scene._debug.env?.weather || null)));
console.log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'Inga konsolfel.');
await browser.close();
