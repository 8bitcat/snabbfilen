// Regressionstest för 🐾 djurNET MELLAN VÄNNER (js/net/djurvan.js, js/core/djurnetapp.js) – två spelare (Mira och Leo,
// vänner åt båda hållen) mot den RIKTIGA serverkoden (server/kbk-push/src/index.js) i en liten http-server med ett KV i
// minnet (?kbkpush= pekar spelet dit – den riktiga servern kontaktas aldrig):
//   • Mira lägger ut Morris – annonsen läggs ut hos vännerna också ("👥 Syns för dina vänner också")
//   • Leo ser Morris under 🛒 Köp → "Från dina vänner" och köper: Morris flyttar hem till Leo, Leo betalar
//   • Miras spel hämtar beskedet: Morris har flyttat, Mira får pengarna ("Leo köpte Morris på djurNET")
//   • en annons som en vän redan har köpt kan inte säljas till en familj (servern säger att den är såld)
// Kör: node tools/djurvan-test.mjs   (spelservern på 8788, eller SMOKE_PORT / PORT) · SHOTS=1 sparar bilder i tools/out/
import { createRequire } from 'module';
import http from 'node:http';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const worker = (await import(new URL('../server/kbk-push/src/index.js', import.meta.url))).default;

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788, SHOTS = !!process.env.SHOTS, MOCK = 8798 + Math.floor(Math.random() * 50);
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// den riktiga workern bakom en http-server, KV i minnet
const m = new Map();
const KBK = {
  async get(k, typ) { const r = m.get(k); if (!r) return null; return typ === 'json' ? JSON.parse(r.v) : r.v; },
  async getWithMetadata(k, typ) { const r = m.get(k); return r ? { value: typ === 'json' ? JSON.parse(r.v) : r.v, metadata: r.md || null } : { value: null, metadata: null }; },
  async put(k, v, o = {}) { m.set(k, { v, md: o.metadata }); },
  async delete(k) { m.delete(k); },
  async list({ prefix }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name, metadata: m.get(name).md })), list_complete: true }; },
};
const anrop = [];
const server = http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', async () => {
    anrop.push(req.url);
    const r = await worker.fetch(new Request('http://mock' + req.url, { method: req.method, headers: { 'content-type': 'application/json' }, body: req.method === 'POST' ? body : undefined }), { KBK }, { waitUntil() {} });
    res.writeHead(r.status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' });
    res.end(await r.text());
  });
}).listen(MOCK);

const browser = await chromium.launch();
const errs = [];
const MIRA = { vid: '1a'.repeat(8), hemlig: 'a1'.repeat(16) }, LEO = { vid: '2b'.repeat(8), hemlig: 'b2'.repeat(16) };
async function spel(namn, jag, van, vanNamn, pengar, home) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`[${namn}] ${e.message}`));
  await p.addInitScript(() => { window.__toasts = []; new MutationObserver((ms) => { for (const mm of ms) for (const n of mm.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); }).observe(document, { childList: true, subtree: true }); });
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&kbkpush=http://127.0.0.1:${MOCK}&world=dv${Date.now().toString(36)}`);
  await p.evaluate(([namn, jag, van, vanNamn, pengar, home]) => {
    localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-' + namn.toLowerCase(), name: namn, look: { skin: '#e0a97f' }, color: '#ffd23f' }));
    localStorage.setItem('snabbfilen_vanner', JSON.stringify({ ['id-' + namn.toLowerCase()]: { ...jag, lista: [{ vid: van, key: '', namn: vanNamn, look: {}, sedan: '2026-10-12', sett: Date.now() }] } }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 12, min: 600, money: pengar, hunger: 90, energy: 100, home, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
  }, [namn, jag, van, vanNamn, pengar, home]);
  await p.reload().catch(() => {});
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
  await sleep(1500);
  await p.evaluate(() => { const mm = document.querySelector('#modal'); mm.classList.add('hidden'); mm.innerHTML = ''; });
  return p;
}
const M = await spel('Mira', MIRA, LEO.vid, 'Leo', 1000, 'lagenhet');
const L = await spel('Leo', LEO, MIRA.vid, 'Mira', 5000, 'villa');
// (vänlistorna går till servern vid start – vänta in dem)
for (let i = 0; i < 40 && !(m.has(`vl:${MIRA.vid}`) && m.has(`vl:${LEO.vid}`)); i++) await sleep(250);
ok(m.has(`vl:${MIRA.vid}`) && m.has(`vl:${LEO.vid}`), 'båda vänlistorna har kommit till servern');

// ---- Mira lägger ut Morris ----
await M.evaluate(async () => {
  const s = (await import('/js/pets/sim.js')).petStore();
  const a = s.adopt('katt', 'skogkatt', 'hona', 'Morris', SF.game.home, { day: SF.game.day - 10, stage: 'vuxen' }); a.happy = 90; s.save();
  const { annonsera } = await import('/js/pets/djurnet.js');
});
await M.evaluate(async () => (await import('/js/core/djurnetapp.js')).openDjurnet(SF, 'salj')); await sleep(300);
await M.evaluate(() => document.querySelector('#modal [data-lagg]').click()); await sleep(300);
await M.evaluate(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Lägg ut/.test(b.textContent)).click());
for (let i = 0; i < 30 && !m.has(`da:${MIRA.vid}`); i++) await sleep(200);
ok(m.has(`da:${MIRA.vid}`), 'annonsen ligger ute på servern');
await sleep(400);
ok(await M.evaluate(() => SF.game.djurnet.annonser[0]?.van === true && /Syns för dina vänner/.test(document.querySelector('#modal')?.textContent || '')), 'hos Mira: "👥 Syns för dina vänner också"');
const pris = await M.evaluate(() => SF.game.djurnet.annonser[0].pris);
await M.evaluate(() => { const mm = document.querySelector('#modal'); mm.classList.add('hidden'); mm.innerHTML = ''; });

