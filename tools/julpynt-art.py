# Julpyntet som inte finns i de köpta arken – ritat för hand som pixelkartor i samma stil
# (mörk kontur, tre toner, arkens färger) och sparat som PNG i tools/atlas-egna/, där
# tools/build-atlas.mjs hämtar dem in i möbelatlasen. Kör: python tools/julpynt-art.py
# (kulgranen byggs av arkets nakna gran + julgranskulor och stjärnan, därför läses Xmas.png)
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'atlas-egna')
XMAS = 'D:/GamesProjects/Palssons Gard/assets/Objects/Interior/Xmas.png'
os.makedirs(OUT, exist_ok=True)

def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)

def paint(rows, pal, img=None, ox=0, oy=0):
    w = max(len(r) for r in rows)
    if img is None: img = Image.new('RGBA', (w, len(rows)), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in '. ': continue
            c = pal[ch]
            img.putpixel((ox + x, oy + y), hexc(c) if isinstance(c, str) else c)
    return img

O = '#1c0a18'
SHADOW = (0, 1, 4, 77)   # arkens egen halvgenomskinliga golvskugga

# ---------------- adventsstjärnan (hänger i fönstret, lyser) ----------------
STAR = [
    '......k......',
    '......k......',
    '......o......',
    '.....olo.....',
    '.....olo.....',
    '....olwlo....',
    'ooooolwyloooo',
    'olllmwyywmllo',
    '.ommmyyyymmo.',
    '..ommyyymmo..',
    '...omyyymo...',
    '...ommmmmo...',
    '..ommo.ommo..',
    '..omo...omo..',
    '..oo.....oo..',
]
STAR_COL = {   # röd, vit, guld: d mörk, m mitt, l ljus
    0: {'m': '#c41b24', 'l': '#eb262e', 't': '#80162e'},
    1: {'m': '#d2e0ee', 'l': '#ffffff', 't': '#96a4e6'},
    2: {'m': '#ff9d0e', 'l': '#ffc71b', 't': '#963e0c'},
}
for v, c in STAR_COL.items():
    pal = {'o': O, 'k': '#352026', 'w': '#ffffff', 'y': '#ffeb47', **c}
    if v == 1: pal['y'] = '#fff4c8'
    paint(STAR, pal).save(os.path.join(OUT, f'adventsstjarna{v}.png'))

# ---------------- elektriska adventsljusstaken (sju ljus i en trappa) ----------------
def ljusstake(base, dark):
    W = 23
    img = Image.new('RGBA', (W, 14), (0, 0, 0, 0))
    P = lambda x, y, c: img.putpixel((x, y), hexc(c))
    # foten: en trappformad träbåge, sju ljus på var sitt steg (mitten högst)
    tops = [7, 5, 3, 1, 3, 5, 7]
    for i, ty in enumerate(tops):
        x = 1 + i * 3
        for y in range(ty + 2, 11):
            P(x, y, O); P(x + 2, y, O); P(x + 1, y, '#f2ead0' if y > ty + 3 else '#ffffff')
        P(x + 1, ty + 1, '#ffeb47'); P(x + 1, ty, '#fff4c8')      # lampan lyser
    # bågen
    for x in range(W):
        step = min(x // 3, (W - 1 - x) // 3)
        top = 11 - min(step, 3)
        for y in range(top, 14):
            edge = y == 13 or x == 0 or x == W - 1 or y == top
            P(x, y, O if edge else (base if y < 12 else dark))
    return img
ljusstake('#963e0c', '#4a2123').save(os.path.join(OUT, 'adventsljus0.png'))
ljusstake('#f2ead0', '#b3a276').save(os.path.join(OUT, 'adventsljus1.png'))

# ---------------- julbocken (halm med röda band) ----------------
BOCK = [
    '..o..o..........',
    '.oho.ho.........',
    '.oho.oho........',
    '..ohoohho.......',
    '...ohhho........',
    '..ohhlho........',
    '.ohhhhho........',
    '.oohhhoo........',
    '...ohro.........',
    '...ohroooooooo..',
    '..ohhhhhhhhhhhoo',
    '..ohllllllllhhho',
    '..ohhhrhhhhrhhho',
    '..ohhhrhhhhrhhho',
    '...oddrddddrddo.',
    '...oho.....oho..',
    '...oro.....oro..',
    '...oho.....oho..',
    '...ooo.....ooo..',
]
BOCK_PAL = {'o': '#4a2123', 'h': '#d9a441', 'l': '#f3d27a', 'd': '#9a6a22', 'r': '#c41b24'}
paint(BOCK, BOCK_PAL).save(os.path.join(OUT, 'julbock0.png'))

# ---------------- pepparkakshuset ----------------
HUS = [
    '.......oo.......',
    '......owwo......',
    '.....owggwo.....',
    '....owggggwo....',
    '...owgrggrgwo...',
    '..owggggggggwo..',
    '.owwwwwwwwwwwwo.',
    '.oppppppppppppo.',
    '.opwwpprpppwwpo.',
    '.opwypppppppwpo.',
    '.opwwppooppwwpo.',
    '.oppppoyyopppp o',
    '.odddddoyyodddo.',
    'oooooooooooooooo',
]
HUS_PAL = {'o': '#352026', 'w': '#ffffff', 'g': '#963e0c', 'r': '#eb262e', 'p': '#c8702a', 'd': '#963e0c', 'y': '#ffc71b'}
img = paint([r.replace(' ', '.') for r in HUS], HUS_PAL)
img.save(os.path.join(OUT, 'pepparkakshus0.png'))

# ---------------- granen med julgranskulor (fyra färger) ----------------
xm = Image.open(XMAS).convert('RGBA')
naken = xm.crop((0, 48, 32, 96))          # arkets nakna gran (samma ruta som julgran0)
klar = xm.crop((32, 48, 64, 96))          # den klädda granen – stjärnan hämtas härifrån
STJ = [(x, y) for x in range(32) for y in range(0, 10) if klar.getpixel((x, y))[3] > 0 and naken.getpixel((x, y))[3] == 0 or (y < 8 and klar.getpixel((x, y))[3] > 0)]
KULOR = [(14, 11), (9, 17), (19, 18), (5, 25), (15, 24), (23, 26), (10, 31), (19, 31), (5, 36), (24, 36), (14, 36)]
KULA = ['.mm.', 'mhmm', 'mmmd', '.dd.']
KULFARG = {   # röd, guld, blå, silver: mörk, mitt, glans
    0: ('#5e0c0c', '#c41b24', '#f27e7b'),
    1: ('#963e0c', '#ffc71b', '#ffeb47'),
    2: ('#1a3473', '#286ed0', '#2eafc7'),
    3: ('#96a4e6', '#d2e0ee', '#ffffff'),
}
for v, (dk, md, hi) in KULFARG.items():
    t = naken.copy()
    for (x, y) in STJ: t.putpixel((x, y), klar.getpixel((x, y)))
    for (x, y) in KULOR:
        for j, row in enumerate(KULA):
            for i, ch in enumerate(row):
                if ch == '.' or naken.getpixel((x + i, y + j))[3] == 0: continue
                t.putpixel((x + i, y + j), hexc({'m': md, 'h': hi, 'd': dk}[ch]))
    t.save(os.path.join(OUT, f'kulgran{v}.png'))

print('julpynt:', sorted(os.listdir(OUT)))
