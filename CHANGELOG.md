# Nyheter i Snabbfilen

Varje släpp får ett versionsnummer som syns uppe till höger i spelet – tryck
på det så ser du de senaste nyheterna. Varje version har en git-tagg
(`v0.14.0` osv.) så att man alltid kan gå tillbaka.

**Numreringen:** ny funktion → mittensiffran ökar (0.13.0 → 0.14.0), buggfix →
sista siffran ökar (0.14.0 → 0.14.1). Version 1.0.0 blir det när hela den stora
utbyggnaden (djur, alla jobb, storstaden, varuhuset i våningar) är på plats.

<!-- släpp: tools/release.mjs lägger nya versioner direkt under denna rad -->

## [0.54.0] – 2026-09-29 – Kartan och taxin
- 🗺️ KARTAN: en ny knapp överst tar fram en pixelkarta över hela Pixelstaden – gatorna, parken, floden med broarna och alla hus, och en skylt DU ÄR HÄR.
- Tryck på ett ställe på kartan: du ser namnet, öppettiderna och hur långt dit det är.
- 🧭 Visa vägen: en guldpil vid fötterna visar vägen, en röd nål svävar över dörren och syns den inte pekar en skylt i bildkanten åt rätt håll. Tryck på lappen nere till vänster så går du dit själv – × tar bort pilen.
- 🚕 TAXI: ring efter en taxi med den nya knappen (eller från kartan). Taxin kör fram till trottoarkanten där du står, du kliver in och kliver ur vid dörren dit du ska. 25 kr i startavgift plus 10 kr per 100 meter – perfekt hem till husvagnen sent på kvällen.
- Beställer du taxi hemifrån eller från en butik går du ut på trottoaren och taxin kommer. Tryck på 🚕 igen för att avbeställa.

## [0.53.1] – 2026-09-29 – Missade patienter kostar inget
- Vårdcentralen: en patient som tröttnar och går hem kostar inget längre – den ger bara 0 kr (syns fortfarande som en egen rad på lönebeskedet).

## [0.53.0] – 2026-09-29 – Småsaker på bord
- Småsaker kan stå PÅ bord: i Möblera-läget hamnar datorn, bordslampan, brödrosten, kaffebryggaren, blomkrukorna, ljusen och de andra småsakerna uppe på skivan när du håller dem över ett bord, en byrå, en bänk eller en låg hylla.
- Datorn på skrivbordet och den gamla TV:n på TV-bänken går att använda – du går fram till bordet.
- Flyttar du bordet följer sakerna med. Lägger du det i förrådet eller säljer det hamnar sakerna på golvet där det stod.
- Kompisar som hälsar på ser också sakerna på borden.

## [0.52.0] – 2026-09-29 – Prata med folk i staden
- Klicka på folk i staden: personen stannar, vänder sig mot dig och säger något i en pratbubbla – med sin egen röst.
- Vad de säger beror på tiden och vädret (God morgon!, Usch, vilket regn!), vilka de är (barn vill leka, kostymfolket har bråttom till mötet, joggaren kan inte stanna) och vad de bär på (hunden, kaffet, resväskan).
- Står de en bit bort väntar de medan du går fram. Sitter du på en bänk kan du prata med grannen utan att resa dig.

## [0.51.0] – 2026-09-29 – Pixelhögskolan och de utbildade jobben
- Pixelhögskolan i downtown har öppnat: skriv in dig på expeditionen i Datorteknik (600 kr) eller Ekonomi (900 kr).
- Gå fyra föreläsningar i Aula 1 (två timmar var, högst en per kurs och dag) – läraren skriver på tavlan och texten rullar under.
- Skriv tentan i biblioteket: minst 2 rätt av 3 ger examen och diplom. Underkänd? Omtenta tidigast nästa dag.
- Med examen i Datorteknik får du jobb på PIXEL DATA: plocka processor, minne, grafikkort, disk och nätagg ur hyllorna efter ordern, kylpasta och kylare, tryck på startknappen – BIOS OK och en kollega bär iväg datorn (12 kr per rätt, +25 kr per färdig dator).
- Med examen i Ekonomi handlar du aktier på Finanshuset: fyra skärmar med kurser och kundlappar – KÖP eller SÄLJ när priset är rätt (26 kr per affär).
- Sockeln vid skolans entré säger nu PIXELHÖGSKOLAN (LED-kronan högst upp säger fortfarande PIXEL TOWER).

