# Figurerna – arkitektur (people)

Alla människor i Snabbfilen (spelaren, kunder, fotgängare, butiksbiträden) ritas med kod,
pixel för pixel, i en 24×40-sprite. Systemet är **registerdrivet**: varje frisyr, ögontyp,
plagg och accessoar är en post i ett register. Ett nytt val = en ny post i rätt fil.
Motorn tar hand om lagerordning, ramper, kontur, cache och alla fyra riktningar.

```
js/core/people.js          MOTORN – lager, ramper, kontur, cache, drawPerson/portrait/makeLook/makeLookRich,
                           LOOK_FIELDS/LOOK_COLORS, listorna (HAIR_STYLES, TOP_TYPES …)
js/core/people/util.js     färgverktyg (ramp, mix, mul, far, toneOf, toInt), SW/SH, TAG
js/core/people/hair.js     HAIR_REG (frisyrer), HAIR_FX_REG (slingor/toppar/ombré/tvåfärgat)
js/core/people/face.js     EYE_REG BROW_REG NOSE_REG MOUTH_REG EAR_REG CHEEK_REG MAKEUP_REG
                           MARK_REG BEARD_REG + färgförslag EYE_COLORS LIP_COLORS SHADOW_COLORS MARK_COLORS
js/core/people/tops.js     TOP_REG (överdelar), TOP_PRINT_REG (tryck/mönster)
js/core/people/bottoms.js  BOTTOM_REG (byxor/kjolar/klänningar/overaller), BOTTOM_PRINT_REG, SHOE_REG
js/core/people/acc.js      HAT_REG GLASSES_REG BAG_REG NECK_REG JEWEL_REG HAIR_ACC_REG PHONES_REG
js/data/wardrobe.js        klädkatalogen (samlar wardrobe-tops/-bottoms/-acc.js) + hjälpfunktioner
js/core/avatar.js          avatarredigeraren (flikar, gruppknappar, täta rutnät som ritas lat, cleanLook)
```

Registerfilerna importerar **bara** från `util.js` (aldrig från `people.js` – cirkelberoende).

**Hjälpfiler.** Blir en registerfil stor delas innehållet upp i hjälpfiler med samma prefix,
som registerfilen importerar och slår ihop (t.ex. `hair-kort.js`, `hair-lockar.js`,
`hair-kit.js` med delade ritfunktioner; `face-eyes.js`, `face-paint.js`, `face-kit.js`). Varje
specialist äger sina prefix: `hair*`, `face*`, `tops*`, `bottoms*`, `acc*`. Motorn importerar
fortfarande bara de fem registerfilerna ovan.

---

## 1. Look-objektet

Ett look är ett rent JSON-objekt. Saknas ett fält ritas det som förut (bakåtkompatibelt).

| fält | register / typ | standard | kommentar |
|---|---|---|---|
| `style` | HAIR_REG | `'short'` | frisyr |
| `hairFx` | HAIR_FX_REG | `'none'` | slingor, toppar, ombré, tvåfärgat |
| `hairAcc` | HAIR_ACC_REG | `'none'` | hårspänne, diadem, blomma (katalogplats `hairAcc`) |
| `eyes` `brows` `nose` `mouth` `ears` | face.js | `'normal'` | |
| `cheeks` | CHEEK_REG | `'none'` | gamla `blush: true` ⇒ `'blush'` |
| `makeup` | MAKEUP_REG | `'none'` | |
| `marks` | MARK_REG | `'none'` | fräknar, födelsemärken, ansiktsmålning |
| `beard` | BEARD_REG | `false` | tomt värde `false` (registerpost `none`); gamla `true` ⇒ `'full'`; aldrig på barn |
| `top` | TOP_REG | `'tee'` | |
| `topPrint` | TOP_PRINT_REG | `'none'` | |
| `bottom` | BOTTOM_REG | `'pants'` (cleanLook: `'jeans'`) | |
| `bottomPrint` | BOTTOM_PRINT_REG | `'none'` | |
| `shoeType` | SHOE_REG | `'normal'` | |
| `hat` | HAT_REG | `null` | tomt värde `null` |
| `glasses` | GLASSES_REG | `false` | gamla `true` ⇒ `'square'` |
| `bag` | BAG_REG | `null` | |
| `neck` | NECK_REG | `'none'` | halsduk, slips, fluga, halsband |
| `jewel` | JEWEL_REG | `'none'` | örhängen, piercing, armband, klocka |
| `phones` | PHONES_REG | `false` | `true` = registerposten `over` (klassiska lurarna) |
| `build` | 4/5/6 | 5 | kroppsbredd (barn alltid 4; andra värden ritas som 5) |
| `kid` | bool | false | |
| `apron` | bool | false | bara butiksbiträden (motorn ritar det) |

