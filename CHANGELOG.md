# Nyheter i Snabbfilen

Varje släpp får ett versionsnummer som syns uppe till höger i spelet – tryck
på det så ser du de senaste nyheterna. Varje version har en git-tagg
(`v0.14.0` osv.) så att man alltid kan gå tillbaka.

**Numreringen:** ny funktion → mittensiffran ökar (0.13.0 → 0.14.0), buggfix →
sista siffran ökar (0.14.0 → 0.14.1). Version 1.0.0 blir det när hela den stora
utbyggnaden (djur, alla jobb, storstaden, varuhuset i våningar) är på plats.

<!-- släpp: tools/release.mjs lägger nya versioner direkt under denna rad -->

## [0.26.0] – 2026-09-28 – Jobba tillsammans i Burgarbaren
- NYTT: JOBBA TILLSAMMANS! Gå till Burgarbaren samtidigt som en kompis – ni ser varandra i dinern, delar på samma kunder och samma disk, och den som serverar får poängen och lönen. En langar tallrikar, en springer till borden!
- Den som var först på passet är skiftledare och håller i kön och köket – kompisar kan hoppa in och av mitt i skiftet utan att något går sönder.
- Kollegor syns nu även i butikerna och på de andra jobben – vinka med emotes!
- Grunden är byggd så att fler ställen kan bli samarbetsjobb framöver, köket i nya Burgarbaren står på tur.

## [0.25.6] – 2026-09-28 – Disken i Burgarbaren lagad
- Disken i Burgarbaren är lagad: tallrikar hamnar ALDRIG mer på varandra eller på någon annans plats.
- Köket fyller nu alla sex platserna (förr stannade det vid fem) och väntar snällt när disken är full.
- Ställa ner är enklare: klicka var som helst på disken så väljs närmaste lediga plats, och platsen hålls åt dig medan du går fram – köket kan inte längre ta den.
- Är hela disken full sägs det tydligt: "FULLT PÅ DISKEN!" och du behåller rätten i händerna.
- Klick på en upptagen plats byter rätt som förut.

## [0.25.5] – 2026-09-28 – Paddorna får rätt zoom
- Paddor (iPad m.fl.) får nu VID-läget som standard i stället för NÄRA: stora skärmar ser mer värld i rätt pixelstorlek, inte jättepixlar. Mobiler behåller NÄRA. 🔍 växlar som vanligt.
- Knip-zoom på själva sidan (iOS) blockeras inne i spelet så spelytan inte hamnar snett – i dialoger och menyer går det fortfarande att zooma.

## [0.25.4] – 2026-09-28 – Möbeljätten bred
- Möbeljätten är nu bred som staden och mataffären: du ser mer av varuhuset på hela skärmen – entréhallen med rulltrapporna, Småland och kassabandet samtidigt.
- På höga skärmar syns båda våningsbanden på en gång, i stället för ett i taget.
- Gäller VID-zoomläget (🔍) – NÄRA på mobilen visar som förut datorns klassiska bild.

## [0.25.3] – 2026-09-28 – Närmare på mobilen
- Mobilen kommer NÄRMARE: samma bild som på datorn – stora, tydliga pixlar – och den fyller hela skärmen. Det är nu standard på mobil och platta.
- 🔍-knappen växlar mellan tre zoomlägen: NÄRA (som datorn, fyller skärmen), VID (ser mer av staden och butikerna på en gång) och RAM (hela bilden med pixelram). Valet sparas.
- Datorn har VID som standard precis som innan.

## [0.25.2] – 2026-09-28 – Mataffären och kaféet breda
- Mataffären och kaféet är nu breda som staden: du ser MER av butiken på hela skärmen – hyllrader, båda kassorna och pantmaskinen samtidigt – i stället för en förstorad och beskuren bild.
- Skärpan är exakt densamma: fler knivskarpa pixlar i bild, ingen skalning.
- Fler ställen blir breda i takt med att de byggs om – närmast bostäderna och klädaffären.

