// Tar bilder av tools/pets-sprite-preview.html (husdjurens sprites).
//   node tools/pets-sprite-snap.mjs "mode=grid&species=hund&anim=idle" tools/out/pets-grid-hund.png
//   flera på en gång: node tools/pets-sprite-snap.mjs "q1" out1.png "q2" out2.png …
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
import fs from 'fs';

const args = process.argv.slice(2);
const port = process.env.PORT || '8788';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message + '\n' + (e.stack || '')));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
for (let i = 0; i + 1 < args.length; i += 2) {
  const q = args[i], out = args[i + 1];
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}/tools/pets-sprite-preview.html?${q}&nc=${Date.now()}`);
  try { await page.waitForFunction(() => window.__done === true, null, { timeout: 60000 }); }
  catch { console.log('timeout', q); }
  const info = await page.evaluate(() => window.__info || '');
  if (info) console.log(info);
  const url = await page.evaluate(() => document.querySelector('#out').toDataURL('image/png'));
  fs.mkdirSync(out.replace(/[\\/][^\\/]*$/, '') || '.', { recursive: true });
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  const dim = await page.evaluate(() => [document.querySelector('#out').width, document.querySelector('#out').height]);
  console.log('skrev', out, dim.join('x'), (Date.now() - t0) + 'ms');
}
console.log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'Inga konsolfel.');
await browser.close();