## [0.50.1] – 2026-09-29 – Numret på ryggen
- Kungsladugårds matchtröja har nu spelarens nummer på ryggen: köper du Julias tröja står det 34 på din rygg i staden, och varje spelare har sitt eget nummer.
- Numret syns redan i matchställdialogen när du vrider figuren bakifrån – och andra spelare ser det också.
- Andra lags tröjor har inget ryggnummer; tar du på dig en annan lagtröja försvinner det.
- Numret sitter lågt på ryggen så att långt hår inte skymmer det (bara midjelångt hår täcker, precis som på plan).

## [0.50.0] – 2026-09-29 – Bion, kebaben, pantbanken, lotterna och vårdcentralen
- BIO PIXEL öppnar: foajé med biljettlucka, popcornbar och affischer, och en riktig salong – köp biljett (90 kr), välj bland sex filmer, sätt dig, ljuset släcks, ridån går upp och en egen pixelfilm spelas medan publiken skrattar, gråter och kastar popcorn. Efteråt +15 energi (2 timmar går)
- KEBAB GRILL i förorten: beställ kebabrulle, falafel, pommes och läsk, se kocken göra maten och ät sittande bit för bit
- PANTBANKEN: sälj möbler ur förrådet för halva priset, eller låna pengar mot pant – betala tillbaka med ränta inom en vecka, annars behåller pantlånaren möbeln
- SKRAPLOTTER i närbutiken: 25 kr, skrapa fram tre lika och vinn upp till 1 000 kr
- Nytt jobb på VÅRDCENTRALEN: ta emot patienterna i receptionen och skicka dem till rätt rum – läkare, sjuksköterska, labb eller akuten; akutfall först ger bonus

## [0.49.0] – 2026-09-29 – Garderoben: skor, accessoarer, frisör och fotboll
- KLÄDAFFÄREN har fått en våning till: gå uppför trappan till SPORT & FOTBOLL
- Hela KUNGSLADUGÅRD-laget står där i matchställ med nummer och förnamn på ryggen, och lagfotot hänger på väggen – köp lagets tröja och shorts
- Matchtröjor i tolv kända lags färger (bara stadsnamnen) och fotbollsskor i neongult, gulgrönt, rosa, svart och vitt
- Nya butiker i DOWNTOWN: SKOBUTIKEN med sneakers, kängor, stövlar och finskor (prova på pallen, skoputsen blankar dem) och ACCESSOARER med hattar, glasögon, hörlurar, väskor, halsband och scarfar, smycken och hårspännen
- FRISÖREN i downtown: över 150 frisyrer i tolv grupper plus färgning, slingor och toppar – du ser dig själv med den nya frisyren innan du bestämmer dig, sedan klipper Sami
- Frisyr och hårfärg byter du nu hos frisören – garderoben hemma visar din frisyr men byter den inte (en ny figur väljer fritt som förut)
- Allt du köper i klädaffären, skobutiken och accessoarbutiken hamnar i garderoben hemma – nästan 400 plagg att samla, och dagboken räknar hur många du har
- REA-dagar ger 25 % rabatt i alla tre butikerna
- Gamla sparningar: allt du redan har köpt finns kvar

## [0.48.0] – 2026-09-29 – Elektronikbutiken och banken öppnar
- BLIXT ELEKTRONIK öppnar i downtown: TV-vägg, telefoner, surfplattor, gamingriggar, datorer och hörlurar – gå fram, prova och bär lådan till kassan. Telefonen och plattan ger lite extra energi när du sover (dyrare modell = mer)
- Möbeljätten säljer inte längre datorsakerna – de finns på BLIXT (det du redan äger är kvar)
- PIXELBANKEN öppnar: sätt in och ta ut i kassan eller bankomaten, 2 % ränta varje måndag på det som legat kvar hela veckan, och räcker inte fickan till hyran tar banken resten från sparkontot (autogiro). Sov-rutan och veckosammanfattningen visar räntan och autogirot
- Dagboken visar vad du har på banken, och slutmålet räknar fickan och banken tillsammans
- Möblera-panelen täcker inte längre rummets högerkant på vanliga datorskärmar