**Färgfält** (`#rrggbb`; `null` = motorn väljer): `skin hair hair2 eyeColor lipColor shadowColor
markColor shirt accent print2 pants pants2 shoes shoes2 cap bagColor phoneColor neckColor`.
Se `LOOK_COLORS` i people.js för standardvärdena.

Hjälpare i people.js: `LOOK_FIELDS`, `LOOK_COLORS`, `idOf(fält, värde)`, `valueOf(fält, id)`,
`isValid(fält, värde)`, `entryOf(fält, värde)`, `labelOf(fält, värde)`, `listOf(fält)`.

---

## 2. Registerposter

```js
// i t.ex. js/core/people/hair.js
export const HAIR_REG = {
  // … befintliga poster (RÖR INTE – pixellåsta) …
  sidecut: {
    label: 'Sidecut',          // svenskt namn i redigeraren (­ = mjukt bindestreck för långa ord)
    group: 'Rakat',            // underrubrik i redigeraren (valfri; ordning = första förekomst)
    front(R) { … },            // framifrån ('down')
    back(R) { … },             // bakifrån ('up')
    side(R) { … },             // profil åt höger ('right'; 'left' speglas automatiskt)
    prep(R) { … },             // valfri: körs innan NÅGOT ritas – ändra färger/mått i R
    uses: ['accent'],          // valfri: färgfält redigeraren ska visa för posten
    tile: 'torso',             // valfri: utsnitt i redigerarens ruta – head face neck torso legs side full
                               //   (t.ex. handskar/klockor under Smycken, som annars visas som huvud)
    // valfria krokar (se lagerordningen): afterLegs afterHips beforeTorso afterTorso
    //   beforeArms afterArms afterHead afterFace afterHair last
  },
};
```

* Id:t (nyckeln) är det som sparas i look-objektet och skickas över nätet – **byt aldrig namn
  på ett id som släppts**. Använd engelska/ASCII-id i camelCase (`sideCut`), svenska etiketter.
* `none` är reserverat för "inget"-posten i register med tomt värde.
* Saknas en vyfunktion ritas inget i den vyn (t.ex. ansiktsdetaljer bakifrån).
* Funktionerna anropas som metoder (`this` = posten), så `back(R) { this.front(R); }` går bra.
* Listorna `HAIR_STYLES`, `TOP_TYPES` … byggs ur registren vid inläsning – en ny post hamnar
  automatiskt i dem, i redigeraren, i `cleanLook` och i kontaktarken. Listornas början är densamma
  som före registren (de gamla värdena först, i gammal ordning – för `HAIR_STYLES` styrs det av en
  fast lista i people.js); nya värden läggs till efter. Spara och jämför ändå **värden**, inte index.
* `group` blir en gruppknapp i redigeraren. Har ett fält fler än 12 val i minst två grupper visas
  en grupp i taget (plus "Alla"), så att gruppen ryms utan att man scrollar – håll grupperna runt
  4–20 val. Poster utan `group` (t.ex. `none` och de gamla grundvalen) syns alltid först.

### Specialegenskaper per register

**TOP_REG** (motorn ritar bålens grundyta i `R.shirt` och ärmarna; posten ritar detaljerna ovanpå):
* `sleeve: 'short' | 'long' | 'none'` – ärmlängd (kort = 3 px tyg, sedan hud).
* `sleeveAt(R, j)` – valfri ramp för ärmraden `j` (0 = axeln), `undefined` = tröjfärgen.
  Anropas för stående/gående armar i alla vyer – kolla `R.side` om det bara gäller en vy.

**BOTTOM_REG** (motorn ritar benen; posten styr med egenskaper):
* `bareFrom` – benrad där bar hud börjar när man står (tal eller `(R) => tal`; shorts 3).
* `skirt(R)` – antal kjolrader under höften (0 = ingen kjol). Kjol ⇒ inget bälte, skugga på benen.
* `lapSkin`, `shinSkin` – sittande: bara lår / smalben.
* `belt: false`, `crotch: false`, `folds: true`, `darkSole: true`.
* `colorField: 'shirt'` – redigeraren visar tröjfärgen som underdelens färg (klänning).
* `legRow(R, row)` – efter varje stående benrad: `row = { x, y, w, j, n, left, far, side, bare }`.
* `front/back/side(R)` – ritas efter höften/kjolen (höftens översta rad = `R.hy`).
* Overall/snickarbyxor: bröstlappen ritas i kroken `afterTorso(R)` (efter tröjan).

