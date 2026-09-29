# Pixelstaden – kartkontrakt v2

Alla stadsmoduler delar **en** karta: [`js/city/map.js`](../js/city/map.js). Den här filen
beskriver kontraktet så att flera personer kan rita och programmera olika delar av
staden parallellt utan att kollidera. Scenen som kopplar ihop allt är
[`js/scenes/city.js`](../js/scenes/city.js).

Grundregler (gäller allt i staden):

- **Ett pixelkorn.** 1 världsenhet = 1 spelpixel. Heltal överallt, ingen bråkskala,
  ingen kantutjämning. Kameran visar 384 × 216.
- **Hög detaljtäthet.** 3–4 toners skuggning, textur på alla ytor, mängder av små
  detaljer. Pix-pennan och typsnitten finns i [`js/core/floor-pix.js`](../js/core/floor-pix.js).
- **Allt gåbart.** Inget kommer "från sidan" – man går med sin figur till allt.
  Ljuset kommer snett från sydväst: fasader mot söder är belysta, skuggor faller norrut/österut.
- **Svenska** i all text och alla kommentarer.
- **Bakåtkompatibelt.** v1 (norra husraden, Pixelgatan, trottoarerna, parken och alla
  v1-exporter) ligger kvar på exakt samma koordinater. All befintlig konst passar.
  v3 flyttade förorten SUB_DX = 1280 px österut (se avsnitt 8) – husens id, dörrtyper
  och sparfält är oförändrade.
- **Tålig laddning.** Varje modul laddas för sig av scenen; kraschar en så lever resten.
  Ritfel loggas en gång per källa och stoppar aldrig loopen. Kör `validateMap()` (röktestet
  gör det) när du flyttar något.

## 1. Världen

Världen är **4000 × 820** (v3; v2 var 2720 bred). Tvärsnitt i y (hela bredden):

| y | Vad | CITY-fält |
|---|---|---|
| 0–8 | häck/plank/mur mot kvarteret bakom | – |
| 8–36 | bakgatan bakom norra raden (gåbar) | `BACK` |
| 40–186 | **norra husraden** – fasaderna står på y = 186, taken sticker upp bakåt | `FOOT_TOP`, `BASE` |
| 186–218 | norra trottoaren (dörrarna öppnas mot den) | `SIDEWALK_N` |
| 218–276 | **PIXELGATAN** – övre körfältet västerut (y 244), undre österut (y 271) | `ROAD`, `LANES` |
| 276–306 | södra trottoaren (busshållplatser) | `SIDEWALK_S` |
| 306–462 | **parken** (centrum) / **Finanstorget** (downtown) / vatten (floden) / parkering, lekplats, lamellhus, grusplan (förorten) | `PARK` |
| 462–490 | parkgången bakom den södra raden (gåbar; taken syns härifrån) | `BACK_S` |
| 494–640 | **södra husraden** – fasaderna vetter SÖDERUT och står på y = 640 | `FOOT_TOP_S`, `BASE_S` |
| 640–672 | trottoaren framför de södra husen | `SIDEWALK_SN` |
| 672–730 | **SÖDERGATAN** – samma körfältsupplägg, `DY_S = 454` px under Pixelgatan | `ROAD_S`, `LANES_S` |
| 730–760 | bortre trottoaren (busshållplats, bänkar mot kanalen) | `SIDEWALK_SS` |
| 760–776 | kajen med räcke på y 772 – längre söderut går man inte | `QUAY`, `WALK_BOTTOM` |
| 776–820 | kanalen (vatten; is på vintern) | `CANAL` |

Tvärsnitt i x:

| x | Område |
|---|---|
| 0–1700 | **CENTRUM** (norra raden), **PARKEN**, **SÖDER** (södra raden) – `X_CITY` |
| 1700–1752 | **INFARTEN** – lodrät väg från bakgatan till Södergatan (`INFARTEN`, `LANES_I`; gågata norr om Pixelgatan, bilväg söder om den) |
| 1752–2400 | **DOWNTOWN** (v3) – `X_DT`; finanskvarteret: skyskrapor, banken, elektronik, frisör, skor, accessoarer; **FINANSTORGET** i mellanbandet |
| 2400–3032 | **FLODEN** (v3) – `RIVER`; kajer + vatten från y 0 till 820, **STORA BRON** (Pixelgatan) och **JÄRNBRON** (Södergatan) |
| 3032–4000 | **FÖRORTEN** – `X_SUB` (v2-förorten + `SUB_DX` 1280); norra raden längs Pixelgatan, mellanband med parkering/lekplats/lamellhus/grusplan, södra raden längs Södergatan |

`ROWS.n` / `ROWS.s` ger base, top, back, sidewalk och road för respektive husrad.

## 2. Exporter i map.js

