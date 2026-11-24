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
// Nyheter i 1.4 (whatsNew, högst 4000 tecken)
const NYTT = {
  sv: 'Nu på 14 språk – nytt är nederländska, norska, danska, indonesiska, turkiska och vietnamesiska, med egna namn på staden, gatorna och personerna.\n\nI Dockskåpet kan du nu lägga allt på allt: nallen på sängen, stolen på sängen och bollen på stolen. Bjud in en kompis med 👫 och lek i samma hus.',
  'en-US': 'Now in 14 languages – new: Dutch, Norwegian, Danish, Indonesian, Turkish and Vietnamese, each with its own names for the city, streets and people.\n\nIn The Dollhouse you can now stack anything on anything: the teddy on the bed, the chair on the bed and the ball on the chair. Invite a friend with 👫 and play in the same house.',
  'es-ES': 'Ahora en 14 idiomas – nuevos: neerlandés, noruego, danés, indonesio, turco y vietnamita, cada uno con sus propios nombres para la ciudad, las calles y la gente.\n\nEn La casa de muñecas ya puedes poner cualquier cosa encima de otra: el osito en la cama, la silla en la cama y la pelota en la silla. Invita a un amigo con 👫 y jugad en la misma casa.',
  'de-DE': 'Jetzt in 14 Sprachen – neu: Niederländisch, Norwegisch, Dänisch, Indonesisch, Türkisch und Vietnamesisch, jeweils mit eigenen Namen für Stadt, Straßen und Leute.\n\nIm Puppenhaus kannst du jetzt alles auf alles stellen: den Teddy aufs Bett, den Stuhl aufs Bett und den Ball auf den Stuhl. Lade mit 👫 einen Freund ein und spielt im selben Haus.',
  'fr-FR': "Maintenant en 14 langues – nouveau : néerlandais, norvégien, danois, indonésien, turc et vietnamien, chacun avec ses propres noms pour la ville, les rues et les habitants.\n\nDans La maison de poupée, tu peux maintenant tout poser sur tout : le nounours sur le lit, la chaise sur le lit et le ballon sur la chaise. Invite un ami avec 👫 et jouez dans la même maison.",
  pl: 'Teraz w 14 językach – nowe: niderlandzki, norweski, duński, indonezyjski, turecki i wietnamski, każdy z własnymi nazwami miasta, ulic i ludzi.\n\nW Domku dla lalek możesz teraz kłaść wszystko na wszystkim: misia na łóżku, krzesło na łóżku i piłkę na krześle. Zaproś kogoś przez 👫 i bawcie się w tym samym domu.',
  it: 'Ora in 14 lingue – novità: olandese, norvegese, danese, indonesiano, turco e vietnamita, ognuna con i propri nomi per la città, le strade e le persone.\n\nNella Casa delle bambole ora puoi mettere qualsiasi cosa sopra qualsiasi cosa: l’orsetto sul letto, la sedia sul letto e la palla sulla sedia. Invita un amico con 👫 e giocate nella stessa casa.',
  'pt-PT': 'Agora em 14 línguas – novas: neerlandês, norueguês, dinamarquês, indonésio, turco e vietnamita, cada uma com os seus próprios nomes para a cidade, as ruas e as pessoas.\n\nNa Casa de bonecas já podes pôr tudo em cima de tudo: o peluche na cama, a cadeira na cama e a bola na cadeira. Convida um amigo com 👫 e brinquem na mesma casa.',
  'nl-NL': 'Nu in 14 talen – nieuw: Nederlands, Noors, Deens, Indonesisch, Turks en Vietnamees, elk met eigen namen voor de stad, de straten en de mensen.\n\nIn Het Poppenhuis kun je nu alles op alles zetten: de teddybeer op het bed, de stoel op het bed en de bal op de stoel. Nodig een vriend uit met 👫 en speel samen in hetzelfde huis.',
  no: 'Nå på 14 språk – nytt er nederlandsk, norsk, dansk, indonesisk, tyrkisk og vietnamesisk, hver med egne navn på byen, gatene og menneskene.\n\nI Dukkehuset kan du nå legge alt oppå alt: bamsen på senga, stolen på senga og ballen på stolen. Inviter en venn med 👫 og lek i samme hus.',
  da: 'Nu på 14 sprog – nyt er nederlandsk, norsk, dansk, indonesisk, tyrkisk og vietnamesisk, hver med egne navne på byen, gaderne og menneskene.\n\nI Dukkehuset kan du nu lægge alt oven på alt: bamsen på sengen, stolen på sengen og bolden på stolen. Inviter en ven med 👫 og leg i det samme hus.',
  id: 'Sekarang dalam 14 bahasa – baru: Belanda, Norwegia, Denmark, Indonesia, Turki, dan Vietnam, masing-masing dengan nama kota, jalan, dan orang-orangnya sendiri.\n\nDi Rumah Boneka kamu sekarang bisa menumpuk apa saja di atas apa saja: boneka beruang di kasur, kursi di kasur, dan bola di kursi. Ajak teman dengan 👫 dan main di rumah yang sama.',
  tr: 'Artık 14 dilde – yeni: Hollandaca, Norveççe, Danca, Endonezce, Türkçe ve Vietnamca; her birinde şehrin, sokakların ve insanların kendi isimleri var.\n\nOyuncak Ev’de artık her şeyi her şeyin üstüne koyabilirsin: ayıcığı yatağa, sandalyeyi yatağa ve topu sandalyeye. 👫 ile bir arkadaşını davet et, aynı evde oynayın.',
  vi: 'Giờ đã có 14 ngôn ngữ – mới: tiếng Hà Lan, Na Uy, Đan Mạch, Indonesia, Thổ Nhĩ Kỳ và tiếng Việt, mỗi ngôn ngữ có tên riêng cho thành phố, đường phố và mọi người.\n\nTrong Nhà búp bê, giờ bạn có thể đặt mọi thứ lên mọi thứ: gấu bông lên giường, ghế lên giường và bóng lên ghế. Mời bạn bè bằng 👫 và cùng chơi trong một ngôi nhà.',
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