## [0.47.0] – 2026-09-29 – Bron och downtown – staden på längden
- STADEN PÅ LÄNGDEN: centrum → Infarten → DOWNTOWN → FLODEN → FÖRORTEN. Förorten sitter inte längre ihop med centrum – den ligger på andra sidan floden
- STORA BRON: en hängbro som Brooklyn Bridge – två granittorn med gotiska spetsbågar som man går igenom, bärkablar i båge, hängstag, gångbanor i plank med lyktor och båtar som glider under. Kameran lyfter på bron så att tornen och kablarna syns
- JÄRNBRON över floden vid Södergatan, med fackverk
- DOWNTOWN – finanskvarteret: skyskrapor med karuselldörrar (Finanshuset, Börshuset, Pixel Tower som blir Pixelhögskolan, Glastornet), Pixelbanken, elektronikbutiken, skobutiken, frisören och accessoarbutiken, Finanstorget med tjuren och fontänerna – och folk i kavaj och slips
- Butikerna i downtown öppnar i de kommande släppen – dörrarna säger "öppnar snart" tills dess
- Buss till Finanstorget, och bussen kör ut på Stora bron innan den tonar
- Floden fryser på vintern och har inga snöpölar – vattnet och tornen går inte att gå i

## [0.46.4] – 2026-09-29 – Djuraffären och mäklaren i bredbild
- Djuraffären och mäklarkontoret på Bostadsbyrån fyller nu breda skärmar och mobilen i liggande läge – du ser mer av butiken på en gång i stället för en smal ruta

## [0.46.3] – 2026-09-29 – Radhusen blommar
- Radhusen har fått liv framför varje hus: blomlådor under övervåningens fönster (egna blommor per hus, snö på vintern), rosenbuske och en cykel vid hus 1, blomkrukor vid trappan och en trädgårdstomte vid hus 3, solrosor och en trehjuling vid hus 5, dörrmattor vid alla dörrar
- Katten vid Radhusen ligger inte längre gömd bakom häcken – den solar i gräset vid trappan

## [0.46.2] – 2026-09-29 – Husdjuren och gästerna låter
- Husdjuren låter på riktigt: klickar du på hunden eller katten skäller eller jamar den (hungrigt eller ledset om den behöver något), klappar du spinner katten och hunden skäller glatt, och leker ni blir de glada
- Gästerna på caféet och i Burgarbaren pratar med sin egen röst (inte stolens)

## [0.46.1] – 2026-09-29 – Husskyltar och kyrkogården
- Bostadshusen i stan (Tornhuset, radhusen, höghusen …) visar nu en skylt när du inte bor där: vilken bostad det är, vad den kostar och 👁 Titta in – flytta gör du hos mäklaren på Bostadsbyrån (🔑-knappen tar dig dit)
- Kyrkogården: gravarna står inte längre på gångarna och häcken ligger inte över grinden – ny uppställning efter att Leksakslådan flyttade in

## [0.46.0] – 2026-09-29 – Riktiga ljud överallt
- RIKTIGA LJUD: allt som låter i spelet är nu inspelningar (fria CC0-ljud) i stället för pip och syntar
- Bakgrundsljud som skiftar där du går: trafiken på gatorna, fåglar och duvor i parken, vågor, måsar och båtmotorer vid kanalen, blåsten som tar i vid vattnet, regnet (dämpat när du är inne), snön, natten med syrsor
- Varje ställe har sitt eget ljud: sorlet och espressomaskinen på caféet, fritösen och grillen i Burgarbaren, stormarknaden, butikerna, hemma, flygterminalen och verkstäderna
- Bakgrundsmusik som inte tar över – egna låtar för stadsdelarna, parken, caféet, hemma och natten (musiken går att stänga av i menyn)
- Folk pratar simspråk med riktiga röster (man, kvinna, barn, äldre – glada, sura, frågande), och hundar, katter, kaniner och fåglar låter som riktiga djur
- I röstchatten viker bakgrundsljudet och musiken undan när någon pratar