| Export | Innehåll |
|---|---|
| `CITY` | alla band ovan + `VIEW_W/H` |
| `ROWS` | husradernas geometri |
| `LANES`, `LANES_S`, `LANES_I` | körfält (`{ dir, y }` för vågräta vägar, `{ dir, x }` för Infarten) |
| `BUILDINGS` | norra raden i centrum (v1, oförändrad) |
| `BUILDINGS_S` | södra raden (SÖDER), `row: 's'`, `face: 'south'` |
| `BUILDINGS_D` | downtowns hus (v3; `row: 'n'` och `row: 's'`, `district: 'DOWNTOWN'`) |
| `BUILDINGS_X` | förortens hus (`row: 'n'` längs Pixelgatan, `row: 's'` längs Södergatan) |
| `DOOR_TYPES` | dörrtyperna som `validateMap` känner: swing, slide, open, roll, boarded, revolve |
| `FREESTANDING` | fristående hus man går runt (`row: 'f'`, djup `d`): kiosk, WC, glasskiosk, lekförråd, musikpaviljong, lamellhus, husvagn |
| `ALL_BUILDINGS`, `buildingById(id)` | alla hus |
| `LOTS` | tomter (kyrkogård, parkering, lekplats, grusplan, tomten, återvinning, vagnsplatsen) med `rect`, `fence`, `gates`, `drive` |
| `STREETS` (v1), `STREETS_S`, `STREETS_D` (v3), `STREETS_X`, `STREETS_ALL` | luckorna mellan husen: `kind` edge/alley/street/road/lot, `name`, `row`, `y0..y1`, `pedestrian` |
| `CROSSWALKS` (v1 + Infarten + Betonggatan + Bankgatan), `CROSSWALKS_S` (+ Bankgatan), `CROSSWALKS_I`, `CROSSWALKS_ALL` | övergångsställen; `i` är unikt över alla (`CROSSWALKS_ALL[i].i === i`, listan sorteras på i), `road`, `stop` (stopplinjer per riktning), `lights`, `broken`. Nya får nästa lediga i (Bankgatan = 10 och 11) och läggs SIST i sin väglista |
| `LIGHTS` (Pixelgatan), `LIGHTS_S`, `LIGHTS_ALL` | trafikljusstolpar `{ crosswalk, road, side, x, y, broken? }` |
| `BUS_STOPS`, `BUS_STOP` (v1), `busStopById(idEllerNamn)` | hållplatser `{ id, name, district, x, y, road, lane, wait, broken? }` |
| `ROADS`, `roadById`, `JUNCTIONS` | vägarna med `axis`, `lanes`, `crosswalks`, `lights`, `stops`, `traffic` – **trafiken använder ROADS** |
| `PARK_LAYOUT` | plaza, promenade, paths (v1) + `walks`, `back`, `pond`, `playground`, `dogPark`/`dogGate`, `meadow` |
| `SUB_LAYOUT` | förortens gångar (asfalt) |
| `DOWNTOWN_LAYOUT` | v3: `plaza` (Finanstorget), `axis` (Bankgatans mittlinje), `statue`, `fountains`, `back` (bakgatan bakom södra raden), `behind` (ytorna bakom PIXEL TOWER och GLASTORNET – hinder, se 8.1) |
| `PATHS`, `PATH_RECTS` | alla gångar (`{ rect, kind: 'grus'|'asfalt'|'trottoar'|'torg'|'kaj', district }`); `torg` är INTE reserverat (rekvisita får stå där) |
| `WATER`, `CANAL_RECT` | dammen (skivor) och kanalen som gånghinder |
| `RIVER`, `BRIDGES`, `BRIDGE_OBSTACLES`, `inRiver(x, y)` | v3: floden (kajer, vatten, kajräcken) och broarna (däck, räcken, torn) – se avsnitt 8 |
| `DISTRICTS`, `districtAt(x, y)`, `districtByName` | områdena `{ id, name, tag, rects, worn 0–1, spawn }` |
| `footprint(b)`, `doorFront(b)`, `doorCenter(b)`, `baseOf(b)` | geometri för alla hus |
| `MAP_OBSTACLES` | kartans egna hinder (fotavtryck + blocks + dammen + kanalen) |
| `gateRect(lot, gate)`, `RESERVED` | ytor där rekvisita inte får stå |
| `ART_OVER`, `ART_BELOW`, `artPos(b, img)`, `artPosS`, `artPosX`, `artBox(b)` | bildplacering |
| `inRect`, `isNightHour`, `validateMap()` | hjälpare |
| `ENTER_RE` | alla `enter`-värden scenen känner (validateMap använder den) |

### Husets fält

```
id, kind        kind väljer konsten i BUILDING_ART[kind] (samma som id)
x, w, h         fotavtryckets västra kant/bredd; h = fasadens höjd ovanför base
base, top       fasaden står på base; fotavtryck = [x, top, x+w, base−1]
foot, blocks    (valfritt) eget fotavtryck / fler hinder (pumpöar, häckar …)
yard            (valfritt) { kind: 'forecourt'|'garden', rect } gåbar gård framför ett indraget hus
frontY          (valfritt) y för husets främre lager (BUILDING_ART[kind].front) – mackens tak
door            { x0, x1, type: 'swing'|'slide'|'open'|'roll'|'boarded'|'revolve' }   (revolve = karuselldörr, v3)
row             'n' | 's' | 'f'      face: 'south' (alla)      district: 'CENTRUM' | 'PARKEN' | 'SÖDER' | 'DOWNTOWN' | 'FÖRORTEN'
sign, icon      skylt och ikon i meddelanden
enter           'hem' | 'bostad' | 'mat' | 'klader' | 'mobler' | 'kafe' | 'djur' | 'burgare' | 'frukt' | 'flyg'
                | 'glass' | 'narbutik' | 'leksaker'
                | 'bank' | 'elektronik' | 'frisor' | 'skor' | 'accessoarer' | 'universitet' | 'bio' | 'kebab' | 'pantbank'
                | 'jobb:<id>' | 'bostad:<homeId>' | null      (validateMap känner exakt den listan: map.js ENTER_RE)
homes           (valfritt) vilka bostäder (HOMES-id) som ligger i huset
open            [från, till] i timmar          soon: egen text när man inte kan gå in
tower           (kyrkan) { x0, x1, h }
```

**enter i scenen:** `'hem'` och `'bostad:<id>'` går hem om `homes` innehåller spelarens
bostad, annars öppnas Bostadsbyrån (eller en toast om bostaden inte finns i `HOMES` än).
`'jobb:<id>'` startar jobbet om `JOBS[id]` finns i game.js och har en jobbscen i main.js
(`ENGINES`, `A.jobReady(id)`) – annars toasten *"… anställer snart!"* med verb och lön från
[`js/city/places.js`](../js/city/places.js) (eller `JOBS`) och examenskravet om jobbet har `kraver`.
Huvudagenten kopplar in `WORKPLACES` och `NEW_HOMES` därifrån i game.js (`JOBS`, `HOMES`, `ENGINES` i main.js).
**Egna scener** (`'bank'`, `'elektronik'`, `'frisor'`, `'skor'`, `'accessoarer'`, `'universitet'`, `'bio'`,
`'kebab'`, `'pantbank'`): city.js `SCENE_DOORS` → `A.go(namn)`. main.js laddar de scenerna tåligt
i bakgrunden (`DOOR_SCENES`, var för sig med `import()` – spelet startar utan att vänta på dem; går
man in innan en är laddad visas en tom ruta tills den är klar); saknas eller kraschar en modul visar
dörren husets `soon`-text i stället (`A.hasScene(namn)`). Nytt ställe = namnet i map.js `ENTER_RE`, city.js
`SCENE_DOORS` och main.js `DOOR_SCENES`.

