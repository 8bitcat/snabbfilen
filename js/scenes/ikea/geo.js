// MÖBELJÄTTEN – gemensamma mått (spelpixlar) för båda planen.
// Varje plan är en egen gåbar yta W × H med två "band": rad A överst (rum +
// gång 1) och rad B under (rum + gång 2). Kameran följer figuren: i raderna
// visas ett band i taget, i de öppna hallarna glider den mjukt mellan dem.
export const VW = 384, VH = 216;
export const TOP = 12;                       // takkanten ovanför bakväggarna (rad A)
export const WH = 58;                        // väggarnas höjd i bild
export const FD = 92;                        // rummens djup (golvet)
export const AI = 36;                        // gångarnas djup
export const PW = 6, OW = 6;                 // mellanvägg / yttervägg
export const A_WALL = TOP, A_FLOOR = A_WALL + WH, A_AISLE = A_FLOOR + FD;          // 12 · 70 · 162
export const B_WALL = A_AISLE + AI, B_FLOOR = B_WALL + WH, B_AISLE = B_FLOOR + FD;  // 198 · 256 · 348
export const H = B_AISLE + AI + 4;                                                 // 388
export const AISLE1 = A_AISLE + AI / 2, AISLE2 = B_AISLE + AI / 2;                 // 180 · 366
export const ROWY = { wall: 6, mid: 50, front: 84 }; // möblernas fotlinje i rummet (från golvkanten)
export const TURN_W = 66;                    // öppna svängen mellan gångarna
export const MIN_IW = 150, MAX_IW = 280;
export const SPEED = 105;
// specialytornas bredd
export const CORE1_W = 604;                  // plan 1: entréhallen med rulltrapporna och hissen
export const CORE2_W = 290;                  // plan 2: ankomsthallen (öppen över båda raderna)
export const REST_W = 430, KASSA_W = 270, EXIT_W = 250, LAGER_MIN = 440;
export const ESC_RUN = 134;                  // rulltrappans längd (x) – räcker för att försvinna genom taket
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const bandOf = (y) => (y < B_WALL - 10 ? 'A' : 'B');
export const floorY = (band) => (band === 'A' ? A_FLOOR : B_FLOOR);
export const wallY = (band) => (band === 'A' ? A_WALL : B_WALL);
// kamerans y för en fot-y: band A upptill, band B nertill, mjukt emellan
export const camYFor = (py) => (py < 184 ? 0 : py > 250 ? H - VH : Math.round((py - 184) / 66 * (H - VH)));
