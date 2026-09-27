# SNABBFILEN

**🎮 Spela direkt: https://8bitcat.github.io/snabbfilen/**

Livet i Pixelstaden — en livssimulator i pixel-2D à la *Jones in the Fast Lane*.
Du har ett rum, en garderob och en plånbok som aldrig räcker. Jobba på stadens
arbetsplatser, köp mat så du orkar, klä dig som du vill och spara till en
större bostad.

Byggt på 2D-motorn ur Pixelverkstan (procedurell pixelgrafik — inga bildfiler).

## Spela

```bash
python -m http.server 8788
# öppna http://localhost:8788
```

## Spelet

- **Klockan går** när du går någonstans, jobbar, äter och sover. Dagen tar slut — hinner du inte hem somnar du på gatan.
- **Behov:** 🍔 mätthet (köp mat!) och ⚡ energi (sov!). Utsvulten = halv lön. Utmattad = inget jobb.
- **Hyran** dras varje måndag morgon.
- **Jobben** (minispel, 60 sekunder = 4 timmar): ✈️ Flygplatsen — dra väskan till vagnen med samma tagg · 🍊 Fruktfabriken — klicka frukterna ordersedeln behöver · 👕 Klädaffären — häng plaggen på rätt hylla. Tre pass på samma jobb = befordran och högre lön.
- **Bostäder:** Lilla rummet → Lägenheten (1 500 kr) → Villan (8 000 kr). Större bostad = bättre sömn. Möbler köps i Möbelhörnan.
- **Garderoben** hemma öppnar avatarredigeraren — frisyrer, kläder, färger. Bara basplaggen är gratis; 18 plagg och accessoarer (keps → krona) har 🔒 tills du köpt dem i klädaffären. Jobbar du i klädaffären får du personalrabatt (5 % per nivå, max 20 %).
- **Öppen värld:** alla som spelar är i samma Pixelstad — ni ser varandra på gatan, och 👥-knappen listar vilka som är online så du kan åka hem till vem som helst. Emote-knappar (👋❤️😂🎉) när någon är nära.
- **Dagshändelser:** rea i klädaffären, extrapass med dubbel lön, ösregn som gör allt segt…
- **Målet:** egen villa och 10 000 kr på fickan. 🏆 (📊-knappen visar din resa.)

## Struktur

- `js/core/` — motorn från Pixelverkstan: `people.js` (pixelfigurer + kläder), `avatar.js` (redigeraren), `floor-pix.js` (pixelritning + fonter), `ui.js` (modal/toast)
- `js/game.js` — klocka, behov, ekonomi, bostäder, save/load
- `js/scenes/` — Pixelstaden och rummet
- `js/jobs/` — arbetspassen: `sorter.js` (flygplats + klädaffär), `packer.js` (fruktfabrik), `shift.js` (löneflödet)
- `js/shops/` — matbutiken, bostadsbyrån + Möbelhörnan, klädaffärens butik
- `js/net/world.js` — den öppna världen (auto-anslutning, värd-auktoritativ, `?world=` för egen värld)
- `js/core/sound.js` — ljudeffekter som WebAudio-synt, inga ljudfiler
- `docs/SPELPLAN.md` — designen och milstolparna
- `tools/smoke.mjs` — röktest i Playwright (klickar igenom allt, tar skärmdumpar till `tools/out/`)

## Test

```bash
python -m http.server 8788   # i en terminal
node tools/smoke.mjs         # i en annan — ALLT GRÖNT = bra
```