## 3. Bildplacering

En husbild är `b.w + 16` bred (8 px överhäng åt varje håll) och ritas med övre vänstra
hörnet i `artPos(b, img)` = `(b.x − 8, base + 4 − img.height)`. Bildens rad `höjd − 4`
är alltså markytan `y = base`. `artBox(b)` ger den rekommenderade rutan:

- norra raden: 190 hög, canvas-y = världs-y (som i v1)
- södra raden: från `top − 40` (taket syns från parken) ner till `base + 4`; canvas-y = världs-y − artBox(b).y
  (454 för ett vanligt hus, mer för torn och höga hus)
- fristående hus: tak (djup `d`) + fasad + 16

`paint` cachas av scenen per (hus, natt, snö). Allt som rör sig ritas i `live`.

## 4. Modulkontrakt

### Hus – `BUILDING_ART[kind]` (buildings-shops, buildings-work, buildings-south, buildings-suburb)

```
paint(b, night, opts) → canvas        opts = { worn: stadsdelens slitage 0–1, snow: 0|1, season }
live(ctx, b, st)                      efter bilden, varje bildruta: st = { t, night, hour, doorOpen 0–1, env, worn }
glow(ctx, b, st)                      efter mörkret: tända fönster, skyltar, neon
front?(ctx, b, st)                    (valfritt) husets främre lager, ritas som föremål vid y = b.frontY
items?(b, st) → [{ x?, y, draw(ctx) }] (valfritt) egna y-sorterade föremål (mackens pumpar och tak)
```

`buildings-south.js` och `buildings-suburb.js` är platshållare byggda på
[`facade-kit.js`](../js/city/facade-kit.js) (generisk husmålare med tak, fasadytor, fönster,
skylt, dörr och slitage). Specialisterna gör om husen med samma detaljrikedom som
Pixelgatans norra rad – behåll `id`/`kind`, `door` och `artBox`. Förortens hus ritas slitna
(`opts.worn = 1`): klotter, sprickor, rost, trasiga/igenspikade fönster, galler.

### Marken – `ground.js`

```
paintGround(night) → canvas CITY.W × CITY.H     målas en gång per dag/natt, cachas av scenen
groundLive(ctx, env, view)                       molnskuggor, regnringar … varje bildruta (före vädrets snötäcke)
groundOver(ctx, env, view)                       fotspår/trampade stigar – scenen ritar den EFTER weather.drawBack
export const V2 = true                           när marken målar hela v2-världen
```

Tills `V2` exporteras lägger scenen platshållaren
[`fallback-v2.js`](../js/city/fallback-v2.js)`.paintGround(canvas, night)` ovanpå: Infarten,
Södergatan med zebror/stopplinjer/busskficka, trottoarerna, kajen, kanalen, dammen,
förortens norra rad, tomterna, gränderna och gågatorna i södra raden, gårdarna.
Använd `PATHS` (ytslag), `LOTS`, `STREETS_ALL`, `ROADS`, `CROSSWALKS_ALL`, `PARK_LAYOUT`,
`SUB_LAYOUT`, `DISTRICTS[].worn` (slitet i förorten), `env.weather.snowCover`/`wet` i groundLive.

### Rekvisita – `props.js`

```
createProps(env) → { items(), obstacles, update(dt), glow(ctx, view) }
export const V2 = true
```

Föremål `{ x, y, draw(ctx), kind }` sorteras på `y` (fotlinjen). Ställ aldrig något i
`RESERVED`. Platshållaren ritar tills `V2`: busskurer för hållplatserna 1–3 (den trasiga
med krossat glas, hål i taket, klotter och böjd skylt), staket/grindar runt tomterna och
hundrastgården, gravstenar, containrar, lekplatsens gunga/rutschkana.
Att göra: buskar, bänkar, lyktor, skräp, graffitiväggar i förorten, kyrkogårdens
träd, kajens räcke och bänkar, hundrastgården, ängen, lekplatsen i parken.

### Trafik – `traffic.js`

```
createTraffic(env) → { items(), obstacles, update(dt), glow(ctx), positions?(), pedGreen(crosswalkI) }
export const V2 = true
```

Kör på **alla `ROADS`** (Pixelgatan, Södergatan, Infarten – `axis`, `lanes`, `crosswalks`,
`lights`, `stops`, `JUNCTIONS`). Bussen stannar vid `road.stops` (lane = index i `lanes`).
Trafikljus med `broken` blinkar gult. Platshållaren ritar stillastående stolpar för
`LIGHTS_S` tills `V2`.

### Livet – `life.js`

```
createLife(env, traffic, props) → { items(), obstacles?, update(dt), glow(ctx), positions(),
                                    busySeats() → Set, seatBusy(id) }
```

`props` (skickas av scenen) ger de riktiga sittplatserna via `props.seats()` –
utan den faller livet tillbaka på att gissa bänkar ur hindren.

Fotgängare, hundar, fåglar, katter … i hela världen: använd `STREETS_ALL`,
`CROSSWALKS_ALL` (fråga `traffic.pedGreen(i)`), `PATHS`, `BUS_STOPS`, `ALL_BUILDINGS`
(dörrar), `LOTS`, `DISTRICTS` (förortsfolk ser annorlunda ut, downtown går i kavaj). Tänk
på storleken: nav-rutnätet är 4000 × 820. Floden är hinder (`MAP_OBSTACLES`) – gånglinjerna
bryts vid kajerna och fortsätter bara över broarnas trottoarer.

