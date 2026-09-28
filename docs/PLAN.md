# Snabbfilen – hela planen och var vi ligger (uppdaterad 2026-09-28 eftermiddag)

Varje del blir ett eget släpp så fort den är klar och provkörd (`tools/release.mjs` →
`tools/verify.mjs` → push). Versionsnumren är riktmärken: det som blir klart först släpps
först. Två agenter får aldrig skriva i samma fil samtidigt, så vissa delar väntar på att
en fil blir ledig.

**Live nu: v0.24.0.** Allt som är byggt men inte släppt ligger i arbetskopian och säkras på
grenen `wip`.

## Vem gör vad

- **Agenterna** (multi-agent-körningar: byggare → oberoende granskare → rättare) bygger
  de stora delarna. Varje körning äger sina egna filer.
- **Claude (huvudsessionen)** kopplar in det agenterna byggt (scener i `js/main.js`,
  dörrar i staden, jobb i `js/game.js`), provkör, släpper, rättar det Carl hittar och
  startar nästa agentkörning när filerna blir lediga.
- **Carl** spelar, hittar fel och kommer med nya idéer. Nya idéer skrivs in här och i minnet.

## Släppt i dag

0.16–0.19 versioner, automatisk uppdatering utan dataförlust, säkerhetskopior · multiplayer-
fixar (spöken, dubbletter, hjärtslag), kick efter 5 min · 0.20 huvudmenyn med staden bakom,
pausmenyn ☰, pixelmätarna ovanför spelbilden · bostadsbyrån man går runt i · hundfix ·
0.21 chatt · 0.22 pratbubblor och emoji, menytavla vid Burgarbaren · 0.23 veckosammanfattningen
· 0.23.1 aldrig in i spelet utan namn · 0.23.2 möblera med fingret · 0.23.3 repliker som
pratbubblor i butikerna · 0.23.4 flera figurer får heta samma (unika id), högre gatuskyltar ·
**0.24.0 veckan först med sju fönster mot staden**.

## Pågår nu (agenterna kör)

| Släpp | Innehåll | Agentkörning | Läge |
|---|---|---|---|
| 0.25 | **Storstaden**: södra stadsdelen, infarten, förorten med graffiti och trasig busshållplats, bussen på riktigt (gå in, betala, "vill du åka till …?"), sitta på bänkar och i busskurer, väder. Plus de **sex nya jobben** (pizzeria, posten, macken, bilverkstan, tvätteriet, barista), kaféet "fika eller jobba", **Lilla rummet i förorten**, **närbutik 24/7** | storstaden-fortsatt | Karta, stad, södra husen klara; förortens hus, mark, rekvisita, trafik, stadsliv och väder byggs |
| 0.26 | **Husdjur hemma** (skål, säck, kattlåda, bajs, korg, bur) + **djuraffären öppnar** + **fyra nya bostäder** (husvagnen, förortsettan, radhuset, takvåningen) | integration-djur-bostader | Hälften byggd |
| 0.27 | **Bilverkstan: däckbyte steg för steg** (hissa, skruvdragare, skruvar, däck av, nytt däck, luft, sänk) | bilverkstan-dackbyte | Byggs |
| 0.28 | **Burgarbaren**: ny fasad (menyn nere på trottoaren där SOL-skylten står, fönster där uppe med folk som äter, kockar och brickor som rör sig), **gå in som på kaféet** (disken, brickan, sätta sig, äta upp, energi bara vid bordet) + **kökjobbet** (bygga rätterna) | burgarbaren-inne | Byggs |
| 0.29 | **Flygterminalen**: stora glasfönster med plan som landar, tankbilar, folk, väntstolar, incheckningsdiskar, bagageband. **Jobba i incheckningen** (nytt) eller vid bandet. Öppet dygnet runt, nattpass | flygterminalen | Byggs |
| 0.30 | **Ljudet**: simspråk-babbel när man klickar på folk, hundar som skäller, katter som jamar och spinner, butiksambiens i alla affärer, egen musik per stadsdel (inte plinkplonk), regn, snö, vindpustar, trafik, parken, myllret | ljud-och-roster | Byggs |
| 0.31 | **Klädkatalogen**: ~250 nya plagg, ~200 stylingval (frisyrer, ögon, smink, skägg), klädaffären i flera våningar | garderob-450-fortsatt | Byggs |

## Väntar på att filer blir lediga (startas direkt när körningen före är klar)

| Släpp | Innehåll | Startar efter |
|---|---|---|
| 0.32 | **Fotbollsbutiken**: Kungsladugård-avdelningen med alla 19 spelare (bara förnamn och nummer) på egna mannekänger, pixel-lagfoto på väggen, kända lags tröjor, fotbollsskor | klädkatalogen (samma klädfiler) |
| 0.33 | **Sova i sängen** (lägga sig under täcket, zzz, ljuset dämpas) + **eget badrum i varje bostad** (toan aldrig mitt i rummet) | husdjuren och bostäderna (`room.js`) |
| 0.34 | **Banken** i stan (sätta in pengar, sparkonto) | storstaden (kartan) |
| 0.35 | **Djuren ute i staden** i koppel (hunden bajsar ute) | storstaden + husdjuren |
| 0.36 | **Downtown** med kontor, **universitetet** (utbildning), **datorbutiken** (bygga datorer som jobb) och **finansjobb** (räkna) – jobben kräver utbildning | storstaden + banken |
| 0.37 | Stadens småställen: bio, kebab, kiosk med lotter, pantbank, vårdcentralen som jobb | storstaden |
| 0.38 | **Staden på längden**: förorten 3–5 skärmbredder bort över en **stor bro**, förbi bilverkstaden (stökigare och skitigare), bussen tar en direkt. Bortom förorten: **landet** med gårdar och bondgårdar att bo på | storstaden |
| 1.0 | **Buggjakt och finputs** i alla scener (flimmer, z-ordning, överlapp, detaljnivå) | allt ovan |

## Vad jag behöver från Carl
- Originalbilderna till fotbollsbutiken i `docs/ref/fotboll/` (lagfotot och matchstället) och den tjugonde spelaren om listan var avkapad.
- Vilka "kända lag" som ska finnas i fotbollsbutiken (förslag: allsvenska lag, de största europeiska klubbarna och landslagen).
