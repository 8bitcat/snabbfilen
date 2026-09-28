# Nyheter i Snabbfilen

Varje släpp får ett versionsnummer som syns uppe till höger i spelet – tryck
på det så ser du de senaste nyheterna. Varje version har en git-tagg
(`v0.14.0` osv.) så att man alltid kan gå tillbaka.

**Numreringen:** ny funktion → mittensiffran ökar (0.13.0 → 0.14.0), buggfix →
sista siffran ökar (0.14.0 → 0.14.1). Version 1.0.0 blir det när hela den stora
utbyggnaden (djur, alla jobb, storstaden, varuhuset i våningar) är på plats.

<!-- släpp: tools/release.mjs lägger nya versioner direkt under denna rad -->

## [0.18.3] – 2026-09-28 – Mätarremsa ovanför bilden, gå in på bostadsbyrån
- Pixelmätarna sitter nu som en egen remsa direkt ovanför spelbilden, i samma pixelstil, och täcker aldrig något i spelet – med porträtt, pengar, dag och klocka, mat, sömn och antal online.
- Bostadsbyrån går att gå in i: klicka på dörren i staden så kommer du in på mäklarkontoret med annonsplanscher, mäklare och väntrum.

## [0.18.2] – 2026-09-28 – Mätarna skymde ordersedeln på jobbet
- Pixelmätarna ritas inte under arbetspass – de skymde ordersedeln på fruktfabriken. Jobben har sin egen rad överst.
- Etiketterna MAT och SÖMN krockade med porträttramen; mätarna har fått lite mer luft.

## [0.18.1] – 2026-09-28 – Dialoger ovanpå menyn och namnruta vid Spara
- Dialoger som öppnas från menyn (redigeraren, bekräftelser, nyheterna) ligger nu ovanpå menyn, inte bakom den.
- Trycker du Spara i redigeraren utan att ha skrivit ett namn kommer en ruta upp och frågar efter namnet.

## [0.18.0] – 2026-09-28 – Stormarknaden, kaféet och bostadsbyrån
- Stormarknaden går man nu runt i: frukt och grönt, bröd, mejerikyl, frysar, hyllor med prislappar och kampanjer. Plocka varor i korgen och betala i kassan – maten hamnar i kylskåpet hemma. Vid disken kan du äta på plats.
- Kaféet är öppet: glasmonter med bakverk, espressomaskin, griffeltavla med meny. Köp en fika, sätt dig vid ett bord och ät – mättnad och energi går upp.
- Bostadsbyrån är ett riktigt mäklarkontor med annonsplanscher för alla bostäder, mäklare, väntrum och en sovande tax. Klicka på en annons för att flytta.
- Flygplatsens bagagehall och fruktfabrikens hall har fått samma detaljnivå som staden: fönster ut mot plattan, röntgen, tegelväggar, rör, pallar, truck och maskiner.

## [0.17.0] – 2026-09-28 – Huvudmeny, pixelmätare och musik
- Huvudmeny när spelet startar, med Pixelstaden levande i bakgrunden: Nytt spel, Fortsätt och Inställningar.
- Alla skapade figurer visas med porträtt och en sammanfattning (pengar, bostad, dag, antal pass). Välj vem som ska spela – varje figur har sitt eget spel.
- Fortsätt är nedtonad tills det finns en figur. Från menyn kan du också börja om från början eller ta bort en figur.
- ☰-knappen öppnar samma meny mitt i spelet (Esc stänger).
- Inställningar: ljud på/av, musik på/av och val av mätare.
- Pixelmätare uppe till vänster i spelbilden: porträtt, pengar, dag och klocka, mat och sömn – i samma pixelstil som staden. Växla mot den gamla raden överst i inställningarna.
- Bakgrundsmusik: en liten chiptune-slinga (kan stängas av).

## [0.16.0] – 2026-09-28 – Automatisk uppdatering och säkerhetskopior
- Spelet uppdaterar sig självt: när en ny version kommer ut sparas allt och sidan laddas om när det passar – aldrig mitt i ett arbetspass eller en dialog. Allt du har är kvar.
- Innan omladdningen hämtas hela nya versionen, så gamla och nya filer blandas aldrig.
- En säkerhetskopia av din sparning tas vid varje versionsbyte (de tre senaste sparas). Du hittar dem under versionsknappen och kan återställa om något blivit fel.
- Sparningen tappar aldrig något som en nyare version lagt till, även om du råkar spela en äldre flik.
- Spelet fungerar även utan nät när du väl har laddat det en gång.

