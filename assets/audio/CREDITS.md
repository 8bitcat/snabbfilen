# Ljudfiler i Snabbfilen – källor och licenser

Alla inspelade ljudfiler i spelet är **CC0 1.0 (public domain)**:
<https://creativecommons.org/publicdomain/zero/1.0/>. Ingen erkännande krävs, men upphovspersonerna
nämns här ändå – tack!

Licensen är belagd på varje källsida (fältet *License(s): CC0* med länk till CC0 1.0), kontrollerad
2026-09-28 och igen 2026-09-29. De två JRPG-paketen har dessutom en INFO.txt i zip-filen där
kompositören själv skriver: "These music tracks have been released under CC0 creative commons license."

Att varje fil i spelet verkligen är den låt som står nedan är också belagt: ett 8 s-utdrag ur varje
spelfil söks i alla nedladdade originalfiler (`tools/out/ambiens/belagg_musik.py`, resultat i
`belagg_musik.json`). Rätt original ger korrelation 0,96–0,999, näst bästa låt högst 0,27.

Allt annat ljud – ambiensen (trafik, park, kanalen, väder, butiker, dinern, caféet …), röster,
djurläten och effektljud – syntas i webbläsaren (js/core/ambience.js, js/core/voices.js,
js/core/sound.js). Där finns inga ljudfiler och inget att licensiera.

## Musik (assets/audio/music/)

Alla loopar är omgjorda för spelet: sömlös loop (0,5 s periodisk förrulle/efterrulle, se
js/core/music.js), ljudstyrkan normaliserad till −18 LUFS, MP3 56–64 kbit/s. Byggskript:
`tools/out/ambiens/build_music.py` (sex låtar) och `tools/out/ambiens/build_music2.py` (butik, jukebox,
centrum med lagad skarv).

| Fil | Används | Låt | Upphovsperson | Källa | Licens |
|---|---|---|---|---|---|
| centrum.mp3 | staden: centrum | "Town3 – Sunshine Coast" ur *JRPG Music Pack #2 [Towns]* | Juhani Junkala (uppladdad av SubspaceAudio) | <https://opengameart.org/content/jrpg-pack-2-towns> | CC0 |
| soder.mp3 | staden: Söder | "Town1 – Home Town" ur *JRPG Music Pack #2 [Towns]* | Juhani Junkala (SubspaceAudio) | <https://opengameart.org/content/jrpg-pack-2-towns> | CC0 |
| parken.mp3 | staden: parken, djuraffären | "Calm3 – Peaceful Days" ur *JRPG Music Pack #4 [Calm]* | Juhani Junkala (SubspaceAudio) | <https://opengameart.org/content/jrpg-pack-4-calm> | CC0 |
| natt.mp3 | staden på natten | "Calm6 – Innocence" ur *JRPG Music Pack #4 [Calm]* | Juhani Junkala (SubspaceAudio) | <https://opengameart.org/content/jrpg-pack-4-calm> | CC0 |
| hemma.mp3 | hemma | "Calm1 – A Place I Call Home" ur *JRPG Music Pack #4 [Calm]* | Juhani Junkala (SubspaceAudio) | <https://opengameart.org/content/jrpg-pack-4-calm> | CC0 |
| fororten.mp3 | staden: förorten | "Cue" ur *lofi Compilation* | TAD | <https://opengameart.org/content/lofi-compilation> | CC0 |
| kafe.mp3 | caféet | "Cat caffe" ur *lofi Compilation* | TAD | <https://opengameart.org/content/lofi-compilation> | CC0 |
| klader.mp3 | klädaffären, bostadsbyrån | "Florist" ur *lofi Compilation* | TAD | <https://opengameart.org/content/lofi-compilation> | CC0 |
| butik.mp3 | stormarknaden, närbutiken, möbelvaruhuset | "Buy Something! (Radio Edit)" ur *Shop Theme* | Cleyton Kauffman (<https://soundcloud.com/cleytonkauffman>) | <https://opengameart.org/content/shop-theme> | CC0 |
| jukebox.mp3 | Burgarbarens jukebox | "Catchy Swing" | Doge (ledog, <https://ledog.itch.io/tunnel-trouble>) | <https://opengameart.org/content/catchy-swing> | CC0 |

Totalt ≈ 5,3 MB (gränsen är 8 MB).

### Obs: TAD:s lofi-låtar och YouTube Content ID

fororten.mp3 ("Cue"), kafe.mp3 ("Cat caffe") och klader.mp3 ("Florist") är CC0 enligt källsidan. TAD
skriver där själv (2021-10-26): "the looped sound in the music is provided by Apple's GarageBand".
Andra artister har använt samma Apple-loopar, och i kommentarerna på källsidan (kontrollerad
2026-09-29) berättar Gomi Tan (2021), frosty ham (2023) och xhunterko (2024) om **felaktiga**
YouTube Content ID-anspråk på andra låtar ur samma paket ("Morning Rain", "A cup of tea", "A Cup Of
Coffee"). Spelet påverkas inte – låtarna är CC0 och Apple-looparna får användas i egen musik – men en
inspelad spelvideo på YouTube kan få ett sådant anspråk. Det går att bestrida. Annars kan man byta de
tre låtarna mot Junkala-låtar ur JRPG-paketen ovan innan man lägger upp en video.

## Nedladdade originalfiler

| Källfil | Från |
|---|---|
| JRPG Music Pack #2 [Towns] by Juhani Junkala.zip | <https://opengameart.org/sites/default/files/JRPG%20Music%20Pack%20%232%20%5BTowns%5D%20by%20Juhani%20Junkala.zip> |
| JRPG Music Pack #4 [Calm] by Juhani Junkala_0.zip | <https://opengameart.org/sites/default/files/JRPG%20Music%20Pack%20%234%20%5BCalm%5D%20by%20Juhani%20Junkala_0.zip> |
| Cue_0.mp3, Cat caffe_0.mp3, Florist_0.mp3 | <https://opengameart.org/content/lofi-compilation> (filerna på sidan) |
| shop_theme.zip | <https://opengameart.org/sites/default/files/shop_theme.zip> |
| catchyswing.ogg | <https://opengameart.org/sites/default/files/catchyswing.ogg> |
