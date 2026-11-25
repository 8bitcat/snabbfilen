// Pixelcity i App Store Connect via API (2026-11-24): ny appversion, butikstexterna på alla språk, bygget och inskicket.
// Nyckeln (Codemagic-nyckeln 94H7H2CY53, App Manager) läses bara för att signera anropen – skrivs aldrig ut.
// Texterna: app/appstore-sprak.md (alla språk utom svenska) och app/appstore.md (svenska, första avsnittet).
//   node app/tools/asc-store.mjs lage              versionerna och vilka språk som finns
//   node app/tools/asc-store.mjs version           skapa iOS-versionen appVersion (app/package.json) om den saknas
//   node app/tools/asc-store.mjs texter            texter + undertitel + Nyheter på alla språk (skapar språk som saknas)
//   node app/tools/asc-store.mjs bygge [nr]        koppla bygget (senaste giltiga för versionen om nr saknas)
//   node app/tools/asc-store.mjs skicka            skicka versionen till App Review
// Skärmbilder: språk utan egna bilder visar huvudspråkets bilder i App Store.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ISS = '08e19ca3-bbeb-4a09-8096-06f1e3eb6e4b', KID = '94H7H2CY53', APP = '6818844405';
const key = fs.readFileSync('C:/Users/palss/Downloads/AuthKey_94H7H2CY53.p8', 'utf8');
const ROT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../..');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROT, 'app/package.json'), 'utf8')).appVersion;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt() {
  const n = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'ES256', kid: KID, typ: 'JWT' }), p = b64({ iss: ISS, iat: n, exp: n + 1200, aud: 'appstoreconnect-v1' });
  return `${h}.${p}.${crypto.sign('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}
const API = 'https://api.appstoreconnect.apple.com';
async function call(method, p, body) {
  const r = await fetch(p.startsWith('http') ? p : API + p, { method, headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text();
  let j = null; try { j = JSON.parse(txt); } catch { /* tomt */ }
  if (!r.ok) { const e = new Error(`${method} ${p} → ${r.status}: ${txt.slice(0, 900)}`); e.status = r.status; throw e; }
  return j;
}
const get = (p) => call('GET', p);
async function alla(p) { const out = []; let next = p; while (next) { const j = await get(next); out.push(...(j.data || [])); next = j.links?.next || null; } return out; }
const steg = async (namn, fn) => { try { const r = await fn(); console.log(`✓ ${namn}${r ? ' – ' + r : ''}`); } catch (e) { console.log(`✗ ${namn}\n  ${e.message}`); process.exitCode = 1; } };

const SUPPORT = 'https://8bitcat.github.io/snabbfilen/support.html';
const MARKNAD = 'https://8bitcat.github.io/snabbfilen/';
const NAMN = { no: 'Pixelcity – livssimulator' };
const LOC = { English: 'en-US', Español: 'es-ES', Deutsch: 'de-DE', Français: 'fr-FR', Polski: 'pl', Italiano: 'it', Português: 'pt-PT', Nederlands: 'nl-NL', Norsk: 'no', Dansk: 'da', Bahasa: 'id', Türkçe: 'tr', Tiếng: 'vi' };
// Nyheter i 1.5 (whatsNew, högst 4000 tecken, inga emojier). 1.4: de sex nya språken och saker på saker i Dockskåpet.
const NYTT = {
  sv: 'Nytt rum i Dockskåpet: Rymdstationen, med raket, robot, sovkapsel, utomjording och fönster mot jorden och månen.\n\nBjud in dina vänner till Dockskåpet med en notis – de kommer rätt in i ditt hus och ni bygger tillsammans.\n\nNytt i Butiken: motorbåten, Röda stugan på Solön och Djurparkens årskort – dina för alltid.',
  'en-US': 'A new room in the Dollhouse: the Space Station, with a rocket, robot, sleep pod, alien and windows facing Earth and the Moon.\n\nInvite your friends to the Dollhouse with a notification – they come straight into your house and you build together.\n\nNew in the Shop: the motorboat, the Red Cottage on Sun Island and the Zoo annual pass – yours forever.',
  'es-ES': 'Nueva habitación en la casa de muñecas: la estación espacial, con cohete, robot, cápsula para dormir, extraterrestre y ventanas a la Tierra y la Luna.\n\nInvita a tus amigos a la casa de muñecas con una notificación: entran directamente en tu casa y construís juntos.\n\nNovedades en la tienda: la lancha motora, la Cabaña Roja de Isla Sol y el pase anual del Zoo, tuyos para siempre.',
  'de-DE': 'Ein neues Zimmer im Puppenhaus: die Raumstation, mit Rakete, Roboter, Schlafkapsel, Außerirdischem und Fenstern zur Erde und zum Mond.\n\nLade deine Freunde mit einer Mitteilung ins Puppenhaus ein – sie kommen direkt in dein Haus und ihr baut zusammen.\n\nNeu im Shop: das Motorboot, die Rote Hütte auf der Sonneninsel und die Tierpark-Jahreskarte – für immer deins.',
  'fr-FR': "Une nouvelle pièce dans la maison de poupée : la station spatiale, avec fusée, robot, capsule de sommeil, extraterrestre et hublots sur la Terre et la Lune.\n\nInvite tes amis dans la maison de poupée avec une notification : ils arrivent directement chez toi et vous construisez ensemble.\n\nNouveau dans la boutique : le bateau à moteur, la Cabane rouge de l'Île du Soleil et l'abonnement au Zoo – à toi pour toujours.",
  pl: 'Nowy pokój w domku dla lalek: stacja kosmiczna z rakietą, robotem, kapsułą do spania, kosmitą i oknami na Ziemię i Księżyc.\n\nZaproś przyjaciół do domku dla lalek powiadomieniem – trafią prosto do twojego domu i budujecie razem.\n\nNowość w sklepie: motorówka, Czerwona Chata na Słonecznej Wyspie i roczny karnet do Zoo – twoje na zawsze.',
  it: "Una nuova stanza nella casa delle bambole: la stazione spaziale, con razzo, robot, capsula per dormire, alieno e oblò sulla Terra e sulla Luna.\n\nInvita i tuoi amici nella casa delle bambole con una notifica: entrano dritti in casa tua e costruite insieme.\n\nNovità nel negozio: il motoscafo, la Casetta rossa sull'Isola del Sole e l'abbonamento allo Zoo – tuoi per sempre.",
  'pt-PT': 'Uma nova divisão na casa de bonecas: a estação espacial, com foguetão, robô, cápsula de dormir, extraterrestre e janelas para a Terra e a Lua.\n\nConvida os teus amigos para a casa de bonecas com uma notificação – entram direto na tua casa e constroem juntos.\n\nNovo na loja: o barco a motor, a Cabana Vermelha na Ilha do Sol e o passe anual do Zoo – teus para sempre.',
  'nl-NL': 'Een nieuwe kamer in het poppenhuis: het ruimtestation, met raket, robot, slaapcapsule, buitenaards wezen en ramen naar de aarde en de maan.\n\nNodig je vrienden uit in het poppenhuis met een melding – ze komen meteen in je huis en jullie bouwen samen.\n\nNieuw in de winkel: de motorboot, het Rode Huisje op Zonneland en de jaarkaart voor de Dierentuin – voor altijd van jou.',
  no: 'Et nytt rom i Dukkehuset: romstasjonen, med rakett, robot, sovekapsel, romvesen og vinduer mot jorda og månen.\n\nInviter vennene dine til Dukkehuset med et varsel – de kommer rett inn i huset ditt, og dere bygger sammen.\n\nNytt i butikken: motorbåten, Rødhytta på Soløya og årskortet til Dyreparken – dine for alltid.',
  da: 'Et nyt rum i Dukkehuset: rumstationen, med raket, robot, sovekapsel, rumvæsen og vinduer mod Jorden og Månen.\n\nInviter dine venner ind i Dukkehuset med en notifikation – de kommer lige ind i dit hus, og I bygger sammen.\n\nNyt i butikken: motorbåden, Det røde hus på Solø og årskortet til Dyreparken – dine for altid.',
  id: 'Ruang baru di Rumah Boneka: stasiun luar angkasa, dengan roket, robot, kapsul tidur, alien, dan jendela ke Bumi dan Bulan.\n\nAjak sahabatmu ke Rumah Boneka dengan notifikasi – mereka langsung masuk ke rumahmu dan kalian membangun bersama.\n\nBaru di toko: perahu motor, Pondok Merah di Pulau Surya, dan kartu tahunan Taman Satwa – milikmu selamanya.',
  tr: "Oyuncak Ev'de yeni bir oda: roket, robot, uyku kapsülü, uzaylı ve Dünya'ya ve Ay'a bakan pencereleriyle uzay istasyonu.\n\nArkadaşlarını bir bildirimle Oyuncak Ev'e davet et – doğrudan evine gelirler ve birlikte inşa edersiniz.\n\nMağazada yeni: motorlu tekne, Güneş Adası'ndaki Kırmızı Ev ve Hayvanat Bahçesi yıllık kartı – sonsuza dek senin.",
  vi: 'Phòng mới trong Nhà búp bê: trạm vũ trụ, có tên lửa, rô-bốt, khoang ngủ, người ngoài hành tinh và cửa sổ nhìn ra Trái Đất và Mặt Trăng.\n\nMời bạn bè vào Nhà búp bê bằng một thông báo – họ vào thẳng nhà bạn và cùng nhau xây dựng.\n\nMới trong cửa hàng: xuồng máy, Nhà Gỗ Đỏ trên Đảo Nắng và vé năm Sở thú – của bạn mãi mãi.',
};

// ---- texterna ur markdown ----
const block = (s, rubrik) => { const m = s.match(new RegExp(`\\*\\*${rubrik}\\*\\*[^\\n]*\\n\`\`\`\\n([\\s\\S]*?)\\n\`\`\``)); return m ? m[1].trim() : null; };
function texter() {
  const out = {};
  const md = fs.readFileSync(path.join(ROT, 'app/appstore-sprak.md'), 'utf8');
  for (const sek of md.split(/\n(?=## )/).filter((s) => s.startsWith('## '))) {
    const ord = sek.slice(3).split(/[\s(–]/)[0];
    const loc = LOC[ord];
    if (!loc) continue;
    out[loc] = { subtitle: sek.match(/\*\*Subtitle:\*\* `([^`]+)`/)?.[1], promotionalText: block(sek, 'Promotional Text'), keywords: block(sek, 'Keywords'), description: block(sek, 'Description') };
  }
  const sv = fs.readFileSync(path.join(ROT, 'app/appstore.md'), 'utf8').split(/\n(?=## )/)[1];
  if (out['pt-PT']) out['pt-BR'] = { ...out['pt-PT'] };   // Brasilien får den portugisiska texten
  out.sv = { promotionalText: block(sv, 'Promotional Text'), keywords: block(sv, 'Keywords'), description: block(sv, 'Description') };
  for (const [loc, t] of Object.entries(out)) {
    for (const [f, max] of [['subtitle', 30], ['promotionalText', 170], ['keywords', 100], ['description', 4000]]) if (t[f] && [...t[f]].length > max) throw new Error(`${loc} ${f}: ${[...t[f]].length} > ${max}`);
    if (!t.description || !t.keywords || !t.promotionalText) throw new Error(`${loc}: text saknas`);
    t.whatsNew = NYTT[loc === 'pt-BR' ? 'pt-PT' : loc]?.replace(/s*(med|with|con|mit|avec|przez|com|met|dengan|bằng) 👫|👫 ile /g, '');   // Apple tar inga emojier i Nyheter
    if (!t.whatsNew) throw new Error(`${loc}: Nyheter saknas`);
  }
  return out;
}

async function versionen() {
  const v = await alla(`/v1/apps/${APP}/appStoreVersions?filter[platform]=IOS&limit=20`);
  return v.find((x) => x.attributes.versionString === VERSION) || null;
}
async function appInfo() {
  const infos = await alla(`/v1/apps/${APP}/appInfos`);
  return infos.find((i) => i.attributes.state === 'PREPARE_FOR_SUBMISSION') || infos.find((i) => !['READY_FOR_DISTRIBUTION', 'REPLACED_WITH_NEW_INFO'].includes(i.attributes.state)) || infos[0];
}

const [, , cmd, arg] = process.argv;
if (cmd === 'lage') {
  const v = await alla(`/v1/apps/${APP}/appStoreVersions?filter[platform]=IOS&limit=5`);
  for (const x of v) console.log(x.attributes.versionString, x.attributes.appStoreState || x.attributes.appVersionState, x.id);
  const ver = await versionen();
  if (ver) console.log(`${VERSION} språk:`, (await alla(`/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`)).map((l) => l.attributes.locale).join(' '));
  const info = await appInfo();
  console.log('appInfo', info.id, (await alla(`/v1/appInfos/${info.id}/appInfoLocalizations`)).map((l) => `${l.attributes.locale}:${l.attributes.subtitle || '-'}`).join(' | '));
  const t = texter();
  console.log('texter i markdown:', Object.keys(t).join(' '));
}
if (cmd === 'version') {
  await steg(`iOS ${VERSION}`, async () => {
    const v = await versionen();
    if (v) return `finns redan (${v.attributes.appStoreState})`;
    const j = await call('POST', '/v1/appStoreVersions', { data: { type: 'appStoreVersions', attributes: { platform: 'IOS', versionString: VERSION, releaseType: 'AFTER_APPROVAL' }, relationships: { app: { data: { type: 'apps', id: APP } } } } });
    return `skapad ${j.data.id}`;
  });
}
if (cmd === 'texter') {
  const T = texter();
  const ver = await versionen();
  if (!ver) throw new Error(`iOS ${VERSION} finns inte – kör version först`);
  const info = await appInfo();
  const il = Object.fromEntries((await alla(`/v1/appInfos/${info.id}/appInfoLocalizations`)).map((l) => [l.attributes.locale, l]));
  const policy = Object.values(il).find((l) => l.attributes.privacyPolicyUrl)?.attributes.privacyPolicyUrl;
  for (const [loc, t] of Object.entries(T)) {
    if (!t.subtitle && il[loc]) continue;   // svenska: undertiteln står kvar som den är
    await steg(`namn/undertitel ${loc}`, async () => {
      const attrs = { name: NAMN[loc] || 'Pixelcity', ...(t.subtitle ? { subtitle: t.subtitle } : {}), ...(policy ? { privacyPolicyUrl: policy } : {}) };
      if (il[loc]) { const { name, ...utan } = attrs; await call('PATCH', `/v1/appInfoLocalizations/${il[loc].id}`, { data: { type: 'appInfoLocalizations', id: il[loc].id, attributes: utan } }); return `uppdaterad (namnet ${il[loc].attributes.name} står kvar)`; }
      await call('POST', '/v1/appInfoLocalizations', { data: { type: 'appInfoLocalizations', attributes: { locale: loc, ...attrs }, relationships: { appInfo: { data: { type: 'appInfos', id: info.id } } } } });
      return 'nytt språk';
    });
  }
  const finns = Object.fromEntries((await alla(`/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`)).map((l) => [l.attributes.locale, l]));
  for (const [loc, t] of Object.entries(T)) {
    await steg(`texter ${loc}`, async () => {
      const attrs = { description: t.description, keywords: t.keywords, promotionalText: t.promotionalText, whatsNew: t.whatsNew, supportUrl: SUPPORT, marketingUrl: MARKNAD };
      if (finns[loc]) { await call('PATCH', `/v1/appStoreVersionLocalizations/${finns[loc].id}`, { data: { type: 'appStoreVersionLocalizations', id: finns[loc].id, attributes: attrs } }); return 'uppdaterad'; }
      await call('POST', '/v1/appStoreVersionLocalizations', { data: { type: 'appStoreVersionLocalizations', attributes: { locale: loc, ...attrs }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } } });
      return 'nytt språk';
    });
  }

}
if (cmd === 'bygge') {
  const ver = await versionen();
  const b = await alla(`/v1/builds?filter[app]=${APP}&filter[preReleaseVersion.version]=${VERSION}&sort=-uploadedDate&limit=20`);
  console.log('byggen:', b.map((x) => `${x.attributes.version}:${x.attributes.processingState}`).join(' ') || 'inga');
  const valt = arg ? b.find((x) => x.attributes.version === arg) : b.find((x) => x.attributes.processingState === 'VALID');
  if (!valt) { console.log('inget giltigt bygge än'); process.exit(2); }
  await steg(`bygge ${valt.attributes.version} → iOS ${VERSION}`, async () => {
    if (valt.attributes.usesNonExemptEncryption == null) await call('PATCH', `/v1/builds/${valt.id}`, { data: { type: 'builds', id: valt.id, attributes: { usesNonExemptEncryption: false } } });
    await call('PATCH', `/v1/appStoreVersions/${ver.id}/relationships/build`, { data: { type: 'builds', id: valt.id } });
  });
}
if (cmd === 'skicka') {
  const ver = await versionen();
  await steg(`iOS ${VERSION} → App Review`, async () => {
    const sub = await call('POST', '/v1/reviewSubmissions', { data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: APP } } } } });
    await call('POST', '/v1/reviewSubmissionItems', { data: { type: 'reviewSubmissionItems', relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.data.id } }, appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } } });
    await call('PATCH', `/v1/reviewSubmissions/${sub.data.id}`, { data: { type: 'reviewSubmissions', id: sub.data.id, attributes: { submitted: true } } });
    return `inskickad (${sub.data.id})`;
  });
}

// ---- skärmbilder per språk (2026-11-24) ----
//   node app/tools/asc-store.mjs bilder-lage                 vilka bildset varje språk har i versionen
//   node app/tools/asc-store.mjs bilder <locale> <lang> [enhet]  lägg upp app/store/skarmbilder/<lang>/ (ersätter språkets set)
const ENHET_TYP = { iphone: 'APP_IPHONE_67', iphone65: 'APP_IPHONE_65', iphone63: 'APP_IPHONE_61', ipad: 'APP_IPAD_PRO_3GEN_129' };
async function lokalisering(loc) {
  const ver = await versionen();
  const vl = await alla(`/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`);
  return { ver, vl, l: vl.find((x) => x.attributes.locale === loc) };
}
if (cmd === 'bilder-lage') {
  const { vl } = await lokalisering('sv');
  for (const l of vl) {
    const sets = await get(`/v1/appStoreVersionLocalizations/${l.id}/appScreenshotSets?include=appScreenshots&limit=50`);
    console.log(l.attributes.locale.padEnd(6), sets.data.map((s) => `${s.attributes.screenshotDisplayType}:${(s.relationships.appScreenshots.data || []).length}`).join(' ') || '–');
  }
}
if (cmd === 'bilder') {
  const [, , , loc, lang, bara] = process.argv;   // bara = en enhet (t.ex. ipad)
  const { l } = await lokalisering(loc);
  if (!l) throw new Error(`språket ${loc} finns inte i versionen`);
  const mapp = path.join(ROT, 'app/store/skarmbilder', lang === 'sv' ? '' : lang);
  const sets = await get(`/v1/appStoreVersionLocalizations/${l.id}/appScreenshotSets?include=appScreenshots&limit=50`);
  for (const [enhet, TYP] of Object.entries(ENHET_TYP)) {
    if (bara && bara !== enhet) continue;
    const filer = fs.readdirSync(mapp).filter((f) => new RegExp(`^${enhet}-\\d+-[a-z]+\\.png$`).test(f)).sort((a, b) => +a.split('-')[1] - +b.split('-')[1]);
    if (!filer.length) continue;
    let set = sets.data.find((s) => s.attributes.screenshotDisplayType === TYP);
    if (set) for (const s of set.relationships.appScreenshots.data || []) await call('DELETE', `/v1/appScreenshots/${s.id}`);
    else set = (await call('POST', '/v1/appScreenshotSets', { data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: TYP }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: l.id } } } } })).data;
    await steg(`${loc} ${TYP} (${filer.length} bilder)`, async () => {
      for (const f of filer) {
        const buf = fs.readFileSync(path.join(mapp, f));
        const res = (await call('POST', '/v1/appScreenshots', { data: { type: 'appScreenshots', attributes: { fileName: f, fileSize: buf.length }, relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } } })).data;
        for (const op of res.attributes.uploadOperations) {
          const h = Object.fromEntries(op.requestHeaders.map((x) => [x.name, x.value]));
          const r = await fetch(op.url, { method: op.method, headers: h, body: buf.subarray(op.offset, op.offset + op.length) });
          if (!r.ok) throw new Error(`uppladdning ${f} ${r.status}`);
        }
        await call('PATCH', `/v1/appScreenshots/${res.id}`, { data: { type: 'appScreenshots', id: res.id, attributes: { uploaded: true, sourceFileChecksum: crypto.createHash('md5').update(buf).digest('hex') } } });
      }
    });
  }
}
if (cmd === 'avbryt') {   // dra tillbaka versionens inskick (innan granskningen börjat) – för att byta bygge
  const subs = await alla(`/v1/reviewSubmissions?filter[app]=${APP}&filter[platform]=IOS&limit=20`);
  for (const s of subs.filter((x) => ['WAITING_FOR_REVIEW', 'READY_FOR_REVIEW'].includes(x.attributes.state))) {
    const items = await alla(`/v1/reviewSubmissions/${s.id}/items?include=appStoreVersion&limit=20`);
    const ver = await versionen();
    if (!items.some((i) => i.relationships?.appStoreVersion?.data?.id === ver?.id)) continue;
    await steg(`drar tillbaka inskick ${s.id}`, async () => { await call('PATCH', `/v1/reviewSubmissions/${s.id}`, { data: { type: 'reviewSubmissions', id: s.id, attributes: { canceled: true } } }); });
  }
}
