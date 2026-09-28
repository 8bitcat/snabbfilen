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
6. **Fotbollsbutiken** – se `docs/FOTBOLLSBUTIKEN.md`.

## Äldre förslag
- Djuren ute i staden (följare i koppel; `createPetFollower` finns i `js/pets/layer.js`).
- Slutlig buggjakt (flimmer, z-ordning, överlapp) och detaljparitet i alla scener.
- Stadens extra ställen (`js/city/places.js` SHOPS_EXTRA): vårdcentralen som jobb, bio,
  pantbank, kebab, kiosk med lotter, närbutik med egen scen.
- Småsaker som får stå på bord (flagga i KATALOG), förrådspanelen som täcker
  canvasens högerkant i Möblera-läget, väggsaker över fönster.
