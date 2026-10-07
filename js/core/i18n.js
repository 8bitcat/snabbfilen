// SPRÅKEN – Carl 2026-10-07: "engelska, spanska, tyska, franska, polska, italienska, portugisiska" och
// "gör om namnen till lokala, både för staden, gatorna och namnen".
//
// Svenskan är källan. Varje text som spelaren ser skrivs på svenska i koden och slås upp i det valda
// språkets ordlista (js/i18n/<id>.js, en vanlig tabell svensk text → översättning). Saknas en
// översättning visas svenskan – inget går sönder medan översättningen pågår. Egennamn (staden,
// stadsdelarna, gatorna, butikerna, personerna) står i ordlistan som alla andra texter, så att varje
// språk får sina egna lokala namn.
//
//   $t`Mums! ${namn} ute på bryggan`  mall: nyckeln blir "Mums! {0} ute på bryggan"
//   $t('Inte nu')                      vanlig text (även skyltar i pixelbilderna: $t('SJÖBODEN'))
//   money(69)                          "69 kr" / "$69" / "69 €" / "69 zł"
//   num(1500)                          talet med språkets tusentalsavgränsare
//   LANG, LANGS, setLang(id)           valt språk, alla språk, byt (sparas och laddar om sidan)
//
// Språket väljs: ?lang=xx → sparat val (snabbfilen_lang) → enhetens språk → engelska. Testrobotarna
// (navigator.webdriver) spelar på svenska om inte ?lang= står i adressen. Ordlistan laddas med
// top-level await, så varje modul som importerar $t har sin ordlista redan när den körs.
// (Namnen $t/$n/$tf: L och N används redan som variabler i ritkoden – de skulle skugga importen.)
export const LANGS = [
  { id: 'sv', name: 'Svenska', locale: 'sv-SE', money: (s) => `${s} kr` },
  { id: 'en', name: 'English', locale: 'en-US', money: (s) => `$${s}` },
  { id: 'es', name: 'Español', locale: 'es-ES', money: (s) => `${s} €` },
  { id: 'de', name: 'Deutsch', locale: 'de-DE', money: (s) => `${s} €` },
  { id: 'fr', name: 'Français', locale: 'fr-FR', money: (s) => `${s} €` },
  { id: 'pl', name: 'Polski', locale: 'pl-PL', money: (s) => `${s} zł` },
  { id: 'it', name: 'Italiano', locale: 'it-IT', money: (s) => `${s} €` },
  { id: 'pt', name: 'Português', locale: 'pt-PT', money: (s) => `${s} €` },
];
const KEY = 'snabbfilen_lang';
const known = (id) => LANGS.some((l) => l.id === id);
function pick() {
  if (typeof window === 'undefined') return 'sv';   // Node-verktygen (typsnittsbygget m.fl.) – alltid källspråket
  try { const q = new URLSearchParams(location.search).get('lang'); if (known(q)) return q; } catch { /* ok */ }
  try { const s = localStorage.getItem(KEY); if (known(s)) return s; } catch { /* privat läge */ }
  if (typeof navigator !== 'undefined' && navigator.webdriver) return 'sv';
  for (const l of (typeof navigator !== 'undefined' && (navigator.languages?.length ? navigator.languages : [navigator.language])) || []) {
    const id = String(l || '').slice(0, 2).toLowerCase();
    if (known(id)) return id;
    if (id === 'nb' || id === 'nn' || id === 'no' || id === 'da') return 'sv';   // grannspråken förstår svenska bättre än engelska
  }
  return 'en';
}
export const LANG = pick();
export const LANG_INFO = LANGS.find((l) => l.id === LANG);
if (typeof document !== 'undefined') document.documentElement.lang = LANG;

