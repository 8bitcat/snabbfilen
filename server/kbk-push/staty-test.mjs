// Prov för 🗽 STATYN (src/index.js raknaPresent/staty/vecka/renLook) med ett låtsas-KV i minnet – ingen wrangler.
//   • vinnaren förra veckan = flest presenter; lika många → den som kom dit först; utseendet följer med
//   • veckans ledare räknas separat (och cachas i tio minuter); förra veckans resultat sparas
//   • ISO-veckor över årsskiftet; utseendet tvättas (bara enkla värden)
// Kör: cd server/kbk-push && node staty-test.mjs
import { raknaPresent, staty, vecka, renLook } from './src/index.js';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
// låtsas-KV: get/put/getWithMetadata/list (med metadata) – samma form som Cloudflare KV
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
const env = { KBK: kv() };
const forraV = Date.parse('2026-10-07T12:00:00Z'), nuV = Date.parse('2026-10-13T12:00:00Z');
ok(vecka(forraV) === '2026-W41' && vecka(nuV) === '2026-W42' && vecka(nuV, true) === '2026-W41', 'veckorna: 7 okt = v41, 13 okt = v42, veckan innan 13 okt = v41');
ok(vecka(Date.parse('2027-01-01T12:00:00Z')) === '2026-W53' && vecka(Date.parse('2027-01-04T12:00:00Z')) === '2027-W01', 'årsskiftet: 1 jan 2027 = 2026-W53, 4 jan = 2027-W01');
// förra veckan: Mira 3 presenter, Leo 3 (men senare), Ella 1
const L1 = { skin: '#c68a5c', hat: 'crown', build: 5 };
await raknaPresent(env, 'aaaaaaaaaaaaaaaa', 'Mira', L1, forraV);
await raknaPresent(env, 'bbbbbbbbbbbbbbbb', 'Leo', { skin: '#fff' }, forraV + 1000);
await raknaPresent(env, 'aaaaaaaaaaaaaaaa', 'Mira', L1, forraV + 2000);
await raknaPresent(env, 'bbbbbbbbbbbbbbbb', 'Leo', null, forraV + 3000);
await raknaPresent(env, 'aaaaaaaaaaaaaaaa', 'Mira', { bad: '<script>', skin: '#c68a5c' }, forraV + 4000);
await raknaPresent(env, 'bbbbbbbbbbbbbbbb', 'Leo', null, forraV + 5000);
await raknaPresent(env, 'cccccccccccccccc', 'Ella', null, forraV + 6000);
// den här veckan: Ella 2
await raknaPresent(env, 'cccccccccccccccc', 'Ella', null, nuV);
await raknaPresent(env, 'cccccccccccccccc', 'Ella', null, nuV + 10);
const s = await staty(env, nuV);
ok(s.forra?.namn === 'Mira' && s.forra.n === 3, `förra veckans vinnare: Mira med 3 (Leo har också 3 men kom dit senare) (${JSON.stringify(s.forra)})`);
ok(s.forra?.look?.skin === '#c68a5c' && !('bad' in (s.forra?.look || {})), `utseendet följer med och är tvättat (${JSON.stringify(s.forra?.look)})`);
ok(s.nu?.namn === 'Ella' && s.nu.n === 2, `veckans ledare: Ella med 2 (${JSON.stringify(s.nu)})`);
ok(!!env.KBK.m.get('vstaty:2026-W41') && !!env.KBK.m.get('vstatynu:2026-W42'), 'resultaten sparas (förra veckan) och cachas (veckans ledare)');
// en tom vecka
const tom = await staty({ KBK: kv() }, nuV);
ok(tom.forra === null && tom.nu === null, 'ingen har skickat något: ingen staty, ingen ledare');
ok(renLook({ a: 'x'.repeat(30), b: 1, 'c d': 'y', e: true }) && !('a' in renLook({ a: 'x'.repeat(30) })), 'renLook: för långa strängar och konstiga nycklar tas bort');
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
