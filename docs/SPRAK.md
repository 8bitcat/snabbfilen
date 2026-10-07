# Språken – så översätts Snabbfilen / Pixelcity

Carl 2026-10-07: spelet ska finnas på **engelska, spanska, tyska, franska, polska, italienska och
portugisiska**, med **lokala namn** på staden, stadsdelarna, gatorna, butikerna och personerna.

## Hur det fungerar

- **Svenskan är källan.** All text skrivs på svenska i koden och slås upp i det valda språkets ordlista
  `js/i18n/<id>.js`, som är en tabell från svensk text till översättning.
- **Saknas en översättning visas svenskan.** Spelet går alltså aldrig sönder av en saknad text.
- **Språkvalet** sker i ordningen `?lang=xx` → sparat val (`snabbfilen_lang`) → enhetens språk → engelska.
  Norska och danska enheter får svenska.
- **Testrobotarna** (`navigator.webdriver`) spelar på svenska om inte `?lang=` står i adressen.
- **Byta språk:** menyn → ⚙ Inställningar → 🌍 Språk. `setLang` sparar valet och laddar om sidan.
- **Ordlistan laddas med top-level await i `js/core/i18n.js`.** Varje modul som importerar `$t` har
  därför sin ordlista innan den körs, och tabeller på modulnivå kan översättas direkt.

## Märk texten så här (`import { $t, $tf, $n, money } from '../core/i18n.js'`)

| Fall | Skriv | Nyckel i ordlistan |
|---|---|---|
| Vanlig text | `$t('Inte nu')` | `Inte nu` |
| Mall med värden | `` $t`Mums! ${namn} ute på bryggan` `` | `Mums! {0} ute på bryggan` |
| Pixelskylt | `text(P, SMALL, $t('SJÖBODEN'), …)` | `SJÖBODEN` |
| Tabell med namn som bara visas | `{ namn: $t('Fisksoppa med aioli') }` | `Fisksoppa med aioli` |
| Namn som också är id i logiken | definiera `$n('LINNÉSTADEN')`, visa `$t(d.name)` | `LINNÉSTADEN` |
| Färdig mall i en tabell | `$tf('Köpte {0} st', n)` | `Köpte {0} st` |
| Pengar som eget värde | `money(n)` eller `fmt(n)` → "69 kr" / "$69" / "69 €" / "69 zł" | – |

**Märk inte:**
- id:n, nycklar och sparfältens namn
- CSS-klasser och `data-`-attribut
- regex och händelsenamn
- `localStorage`-nycklar
- `console`-utskrifter
- kommentarer
- text som jämförs i logiken. Den märks med `$n` vid definitionen och `$t` där den visas.

**Kronor inne i en mening** (`` $t`Resan kostar ${pris} kr` ``) lämnas kvar i nyckeln. Översättaren skriver
valutan på språkets sätt ("The ride costs ${0}" / "El viaje cuesta {0} €").

**HTML i texten:** korta taggar (`<b>`, `<br>`, `<small>`) får stå kvar i nyckeln. Bygg inte nycklar av
stora HTML-block med loopar inuti. Märk i stället de enskilda texterna inuti.

## Valuta per språk (`LANGS` i i18n.js)

| Språk | Valuta |
|---|---|
| sv | 69 kr |
| en | $69 |
| es, de, fr, it, pt | 69 € |
| pl | 69 zł |

Beloppen är desamma på alla språk. Bara tecknet byts.

## Lokala namn

Varje språk har sin egen namnlista i ordlistan: staden, stadsdelarna, gatorna, butikerna och
personerna. Samma svenska namn ska få samma lokala namn i alla meningar på det språket. Översättaren
utgår därför från namnlistan i `tools/i18n/namn.<id>.json` och använder den genomgående. Där finns också
språkets listor med förnamn, efternamn, husdjurs- och hästnamn (`list('girls', …)` i koden).

## Verktyg

| Kommando | Vad det gör |
|---|---|
| `node tools/i18n-nycklar.mjs` | Alla nycklar i koden och täckningen per språk |
| `node tools/i18n-nycklar.mjs --saknas en` | Nycklarna som saknar engelsk översättning |
| `node tools/i18n-nycklar.mjs --fil js/core/menu.js` | Nycklarna i en fil |
| `node tools/i18n-in.mjs en de` | Tar in översättarnas svar (`svar/`) till `ut/` och listar det som saknas |
| `node tools/i18n-bygg.mjs` | Bygger `js/i18n/<id>.js` och kontrollerar {0}-platser och HTML-taggar |
| `node tools/i18n-bredd.mjs` | Listar skyltar där översättningen är för bred för pixelskylten |
| `node tools/sprak-test.mjs` | Spelar alla sju språken: inga saknade texter, ingen svenska, inga fel |

`window.__i18nMiss` innehåller de texter som visats utan översättning, och testerna läser den.

## Översätta nya texter

1. Märk texten i koden (se ovan).
2. `node tools/i18n-nycklar.mjs` visar hur många nycklar som saknas per språk.
3. Lägg de nya nycklarna i ett nytt paket `tools/i18n/del/<nn>.json` (`[{ i, f, k }]`: nummer, fil, svensk text).
   Ta nästa lediga nummer och låt de gamla paketen ligga kvar. Annars skriver `i18n-in` över deras `ut/`.
4. Översättarna (en agent per språk och paket) skriver `tools/i18n/svar/<id>-<nn>.json` som `{ nummer: översättning }`.
   De följer namnlistan i `namn.<id>.json`, behåller {0}-platser och taggar och skriver valutan på språkets sätt.
5. Kör `node tools/i18n-in.mjs en es de fr pl it pt` och sedan `node tools/i18n-bygg.mjs`.
   Texterna som hamnar i `tools/out/i18n-fel-<id>.json` översätts om.
6. `node tools/i18n-bredd.mjs`: för breda skyltar kortas i `tools/i18n/kort/<id>.json`, som läggs ovanpå allt annat.
7. `node tools/sprak-test.mjs` ska ge ALLT GRÖNT.

## App Store

Butikstexterna för alla sju språken ligger i `app/appstore-sprak.md` och håller sig inom Apples
längdgränser: undertitel, reklamtext, nyckelord och beskrivning.

## Typsnitten

Pixeltypsnitten (`SMALL` och `BIG` i `js/core/floor-pix.js`) och menyernas Pixelstad
(`tools/pixelfont`, byggs med `node tools/pixelfont/build.mjs`) har accenterna för alla sju språken:

- ÁÀÂÃÄÅ, ÇĆ, ÉÈÊË, ÍÌÎÏ, ÑŃ, ÓÒÔÕÖ, ŚŹŻ, ÚÙÛÜ, ŸÝ, ĄĘ, Ł, Œ, Æ, ¡, ¿ (även gemener i Pixelstad)
- ß blir SS i versaler
- Typografiska citattecken och tankstreck byts mot de tecken som finns.
