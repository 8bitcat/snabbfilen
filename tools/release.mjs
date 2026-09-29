// Släpper en ny version av Snabbfilen: höjer versionsnumret, skriver nyheten överst i
// CHANGELOG.md (som spelets nyhetsruta läser), committar BARA de filer du anger plus
// versionsfilerna och sätter en git-tagg vX.Y.Z. Arbetskatalogen i övrigt rörs inte, så
// halvfärdigt arbete bredvid följer aldrig med.
//
//   node tools/release.mjs minor --title "Mataffären med korg och kassa" --scope mat \
//        --notes anteckningar.md -- js/scenes/shop-mat.js js/shops/matbutik.js
//   node tools/release.mjs patch --title "Hunden slutar flimra" --scope stad --notes n.md -- js/city/life.js
//
//   minor = ny funktion, patch = buggfix, major = 1.0 och framåt.
//   --notes FIL   punkter "- …" på svenska (blir nyheten i spelet och commit-texten)
//   --type        feat | fix | chore | docs  (standard: fix för patch, annars feat)
//   --scope       t.ex. mat, jobb, stad, djur, kläder, möbler
//   --dry         visa vad som skulle hända, ändra ingenting
//   --push        git push origin main + taggen direkt (gör det först efter tools/verify.mjs)
//   --no-claude   utan Co-Authored-By-raden
//   --use S=F     köa filen F som sökvägen S (släpp bara en del av en fil som andra också ändrar i)
//
// Stoppar om något annat redan ligger köat i git, om en angiven fil saknas, eller om en
// köad JS-fil importerar en fil som inte kommer med i committen (då skulle den publicerade
// sidan krascha på ett halvfärdigt beroende).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARK = '<!-- släpp:';
const COAUTHOR = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>';

const argv = process.argv.slice(2);
const dd = argv.indexOf('--');
const paths = dd >= 0 ? argv.slice(dd + 1) : [];
const opts = dd >= 0 ? argv.slice(0, dd) : argv;
const flag = (n) => opts.includes('--' + n);
const val = (n) => { const i = opts.indexOf('--' + n); return i >= 0 ? opts[i + 1] : undefined; };
const bump = opts[0];

const die = (msg) => { console.error('✗ ' + msg); process.exit(1); };
const git = (args, o = {}) => (execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...o }) ?? '').trim();
const gitOk = (args) => { try { git(args); return true; } catch { return false; } };

if (!['major', 'minor', 'patch'].includes(bump)) die('första argumentet ska vara major, minor eller patch');
const title = val('title');
if (!title) die('--title "Kort rubrik" saknas');
const notesFile = val('notes');
if (!notesFile) die('--notes FIL saknas (punkter "- …" om vad som är nytt)');
const notes = fs.readFileSync(path.resolve(notesFile), 'utf8').split(/\r?\n/).filter((l) => /^\s*[-*]\s+\S/.test(l)).map((l) => '- ' + l.replace(/^\s*[-*]\s+/, '').trim());
if (!notes.length) die(`inga punkter ("- …") i ${notesFile}`);
if (!paths.length) die('ange filerna som ska med efter "--"');
const type = val('type') || (bump === 'patch' ? 'fix' : 'feat');
const scope = val('scope');
const dry = flag('dry');

// --- läge ---
const branch = git(['branch', '--show-current']);
if (branch !== 'main' && !flag('any-branch')) die(`du står på "${branch}" – släpp görs från main (--any-branch för undantag)`);
if (git(['diff', '--cached', '--name-only'])) die('något ligger redan köat i git (git diff --cached) – töm kön först så att inget oväntat följer med');
for (const p of paths) if (!fs.existsSync(path.join(ROOT, p)) && !gitOk(['cat-file', '-e', 'HEAD:' + p.replace(/\\/g, '/')])) die(`filen finns inte: ${p}`);

