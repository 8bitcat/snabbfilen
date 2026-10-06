# Halloween-pyntet (maskeradbutiken, Carl 2026-10-06) som inte finns i de köpta arken – ritat som
# pixelkartor i samma stil (mörk kontur, tre toner) och sparat som PNG i tools/atlas-egna/, där
# tools/build-atlas.mjs hämtar dem in i möbelatlasen. Kör: python tools/halloween-art.py
#   pumpa0–1      vanliga pumpor (orange, vit)
#   pumplykta0–2  urholkade pumpor med tre ansikten, släckta (mörka hål)
#   pumplyktaL0–2 samma pumpor med ljuset tänt (hålen lyser) – room.js ritar dem när d.lit
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'atlas-egna')
os.makedirs(OUT, exist_ok=True)

def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)

W, H = 18, 15
CX, CY, RX, RY = 8.5, 8.6, 8.4, 6.3   # pumpans kropp (ellips) under skaftet

def body(pal):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for y in range(H):
        for x in range(W):
            dx, dy = (x + 0.5 - CX) / RX, (y + 0.5 - CY) / RY
            d = dx * dx + dy * dy
            if d > 1: continue
            edge = d > 0.78
            # åsar: lodräta skuggränder som böjer sig med rundningen
            rib = abs(((x - CX) * 0.9) % 4.2 - 2.1) < 0.55 and abs(dx) < 0.92
            c = pal['m']
            if dx < -0.35 and dy < 0.2: c = pal['l']
            if dx < -0.55 and dy < -0.2: c = pal['h']
            if dx > 0.45 or dy > 0.55: c = pal['d']
            if rib: c = pal['r']
            if edge: c = pal['o']
            img.putpixel((x, y), hexc(c))
    # skaftet
    for (x, y, c) in [(8, 0, pal['s2']), (9, 0, pal['s2']), (8, 1, pal['s']), (9, 1, pal['s2']), (8, 2, pal['s']), (9, 2, pal['s']), (10, 1, pal['s2'])]:
        img.putpixel((x, y), hexc(c))
    return img

ORANGE = {'o': '#5a1e08', 'd': '#b8520e', 'm': '#e0701c', 'l': '#ff9d3a', 'h': '#ffc06a', 'r': '#b8520e', 's': '#4a5a1e', 's2': '#6a7a2a'}
VIT = {'o': '#4a4038', 'd': '#b8b0a0', 'm': '#e8e2d4', 'l': '#f6f2e8', 'h': '#ffffff', 'r': '#c8c0b0', 's': '#4a5a1e', 's2': '#6a7a2a'}

# ansiktena (x, y i pumpans ruta): e = öga/näsa/mun-hål
FACES = [
    # klassisk: trekantiga ögon, trekantig näsa, tandat leende
    ['..................',
     '..................',
     '..................',
     '..................',
     '...ee.......ee....',
     '...eee.....eee....',
     '..................',
     '........e.........',
     '..e...........e...',
     '..eeeeeeeeeeeee...',
     '...eee.eee.eee....',
     '....e...e...e.....',
     '..................',
     '..................',
     '..................'],
    # glad: runda ögon och ett stort flin
    ['..................',
     '..................',
     '..................',
     '..................',
     '...ee......ee.....',
     '..eeee....eeee....',
     '...ee......ee.....',
     '..................',
     '..ee..........ee..',
     '...eeeeeeeeeeee...',
     '....eeeeeeeeee....',
     '......eeeeee......',
     '..................',
     '..................',
     '..................'],
    # läskig: arga sneda ögon och en sicksackmun
    ['..................',
     '..................',
     '..................',
     '..................',
     '..e..........e....',
     '..eee......eee....',
     '...eee....eee.....',
     '........ee........',
     '..................',
     '..e.e.e.e.e.e.e...',
     '..eeeeeeeeeeeee...',
     '...e.e.e.e.e.e....',
     '..................',
     '..................',
     '..................'],
]

def carve(img, face, lit):
    for y, row in enumerate(face):
        for x, ch in enumerate(row):
            if ch != 'e' or img.getpixel((x, y))[3] == 0: continue
            if lit:
                # ljuset: gult i mitten, orange mot kanterna (grannarna utan hål)
                n = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= y + dy < len(face) and 0 <= x + dx < len(face[0]) and face[y + dy][x + dx] == 'e')
                c = '#fff4a0' if n >= 3 else '#ffd23f' if n >= 2 else '#ff9d0e'
            else:
                c = '#2a1208'
            img.putpixel((x, y), hexc(c))
    return img

body(ORANGE).save(os.path.join(OUT, 'pumpa0.png'))
body(VIT).save(os.path.join(OUT, 'pumpa1.png'))
for i, f in enumerate(FACES):
    carve(body(ORANGE), f, False).save(os.path.join(OUT, f'pumplykta{i}.png'))
    carve(body(ORANGE), f, True).save(os.path.join(OUT, f'pumplyktaL{i}.png'))