// ---- Leo köper ----
await L.evaluate(async () => (await import('/js/core/djurnetapp.js')).openDjurnet(SF, 'kop'));
await L.waitForFunction(() => !!document.querySelector('#modal [data-vankop]'), null, { timeout: 8000 }).catch(() => {});
const vr = await L.evaluate(() => document.querySelector('#modal [data-vanlista]')?.textContent || '');
ok(/Morris/.test(vr) && /Mira/.test(vr), 'hos Leo: "Från dina vänner" – Morris, säljs av Mira');
if (SHOTS) await L.screenshot({ path: 'tools/out/djurvan-kop.png' });
const l0 = await L.evaluate(() => SF.game.money);
await L.evaluate(() => document.querySelector('#modal [data-vankop]').click());
await L.waitForFunction(() => /Morris har flyttat hem till dig/.test(window.__toasts.join(' | ')), null, { timeout: 8000 }).catch(() => {});
const lk = await L.evaluate(async () => ({ djur: (await import('/js/pets/sim.js')).petStore().pets.map((x) => x.name), pengar: SF.game.money }));
ok(lk.djur.includes('Morris') && lk.pengar === l0 - pris, `Morris har flyttat hem till Leo – Leo betalade ${l0 - lk.pengar} kr`);

// ---- Miras spel hämtar beskedet ----
const m0 = await M.evaluate(() => SF.game.money);
const n = await M.evaluate(async () => (await import('/js/core/djurnetapp.js')).djurnetVanKoll(SF));
const mk = await M.evaluate(async () => ({ djur: (await import('/js/pets/sim.js')).petStore().pets.map((x) => x.name), pengar: SF.game.money, annonser: SF.game.djurnet.annonser.length, t: window.__toasts.join(' | ') }));
ok(n === 1 && !mk.djur.includes('Morris') && mk.pengar === m0 + pris && mk.annonser === 0 && /Leo köpte Morris på djurNET/.test(mk.t), `hos Mira: Morris har flyttat, +${mk.pengar - m0} kr, "Leo köpte Morris på djurNET"`);
ok((await M.evaluate(async () => (await import('/js/core/djurnetapp.js')).djurnetVanKoll(SF))) === 0 && (await M.evaluate(() => SF.game.money)) === m0 + pris, 'beskedet räknas bara en gång');
if (SHOTS) await M.screenshot({ path: 'tools/out/djurvan-sald.png' });

// ---- en annons som en vän redan köpt kan inte säljas till en familj ----
await M.evaluate(async () => {
  const s = (await import('/js/pets/sim.js')).petStore();
  const a = s.adopt('katt', 'tigrerad', 'hane', 'Sixten', SF.game.home, { day: SF.game.day - 6, stage: 'ung' }); a.happy = 90; s.save();
  const { annonsera } = await import('/js/pets/djurnet.js');
  const r = annonsera(SF.game, a.id, 900);
  const { djurVanAnnonsera } = await import('/js/net/djurvan.js');
  const sv = await djurVanAnnonsera(SF, r.annons.id, r.annons.pris, s.snapshot(a.id)); if (sv?.ok) r.annons.van = true;
  r.annons.bud = { familj: 'Familjen Berg', belopp: 900, prutat: false, t: 0, fro: 1, ny: true };
});
// Leo hinner före
await L.evaluate(async () => { const { djurVanLista, djurVanKop } = await import('/js/net/djurvan.js'); const v = await djurVanLista(SF); const a = v[0].annonser[0]; await djurVanKop(SF, v[0].vid, a.id, a.pris); });
await M.evaluate(async () => (await import('/js/core/djurnetapp.js')).openDjurnet(SF, 'salj')); await sleep(300);
await M.evaluate(() => document.querySelector('#modal [data-salj]').click()); await sleep(1200);
const fore = await M.evaluate(async () => ({ t: window.__toasts.join(' | '), djur: (await import('/js/pets/sim.js')).petStore().pets.map((x) => x.name) }));
ok(/En vän hann före/.test(fore.t) && !fore.djur.includes('Sixten') && !/hämtar Sixten/.test(await M.evaluate(() => document.querySelector('#modal .dlg-head')?.textContent || '')), 'en vän hann före: ingen familj får Sixten – vännens köp gäller');

await browser.close();
server.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