const verFile = path.join(ROOT, 'js/version.js');
const cur = (fs.readFileSync(verFile, 'utf8').match(/VERSION\s*=\s*'(\d+)\.(\d+)\.(\d+)'/) || die('hittar inte VERSION i js/version.js')).slice(1).map(Number);
const next = bump === 'major' ? [cur[0] + 1, 0, 0] : bump === 'minor' ? [cur[0], cur[1] + 1, 0] : [cur[0], cur[1], cur[2] + 1];
const V = next.join('.');
if (gitOk(['rev-parse', '-q', '--verify', 'refs/tags/v' + V])) die(`taggen v${V} finns redan`);
const d = new Date();
const DATE = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// --- köa filerna och kontrollera importerna ---
// --use sökväg=fil köar innehållet i "fil" som "sökväg" (när arbetskatalogens fil också har
// andras halvfärdiga ändringar och bara en del ska släppas). Kan anges flera gånger.
const uses = opts.flatMap((o, i) => (o === '--use' ? [opts[i + 1]] : [])).filter(Boolean).map((u) => { const at = u.indexOf('='); return at > 0 ? [u.slice(0, at), u.slice(at + 1)] : die(`--use ska vara sökväg=fil: ${u}`); });
const plain = paths.filter((p) => !uses.some(([u]) => u === p.replace(/\\/g, '/')));
if (plain.length) git(['add', '-A', '--', ...plain]);
for (const [dest, src] of uses) {
  if (!fs.existsSync(src)) { git(['reset', '-q']); die(`--use: filen finns inte: ${src}`); }
  const sha = git(['hash-object', '-w', '--path=' + dest, src]);
  git(['update-index', '--add', '--cacheinfo', `100644,${sha},${dest}`]);
}
const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split('\n').filter(Boolean);
if (!staged.length) { die('inga ändringar i de angivna filerna'); }
const WRITTEN_HERE = new Set(['js/version.js', 'version.json', 'CHANGELOG.md', 'sw.js']);
const inIndex = (p) => WRITTEN_HERE.has(p) || gitOk(['cat-file', '-e', ':' + p]);
const missing = [];
for (const f of staged) {
  const isJs = /\.m?js$/.test(f), isHtml = /\.html$/.test(f);
  if (!isJs && !isHtml) continue;
  const src = git(['show', ':' + f]);
  const refs = [];
  if (isJs) for (const m of src.matchAll(/(?:^|[\s;])(?:import|export)\s[^'"`;]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|[\s;])import\s*['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/gm)) refs.push(m[1] || m[2] || m[3]);
  if (isHtml) for (const m of src.matchAll(/<script[^>]+src="(?!https?:)([^"]+)"/g)) refs.push('./' + m[1]);
  for (const r of refs) {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(f), r.split('?')[0]));
    if (target.startsWith('tools/') || /^(node:|https?:)/.test(r)) continue;
    if (!inIndex(target)) missing.push(`${f} → ${target}`);
  }
}
if (missing.length) {
  git(['reset', '-q']);
  die('dessa importer pekar på filer som inte kommer med i släppet (lägg till dem eller vänta):\n    ' + missing.join('\n    '));
}

// --- versionsfilerna och nyheten ---
const section = `## [${V}] – ${DATE} – ${title}\n${notes.join('\n')}\n`;
const clPath = path.join(ROOT, 'CHANGELOG.md');
const cl = fs.readFileSync(clPath, 'utf8');
const at = cl.indexOf(MARK);
if (at < 0) { git(['reset', '-q']); die(`hittar inte markören "${MARK}" i CHANGELOG.md`); }
const lineEnd = cl.indexOf('\n', at) + 1;
const newCl = cl.slice(0, lineEnd) + '\n' + section + cl.slice(lineEnd).replace(/^\n*/, '\n');
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const verJs = `// Skrivs av tools/release.mjs vid varje släpp – ändra inte för hand.\nexport const VERSION = '${V}';\nexport const DATE = '${DATE}';\nexport const TITLE = '${esc(title)}';\n`;
// alla filer som ingår i sidan (för service workerns förladdning och uppdateringens hämtning)
const shipped = git(['ls-files', '--cached']).split('\n').filter((f) => /^(index\.html|sw\.js|version\.json|CHANGELOG\.md|js\/.*\.js|css\/.*\.css|assets\/.*)$/.test(f) && !/^assets\/audio\//.test(f)).sort(); // (ljudet hämtas lat, inte vid varje släpp)
const verJson = JSON.stringify({ version: V, date: DATE, title, files: shipped }, null, 2) + '\n';
const swPath = path.join(ROOT, 'sw.js');
const swSrc = fs.readFileSync(swPath, 'utf8').replace(/const VERSION = '[^']*';/, `const VERSION = '${V}';`);
const subject = `${type}${scope ? `(${scope})` : ''}: ${title}`;
const body = `${subject}\n\n${notes.join('\n')}\n\nVersion ${V}.${flag('no-claude') ? '' : `\n\n${COAUTHOR}`}\n`;

console.log(`${dry ? '[prov] ' : ''}v${cur.join('.')} → v${V}  (${subject})`);
console.log('  filer: ' + staged.join(', '));
if (dry) { git(['reset', '-q']); console.log('\n' + section); process.exit(0); }

fs.writeFileSync(verFile, verJs);
fs.writeFileSync(path.join(ROOT, 'version.json'), verJson);
fs.writeFileSync(clPath, newCl);
fs.writeFileSync(swPath, swSrc);
git(['add', '--', 'js/version.js', 'version.json', 'CHANGELOG.md', 'sw.js']);

const tmp = path.join(os.tmpdir(), `snabbfilen-release-${process.pid}.txt`);
fs.writeFileSync(tmp, body);
git(['commit', '-q', '-F', tmp]);
fs.writeFileSync(tmp, `v${V} – ${title}\n\n${notes.join('\n')}\n`);
git(['tag', '-a', 'v' + V, '-F', tmp]);
fs.rmSync(tmp, { force: true });

const sha = git(['rev-parse', '--short', 'HEAD']);
console.log(`✓ v${V} släppt lokalt som ${sha} med taggen v${V}.`);
if (flag('push')) {
  git(['push', '-q', 'origin', 'main', '--follow-tags'], { stdio: ['ignore', 'inherit', 'inherit'] });
  console.log('✓ publicerad (GitHub Pages bygger om på någon minut).');
} else {
  console.log('  Provkör: node tools/verify.mjs   Publicera: git push origin main --follow-tags');
}
