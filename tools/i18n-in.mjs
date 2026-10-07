// Tar in översättarnas svar: tools/i18n/svar/<id>-<nn>.json ({ "nummer": "översättning" }) +
// paketen tools/i18n/del/<nn>.json ([{ i, f, k }]) → tools/i18n/ut/<id>-<nn>.json ({ "svensk nyckel": … }).
// Skriver också vilka nummer som saknas (tools/out/i18n-saknas-<id>.json) – de skickas till en ny omgång.
//   node tools/i18n-in.mjs en      (ett eller flera språk)
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const langs = process.argv.slice(2);
const DEL = path.join(ROOT, 'tools/i18n/del'), SVAR = path.join(ROOT, 'tools/i18n/svar'), UT = path.join(ROOT, 'tools/i18n/ut');
fs.mkdirSync(UT, { recursive: true });
for (const id of langs) {
  const saknas = [];
  let n = 0;
  for (const f of fs.readdirSync(DEL).filter((x) => x.endsWith('.json')).sort()) {
    const nn = f.replace('.json', ''), part = JSON.parse(fs.readFileSync(path.join(DEL, f), 'utf8'));
    const sv = path.join(SVAR, `${id}-${nn}.json`);
    let ans = {};
    if (fs.existsSync(sv)) { try { ans = JSON.parse(fs.readFileSync(sv, 'utf8')); } catch (e) { console.log(`  ${id}-${nn}: trasig JSON (${e.message})`); } }
    // tilläggsomgångar: <id>-<nn>-b.json osv. fyller i det som saknades
    for (const extra of fs.readdirSync(SVAR).filter((x) => x.startsWith(`${id}-${nn}-`) && x.endsWith('.json')).sort()) {
      try { Object.assign(ans, JSON.parse(fs.readFileSync(path.join(SVAR, extra), 'utf8'))); } catch { /* hoppa över */ }
    }
    const out = {};
    for (const { i, k } of part) {
      const tr = ans[i] ?? ans[String(i)];
      if (typeof tr === 'string' && tr.trim()) { out[k] = tr; n++; } else saknas.push(i);
    }
    fs.writeFileSync(path.join(UT, `${id}-${nn}.json`), JSON.stringify(out, null, 1));
  }
  fs.mkdirSync(path.join(ROOT, 'tools/out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, `tools/out/i18n-saknas-${id}.json`), JSON.stringify(saknas));
  console.log(`${id}: ${n} översättningar in, ${saknas.length} saknas`);
}
