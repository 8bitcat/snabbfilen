# Snabbfilen – kvar att bygga

Carls förslag som inte är byggda än (uppdaterad 2026-09-28). Varje punkt blir ett
eget släpp med versionsnummer när den är klar (se `CHANGELOG.md`).

## Pågår (agenter) – släpps när det är klart
- **Storstaden v2**: södra stadsdelen under parken, infarten, förorten (graffiti,
  trasiga hus, fula butiker, trasig busshållplats), buss mellan hållplatserna, väder,
  menytavla vid Burgarbaren. Kartkontraktet: `docs/STADEN.md`.
- **Husdjur hemma** (djurlagret i rummet) och **fyra nya bostäder**: husvagnen,
  förortsettan, radhuset, takvåningen (`js/city/places.js`).
- **Sex nya jobb** (pizzeria, posten, macken, bilverkstan, tvätteriet, barista) är
  byggda och kopplade i arbetskopian – släpps ihop med storstaden (dörrarna sitter där).
- **Klädkatalogen**: ~250 nya plagg, ~200 stylingval, klädaffären i flera våningar.

## Nytt 2026-09-28
1. **Veckosammanfattning** måndag–söndag som ALLTID visas först när man vaknar:
   hyresdagen tydligt markerad (när pengarna dras), avklarade dagar grå så nästa dag
   syns, en checklista på vad man måste göra, och hjälp att spara ihop pengar.
2. **Bank** i staden där man kan sätta in sina pengar.
3. **Downtown**: en stadsdel med kontor, en **datorbutik** där man bygger datorer som
   jobb, och **finansjobb** där man räknar – jobben kräver utbildning.
4. **Universitet** där man utbildar sig (låser upp downtown-jobben).
5. **Burgarbaren uppstyrd som kaféet**: gå in vanligt, handla vid disken, hålla
   brickan, klicka på ett bord för att sätta sig, brickan försvinner först när man
   ätit upp, energin ökar bara när man sitter vid bordet. Vid disken kan man också
   jobba: servera (finns) eller **jobba i köket och bygga alla rätterna** som beställs.
6. **Fotbollsbutiken** – se `docs/FOTBOLLSBUTIKEN.md` (bara förnamn på tröjorna).
7. **Chatt**: skriv något (Enter eller 💬) → pratbubbla ovanför figuren som alla i
   närheten ser. (Byggd 2026-09-28, släpps med nästa version.)
8. **Sovanimation**: man lägger sig i sängen på riktigt (figuren ligger under täcket,
   zzz, ljuset dämpas) innan natten går.
9. **Eget badrum i varje bostad**: toaletten får aldrig stå mitt i rummet – varje
   bostad får ett badrum som eget delrum (även Lilla rummet: en pytteliten toalett).
10. **Burgarbaren**: luckorna ska bara vara nere när den är STÄNGD (inte på kvällen
    medan den är öppen till 23). Fel i `js/city/buildings-work.js` (natt ≠ stängt).
11. **Närbutik 24/7** (dygnetruntöppen 7-Eleven-liknande butik, i förorten som
    "NÄRBUTIK 24/7") och **flygplatsen stänger aldrig** – man ska kunna jobba sent.
    Öppettiderna är ändrade i `map.js`; `game.js canWork()` (7–20) måste släppa
    per jobb (flygplatsen dygnet runt).
12. **Flygplatsen som stor gåbar terminal**: gå in, stora glasfönster med flygplan
    som landar bakom, små tankbilar och folk som rör sig ute på plattan, stolar där
    folk sitter, incheckningsdiskar och bagageband. Gå fram till en disk för att
    jobba: incheckningen (nytt) eller väskbandet (finns).

## Äldre förslag
- Djuren ute i staden (följare i koppel; `createPetFollower` finns i `js/pets/layer.js`).
- Slutlig buggjakt (flimmer, z-ordning, överlapp) och detaljparitet i alla scener.
- Stadens extra ställen (`js/city/places.js` SHOPS_EXTRA): vårdcentralen som jobb, bio,
  pantbank, kebab, kiosk med lotter, närbutik med egen scen.
- Småsaker som får stå på bord (flagga i KATALOG), förrådspanelen som täcker
  canvasens högerkant i Möblera-läget, väggsaker över fönster.
