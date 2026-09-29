# Ljudbäddar (assets/audio/rec/baddar/) – källor och licenser

Alla filer här är gjorda av **riktiga inspelningar** från [Freesound](https://freesound.org) med licensen
**CC0 1.0 (public domain)** – <https://creativecommons.org/publicdomain/zero/1.0/>. Licensen är belagd på
varje ljuds egen sida (rutan *License*: "Creative Commons 0", länk till publicdomain/zero/1.0) och
kontrollerad när filen hämtades. Inget erkännande krävs, men upphovspersonerna nämns ändå – tack!

Bearbetning: utdrag ur förhandslyssningen i HQ (samma CC0-ljud), mono 44,1 kHz, filtrerat (högpass mot
muller, ibland lågpass för avstånd), flera källor mixade där det står flera. Looparna är sömlösa
(korstoning av slutet in i början, 2–2,5 s) och har samma format som musiken: `[sista 0,5 s][loopen][första 0,5 s]`,
spelas mellan `loopStart` = `pad` (0,5 s) och `loopEnd` = `pad` + `loopSek` (se manifest-baddar.json; `fil` är
sökvägen från repots rot, toppnivån heter `topp_dbtp` – samma fält som i manifest-effekter/-djur). Ljudstyrka:
bäddar ≈ −23 LUFS, engångsljud ≈ −16 LUFS, true peak ≤ −1 dBTP. MP3 (LAME) 96 kbit/s mono för loopar,
112 kbit/s för engångsljud. Byggskript: `tools/out/riktiga-ljud/baddar/` (recipes.py, build.py, verify.py).

Omgjort efter granskning (2026-09-29): **sno** (den gamla mixen 845502 + 719961 lät som regn/åska – nu mjuk
vintervind i skog ur 352436 + 259968 + 454365, högpassad utan muller) och **flygplats** (den gamla basen 482090
hade röster/utrop – nu gate-hallen i Riga 363759, två röstfria avsnitt, 34–54 s och 60–81,5 s).

| Fil | Namn | Loop | Sek | Källa (ljudsida) | Upphovsperson | Originaltitel | Licens |
|---|---|---|---|---|---|---|---|
| assets/audio/rec/baddar/stad-trafik.mp3 | Stadstrafik | ja | 26,9 | <https://freesound.org/people/nickpursehouse/sounds/110310/> | nickpursehouse | Traffic medium city dry road xy 90 degrees recording.wav | CC0 |
| assets/audio/rec/baddar/stad-buss.mp3 | Buss bromsar och pyser | nej | 6,4 | <https://freesound.org/people/kyles/sounds/454420/> | kyles | bus coach ext pull up brake air release idle.wav | CC0 |
| assets/audio/rec/baddar/park.mp3 | Parken | ja | 25,0 | <https://freesound.org/people/Mafon2/sounds/274175/> | Mafon2 | Park ambience - mostly birds | CC0 |
| ″ |  |  |  | <https://freesound.org/people/blaukreuz/sounds/397899/> | blaukreuz | 170717_Stockholm_Aspuddsparken_F.wav | CC0 |
| assets/audio/rec/baddar/kanal.mp3 | Kanalen | ja | 21,9 | <https://freesound.org/people/ceich93/sounds/318064/> | ceich93 | Water_Lapping_River.wav | CC0 |
| ″ |  |  |  | <https://freesound.org/people/bruno.auzet/sounds/838025/> | bruno.auzet | bubble lapping  wave on concrete pier | CC0 |
| assets/audio/rec/baddar/masar.mp3 | Måsar | nej | 7,4 | <https://freesound.org/people/Lydmakeren/sounds/510917/> | Lydmakeren | Seagulls_short.wav | CC0 |
| assets/audio/rec/baddar/masar-2.mp3 | Måsflock | nej | 4,2 | <https://freesound.org/people/Soojay/sounds/462462/> | Soojay | Seagulls / gaviotas clean wildtrack.WAV | CC0 |
| assets/audio/rec/baddar/batmotor.mp3 | Båtmotor | nej | 17,0 | <https://freesound.org/people/kyles/sounds/637743/> | kyles | outboard motor boat idle or slow rattly4 pass slow left to right recorded from shore.flac | CC0 |
| assets/audio/rec/baddar/regn.mp3 | Regn | ja | 21,7 | <https://freesound.org/people/BonnyOrbit/sounds/380651/> | BonnyOrbit | Light rain on street.wav | CC0 |
| assets/audio/rec/baddar/regn-hart.mp3 | Ösregn | ja | 20,9 | <https://freesound.org/people/Walter_Odington/sounds/26220/> | Walter_Odington | heavey rain.wav | CC0 |
| assets/audio/rec/baddar/blast.mp3 | Blåst | ja | 23,5 | <https://freesound.org/people/BudJillett/sounds/109485/> | BudJillett | Wind-Gusts-late-autumn.wav | CC0 |
| assets/audio/rec/baddar/blast-hav.mp3 | Blåst vid vattnet | ja | 20,3 | <https://freesound.org/people/Irmsch/sounds/750575/> | Irmsch | AMBIENCE_BalticSea_autumn_strongWind_distantWaves_IrmH23 | CC0 |
| ″ |  |  |  | <https://freesound.org/people/bruno.auzet/sounds/706471/> | bruno.auzet | strong wind on coastal path.wav | CC0 |
| assets/audio/rec/baddar/sno.mp3 | Snö | ja | 20,0 | <https://freesound.org/people/Kinoton/sounds/352436/> | Kinoton | Forest, Winter, Light Wind | CC0 |
| ″ |  |  |  | <https://freesound.org/people/lwdickens/sounds/259968/> | lwdickens | windy winter day, wind in trees, from distance.wav | CC0 |
| ″ |  |  |  | <https://freesound.org/people/kyles/sounds/454365/> | kyles | wind medium gusty cold winter wind swirly blustery.flac | CC0 |
| assets/audio/rec/baddar/natt.mp3 | Natt | ja | 21,8 | <https://freesound.org/people/hdfreema/sounds/333221/> | hdfreema | Night Crickets Back Porch.aiff | CC0 |
| assets/audio/rec/baddar/diner.mp3 | Burgarbaren | ja | 27,9 | <https://freesound.org/people/cognito%20perceptu/sounds/162662/> | cognito perceptu | restaurant kitchen.wav | CC0 |
| ″ |  |  |  | <https://freesound.org/people/edlundart/sounds/501025/> | edlundart | NYC-diner-ambiance-ambience-by-EDLUNDART.wav | CC0 |
| ″ |  |  |  | <https://freesound.org/people/Audeption/sounds/455653/> | Audeption | deep-fryer_sizzle.wav | CC0 |
| ″ |  |  |  | <https://freesound.org/people/Urkki69/sounds/587177/> | Urkki69 | Sizzling Steaks on a Gas Grill | CC0 |
| assets/audio/rec/baddar/cafe.mp3 | Caféet | ja | 26,1 | <https://freesound.org/people/moxobna/sounds/46310/> | moxobna | 0105coffeehouse.wav | CC0 |
| ″ |  |  |  | <https://freesound.org/people/AwenAudio/sounds/403066/> | AwenAudio | MS-STEREO Coffee Shop, 6 People, low chatter, refrigerator,  barista making milk shake, customers entering 3.WAV | CC0 |
| ″ |  |  |  | <https://freesound.org/people/BageBoy/sounds/402845/> | BageBoy | Espresso Machine (Automatic) | CC0 |
| assets/audio/rec/baddar/fritos.mp3 | Fritös | ja | 20,0 | <https://freesound.org/people/Audeption/sounds/455653/> | Audeption | deep-fryer_sizzle.wav | CC0 |
| assets/audio/rec/baddar/fritos-ner.mp3 | Korgen ner i fritösen | nej | 7,5 | <https://freesound.org/people/ursenfuns/sounds/440587/> | ursenfuns | deep fryer | CC0 |
| assets/audio/rec/baddar/espresso.mp3 | Espressomaskin | nej | 7,4 | <https://freesound.org/people/BageBoy/sounds/402845/> | BageBoy | Espresso Machine (Automatic) | CC0 |
| assets/audio/rec/baddar/stormarknad.mp3 | Stormarknaden | ja | 26,7 | <https://freesound.org/people/Soundkrampf/sounds/237331/> | Soundkrampf | Supermarket | CC0 |
| ″ |  |  |  | <https://freesound.org/people/SpliceSound/sounds/218312/> | SpliceSound | Grocery store freezer section.wav | CC0 |
| ″ |  |  |  | <https://freesound.org/people/BonnyOrbit/sounds/645856/> | BonnyOrbit | Supermarket.wav | CC0 |
| ″ |  |  |  | <https://freesound.org/people/Sonicorchestra/sounds/434885/> | Sonicorchestra | Shopping Cart 01.wav | CC0 |
| ″ |  |  |  | <https://freesound.org/people/Soundscape_Leuphana/sounds/210093/> | Soundscape_Leuphana | 20131119_Beeping at a cash desk_ZoomH6YX.wav | CC0 |
| assets/audio/rec/baddar/butik.mp3 | Närbutiken | ja | 20,9 | <https://freesound.org/people/jakobhandersen/sounds/133827/> | jakobhandersen | Refrigerator.wav | CC0 |
| ″ |  |  |  | <https://freesound.org/people/SpliceSound/sounds/338115/> | SpliceSound | Residential kitchen roomtone, refrigerator fridge hum.wav | CC0 |
| ″ |  |  |  | <https://freesound.org/people/775noise/sounds/494565/> | 775noise | Shop door bell.wav | CC0 |
| assets/audio/rec/baddar/hemma.mp3 | Hemma | ja | 22,0 | <https://freesound.org/people/giddster/sounds/434841/> | giddster | Kitchen Wall Clock Ticking 2 | CC0 |
| ″ |  |  |  | <https://freesound.org/people/SpliceSound/sounds/338115/> | SpliceSound | Residential kitchen roomtone, refrigerator fridge hum.wav | CC0 |
| assets/audio/rec/baddar/flygplats.mp3 | Flygplatsen | ja | 23,0 | <https://freesound.org/people/gladkiy/sounds/363759/> | gladkiy | Riga International Airport, departure gate C4 XY 23.02.16.wav | CC0 |
| ″ |  |  |  | <https://freesound.org/people/melliug/sounds/816010/> | melliug | Call Signal Announ | CC0 |
| ″ |  |  |  | <https://freesound.org/people/schaft/sounds/275171/> | schaft | Luggage_rolling2.wav | CC0 |
| assets/audio/rec/baddar/verkstad.mp3 | Bilverkstaden | ja | 25,6 | <https://freesound.org/people/felix.blume/sounds/667765/> | felix.blume | Workshop ambiance inside with a closed door, subtle road hum from outside, motor machine far away, birds singing outside, recorded in Missouri | CC0 |
| ″ |  |  |  | <https://freesound.org/people/sevenbsb/sounds/349398/> | sevenbsb | Air Impact Wrench | CC0 |
| ″ |  |  |  | <https://freesound.org/people/CapsLok/sounds/181634/> | CapsLok | Tools Ratchet.wav | CC0 |
| ″ |  |  |  | <https://freesound.org/people/Bibow/sounds/426848/> | Bibow | 34 Wrench on concrete floor, indoor, 5 impacts.wav | CC0 |
| ″ |  |  |  | <https://freesound.org/people/Flares.fr/sounds/524263/> | Flares.fr | Air compressor powering ON and OFF | CC0 |

Totalt 23 filer, 5,62 MB.
