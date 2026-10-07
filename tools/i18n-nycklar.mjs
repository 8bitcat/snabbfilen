// Översättningarnas nycklar: läser js/**/*.js och hittar varje text som ska översättas –
//   $t`mall med ${x}`  → "mall med {0}"      $t('text') / $n('text') / $tf('text {0}', …)
// och jämför med ordlistorna i js/i18n/<språk>.js.
//   node tools/i18n-nycklar.mjs              → täckning per språk (+ tools/out/i18n-nycklar.json)
//   node tools/i18n-nycklar.mjs --saknas en  → de nycklar som saknas på engelska (en per rad, JSON)
//   node tools/i18n-nycklar.mjs --fil js/scenes/shop-sjoboden.js → nycklarna i en fil
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const LANGS = ['en', 'es', 'de', 'fr', 'pl', 'it', 'pt'];
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'i18n') walk(p); } else if (e.name.endsWith('.js') && !(e.name === 'i18n.js' && d.endsWith('core'))) files.push(p); } })(path.join(ROOT, 'js'));

const cook = (s) => s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (_, c) => {
  if (c[0] === 'u') return String.fromCodePoint(parseInt(c.replace(/[u{}]/g, ''), 16));
  if (c[0] === 'x') return String.fromCharCode(parseInt(c.slice(1), 16));
  return { n: '\n', t: '\t', r: '\r', 0: '\0' }[c] ?? c;
});
// hoppa över ett ${ … }-uttryck (med strängar och mallar inuti) – returnerar index efter }
function skipExpr(src, i) {
  let depth = 1;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === "'" || c === '"') { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; } i++; continue; }
    if (c === '`') { i = skipTemplate(src, i + 1).end; continue; }
    if (c === '{') depth++; else if (c === '}') depth--;
    i++;
  }
  return i;
}
// läs en mall från efter ` – returnerar { key, end }
function skipTemplate(src, i) {
  let key = '', lit = '', n = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { lit += src.slice(i, i + 2); i += 2; continue; }
    if (c === '`') { key += cook(lit); return { key, end: i + 1 }; }
    if (c === '$' && src[i + 1] === '{') { key += cook(lit) + `{${n++}}`; lit = ''; i = skipExpr(src, i + 2); continue; }
    lit += c; i++;
  }
  return { key: key + cook(lit), end: i };
}
export function keysOf(src) {
  const out = [];
  const re = /(?<![\w$.])(\$tf|\$t|\$n)(`|\(\s*(['"]))/g;
  let m;
  while ((m = re.exec(src))) {
    // mallen: nyckeln räknas ut, men sökningen fortsätter INUTI mallen så att $t('…') i ${…} också hittas
    if (m[2] === '`') { const t = skipTemplate(src, m.index + m[0].length); out.push(t.key); re.lastIndex = m.index + m[0].length; continue; }
    const q = m[3]; let i = m.index + m[0].length, s = '';
    while (i < src.length && src[i] !== q) { if (src[i] === '\\') { s += src.slice(i, i + 2); i += 2; continue; } s += src[i++]; }
    out.push(cook(s)); re.lastIndex = i + 1;
  }
  return out;
}
const byFile = {};
const all = new Set();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  if (!/(?<![\w$.])(\$tf|\$t|\$n)(`|\()/.test(src)) continue;
  const ks = keysOf(src).filter((k) => k.trim());
  if (!ks.length) continue;
  byFile[path.relative(ROOT, f).replace(/\\/g, '/')] = [...new Set(ks)];
  ks.forEach((k) => all.add(k));
}
const argv = process.argv.slice(2);
if (argv[0] === '--fil') { console.log(JSON.stringify(byFile[argv[1]] || [], null, 1)); process.exit(0); }
const dicts = {};
for (const l of LANGS) {
  const p = path.join(ROOT, 'js/i18n', l + '.js');
  dicts[l] = fs.existsSync(p) ? (await import(pathToFileURL(p).href + '?' + Date.now())).default || {} : {};
}
if (argv[0] === '--saknas') { const l = argv[1]; console.log(JSON.stringify([...all].filter((k) => typeof dicts[l]?.[k] !== 'string'), null, 1)); process.exit(0); }
fs.mkdirSync(path.join(ROOT, 'tools/out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools/out/i18n-nycklar.json'), JSON.stringify({ keys: [...all], byFile }, null, 1));
console.log(`${all.size} texter i ${Object.keys(byFile).length} filer`);
for (const l of LANGS) {
  const have = [...all].filter((k) => typeof dicts[l][k] === 'string').length;
  console.log(`  ${l}: ${have}/${all.size} översatta (${all.size ? Math.round(have / all.size * 100) : 0} %)`);
}