## [0.15.0] – 2026-09-28 – Ni ser varandra i staden
- Ni ser varandra igen: den som tappar nätet, somnar i fickan eller stänger fliken städas bort ur världen inom en minut, och samma spelare i två flikar blir inte två figurer.
- 👥-listan visar var alla är just nu (i staden, i mataffären, på jobbet, hemma hos någon) och har en "Gå dit"-knapp som tar dig fram till kompisen i staden.
- Är en kompis i staden men utanför bild visas en pil med namnet i skärmkanten – klicka på den så går du dit.
- Den som håller i världen och lägger mobilen i fickan lämnar över till någon som är aktiv, så de andra tappar inte varandra.
- Har du inte rört spelet på fem minuter loggas du ut ur världen; första klicket tar dig tillbaka.

## [0.14.0] – 2026-09-28 – Versionsnummer i spelet
- Versionsnumret syns uppe till höger – tryck på det för att läsa nyheterna.
- Spelet säger till när en ny version har kommit ut medan du spelar, och visar vad som är nytt första gången du startar en ny version.
- Hela historiken finns här i nyhetslistan och som git-taggar (v0.1.0–v0.14.0).

## [0.13.0] – 2026-09-28 – Ny figurmotor, bagagehallen och MÖBELJÄTTEN
- Figurerna ritas av en ny lagermotor som klarar hundratals nya kläder och stylingval. Alla gamla figurer ser exakt likadana ut.
- Avatarredigeraren har 17 flikar. Plagg du inte äger ligger bakom "🔒 N fler i klädaffären".
- Flygplatsens bagagehall har samma detaljnivå som staden: plattan genom fönstren, röntgen, personal och destinationsvagnar.
- MÖBELJÄTTEN-varuhuset: entré, bollhav, inredda rum, prislappar och den gula gången.

## [0.12.0] – 2026-09-28 – Klädaffären med tjej- och killavdelning
- Klädaffären är större med kamera: TJEJER och KILLAR med egna neonskyltar, provhytter och speglar.
- 20 skyltdockor i hela outfits med namn- och prislapp, hattvägg och accessoarhylla.
- Köpdialogen visar din egen figur i plagget.

## [0.11.0] – 2026-09-28 – Byt tallrik i Burgarbaren
- Bär du en rätt och klickar på en annan tallrik på disken byts de. Klick på en tom plats ställer ner det du bär.

## [0.10.0] – 2026-09-27 – Pixelstaden på riktigt
- Staden är stor och rullar med kameran: husrad med gränder och tvärgator, trottoarer, bilväg och park med fontän.
- Detaljerade fasader: stormarknad med skjutdörrar, MÖBELJÄTTEN, boutique, kafé, diner med neon, fabrik och flygterminal.
- Trafik med trafikljus, fotgängare med hundar, fåglar, fjärilar och en katt.
- Fri möbelfärgning med färgrutor och egen färg.

## [0.9.0] – 2026-09-27 – Allt är gåbart
- Inget ses längre från sidan: staden, butikerna och jobben går du runt i med din egen figur.
- Jobben med kroppen: bära väskor, plocka frukt från bandet och den nya Burgarbaren.
- Möbelvaruhus och klädaffär där allt står utställt. Hemmet har flera rum och ett Möblera-läge.
- Buggfix: spelet frös när man gick in på flyghuset.

## [0.8.1] – 2026-09-27 – Ett pixelkorn överallt
- Rummet, möblerna, figurerna och staden har exakt samma pixelstorlek.

## [0.8.0] – 2026-09-27 – Riktiga möbelsprites
- Möblerna är handritade sprites från EmanuelleDev: säng, garderob, kylskåp, soffa, fåtölj, TV, bokhylla, öppen spis med mera.

## [0.7.0] – 2026-09-27 – Rummet i Pixelverkstans stil
- Rummet ritas som datorbutiken i Pixelverkstan: tapet, plattgolv, fönster med ljusinsläpp och målade möbler.

## [0.6.0] – 2026-09-27 – Dubbel upplösning
- Skarpare bild och stjärnbakgrund.

## [0.5.0] – 2026-09-27 – Rummet man går runt i
- Rummet blev ett golv man går omkring på, plus många nya kläder och frisyrer.

## [0.4.0] – 2026-09-27 – Öppen värld
- Alla som spelar är i samma Pixelstad utan koder. Ni ser varandra och kan åka hem till varandra.
- Dagshändelser, rekord, emotes och dagboken 📊.

## [0.3.0] – 2026-09-27 – Fler kläder
- 18 nya plagg och accessoarer i klädaffären, från 90 till 2500 kr.

## [0.2.0] – 2026-09-27 – Besök, klädaffär och möbler
- Hälsa på hos varandra, köp kläder och möbler, ljud och ett slutmål: egen villa och 10 000 kr.

## [0.1.0] – 2026-09-27 – Första spelbara versionen
- Pixelstaden, ditt rum, tre jobb, bostäder, hunger och energi, klocka och sparning.
