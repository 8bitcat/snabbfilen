// Bygger spelets möbelatlas ur de köpta EmanuelleDev-arken (Palssons Gård).
// Bara de sprites spelet använder bäddas in (licenskravet). Skriver
// assets/interior.png + js/data/frames.js. Kör: node tools/build-atlas.mjs
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
import fs from 'fs';

const SRC = 'D:/GamesProjects/Palssons Gard/assets/Objects/Interior/';
const B = 'Beds.png', S = 'Sofa and armchair.png', C = 'Closet.png', T = 'Tables and desks.png';
const P1 = 'Part 1 copiar.png', P2 = 'Part 2 copiar.png', P9 = 'Part 9 copiar.png';
const O = 'Others.png', F = 'Fireplace.png', CH = 'Chairs.png', D = 'Dressers.png';
// arken som de nya möblerna (2026-09-28) hämtas ur
const P10 = 'Part 10 copiar.png', P11 = 'Part 11 copiar.png', HW = 'hospital wing.png', BS = 'Blacksmith.png', SC = 'School.png';
const TE = 'Temple.png', DW = 'Doors, windows and curtains.png', X = 'Xmas.png', CF = 'cats furniture.png', BB = 'basketball.png';
const L1 = 'Candle 1.png', L2 = 'Candle 2.png', L3 = 'Candle 3.png', L4 = 'candle 4.png', L5 = 'Candle 5.png', L6 = 'Candle 6.png';

// [namn, fil, sx, sy, sw, sh] – namn = kind + variantindex
const PICKS = [
  // dubbelsängar (6 färger)
  ['sang0', B, 7, 269, 33, 34], ['sang1', B, 55, 269, 33, 34], ['sang2', B, 103, 269, 33, 34],
  ['sang3', B, 151, 269, 33, 34], ['sang4', B, 247, 269, 33, 34], ['sang5', B, 343, 269, 33, 34],
  // soffor (6)
  ['soffa0', S, 2, 11, 29, 20], ['soffa1', S, 34, 11, 29, 20], ['soffa2', S, 130, 11, 29, 20],
  ['soffa3', S, 162, 11, 29, 20], ['soffa4', S, 226, 11, 29, 20], ['soffa5', S, 290, 11, 29, 20],
  // fåtöljer (4)
  ['fatolj0', S, 296, 107, 17, 20], ['fatolj1', S, 136, 107, 17, 20], ['fatolj2', S, 200, 107, 17, 20], ['fatolj3', S, 264, 107, 17, 20],
  // garderober (4 – bruna raden)
  ['garderob0', C, 69, 296, 35, 38], ['garderob1', C, 181, 296, 35, 38], ['garderob2', C, 293, 296, 35, 38], ['garderob3', C, 405, 296, 35, 38],
  // kylskåp (2)
  ['kylskap0', P9, 160, 0, 16, 48], ['kylskap1', P9, 320, 0, 16, 48],
  // TV (2: platt + retro)
  ['tv0', P2, 136, 72, 48, 23], ['tv1', P2, 4, 10, 24, 20],
  // runda bord (4) + matbord (4)
  ['bordR0', T, 6, 230, 22, 20], ['bordR1', T, 37, 230, 22, 21], ['bordR2', T, 101, 230, 22, 21], ['bordR3', T, 133, 230, 22, 21],
  ['bordM0', T, 136, 8, 51, 20], ['bordM1', T, 136, 72, 51, 20], ['bordM2', T, 136, 104, 51, 20], ['bordM3', T, 136, 136, 51, 20],
  // stolar (4)
  ['stol0', CH, 2, 10, 13, 21], ['stol1', CH, 65, 10, 13, 21], ['stol2', CH, 2, 42, 13, 21], ['stol3', CH, 65, 42, 13, 21],
  // byråer (4)
  ['byra0', D, 0, 40, 48, 18], ['byra1', D, 64, 40, 48, 18], ['byra2', D, 128, 40, 48, 18], ['byra3', D, 192, 40, 48, 18],
  // bokhyllor (3)
  ['bokhylla0', O, 39, 45, 34, 35], ['bokhylla1', O, 1, 46, 30, 34], ['bokhylla2', O, 81, 48, 30, 32],
  // speglar (3)
  ['spegel0', O, 1, 7, 14, 25], ['spegel1', O, 17, 7, 14, 25], ['spegel2', O, 33, 7, 14, 25],
  // öppna spisar (3)
  ['spis0', F, 34, 6, 28, 42], ['spis1', F, 98, 6, 28, 42], ['spis2', F, 130, 6, 28, 42],
  // lampor (2) + sprite-växter (2)
];