**SHOE_REG**: vyfunktionerna får ett andra argument, ett per fot:
* `front/back(R, s)`: `s = { x, y, left, rows }` – skon är `x … x+R.lw`, raderna `y` (ovansida)
  och `y+1` (sula); `rows = [{ x, y, w }]` är benets rader (stövlar ritar uppåt över dem).
* `side(R, s)`: `s = { x, y, far, rows }` – skon är `x-1 … x+3` (tån åt höger); `far` = bortre foten
  (använd `R.far(ramp)` för mörkare färger).

**HAT_REG / HAIR_ACC_REG**: `R.topAt(x, fb)` ger översta ritade pixeln i kolumnen (hårets topp),
`R.has(x, y)` om en pixel är ritad – så att saker hamnar ovanpå frisyren oavsett längd.

**BAG_REG**: delen som syns bakom ryggen från sidan ritas i `beforeTorso(R) { if (!R.side) return; … }`.

**Tryck och effekter** (TOP_PRINT_REG, BOTTOM_PRINT_REG, HAIR_FX_REG): använd `R.pattern` på rätt
etikett – tonen (hi/base/lo/dk) följer med automatiskt, så skuggning och bortre ben blir rätt.

---

## 3. Renderkontexten R

| grupp | fält |
|---|---|
| **rita** | `put(x, y, färg)`, `rect(x, y, w, h, färg)` – heltal, logiska koordinater (speglas i vänstervy) |
| **sudda** | `erase(x, y)`, `eraseRect(x, y, w, h)` – gör pixlar genomskinliga igen (t.ex. hår som en hjälm döljer); konturen läggs efteråt |
| **läsa** | `has(x, y)`, `get(x, y)` → färg eller −1, `topAt(x, fb)`, `tagAt(x, y)` |
| **mönster** | `each(tag, (x, y, färg) => …)`, `pattern(tag, (x, y, färg) => ramp \| färg \| null, källramp?)` |
| **övrigt** | `draw(fält)` ritar fältets aktuella post i vyn, `E` (poster per fält), `id` (id per fält), `L` (normaliserat look), `tag` (etiketten nya pixlar får) |
| **vy** | `view` ('front'\|'back'\|'side'), `dir`, `front`, `back`, `side`, `flip`, `frame` |
| **rörelse** | `sit` (5, 6), `eat` (6), `carry` (7–9), `walkA` (1, 7), `walkB` (2, 8), `bob` (−1 på 3/4, +1 sittande) |
| **kropp** | `K` (barn), `adult`, `tw` (halv bålbredd = build), `lw` (benbredd 4/3), `armLen` |
| **höjder** | `h0`=`headTop`, `headH` (12/11), `eyeRow` (h0+7 / h0+6), `torsoTop`=`ty0`, `ty1`=`hy` (höftens översta rad, bålens slut), `hipTop`, `hipH`, `legTop`, `legLen`, `shoeTop` (37) |
| **underdel** | `skirtLen`, `skirted`, `bareFrom`, `longSleeve`, `noSleeve` |
| **ramper** `{hi,base,lo,dk}` | `skin`, `hair`, `hair2`, `shirt`, `acc` (accent), `print` (print2 → accent), `pants`, `pants2`, `shoe`, `shoe2`, `cap`, `bagC`, `phone`, `neckC`, `lipC`, `shadowC`, `markC`, `eyeC` (null utan eyeColor) |
| **heltalsfärger** | `eye` (ögonfärgen), `lip` (läppfärg – smink byter i `prep`), `sole`, `darkShoe` |
| **verktyg** | `mix(a, b, t)`, `mul(c, f)`, `ramp(c)`, `far(ramp)`, `toneOf(c, ramp)`, `toInt(hex)`, `TAG`, `SW`, `SH` |

Mått vid bildruta 0 (spritekoordinater, fötterna vid 12,39):