### Vädret – `weather.js`

```
createWeather(env) → { update(dt), drawBack(ctx, view), drawFront(ctx, view), glow(ctx, view) }
weatherAt(day, hour, eventId)          det rena vädret (för tester/andra moduler)
weatherLabel(w) → 'Sol, 18° · sommar'  drawWeatherBadge(ctx, x, y, w)  liten pixelskylt
weatherBadgeSize(w) → { w, h }         brickans mått (scenen håller husnamnen i överkanten borta från den)
env.weather = { kind: 'sol'|'moln'|'regn'|'snö'|'dimma'|'blåst', intensity 0–1, wind (px/s, + = österut),
                snowCover 0–1, wet 0–1, season 'vår'|'sommar'|'höst'|'vinter', temp, dayIndex }
env.forceWeather = { kind?, intensity?, snow?, season?, temp? }   tvingat väder (förhandsvisning/test)
```

Deterministiskt ur `env.day` (en årstid = 7 speldagar), tre väderpass per dygn (kl 0, 11, 17)
med mjuk övergång, dagshändelsen `'regn'` ger regn hela dagen. `env.rain` (v1) sätts av
vädret. Snö ligger kvar på vintern, smälter de första vårdagarna; vägarna är plogade.
Att göra: rikare snöfall, snö på tak/rekvisita (`opts.snow` till paint), pölar, dimbankar,
löv i blåsten, solstrålar, åska.

### Gångmotorn – `walk.js`

`createCityWalker({ W, H, left, right, top, bottom, spawn, cell })` – samma API som
`createWalker` i `walkable.js` men A* på typade arrayer för den stora världen
(20 vägsökningar tvärs över staden ≈ 0,3 s).

## 5. Scenen (city.js)

Ritordning per bildruta:

1. `groundImg(night)` (ground.paintGround + ev. fallback + **bridge.paintRiver** vid `RIVER.x0`) → `ground.groundLive`
2. **`bridge.riverLive`** (vattnet i floden) → `weather.drawBack` (snötäcke, våt glans, is på kanalen och floden) → `ground.groundOver` (fotspår skarpt ovanpå snön)
3. **y-sorterade föremål**: alla hus (`y = base`, + `items`/`front`), fallback, **bridge**, props, traffic, life, andra spelare, jag
4. `weather.drawFront` (regn, snöfall, dimma, blåst, molnljus)
5. mörker (`env.dark`) → `glow` för hus, fallback, **bridge**, props, traffic, life, weather
6. skärmlagret: kompis-pilar, husnamn i överkanten (tre rader; den tredje bara för namn som väderbrickan
   i högra hörnet knuffar undan – `weatherBadgeSize`), områdesskylt, väderbricka, busstoning

`env` (delas med alla moduler): `t, dt, hour, day, eventId, night, dark, rain, weather,
forceWeather, player {x,y}, people [{x,y}], obstacles, district, view {x,y,w,h}, play`.

Gång: `env.obstacles = MAP_OBSTACLES + husens obstacles + props + traffic + fallback + bridge + life`. Cell 4 px.
Dörrar öppnas när någon står framför (`base−6 < y < base+30`). Klick på fasad/dörr →
gå till `doorCenter(b)` och `enter`. Klick på en hållplats → gå till `wait` och öppna
bussdialogen (skyltresan: 10 kr, 15 spelminuter, skärmen tonar, figuren står vid målets `wait`).
Områdesskylten visas när man kommer in i ett nytt område (`DISTRICTS[].name/tag`).

**Bussen på riktigt** (receptet i traffic.js filhuvud är inkopplat): klick på en buss som
står vid en hållplats → `busDoorHit` → `hold` → gå till framdörren → dialog med
`destinations` → betala 10 kr + 15 min → `board(från, till, { look })`. Under resan ritas
figuren i bussfönstret av trafiken, kameran följer `ride().pos`, toningen `ride().fade`
delar skärmrutan med skyltresans, och vid `phase 'framme'` hämtas figuren med `alight()`.
En resa som går ut över floden (brofästet inom 480 px när toningen annars skulle börja) tonar inte
förrän bussen kommit ut mitt på bron, mellan tornen (båda tornen och kablarnas båge i bild runt
bussen); sedan tonar den och hoppar fram till strax före målet som vanligt – spelklockan går medan
man åker, så resan får inte bli långsammare än nödvändigt (FINANSTORGET → BETONGTORGET ≈ 17 s).
Klick under resan → `skipRide()`. **Bänkarna**: klick på en ledig plats
(`props.seatAt`, ledig = `!life.seatBusy(id)`) → gå till `seat.walk` och sätt dig
(frame 5 på `seat.x/y`); nästa klick reser figuren och fortsätter som vanligt.
Spelarens fotpunkt på sitsen håller platsen (livets `seatFree` viker för spelare).

**Kameran** håller figuren 62 % ner i bilden (74 % av den synliga rutan i NÄRA-läget). På STORA
BRON (däcket, mjuk övergång 110 px vid brofästena) lyfts den så att tornens spetsbågar, krönen och
kablarnas båge kommer med – men figuren hålls minst 26 px ovanför den synliga rutans nederkant
(`bridgeLift`). Från norra trottoaren syns krönen (kamerans y ≈ 18), från södra spetsbågarna (y ≈ 102
i 384 × 216 mot 158 förut).
**Förmålning:** marken (`ground.prewarmGround(budget)` – samma steg som `paintGround`, några i taget)
och sedan flodbilden + dagens/nattens färdiga markbild målas när webbläsaren har tid över
(`requestIdleCallback`), så att första gången ut i staden inte fryser; går man ut innan gör
`paintGround` resten direkt.