// ordlistan (bara det valda språket laddas). Går den inte att ladda visas svenskan.
let DICT = {}, LISTS = null;
if (LANG !== 'sv') {
  try { const m = await import(`../i18n/${LANG}.js`); DICT = m.default || {}; LISTS = m.LISTS || null; } catch (e) { console.warn(`språket ${LANG} kunde inte laddas:`, e); }
}
// språkets egna namnlistor (girls, boys, pets, horses, surnames) – annars den svenska listan
export const list = (name, sv) => (Array.isArray(LISTS?.[name]) && LISTS[name].length ? LISTS[name] : sv);
// texter som saknar översättning (för verktygen: tools/i18n-*.mjs läser window.__i18nMiss)
const MISS = new Set();
if (typeof window !== 'undefined') window.__i18nMiss = MISS;
function look(key) {
  const v = DICT[key];
  if (typeof v === 'string') return v;
  if (LANG !== 'sv') MISS.add(key);
  return key;
}
const fill = (s, vals) => s.replace(/\{(\d+)\}/g, (_, i) => { const v = vals[+i]; return v === undefined || v === null ? '' : String(v); });
// mallens nyckel: delarna ihop med {0}, {1} … där värdena sitter
const keyOf = (parts) => parts.reduce((a, p, i) => a + (i ? `{${i - 1}}` : '') + p, '');
// $t-mallar anropas i ritlooparna varje bildruta: översättningen för varje mall (samma strings-objekt
// per anropsställe) slås upp EN gång och delas upp i bitar [text, index, text, …] som sedan bara fylls i
const TPL = new WeakMap();
function compiled(parts) {
  let c = TPL.get(parts);
  if (c) return c;
  const key = keyOf(parts), tr = look(key), segs = [];
  let last = 0;
  tr.replace(/\{(\d+)\}/g, (m, i, at) => { segs.push(tr.slice(last, at), +i); last = at + m.length; return m; });
  segs.push(tr.slice(last));
  c = { segs, key, tr };
  // en saknad översättning ska räknas varje gång den visas (verktygen) – cacha bara de som finns
  if (tr !== key || typeof DICT[key] === 'string') TPL.set(parts, c);
  return c;
}
export function $t(s, ...vals) {
  if (Array.isArray(s) && s.raw) {
    if (LANG === 'sv') {   // svenska: precis som en vanlig mall (samma text som före översättningarna)
      let out = s[0];
      for (let i = 1; i < s.length; i++) out += vals[i - 1] + s[i];
      return out;
    }
    const { segs } = compiled(s);
    let out = '';
    for (let i = 0; i < segs.length; i++) {
      const x = segs[i];
      if (typeof x === 'string') out += x; else { const v = vals[x]; out += v === undefined || v === null ? '' : String(v); }
    }
    return out;
  }
  if (s === undefined || s === null) return '';
  return LANG === 'sv' ? String(s) : look(String(s));
}
// baklänges: en översatt text → den svenska nyckeln (för logik som behöver de svenska orden, t.ex.
// möbelvaruhusets avdelningar efter varans namn). Fyllda mallar hittas inte – där returneras texten.
let REV = null;
export function $sv(s) {
  if (LANG === 'sv' || s === undefined || s === null) return s;
  if (!REV) { REV = new Map(); for (const [k, v] of Object.entries(DICT)) if (!REV.has(v)) REV.set(v, k); }
  return REV.get(String(s)) ?? String(s);
}
// tyst uppslagning (räknas inte som saknad): översättningen eller null
export const $tq = (s) => (LANG === 'sv' ? s : typeof DICT[s] === 'string' ? DICT[s] : null);
// texten med {0}-platser ifylld (när mallen byggs på annat håll, t.ex. i en tabell)
export const $tf = (key, ...vals) => fill($t(key), vals);
// markerar en text som ska översättas där den VISAS men som används som id i logiken (stadsdelarnas
// namn, skyltar som jämförs …): $n('LINNÉSTADEN') lämnar texten orörd, $t(d.name) översätter vid visning.
// Verktyget tools/i18n-nycklar.mjs hittar $n('…') precis som $t('…').
export const $n = (s) => s;
const NF = (() => { try { return new Intl.NumberFormat(LANG_INFO.locale, { maximumFractionDigits: 0 }); } catch { return null; } })();
export const num = (n) => (NF ? NF.format(Math.round(+n || 0)) : String(Math.round(+n || 0)));
export const money = (n) => LANG_INFO.money(num(n));
export function setLang(id) {
  if (!known(id) || id === LANG) return;
  try { localStorage.setItem(KEY, id); } catch { /* ok */ }
  try { window.dispatchEvent(new Event('sf:before-reload')); window.SF?.game?.save?.(); } catch { /* ok */ }
  const u = new URL(location.href); u.searchParams.delete('lang');
  location.replace(u.toString());
}
