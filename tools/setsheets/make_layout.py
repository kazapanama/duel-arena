"""Малює layout_template.png — шаблон аркуша деталей для генератора (прикріплювати до промпту).
   Пурпуровий фон, чорна сітка, сірі пунктирні «привиди» деталей у масштабі гри (5 px на одиницю рига),
   щоб деталі виходили того ж розміру, що й повна фігура. Без тексту — генератор копіює написи."""
import os
from PIL import Image, ImageDraw
W, H = 1536, 1024
CW, RH = 384, 341
U = 5                     # пікселів аркуша на одиницю рига (боєць ~125 одиниць → ~620 px)
img = Image.new('RGB', (W, H), (255, 0, 255))
d = ImageDraw.Draw(img)
G = (150, 150, 150)

def dashed(points, closed=True, w=3, dash=14, gap=9):
    pts = points + ([points[0]] if closed else [])
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        L = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5 or 1
        t = 0
        while t < L:
            t1 = min(L, t + dash)
            d.line([(x0 + (x1 - x0) * t / L, y0 + (y1 - y0) * t / L), (x0 + (x1 - x0) * t1 / L, y0 + (y1 - y0) * t1 / L)], fill=G, width=w)
            t += dash + gap

def ellipse(cx, cy, rx, ry, n=40):
    import math
    dashed([(cx + rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n)])

def capsule(cx, top, w, h):
    dashed([(cx - w / 2, top), (cx + w / 2, top), (cx + w / 2, top + h), (cx - w / 2, top + h)])

def cell(c, r):   # центр клітинки правої частини
    return (c * CW + CW // 2, r * RH + RH // 2)

# повна фігура (колонка 1, рядки 1–2): простий манекен у напівоберті, ноги внизу клітинки
cx, foot = CW // 2, 2 * RH - 30
hip = foot - 49 * U; neck = hip - 40 * U
ellipse(cx + 8, neck - 15 * U, 12 * U, 15 * U)                                   # голова зі шоломом
dashed([(cx - 19 * U, neck), (cx + 21 * U, neck), (cx + 15 * U, hip), (cx - 13 * U, hip)])   # тулуб
capsule(cx - 8 * U, hip, 13 * U, 49 * U); capsule(cx + 10 * U, hip, 13 * U, 49 * U)          # ноги
capsule(cx - 25 * U, neck + 4 * U, 11 * U, 40 * U); capsule(cx + 27 * U, neck + 4 * U, 11 * U, 40 * U)  # руки
# рядок 1: шолом | тулуб | низ броні
x, y = cell(1, 0); ellipse(x, y, 14 * U, 17 * U)
x, y = cell(2, 0); dashed([(x - 20 * U, y - 22 * U), (x + 20 * U, y - 22 * U), (x + 15 * U, y + 23 * U), (x - 15 * U, y + 23 * U)])
x, y = cell(3, 0); dashed([(x - 15 * U, y - 14 * U), (x + 15 * U, y - 14 * U), (x + 18 * U, y + 14 * U), (x - 18 * U, y + 14 * U)])
# рядок 2: наплічник | пряма рука | пряма нога з чоботом носком управо
x, y = cell(1, 1)   # наплічник: купол з ободом і шипами — щоб не сплутати з головою
import math
dashed([(x + 13 * U * math.cos(a), y + 2 * U - 11 * U * math.sin(a)) for a in [i * math.pi / 16 for i in range(17)]] + [(x - 13 * U, y + 6 * U), (x + 13 * U, y + 6 * U)])
for a in (0.5, 1.2, 1.9, 2.6): dashed([(x + 12 * U * math.cos(a), y + 2 * U - 10 * U * math.sin(a)), (x + 19 * U * math.cos(a), y + 2 * U - 17 * U * math.sin(a))], closed=False)
x, y = cell(2, 1); capsule(x, y - 21 * U, 11 * U, 42 * U); dashed([(x - 9 * U, y - 1 * U), (x + 9 * U, y - 1 * U)], closed=False)   # риска — лікоть
x, y = cell(3, 1); top = y - 29 * U
capsule(x - 3 * U, top, 13 * U, 48 * U); dashed([(x - 10 * U, top + 25 * U), (x + 4 * U, top + 25 * U)], closed=False)  # риска — коліно
dashed([(x - 10 * U, top + 48 * U), (x + 4 * U, top + 48 * U), (x + 14 * U, top + 56 * U), (x - 10 * U, top + 56 * U)])  # чобіт
# рядок 3: зброя (по діагоналі, вся в клітинці) | друга зброя | плащ
for c in (1, 2):
    x, y = cell(c, 2)
    dashed([(x - 22 * U, y + 22 * U), (x + 12 * U, y - 12 * U)], closed=False, w=4)
    dashed([(x + 4 * U, y - 26 * U), (x + 26 * U, y - 4 * U), (x + 16 * U, y + 6 * U), (x - 6 * U, y - 16 * U)])
x, y = cell(3, 2); dashed([(x - 10 * U, y - 23 * U), (x + 10 * U, y - 23 * U), (x + 18 * U, y + 23 * U), (x - 18 * U, y + 23 * U)])
# палітра: ряд порожніх квадратів
for i in range(10):
    x0 = 22 + i * 35; dashed([(x0, 2 * RH + 140), (x0 + 28, 2 * RH + 140), (x0 + 28, 2 * RH + 168), (x0, 2 * RH + 168)], dash=6, gap=4, w=2)
# сітка
L = (0, 0, 0)
for xx in (CW, 2 * CW, 3 * CW): d.line([(xx, 0), (xx, H)], fill=L, width=4)
d.line([(CW, RH), (W, RH)], fill=L, width=4); d.line([(0, 2 * RH), (W, 2 * RH)], fill=L, width=4)
d.rectangle([0, 0, W - 1, H - 1], outline=L, width=4)
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'layout_template.png')
img.save(out); print(out)