## [0.45.0] – 2026-09-29 – Fasadrunda: macken, Söder och parken
- PIXELMACKEN är en riktig bensinmack: tak över två pumpöar, bilar som svänger in, tankar (kronorna rullar på displayen) och kör vidare, och en stor prisskylt med BENSIN 95 och DIESEL som ändras under dagen – plus butik med KAFFE, biltvätt, luft/vatten och dammsugare
- Radhusen: inga mörka streck tvärs över fasaden, mittenhuset har sin egen färg och inga halva fönster sticker fram bakom dörrarna
- Pizzerian: blomlådorna ligger inte längre över skylten PIZZERIA NAPOLI – de sitter under översta våningens fönster
- Tornhuset och vårdcentralen har fått tydliga skyltar (blåljus och jourlampa på vårdcentralen), kyrkporten och klockorna är skarpa, snötaken är rena
- Bion släcker skyltarna när den stänger, och KASSA/POPCORN/POSTEN skyms inte längre av gatlyktorna
- Parken: musikpaviljongen är en öppen paviljong där musikkåren ibland spelar (klicka för att se när), lekförrådet och WC:t är omgjorda med tydliga skyltar
- Djuraffären har fått en pratare på trottoaren med dagens erbjudanden

## [0.44.0] – 2026-09-29 – Sova i sängen och egna badrum
- Sova på riktigt: klicka på sängen och säg ja – figuren lägger sig under täcket med huvudet på kudden, lamporna släcks, månen lyser in, zzz stiger och sedan kommer gryningen och figuren kliver upp och sträcker på sig (klick hoppar fram)
- Funkar i alla bostäder och med alla sängar, även golvmadrassen och husvagnens brits
- Varje bostad har ett eget BADRUM (husvagnen en liten TOA) bakom en dörr – toaletten står aldrig mitt i rummet längre, med handfat och dusch eller badkar
- Gamla sparfiler: dasset som redan står i Lilla rummet får stå kvar tills du flyttar det med Möblera (ett tips visas)
- Möbelskyltarna (SÄNG, KYLSKÅP …) krockar inte längre med varandra eller med dörrarna

## [0.43.0] – 2026-09-29 – Flygterminalen och incheckningen
- FLYGTERMINALEN: flygplatsens dörr leder nu in i en stor gåbar avgångshall med glasväggar – plan som landar och lyfter, tankbilen under vingen, signalgubben och trappbilen, bagagebandet, avgångstavlan som bläddrar, säkerhetskontrollen med bågen som piper, gaterna och PIXEL KAFFE
- Nytt jobb: INCHECKNINGEN – kolla passen (falska finns!), väg väskorna, välj plats, skriv rätt bagagelapp och skicka iväg surfbrädor och hundburar till specialbagaget; 18 kr per resenär
- Bagagechefen vid bandet erbjuder det gamla bagagepasset, stationschefen och diskarna incheckningen
- Flygplatsen stänger aldrig: flygjobben går att ta på kvällen fram till 23:00, och ett nattpass som når midnatt slutar med nattbussen hem till sängen i stället för att man somnar där man står
- Efter passet står man kvar i terminalen

## [0.42.0] – 2026-09-29 – Vi sitter tillsammans
- Andra spelare syns SITTANDE: sätter sig någon vid ett bord på caféet, i Burgarbaren, i Möbeljättens restaurang eller på en parkbänk ser alla andra figuren sitta där – och tugga när maten står framme
- Platsen där en annan spelare sitter är upptagen: varken du eller stadens folk sätter sig i knät på dem, och den blir ledig igen när de reser sig

## [0.41.0] – 2026-09-29 – Husdjuren växer av omsorg
- Husdjuren växer av omsorg: valpar, kattungar och kaninungar blir unga och sedan vuxna när de får mat, lek, en leksak hemma och sköts rätt på toaletten
- Hunden gör sina behov ute på promenaden, katten i en ren kattlåda – bajs inne och smutsig låda ger ingen tillväxt
- Tid krävs också: minst tre dagar som unge och fyra som ung, även med bästa omsorg
- Djurmenyn visar en tillväxtmätare och vad djuret behöver, och när djuret växer blir det större och säger JAG HAR VUXIT!
- Nytt i djuraffären: Gnagmorot, kaninens egen leksak

## [0.40.0] – 2026-09-29 – Däckbyte i bilverkstaden
- Bilverkstaden: riktigt däckbyte steg för steg – bilen kör in, hissa, hämta skruvdragaren, skruva ur skruvarna en i taget, lyft av däcket, lägg det i stapeln, hämta rätt däck, skruva fast i kryss, fyll luft och sänk
- Det punkterade hjulet syns på bilen, och en arbetsorder visar vilket hjul och vilket däck bilen ska ha
- Skruvarna flyger ner i en magnetskål och tillbaka, däckstället har skyltar för sommar, vinter, stort och litet
- Kameran följer mekanikern så att allt syns även på mobilen

