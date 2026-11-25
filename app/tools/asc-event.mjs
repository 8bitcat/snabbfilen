// Händelser i App Store (In-App Events) för Pixelcity via API (2026-11-25, Carl: "gör alla förslagen"). Händelserna
// syns på produktsidan, i sökresultaten och kan lyftas av Apple på fliken Spel – på alla språk som har en text här.
// Nyckeln (Codemagic-nyckeln 94H7H2CY53, App Manager) läses bara för att signera anropen – skrivs aldrig ut.
//   node app/tools/asc-event.mjs lage                  händelserna och deras läge
//   node app/tools/asc-event.mjs skapa                 skapa/uppdatera händelserna, texterna och tiderna
//   node app/tools/asc-event.mjs bilder <id> <mapp>    eventkortet (kort.jpg, 1920×1080) och detaljsidan (sida.jpg, 1080×1920)
//   node app/tools/asc-event.mjs skicka <id>           skicka händelsen till App Review
// Bilderna tas med app/tools/event-snap.mjs → app/store/event/<id>/.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ISS = '08e19ca3-bbeb-4a09-8096-06f1e3eb6e4b', KID = '94H7H2CY53', APP = '6818844405';
const key = fs.readFileSync('C:/Users/palss/Downloads/AuthKey_94H7H2CY53.p8', 'utf8');
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