// ---------- nya möbler (katalogiserade i tools/furniture/*.json, dubbletter rensade) ----------
// TV / dator: gamingdatorn (KATALOG:s tv0) i tre färger till → tv2..tv4
const EXTRA = [['tv2', P2, 136, 6, 48, 25], ['tv3', P2, 136, 38, 48, 25], ['tv4', P2, 136, 103, 48, 25]];
// [sort, bredd, höjd, [[fil, sx, sy], …]] → sort0, sort1 … (alla varianter av en sort är lika stora)
const KINDS = [
  // VARDAGSRUM
  ['piano', 29, 20, [[O, 2, 91], [O, 34, 91], [O, 66, 91]]],
  ['tvbank', 27, 14, [[D, 2, 130], [D, 34, 130], [D, 66, 130], [D, 98, 130], [D, 130, 130], [D, 162, 130], [D, 194, 130]]],
  ['soffbord', 30, 12, [[T, 193, 242], [T, 193, 274], [T, 193, 306], [T, 193, 338]]],
  ['glasbord', 30, 9, [[T, 192, 229]]],
  ['baksoffa', 29, 18, [[S, 2, 45], [S, 34, 45], [S, 66, 45], [S, 98, 45], [S, 130, 45], [S, 162, 45], [S, 194, 45], [S, 226, 45], [S, 258, 45], [S, 290, 45]]],
  ['sidosoffa', 13, 29, [[S, 1, 66], [S, 33, 66], [S, 65, 66], [S, 97, 66], [S, 129, 66], [S, 161, 66], [S, 193, 66], [S, 225, 66], [S, 257, 66], [S, 289, 66]]],
  ['kuddsoffa', 29, 22, [[S, 2, 105], [S, 34, 105], [S, 66, 105]]],
  ['bakfatolj', 17, 18, [[S, 136, 141], [S, 168, 141], [S, 200, 141], [S, 232, 141], [S, 264, 141], [S, 296, 141]]],
  ['sidofatolj', 13, 20, [[S, 130, 171], [S, 162, 171], [S, 194, 171], [S, 226, 171], [S, 258, 171], [S, 290, 171]]],
  ['matstol', 11, 18, [[CH, 130, 13], [CH, 194, 13], [CH, 194, 45], [CH, 194, 77], [CH, 194, 109], [CH, 194, 141]]],
  ['pelarbord', 22, 22, [[T, 5, 261], [T, 37, 261], [T, 69, 261], [T, 101, 261], [T, 133, 261], [T, 165, 261]]],
  ['sidobord', 22, 22, [[T, 5, 325], [T, 37, 325], [T, 69, 325], [T, 101, 325], [T, 133, 325], [T, 165, 325]]],
  ['eldstad', 26, 28, [[F, 131, 84], [F, 163, 84], [F, 195, 84], [F, 227, 84]]],
  ['tegelspis', 28, 30, [[F, 2, 18], [F, 162, 18], [F, 194, 18], [F, 226, 18]]],
  ['murspis', 32, 47, [[F, 0, 65], [F, 32, 65]]],
  ['laghylla', 28, 20, [[SC, 210, 9], [SC, 242, 9]]],
  ['mellanhylla', 28, 26, [[SC, 210, 43], [SC, 242, 43]]],
  ['hoghylla', 28, 33, [[SC, 210, 137], [SC, 242, 137]]],
  ['smalhylla', 24, 26, [[SC, 212, 91], [SC, 244, 91]]],
  ['bredhylla', 47, 33, [[SC, 305, 9], [SC, 353, 9], [SC, 353, 57]]],
  ['landskap', 20, 16, [[P1, 37, 0]]],
  ['blomtavla', 33, 16, [[P1, 7, 128]]],
  ['draperi', 33, 24, [[DW, 7, 163], [DW, 55, 163], [DW, 103, 163], [DW, 151, 163], [DW, 199, 163], [DW, 7, 227], [DW, 55, 227], [DW, 103, 227], [DW, 151, 227], [DW, 199, 227]]],
  ['moraklocka', 13, 29, [[P1, 145, 3]]],
  ['ljusgrupp', 16, 20, [[L1, 0, 12], [L2, 0, 12], [L5, 0, 12]]],
  ['golvlampa', 11, 22, [[P1, 81, 42], [P1, 97, 42], [P1, 113, 42], [P1, 129, 42]]],
  ['stormatta', 70, 40, [[P11, 4, 117], [P11, 84, 117], [P11, 4, 165], [P11, 84, 165]]],
  ['skivor', 14, 15, [[P1, 0, 176], [P1, 32, 177]]],
  // SOVRUM
  ['enkelsang', 18, 34, [[B, 7, 2], [B, 71, 2], [B, 135, 2], [B, 263, 2], [B, 7, 50], [B, 71, 50], [B, 135, 50], [B, 327, 50], [B, 71, 98], [B, 135, 98]]],
  ['dubbelsang', 33, 34, [[B, 7, 317], [B, 103, 317], [B, 199, 317], [B, 295, 317], [B, 7, 365], [B, 103, 365], [B, 199, 365], [B, 295, 365]]],
  ['tvarsang', 32, 24, [[B, 0, 152], [B, 48, 152], [B, 96, 152], [B, 192, 152], [B, 0, 184], [B, 48, 184], [B, 96, 184], [B, 240, 184], [B, 48, 216], [B, 96, 216]]],
  ['tvardubbel', 32, 38, [[B, 192, 426], [B, 240, 426], [B, 288, 426], [B, 336, 426], [B, 0, 474], [B, 48, 474], [B, 96, 474], [B, 144, 474]]],
  ['nattduksbord', 16, 16, [[D, 0, 8], [D, 64, 8], [D, 128, 9], [D, 192, 9]]],
  ['kladskap', 23, 33, [[C, 5, 301], [C, 117, 301], [C, 229, 301], [C, 341, 301], [C, 453, 301], [C, 565, 301], [C, 453, 13], [C, 565, 13], [C, 229, 13], [C, 5, 13]]],
  ['linneskap', 25, 36, [[C, 35, 298], [C, 147, 298], [C, 259, 298], [C, 371, 298], [C, 483, 298], [C, 595, 298], [C, 483, 10], [C, 595, 10], [C, 259, 10], [C, 35, 10]]],
  ['storgarderob', 35, 38, [[C, 517, 296], [C, 629, 296], [C, 517, 8], [C, 629, 8], [C, 293, 8], [C, 181, 8], [C, 69, 8], [C, 405, 8]]],
  ['lagbyra', 27, 12, [[D, 2, 98], [D, 34, 98], [D, 66, 98], [D, 98, 98], [D, 130, 98], [D, 162, 98], [D, 194, 98]]],
  ['kista', 16, 15, [[BS, 208, 17]]],
  ['ramtavla', 12, 15, [[P1, 18, 17], [P1, 50, 17]]],
  ['gardin', 33, 24, [[DW, 7, 131], [DW, 55, 131], [DW, 103, 131], [DW, 151, 131], [DW, 199, 131], [DW, 7, 195], [DW, 55, 195], [DW, 103, 195], [DW, 151, 195], [DW, 199, 195]]],
  ['bordslampa', 11, 16, [[P1, 81, 16], [P1, 97, 16], [P1, 113, 16], [P1, 129, 16], [P1, 97, 0]]],
  ['lillmatta', 33, 18, [[P11, 167, 136], [P11, 215, 136], [P11, 263, 136], [P11, 167, 200], [P11, 215, 200], [P11, 168, 167], [P11, 216, 167], [P11, 264, 167], [P11, 264, 199], [P11, 264, 103]]],
  // KÖK
  ['kyl', 16, 28, [[P9, 128, 20], [P9, 144, 20], [P9, 160, 20], [P9, 480, 52], [P9, 496, 52], [P9, 512, 52]]],
  ['koksspis', 16, 19, [[P9, 128, 93], [P9, 480, 29]]],
  ['flakt', 16, 12, [[P9, 128, 80], [P9, 480, 16]]],
  ['kokso', 48, 24, [[P9, 0, 72], [P9, 192, 72], [P9, 352, 72], [P9, 544, 72]]],
  ['diskbank', 48, 19, [[P9, 48, 77], [P9, 240, 77], [P9, 400, 77], [P9, 592, 77]]],
  ['bankskap', 48, 16, [[P9, 16, 32], [P9, 208, 32], [P9, 368, 32], [P9, 560, 32], [P9, 16, 16], [P9, 208, 16], [P9, 368, 16], [P9, 560, 16]]],
  ['overskap', 48, 15, [[P9, 96, 0], [P9, 288, 0], [P9, 448, 0], [P9, 640, 0]]],
  ['porslinsskap', 48, 15, [[P9, 48, 0], [P9, 240, 0], [P9, 400, 0], [P9, 592, 0]]],
  ['kryddhylla', 48, 15, [[P9, 0, 0], [P9, 192, 0], [P9, 352, 0], [P9, 544, 0]]],
  ['mikro', 14, 11, [[P1, 225, 53]]],
  ['brodrost', 10, 11, [[P1, 243, 53]]],
  ['kaffekokare', 11, 15, [[P1, 211, 49]]],
  ['soptunna', 9, 12, [[P1, 211, 164], [P1, 211, 180]]],
  ['koksbord', 24, 23, [[T, 4, 292], [T, 36, 292], [T, 68, 292], [T, 100, 292], [T, 131, 292], [T, 164, 292]]],
  ['dryckeskyl', 26, 41, [[HW, 195, 38]]],
  ['rullbord', 23, 27, [[HW, 292, 66]]],
  ['vaggklocka', 13, 13, [[P1, 161, 2]]],
  ['kragetavla', 13, 13, [[P1, 1, 35]]],
  ['flaskhylla', 16, 13, [[P1, 208, 145], [P1, 240, 145]]],
  ['fruktskal', 11, 13, [[F, 226, 176]]],
  ['tarta', 13, 15, [[P1, 225, 113], [P1, 241, 113], [P1, 242, 129], [P1, 257, 129]]],
  ['matskal', 12, 10, [[CF, 306, 5], [CF, 306, 37], [CF, 306, 69], [CF, 306, 101]]],
  ['rutmatta', 48, 26, [[P11, 48, 34], [P11, 96, 34], [P11, 144, 34], [P11, 192, 34]]],
  // BADRUM
  ['toalett', 10, 22, [[P10, 66, 10], [P10, 131, 10], [P10, 195, 10], [P10, 67, 42], [P10, 130, 42], [P10, 163, 74]]],
  ['handfat', 13, 18, [[P10, 66, 78], [P10, 114, 78]]],
  ['tvattstall', 13, 14, [[P10, 66, 98], [P10, 114, 98]]],
  ['badkar', 26, 25, [[P10, 5, 39], [P10, 37, 39]]],
  ['dusch', 32, 32, [[P10, 0, 96], [P10, 32, 96], [P10, 64, 160], [P10, 96, 160], [P10, 0, 128], [P10, 32, 128], [P10, 0, 160], [P10, 32, 160]]],
  ['badhylla', 16, 26, [[P10, 80, 118], [P10, 96, 118], [P10, 112, 118], [P10, 64, 118]]],
  ['badbank', 48, 15, [[P10, 64, 144], [P10, 112, 144]]],
  ['tvattmaskin', 16, 18, [[P10, 240, 110]]],
  ['torktumlare', 16, 18, [[P10, 224, 110]]],
  ['tvattpelare', 16, 28, [[P10, 208, 100]]],
  ['strykbrada', 22, 19, [[P10, 133, 172], [P10, 165, 172], [P10, 197, 172]]],
  ['medicinskap', 29, 23, [[HW, 2, 2]]],
  ['kattlada', 17, 13, [[CF, 359, 18], [CF, 359, 50], [CF, 359, 82], [CF, 359, 114]]],
  // BARNRUM
  ['staffli', 13, 23, [[P1, 145, 40]]],
  ['rundmatta', 27, 21, [[P11, 162, 74], [P11, 194, 74], [P11, 226, 74], [P11, 162, 106], [P11, 194, 106], [P11, 226, 106]]],
  ['spelkonsol', 16, 16, [[P2, 0, 128], [P2, 16, 127], [P2, 48, 128]]],
  ['retrotv', 16, 20, [[P2, 40, 75]]],
  ['skolbank', 27, 29, [[SC, 131, 42]]],
  ['skolstol', 11, 18, [[SC, 66, 45]]],
  ['barnbord', 28, 22, [[SC, 130, 10]]],
  ['barnstol', 11, 18, [[CH, 258, 13], [CH, 258, 45], [CH, 258, 77], [CH, 258, 109], [CH, 258, 141]]],
  ['platskap', 16, 32, [[SC, 128, 80]]],
  ['backar', 16, 15, [[SC, 160, 65], [SC, 176, 65], [SC, 192, 65]]],
  ['leksakslada', 16, 15, [[P1, 144, 113], [P1, 160, 113], [P1, 144, 129], [P1, 160, 129]]],
  ['ryggsack', 11, 14, [[P1, 50, 113], [P1, 66, 113], [P1, 82, 113], [P1, 98, 113]]],
  ['gosedjur', 13, 15, [[P1, 130, 97], [P1, 145, 97], [P1, 161, 97]]],
  ['jattenalle', 17, 22, [[P1, 152, 74]]],
  ['gosegroda', 18, 19, [[P11, 120, 11]]],
  ['byggklossar', 11, 10, [[P1, 2, 5], [P1, 18, 6]]],
  ['nattlampa', 11, 13, [[P1, 66, 2], [P1, 113, 3]]],
  ['golvkudde', 18, 14, [[P11, 150, 0], [P11, 150, 16], [P11, 182, 0], [P11, 182, 16], [P11, 214, 0], [P11, 214, 16]]],
  ['molnkudde', 24, 18, [[P11, 245, 12]]],
  ['stjarnkudde', 16, 14, [[P11, 256, 65]]],
  ['palett', 11, 13, [[P1, 162, 18]]],
  ['fiol', 9, 21, [[P1, 115, 123]]],
  ['basketboll', 8, 8, [[BB, 181, 39]]],
  ['basketkorg', 40, 22, [[BB, 165, 7]]],
  ['abcplansch', 18, 22, [[SC, 39, 6]]],
  ['barntavla', 18, 18, [[SC, 6, 7], [SC, 6, 39], [SC, 39, 39]]],
  ['vaggmane', 25, 25, [[P11, 82, 5]]],
  // KONTOR
  ['bredtavla', 16, 12, [[P1, 0, 20], [P1, 64, 20]]],
  ['vaggkalender', 13, 16, [[P1, 49, 48]]],
  ['skrivbord', 32, 19, [[T, 0, 8], [T, 0, 40], [T, 0, 72], [T, 0, 104], [T, 0, 136], [T, 0, 168], [T, 0, 200]]],
  ['arbetsbank', 48, 23, [[SC, 160, 121]]],
  ['kontorsstol', 11, 20, [[CH, 66, 75], [CH, 2, 107], [CH, 66, 107]]],
  ['dator', 22, 23, [[P2, 69, 8], [P2, 70, 40], [P2, 69, 72], [P2, 69, 104]]],
  ['datortorn', 7, 16, [[P2, 4, 96], [P2, 36, 96], [P2, 4, 112], [P2, 36, 112]]],
  ['laptop', 12, 14, [[P2, 2, 66], [P2, 18, 66]]],
  ['telefon', 12, 11, [[P1, 179, 53], [P1, 179, 69], [P1, 179, 85]]],
  ['parmar', 11, 12, [[P1, 195, 36]]],
  ['bokstapel', 9, 21, [[P1, 180, 11], [P1, 196, 11]]],
  ['laspulpet', 16, 26, [[TE, 64, 47], [TE, 80, 47]]],
  ['papperskorg', 18, 21, [[SC, 327, 213]]],
  ['anslagstavla', 30, 20, [[HW, 289, 6], [HW, 289, 37]]],
  ['skolplansch', 17, 21, [[HW, 263, 5]]],
  ['skoltavla', 64, 24, [[SC, 144, 160], [SC, 144, 192]]],
  // HALL
  ['hallbank', 31, 18, [[HW, 145, 8], [HW, 193, 8]]],
  ['sittbank', 32, 12, [[TE, 64, 18]]],
  ['skobank', 27, 12, [[D, 2, 114], [D, 34, 114], [D, 66, 114], [D, 98, 114], [D, 130, 114], [D, 162, 114], [D, 194, 114]]],
  ['pall', 9, 10, [[T, 195, 369]]],
  ['rustning', 15, 28, [[BS, 49, 68], [BS, 65, 68]]],
  ['smatavla', 11, 10, [[P1, 19, 38], [P1, 34, 38], [P1, 2, 54]]],
  ['rundspegel', 14, 16, [[P1, 1, 65], [P1, 17, 65], [P1, 33, 64], [P1, 49, 64]]],
  ['portratt', 10, 12, [[P1, 50, 36], [P1, 19, 53], [P1, 35, 52]]],
  ['vaggsvard', 21, 16, [[BS, 5, 41], [BS, 38, 40], [BS, 71, 40]]],
  ['transportbur', 11, 16, [[CF, 259, 11], [CF, 259, 43], [CF, 259, 75], [CF, 259, 107]]],
  ['dorrmatta', 25, 10, [[P11, 276, 19], [P11, 276, 35], [P11, 276, 51], [P11, 276, 67]]],
  // ÖVRIGT
  ['julstrumpa', 9, 12, [[X, 84, 114], [X, 99, 114], [X, 116, 114], [X, 131, 114], [X, 84, 130], [X, 99, 130], [X, 116, 130], [X, 131, 130]]],
  ['girlang', 26, 7, [[X, 82, 168], [X, 114, 168]]],
  ['julklocka', 11, 15, [[X, 179, 81]]],
  ['blomkruka', 15, 17, [[P1, 65, 158], [P1, 80, 158], [P1, 65, 175], [P1, 81, 175]]],
  ['ljus', 9, 17, [[L3, 2, 15], [L4, 2, 14], [L6, 3, 14]]],
  ['julljus', 11, 11, [[X, 195, 116]]],
  ['klockblomma', 16, 21, [[P1, 96, 154], [P1, 112, 154], [P1, 128, 154]]],
  ['lillblomma', 11, 16, [[P1, 18, 144], [P1, 34, 144], [P1, 48, 144], [P1, 1, 160], [P1, 16, 160], [P1, 50, 160]]],
  ['fredslilja', 16, 18, [[SC, 8, 71], [SC, 40, 71]]],
  ['gummitrad', 15, 23, [[HW, 1, 40]]],
  ['kattrad', 21, 32, [[CF, 37, 0], [CF, 37, 32], [CF, 37, 64], [CF, 37, 96]]],
  ['katthus', 22, 31, [[CF, 4, 1], [CF, 4, 33], [CF, 4, 65], [CF, 4, 97]]],
  ['djurbadd', 24, 20, [[CF, 99, 11], [CF, 99, 43], [CF, 99, 75], [CF, 99, 107], [CF, 131, 11], [CF, 131, 43], [CF, 131, 75], [CF, 131, 107]]],
  ['kattkoja', 19, 21, [[CF, 166, 10], [CF, 166, 42], [CF, 166, 74], [CF, 166, 106], [CF, 198, 10], [CF, 198, 42], [CF, 198, 74], [CF, 198, 106]]],
  ['lovkoja', 20, 22, [[CF, 230, 9], [CF, 230, 41], [CF, 230, 73], [CF, 230, 105]]],
  ['julgran', 32, 48, [[X, 0, 48], [X, 32, 48]]],
  ['minigran', 11, 16, [[X, 82, 144], [X, 98, 144], [X, 114, 144]]],
  ['julklapp', 13, 14, [[X, 82, 34], [X, 98, 34], [X, 114, 34], [X, 130, 34], [X, 146, 34], [X, 162, 34], [X, 82, 66], [X, 98, 66], [X, 114, 66], [X, 130, 66], [X, 146, 66], [X, 162, 66]]],
  ['julfigur', 12, 13, [[X, 81, 3], [X, 94, 3], [X, 69, 3], [X, 178, 97]]],
  ['julsack', 11, 11, [[X, 194, 36], [X, 194, 52], [X, 194, 68]]],
  ['polkagris', 10, 16, [[X, 4, 160], [X, 4, 176]]],
];
for (const [kind, w, h, vars] of KINDS) vars.forEach(([file, sx, sy], i) => EXTRA.push([kind + i, file, sx, sy, w, h]));

