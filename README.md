# SNABBFILEN

**🎮 Spela direkt: https://8bitcat.github.io/snabbfilen/**

Livet i Pixelstaden — en livssimulator i pixel-2D à la *Jones in the Fast Lane*.
Du har ett rum, en garderob och en plånbok som aldrig räcker. Jobba på stadens
arbetsplatser, köp mat så du orkar, klä dig som du vill och spara till en
större bostad.

Byggt på 2D-motorn ur Pixelverkstan (procedurell pixelgrafik).
Möbelsprites: **EmanuelleDev** (emanuelledev.itch.io) — tack! 🙏

## Spela

```bash
python -m http.server 8788
# öppna http://localhost:8788
```

## Spelet

Allt är gåbart med din egen figur – klicka där du vill gå. Ingenting ses från sidan.

- **Pixelstaden** i två stadsdelar: *Centrum* (hem, bostadsbyrå, mat, kläder, möbler) och *Arbetsområdet* (flygplats, fruktfabrik, burgarbar). Gå ut i kanten för att byta stadsdel.
- **Hemma:** bostäderna har flera rum – Lilla rummet, Lägenheten (vardagsrum + sovrum) och Villan (vardagsrum, sovrum, kök) med dörrar mellan rummen. Säng, kylskåp och garderob fungerar.
- **🛋️ Möblera:** köp möbler i varuhuset, de hamnar i förrådet. Hemma trycker du *Möblera* – plocka ur förrådet, flytta runt, sälj för halva priset. Besökare ser din inredning.
- **Jobben** (60 sekunder = 4 timmar), med kroppen: ✈️ bär väskorna från bandet till vagnen med rätt bokstav · 🍊 plocka frukten ordersedeln vill ha och bär den till lådan · 🍔 plocka tallriken från disken och servera kunden med samma önskan i pratbubblan. Tre pass = befordran.
- **Butikerna** går man runt i: möbelvaruhuset visar alla möbler utställda med prislappar (välj färg vid köp), klädaffären har varje plagg på en mannekäng och accessoarerna på hyllan.
- **Öppen värld:** alla som spelar är i samma Pixelstad, ni ser varandra i staden och kan åka hem till varandra (👥). Emotes när någon är nära.
- **Dagshändelser, rekord, dagbok 📊** och målet: egen villa + 10 000 kr. 🏆

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
