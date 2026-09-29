# Riktiga ljud – effekter och röster (assets/audio/rec/effekter, assets/audio/rec/roster)

Alla filer här är **riktiga inspelningar** (inga syntar, inga samplingsbibliotek) och licensen är **CC0 1.0 (public domain)**:
<https://creativecommons.org/publicdomain/zero/1.0/>. Erkännande krävs inte, men upphovspersonerna nämns ändå – tack!

Licensen är kontrollerad på varje ljuds egen sida 2026-09-29: på Freesound rutan *License* = "Creative Commons 0"
(länk till publicdomain/zero/1.0), på Kenney.nl packens sida "License: Creative Commons CC0" (och License.txt i zip-filen).
Dessutom är varje Freesound-källas **beskrivning** genomläst efter tecken på att ljudet är gjort av andras ljud
("remix", "uses:", "made from … on this site", länkar till andra ljud): sådana källor är bortvalda, eftersom en
uppladdare inte kan göra om någon annans CC-BY-ljud till CC0. Från Freesound används förhandslyssningens HQ-MP3
(samma CC0-ljud).

Bearbetning (skript i `tools/out/riktiga-ljud/effekter/`): klippt, mono 44,1 kHz, korta fades (in 4–20 ms, ut 30–350 ms),
ljudstyrka ca −16 LUFS (effekter/röster) och ca −23 LUFS (sorl-bäddar), true peak högst −1 dBTP, MP3 (LAME).
Filer med skarpa toppar (slag, klick, klockor, vissa röster) når inte målnivån utan att true peak går över −1 dBTP; de är
toppbegränsade högst 6 dB och ligger lägre. **Sätt volymen i spelet efter fältet `lufs` i manifestet**, inte efter
antagandet att allt ligger på −16. Följande ligger mer än 0,5 dB under målet (LUFS): `click` (−22,0), `ok` (−17,5), `coin` (−16,8), `box` (−19,7), `knock` (−21,8), `door` (−22,7), `kassa` (−17,9), `door-pingla` (−17,8), `man-vanlig-1` (−17,3), `aldre-sur-1` (−18,2).
Sorl-bäddarna loopar sömlöst (övertoning av slutet in i början).

Röster: spelets "simspråk" ska inte innehålla förståeliga ord. Källorna är inspelat nonsensprat ("gibberish"),
småbarnsbabbel, mummel och ordlösa läten (hm?, fnitter, skratt, suckar, muttrande). Varje färdig röstfil och sorl-bädd är
kontrollerad med taligenkänning (Whisper small; automatiskt språk, engelska och svenska – `ordkoll.py`, resultat i
`ordkoll_roster.json` och fönstervis i `ordkoll_sammanfattning.json`; de utbytta filerna i `ordkoll_fix.json` och
`ordkoll_bitar_fix.json`): inga meningar eller återkommande riktiga ord känns igen, bara ljudord som "hm", "ha ha", "oh"
och enstaka korta stavelser som liknar ord. Källor och fraser där taligenkänningen hittade riktiga ord (t.ex. "yeah!",
"this way", "nej nej", engelska meningar) är bortvalda.

Extra effekter utöver spelets id:n: `kassa` (kassaapparat), `door-pingla` (butiksdörr med pingla), `morning-tupp` (tupp),
`fanfare-lang` (hela trumpetfanfaren, ca 3 s).
Röstfilerna heter `<röst>-<humör>-<n>.mp3` (röst: man, kvinna, barn, aldre; humör: vanlig, fraga, glad, sur, arg).
Sorl-bäddarna har samma loopformat som musiken: filen = [sista 0,5 s][loopen][första 0,5 s] – spela loopStart = 0,5 och
loopEnd = 0,5 + `loopSek` (fältet i manifestet).
Saknas (spelet behåller det syntade babblet där): barn-sur, barn-arg, aldre-glad, aldre-arg. man-glad har bara ett skratt,
och barn-glad är bara skratt (inget glatt babbel).

## Rättat efter granskning 2026-09-29

