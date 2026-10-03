// Bygger app/www/ – spelet som det ligger i appen (Capacitor, iOS):
//   - alla filer i ../version.json (samma lista som service workern förladdar) + version.json
//   - PeerJS och reservtypsnitten (Google Fonts) läggs lokalt i vendor/, så att appen startar utan nät
// Spelet självt ändras inte: i appen finns ingen service worker, och uppdateringskollen jämför med
// den inbyggda version.json – nya versioner kommer via TestFlight/App Store.
//   node build.mjs            (körs av "npm run build" / "npm run sync" och i codemagic.yaml)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const APP = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(APP, '..');
const WWW = path.join(APP, 'www');
const NM = path.join(APP, 'node_modules');

const ver = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
const files = [...new Set([...(ver.files || []), 'version.json'])];

fs.rmSync(WWW, { recursive: true, force: true });
for (const f of files) {
  const src = path.join(ROOT, f), dst = path.join(WWW, f);
  if (!fs.existsSync(src)) throw new Error(`saknas i spelet: ${f}`);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

// vendor/: PeerJS + typsnitten
const vendor = path.join(WWW, 'vendor');
fs.mkdirSync(path.join(vendor, 'fonts'), { recursive: true });
fs.copyFileSync(path.join(NM, 'peerjs/dist/peerjs.min.js'), path.join(vendor, 'peerjs.min.js'));
const FONTS = [['Jersey 10', 'jersey-10'], ['VT323', 'vt323']];
let css = '';
for (const [family, id] of FONTS) {
  const file = `${id}-latin-400-normal.woff2`;
  fs.copyFileSync(path.join(NM, `@fontsource/${id}/files/${file}`), path.join(vendor, 'fonts', file));
  css += `@font-face { font-family: "${family}"; font-style: normal; font-weight: 400; font-display: swap; src: url("fonts/${file}") format("woff2"); }\n`;
}
fs.writeFileSync(path.join(vendor, 'fonts.css'), css);

// index.html: peka om de externa adresserna – varje byte måste träffa exakt en gång
const idx = path.join(WWW, 'index.html');
let html = fs.readFileSync(idx, 'utf8');
const swap = (re, to, what) => {
  const n = (html.match(re) || []).length;
  if (n !== 1) throw new Error(`index.html: hittade ${n} st ${what} (väntade 1) – uppdatera app/build.mjs`);
  html = html.replace(re, to);
};
swap(/<script src="https:\/\/unpkg\.com\/peerjs@[^"]+\/dist\/peerjs\.min\.js"( defer)?><\/script>/g, '<script src="vendor/peerjs.min.js" defer></script>', 'PeerJS-rader');
swap(/<link href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]+" rel="stylesheet">/g, '<link href="vendor/fonts.css" rel="stylesheet">', 'Google Fonts-rader');
html = html.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.(googleapis|gstatic)\.com"( crossorigin)?>/g, '');
if (/https?:\/\/(unpkg|fonts\.)/.test(html)) throw new Error('index.html har kvar externa adresser');
fs.writeFileSync(idx, html);

console.log(`app/www: v${ver.version} – ${files.length} filer + vendor (PeerJS ${JSON.parse(fs.readFileSync(path.join(NM, 'peerjs/package.json'), 'utf8')).version}, ${FONTS.length} typsnitt)`);
