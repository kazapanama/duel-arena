"""Іконки застосунку (PWA) для «Азерот Арени» з піксельних img/vs.svg і img/felflame.svg.

   python tools/pwa_icons.py

Пише в img/pwa/: icon-192.png, icon-512.png, icon-maskable-512.png (вміст у безпечній зоні 80%),
apple-touch-icon.png (180×180, без прозорості — iOS її чорнить). Обидва SVG складаються з квадратиків-<rect>,
тож розбираємо їх самі й малюємо Pillow без растеризаторів SVG."""
import os, re
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'img', 'pwa')

# смуги золотого градієнта логотипу (vs.svg: fill=url(#g), y від 2 до 10, чотири рівні смуги)
GOLD_BANDS = ['#fff6cc', '#f5cf62', '#d99a32', '#8a4f16']


def hex_rgba(h, a=1.0):
    h = h.lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), round(255 * a))


def load_pixels(svg_name):
    """SVG з <rect> → (ширина, висота, [(x, y, w, h, (r,g,b,a))])."""
    src = open(os.path.join(ROOT, 'img', svg_name), encoding='utf-8').read()
    vb = re.search(r"viewBox='0 0 (\d+) (\d+)'", src)
    w, h = int(vb.group(1)), int(vb.group(2))
    rects = []
    for m in re.finditer(r"<rect ([^>]*?)/>", src):
        a = dict(re.findall(r"([\w-]+)='([^']*)'", m.group(1)))
        x, y, rw, rh = (float(a[k]) for k in ('x', 'y', 'width', 'height'))
        fill = a['fill']
        if fill.startswith('url('):   # градієнт за висотою пікселя
            band = min(3, max(0, int((y - 2) / 2)))   # y — число з плаваючою крапкою
            fill = GOLD_BANDS[band]
        rects.append((x, y, rw, rh, hex_rgba(fill, float(a.get('fill-opacity', 1)))))
    return w, h, rects


def paint(img, pixels, ox, oy, k):
    """Піксельний арт у масштабі k (ціле) з лівим верхнім кутом (ox, oy); напівпрозорі тіні й відблиски змішуються з фоном."""
    w, h, rects = pixels
    for x, y, rw, rh, c in rects:
        x0, y0 = round(ox + x * k), round(oy + y * k)
        x1, y1 = max(x0, round(ox + (x + rw) * k) - 1), max(y0, round(oy + (y + rh) * k) - 1)   # тонкі підсвітки — не менше пікселя
        layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).rectangle([x0, y0, x1, y1], fill=c)
        img.alpha_composite(layer)


def tile(size, safe):
    """Квадратна іконка size×size; safe — частка сторони, у яку вкладено вміст (для maskable — 0.8)."""
    S = 128                       # малюємо в «піксельній» сітці 128×128 і збільшуємо цілим множником
    img = Image.new('RGBA', (S, S), hex_rgba('#140d0b'))
    d = ImageDraw.Draw(img)
    # різьблений камінь: світлішає до центру, як рамки .pf в інтерфейсі
    for r in range(S // 2, 0, -1):
        t = 1 - r / (S / 2)
        base = (20, 13, 11)
        top = (59, 42, 34)
        col = tuple(round(base[i] + (top[i] - base[i]) * t * 0.9) for i in range(3)) + (255,)
        d.rectangle([S // 2 - r, S // 2 - r, S // 2 + r - 1, S // 2 + r - 1], fill=col)
    # золота оправа зі скошеними кутами; у maskable вона лежить у безпечній зоні
    m = round(S * (1 - safe) / 2) + 3
    gold = [hex_rgba(c) for c in ('#fff0b0', '#e9b949', '#8a5a1a')]
    for i, c in enumerate(gold):
        a = m + i
        d.rectangle([a + 2, a, S - a - 3, S - a - 1], outline=c)
        d.rectangle([a, a + 2, S - a - 1, S - a - 3], outline=c)
    inner = m + 4
    # логотип VS по центру, полум'я Фелу над ним
    vs = load_pixels('vs.svg')
    kv = max(1, int((S - 2 * inner - 8) // vs[0]))
    vw, vh = vs[0] * kv, vs[1] * kv
    flame = load_pixels('felflame.svg')
    kf = max(1, kv // 2)
    fw, fh = flame[0] * kf, flame[1] * kf
    total = fh + 4 + vh
    top = (S - total) // 2
    paint(img, flame, (S - fw) // 2, top, kf)
    paint(img, vs, (S - vw) // 2, top + fh + 4, kv)
    return img.resize((size, size), Image.NEAREST)


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [('icon-192.png', 192, 0.9), ('icon-512.png', 512, 0.9), ('icon-maskable-512.png', 512, 0.66),
            ('apple-touch-icon.png', 180, 0.9)]
    for name, size, safe in jobs:
        im = tile(size, safe)
        if name.startswith('apple'):
            im = im.convert('RGB')
        im.save(os.path.join(OUT, name), optimize=True)
        print(name, os.path.getsize(os.path.join(OUT, name)), 'байт')


if __name__ == '__main__':
    main()