`_debug`: `spot(id)`, `tile(a,b)`, `lockCam(x,y)`, `teleport(x,y)`, `panorama()`,
`busTo(namn)`, `busStop(namn)`, `district(namn)`, `districtNow()`, `weather(force)`,
`walkTo(x,y)`, `arrived()`, `pos()`, `enter(id)`, `buildings`, `env`, `sim()`, `cam()`, `markers()`,
`ride()` (resan just nu), `sitting()` (bänkplatsens id), `standUp()`.

## 6. Verktyg

- Förhandsvisning: `node tools/city-snap.mjs --pano --hour 12 --out tools/out/x.png`,
  `--district FÖRORTEN --hour 21`, `--weather snö --snow 0.9 --season vinter`,
  `--cam x,y --teleport x,y --rain --scale 3`. Servern: `python -m http.server 8788 --bind 127.0.0.1`.
  Panoramat är 4000 × 820 – beskär det (PIL) innan du tittar.
- Röktest: `node tools/smoke.mjs > tools/out/<namn>.log 2>&1` – kör `validateMap`,
  går runt pizzerian till söderdörren, åker buss till förorten, kollar att spelare ser varandra.
- Staden på längden (v3): `node tools/bro-test.mjs` (port `SMOKE_PORT`/`PORT`, standard 8788) – floden går
  inte att gå i, båda broarna går att gå över, linje 4 FINANSTORGET ⇄ BETONGTORGET (ut på Stora bron),
  downtowns fem butiker (skylt, konst, dörren leder in i scenen), förortens hem (husvagnen, höghuset,
  Lilla rummet), kostymfolket, dörrarna till Pixelhögskolan, bion, kebaben och pantbanken, de utbildade
  jobben (examen krävs), kameran på bron och ytorna bakom tornen. Bilder i `tools/out/bro-test/`.
- Kör **alla** `tools/*-test.mjs` (+ `smoke.mjs`) före släpp, inte bara de som rör det man ändrat.

## 7. Vem ritar vad

| Fil | Ägare | Innehåll |
|---|---|---|
| `map.js`, `city.js`, `walk.js`, `places.js`, `fallback-v2.js`, `docs/STADEN.md` | arkitekten | kontraktet, scenen, platshållarna |
| `bridge.js` (v3) | bro-byggaren | floden, kajerna, Stora bron, Järnbron, båtarna, isen – se avsnitt 8 |
| `buildings-downtown.js` (v3) | downtown-byggaren | finanskvarterets nio hus – se avsnitt 8 |
| `buildings-shops.js`, `buildings-work.js` | (klara, v1) | norra raden |
| `buildings-south.js` | söder-specialisten | radhus, pizzeria, posten, djuraffär, bio, kyrka, vårdcentral, Tornhuset, macken + parkens småhus |
| `buildings-suburb.js` | förorts-specialisten | höghusen, närbutik, pantbank, kebab, övergivet hus, bilverkstad, tvätteri, garage, lagerhall, lamellhus, husvagn |
| `facade-kit.js` | delad startpunkt | får ändras av husspecialisterna (samordna) |
| `ground.js` | mark-specialisten | hela världens mark → `export const V2 = true` |
| `props.js` | rekvisita-specialisten | rekvisita i hela världen → `V2` |
| `traffic.js` | trafik-specialisten | alla ROADS, bussar vid BUS_STOPS → `V2` |
| `life.js` | liv-specialisten | folk i hela världen |
| `weather.js` | väder-specialisten | rikare väder, årstider |
| `game.js`, `main.js` | huvudagenten | JOBS/HOMES/ENGINES från places.js |

Nya jobb som staden pekar på (`places.js`): pizzeria, posten, vard, bensinmack,
bilverkstad, tvatteri. Nya bostäder: husvagn, hoghus, radhus, takvaning.
Vårdcentralen (`vard`) är den enda som ännu saknar jobbscen i main.js – dörren visar
"anställer snart" tills huvudagenten kopplar in den i `JOBS` + `ENGINES`.

## 8. STADEN PÅ LÄNGDEN (v3, Carl 2026-09-29)

> *"en stor bro över som Brooklyn Bridge och att det efter den kommer förorten så att den
> inte sitter ihop med centrum"* + *"en elektronikbutik … lägg den i downtown.. höga hus
> finanskvarter med kostymklädda folk"* + frisör, skobutik, accessoarbutik och banken.

Staden läses nu från väster till öster: centrum/parken/söder → Infarten → **DOWNTOWN** →
**FLODEN** med **STORA BRON** → **FÖRORTEN**. Allt nedan är låst i
[`map.js`](../js/city/map.js) och kontrolleras av `validateMap()` (röktestet kör den).

### 8.1 Layouten i siffror

| x | Område | Innehåll |
|---|---|---|
| 0–1700 | CENTRUM / PARKEN / SÖDER | orört |
| 1700–1752 | INFARTEN | orörd (östra trottoaren 1752–1766 hör nu till downtown) |
| 1752–2400 | **DOWNTOWN** (`CITY.X_DT` = 1752) | 9 hus i två rader, Bankgatan, Finanstorget, bakgata, hållplats FINANSTORGET |
| 2400–3032 | **FLODEN** (`CITY.RIVER` = [2400, 3032]) | västra kajen 2400–2420, räcke 2420–2424, vatten 2424–3008, räcke 3008–3012, östra kajen 3012–3032 |
| 3032–4000 | **FÖRORTEN** (`CITY.X_SUB` = 3032) | hela v2-förorten oförändrad, `SUB_DX` = 1280 px österut |

