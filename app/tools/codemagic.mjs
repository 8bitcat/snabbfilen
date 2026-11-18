// Codemagic via API – token i C:\Users\palss\.secrets\codemagic.txt (läses här, skrivs aldrig ut).
//   node codemagic.mjs apps                      apparna och deras workflows
//   node codemagic.mjs start <appId> <workflowId> [branch]   starta ett bygge (branch: main)
//   node codemagic.mjs status <buildId>          läget för ett bygge
import fs from 'fs';
const T = fs.readFileSync('C:/Users/palss/.secrets/codemagic.txt', 'utf8').replace(/[\r\n\s]/g, '');
const API = 'https://api.codemagic.io';
async function call(method, path, body) {
  const r = await fetch(API + path, { method, headers: { 'x-auth-token': T, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${txt.slice(0, 500)}`);
  return JSON.parse(txt);
}
const [, , cmd, a, b, c] = process.argv;
if (cmd === 'apps') {
  const j = await call('GET', '/apps');
  for (const app of j.applications || []) console.log(app._id, app.appName, app.repository?.htmlUrl || '', '| workflows:', Object.entries(app.workflows || {}).map(([id, w]) => `${id}=${w.name}`).join(', '));
}
if (cmd === 'start') {
  const j = await call('POST', '/builds', { appId: a, workflowId: b, branch: c || 'main' });
  console.log('buildId', j.buildId);
}
if (cmd === 'status') {
  const j = await call('GET', `/builds/${a}`);
  const bld = j.build;
  console.log(bld.status, bld.version || '', bld.startedAt || '', bld.finishedAt || '', (bld.buildActions || []).filter((x) => x.status !== 'success').map((x) => `${x.name}:${x.status}`).join(' ') || 'allt grönt hittills');
  if (bld.artefacts?.length) console.log('artefakter:', bld.artefacts.map((x) => x.name).join(', '));
}
