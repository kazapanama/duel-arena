"""Малює cat_layout_template.png — шаблон аркуша деталей форми кота (прикріплювати до промпту першим зображенням).
   Сітка 4×2 (клітинки 384×512): [повний кіт | голова | хвіст] / [тіло | передня лапа | задня лапа];
   повний кіт і тіло займають по дві клітинки. Сірі пунктирні «привиди» — у масштабі ригу кота (js/cat.js), 5 px на одиницю."""
import os, math
from PIL import Image, ImageDraw
W, H, CW, RH, U = 1536, 1024, 384, 512, 5
img = Image.new('RGB', (W, H), (255, 0, 255)); d = ImageDraw.Draw(img); G = (150, 150, 150)

def dashed(pts, closed=True, w=3, dash=14, gap=9):
    pts = pts + ([pts[0]] if closed else [])
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0) or 1; t = 0
        while t < L:
            t1 = min(L, t + dash)
            d.line([(x0 + (x1 - x0) * t / L, y0 + (y1 - y0) * t / L), (x0 + (x1 - x0) * t1 / L, y0 + (y1 - y0) * t1 / L)], fill=G, width=w)
            t += dash + gap
def ell(cx, cy, rx, ry, n=36): dashed([(cx + rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n)])
def body(cx, cy):          # тулуб збоку: крижі зліва, груди справа (як catBody у js/cat.js)
    dashed([(cx + x * U, cy + y * U) for x, y in [(-37, -2), (-30, -17), (-10, -16), (20, -21), (36, -14), (38, -2), (30, 14), (0, 16), (-24, 13), (-36, 8)]])
def head(cx, cy):          # голова праворуч мордою, вуха вгору
    ell(cx, cy, 11 * U * 1.2, 9 * U * 1.2); ell(cx + 10 * U, cy + 3 * U, 7 * U, 4.5 * U)
    dashed([(cx - 4 * U, cy - 8 * U), (cx - 3 * U, cy - 19 * U), (cx + 4 * U, cy - 9 * U)])
def leg(cx, top, L, w):    # пряма вертикальна лапа: корінь угорі, лапа-ступня внизу
    dashed([(cx - w / 2 * U, top), (cx + w / 2 * U, top), (cx + w * 0.3 * U, top + L * U), (cx - w * 0.3 * U, top + L * U)])
    dashed([(cx - 5 * U, top + L * U), (cx + 9 * U, top + L * U), (cx + 9 * U, top + (L + 5) * U), (cx - 5 * U, top + (L + 5) * U)])

# повний кіт (клітинки 1–2 верхнього ряду), ступні — внизу клітинки
fx, gy = CW, RH - 40
body(fx, gy - 42 * U); head(fx + 46 * U, gy - 60 * U)
for x, L in ((24, 37), (-22, 40)): leg(fx + x * U, gy - 42 * U, L - 5, 12)
dashed([(fx - 37 * U, gy - 48 * U), (fx - 60 * U, gy - 58 * U), (fx - 72 * U, gy - 50 * U)], closed=False, w=4)
# голова, хвіст
head(2 * CW + CW // 2 - 20, RH // 2 + 20)
x0, y0 = 3 * CW + CW - 60, RH // 2          # хвіст: основа праворуч, кінчик ліворуч
dashed([(x0, y0 - 4 * U), (x0 - 50 * U, y0 - 10 * U), (x0 - 52 * U, y0 - 4 * U), (x0, y0 + 4 * U)])
# тіло (клітинки 1–2 нижнього ряду), лапи
body(CW, RH + RH // 2)
leg(2 * CW + CW // 2, RH + 70, 37, 14)
leg(3 * CW + CW // 2, RH + 50, 41, 18)
# сітка: повний кіт і тіло — по дві клітинки
L = (0, 0, 0)
for xx in (2 * CW, 3 * CW): d.line([(xx, 0), (xx, H)], fill=L, width=4)
d.line([(0, RH), (W, RH)], fill=L, width=4); d.rectangle([0, 0, W - 1, H - 1], outline=L, width=4)
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cat_layout_template.png'); img.save(out); print(out)
