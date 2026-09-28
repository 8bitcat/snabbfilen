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
- **Tålig laddning.** Varje modul laddas för sig av scenen; kraschar en så lever resten.
  Ritfel loggas en gång per källa och stoppar aldrig loopen. Kör `validateMap()` (röktestet
  gör det) när du flyttar något.

## 1. Världen

Världen är **2720 × 820**. Tvärsnitt i y (hela bredden):

| y | Vad | CITY-fält |
|---|---|---|
| 0–8 | häck/plank/mur mot kvarteret bakom | – |
| 8–36 | bakgatan bakom norra raden (gåbar) | `BACK` |
| 40–186 | **norra husraden** – fasaderna står på y = 186, taken sticker upp bakåt | `FOOT_TOP`, `BASE` |
| 186–218 | norra trottoaren (dörrarna öppnas mot den) | `SIDEWALK_N` |
| 218–276 | **PIXELGATAN** – övre körfältet västerut (y 244), undre österut (y 271) | `ROAD`, `LANES` |
| 276–306 | södra trottoaren (busshållplatser) | `SIDEWALK_S` |
| 306–462 | **parken** (centrum) / parkering, lekplats, lamellhus, grusplan (förorten) | `PARK` |
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
| 1752–2720 | **FÖRORTEN** – `X_SUB`; norra raden längs Pixelgatan, mellanband med parkering/lekplats/lamellhus/grusplan, södra raden längs Södergatan |

`ROWS.n` / `ROWS.s` ger base, top, back, sidewalk och road för respektive husrad.

## 2. Exporter i map.js

| Export | Innehåll |
|---|---|
| `CITY` | alla band ovan + `VIEW_W/H` |
| `ROWS` | husradernas geometri |
| `LANES`, `LANES_S`, `LANES_I` | körfält (`{ dir, y }` för vågräta vägar, `{ dir, x }` för Infarten) |
| `BUILDINGS` | norra raden i centrum (v1, oförändrad) |
| `BUILDINGS_S` | södra raden (SÖDER), `row: 's'`, `face: 'south'` |
| `BUILDINGS_X` | förortens hus (`row: 'n'` längs Pixelgatan, `row: 's'` längs Södergatan) |
| `FREESTANDING` | fristående hus man går runt (`row: 'f'`, djup `d`): kiosk, WC, glasskiosk, lekförråd, musikpaviljong, lamellhus, husvagn |
| `ALL_BUILDINGS`, `buildingById(id)` | alla hus |
| `LOTS` | tomter (kyrkogård, parkering, lekplats, grusplan, tomten, återvinning, vagnsplatsen) med `rect`, `fence`, `gates`, `drive` |
| `STREETS` (v1), `STREETS_S`, `STREETS_X`, `STREETS_ALL` | luckorna mellan husen: `kind` edge/alley/street/road/lot, `name`, `row`, `y0..y1`, `pedestrian` |
| `CROSSWALKS` (v1 + Infarten + Betonggatan), `CROSSWALKS_S`, `CROSSWALKS_I`, `CROSSWALKS_ALL` | övergångsställen; `i` är unikt över alla (`CROSSWALKS_ALL[i].i === i`), `road`, `stop` (stopplinjer per riktning), `lights`, `broken` |
| `LIGHTS` (Pixelgatan), `LIGHTS_S`, `LIGHTS_ALL` | trafikljusstolpar `{ crosswalk, road, side, x, y, broken? }` |
| `BUS_STOPS`, `BUS_STOP` (v1), `busStopById(idEllerNamn)` | hållplatser `{ id, name, district, x, y, road, lane, wait, broken? }` |
| `ROADS`, `roadById`, `JUNCTIONS` | vägarna med `axis`, `lanes`, `crosswalks`, `lights`, `stops`, `traffic` – **trafiken använder ROADS** |
| `PARK_LAYOUT` | plaza, promenade, paths (v1) + `walks`, `back`, `pond`, `playground`, `dogPark`/`dogGate`, `meadow` |
| `SUB_LAYOUT` | förortens gångar (asfalt) |
| `PATHS`, `PATH_RECTS` | alla gångar (`{ rect, kind: 'grus'|'asfalt'|'trottoar', district }`) |
| `WATER`, `CANAL_RECT` | dammen (skivor) och kanalen som gånghinder |
| `DISTRICTS`, `districtAt(x, y)`, `districtByName` | områdena `{ id, name, tag, rects, worn 0–1, spawn }` |
| `footprint(b)`, `doorFront(b)`, `doorCenter(b)`, `baseOf(b)` | geometri för alla hus |
| `MAP_OBSTACLES` | kartans egna hinder (fotavtryck + blocks + dammen + kanalen) |
| `gateRect(lot, gate)`, `RESERVED` | ytor där rekvisita inte får stå |
| `ART_OVER`, `ART_BELOW`, `artPos(b, img)`, `artPosS`, `artPosX`, `artBox(b)` | bildplacering |
| `inRect`, `isNightHour`, `validateMap()` | hjälpare |

### Husets fält

