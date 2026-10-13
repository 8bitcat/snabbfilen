// Prov för 🐾 djurNET mellan vänner (src/index.js /djur/…) – workern körs direkt mot ett låtsas-KV i minnet (ingen wrangler):
//   • Mira lägger ut Morris (beskrivningen tvättas: konstiga fält och för långa namn försvinner), högst tre annonser
//   • Leo (vän åt båda hållen) ser annonsen i /djur/lista – Ella (bara på Miras lista, inte tvärtom) ser den inte
//   • Leo köper: fel pris → 409 med rätt pris, rätt pris → Morris; annonsen är borta; Ella kan inte köpa (inte vänner)
//   • Mira hämtar beskedet (/djur/salda: Leo, 1 200 kr) och kvitterar; /djur/tabort på en såld annons → fanns: false
//   • fel hemlighet → 403
// Kör: cd server/kbk-push && node djur-test.mjs
import worker from './src/index.js';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
function kv() {
  const m = new Map();
  return {
    m,
    async get(k, typ) { const r = m.get(k); if (!r) return null; return typ === 'json' ? JSON.parse(r.v) : r.v; },
    async getWithMetadata(k, typ) { const r = m.get(k); return r ? { value: typ === 'json' ? JSON.parse(r.v) : r.v, metadata: r.md || null } : { value: null, metadata: null }; },
    async put(k, v, o = {}) { m.set(k, { v, md: o.metadata }); },
    async delete(k) { m.delete(k); },
    async list({ prefix }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name, metadata: m.get(name).md })), list_complete: true }; },
  };
}
const env = { KBK: kv() }, ctx = { waitUntil() {} };
const post = async (path, data) => { const r = await worker.fetch(new Request('https://kbk.test' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }), env, ctx); return { status: r.status, ...(await r.json()) }; };
const MIRA = { vid: '1a'.repeat(8), hemlig: 'a1'.repeat(16), namn: 'Mira' }, LEO = { vid: '2b'.repeat(8), hemlig: 'b2'.repeat(16), namn: 'Leo' }, ELLA = { vid: '3c'.repeat(8), hemlig: 'c3'.repeat(16), namn: 'Ella' };
// vänlistorna: Mira ↔ Leo åt båda hållen; Mira har Ella på sin lista men Ella inte Mira
ok((await post('/van/vanner', { ...MIRA, vanner: [LEO.vid, ELLA.vid] })).ok, 'Miras vänlista (Leo och Ella)');
ok((await post('/van/vanner', { ...LEO, vanner: [MIRA.vid] })).ok, 'Leos vänlista (Mira)');
ok((await post('/van/vanner', { ...ELLA, vanner: [] })).ok, 'Ellas tomma lista');

const MORRIS = { name: 'Morris<script>alla', species: 'katt', breed: 'skogkatt', sex: 'hona', alder: 12, stage: 'vuxen', grow: 320, happy: 90, seed: 4711, utst: { katt: [2, 1, 0], bis: 1, hack: [9, 9] }, frisyr: { s: 'lejon', f: 'rosa' }, x: 'bort', lover: 'p3' };
const a1 = await post('/djur/annons', { ...MIRA, id: 'amorris', pris: 1200, snap: MORRIS });
ok(a1.ok, 'Mira lägger ut Morris för 1 200 kr');
const sparad = (await env.KBK.get(`da:${MIRA.vid}`, 'json'))[0].snap;
ok(sparad.name === 'Morrisscriptall' || (sparad.name.length <= 16 && !/[<>]/.test(sparad.name)), `namnet tvättas (${sparad.name})`);
ok(!('x' in sparad) && !('lover' in sparad) && !('hack' in sparad.utst) && sparad.utst.bis === 1 && sparad.frisyr?.s === 'lejon', 'beskrivningen tvättas: bara kända fält följer med');
ok((await post('/djur/annons', { ...MIRA, id: 'ab', pris: 10, snap: { ...MORRIS, species: 'drake' } })).status === 400, 'okänd art → 400');
await post('/djur/annons', { ...MIRA, id: 'a2', pris: 500, snap: { ...MORRIS, name: 'Sixten' } });
await post('/djur/annons', { ...MIRA, id: 'a3', pris: 500, snap: { ...MORRIS, name: 'Sotis' } });
ok((await post('/djur/annons', { ...MIRA, id: 'a4', pris: 500, snap: MORRIS })).status === 429, 'en fjärde annons → 429 (högst tre)');
ok((await post('/djur/annons', { ...MIRA, id: 'a3', pris: 450, snap: { ...MORRIS, name: 'Sotis' } })).ok, 'samma annons igen ersätts (nytt pris)');

const ll = await post('/djur/lista', { ...LEO });
ok(ll.ok && ll.vanner.length === 1 && ll.vanner[0].namn === 'Mira' && ll.vanner[0].annonser.length === 3, `Leo ser Miras tre annonser (${JSON.stringify(ll.vanner?.map((v) => [v.namn, v.annonser.length]))})`);
ok((await post('/djur/lista', { ...ELLA })).vanner.length === 0, 'Ella ser inget (inte vänner åt båda hållen)');

const fel = await post('/djur/kop', { ...LEO, saljare: MIRA.vid, id: 'amorris', pris: 900 });
ok(fel.status === 409 && fel.pris === 1200, 'fel pris → 409 med det riktiga priset');
const kop = await post('/djur/kop', { ...LEO, saljare: MIRA.vid, id: 'amorris', pris: 1200 });
ok(kop.ok && kop.snap?.species === 'katt' && kop.snap.utst?.bis === 1, 'Leo köper Morris – får beskrivningen');
ok((await post('/djur/kop', { ...LEO, saljare: MIRA.vid, id: 'amorris', pris: 1200 })).status === 409, 'samma annons igen → 409 (redan såld)');
ok((await post('/djur/kop', { ...ELLA, saljare: MIRA.vid, id: 'a2', pris: 500 })).status === 403, 'Ella kan inte köpa (inte vänner) → 403');
ok((await post('/djur/lista', { ...LEO })).vanner[0].annonser.length === 2, 'Morris annons är borta ur listan');

const sl = await post('/djur/salda', { ...MIRA });
ok(sl.ok && sl.salda.length === 1 && sl.salda[0].kopare === 'Leo' && sl.salda[0].pris === 1200 && sl.salda[0].id === 'amorris', `Mira får beskedet: Leo köpte för 1 200 kr (${JSON.stringify(sl.salda)})`);
ok((await post('/djur/kvittera', { ...MIRA, ids: ['amorris'] })).kvar === 0 && (await post('/djur/salda', { ...MIRA })).salda.length === 0, 'kvittera tömmer lådan');
ok((await post('/djur/tabort', { ...MIRA, id: 'amorris' })).fanns === false, '/djur/tabort på den sålda annonsen → fanns: false');
ok((await post('/djur/tabort', { ...MIRA, id: 'a2' })).fanns === true, '/djur/tabort på en annons som finns → fanns: true');
ok((await post('/djur/lista', { ...MIRA, hemlig: 'f0'.repeat(16) })).status === 403, 'fel hemlighet → 403');
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