## [0.39.0] – 2026-09-29 – Leksakslådan öppnar
- Leksakslådan har öppnat på Söder, bredvid kyrkogården – en rosa leksaksaffär med modelltåg och nalle i skyltfönstret
- Squishy-dumplings i bambukorgar (pastell, glitter och jul), squishy-mat som ostkub, smörpaket, jordgubbslåda och kattass
- Klämbordet: håll inne så trycks leksaken ihop, släpp så fjädrar den tillbaka med pip och glitter
- Egna klämkompisar i plysch och plast, nallar, bilar, tåg, bollar, spel och dockor – köpta leksaker sparas

## [0.38.0] – 2026-09-29 – Garderoben: nya frisyrer och ansikten
- Garderoben: en ny figurmotor med lager – 89 frisyrer, 16 hårfärgseffekter och över 180 nya ansiktsval (ögon, bryn, näsa, mun, öron, kinder, smink, fräknar och märken, skägg)
- Över 350 nya plagg är ritade: tröjor, jackor, byxor, kjolar, skor, hattar, glasögon, halsband och smycken – de börjar säljas i klädaffären och stans nya butiker i nästa släpp
- Redigeraren visar valen i grupper så att allt ryms utan långa listor, även på mobilen
- Alla gamla figurer ser exakt ut som förut

## [0.37.0] – 2026-09-29 – Äta på riktigt och Burgarbarens menypelare
- Äta på riktigt: maten man köper för att äta på plats bär man i handen, sätter sig med och äter bit för bit – mättnad och energi kommer medan man äter
- Sitter man och äter reser man sig inte förrän det är uppätet, och med maten i handen kommer man inte ut: "DU MÅSTE SÄTTA DIG OCH ÄTA UPP!" – i Stormarknaden, Kaféet, Burgarbaren och Möbeljätten
- Stormarknaden: korven köps vid grillen och äts vid sittdisken – den hamnar aldrig på kassabandet
- Betald mat försvinner aldrig: laddas sidan om eller byter man ställe mitt i maten räknas resten in
- Burgarbaren har olika priser: burgare 25, pommes 15, läsk 12, glass 14 och målet 47 kr
- Menypelaren utanför Burgarbaren visar alla fyra rätterna och sedan en stor rätt i taget med sitt pris

## [0.36.0] – 2026-09-29 – Bion, pizzerians uteservering och djuraffären
- Bion är en riktig biograf: BIO PIXEL med stor ljusskylt där kvällens filmer byts, affischer för actionfilm och romantisk komedi, biljettlucka och popcorn
- Pizzerian har fått en uteservering på ett trädäck – gäster som äter pizza, snurrar spagetti och skålar, och en servitör som bär ut pizzor
- Djuraffären ser ut som en välskött butik med stor skylt, valpar och kattungar som leker i skyltfönstret och ett akvarium

## [0.35.0] – 2026-09-29 – Närbutiken öppnar
- Närbutiken i förorten har öppnat – en egen trång och sunkig butik med utomlandskänsla, öppen dygnet runt
- Smala gångar, överfulla hyllor, kartongstaplar, en kylvägg med exotiska drycker, ett lysrör som blinkar och katten Sultan som flyttar runt
- Allt kostar 20 % mer än på Stormarknaden – men den har alltid öppet
- Ny skylt utanför: en sliten ljuslåda med NÄRBUTIK 24/7 där ett lysrör håller på att dö

## [0.34.0] – 2026-09-29 – Vädret rätt och glasståndet i parken
- Vädret: solen ger vanligt ljus igen – ingen brun eller orange ton över staden på dagen, bara kvällsljus när det börjar mörkna
- Regn: bilarna skvätter från däcken och plaskar genom pölarna
- Blåst: träden lutar och vajar med vinden och löven blåser loss
- Snö: bilarna lämnar hjulspår, och plogbilar röjer alla vägar – även Infarten – och lägger en plogvall mot trottoaren
- Parkens kiosk är nu ett öppet glasstånd med glassmeny, uteservering och bord man kan sätta sig vid – köp kulglass, två kulor eller mjukglass
- Den gamla glasskiosken och löpsedlarna "SOL! I HELG" är borttagna