const ALL = [...PICKS, ...EXTRA];
const seen = new Set();
for (const [name] of ALL) { if (seen.has(name)) throw new Error('Dubbel nyckel i atlasen: ' + name); seen.add(name); }

const sheets = {};
for (const [, file] of ALL) if (!sheets[file]) sheets[file] = fs.readFileSync(SRC + file).toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage();
const out = await page.evaluate(async ({ sheets, ALL }) => {
  const imgs = {};
  for (const [file, b64] of Object.entries(sheets)) {
    const im = new Image();
    im.src = 'data:image/png;base64,' + b64;
    await im.decode();
    imgs[file] = im;
  }
  // egna frames ritade med kod i samma stil (mörk kontur, 3 toner)
  const CUSTOM = [['lampa0', 14, 36], ['lampa1', 14, 36], ['vaxtS0', 22, 40], ['dass0', 24, 27]];
  // Hyllpackning: högsta först, rad för rad i en 1024 px bred atlas (2 px luft
  // runt varje ruta så att inget blöder över när rutor ritas eller omfärgas).
  const PAD = 2, AW = 1024;
  const all = [...ALL.map((p) => ({ name: p[0], w: p[4], h: p[5], pick: p })), ...CUSTOM.map(([name, w, h]) => ({ name, w, h }))];
  const order = all.map((e, i) => i).sort((a, b) => all[b].h - all[a].h || all[b].w - all[a].w || a - b);
  let cx = PAD, cy = PAD, rowH = 0;
  for (const i of order) {
    const e = all[i];
    if (cx + e.w + PAD > AW) { cx = PAD; cy += rowH + PAD; rowH = 0; }
    e.x = cx; e.y = cy;
    cx += e.w + PAD; rowH = Math.max(rowH, e.h);
  }
  const H = cy + rowH + PAD;
  const c = document.createElement('canvas'); c.width = AW; c.height = H;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  for (const e of all) {
    if (!e.pick) continue;
    const [, file, sx, sy, sw, sh] = e.pick;
    x.drawImage(imgs[file], sx, sy, sw, sh, e.x, e.y, sw, sh);
  }
  const r = (px, py, w, h, c) => { x.fillStyle = c; x.fillRect(px, py, w, h); };
  for (const e of all) {
    if (e.pick) continue;
    const { name, x: ox, y: oy } = e;
    if (name.startsWith('lampa')) {
      const shade = name === 'lampa0' ? ['#3a2618', '#f4e6c0', '#e0c890', '#fff8e0'] : ['#2a0e14', '#c9323a', '#9e1b22', '#e86a70'];
      const metal = name === 'lampa0' ? ['#5a4418', '#d8b24a', '#fbe7a0'] : ['#0e0d12', '#2a2d33', '#5a5f6a'];
      r(ox + 3, oy, 8, 1, shade[0]); r(ox + 2, oy + 1, 10, 1, shade[0]); r(ox + 1, oy + 2, 12, 8, shade[0]);
      r(ox + 3, oy + 1, 8, 1, shade[3]); r(ox + 2, oy + 2, 10, 7, shade[1]); r(ox + 9, oy + 2, 3, 7, shade[2]); r(ox + 3, oy + 2, 2, 5, shade[3]);
      r(ox + 6, oy + 10, 3, 22, metal[0]); r(ox + 7, oy + 10, 1, 22, metal[1]);
      r(ox + 2, oy + 32, 11, 4, metal[0]); r(ox + 3, oy + 32, 9, 2, metal[1]); r(ox + 4, oy + 32, 4, 1, metal[2]);
    } else if (name === 'dass0') {
      // Lilla rummets usla toalett: gulnat porslin, snett lock, spricka i
      // cisternen, rostigt spolhandtag med rostrand, fläckig sits, grumligt
      // vatten, smuts vid foten – plus pumpen och en toarulle på golvet.
      const q = (px, py, w, h, col) => r(ox + px, oy + py, w, h, col);
      const OL = '#131226', WH = '#f2ead0', PO = '#ddd0a4', SH = '#b3a276', DK = '#857449', CR = '#4a3e24';
      const RU = '#9a4a1c', RL = '#c8702a', IN = '#2a2a20', WA = '#6b6a3a', ST = '#5e4020', GR = '#4e5230';
      // cisternen + det sneda locket
      q(5, 3, 14, 9, OL); q(6, 3, 12, 8, PO); q(6, 3, 12, 1, WH); q(6, 4, 1, 6, WH); q(16, 4, 2, 7, SH); q(6, 10, 12, 1, SH);
      q(4, 0, 14, 3, OL); q(5, 1, 12, 1, WH); q(13, 1, 4, 1, PO);
      q(13, 4, 1, 1, CR); q(14, 5, 1, 1, CR); q(14, 6, 1, 1, CR); q(15, 7, 1, 1, CR); q(14, 8, 1, 1, CR); q(15, 5, 1, 1, SH);
      q(9, 8, 2, 1, SH); q(10, 9, 1, 1, DK); q(8, 6, 1, 1, SH);
      // rostigt handtag med rostrand nedför cisternen
      q(2, 5, 4, 2, OL); q(3, 5, 2, 1, RL); q(3, 6, 2, 1, RU);
      q(6, 6, 1, 1, RL); q(6, 7, 1, 2, RU); q(7, 9, 1, 1, RU); q(7, 10, 1, 1, RL);
      // sitsen: ring med mörk öppning, grumligt vatten och en brun rand
      q(5, 12, 14, 1, OL); q(4, 13, 16, 5, OL); q(5, 13, 14, 4, PO); q(5, 13, 14, 1, WH); q(17, 14, 2, 3, SH);
      q(7, 14, 10, 2, IN); q(8, 15, 8, 1, WA); q(9, 14, 3, 1, ST); q(14, 15, 1, 1, ST);
      q(15, 13, 1, 1, CR); q(16, 14, 1, 1, CR); q(6, 16, 3, 1, SH); q(11, 16, 2, 1, DK);
      // skålen och foten
      q(6, 18, 12, 3, OL); q(7, 18, 10, 3, PO); q(7, 18, 10, 1, SH); q(15, 19, 2, 2, SH); q(8, 19, 1, 1, WH);
      q(7, 21, 10, 2, OL); q(8, 21, 8, 2, PO); q(14, 21, 2, 2, SH); q(9, 22, 2, 1, DK);
      q(6, 23, 12, 2, OL); q(7, 23, 10, 1, SH); q(8, 23, 3, 1, GR); q(13, 23, 2, 1, GR);
      // pumpen (skaft + röd gummikopp)
      q(19, 8, 4, 14, OL); q(20, 9, 2, 12, '#a86a3a'); q(21, 9, 1, 12, '#6e4020'); q(20, 9, 1, 1, '#d8a070');
      q(18, 20, 6, 5, OL); q(19, 21, 4, 3, '#c03a2e'); q(22, 21, 1, 3, '#7a1a18'); q(19, 23, 4, 1, '#7a1a18'); q(19, 21, 2, 1, '#e8705e');
      // toarullen på golvet
      q(0, 20, 5, 5, OL); q(1, 21, 3, 3, '#f4f2ea'); q(1, 23, 3, 1, '#c8c4b8'); q(2, 22, 1, 1, '#9a968a');
      // skugga på golvet (halvgenomskinlig, som arkens egna skuggor)
      x.fillStyle = 'rgba(0,1,4,0.3)';
      x.fillRect(ox + 5, oy + 25, 14, 1); x.fillRect(ox + 7, oy + 26, 10, 1);
      x.fillRect(ox + 18, oy + 25, 6, 1); x.fillRect(ox, oy + 25, 5, 1);
    } else {
      r(ox + 5, oy + 28, 12, 12, '#3a1a0e'); r(ox + 6, oy + 29, 10, 10, '#b5652f'); r(ox + 6, oy + 29, 10, 2, '#d8864a'); r(ox + 13, oy + 31, 3, 8, '#8a4a22');
      const leaf = (cx, cy, rx, ry) => {
        for (let yy = -ry; yy <= ry; yy++) for (let xx = -rx; xx <= rx; xx++) {
          const d = Math.hypot(xx / rx, yy / ry);
          if (d >= 1) continue;
          x.fillStyle = d > 0.78 ? '#1a4a26' : xx === 0 ? '#7fd48a' : (xx + yy < 0 ? '#5fbf6e' : '#2f8f46');
          x.fillRect(ox + cx + xx, oy + cy + yy, 1, 1);
        }
      };
      r(ox + 10, oy + 14, 2, 15, '#2c6e3a');
      leaf(6, 18, 5, 4); leaf(16, 16, 5, 4); leaf(11, 8, 5, 5); leaf(5, 26, 4, 3); leaf(17, 25, 4, 3); leaf(12, 19, 4, 3);
    }
  }
  // frames.js i ursprungsordning: först de gamla nycklarna, sedan de nya
  const frames = {};
  for (const e of all) frames[e.name] = [e.x, e.y, e.w, e.h];
  return { png: c.toDataURL('image/png'), frames, W: AW, H };
}, { sheets, ALL });
await browser.close();

fs.mkdirSync('assets', { recursive: true });
fs.mkdirSync('js/data', { recursive: true });
fs.writeFileSync('assets/interior.png', Buffer.from(out.png.split(',')[1], 'base64'));
fs.writeFileSync('js/data/frames.js', '// Genererad av tools/build-atlas.mjs – redigera inte för hand.\nexport const FRAMES = ' + JSON.stringify(out.frames) + ';\n');
console.log('frames:', Object.keys(out.frames).length, `(${out.W}×${out.H} px) → assets/interior.png + js/data/frames.js`);