`CITY.W` = **4000** (max – `net/world.js` klämmer spelarnas x till 0–4000; `validateMap` varnar
om världen blir bredare). Stadsdelar (`DISTRICTS`, gränsen i x = 1726 mitt i Infarten):
`downtown` DOWNTOWN – *HÖGA HUS, BANKER OCH KOSTYMER* [1726–2400], `bron` STORA BRON –
*HÄNGBRON ÖVER PIXELFLODEN* [2400–3032 × y 0–476], `jarnbron` JÄRNBRON – *SÖDERGATAN ÖVER
PIXELFLODEN* [2400–3032 × y 476–820], `fororten` [3032–4000]. (Okända distrikt-id faller
tillbaka på centrums musik i `core/music.js` – egen låt/ambiens för downtown och floden kan
läggas där av ljudansvarig.)

**Floden och broarna** (`RIVER`, `BRIDGES` – allt i världskoordinater, rektanglar `[x0, y0, x1, y1]`):

| Del | Rektangel | Gå? |
|---|---|---|
| västra kajen `RIVER.quayW` | [2400, 8, 2420, 774] | ja (sten, N–S längs vattnet) |
| östra kajen `RIVER.quayE` | [3012, 8, 3032, 774] | ja (i `PATHS` delade vid Pixelgatan och Södergatan – körbanorna är väg) |
| kajräcken `RIVER.rails` | x 2420–2424 och 3008–3012, y 0–181, 311–635, 765–820 | hinder |
| vatten `RIVER.water` | [2424, 0, 3008, 181], [2424, 311, 3008, 635], [2424, 765, 3008, 820] | hinder (mynnar i kanalen) |
| **Stora bron** däck `walk` | [2424, 186, 3008, 306] = Pixelgatans trottoarer + körbana | ja |
| Stora bron räcken `rails` | [2424, 181, 3008, 186], [2424, 306, 3008, 311] | hinder |
| Stora bron torn 1 / 2 | x 2556–2604 / 2828–2876 | – |
| tornens ben `legs` (i vattnet) | y 163–181 (norr) och 311–329 (söder) | hinder |
| mittpelaren `pier` (mellan körfälten, mellan de två valven) | y 246–250 | hinder |
| **Järnbron** däck `walk` | [2424, 640, 3008, 760] = Södergatans trottoarer + körbana | ja |
| Järnbron räcken `rails` | [2424, 635, 3008, 640], [2424, 760, 3008, 765] | hinder |

Vatten + räcken + däck täcker vattenbredden exakt en gång i varje y (validateMap kollar).
Pixelgatan, Södergatan, bussen och trafiken kör rakt över broarna (vägarna är hela världens
bredd). Bakgatan (y 8–36), parkgången (462–490) och kanalkajen (760–776) tar slut vid kajerna.
`RESERVED` innehåller hela flodrummet [2400, 0, 3032, 820] – props.js ställer inget där.

**Downtowns hus** (`BUILDINGS_D`; norra raden base 186/top 40, södra raden base 640/top 494):

| id (= kind) | rad | x–x+w | h | dörr (x0–x1, typ) | skylt | ikon | öppet | enter → scen |
|---|---|---|---|---|---|---|---|---|
| `kontor1` | n | 1768–1896 | 170 | 1816–1848 revolve | FINANSHUSET | 📈 | 7–19 | `jobb:finans` (examen i Ekonomi) |
| `bank` | n | 1920–2080 | 136 | 1984–2016 swing | PIXELBANKEN | 🏦 | 9–17 | `bank` |
| `elektronik` | n | 2128–2280 | 124 | 2188–2220 slide | ELEKTRONIK | 📱 | 10–20 | `elektronik` |
| `kontor2` | n | 2304–2384 | 174 | 2328–2356 revolve | BÖRSHUSET | 📊 | 8–18 | – (soon) |
| `kontor3` | s | 1768–1888 | 200 | 1812–1844 revolve | PIXELHÖGSKOLAN (i Pixel Tower) | 🎓 | 8–20 | `universitet` |
| `skor` | s | 1912–2008 | 100 | 1948–1972 swing | SKOBUTIKEN | 👟 | 10–19 | `skor` |
| `frisor` | s | 2008–2080 | 92 | 2032–2056 swing | FRISÖR | 💈 | 9–18 | `frisor` |
| `accessoarer` | s | 2128–2224 | 96 | 2164–2188 swing | ACCESSOARER | 👜 | 10–19 | `accessoarer` |
| `kontor4` | s | 2248–2384 | 216 | 2300–2332 revolve | GLASTORNET | 🖥️ | 7–19 | `jobb:datorbygge` (Pixel Data, examen i Datorteknik) |

Butikerna, högskolan och jobben har egna scener (se *enter i scenen* i avsnitt 2); `soon`-texten visas
bara om scenen inte gick att ladda. BÖRSHUSET är det enda med bara soon-text. (Tornets egen konst,
`buildings-downtown.js`, skriver fortfarande PIXEL TOWER både i LED-kronan och i sockeln – husnamnet
överst i bild säger PIXELHÖGSKOLAN.) Utanför downtown leder nu även BIO PIXEL (`bio`), KEBAB GRILL
(`kebab`) och PANTBANKEN (`pantbank`) in i egna scener. Luckor (`STREETS_D`):
norra raden 1752–1768, 1896–1920, 2280–2304, 2384–2400 (gränder), **BANKGATAN** 2080–2128
(tvärgata); södra raden 1752–1768, 1888–1912, 2224–2248, 2384–2400 (gränder), **BANKGATAN**
2080–2128 (gågata). Zebror med trafikljus över Pixelgatan (`i` 10) och Södergatan (`i` 11)
vid Bankgatan. **FINANSTORGET** (`DOWNTOWN_LAYOUT.plaza`) = [1766, 306, 2400, 462], axeln x 2104,
statyn (TJUREN) på (2104, 392), fontänerna på (1936, 396) och (2272, 396), bakgatan
`DOWNTOWN_LAYOUT.back` = [1766, 462, 2400, 490]. **Bakom tornen** (`DOWNTOWN_LAYOUT.behind`, hinder i
`MAP_OBSTACLES` och `RESERVED`): PIXEL TOWERs glaspyramid (spets y 428 mitt på tornet) och GLASTORNETs
krön (y ≈ 422) reser sig över torgets södra kant och bakgatan – där skulle en figur inte synas. Ytan
bakom GLASTORNET är [2248, 428, 2384, 494], bakom PIXEL TOWER trappas den efter pyramiden i 4-px-rader
(fötterna hamnar aldrig mer än ~6 px bakom glaset) och är hel från y 474. Man går fram till tornet,
aldrig in bakom det; gränderna 1752–1768 och 2384–2400 och resten av bakgatan är öppna. Hållplatsen **FINANSTORGET** (`BUS_STOPS[4]`)
står på x 2232 på Pixelgatans södra trottoar (vänteplats 2262, 300).