## [0.25.1] – 2026-09-28 – Zoomval: inne fylls hela skärmen
- Inne i rum, butiker och på jobben fylls nu HELA skärmen: bilden förstoras jämnt tills ytan är täckt, med liten beskärning som tas mest upptill så golv, diskar och dörrar syns.
- Ny 🔍-knapp i HUD-raden: växla mellan "fyll skärmen" och "hela bilden med ram" – valet sparas per webbläsare.
- Lilla rummet visar inte längre den mörka ytan bortom väggen: lokalens riktiga bredd är det som fyller skärmen.
- I stående läge fylls bredden i stället för att bilden beskärs sönder – och vändskylten tipsar om liggande läge.

## [0.25.0] – 2026-09-28 – Hela skärmen fylls på alla enheter
- Spelet fyller nu HELA skärmen på varje enhet – mobil, platta och dator, stående som liggande. Inga svarta kanter.
- Staden visar mer värld åt alla håll: bredare gata, fler hus och mer liv på samma gång.
- Mätarremsan spänner över hela skärmens bredd, med mätarna i mitten.
- Rum, butiker och jobb ritas centrerade med en mörk pixelram runt om – allt syns på en skärm.
- Ny skylt på mobilen: håller du den stående föreslår spelet att du vänder den – Snabbfilen spelas liggande.
- Chatten och hörnknapparna håller sig undan mobilens notch och hemindikator.
- Ingenting är uppskalat eller suddigt: exakt samma knivskarpa pixelkorn som förut – bilden växer i stället.

## [0.24.0] – 2026-09-28 – Veckan först med sju fönster mot staden
- **Veckan möter dig först** när du kommer in i spelet (och som förut varje morgon när du vaknar, och med 📅).
- Dagarna är nu **sju fönster ut mot Pixelstaden**, med en egen utsikt för varje dag: hyreshuset på måndagen, bussen, parkträdet, flygplanet, fredagsljusen, pariserhjulet och kyrktornet. Molnen, bussen och planet rör sig, och regnar det i dag så regnar det i fönstret.
- Avklarade dagar är gråa och i skymning. Dagens fönster lyser, och söndagen påminner om hyran i morgon.
- Större rutor och större text. Sparmålsrutan är borttagen och ersatt av **Veckans läge**: pengar, bostad, hyra, nästa hyra, mat i kylen, energi och mättnad.

## [0.23.4] – 2026-09-28 – Flera figurer får heta samma
- Varje figur har nu ett eget id, så flera kan heta samma sak. **Nytt spel** skapar alltid en ny person med ett eget liv, och rutan **Börja om?** kommer inte längre upp.
- Gamla figurer behåller sina sparningar: de får namnet som id.
- Gatuskyltarna är en pixel högre, så att bokstäverna inte längre går ihop med den vita ramen.

## [0.23.3] – 2026-09-28 – Repliker som pratbubblor i butikerna
- Klickar du på taxen eller katten på kaféet, mäklarens tax, kassörskan i klädaffären eller sakerna på bostadsbyrån och i mataffären, visas det som en pratbubbla i scenen – ovanför den som säger något, eller ovanför dig själv – i stället för en ruta högst upp.
- Pratbubblorna håller sig inom bilden och rymmer längre repliker.

## [0.23.2] – 2026-09-28 – Möblera med fingret på mobilen
- Möblera på mobilen: dra möbeln med fingret och släpp, så står den där du släppte. Tidigare satt den kvar i handen och flyttades igen vid nästa tryck.

## [0.23.1] – 2026-09-28 – Aldrig in i spelet utan namn
- Man kan inte längre komma in i spelet utan namn: trycker man Avbryt eller ✕ när man skapar sin figur hamnar man i huvudmenyn igen.