| | vuxen | barn |
|---|---|---|
| huvud `h0` … | 6 … 17 | 14 … 24 |
| ögonrad `eyeRow` | 13 | 20 |
| bål `torsoTop` … `ty1-1` | 18 … 26 | 25 … 30 |
| höft `hipTop` | 27–28 | 31 |
| ben `legTop` … | 29 … 36 | 32 … 36 |
| sko | 37–38 | 37–38 |

Framifrån: huvudet x 7–16 (öron 6 och 17), mitten mellan x 11 och 12, bålen `12-tw … 11+tw`,
armarna `12-tw-2` och `12+tw`. Från sidan (ansiktet åt höger): huvudet x 8–16, näsan x 17,
örat x 11–12, bålen x 9–15, benen från x 11.

**Etiketter** (`TAG` i util.js): `skin pants shoe belt torso top sleeve apron neck bag head ear face
brow beard glasses hair hairAcc hat phones jewel extra`. Motorn sätter `R.tag` före varje del; en
post får fältets etikett (t.ex. frisyren ⇒ `TAG.hair`, tryck ⇒ `TAG.torso`).

---

## 4. Lagerordningen

Framifrån/bakifrån:
```
ben + skor → [afterLegs] → höft/kjol/bälte → bottom-posten → bottomPrint → [afterHips] → [beforeTorso]
→ bål (grundyta) → topPrint → top-posten → [afterTorso] → förkläde → neck → bag → [beforeArms]
→ armar → [afterArms] → huvud → ears → [afterHead]
→ eyes → brows → nose → mouth → cheeks → makeup → marks → beard → glasses → [afterFace]
→ style (frisyr) → hairFx → hairAcc → [afterHair] → hat → phones → jewel → [last] → kontur
```
Från sidan: bortre ben → bortre arm (när den svänger) → närmaste ben → [afterLegs] → höft … sedan
samma ordning. Krokarna anropas för alla valda poster i ordningen bottom, bottomPrint, shoeType,
top, topPrint, neck, bag, ears, eyes, brows, nose, mouth, cheeks, makeup, marks, beard, glasses,
style, hairFx, hairAcc, hat, phones, jewel.

---

## 5. Exempel (provkörda)

Överst i registerfilen: `import { TAG, mix } from './util.js';` (lägg till det som behövs).

```js
// hair.js – ombré: nedre delen av håret i andra färgen
ombre: { label: 'Ombré', front(R) { const y0 = R.h0 + 4; R.pattern(TAG.hair, (x, y) => (y >= y0 ? R.hair2 : null)); },
         back(R) { this.front(R); }, side(R) { this.front(R); } },

// tops.js – kamouflagetryck på bålen och ärmarna
camo: { label: 'Kamouflage', front(R) { R.pattern(TAG.torso, (x, y) => (((x * 7 + y * 13) >> 1) % 5 === 0 ? R.print : null)); },
        back(R) { this.front(R); }, side(R) { this.front(R); },
        afterArms(R) { R.pattern(TAG.sleeve, (x, y) => (((x * 7 + y * 13) >> 1) % 5 === 0 ? R.print : null)); } },

// bottoms.js – stövlar över de tre nedersta benraderna
const bootFB = (R, s) => { R.rect(s.x, s.y, R.lw + 1, 2, R.shoe.base); for (const r of s.rows.slice(-3)) R.rect(r.x, r.y, r.w, 1, R.shoe.base); };
boots: { label: 'Stövlar', front: bootFB, back: bootFB,
         side(R, s) { const c = s.far ? R.far(R.shoe) : R.shoe; R.rect(s.x - 1, s.y, 5, 2, c.base); for (const r of s.rows.slice(-3)) R.rect(r.x, r.y, r.w, 1, c.base); } },

// acc.js – halsduk som även ligger över hakan (krok efter huvudet)
scarf: { label: 'Halsduk', front(R) { R.rect(12 - R.tw + 1, R.ty0, R.tw * 2 - 2, 2, R.neckC.base); R.rect(13, R.ty0 + 2, 2, 4, R.neckC.lo); },
         back(R) { R.rect(12 - R.tw + 1, R.ty0, R.tw * 2 - 2, 2, R.neckC.base); },
         side(R) { R.rect(10, R.torsoTop, 6, 2, R.neckC.base); },
         afterHead(R) { if (!R.back) R.rect(R.side ? 11 : 9, R.h0 + R.headH - 1, R.side ? 5 : 6, 1, R.neckC.hi); } },

// acc.js – hårspänne ovanpå vilken frisyr som helst
clip: { label: 'Hårspänne', front(R) { R.rect(13, R.topAt(14, R.h0) + 1, 3, 1, 0xff5dc8); }, … },

// face.js – läppstift: byt läppfärg innan munnen (och helskägget) ritas
lipstick: { label: 'Läppstift', prep(R) { R.lip = R.lipC.base; } },
```