const LOC = { sv: 'sv', en: 'en-US', es: 'es-ES', de: 'de-DE', fr: 'fr-FR', pl: 'pl', it: 'it', pt: 'pt-PT', br: 'pt-BR', nl: 'nl-NL', nb: 'no', da: 'da', id: 'id', tr: 'tr', vi: 'vi' };
// text per språk: [namn ≤30, kort ≤50, lång ≤120]
export const EVENTS = {
  jul: {
    ref: 'Jul i Pixelstaden 2026', lank: 'pixelcity://dockskap/jul', badge: 'SPECIAL_EVENT', purpose: 'APPROPRIATE_FOR_ALL_USERS', priority: 'HIGH',
    publish: '2026-11-26T08:00:00Z', start: '2026-12-01T05:00:00Z', slut: '2026-12-27T22:00:00Z',
    text: {
      sv: ['Jul i Pixelstaden', 'Julvåningen, jultorget och julklappar', 'Klä granen, köp jultröjor på julvåningen, tänd brasan och fira jul i Dockskåpet – ensam eller med vänner.'],
      en: ['Christmas in Pixel City', 'Christmas floor, holiday square and gifts', 'Trim the tree, buy holiday sweaters, light the fire and celebrate Christmas in the Dollhouse – alone or with friends.'],
      es: ['Navidad en Ciudad Píxel', 'Planta navideña, plaza y regalos', 'Adorna el árbol, compra jerséis navideños, enciende la chimenea y celebra la Navidad en la casa de muñecas.'],
      de: ['Weihnachten in Pixelstadt', 'Weihnachtsetage, Markt und Geschenke', 'Schmück den Baum, kauf Weihnachtspullis, zünde den Kamin an und feiere Weihnachten im Puppenhaus – auch mit Freunden.'],
      fr: ['Noël à Pixelville', 'Étage de Noël, place et cadeaux', 'Décore le sapin, achète des pulls de Noël, allume la cheminée et fête Noël dans la maison de poupée avec tes amis.'],
      pl: ['Święta w Pikselowie', 'Świąteczne piętro, rynek i prezenty', 'Ubierz choinkę, kup świąteczne swetry, rozpal kominek i świętuj w domku dla lalek – sam albo z przyjaciółmi.'],
      it: ['Natale a Pixelopoli', 'Piano natalizio, piazza e regali', "Addobba l'albero, compra maglioni natalizi, accendi il camino e festeggia il Natale nella casa delle bambole."],
      pt: ['Natal em Pixelópolis', 'Piso de Natal, praça e presentes', 'Enfeita a árvore, compra camisolas de Natal, acende a lareira e celebra o Natal na casa de bonecas com amigos.'],
      br: ['Natal em Pixelópolis', 'Andar de Natal, praça e presentes', 'Enfeite a árvore, compre suéteres de Natal, acenda a lareira e comemore o Natal na casa de bonecas com amigos.'],
      nl: ['Kerst in Pixelstad', 'Kerstverdieping, kerstplein en cadeaus', 'Versier de boom, koop kersttruien, steek de haard aan en vier kerst in het poppenhuis – alleen of met vrienden.'],
      nb: ['Jul i Pixelbyen', 'Juleetasjen, juletorget og julegaver', 'Pynt treet, kjøp julegensere, tenn peisen og feir jul i Dukkehuset – alene eller med venner.'],
      da: ['Jul i Pixelkøbing', 'Juleetagen, juletorvet og julegaver', 'Pynt træet, køb julesweatre, tænd pejsen og fejr jul i Dukkehuset – alene eller med venner.'],
      id: ['Natal di Kota Pixel', 'Lantai Natal, alun-alun, dan hadiah', 'Hias pohon, beli sweter Natal, nyalakan perapian, dan rayakan Natal di Rumah Boneka – sendiri atau bareng sahabat.'],
      tr: ["Pixelkent'te yılbaşı", 'Yılbaşı katı, meydan ve hediyeler', 'Ağacı süsle, yılbaşı kazakları al, şömineyi yak ve Oyuncak Ev’de yılbaşını kutla – tek başına ya da arkadaşlarınla.'],
      vi: ['Giáng sinh ở Thành phố Pixel', 'Tầng Giáng sinh, quảng trường, quà', 'Trang trí cây thông, mua áo len Giáng sinh, đốt lò sưởi và đón Giáng sinh trong Nhà búp bê cùng bạn bè.'],
    },
  },
  rymd: {
    ref: 'Rymdstationen i Dockskåpet', lank: 'pixelcity://dockskap/rymd', badge: 'MAJOR_UPDATE', purpose: 'APPROPRIATE_FOR_ALL_USERS', priority: 'NORMAL',
    publish: '2026-11-26T08:00:00Z', start: '2026-11-26T08:00:00Z', slut: '2026-12-26T08:00:00Z',
    text: {
      sv: ['Rymdstationen', 'Ett nytt rum i Dockskåpet', 'Raket, robot, sovkapsel, utomjording och fönster mot jorden. Bjud in en vän med en notis och bygg rymdstationen ihop.'],
      en: ['The Space Station', 'A new room in the Dollhouse', 'Rocket, robot, sleep pod, an alien and windows facing Earth. Invite a friend with a notification and build it together.'],
      es: ['La estación espacial', 'Una habitación nueva en la casa de muñecas', 'Cohete, robot, cápsula para dormir, extraterrestre y ventanas a la Tierra. Invita a un amigo y construid juntos.'],
      de: ['Die Raumstation', 'Ein neues Zimmer im Puppenhaus', 'Rakete, Roboter, Schlafkapsel, Außerirdischer und Fenster zur Erde. Lade einen Freund ein und baut zusammen.'],
      fr: ['La station spatiale', 'Une nouvelle pièce dans la maison de poupée', 'Fusée, robot, capsule, extraterrestre et hublots sur la Terre. Invite un ami et construisez ensemble.'],
      pl: ['Stacja kosmiczna', 'Nowy pokój w domku dla lalek', 'Rakieta, robot, kapsuła do spania, kosmita i okna na Ziemię. Zaproś przyjaciela i budujcie razem.'],
      it: ['La stazione spaziale', 'Una nuova stanza nella casa delle bambole', 'Razzo, robot, capsula per dormire, alieno e oblò sulla Terra. Invita un amico e costruite insieme.'],
      pt: ['A estação espacial', 'Uma nova divisão na casa de bonecas', 'Foguetão, robô, cápsula de dormir, extraterrestre e janelas para a Terra. Convida um amigo e construam juntos.'],
      br: ['A estação espacial', 'Um novo cômodo na casa de bonecas', 'Foguete, robô, cápsula de dormir, alienígena e janelas para a Terra. Convide um amigo e construam juntos.'],
      nl: ['Het ruimtestation', 'Een nieuwe kamer in het poppenhuis', 'Raket, robot, slaapcapsule, buitenaards wezen en ramen naar de aarde. Nodig een vriend uit en bouw samen.'],
      nb: ['Romstasjonen', 'Et nytt rom i Dukkehuset', 'Rakett, robot, sovekapsel, romvesen og vinduer mot jorda. Inviter en venn med et varsel og bygg sammen.'],
      da: ['Rumstationen', 'Et nyt rum i Dukkehuset', 'Raket, robot, sovekapsel, rumvæsen og vinduer mod Jorden. Inviter en ven med en notifikation og byg sammen.'],
      id: ['Stasiun Luar Angkasa', 'Ruang baru di Rumah Boneka', 'Roket, robot, kapsul tidur, alien, dan jendela ke Bumi. Ajak sahabat dengan notifikasi dan bangun bersama.'],
      tr: ['Uzay İstasyonu', "Oyuncak Ev'de yeni bir oda", "Roket, robot, uyku kapsülü, uzaylı ve Dünya'ya bakan pencereler. Bir arkadaşını davet et, birlikte kurun."],
      vi: ['Trạm vũ trụ', 'Phòng mới trong Nhà búp bê', 'Tên lửa, rô-bốt, khoang ngủ, người ngoài hành tinh và cửa sổ nhìn ra Trái Đất. Mời bạn bè cùng xây.'],
    },
  },
};
for (const [id, E] of Object.entries(EVENTS)) for (const [l, [n, k, lang]] of Object.entries(E.text)) {
  if ([...n].length > 30 || [...k].length > 50 || [...lang].length > 120) throw new Error(`${id} ${l}: ${[...n].length}/30 ${[...k].length}/50 ${[...lang].length}/120`);
}

