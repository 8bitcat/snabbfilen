# Snabbfilen – plan för resten (2026-09-28)

Varje rad blir ett eget släpp så fort den är klar och provkörd (`tools/release.mjs` →
`tools/verify.mjs` → push). Versionsnumren är riktmärken; ordningen styrs av vilka filer
som är lediga (två agenter får aldrig skriva i samma fil samtidigt) och av agentgränsen,
som hittills stoppat körningarna ungefär var tredje timme – därför högst 2–3 arbeten åt gången.

Live nu: **v0.22.0**. Allt som är byggt men inte släppt ligger i arbetskopian och säkras på
grenen `wip`.

## Fas A – nästan klart, agenterna fortsätter där de stoppades

| Version | Innehåll | Läge | Beror på |
|---|---|---|---|
| **0.23** | **Storstaden**: södra stadsdelen, infarten, förorten med graffiti och trasig busshållplats, buss mellan hållplatserna, väder. Plus de **sex nya jobben** (pizzeria, posten, macken, bilverkstan, tvätteriet, barista), kaféet "fika eller jobba", **Lilla rummet i förorten**, **närbutik 24/7** och **flygplatsen öppen dygnet runt** | Karta, stad, södra husen och menytavlan klara; förortens hus, mark, rekvisita, trafik, stadsliv och väder kör om; jobben är kopplade och dörrtestade | agenterna (resume) |
| **0.24** | **Husdjur hemma** (djuren i rummet, skål, säck, kattlåda, bajs, korg, bur) + **djuraffären öppnar** + **fyra nya bostäder** (husvagnen, förortsettan, radhuset, takvåningen) med planlösningar och annonser | Hälften byggd (djurlagret i rummet och planlösningarna finns) | 0.23 (djuraffärens dörr och husen ligger i nya stan) |
| **0.25** | **Bilverkstan: däckbyte steg för steg** (bilen kör in, hissas upp, skruvdragare, skruvarna, däcket av, nytt däck, skruva fast, fylla luft, sänka) | Arbetsorder klar, ej påbörjad | – |

## Fas B – hemmet och vardagen

| Version | Innehåll | Beror på |
|---|---|---|
| **0.26** | **Sova i sängen** (figuren lägger sig under täcket, zzz, ljuset dämpas) + **eget badrum i varje bostad** (toan aldrig mitt i rummet) | 0.24 (samma fil, `room.js`) |
| **0.27** | **Veckosammanfattning** mån–sön som visas först när man vaknar: hyresdagen tydligt markerad, avklarade dagar grå, checklista, hjälp att spara. + **Banken** i stan (sätta in pengar, sparmål) | 0.23 (bankens hus) |
| **0.28** | **Klädkatalogen**: ~250 nya plagg, ~200 stylingval (frisyrer, ögon, smink, skägg …), klädaffären i flera våningar med alla plagg | – |
| **0.29** | **Fotbollsbutiken**: Kungsladugård-avdelningen med alla 19 spelare (förnamn och nummer) på egna mannekänger, pixel-lagfoto på väggen, kända lags tröjor, fotbollsskor | 0.28 (samma klädfiler) |

## Fas C – nya platser och jobb

| Version | Innehåll | Beror på |
|---|---|---|
| **0.30** | **Burgarbaren som kaféet**: gå in, handla vid disken, bär brickan, klicka på ett bord, ät tills brickan är tom, energi bara vid bordet. + **Kökjobbet**: bygga alla rätterna som beställs | – |
| **0.31** | **Flygplatsen som terminal**: stora glasfönster med plan som landar, tankbilar och folk ute, väntstolar, incheckningsdiskar, bagageband. Jobba i **incheckningen** (nytt) eller vid **bandet** (finns) | 0.23 |
| **0.32** | **Djuren ute i staden** i koppel (hunden bajsar ute, toalettmätaren nollas) | 0.24 |
| **0.33** | **Downtown** med kontor, **universitetet** (utbildning), **datorbutiken** (bygga datorer som jobb, Pixelverkstans motor) och **finansjobb** (räkna) – jobben kräver utbildning | 0.23, 0.27 |
| **0.34** | Stadens småställen: bio (film på kvällen), kebab, kiosk med lotter, pantbank (sälj möbler), vårdcentralen som jobb | 0.23 |
| **0.35** | **Staden på längden**: förorten flyttas 3–5 skärmbredder bort, dit man går över en **stor bro** och förbi bilverkstaden (stökigare och skitigare på vägen). Bussen tar en direkt. Bortom förorten: **landet** med gårdar och bondgårdar att bo på | 0.23 |
| **0.36** | **Ljud och musik**: egen musik per stadsdel (fri musik med rätt licens i stället för plinkplonket), regn och snö som låter, vindpustar, stadens ambiens (trafiken, parken, folkmyllret) | 0.23 |
| **1.0** | **Buggjakt och finputs** i alla scener (flimmer, z-ordning, överlapp, detaljnivå) | allt ovan |

Följer med storstaden (0.23-etappen): **bussen på riktigt** (gå in när den stannar, betala, "vill du åka till …?") och **sitta på bänkar och i busskurer**. Alla NPC-repliker som fortfarande visas i rutor överst görs om till pratbubblor ovanför personen/djuret.

Redan släppt i dag utanför planen: 0.21 chatt, 0.22 pratbubblor och emoji, menytavla vid Burgarbaren, 0.23 veckosammanfattningen, 0.23.1 inget spel utan namn, 0.23.2 möblera med fingret.

## Vad jag behöver från Carl
- Originalbilderna till fotbollsbutiken i `docs/ref/fotboll/` (lagfotot och matchstället), och den tjugonde spelaren om listan var avkapad.
- Vilka "kända lag" som ska finnas i fotbollsbutiken (förslag: svenska allsvenska lag + de största europeiska klubbarna + landslagen).