---

## 6. Klädkatalogen (js/data/wardrobe*.js)

Plagg man kan äga. Registret säger **hur** något ritas; katalogen säger **vad som säljs**.
Ett plagg kan kombinera flera registerval (t.ex. huvtröja + kamouflagetryck).

```js
// wardrobe-tops.js
{ id: 'top-hoodie-camo', slot: 'top', look: { top: 'hoodie', topPrint: 'camo' },
  name: 'Kamouflagehuvtröja', price: 450, dept: 'unisex', icon: '🧥',
  colors: { shirt: '#6b7a4a', print2: '#3f4a2c' },   // förslag: mannekäng + när man köper
  group: 'Tröjor',                                    // valfri underrubrik
  tile: 'torso' },                                    // valfritt utsnitt i redigeraren (TILE_VIEWS)
```
* `slot`: `top bottom shoes hat glasses bag neck jewel hairAcc phones`. `look` får bara innehålla
  platsens modellfält (`SLOT_FIELDS`): top → `top, topPrint`; bottom → `bottom, bottomPrint`;
  shoes → `shoeType`; neck → `neck`; övriga → fältet med samma namn. Ej nämnda fält i platsen
  återställs när plagget tas på (en vanlig huvtröja tar bort trycket).
* Färger väljer spelaren fritt – `colors` är bara förslag.
* `price` 60–2500 kr (bas ~60–150, vardag 150–600, märkes/fest 600–2500). `free: true` = basplagg.
* `dept`: `'tjej' | 'kille' | 'unisex'` (klädaffärens avdelning).
* Två plagg får inte ha exakt samma modell (samma `look`); `checkWardrobe()` hittar sådant.
* `legacy` bara på det första sortimentet (gamla sparfiler, `'kind:v'`).

Hjälpfunktioner: `WARDROBE`, `SLOTS`, `SLOT_FIELDS`, `SLOT_LABELS`, `SLOT_CAN_BE_EMPTY`,
`itemById(id)`, `itemsForSlot(slot)`, `freeItemIds()`, `legacyKeyToId('hat:cap')` → `'hat-cap'`,
`idToLegacyKey(id)`, `lookForItem(item|id, look, { colors })`, `lookWithoutSlot(slot, look)`,
`isWorn(item, look)`, `wornItem(look, slot)`, `slotIsEmpty(look, slot)`, `groupOf(item)`,
`checkWardrobe()` → lista med problem.

Redigeraren: `setAvatarWardrobe(() => ägdaId)` – kopplat i main.js till `A.game.ownedWardrobeIds()`.
(Det gamla `setAvatarLocks((kind, v) => låst?)` finns kvar men används inte: då syns bara plagg
med `legacy`-nyckel + basplagg.)
`avatarCanWear(item)` säger om spelaren får ha plagget på sig. Ett plagg man bär utan att äga
(t.ex. från en äldre sparning) ligger kvar och syns med 🔒 och streckad ram tills man byter bort det.
`setAvatarSalon(true)` – också kopplat i main.js: frisyr och hårfärg (hair, hairFx, hair2) byts hos
💈 Frisören i downtown (js/scenes/shop-frisor.js), inte i garderoben hemma. Där syns bara den
nuvarande frisyren och hårfärgen med en hänvisning till frisören, och Slumpa rör dem inte. En ny
figur (`openAvatarEditor({ fresh: true })`, Nytt spel) väljer fritt; `{ salon: false }` släpper
spärren för ett enskilt anrop.

**Ägande och köp (js/game.js).** `g.wardrobe` sparar katalog-id (`'top-hoodie-camo'`). Plagg med
`legacy` står dessutom kvar med den gamla nyckeln som alias (`'top-hoodie'` + `'top:hoodie'`), så att
en äldre version av spelet känner igen dem; gamla sparfiler migreras så vid laddning. Okända id
(plagg från en nyare version) ligger orörda i `_keep`.
* `g.ownsWardrobe(id)` (basplagg = alltid), `g.ownedWardrobeIds()` (basplaggen inräknade),
  `g.buyWardrobe(id)` → `{ ok, msg?, item?, price? }` (drar pengarna och sparar),
  `g.clothesPrice(item)` (REA-dagar −25 %), `g.wardrobeCount()` → `{ owned, of }` (dagboken).