const finns = async () => alla(`/v1/apps/${APP}/appEvents?limit=50`);
const [, , cmd, a1, a2] = process.argv;
if (cmd === 'lage') {
  for (const e of await finns()) console.log(e.id, e.attributes.referenceName, e.attributes.eventState, e.attributes.badge);
}
if (cmd === 'skapa') {
  const terr = (await alla('/v1/territories?limit=200')).map((t) => t.id);
  const har = await finns();
  for (const [id, E] of Object.entries(EVENTS)) {
    let ev = har.find((x) => x.attributes.referenceName === E.ref);
    const attrs = { referenceName: E.ref, deepLink: E.lank, badge: E.badge, primaryLocale: 'en-US', priority: E.priority, purpose: E.purpose, purchaseRequirement: 'NO_COST_ASSOCIATED',
      territorySchedules: [{ territories: terr, publishStart: E.publish, eventStart: E.start, eventEnd: E.slut }] };
    await steg(`händelse ${id}`, async () => {
      if (ev) { await call('PATCH', `/v1/appEvents/${ev.id}`, { data: { type: 'appEvents', id: ev.id, attributes: attrs } }); return `uppdaterad ${ev.id}`; }
      ev = (await call('POST', '/v1/appEvents', { data: { type: 'appEvents', attributes: attrs, relationships: { app: { data: { type: 'apps', id: APP } } } } })).data;
      return `skapad ${ev.id}`;
    });
    if (!ev) continue;
    const lok = await alla(`/v1/appEvents/${ev.id}/localizations?limit=50`);
    for (const [l, [name, shortDescription, longDescription]] of Object.entries(E.text)) {
      const locale = LOC[l], f = lok.find((x) => x.attributes.locale === locale);
      await steg(`  ${id} ${locale}`, async () => {
        if (f) { await call('PATCH', `/v1/appEventLocalizations/${f.id}`, { data: { type: 'appEventLocalizations', id: f.id, attributes: { name, shortDescription, longDescription } } }); return 'uppdaterad'; }
        await call('POST', '/v1/appEventLocalizations', { data: { type: 'appEventLocalizations', attributes: { locale, name, shortDescription, longDescription }, relationships: { appEvent: { data: { type: 'appEvents', id: ev.id } } } } });
        return 'ny';
      });
    }
  }
}
if (cmd === 'bilder') {
  const E = EVENTS[a1], mapp = a2;
  const ev = (await finns()).find((x) => x.attributes.referenceName === E?.ref);
  if (!ev) throw new Error('händelsen finns inte – kör skapa först');
  const lok = await alla(`/v1/appEvents/${ev.id}/localizations?limit=50`);
  for (const l of lok) {
    for (const [typ, fil] of [['EVENT_CARD', 'kort.jpg'], ['EVENT_DETAILS_PAGE', 'sida.jpg']]) {
      const loc = l.attributes.locale, egen = path.join(mapp, loc, fil), fall = path.join(mapp, fil);
      const f = fs.existsSync(egen) ? egen : fall;
      await steg(`  ${a1} ${loc} ${typ}`, async () => {
        const gamla = await alla(`/v1/appEventLocalizations/${l.id}/appEventScreenshots?limit=10`);
        for (const g of gamla.filter((x) => x.attributes.appEventAssetType === typ)) await call('DELETE', `/v1/appEventScreenshots/${g.id}`);
        const buf = fs.readFileSync(f);
        const res = (await call('POST', '/v1/appEventScreenshots', { data: { type: 'appEventScreenshots', attributes: { fileName: path.basename(f), fileSize: buf.length, appEventAssetType: typ }, relationships: { appEventLocalization: { data: { type: 'appEventLocalizations', id: l.id } } } } })).data;
        for (const op of res.attributes.uploadOperations) {
          const h = Object.fromEntries(op.requestHeaders.map((x) => [x.name, x.value]));
          const r = await fetch(op.url, { method: op.method, headers: h, body: buf.subarray(op.offset, op.offset + op.length) });
          if (!r.ok) throw new Error(`uppladdning ${r.status}`);
        }
        await call('PATCH', `/v1/appEventScreenshots/${res.id}`, { data: { type: 'appEventScreenshots', id: res.id, attributes: { uploaded: true } } });
        return path.relative(mapp, f);
      });
    }
  }
}
if (cmd === 'skicka') {
  const E = EVENTS[a1];
  const ev = (await finns()).find((x) => x.attributes.referenceName === E?.ref);
  if (!ev) throw new Error('händelsen finns inte');
  await steg(`${a1} → App Review`, async () => {
    const sub = await call('POST', '/v1/reviewSubmissions', { data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: APP } } } } });
    await call('POST', '/v1/reviewSubmissionItems', { data: { type: 'reviewSubmissionItems', relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.data.id } }, appEvent: { data: { type: 'appEvents', id: ev.id } } } } });
    await call('PATCH', `/v1/reviewSubmissions/${sub.data.id}`, { data: { type: 'reviewSubmissions', id: sub.data.id, attributes: { submitted: true } } });
    return `inskickad (${sub.data.id})`;
  });
}