## [0.23.0] – 2026-09-28 – Veckosammanfattning med hyresdag, checklista och sparmål
- Veckosammanfattning varje morgon: när du vaknar ser du veckan måndag–söndag. Avklarade dagar är grå, dagens dag är gul, och måndagen visar hyran – så du ser exakt när pengarna dras.
- En prognos säger om pengarna räcker till hyran, annars hur mycket du behöver tjäna och ungefär hur många pass det är.
- En checklista för dagen (hyran, mat, kylskåpet, sömn) och ett sparmål mot nästa bostad med en mätare.
- 📅-knappen uppe till höger öppnar veckan när du vill.

## [0.22.0] – 2026-09-28 – Pratbubblor, emoji i chatten och menytavla vid Burgarbaren
- Klickar du på en kafégäst eller mäklaren säger de sin replik i en pratbubbla ovanför sig, inte i en ruta högst upp.
- Emoji i chatten: skriv in vilka emoji du vill (eller välj i 😀-väljaren i chattraden) – de ritas som små pixelbilder i pratbubblan. Bubblorna rymmer nu fyra rader.
- Menytavla vid Burgarbarens entré med samma rätter och priser som på jobbet, upplyst på kvällen.
- Burgarbarens nederdel är nu blank röd emalj med vit rand – de räfflade stålpanelerna såg ut som nerdragna jalusier fast restaurangen var öppen.

## [0.21.0] – 2026-09-28 – Chatt med pratbubblor
- Chatta med de andra: tryck Enter (eller 💬 uppe till höger), skriv och skicka. Det du säger visas som en pratbubbla ovanför din figur i några sekunder, och alla som är på samma plats ser den.

## [0.20.0] – 2026-09-28 – 147 nya möbler, rotation, slitna Lilla rummet och MÖBELJÄTTEN i två våningar
- 147 nya möbler i katalogen (160 totalt): kök, badrum, barnrum, kontor, hall, dekor, växter, lampor, tavlor, gardiner, jul – och sängar och garderober i många färger. Allt ur de köpta EmanuelleDev-arken, färgbart som förut.
- Väggsaker hängs på väggen och står inte i vägen. Allt går att flytta, även säng, garderob, kylskåp och toalett – funktionen följer med möbeln, också till ett annat rum via förrådet.
- 🔄 Rotera i Möblera-läget (och tangenten R): soffor, fåtöljer och sängar vänds framåt, åt sidan och bakåt; övriga möbler speglas. Besökare ser rotationen.
- Lilla rummet är mindre och sjabbigt: sprickor, fuktfläckar, flagnande tapet, spindelväv med en spindel, sprucken ruta, en mus, naken glödlampa – och ett gulnat dass med snett lock. De finare bostäderna är som förut.
- MÖBELJÄTTEN i två våningar: entréplan med marknadshall, självbetjäningslager med pallställ och truck, kassor och korvkiosk; utställningsplan med små inredda rum för vardagsrum, kök, kontor, sovrum, barnrum, badrum och hall längs den gula slingan.
- Åk rulltrappa (animerade steg) eller hiss mellan våningarna. Personal i gula kläder fyller på, kör vagnar, sitter i kassorna och hjälper till med tips när du klickar på dem; andra kunder provsitter soffor.
- Restaurangen: ta en bricka, välj köttbullar med mos och lingonsylt, korv, kanelbulle, kaffe eller saft, betala i kassan och sätt dig och ät – mättnaden går upp.
- Skyltar överallt: avdelningar, våningar, vägvisare och prislappar på allt som är till salu.

## [0.19.0] – 2026-09-28 – Annonser med bilder på bostadsbyrån
- Bostadsbyråns annonser har bilder: samma planscher som hänger på mäklarkontorets vägg visas i annonsdialogen, i pixelskala, för varje bostad.

## [0.18.4] – 2026-09-28 – Hundarna slutar blinka och gå åt två håll
- Hundarna i staden hoppar inte längre fram och tillbaka: när vägen är blockerad glider hunden längs hindret i stället för att teleporteras bakåt, den växlar inte mellan gå och stå varje bildruta, och den byter riktning först när den nya riktningen hållit i sig en stund.

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
