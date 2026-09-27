# SNABBFILEN — spelplan

Livssimulator i pixel-2D à la **Jones in the Fast Lane**: du har ett eget rum,
en avatar du klär som du vill, en plånbok som aldrig räcker och en stad full
av jobb. Motorn är utbruten ur Pixelverkstan (`js/core/` — procedurell
pixelgrafik på canvas, inga sprite-assets).

## Kärnloopen

```
vakna → ät → gå till jobbet → jobba minispelet → få lön
     → handla mat/kläder → hem → sov (ny dag) → hyra dras varje vecka
```

Tiden är resursen, som i Jones: klockan går när man går mellan platser och
när man jobbar. Dagen tar slut — det man inte hann får vänta till i morgon.

## Behov (HUD överst)

| Behov | Sjunker av | Fylls på av | Konsekvens vid noll |
|---|---|---|---|
| 🍔 Mätthet | tid | mat ur kylskåpet / snabbmat | orkar inte jobba (halva lönen) |
| ⚡ Energi | jobb, gå | sova hemma | somnar på stället → förlorad tid |
| 💰 Pengar | mat, hyra, kläder | lön | hyresvärden knackar på |

## Pixelstaden (navet)

**Staden är utgångspunkten.** När man kommer ut ur sitt hus står man i Pixelstaden
och väljer vart man går. Första gången man spelar väljer man var man ska bo.

| Plats | Vad man gör |
|---|---|
| 🏠 **Hemma** | Sova (ny dag), äta ur kylskåpet, garderoben (avatar-editorn) |
| 🔑 **Bostadsbyrån** | Välja/köpa bostad: Lilla rummet → Lägenheten → Villan (insats + högre hyra, bättre sömn) |
| 🛒 **Matbutiken** | Köpa mat till kylskåpet — billig mat mättar lite, dyr mättar mycket |
| ✈️ **Flygplatsen** | JOBB: väskor på rullband med destinationstagg → dra till rätt vagn |
| 🍊 **Fruktfabriken** | JOBB: packa beställningar — rätt frukt i rätt låda innan bandet går |
| 👕 **Klädaffären** | JOBB: plagg till rätt hylla. Och: köpa kläder som låser upp fler val i garderoben |

## Bostäder = progression

| Bostad | Insats | Hyra/vecka | Sömn |
|---|---|---|---|
| Lilla rummet | gratis (start) | 350 kr | normal |
| Lägenheten | 1 500 kr | 600 kr | +10 energi |
| Villan | 8 000 kr | 1 000 kr | +20 energi |

Rummet ritas efter bostadstyp — större bostad, finare rum. Bostaden ligger i
spar-JSON:en så att en kompis hus kan ritas upp från ett litet objekt.

## Besöka varandra (KLART 2026-09-27)

👥-knappen i HUD:en: värden bjuder hem med en 4-teckenskod (`js/net/visit.js`,
PeerJS-moln, värd-auktoritativ stjärna precis som Drömgården/Lantliv, max 6
gäster). Gästen kliver in i värdens rum — rätt bostadstyp och möbler ritas från
värdens save — och alla ser varandra gå omkring med namnskyltar. Positioner
skickas throttlat (90 ms). ÅK HEM-dörren eller 👥 → Åk hem avslutar; resan
kostar 20 minuter åt varje håll.

## Jobben — minispels-kontraktet

Varje jobb är en modul under `js/places/` med samma interface som
Pixelverkstans shops: `{ id, name, icon, start(ctx), stop() }`.
Ett arbetspass tar speltimmar och betalar **grundlön × skicklighet**
(träffsäkerhet i minispelet). Fler dagar på samma jobb → högre grundlön (befordran).

- **Flygplatsen**: väskor rullar in med färg-/bokstavstagg, 4 luckor. Rätt lucka = +, fel = −, missad väska åker förbi. Tempot ökar.
- **Fruktfabriken**: ordersedel visar t.ex. `3🍎 2🍌 1🍇`; frukter plockas från band till lådan. Full & rätt låda försvinner, ny order.
- **Klädaffären**: plagg med prislapp/typ ska till rätt sektion (tröjor/byxor/hattar). Kunder blir sura om det tar för länge.

## Kläder = progression

Klädaffärens sortiment låses upp med pengar: nya plagg/färger blir valbara i
avatar-editorn (`unlockedClothes` i save). Finkläder kan ge bonus på vissa
jobb (klädaffären kräver att man ser "propert" ut för högre lön — som Jones
klädkrav).

## Utbrutet ur Pixelverkstan

| Kopieras rakt av | Skrivs om/nytt |
|---|---|
| `raster.js`, `pixfont.js` (pixelrit + font) | `main.js` (bootstrap utan shop-väljare) |
| `people.js` (figurer + kläder + drawPerson) | stadskartan (ny scen) |
| `avatar.js` (editorn = garderoben) | rummet hemma (egen planlösning) |
| `ui.js`, `fx.js` (modaler, toast, effekter) | behovs-/klock-/ekonomisystem |
| `floor-*.js` (planlösning, gång, props) i den mån de passar | tre jobb-minispel |
| `session.js`-mönstret (save/load) | |

**Ingen 3D i v1. Ingen multiplayer i v1** (motorns coop/net följer inte med förrän spelet står).

## Milstolpar

1. ✅ **M1 — Skelett:** stadskarta + rummet + avatar går att klä. Klocka + dag/natt. Sova = ny dag.
2. ✅ **M2 — Ekonomi:** mätthet/energi/pengar, matbutik, kylskåp, hyra.
3. ✅ **M3 — Jobben:** flygplatsen, fruktfabriken, klädaffären. Befordran efter 3 pass.
4. ✅ **M4 — Progression:** klädaffären säljer plagg som låses upp i garderoben (🔒 i
   redigeraren tills köpta), Möbelhörnan (matta/växt/soffa/TV), slutmål: Villan +
   10 000 kr → gratulationsdialog.
5. ✅ **M5 — Ljud + besök:** WebAudio-synt utan ljudfiler (`core/sound.js`, mute i HUD),
   besöka varandras hus via rumskod (se ovan).

## Kvar / idéer framåt

- Händelser (grannen knackar på, rea i klädaffären, extrapass med dubbel lön)
- Fler jobb och nivåer på minispelen; highscore
- Emotes/chatt under besök · besöka varandras stad, inte bara huset
- Publicera på 8bitcat.github.io/snabbfilen (kräver kontobyte till 8bitcat)