| Fil | Tidigare källa | Problem | Nu |
|---|---|---|---|
| effekter/kassa.mp3 | Zott820 209578 "Cash Register Purchase" | remix som enligt sin egen beskrivning innehåller UncleSigmund 36328 "coinbank" (CC-BY 4.0) – inte ren CC0 | CapsLok 184438 "Cash Register Fake.wav" – remixens CC0-original, upphovspersonens egna inspelningar (AKG C214) |
| effekter/fel.mp3 | hypocore 164089 "buzzer2.wav" | bearbetning av en dörrsummer "on this site" vars ursprung och licens inte går att belägga | Naïma 510026 "buzzer sportif.wav" – domarsummer inspelad av uppladdaren (Tascam DR-44WL) under en match |
| effekter/fanfare.mp3 | plasterbrain 397355 "Tada Fanfare A" | gjord med samplingsbibliotek (Bravura Scoring Brass/Kontakt), ingen inspelning | joepayne 413201 "Clean Trumpet Fanfare" – riktig trumpet inspelad med Rode NT2 (slutet av fanfaren; hela finns som `fanfare-lang`) |
| roster/barn-glad-1.mp3 | FunWithSound 416667 "Baby Gibberish 32 (Excited)" | kunde höras som engelskans "this way, this way" | FunWithSound 416702 "Baby Laugh.wav" – samma pojke som i babblet, skratt |
| roster/man-sur-2.mp3 | dynamique 536967 (6,10–8,52 s) | kunde höras som "nej, nej" / "oh no" | Mickael_Leroi 402126 "exasperation_1.wav" – ordlös suck (Zoom H6) |
| roster/man-sur-3.mp3 (ny) | – | – | kanyonwyvern 697497 "hmm.wav" – ogillande "hmm" |
| roster/barn-glad-4.mp3 (ny) | – | – | medyk3D 616088 "Child's laugh 1" – barnskratt |

## Filer

