// Bygger ordlistorna js/i18n/<id>.js ur översättningarna:
//   tools/i18n/namn.<id>.json        – de lokala namnen (staden, gatorna, butikerna, personerna …)
//   tools/i18n/ut/<id>-*.json        – översättarnas delar: { "svensk nyckel": "översättning", … }
// och kontrollerar varje översättning mot den svenska nyckeln: samma {0}-platser, samma HTML-taggar,
// inte tom. Fel skrivs till tools/out/i18n-fel-<id>.json (de nycklarna översätts om) och tas inte med.
//   node tools/i18n-bygg.mjs            → alla språk
//   node tools/i18n-bygg.mjs en de      → bara de språken
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const ALL = ['en', 'es', 'de', 'fr', 'pl', 'it', 'pt'];
const langs = process.argv.slice(2).filter((a) => ALL.includes(a));
const keysFile = path.join(ROOT, 'tools/out/i18n-nycklar.json');
const KEYS = fs.existsSync(keysFile) ? new Set(JSON.parse(fs.readFileSync(keysFile, 'utf8')).keys) : null;
const ph = (s) => (s.match(/\{\d+\}/g) || []).sort().join(',');
const tags = (s) => (s.match(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi) || []).map((t) => t.replace(/\s[^>]*>/, '>').toLowerCase()).sort().join(',');
function check(sv, tr) {
  if (typeof tr !== 'string' || !tr.trim()) return 'tom';
  if (ph(sv) !== ph(tr)) return `platser ${ph(sv)} ≠ ${ph(tr)}`;
  if (tags(sv) !== tags(tr)) return `taggar ${tags(sv)} ≠ ${tags(tr)}`;
  return null;
}
for (const id of langs.length ? langs : ALL) {
  const dict = {}, fel = {};
  let LISTS = null;
  const add = (sv, tr, src) => { const e = check(sv, tr); if (e) fel[sv] = { tr, fel: e, src }; else dict[sv] = tr; };
  const namn = path.join(ROOT, `tools/i18n/namn.${id}.json`);
  if (fs.existsSync(namn)) {
    const N = JSON.parse(fs.readFileSync(namn, 'utf8'));
    for (const [sv, tr] of Object.entries(N.names || {})) add(sv, tr, 'namn');
    LISTS = N.lists || null;   // förnamn, husdjur, hästar, efternamn (list() i i18n.js)
  }
  const dir = path.join(ROOT, 'tools/i18n/ut');
  const parts = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.startsWith(id + '-') && f.endsWith('.json')).sort() : [];
  for (const f of parts) {
    let obj;
    try { obj = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { console.log(`  ${f}: går inte att läsa (${e.message})`); continue; }
    for (const [sv, tr] of Object.entries(obj)) add(sv, tr, f);
  }
  // kortare skyltar (tools/i18n-bredd.mjs → tools/i18n/kort/<id>.json) läggs ovanpå
  const kort = path.join(ROOT, `tools/i18n/kort/${id}.json`);
  if (fs.existsSync(kort)) { try { for (const [sv, tr] of Object.entries(JSON.parse(fs.readFileSync(kort, 'utf8')))) add(sv, tr, 'kort'); } catch (e) { console.log(`  kort/${id}.json: går inte att läsa (${e.message})`); } }
  // bara nycklar som finns i koden (plus namnen – de kan förekomma i meningar och som $n-namn)
  const out = {};
  for (const [k, v] of Object.entries(dict)) if (!KEYS || KEYS.has(k) || fs.existsSync(namn)) out[k] = v;
  const file = path.join(ROOT, `js/i18n/${id}.js`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = Object.keys(out).sort().map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(out[k])},`).join('\n');
  fs.writeFileSync(file, `// Ordlista ${id} – byggd av tools/i18n-bygg.mjs (redigera inte för hand: ändra tools/i18n/ut/ eller namn.${id}.json)\nexport default {\n${body}\n};\n`);
  fs.mkdirSync(path.join(ROOT, 'tools/out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, `tools/out/i18n-fel-${id}.json`), JSON.stringify(fel, null, 1));
  const have = KEYS ? [...KEYS].filter((k) => k in out).length : Object.keys(out).length;
  console.log(`${id}: ${Object.keys(out).length} poster, ${have}/${KEYS ? KEYS.size : '?'} av kodens nycklar, ${Object.keys(fel).length} fel (${parts.length} delar)`);
}
