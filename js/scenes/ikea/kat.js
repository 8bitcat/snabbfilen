// Katalogen läses vid körning (GAME.KATALOG växer när nya möbler läggs till).
import * as GAME from '../../game.js';
import { FRAMES } from '../../data/frames.js';
import { SMALL, textW } from '../../core/floor-pix.js';

// DATORSAKERNA säljs inte längre på MÖBELJÄTTEN utan i elektronikbutiken BLIXT i Downtown
// (js/scenes/shop-elektronik.js). De ligger kvar i GAME.KATALOG – sparfiler, förrådet,
// Möblera och försäljning hemma fungerar precis som förut – men varuhuset ställer inte ut dem.
// En katalogpost med shop: 'elektronik' räknas också hit (om fler prylar läggs till).
export const ELEKTRONIK = new Set(['tv', 'retrotv', 'spelkonsol', 'datortorn', 'dator', 'laptop', 'telefon']);
export const isElektronik = (k) => { const kind = typeof k === 'string' ? k : k?.kind; return ELEKTRONIK.has(kind) || (typeof k === 'object' && k?.shop === 'elektronik'); };
// vad en utställd elektronikpryl heter i varuhusets texter ("Gamingriggen är bara utställd")
// – TV-sorten är både platt-TV:n (modell 1) och gamingriggarna (övriga modeller)
const ELEK_NAMN = { retrotv: 'Retro-TV:n', spelkonsol: 'Spelkonsolen', datortorn: 'Datortornet', dator: 'Datorn', laptop: 'Den bärbara datorn', telefon: 'Telefonen' };
export const elektronikName = (k, v = 0) => (k === 'tv' ? ((v | 0) === 1 ? 'TV:n' : 'Gamingriggen') : ELEK_NAMN[k] || 'Den');
const ALL = () => (Array.isArray(GAME.KATALOG) ? GAME.KATALOG : []);
// Möbeljättens sortiment = katalogen utan elektroniken
export const KAT = () => ALL().filter((k) => k && !isElektronik(k) && k.shop !== 'jul'); // (julpyntet säljs på klädaffärens julvåning)
export const katOf = (k) => (isElektronik(k) ? null : ALL().find((x) => x.kind === k && !isElektronik(x) && x.shop !== 'jul') || null);
export const frameOf = (k, v) => FRAMES[k + (v | 0)] || FRAMES[k + '0'] || null;
// platta saker som ligger på golvet (mattor) – ritas under allt annat och går att gå på
export const isFlat = (k) => k === 'matta' || /matta$/.test(k);
export function dims(k, v) {
  if (k === 'matta') return { w: 90, h: 48 };
  const f = frameOf(k, v);
  return f ? { w: f[2], h: f[3] } : { w: 24, h: 18 }; // ingen sprite än → platt kartong
}
export const varOf = (k, v) => {
  const kat = katOf(k);
  let n = Math.max(0, v | 0);
  if (kat?.vars) n = Math.min(kat.vars - 1, n);
  else if (Array.isArray(kat?.variants)) n = Math.min(kat.variants.length - 1, n);
  return k === 'matta' || FRAMES[k + n] ? n : 0;
};
export const isWallKind = (k) => !!katOf(k)?.wall;
// typsnittet saknar en del tecken – byt ut dem mot något läsbart
const clean = (s) => String(s).toUpperCase().replace(/&/g, 'OCH').replace(/[–—]/g, '-').replace(/[^A-ZÅÄÖÉ0-9 .,:!?'/%+=-]/g, '');
// långa namn kortas vid ett ordmellanrum (inte mitt i ett ord); en avhuggen
// bisats ("… MED TVÅ", "… OCH") tas bort helt ("BOKHYLLA MED TVÅ HYLLOR" → "BOKHYLLA")
const TAG_MAX = 20;
function shorten(s) {
  if (s.length <= TAG_MAX) return s;
  const head = s.slice(0, TAG_MAX + 1), sp = head.lastIndexOf(' ');
  const cut = sp >= 6 ? head.slice(0, sp) : s.slice(0, TAG_MAX);
  const trimmed = cut.replace(/\s+(MED|OCH|I|FÖR|PÅ|AV|TILL|UTAN)(\s.*)?$/, '');
  return trimmed.length >= 4 ? trimmed : cut;
}
export const tagName = (k) => shorten(clean(katOf(k)?.name || k));
export const tagPrice = (k) => `${katOf(k)?.price ?? '?'}:-`;
export const tagDims = (k) => ({ w: Math.max(textW(SMALL, tagName(k)), textW(SMALL, tagPrice(k))) + 6, h: 15 });
export const signText = clean;
// En signatur som ändras när katalogen eller atlasens ramar ändras (då byggs varuhuset om).
export const katSig = () => KAT().map((k) => `${k.kind}:${k.price}:${k.room || ''}:${k.wall ? 1 : 0}`).join('|') + '#' + Object.keys(FRAMES).length;
