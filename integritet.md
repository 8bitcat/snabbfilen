# Integritet – Pixelcity och Snabbfilen

*Pixelcity (iPhone/iPad) och Snabbfilen (webben) · gäller från 13 oktober 2026*

Pixelcity och Snabbfilen är samma spel: ett livsspel i pixelgrafik som görs av Carl Palsson (8bitcat) som ett familjeprojekt. Kort sagt: **spelet har inga konton, ingen reklam, ingen spårning och ingen statistik.** Det enda som sparas hos oss är det som behövs för notiserna till vänner och KBK-laget – och bara om du själv använder dem (se nedan).

## Det som sparas på din enhet

Ditt spel – figuren, pengarna, hemmet, inställningarna och listan över spelare du har blockerat – sparas bara i appen eller webbläsaren på din egen enhet. Det skickas aldrig till oss. Tar du bort appen (eller rensar webbläsarens data) försvinner allt.

## När du spelar med andra

Spelet har en öppen stad där alla som spelar samtidigt kan mötas. Då skickas din figurs namn och utseende, var du är i spelet, det du skriver i chatten och vilka uttryckssymboler du använder direkt till de andra spelarna – i realtid, medan ni spelar. Vi sparar inget av det.

För att spelarna ska hitta varandra används den öppna tjänsten PeerJS (peerjs.com), och Googles STUN-servrar hjälper enheterna att få kontakt. De ser tekniska uppgifter om anslutningen, som din IP-adress, men inte vad du skriver eller säger.

Fula ord i namn och chatt byts automatiskt mot \*\*\*. Du kan blockera en spelare – då ser och hör du inte hen längre – och anmäla den som är elak.

## Notiser när en vän eller lagkompis börjar spela

Det här är det enda som sparas hos oss – och bara om du själv använder det:

- **Vänner:** när du och en annan spelare blir vänner i spelet sparas ett slumpat vän-id för din figur, figurens namn och dina vänners vän-id:n på vår notisserver. Då kan vännerna få en hälsning när du börjar spela – men bara den som också har dig som vän.
- **Vänskapspresenter och statyn:** en present du skickar till en vän sparas hos oss tills vännen har öppnat den. Varje vecka räknas hur många vänskapspresenter du har skickat, tillsammans med din figurs namn och utseende. Den som skickat flest får en staty i spelets park i en vecka – den ser alla som spelar. Räkningen raderas efter två veckor.
- **SMS till vänner:** ett SMS du skickar till en vän i spelet (högst 120 tecken) sparas hos oss tills vännens spel har hämtat det, högst 14 dagar, och raderas sedan. Bara vänner kan skriva till varandra. Länkar, e-postadresser och telefonnummer tas bort och fula ord filtreras. Hur många SMS du har skickat i dag räknas (för att stoppa spam) och raderas efter två dagar. Samtalen sparas sedan bara på er egna enheter.
- **KBK-laget:** stämmer du av dig som spelare i Kungsladugårds BK sparas ditt förnamn och ditt nummer på samma sätt, så att laget kan få en notis.
- **Pushnotiser (bara i appen):** säger du ja till notiser sparas telefonens pushkod, som Apple behöver för att leverera notisen. Notiserna skickas via Apples pushtjänst.

Notisservern körs hos Cloudflare. Uppgifterna används bara till de här notiserna och lämnas aldrig ut. Tar du bort en vän försvinner ni från varandras listor, och "Inte jag – ta bort" i KBK-appen tar bort telefonen från laget. Vill du att vi raderar allt som rör dig: mejla **hello@8bitcat.io**.

## Mikrofonen och röstchatten

Mikrofonen används bara om du själv slår på röstchatten. Då går ljudet direkt till spelarna som står nära dig i spelet eller är med i samma röstgrupp. Inget spelas in och inget sparas.

## Anmälningar

När du anmäler en spelare öppnas din e-post med ett färdigt meddelande till **hello@8bitcat.io**: vem det gäller, varför och vad hen skrev senast. Vi använder det bara för att hantera anmälan och raderar det när ärendet är klart.

## Uppdateringar

Appen hämtar nya versioner av spelet från GitHub (github.com och github.io), där spelet ligger. Som vid alla vanliga hämtningar på nätet ser GitHub din IP-adress.

## Barn

Spelet är gjort för hela familjen. Det behövs inga personuppgifter för att spela. Använd gärna ett påhittat namn på figuren, och be en vuxen om hjälp innan du slår på röstchatten.

## Frågor

Mejla **hello@8bitcat.io**. Allt annat än notisuppgifterna ovan ligger bara på din enhet – där finns inget att plocka fram eller radera hos oss.

---

## In English

Pixelcity (iOS) and Snabbfilen (web) are the same pixel-art life game, made by Carl Palsson (8bitcat). There are no accounts, no ads, no tracking and no analytics. Your game is saved only on your own device. The only data we store is what notifications need, and only if you use them: when you become friends in the game, a random friend ID for your character, its name and your friends' IDs; if you confirm yourself as a Kungsladugårds BK player, your first name and shirt number; and in the app, if you allow notifications, your phone's push token. This is kept on our notification server at Cloudflare, sent through Apple's push service, used only for these notifications and never shared. Removing a friend removes you from each other's lists; e-mail us to have everything about you deleted. When you play online, your character's name and look, your position in the game, your chat messages and (only if you turn on voice chat) your voice are sent directly to the other players in real time and are not stored by us. The open PeerJS service and Google STUN servers are used to connect players and can see technical connection data such as your IP address. Bad words are filtered, and you can block and report other players. Reports are sent by your own e-mail app to hello@8bitcat.io and are deleted once handled. The app downloads game updates from GitHub. Questions: **hello@8bitcat.io**.