**Förorten** ligger på v2-koordinater + `SUB_DX`: höghuset 3048, närbutiken 3244, husvagnen
3926 (dörr 3936–3948), Betongtorget 3290, Betonggatan 3516–3568, tomterna (parkering 3048–3280,
lekplats 3310–3450, grusplan 3710–3984, tomten 3912–3992, återvinning 3568–3660, vagnsplatsen
3908–3992). I koden skrivs förortens fasta platser som `v2-x + SDX` (map.js: `SX`, ground/props/
life: `SDX = CITY.SUB_DX`) så att de går att följa tillbaka. Spelare hittar hem via husens
`homes` (dörren räknas ur kartan), inga sparfält ändrades.

### 8.2 Kontraktet för byggarna

**Grundreglerna överst i den här filen gäller**: ett pixelkorn, 3/4-vy uppifrån (aldrig sidovy), hög
detaljtäthet som grannhusen, text bara med `floor-pix.js`-typsnitten, inga halvgenomskinliga
ljusrutor över text, svenska kommentarer. Kör `validateMap()` om något i map.js ändras.

#### Bro-byggaren – [`js/city/bridge.js`](../js/city/bridge.js)

Äger **hela flodrummet** x 2400–3032, y 0–820: vattnet, kajerna (hällar, trappor ner mot
vattnet, pollare, förtöjningsringar, livbojar, lyktor), kajräckena, båda broarna och båtarna.
Exporter som scenen redan anropar (city.js är kopplad):

```
paintRiver(night) → canvas 632 × 820 | null   läggs ovanpå marken vid (2400, 0), cachas per dag/natt.
                                               Genomskinliga pixlar = ground.js syns (platshållaren:
                                               kajer, vatten, räcken, gatorna som fortsätter över broarna).
                                               Måla gärna däcken själv (plankor på gångbanorna,
                                               expansionsfogar, stenfästen) – men håll Pixelgatans/
                                               Södergatans körfält, mittlinje och kantlinjer på samma
                                               rader som ground.js paintRoadX (mittlinjen y 246–247 /
                                               700–701) så att vägen inte hoppar vid brofästet.
riverLive(ctx, env, view)                      varje bildruta efter ground.groundLive, FÖRE vädret:
                                               strömvirvlar, glitter, lyktornas speglingar på natten.
createBridge(env) → { items(), obstacles, update(dt), glow(ctx, view) }
```

- **Lager (y-nycklar i items):** allt norr om däcket (norra bärkabeln, norra hängstagen,
  norra räcket, tornens norra ben) ≤ 181 – ritas bakom folk och bilar på bron. Allt söder
  om däcket (tornens sydfasad, södra kabeln och hängstagen, södra räcket, lyktorna) ≥ 311 –
  ritas framför. Mittpelaren y 250. Järnbrons fackverk: norra ≤ 635, södra ≥ 760. Föremål som
  spänner över många px får **inget `x`** (scenen sållar bort föremål vars x ligger mer än
  140 px utanför bild); scenen sållar på y (y-nyckeln inom [kamera-y − 6, kamera-y + höjd + 130]).
- **Tornen:** två stentorn med gotiska spetsbågar à la Brooklyn Bridge, 48 px breda, toppen
  får inte gå över världs-y 0 (kameran visar aldrig y < 0; toppen runt y 20–30 fungerar).
  Från söder ser vi tornets smala sida – visa spetsbågarna där. Det är tillåtet (och
  rekommenderat) att göra valvet där däcket går igenom till ett *genomskärningsfönster*
  (genomskinliga pixlar i tornets främre lager) så att folk och bilar syns i valvet i stället
  för att försvinna bakom tornet – platshållaren gör så.
- **Kablarna:** bärkablarna hänger i båge mellan tornen och ner mot fästena vid kajerna
  (norra kabeln bakom, södra framför), lodräta hängstag och solfjäderformade stag från
  tornen. Kabelljus och lyktor lyser i `glow` (efter mörkret).
- **Gångbanan:** gångbanorna ÄR Pixelgatans trottoarer på däcket (y 186–218 och 276–306, samma
  gånglinjer som i stan) – gör dem upphöjda (kantsten, plankdäck) med räcke mot vattnet.
- **Båtar** (bogserbåt, pråm, turistbåt, segelbåt): i vattenytorna, försvinner under däcken
  (klipp mot `RIVER.water`). Inga båtar när isen ligger: `weather.js` lägger blankis över
  `RIVER.water` när kanalen fryser (vinter och temp ≤ 0, eller snowCover > 0.25).
- **Hinder:** vatten, räcken, tornben och mittpelare är redan hinder i `MAP_OBSTACLES`.
  Lägg bara till egna (lyktstolpar på kajerna, pollare) i `obstacles`. Flyttar du tornen:
  ändra `BRIDGES` i map.js (samma form) och kör `validateMap()`.
- Förhandsvisning: `node tools/city-snap.mjs --cam 2400,90 --hour 12`, `--cam 2530,160 --hour 21`,
  `--cam 2400,560 --hour 12` (Järnbron), `--weather snö --snow 0.9 --season vinter`,
  `--district bron`, `--pano` (beskär x 2380–3060).

#### Downtown-byggaren (husen) – [`js/city/buildings-downtown.js`](../js/city/buildings-downtown.js)