* Samma sak under namnen butikerna använder: `ownsItem`, `buyItem`, `itemPrice(item|id)`, `ownedItemIds`.
  Alla tar även en gammal nyckel (`'hat:cap'`).
* Gamla anropen `g.clothesLocked(kind, v)` och `g.buyClothes(kind, v)` fungerar som förut
  (t.ex. hörlurarna i elektronikbutiken) och köper via katalogen.

**Redigerarens rutor.** Rutnäten visar bara bilder; namnet på det valda står i sektionens rubrik
och byts mot rutan under pekaren (eller med tangentbordsfokus). Utsnitten (`VIEWS` i avatar.js)
ritas i heltalsskala: 3× (60 px) på dator och 2× (40 px, ansikte 3× = 45 px) i tätt läge
(bredd < 640 px eller höjd < 540 px), gånger enhetens pixeltäthet så att pixlarna blir skarpa.

---

## 7. Regler

1. **Alla fyra riktningar.** Varje post ska ha `front`, `back` och `side` (vänster speglas). Undantag
   bara när något verkligen inte syns (ansikte bakifrån).
2. **Barn och vuxen.** Använd `R.h0`, `R.eyeRow`, `R.headH`, `R.tw`, `R.lw`, `R.ty0/ty1` – aldrig
   hårdkodade y-värden. Titta på barnet i kontaktarket.
3. **Heltal.** Bara heltalskoordinater, ingen bråkskala, ingen kantutjämning. Färger ur ramperna
   (`hi/base/lo/dk`) så att skuggningen stämmer; motorn lägger konturen själv.
4. **Läsbart i 1×.** En figur är ~16×32 synliga pixlar – en detalj är 1–2 pixlar. Hellre en tydlig
   pixel i kontrastfärg än tre som flyter ihop.
5. **Gamla looks är pixellåsta.** Ändra inte befintliga poster, motorn, `makeLook` eller
   slumptabellerna (`SKIN, HAIR, SHIRT, PANTS, SHOES, STYLES, TOPS, BOTTOMS`). Stadens kunder
   (`makeLook`) får därför inga nya val. Nya NPC-grupper kan använda `makeLookRich(rng)`: samma
   grund som `makeLook`, men med nya frisyrer, ansikten och plagg. Vardagligt – grupperna i
   `RICH_SKIP` (utklädnad, fest, uniformer, ansiktsmålning …) och `RICH_ADULT_ONLY` (smink,
   tatueringar, piercingar … bara vuxna) hoppas över. Lägg till där om en ny grupp inte passar
   stadsfolk. Samma frö ger samma figur.
6. **Snabbt.** Ritas bara vid cachemiss men håll varje post billig (< 2 ms per sprite totalt,
   i dag ~0,05 ms för vanliga looks och ~0,15 ms när alla fält är satta). Inga objekt, closures
   eller canvas per pixel – skapa tabeller/mönster en gång vid inläsning, inte per anrop.
   Motorn räknar ut vilka poster som har krokar en gång per post, och konturen läser från en
   återanvänd buffert.
7. **Svenska** etiketter och kommentarer.

## 8. Verktyg

```bash
# (server: python -m http.server 8788 --bind 127.0.0.1 i spelmappen)
node tools/people-regress.mjs                 # MÅSTE visa "0 skillnader" – gamla looks pixelidentiska
node tools/people-sheet.mjs --cat style       # kontaktark → tools/out/sheets/style-N.png (≤ 2000 px)
node tools/people-sheet.mjs --cat top --from bomber      # bara nya poster från och med ett id
node tools/people-sheet.mjs --cat katalog:top            # katalogens överdelar → katalog-top-N.png
node tools/people-sheet.mjs --cat eyes --frames 0,1,5 --dirs down,right,up,left --scale 4
node tools/avatar-snap.mjs                    # redigeraren i riktiga spelet: flikar, klick, konsolfel
```
`people-sheet` skriver också antal val per register, ms/sprite, katalogproblem, en registerkontroll
(poster utan etikett/ritning, okänd `tile`, front utan side – info, kan vara avsiktligt) och konsolfel.
Kontaktarken hamnar i `tools/out/sheets/` (ändra med `--out`, t.ex. en egen mapp per specialist så att
parallella körningar inte skriver över varandra).
