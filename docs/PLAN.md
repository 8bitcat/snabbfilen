# Snabbfilen – hela planen och var vi ligger (uppdaterad 2026-09-28 eftermiddag)

Varje del blir ett eget släpp så fort den är klar och provkörd (`tools/release.mjs` →
`tools/verify.mjs` → push). Versionsnumren är riktmärken: det som blir klart först släpps
först. Två agenter får aldrig skriva i samma fil samtidigt, så vissa delar väntar på att
en fil blir ledig.

**Live nu: v0.25.0.** Allt som är byggt men inte släppt ligger i arbetskopian och säkras på
grenen `wip`.

**Arbetsordning (Carl 2026-09-28 em):** huvudsessionen bygger som standard; agentkörningar
startas EN i taget (inte parallellt) när kontogränsen tillåter, och pixelgrafiken körs
alltid på huvudmodellen – kvaliteten får aldrig sjunka. Alla åtta körningarna stoppades
av kontogränsen i dag; de återupptas en och en efter återställningen (18:00/20:40).

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
0.24.0 veckan först med sju fönster mot staden · **0.25.0 hela skärmen fylls på varje
enhet** (samma pixelkorn – vyn växer: staden ser mer värld, fasta scener får pixelram,
mätarremsan över hela bredden, vänd-på-mobilen-skylt, säkra kanter runt notchen) ·
**0.25.1 zoomvalet** (inne i rum/butiker/jobb fylls hela skärmen som standard – jämn
förstoring med beskärning mest upptill; 🔍-knappen växlar till hela bilden med ram;
scener kan ange contentBox så t.ex. Lilla rummets mörka yta bortom väggen aldrig visas) ·
**0.25.2 mataffären och kaféet breda** (ser MER butik på hela skärmen, som staden) ·
**0.25.3 närmare på mobilen** (tre zoomlägen via 🔍: NÄRA = datorns bild med stora
pixlar, standard på mobil · VID = ser mer värld, standard på dator · RAM = pixelram) ·
**0.25.4 Möbeljätten bred** (entréhallen, Småland och kassorna på samma skärm; nya
mekanismen viewMax gör att en scen kan bli bred med enbart sin egen fil) ·
0.25.5 paddorna får VID-läget + knip-zoom-skydd · 0.25.6 disken i Burgarbaren lagad
(ingen stapling, köket fyller alla sex, reserverad plats, FULLT-besked) ·
**0.26.0 JOBBA TILLSAMMANS i Burgarbaren** (delat skift: kollegan syns, samma kunder
och disk, servitören får poängen; jobbkanal i world.js + js/net/coop.js) ·
**0.26.1 bjud in att jobba ihop** (💼-knapp i 👥-dialogen, inbjudan når kompisen var
hen än är, "Häng med!" går rakt in på passet) · 0.26.2 osynk-fixen (aktiv ledare har
företräde, pass-slut lämnar över direkt, tysta ledare avsätts) · **0.27.0 jobba ihop
på riktigt** (välj kompis i startdialogen, DELAD LÖN, extraborden 4→10, kundrusch) ·
**0.28.0 DEN STORA STADEN** (hela v2-världen: Söder med Södergatan och kanalen,
Förorten med graffiti och trasiga hållplatsen, riktig buss, väder och årstider,
A*-gång, sex nya jobb – pizzerian, posten, macken, bilverkstan, tvätteriet,
baristan – djuraffären ÖPPNAD, Burgarbarens nya fasad; 33 filer, 125 kontroller).
Burgarbaren-inne-körningen (restaurangen + kökjobbet) kör nu; därefter släpps resten
av köerna i tur och ordning: bostäderna+husdjuren hemma, garderoben, däckbytet,
flygterminalen, ljudet, leksaksaffären.

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
| – | **Leksaksaffären**: gåbar butik med squishy-dumplings i bambukorgar (pastell, glitter, jul), squishy-mat (ost, smör, jordgubbe, iskuber, kattass), klämbordet (håll = ihoptryckt, släpp = fjädrar, pip och glitter), EGNA kawaii-figurer (inga Sanrio – spelet är publikt), plysch och andra leksaker, köpflöde, fasad med modelltåg | körning skriven (leksaksaffaren), återupptas efter gränsen |
| – | **Mobilen steg 2**: fasta scener (rummet, butikerna, jobben) görs "breda" så de själva fyller hela vyn i stället för pixelramen – scen för scen via WIDE-tabellen i main.js | huvudsessionen, när respektive scenfil är ledig |
| 1.0 | **Buggjakt och finputs** i alla scener (flimmer, z-ordning, överlapp, detaljnivå) | allt ovan |

## Vad jag behöver från Carl
- Originalbilderna till fotbollsbutiken i `docs/ref/fotboll/` (lagfotot och matchstället) och den tjugonde spelaren om listan var avkapad.
- Vilka "kända lag" som ska finnas i fotbollsbutiken (förslag: allsvenska lag, de största europeiska klubbarna och landslagen).