`BUILDING_ART` för de nio husen i tabellen ovan. Kontraktet i
avsnitt 4 gäller (`paint/live/glow`, valfritt `front/items/obstacles`). Behåll `id`/`kind`,
`door` och `artBox`. Finanskvarteret är **nytt, rent och högt**: glas och stål, kalksten,
mässing, flaggor, karuselldörrar (`revolve` – rita den roterande dörren i `live` med `st.t`
och `st.doorOpen`), portier, skyltfönster (elektronik: telefoner, surfplattor, datorer och
tv-skärmar som lyser; skor: skohyllor; frisör: barberarstolpe, stolar, speglar; accessoarer:
väskor, smycken, klockor, solglasögon), banken med kolonner, trappa och bronsdörrar.
Höjder: norra raden högst ~176 (bilden börjar på y 0), södra raden syns över torget.

#### Downtown-marken, rekvisitan och livet

- **Marken** – [`ground.js`](../js/city/ground.js) `paintDowntownBand()`: Finanstorget (granithällar,
  kompassros kring statyn, stenringar under fontänerna) och bakgatan. Trottoarer, Bankgatan,
  gränderna och zebrorna målas redan av de vanliga målarna (slitage 0 i downtown, `wornAt`).
- **Rekvisitan** – [`props.js`](../js/city/props.js): ett eget avsnitt *downtown* – statyn TJUREN på
  `DOWNTOWN_LAYOUT.statue`, fontänerna på `.fountains` (hinder + sittkant), träd i
  planteringslådor, bänkar (sittbara via `frontSeats`), flaggstänger, lyktor, papperskorgar,
  cykelställ, en kaffevagn, en tidningskiosk, pollare vid Bankgatan, och en egen affisch till
  kuren vid FINANSTORGET (`BUS_STOPS[4]`, nu `paintPosterGlass`). Torget (`kind: 'torg'`) är
  inte reserverat – dörrarnas framsidor, övergångsställen, trafikljus och kuren är det.
- **Livet** – [`life.js`](../js/city/life.js): folk i kavaj (grund finns: `dress(…, { suit })` för
  x i downtown), noder över torget (ring kring statyn, länkar till trottoaren y 291 och
  bakgatan y 476), nya mål i `PLACES`/`WINDOW_SHOPS` (bank, elektronik, frisor, skor,
  accessoarer, kontor1–4 – kontorsfolk in/ut morgon och kväll), duvor på torget, måsar på
  broräckena och kajerna.

#### Integratören – [`js/scenes/city.js`](../js/scenes/city.js)

**Redan kopplat** (arkitekten, v3): `MODS` laddar `buildings-downtown` och `bridge`; `ART()`
tar med downtowns `BUILDING_ART`; `groundImg` lägger `bridge.paintRiver(night)` på marken vid
`RIVER.x0`; `drawWorld` kör `bridge.riverLive` efter `ground.groundLive` (före vädret),
`bridge.items()` i den y-sorterade listan, `bridge.glow` efter mörkret och `bridge.update` i
`update`; `bridge.obstacles` ingår i `env.obstacles` (både i `sim()` och `makeCity`, före
`createLife` så att livets gångnät ser dem). Kvar för integratören:

1. ~~Koppla in downtowns butiker~~ – klart: bank, elektronik, frisor, skor, accessoarer (+ universitet,
   bio, kebab, pantbank) har `enter` i map.js, står i `ENTER_RE`, går via city.js `SCENE_DOORS` och laddas
   tåligt av main.js `DOOR_SCENES`. De utbildade jobben: FINANSHUSET → `jobb:finans`, GLASTORNET →
   `jobb:datorbygge` (Pixel Data); utan examen säger dörren vad som krävs (`JOBS[id].kraver` via `canWork`).
2. ~~Byt ut platshållarna~~ – klart: `bridge.js` och `buildings-downtown.js` är riktiga (`bridge.js` `PLACEHOLDER = false`).
   Alla `tools/*-test.mjs` + smoke i en ren kopia (leksaker- och terminal-testet ställer figuren vid dörren:
   Lilla rummet ligger på andra sidan floden sedan v3).
3. Ljud (valfritt, core/ägs av andra): `ambience.js`/`music.js` känner distrikten `downtown`,
   `bron`, `jarnbron` först när någon lägger till dem (vatten som kluckar, mistlur, stadsbrus).
   OBS: `core/ambience.js` (~rad 1534) har förortens lekplats hårdkodad som [2030, 334, 2170, 452]
   – den ligger nu på `LOTS` `lekplats_x` = [3310, 334, 3450, 452] (byt till kartans rect).
4. Trafiken är lika tät som förut (`traffic.js` skalar antalet fordon med `CITY.W / 2720`).
   Marken tar ~0,9 s att måla på en stationär dator (~4,4 s med 4× CPU-strypning, som en telefon) –
   den målas nu i förväg i bitar (`prewarmGround`, största biten är parken ≈ 0,3 s / 1 s strypt).
   Prova på en riktig telefon.
5. Speltempot: husvagnen och Lilla rummet ligger 1280 px längre från centrum än i v2 (husvagnen →
   Burgarbaren ≈ 2800 px ≈ 25 s ≈ 50 spelminuter). Beslut för Carl: billigare/gratis första bussresa,
   tätare linje 4 från förorten – eller acceptera promenaden (inga sparfält berörs).

### 8.3 Checklista när något flyttas i v3

- Nya hus/tomter i downtown: håll x i [1752, 2400], inga fotavtryck i flodrummet, uppdatera
  tabellen ovan. Nya hållplatser och övergångsställen läggs **sist** i sina listor.
- Förortens fasta platser i ground/props/life skrivs `v2-x + SDX` – flytta aldrig förorten
  igen utan att ändra `SUB_DX` (då följer allt med).
- `CITY.W` ≤ 4000 så länge `net/world.js` klämmer x till 4000.
