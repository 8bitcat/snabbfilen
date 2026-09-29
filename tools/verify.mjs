// Provkör en commit isolerat innan den publiceras: checkar ut den i en tillfällig worktree
// bredvid spelmappen, startar en egen server där och kör hela röktestet mot den. Arbets-
// katalogen (där agenter kan hålla på) rörs inte.
//
//   node tools/verify.mjs                (HEAD, port 8791)
//   node tools/verify.mjs v0.14.0 --port 8792
//   node tools/verify.mjs --extra tools/mp-test.mjs      (kör även fler testskript i kopian)
//   node tools/verify.mjs --klad                          (+ klädaffärens, sko-, accessoar- och frisörtesterna)
//
// ALLTID körs dessutom (om skriptet finns i versionen): tools/garderob-kop-test.mjs – hela kedjan
// dörren i staden → köp i klädaffären/skobutiken/accessoarbutiken/frisören → garderoben hemma.
//
// Loggen hamnar i tools/out/verify-<ref>.log. Slutkod 0 = allt grönt.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const ref = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--port' && argv[i - 1] !== '--extra') || 'HEAD';
const port = argv.includes('--port') ? argv[argv.indexOf('--port') + 1] : '8791';
const ALWAYS = ['tools/garderob-kop-test.mjs'];
const KLAD = ['tools/klader-test.mjs', 'tools/skor-test.mjs', 'tools/accessoarer-test.mjs', 'tools/frisor-test.mjs'];
const extras = [...new Set([...ALWAYS, ...(argv.includes('--klad') ? KLAD : []),
  ...argv.flatMap((a, i) => (a === '--extra' ? [argv[i + 1]] : [])).filter(Boolean)])];
const dir = path.resolve(ROOT, '..', `snabbfilen-verify-${port}`);
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function removeWorktree() {
  try { git(['worktree', 'remove', '--force', dir]); } catch { /* fanns inte */ }
  fs.rmSync(dir, { recursive: true, force: true });
  try { git(['worktree', 'prune']); } catch { /* ok */ }
}

const sha = git(['rev-parse', '--short', ref]);
removeWorktree();
git(['worktree', 'add', '--detach', dir, ref]);
console.log(`Provkör ${ref} (${sha}) i ${dir} på port ${port} …`);

const server = spawn('python', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: dir, stdio: 'ignore' });
let code = 1;
try {
  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    try { up = (await fetch(`http://127.0.0.1:${port}/index.html`)).ok; } catch { await sleep(250); }
  }
  if (!up) throw new Error('servern startade inte');

  const out = [];
  const runScript = (script) => new Promise((resolve) => {
    out.push(`
=== ${script} ===
`);
    const p = spawn('node', [script], { cwd: dir, env: { ...process.env, SMOKE_PORT: port }, stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.on('data', (b) => out.push(b.toString()));
    p.stderr.on('data', (b) => out.push(b.toString()));
    p.on('close', (c) => resolve(c ?? 1));
  });
  code = await runScript('tools/smoke.mjs');
  for (const x of extras) {
    if (ALWAYS.includes(x) && !fs.existsSync(path.join(dir, x))) continue; // äldre version utan skriptet
    const c = await runScript(x); if (c !== 0) code = code || c;
  }
  const log = out.join('');
  const logFile = path.join(ROOT, 'tools/out', `verify-${ref.replace(/[^\w.-]/g, '_')}.log`);
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.writeFileSync(logFile, log);
  const lines = log.split(/\r?\n/);
  const passed = lines.filter((l) => l.includes('✓')).length;
  const failed = lines.filter((l) => l.includes('✗'));
  if (code === 0 && !failed.length) console.log(`✓ ${sha}: ALLT GRÖNT (${passed} kontroller). Logg: ${logFile}`);
  else {
    console.log(`✗ ${sha}: ${failed.length} fel av ${passed + failed.length} (slutkod ${code}). Logg: ${logFile}`);
    for (const l of failed) console.log('   ' + l.trim());
    const tail = lines.slice(-8).join('\n');
    if (!failed.length) console.log(tail);
    if (code === 0) code = 1;
  }
} catch (e) {
  console.log('✗ ' + e.message);
  code = 1;
} finally {
  server.kill();
  await sleep(300);
  removeWorktree();
}
process.exit(code);
