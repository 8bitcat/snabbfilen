// 📸 Fotoläget pågår (js/core/foto.js). Då ritar spelet inte det som är knappar och skyltar för spelaren – bara
// världen: namnlappar och kundbubblor (walkable.js), möbelskyltarna och namnlapparna hemma (room.js), vägvisaren
// (startguide.js, city.js), husnamnen överst, stadsdelsskylten och kompispilarna (city.js), väderskylten (weather.js),
// djurens mätare (pets/layer.js) och butikernas kantskyltar ("< SQUISHY"). Pratbubblor och emotes syns – de hör
// till ögonblicket. (En egen liten modul utan import, så att alla ritfiler kan läsa flaggan.)
export const foto = { pa: false };