```
id, kind        kind väljer konsten i BUILDING_ART[kind] (samma som id)
x, w, h         fotavtryckets västra kant/bredd; h = fasadens höjd ovanför base
base, top       fasaden står på base; fotavtryck = [x, top, x+w, base−1]
foot, blocks    (valfritt) eget fotavtryck / fler hinder (pumpöar, häckar …)
yard            (valfritt) { kind: 'forecourt'|'garden', rect } gåbar gård framför ett indraget hus
frontY          (valfritt) y för husets främre lager (BUILDING_ART[kind].front) – mackens tak
door            { x0, x1, type: 'swing'|'slide'|'open'|'roll'|'boarded' }
row             'n' | 's' | 'f'      face: 'south' (alla)      district: 'CENTRUM' | 'PARKEN' | 'SÖDER' | 'FÖRORTEN'
sign, icon      skylt och ikon i meddelanden
enter           'hem' | 'bostad' | 'mat' | 'klader' | 'mobler' | 'kafe' | 'djur' | 'burgare' | 'frukt' | 'flyg'
                | 'jobb:<id>' | 'bostad:<homeId>' | null      (validateMap känner exakt den listan)
homes           (valfritt) vilka bostäder (HOMES-id) som ligger i huset
open            [från, till] i timmar          soon: egen text när man inte kan gå in
tower           (kyrkan) { x0, x1, h }
```

**enter i scenen:** `'hem'` och `'bostad:<id>'` går hem om `homes` innehåller spelarens
bostad, annars öppnas Bostadsbyrån (eller en toast om bostaden inte finns i `HOMES` än).
`'jobb:<id>'` startar jobbet om `JOBS[id]` finns i game.js – annars toasten *"… anställer
snart!"* med verb och lön från [`js/city/places.js`](../js/city/places.js). Huvudagenten
kopplar in `WORKPLACES` och `NEW_HOMES` därifrån i game.js (`JOBS`, `HOMES`, `ENGINES` i main.js).

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
(dörrar), `LOTS`, `DISTRICTS` (förortsfolk ser annorlunda ut). Tänk på storleken:
nav-rutnätet är 2720 × 820.

### Vädret – `weather.js`

```
createWeather(env) → { update(dt), drawBack(ctx, view), drawFront(ctx, view), glow(ctx, view) }
weatherAt(day, hour, eventId)          det rena vädret (för tester/andra moduler)
weatherLabel(w) → 'Sol, 18° · sommar'  drawWeatherBadge(ctx, x, y, w)  liten pixelskylt
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

1. `groundImg(night)` (ground.paintGround + ev. fallback) → `ground.groundLive`
2. `weather.drawBack` (snötäcke, våt glans) → `ground.groundOver` (fotspår skarpt ovanpå snön)
3. **y-sorterade föremål**: alla hus (`y = base`, + `items`/`front`), fallback, props, traffic, life, andra spelare, jag
4. `weather.drawFront` (regn, snöfall, dimma, blåst, molnljus)
5. mörker (`env.dark`) → `glow` för hus, fallback, props, traffic, life, weather
6. skärmlagret: kompis-pilar, områdesskylt, väderbricka, busstoning

`env` (delas med alla moduler): `t, dt, hour, day, eventId, night, dark, rain, weather,
forceWeather, player {x,y}, people [{x,y}], obstacles, district, view {x,y,w,h}, play`.

Gång: `env.obstacles = MAP_OBSTACLES + props + traffic + fallback + life`. Cell 4 px.
Dörrar öppnas när någon står framför (`base−6 < y < base+30`). Klick på fasad/dörr →
gå till `doorCenter(b)` och `enter`. Klick på en hållplats → gå till `wait` och öppna
bussdialogen (skyltresan: 10 kr, 15 spelminuter, skärmen tonar, figuren står vid målets `wait`).
Områdesskylten visas när man kommer in i ett nytt område (`DISTRICTS[].name/tag`).

**Bussen på riktigt** (receptet i traffic.js filhuvud är inkopplat): klick på en buss som
står vid en hållplats → `busDoorHit` → `hold` → gå till framdörren → dialog med
`destinations` → betala 10 kr + 15 min → `board(från, till, { look })`. Under resan ritas
figuren i bussfönstret av trafiken, kameran följer `ride().pos`, toningen `ride().fade`
delar skärmrutan med skyltresans, och vid `phase 'framme'` hämtas figuren med `alight()`.
Klick under resan → `skipRide()`. **Bänkarna**: klick på en ledig plats
(`props.seatAt`, ledig = `!life.seatBusy(id)`) → gå till `seat.walk` och sätt dig
(frame 5 på `seat.x/y`); nästa klick reser figuren och fortsätter som vanligt.
Spelarens fotpunkt på sitsen håller platsen (livets `seatFree` viker för spelare).

`_debug`: `spot(id)`, `tile(a,b)`, `lockCam(x,y)`, `teleport(x,y)`, `panorama()`,
`busTo(namn)`, `busStop(namn)`, `district(namn)`, `districtNow()`, `weather(force)`,
`walkTo(x,y)`, `arrived()`, `pos()`, `enter(id)`, `buildings`, `env`, `sim()`, `cam()`, `markers()`,
`ride()` (resan just nu), `sitting()` (bänkplatsens id), `standUp()`.

## 6. Verktyg

- Förhandsvisning: `node tools/city-snap.mjs --pano --hour 12 --out tools/out/x.png`,
  `--district FÖRORTEN --hour 21`, `--weather snö --snow 0.9 --season vinter`,
  `--cam x,y --teleport x,y --rain --scale 3`. Servern: `python -m http.server 8788 --bind 127.0.0.1`.
  Panoramat är 2720 × 820 – beskär det (PIL) innan du tittar.
- Röktest: `node tools/smoke.mjs > tools/out/<namn>.log 2>&1` – kör `validateMap`,
  går runt pizzerian till söderdörren, åker buss till förorten, kollar att spelare ser varandra.

## 7. Vem ritar vad

| Fil | Ägare | Innehåll |
|---|---|---|
| `map.js`, `city.js`, `walk.js`, `places.js`, `fallback-v2.js`, `docs/STADEN.md` | arkitekten | kontraktet, scenen, platshållarna |
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
