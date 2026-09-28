# SNABBFILEN

**🎮 Spela direkt: https://8bitcat.github.io/snabbfilen/**

Livet i Pixelstaden — en livssimulator i pixel-2D à la *Jones in the Fast Lane*.
Du har ett rum, en garderob och en plånbok som aldrig räcker. Jobba på stadens
arbetsplatser, köp mat så du orkar, klä dig som du vill och spara till en
större bostad.

Byggt på 2D-motorn ur Pixelverkstan (procedurell pixelgrafik).
Möbelsprites: **EmanuelleDev** (emanuelledev.itch.io) — tack! 🙏 Bara de rutor
spelet använder är inbäddade (`assets/interior.png`, byggd av `tools/build-atlas.mjs`
ur de köpta arken: möbler, kök, badrum, skola, jul, kattmöbler, ljus m.m.); arken
själva ligger inte i projektet. Lilla rummets dass, lamporna och monsteran är ritade
för hand i samma stil.

## Spela

```bash
python -m http.server 8788
# öppna http://localhost:8788
```

## Spelet

Allt är gåbart med din egen figur – klicka där du vill gå. Ingenting ses från sidan.

- **Pixelstaden** i två stadsdelar: *Centrum* (hem, bostadsbyrå, mat, kläder, möbler) och *Arbetsområdet* (flygplats, fruktfabrik, burgarbar). Gå ut i kanten för att byta stadsdel.
- **Hemma:** bostäderna har flera rum – Lilla rummet (litet, sjabbigt: sprickor, spindelväv, naken glödlampa och ett uselt dass), Lägenheten (vardagsrum + sovrum) och Villan (vardagsrum, sovrum, kök) med dörrar mellan rummen. Säng, garderob, kylskåp, toalett, dusch/badkar och TV/dator fungerar – och funktionen följer möbeln vart den än står.
- **🛋️ Möblera:** köp möbler på MÖBELJÄTTEN (160 sorter i åtta avdelningar), de hamnar i förrådet. Hemma trycker du *Möblera* – plocka ur förrådet, flytta runt (allt, även startmöblerna), vrid med 🔄/R (soffor, fåtöljer och sängar har riktiga sido- och bakvyer, resten speglas), häng tavlor på väggen (bara gardiner får hänga över fönstren), måla om gratis, lägg i förrådet för att flytta till ett annat rum, sälj för halva priset. Ligger sängen i förrådet sover man på en madrass på golvet. Besökare ser din inredning.
- **Jobben** (60 sekunder = 4 timmar), med kroppen: ✈️ bär väskorna från bandet till vagnen med rätt bokstav · 🍊 plocka frukten ordersedeln vill ha och bär den till lådan · 🍔 plocka tallriken från disken och servera kunden med samma önskan i pratbubblan. Tre pass = befordran.
- **Butikerna** går man runt i: möbelvaruhuset visar alla möbler utställda med prislappar (välj färg vid köp), klädaffären har varje plagg på en mannekäng och accessoarerna på hyllan.
- **Öppen värld:** alla som spelar är i samma Pixelstad, ni ser varandra i staden och kan åka hem till varandra (👥). Emotes när någon är nära.
- **Dagshändelser, rekord, dagbok 📊** och målet: egen villa + 10 000 kr. 🏆

## Versioner och släpp

Spelet har ett versionsnummer som syns uppe till höger (tryck på det för nyheterna).
Alla versioner står i [CHANGELOG.md](CHANGELOG.md) och har en git-tagg (`git tag`), så
man kan alltid gå tillbaka: `git checkout v0.13.0`.

- **Ny funktion** höjer mittensiffran (0.14.0 → 0.15.0), **buggfix** sista siffran (0.15.0 → 0.15.1).
- **Varje sak släpps för sig** så fort den är klar och provkörd – inte i stora klumpar:
  ```bash
  node tools/release.mjs minor --title "Mataffären med korg och kassa" --scope mat --notes nyheter.md -- js/scenes/shop-mat.js
  node tools/verify.mjs                     # hela röktestet på exakt den committen, i en egen kopia
  git push origin main --follow-tags        # publicera (GitHub Pages)
  ```
  Släppskriptet tar bara med de filer man anger och stoppar om någon av dem importerar en fil
  som inte följer med.
- **Kontrollpunkter** av pågående arbete: `node tools/checkpoint.mjs "vad som pågår" --push`
  sparar allt i arbetskatalogen på grenen `wip` utan att röra `main` eller det publicerade spelet.
- Spelet säger själv till när en ny version har publicerats medan man spelar.

## Struktur

- `js/core/` — motorn från Pixelverkstan: `people.js` (pixelfigurer + kläder), `avatar.js` (redigeraren), `floor-pix.js` (pixelritning + fonter), `ui.js` (modal/toast)
- `js/game.js` — klocka, behov, ekonomi, bostäder, save/load
- `js/scenes/` — staden, hemmet (delrum + möblering), butikerna och `walkable.js` (gå-motorn alla scener delar)
- `js/jobs/` — de gåbara jobben (`jobb-flyg.js`, `jobb-frukt.js`, `jobb-burgare.js`) och `shift.js` (löneflödet)
- `js/shops/` — matbutiken och bostadsbyrån (dialoger)
- `assets/interior.png` + `js/data/frames.js` — möbelatlasen, byggs av `tools/build-atlas.mjs`
- `js/net/world.js` — den öppna världen (auto-anslutning, värd-auktoritativ, `?world=` för egen värld)
- `js/core/sound.js` — ljudeffekter som WebAudio-synt, inga ljudfiler
- `docs/SPELPLAN.md` — designen och milstolparna
- `tools/smoke.mjs` — röktest i Playwright (klickar igenom allt, tar skärmdumpar till `tools/out/`)

## Test

```bash
python -m http.server 8788   # i en terminal
node tools/smoke.mjs         # i en annan — ALLT GRÖNT = bra
```