def paint(rows, pal, img=None):
    w = max(len(r) for r in rows)
    if img is None: img = Image.new('RGBA', (w, len(rows)), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in '. ': continue
            img.putpixel((x, y), hexc(pal[ch]))
    return img

# ---------------- skelettet (står själv, till pyntet utanför och hemma) ----------------
SKELETT = [
    '.....ooooo.....',
    '....owwwwwo....',
    '...owwwwwwwo...',
    '...owkkwkkwo...',
    '...owkkwkkgo...',
    '...owwwkwwgo...',
    '....owwwwgo....',
    '....owkwkwo....',
    '.....ooooo.....',
    '.......w.......',
    '...ooooworoo...',
    '..owwwwwwwwgo..',
    '.owo.owwwo.ogo.',
    '.owo.wgwgw.ogo.',
    '.owo.owwwo.ogo.',
    '.owo.wgwgw.ogo.',
    '.owo..wgw..ogo.',
    '.owo...w...ogo.',
    '.oww...w...wgo.',
    '..oo.owwwo.oo..',
    '....owwwwgo....',
    '....ow.o.go....',
    '....ow...go....',
    '....owo.ogo....',
    '....ow...go....',
    '....ow...go....',
    '...oww...wgo...',
    '...ooo...ooo...',
]
paint(SKELETT, {'o': '#2a2430', 'w': '#f4f1ea', 'g': '#c8c0b0', 'k': '#1c1820', 'r': '#c8c0b0'}).save(os.path.join(OUT, 'skelett0.png'))

# ---------------- häxkitteln (bubblar: tre bildrutor) ----------------
def kittel(f):
    img = Image.new('RGBA', (18, 16), (0, 0, 0, 0))
    P = lambda x, y, c: img.putpixel((x, y), hexc(c))
    # grytan: rund svart kropp med ljuskant
    for y in range(5, 14):
        for x in range(1, 17):
            dx, dy = (x + 0.5 - 9) / 8, (y + 0.5 - 8) / 6.5
            if dx * dx + dy * dy > 1: continue
            c = '#2a2a34' if dx < -0.4 and dy < 0.3 else '#1c1c24'
            if dx * dx + dy * dy > 0.8: c = '#0e0e14'
            P(x, y, c)
    for x in range(1, 17): P(x, 5, '#4a4a58'); P(x, 4, '#0e0e14')
    # benen
    for x in (4, 13): P(x, 14, '#0e0e14'); P(x, 15, '#0e0e14')
    P(9, 14, '#0e0e14'); P(9, 15, '#0e0e14')
    # det gröna trolldrycket och bubblorna
    for x in range(2, 16): P(x, 3, '#46c85a' if (x + f) % 3 else '#8af08a')
    for x in range(3, 15): P(x, 2, '#2f9a46') if (x * 7 + f * 3) % 5 == 0 else None
    for (bx, by) in [((5 + f * 4) % 12 + 3, 1 - (f % 2)), ((11 + f * 3) % 12 + 3, 0 + (f % 2))]:
        P(bx, max(0, by), '#8af08a'); 
    return img
for f in range(3): kittel(f).save(os.path.join(OUT, f'haxkittel{f}.png'))

# ---------------- fladdermössen (på väggen, två bildrutor: vingarna upp/ner) ----------------
FL_UPP = ['o.......o.........', 'oo.....oo.........', 'ooo.o.ooo...o...o.', '.oooooooo...oo.oo.', '..ooyoyo....oooooo', '...ooooo.....oyoyo', '....o.o.......ooo.', '...............o.o.']
FL_NER = ['....o.o...........', '...ooooo.....o.o..', '..ooyoyo....ooooo.', '.oooooooo..ooyoyoo', 'ooo.o.ooo.oooooooo', 'oo.....oo.oo.o.o.o', 'o.......o.o.......', '..................']
paint(FL_UPP, {'o': '#1c1428', 'y': '#ffd23f'}).save(os.path.join(OUT, 'fladdermoss0.png'))
paint(FL_NER, {'o': '#1c1428', 'y': '#ffd23f'}).save(os.path.join(OUT, 'fladdermoss1.png'))

# ---------------- spindelnätet (i ett hörn på väggen, med en spindel) ----------------
img = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
import math
TRAD = (236, 240, 246, 190)
for ang in [2, 30, 60, 88]:                      # fyra ekrar ut från hörnet
    for r in range(1, 16):
        x, y = round(r * math.cos(math.radians(ang))), round(r * math.sin(math.radians(ang)))
        if 0 <= x < 16 and 0 <= y < 16: img.putpixel((x, y), TRAD)
for rad in (6, 11):                              # två hängande bågar mellan ekrarna
    for i in range(3):
        a0, a1 = [2, 30, 60, 88][i], [2, 30, 60, 88][i + 1]
        for k in range(9):
            t = k / 8; ang = a0 + (a1 - a0) * t; rr = rad - math.sin(t * math.pi) * 1.2
            x, y = round(rr * math.cos(math.radians(ang))), round(rr * math.sin(math.radians(ang)))
            if 0 <= x < 16 and 0 <= y < 16: img.putpixel((x, y), TRAD)
for y in range(8, 12): img.putpixel((12, y), (200, 204, 210, 170))   # tråden spindeln hänger i
for (x, y) in [(11, 12), (12, 12), (13, 12), (11, 13), (12, 13), (13, 13), (10, 12), (14, 12), (10, 14), (14, 14), (10, 11), (14, 11)]: img.putpixel((x, y), hexc('#1c1820'))
img.putpixel((12, 12), hexc('#d9433b'))
img.save(os.path.join(OUT, 'spindelnat0.png'))

print('halloween:', sorted(f for f in os.listdir(OUT) if f.split('.')[0].rstrip('0123456789L') in ('pumpa', 'pumplykta', 'skelett', 'haxkittel', 'fladdermoss', 'spindelnat')))