| Fil | Namn | Längd | Används till | Originaltitel | Upphovsperson | Källa | Licens |
|---|---|---|---|---|---|---|---|
| effekter/click.mp3 | Klick | 0.2 s | Knappar och menyer, plocka/lägga ner saker i jobben – ett kort mekaniskt klick från en riktig strömbrytare. | "UI Audio – switch2.ogg" | Kenney (Kenney Vleugels, kenney.nl) | <https://kenney.nl/assets/ui-audio> | CC0 |
| effekter/ok.mp3 | Rätt (pling) | 0.6 s | Rätt i ett jobb, t.ex. när man plockar upp rätt sak – ett kort metalliskt pling (eldgaffel mot metall, låter som en liten klocka). | "ding.wav" | Daphne_in_Wonderland | <https://freesound.org/people/Daphne_in_Wonderland/sounds/127149/> | CC0 |
| effekter/fel.mp3 | Fel (summer) | 0.6 s | Fel i ett jobb (fel frukt, fel dryck, fel vagn) – en kort signal från en riktig domarsummer (inspelad i en idrottshall under en volleybollmatch). | "buzzer sportif.wav" | Naïma | <https://freesound.org/people/Na%C3%AFma/sounds/510026/> | CC0 |
| effekter/miss.mp3 | Suck | 0.8 s | En kund gick / missade – en uppgiven suck (kvinna, inga ord). | "woman sigh" | threadzz | <https://freesound.org/people/threadzz/sounds/384992/> | CC0 |
| effekter/coin.mp3 | Mynt | 0.4 s | Pengar in – när en kund betalar eller en leverans blir rätt: mynt som klirrar i handen. | "coins 05.wav" | Anthousai | <https://freesound.org/people/Anthousai/sounds/336571/> | CC0 |
| effekter/box.mp3 | Serveringsklocka | 1.2 s | Order klar – ett slag på en serveringsklocka (disk-klocka) på disken. | "Ringing bell - happy.wav" | domrodrig | <https://freesound.org/people/domrodrig/sounds/116779/> | CC0 |
| effekter/buy.mp3 | Kassapip | 0.3 s | Köp i butik/kassa – streckkodsläsarens pip. | "scanner beep.wav" | kalisemorrison | <https://freesound.org/people/kalisemorrison/sounds/202530/> | CC0 |
| effekter/sleep.mp3 | Gäspning | 1.6 s | Somna / gå och lägga sig – en trött gäspning. | "yawn.wav" | Illud | <https://freesound.org/people/Illud/sounds/494691/> | CC0 |
| effekter/morning.mp3 | Väckarklocka | 2.0 s | Vakna på morgonen – en gammaldags väckarklocka med klocka som ringer (kortad). | "alarm_clock.wav" | xyzr_kx | <https://freesound.org/people/xyzr_kx/sounds/14262/> | CC0 |
| effekter/fanfare.mp3 | Fanfar | 1.8 s | Befordran – en riktig trumpet (inspelad) som spelar slutet av en fanfar: ta-ta-ta-taaa uppåt till en lång ton. | "Clean Trumpet Fanfare .mp3" | joepayne | <https://freesound.org/people/joepayne/sounds/413201/> | CC0 |
| effekter/knock.mp3 | Knackning | 0.6 s | Knack på dörr (också portafiltret i caféet och extraborden i Burgarbaren) – tre knackningar på en trädörr. | "Knocking on Wood Door (1)" | Flem0527 | <https://freesound.org/people/Flem0527/sounds/629987/> | CC0 |
| effekter/door.mp3 | Dörr | 1.2 s | En dörr som öppnas – kund kommer in (bensinmacken) och in/ut genom dörrar. | "Front Door, Opening.wav" | LilMati | <https://freesound.org/people/LilMati/sounds/704609/> | CC0 |
| effekter/honk.mp3 | Biltuta | 0.6 s | Biltuta – otålig bilist vid bensinmacken och trafiken i staden. Två korta tut. | "Car Honking" | MicktheMicGuy | <https://freesound.org/people/MicktheMicGuy/sounds/434878/> | CC0 |
| effekter/slide.mp3 | Svisch | 0.4 s | Dra och släppa / lägga tillbaka något – ett kort svisch (bambupinne genom luften). | "Whoosh #1" | Kinoton | <https://freesound.org/people/Kinoton/sounds/427823/> | CC0 |
| effekter/chirp.mp3 | Fågelpip | 0.3 s | Fågelpip – när en kund kommer fram i caféet/köket och som liten notis. En kort fågelkvittring (näktergal). | "Bird, Thrush Nightingale 01.wav" | LilMati | <https://freesound.org/people/LilMati/sounds/365658/> | CC0 |
| effekter/kassa.mp3 | Kassaapparat | 1.4 s | EXTRA: kassaapparat "ka-ching" – ihopsatt av upphovspersonen av riktiga inspelningar (skrivarlucka som öppnas och stängs, skakad låda, spärrhake och en liten klocka); alternativ till coin/buy vid större köp eller dagens lön. | "Cash Register Fake.wav" | CapsLok | <https://freesound.org/people/CapsLok/sounds/184438/> | CC0 |
| effekter/door-pingla.mp3 | Butiksdörr med pingla | 1.6 s | EXTRA: pinglan ovanför en butiksdörr – när man/kunder går in i en butik (närbutiken, bensinmackens butik, caféet). | "Shop door bell.wav" | 775noise | <https://freesound.org/people/775noise/sounds/494565/> | CC0 |
| effekter/morning-tupp.mp3 | Tupp | 1.7 s | EXTRA: en tupp som gal – alternativ till väckarklockan (t.ex. helg/landet). | "Rooster Crow 1" | BenjaminNelan | <https://freesound.org/people/BenjaminNelan/sounds/435508/> | CC0 |
| effekter/fanfare-lang.mp3 | Fanfar (hela) | 3.2 s | EXTRA: hela trumpetfanfaren (inspelad trumpet, ca 3 s) – alternativ till fanfare vid stora händelser (t.ex. högsta befordran, gala). | "Clean Trumpet Fanfare .mp3" | joepayne | <https://freesound.org/people/joepayne/sounds/413201/> | CC0 |
| roster/man-vanlig-1.mp3 | Man – vanlig | 1.6 s | Simspråk, man: vanligt prat. Man som pratar nonsens (påhittade ord). | "jibberish 1.wav" | jcpartri | <https://freesound.org/people/jcpartri/sounds/396456/> | CC0 |
| roster/man-vanlig-2.mp3 | Man – vanlig | 2.9 s | Simspråk, man: vanligt prat. Man med mörk röst som mumlar otydligt. | "Indistinct deep male mumble" | dynamique | <https://freesound.org/people/dynamique/sounds/536967/> | CC0 |
| roster/man-fraga-1.mp3 | Man – fråga | 1.0 s | Simspråk, man: fråga (stigande ton, "hm?"). Man: "hm?" med stigande ton. | "hmmm question.wav" | esperar | <https://freesound.org/people/esperar/sounds/170776/> | CC0 |
| roster/man-fraga-2.mp3 | Man – fråga | 0.8 s | Simspråk, man: fråga (stigande ton, "hm?"). Man: "hm?" med stigande ton. | "hmmm question.wav" | esperar | <https://freesound.org/people/esperar/sounds/170776/> | CC0 |
| roster/man-fraga-3.mp3 | Man – fråga | 1.4 s | Simspråk, man: fråga (stigande ton, "hm?"). Man: "hm?" med stigande ton. | "hmmm question.wav" | esperar | <https://freesound.org/people/esperar/sounds/170776/> | CC0 |
| roster/man-fraga-4.mp3 | Man – fråga | 0.8 s | Simspråk, man: fråga (stigande ton, "hm?"). Man: "hmm?" | "OneHmm-question.wav" | esperar | <https://freesound.org/people/esperar/sounds/170779/> | CC0 |
| roster/man-glad-1.mp3 | Man – glad | 2.3 s | Simspråk, man: glad (skratt/fnitter/glatt babbel). Man som skrattar hjärtligt. | "Wholesome Genuine Laugh (male)" | JotrainG | <https://freesound.org/people/JotrainG/sounds/720133/> | CC0 |
| roster/man-sur-1.mp3 | Man – sur | 2.8 s | Simspråk, man: sur/missnöjd (muttrande, grymtande). Man som muttrar otydligt med mörk röst. | "Indistinct deep male mumble" | dynamique | <https://freesound.org/people/dynamique/sounds/536967/> | CC0 |
| roster/man-sur-2.mp3 | Man – sur | 2.2 s | Simspråk, man: sur/missnöjd (muttrande, grymtande). Man som suckar uppgivet/irriterat (ordlöst). | "exasperation_1.wav" | Mickael_Leroi | <https://freesound.org/people/Mickael_Leroi/sounds/402126/> | CC0 |
| roster/man-sur-3.mp3 | Man – sur | 0.7 s | Simspråk, man: sur/missnöjd (muttrande, grymtande). Man: ogillande "hmm" med fallande ton. | "hmm.wav" | kanyonwyvern | <https://freesound.org/people/kanyonwyvern/sounds/697497/> | CC0 |
| roster/man-arg-1.mp3 | Man – arg | 2.0 s | Simspråk, man: arg (upprört babbel). Arg man som skäller på nonsensspråk. | "Mad Husband" | vikuserro | <https://freesound.org/people/vikuserro/sounds/613987/> | CC0 |
| roster/man-arg-2.mp3 | Man – arg | 1.3 s | Simspråk, man: arg (upprört babbel). Arg man som skäller på nonsensspråk. | "Mad Husband" | vikuserro | <https://freesound.org/people/vikuserro/sounds/613987/> | CC0 |
| roster/kvinna-vanlig-1.mp3 | Kvinna – vanlig | 2.1 s | Simspråk, kvinna: vanligt prat. Kvinna som pratar nonsens (påhittat språk). | "Female Gibberish" | cloyen | <https://freesound.org/people/cloyen/sounds/800349/> | CC0 |
| roster/kvinna-vanlig-2.mp3 | Kvinna – vanlig | 1.8 s | Simspråk, kvinna: vanligt prat. Kvinna som pratar nonsens (påhittat språk). | "Female Gibberish" | cloyen | <https://freesound.org/people/cloyen/sounds/800349/> | CC0 |
| roster/kvinna-vanlig-3.mp3 | Kvinna – vanlig | 1.5 s | Simspråk, kvinna: vanligt prat. Kvinna som pratar nonsens (påhittat språk). | "Female Gibberish" | cloyen | <https://freesound.org/people/cloyen/sounds/800349/> | CC0 |
| roster/kvinna-fraga-1.mp3 | Kvinna – fråga | 0.7 s | Simspråk, kvinna: fråga (stigande ton, "hm?"). Ung kvinna: "hm?" | "Hmm question.wav" | esperar | <https://freesound.org/people/esperar/sounds/170768/> | CC0 |
| roster/kvinna-fraga-2.mp3 | Kvinna – fråga | 0.8 s | Simspråk, kvinna: fråga (stigande ton, "hm?"). Ung kvinna: "hm?" med stigande ton. | "Hmms various 1.wav" | esperar | <https://freesound.org/people/esperar/sounds/170767/> | CC0 |
| roster/kvinna-glad-1.mp3 | Kvinna – glad | 0.4 s | Simspråk, kvinna: glad (skratt/fnitter/glatt babbel). Kvinna som fnittrar. | "giggle10.wav" | Reitanna | <https://freesound.org/people/Reitanna/sounds/343984/> | CC0 |
| roster/kvinna-glad-2.mp3 | Kvinna – glad | 0.8 s | Simspråk, kvinna: glad (skratt/fnitter/glatt babbel). Kvinna som fnittrar. | "giggle8.wav" | Reitanna | <https://freesound.org/people/Reitanna/sounds/343991/> | CC0 |
| roster/kvinna-glad-3.mp3 | Kvinna – glad | 0.8 s | Simspråk, kvinna: glad (skratt/fnitter/glatt babbel). Kvinna som skrattar till. | "short - female - laugh - chuckle - giggle -  AIFF 24 bits" | amoyssiadis | <https://freesound.org/people/amoyssiadis/sounds/397673/> | CC0 |
| roster/kvinna-glad-4.mp3 | Kvinna – glad | 1.0 s | Simspråk, kvinna: glad (skratt/fnitter/glatt babbel). Kvinna: kort "ha ha ha". | "Female laugh (short).aif" | thedialogueproject | <https://freesound.org/people/thedialogueproject/sounds/565973/> | CC0 |
| roster/kvinna-sur-1.mp3 | Kvinna – sur | 1.7 s | Simspråk, kvinna: sur/missnöjd (muttrande, grymtande). Kvinna som suckar irriterat. | "Woman Exasperated Sigh, Breathe Out" | monsterthing | <https://freesound.org/people/monsterthing/sounds/663651/> | CC0 |
| roster/kvinna-sur-2.mp3 | Kvinna – sur | 0.8 s | Simspråk, kvinna: sur/missnöjd (muttrande, grymtande). Kvinna, frustrerat nonsensmummel. | "strained gibberish.wav" | Reitanna | <https://freesound.org/people/Reitanna/sounds/343977/> | CC0 |
| roster/kvinna-arg-1.mp3 | Kvinna – arg | 1.3 s | Simspråk, kvinna: arg (upprört babbel). Kvinna: argt "uuugh!". | "angry UUUGH!.wav" | Reitanna | <https://freesound.org/people/Reitanna/sounds/241560/> | CC0 |
| roster/kvinna-arg-2.mp3 | Kvinna – arg | 0.8 s | Simspråk, kvinna: arg (upprört babbel). Kvinna: argt "aurgh!". | "aurgh!.wav" | Reitanna | <https://freesound.org/people/Reitanna/sounds/241559/> | CC0 |
| roster/barn-vanlig-1.mp3 | Barn – vanlig | 1.1 s | Simspråk, barn: vanligt prat. Litet barn som babblar (inga riktiga ord). | "Baby Gibberish 13.wav" | FunWithSound | <https://freesound.org/people/FunWithSound/sounds/416666/> | CC0 |
| roster/barn-vanlig-2.mp3 | Barn – vanlig | 1.6 s | Simspråk, barn: vanligt prat. Litet barn som babblar (inga riktiga ord). | "Baby Gibberish 31.wav" | FunWithSound | <https://freesound.org/people/FunWithSound/sounds/416668/> | CC0 |
| roster/barn-vanlig-3.mp3 | Barn – vanlig | 1.7 s | Simspråk, barn: vanligt prat. Litet barn som babblar (inga riktiga ord). | "Baby Gibberish 30.wav" | FunWithSound | <https://freesound.org/people/FunWithSound/sounds/416675/> | CC0 |
| roster/barn-vanlig-4.mp3 | Barn – vanlig | 2.2 s | Simspråk, barn: vanligt prat. Litet barn som babblar (inga riktiga ord). | "Baby Gibberish 29.wav" | FunWithSound | <https://freesound.org/people/FunWithSound/sounds/416673/> | CC0 |
| roster/barn-fraga-1.mp3 | Barn – fråga | 1.0 s | Simspråk, barn: fråga (stigande ton, "hm?"). Litet barn, babbel med stigande slut. | "Baby Gibberish 14.wav" | FunWithSound | <https://freesound.org/people/FunWithSound/sounds/416665/> | CC0 |
| roster/barn-glad-1.mp3 | Barn – glad | 1.0 s | Simspråk, barn: glad (skratt/fnitter/glatt babbel). Litet barn (samma pojke som i babblet) som skrattar. | "Baby Laugh.wav" | FunWithSound | <https://freesound.org/people/FunWithSound/sounds/416702/> | CC0 |
| roster/barn-glad-2.mp3 | Barn – glad | 1.5 s | Simspråk, barn: glad (skratt/fnitter/glatt babbel). Liten flicka som skrattar. | "Young Female Child Laughing" | kim.headlee | <https://freesound.org/people/kim.headlee/sounds/184616/> | CC0 |
| roster/barn-glad-3.mp3 | Barn – glad | 2.5 s | Simspråk, barn: glad (skratt/fnitter/glatt babbel). Pojke som skrattar. | "Boy or Young Child Laughing" | OBXJohn | <https://freesound.org/people/OBXJohn/sounds/365632/> | CC0 |
| roster/barn-glad-4.mp3 | Barn – glad | 2.5 s | Simspråk, barn: glad (skratt/fnitter/glatt babbel). Barn som skrattar hjärtligt. | "Child's laugh 1 - medyk3D.wav" | medyk3D | <https://freesound.org/people/medyk3D/sounds/616088/> | CC0 |
| roster/aldre-vanlig-1.mp3 | Äldre – vanlig | 1.0 s | Simspråk, äldre: vanligt prat. Äldre kvinna: "mm-hm" (instämmande). | "Old Lady Onomatopeyia.wav" | cmilo1269 | <https://freesound.org/people/cmilo1269/sounds/491953/> | CC0 |
| roster/aldre-vanlig-2.mp3 | Äldre – vanlig | 1.0 s | Simspråk, äldre: vanligt prat. Äldre kvinna: "mmm". | "Old Lady Onomatopeyia.wav" | cmilo1269 | <https://freesound.org/people/cmilo1269/sounds/491956/> | CC0 |
| roster/aldre-fraga-1.mp3 | Äldre – fråga | 1.1 s | Simspråk, äldre: fråga (stigande ton, "hm?"). Äldre kvinna: förvånat "oh?". | "Old Lady Onomatopeyia.wav" | cmilo1269 | <https://freesound.org/people/cmilo1269/sounds/491957/> | CC0 |
| roster/aldre-fraga-2.mp3 | Äldre – fråga | 1.3 s | Simspråk, äldre: fråga (stigande ton, "hm?"). Äldre kvinna: förvånat "ah?". | "Old Lady Onomatopeyia.wav" | cmilo1269 | <https://freesound.org/people/cmilo1269/sounds/491955/> | CC0 |
| roster/aldre-sur-1.mp3 | Äldre – sur | 2.2 s | Simspråk, äldre: sur/missnöjd (muttrande, grymtande). Äldre man som muttrar missnöjt. | "Grumbling.wav" | Belizarius | <https://freesound.org/people/Belizarius/sounds/680092/> | CC0 |
| roster/aldre-sur-2.mp3 | Äldre – sur | 2.2 s | Simspråk, äldre: sur/missnöjd (muttrande, grymtande). Äldre man som muttrar missnöjt. | "Grumbling.wav" | Belizarius | <https://freesound.org/people/Belizarius/sounds/680092/> | CC0 |
| roster/aldre-sur-3.mp3 | Äldre – sur | 3.0 s | Simspråk, äldre: sur/missnöjd (muttrande, grymtande). Äldre man som gnäller/stönar. | "Old Men Moan.wav" | cmilo1269 | <https://freesound.org/people/cmilo1269/sounds/491944/> | CC0 |
| roster/sorl-cafe.mp3 | Sorl – café | loop, 19.0 s | Sorl från en liten grupp (män och kvinnor) som pratar i munnen på varandra, utan urskiljbara ord (inspelad "walla" på ett odefinierat språk) – caféet, dinern, restaurangerna, väntrum. Loopformat som musiken: filen = [sista 0,5 s][loopen][första 0,5 s]; spela loopStart=0.5, loopEnd=0.5+loopSek. | "Small Crowd Walla" | IENBA | <https://freesound.org/people/IENBA/sounds/653920/> | CC0 |
| roster/sorl-gata.mp3 | Sorl – gata | loop, 30.0 s | Folkmassa utomhus på en gatumarknad (Frankrike, inspelad medan man går genom marknaden), utan urskiljbara ord – torg, gågator, marknad och stationer när det är mycket folk. Loopformat som musiken: filen = [sista 0,5 s][loopen][första 0,5 s]; spela loopStart=0.5, loopEnd=0.5+loopSek. | "Street-Market-Gap-France.wav" | Astounded | <https://freesound.org/people/Astounded/sounds/483561/> | CC0 |