## [0.33.0] – 2026-09-29 – Mobilen: husnamn i staden och kompakt meny
- Mobilen: i staden visas husens namn överst när skyltarna hamnar utanför bilden – tryck på namnet så går du dit och in
- Mobilen: kameran visar mer av husen ovanför figuren, och områdesskylten och vädret ligger inne i bilden
- Mobilen: huvudmenyn i två spalter på liggande telefon, så att "Vem spelar?" syns direkt, och tätare dialogrutor
- Första gången i staden får man ett tips om hur man går in i husen

## [0.32.0] – 2026-09-29 – Röstchatt
- 🎙️ Röstchatt: prata med varandra i Pixelstaden – knappen 🎙️ i verktygsraden
- Röst i närheten: den som har rösten på hör – och hörs av – andra med rösten på som står nära, och ljudet tonar bort när man går ifrån varandra
- Röstgrupper: skapa en grupp och bjud in kompisar, så hörs ni överallt i stan – den som bjuds måste tacka ja
- 🗣️ syns över den som pratar, och man kan tysta sin mikrofon eller en enskild person
- Mikrofonen är alltid avstängd tills man själv slår på den

## [0.31.0] – 2026-09-28 – Alla börjar i husvagnen, titta in i bostäderna
- Alla nya spelare börjar i husvagnen ute i förorten – spara ihop till något bättre hos bostadsbyrån
- 👁 Titta in: tryck på en bostad hos bostadsbyrån och se hur det ser ut inne när man flyttar in – varje rum, dag och kväll
- Förortsettan och Lilla rummet har bytt plats i listan, så hyran stiger uppåt
- Går man ut ur husvagnen, eller något annat hem, kommer man ut vid sitt eget hus – inte vid första huset i centrum

## [0.30.1] – 2026-09-28 – Ljudlabbet
- Ljudlabbet: en egen sida där man kan lyssna på spelets ljud innan de kopplas in – snabbfilen/ljud.html
- Där finns effektljuden, simspråket med nio olika röster och egna repliker, och alla djurläten
- Musiken och stadens ljud dyker upp på sidan så fort de är klara

## [0.30.0] – 2026-09-28 – Fyra nya bostäder och husdjuren hemma
- Fyra nya bostäder hos bostadsbyrån: Husvagnen med egen gårdsplätt, Förortsettan på sjunde våningen med trapphus och trasig hiss, Radhuset på Söder och Takvåningen högst upp i Tornhuset
- Planschväggen visar alla sju bostäder med egna bilder, och man kan flytta in i husvagnen direkt
- Husdjuren bor hemma: skål, säck, kattlåda, korg och bur som går att ställa ut, fylla, tömma och städa
- Hunden följer med ut i koppel – promenaden räknas och hunden gör sina behov ute i stället för hemma
- Husvagnen och Förortsettan ger sämre sömn, och bostadsbyrån visar det i rött
- På mobilen fyller Lilla rummet och Lägenheten skärmen utan tom yta runt rummet

## [0.29.1] – 2026-09-28 – Dricksen blir lön
- Dricksen i Burgarköket går nu rakt in i lönen: snabb service ger 5 kr, blixtsnabb 10 kr per rätt
- Köket visar beloppet direkt när gästen ger dricks, och Bella ropar ut det
- Lönebeskedet har en egen rad för dricksen, och introt berättar att snabbhet lönar sig

## [0.29.0] – 2026-09-28 – In i Burgarbaren + Burgarköket
- GÅ IN I BURGARBAREN! Dörren leder nu in i en gåbar 50-talsdiner: schackrutigt golv, röda bås, jukebox, glassdisk och kassörskan Doris. Beställ vid disken, BÄR DIN BRICKA till ett ledigt bord, sätt dig och ät – mättnad och energi fylls bara medan du sitter. Gäster kommer och går, käkar och pratar.
- NYTT JOBB: BURGARKÖKET. Vid disken kan du ta kökspasset – beställningslappar på skenan, bygg burgarna lager för lager i rätt ordning, vänd biffarna innan de bränns, fritera pommes och ring i klockan. Snabb servering ger dricks-stjärnor!
- Burgarbarens fasad är färdig: menystället står på trottoaren (och går inte längre att gå igenom), dinerfönstren är fulla av liv – och efter stängning är det faktiskt SLÄCKT och mörkt.
- Husen på Söder är hela igen (slitaget hörde till förorten), och garagelängans tak har fått ventilation i stället för klotter.

