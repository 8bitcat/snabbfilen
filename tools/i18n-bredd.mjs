// Skyltar som blir för breda: skyltarna i pixelbilderna är ritade efter de svenska ordens bredd. För
// varje text i VERSALER (skyltar och etiketter) jämförs översättningens bredd i pixeltypsnittet SMALL
// med svenskans. Är översättningen bredare (mer än tillåtet) listas den i tools/out/i18n-bredd-<id>.json
// – de texterna kortas av översättarna (tools/i18n/kort/<id>.json läggs ovanpå ordlistan).
//   node tools/i18n-bredd.mjs            → antal per språk
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
globalThis.document = { createElement: () => ({ getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }) }) };
const { SMALL, textW } = await import(pathToFileURL(path.join(ROOT, 'js/core/floor-pix.js')).href);
const KEYS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/out/i18n-nycklar.json'), 'utf8'));
const fileOf = {};
for (const [f, ks] of Object.entries(KEYS.byFile)) for (const k of ks) fileOf[k] ??= f;
const isSign = (k) => /[A-ZÅÄÖ]/.test(k) && k === k.toUpperCase() && !/[a-zåäö]/.test(k) && k.replace(/[^A-ZÅÄÖ]/g, '').length >= 2;
const lineW = (s) => Math.max(...String(s).split('\n').map((l) => textW(SMALL, l.replace(/\{\d+\}/g, '00'))));
for (const id of ['en', 'es', 'de', 'fr', 'pl', 'it', 'pt']) {
  const dict = (await import(pathToFileURL(path.join(ROOT, `js/i18n/${id}.js`)).href)).default;
  const wide = [];
  for (const k of KEYS.keys) {
    if (!isSign(k) || typeof dict[k] !== 'string') continue;
    const sv = lineW(k), tr = lineW(dict[k]);
    if (tr > sv * 1.25 + 4) wide.push({ k, tr: dict[k], f: fileOf[k], svW: sv, trW: tr });
  }
  fs.writeFileSync(path.join(ROOT, `tools/out/i18n-bredd-${id}.json`), JSON.stringify(wide, null, 1));
  console.log(`${id}: ${wide.length} skyltar bredare än svenskan`);
}
