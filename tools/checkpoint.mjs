// Säkerhetskopia av ALLT i spelmappen – även halvfärdigt arbete – som en commit på grenen
// "wip". HEAD, indexet och filerna rörs inte, och main (det publicerade spelet) påverkas inte.
// Används innan stora ändringar och medan agenter jobbar, så att inget kan gå förlorat.
//
//   node tools/checkpoint.mjs "vad som pågår"          (bara lokalt)
//   node tools/checkpoint.mjs "vad som pågår" --push   (även till GitHub som backup)
//
// Hämta tillbaka en fil:  git show wip:js/scenes/shop-mat.js > återställd.js
// Se alla kontrollpunkter: git log --oneline wip
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const note = argv.filter((a) => !a.startsWith('--')).join(' ') || 'kontrollpunkt';
const index = path.join(os.tmpdir(), `snabbfilen-wip-index-${process.pid}`);
const env = { ...process.env, GIT_INDEX_FILE: index };
const git = (args, o = {}) => (execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...o }) ?? '').trim();
const gitOk = (args) => { try { git(args); return true; } catch { return false; } };

try {
  git(['read-tree', 'HEAD'], { env });
  git(['add', '-A'], { env });
  const tree = git(['write-tree'], { env });
  const head = git(['rev-parse', 'HEAD']);
  const wip = gitOk(['rev-parse', '-q', '--verify', 'refs/heads/wip']) ? git(['rev-parse', 'refs/heads/wip']) : null;
  if (wip && git(['rev-parse', wip + '^{tree}']) === tree) {
    console.log('Inget nytt sedan förra kontrollpunkten (' + wip.slice(0, 7) + ').');
    process.exit(0);
  }
  const parents = wip ? ['-p', wip] : ['-p', head];
  if (wip && !gitOk(['merge-base', '--is-ancestor', head, wip])) parents.push('-p', head);
  const stamp = new Date().toLocaleString('sv-SE');
  const commit = git(['commit-tree', tree, ...parents, '-m', `wip: ${note}\n\nKontrollpunkt ${stamp} ovanpå ${head.slice(0, 7)} (main).`]);
  git(['update-ref', 'refs/heads/wip', commit]);
  const stat = git(['diff', '--shortstat', head, commit]);
  console.log(`✓ Kontrollpunkt ${commit.slice(0, 7)} på grenen wip – ${stat || 'samma som main'}.`);
  if (argv.includes('--push')) {
    git(['push', '-q', 'origin', 'wip'], { stdio: ['ignore', 'inherit', 'inherit'] });
    console.log('✓ wip uppladdad till GitHub (main och det publicerade spelet är orörda).');
  }
} finally {
  fs.rmSync(index, { force: true });
}