## [0.28.2] – 2026-09-28 – Klotter bara på väggar
- Klottret har flyttat dit det hör hemma: taggarna är borta från gräsmattor, gågator, lekplatsens gungor, rutschkanan och sandlådan, bänkarna, elskåpen, biljettautomaten, containrarna, återvinningsigloon, bilvraket och ljussignalerna.
- Kvar är klottret där det ska vara: på husväggarna i förorten, muren och klotterplanket.

## [0.28.1] – 2026-09-28 – Verkstan lagad och skyltar på skärmen
- Bilverkstan är lagad: jobbet kunde hänga sig direkt (flera delar av verkstan hade aldrig ritats färdigt). Nu finns kompressorn, skruvdragaren som läggs på golvet, navet med skruvarna i bubblan, luftmunstycket och dagsljuset genom porten – och däckstället har fått riktiga hyllskenor så inga däck svävar i luften.
- Skyltarna håller sig på skärmen i mobilens NÄRA-läge: köpskylten i djuraffären, kaféets skylt, mataffärens hörnpanel och arbetspassens tidsrad kläms nu in i den synliga bilden i stället för att beskäras.

## [0.28.0] – 2026-09-28 – Den stora staden
- STADEN ÄR STOR NU! Pixelstaden har växt till en hel värld: nya SÖDER under parken med Södergatan, pizzerian, posten, biblioteket, bion, kyrkan med klocktornet, vårdcentralen och bensinmacken – och kajen vid kanalen längst i söder.
- FÖRORTEN bortom infarten: höghus i betong, närbutik med galler, pantbank, kebab, klotter överallt och en busshållplats som sett bättre dagar.
- ÅK BUSS på riktigt: gå till en hållplats, kliv på för 10 kr och åk genom hela staden.
- VÄDER OCH ÅRSTIDER: sol, drivande moln, regn med åska, snö som lägger sig, dimma och blåst – och hela staden skiftar med årstiderna.
- SEX NYA JOBB att gå till: Pizzerian, Posten, Pixelmacken, Bilverkstan, Tvätteriet och baristapasset på Kaféet.
- DJURAFFÄREN HAR ÖPPNAT: hälsa på hundarna, katterna och kaninerna och köp prylar – husdjuren flyttar in hemma hos dig i nästa uppdatering!
- Burgarbaren har fått sin nya fasad: menyställ på trottoaren och stora dinerfönster med gäster, kockar och en servitris på rullskridskor.
- Sitt på bänkar och i busskurer, hundar som slutat flimra, och tusen nya detaljer.

## [0.27.0] – 2026-09-28 – Jobba ihop: delad lön och fulla bord
- JOBBA IHOP på riktigt: när du börjar ett pass på Burgarbaren finns knappen "💼 Jobba ihop" – välj vem i Pixelstaden du vill jobba med, så får hen inbjudan medan du kliver rakt in på passet.
- NI DELAR PÅ LÖNEN: lagets alla serveringar räknas ihop och delas lika när passet är slut – att jobba med kompisar lönar sig.
- EXTRABORDEN RULLAS FRAM: dubbelt så många bord och stolar när ni är fler, och kunderna strömmar in i högre tempo – full rusch!
- Mätaren på passet visar LAGETS rätt och fel när ni är fler, och lönebeskedet visar hur lagets resultat delades.

## [0.26.2] – 2026-09-28 – Osynken vid spel ihop lagad
- Osynk-buggen vid spel ihop är lagad: när skiftledarens pass tar slut lämnas ledningen över DIREKT till kompisen – världen fryser aldrig på lönebeskedet.
- Somnar ledarens mobil eller tappas nätet tar kompisen över inom några sekunder, och en väckt gammal ledare lägger sig automatiskt – aldrig två som kör var sin värld.
- Vid ledarbyte fortsätter samma kunder sitta kvar, och nya kunder krockar aldrig med de gamla.

## [0.26.1] – 2026-09-28 – Bjud in att jobba ihop
- NYTT: BJUD IN en kompis att jobba ihop! Stå på passet i Burgarbaren, öppna 👥-knappen och tryck "💼 Jobba ihop" vid kompisens namn.
- Kompisen får en inbjudan var hen än är i staden – ett tryck på "Häng med!" och hen står i dinern bredvid dig, redo att dela disken.
- Öppettider och ork gäller som vanligt, men introdialogen hoppas över – ni har ju redan bestämt er.

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
