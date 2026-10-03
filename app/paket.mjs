// Spelpaketet till appen: bygger app/www (build.mjs), packar det till app/out/pixelcity-<version>.zip
// och lägger upp zip-filen på GitHub-releasen v<version>. Appen (js/core/version-ui.js) ser den nya
// versionen i version.json på webben och hämtar paketet därifrån – inget nytt app-bygge behövs.
// Körs EFTER att release-commiten och taggen är pushade (tools/release.mjs → verify → push):
//   node app/paket.mjs              bygg, packa, ladda upp
//   node app/paket.mjs --bara-zip   bara bygga och packa (provkörning, inget laddas upp)
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const APP = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(APP, '..');
const REPO = '8bitcat/snabbfilen';
const ver = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
const V = ver.version;

execFileSync(process.execPath, [path.join(APP, 'build.mjs')], { stdio: 'inherit' });

// ---------- zip (deflate, utan beroenden): index.html i roten, som uppdateringspluginet vill ha
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files) {
  const delar = [], katalog = []; let off = 0;
  for (const f of files) {
    const namn = Buffer.from(f.name, 'utf8'), raw = f.data, crc = crc32(raw), packad = zlib.deflateRawSync(raw, { level: 9 });
    const lagra = packad.length >= raw.length, kropp = lagra ? raw : packad, metod = lagra ? 0 : 8;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(metod, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(kropp.length, 18);
    lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(namn.length, 26); lh.writeUInt16LE(0, 28);
    delar.push(lh, namn, kropp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(metod, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(kropp.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(namn.length, 28);
    ch.writeUInt32LE(off, 42);
    katalog.push(ch, namn);
    off += 30 + namn.length + kropp.length;
  }
  const cd = Buffer.concat(katalog), slut = Buffer.alloc(22);
  slut.writeUInt32LE(0x06054b50, 0); slut.writeUInt16LE(files.length, 8); slut.writeUInt16LE(files.length, 10);
  slut.writeUInt32LE(cd.length, 12); slut.writeUInt32LE(off, 16);
  return Buffer.concat([...delar, cd, slut]);
}
const WWW = path.join(APP, 'www');
const alla = [];
(function gå(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) gå(p); else alla.push(p); } })(WWW);
alla.sort();
const files = alla.map((p) => ({ name: path.relative(WWW, p).split(path.sep).join('/'), data: fs.readFileSync(p) }));
if (!files.some((f) => f.name === 'index.html')) throw new Error('index.html saknas i app/www');
const OUT = path.join(APP, 'out');
fs.mkdirSync(OUT, { recursive: true });
const ZIP = path.join(OUT, `pixelcity-${V}.zip`);
fs.writeFileSync(ZIP, zip(files));
console.log(`paket: ${path.relative(ROOT, ZIP)} – ${files.length} filer, ${(fs.statSync(ZIP).size / 1e6).toFixed(2)} MB`);
if (process.argv.includes('--bara-zip')) process.exit(0);

// ---------- GitHub-releasen v<version> (taggen måste redan vara pushad)
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
let finns = true;
try { gh(['release', 'view', `v${V}`, '--repo', REPO, '--json', 'tagName']); } catch { finns = false; }
if (finns) gh(['release', 'upload', `v${V}`, ZIP, '--repo', REPO, '--clobber']);
else gh(['release', 'create', `v${V}`, ZIP, '--repo', REPO, '--verify-tag', '--title', `v${V} – ${ver.title || 'Snabbfilen'}`, '--notes', `Spelpaketet till appen Pixelcity (${path.basename(ZIP)}). Appen hämtar det själv – se js/core/version-ui.js.`]);
const url = `https://github.com/${REPO}/releases/download/v${V}/pixelcity-${V}.zip`;
console.log(`uppladdat: ${url}`);
