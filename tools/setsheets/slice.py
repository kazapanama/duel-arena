"""Ріже згенерований аркуш деталей (пурпуровий фон, чорна сітка) на окремі PNG із прозорістю.
   python tools/setsheets/slice.py <аркуш> <тека-виходу>          — макет layout_template.png (сітку шукає сам)
   python tools/setsheets/slice.py <аркуш> <тека-виходу> --old    — перший аркуш Gemini (_refs/onslaught_gemini_parts.jpg)"""
import sys, os
import numpy as np
from PIL import Image

OLD_CELLS = {  # перший аркуш Gemini: назва → (x0, y0, x1, y1)
    'full':     (0, 0, 420, 371),
    'helm':     (421, 0, 708, 283),  'torso': (709, 0, 991, 283),  'shoulder': (992, 0, 1264, 283),
    'lower':    (421, 284, 708, 564), 'arm':  (709, 284, 991, 564), 'leg':      (992, 284, 1264, 564),
    'weapon':   (709, 565, 991, 848), 'weapon2': (421, 565, 708, 848), 'cape': (992, 565, 1264, 848),
}

# колір фону аркуша: 'magenta' (#FF00FF, звичайні сети) або 'green' (#00FF00 — для фіолетових істот, напр. демона
# Metamorphosis: на пурпурі їхні кольори зрізаються разом із фоном). Ставить assemble.py із поля bg завдання
KEY = 'magenta'

def magenta_score(a):
    """Наскільки піксель схожий на фон (>90 — фон, 25..90 — ореол на краю деталі)."""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    if KEY == 'green':
        return g - np.maximum(r, b) - 0.5 * np.abs(r - b)
    # пурпур фону: R і B високі й майже рівні, G низький. Фіолетові деталі (сяйво, руни) мають B помітно
    # вище за R — без штрафу за |R−B| вони вирізались як фон, а решта фіолетового знебарвлювалась до сірого
    return np.minimum(r, b) - g - 1.5 * np.abs(r - b)

def unfringe(a, mask, lift=20):
    """Прибрати відтінок фону з пікселів ореолу (mask)."""
    if KEY == 'green':
        a[mask, 1] = np.minimum(a[mask, 1], np.maximum(a[mask, 0], a[mask, 2]) + lift)
    else:
        a[mask, 0] = np.minimum(a[mask, 0], a[mask, 1] + lift)
        a[mask, 2] = np.minimum(a[mask, 2], a[mask, 1] + lift)

def cut(img, box, inset=5):
    x0, y0, x1, y1 = box
    a = np.asarray(img.crop((x0 + inset, y0 + inset, x1 - inset, y1 - inset)).convert('RGB')).astype(np.int32)
    m = magenta_score(a)
    alpha = np.where(m > 90, 0, 255).astype(np.uint8)            # чистий фон
    from scipy import ndimage
    near_bg = ndimage.binary_dilation(m > 90, iterations=2)      # лише край деталі біля фону: сяйво всередині не чіпати
    fringe = (m > 25) & (alpha > 0) & near_bg                     # ореол JPEG на краях
    a2 = a.copy()
    unfringe(a2, fringe)                                          # прибрати відтінок фону
    alpha[(m > 60)] = 0
    # лишаємо головну деталь і шматки, що прилягають до неї (роги, пір'я, кутасті краї); дрібне сміття JPEG
    # і уламки сусідніх деталей, що залізли в клітинку (ріг наплічника біля шолома), — відкидаємо
    from scipy import ndimage
    lab, n = ndimage.label(alpha > 0)
    keep = np.zeros(alpha.shape, bool)
    if n:
        sizes = ndimage.sum(np.ones_like(lab), lab, index=range(1, n + 1))
        main = int(np.argmax(sizes)) + 1
        near = ndimage.binary_dilation(lab == main, iterations=14)      # «впритул» — до ~2 арт-пікселів
        for i, sz in enumerate(sizes, 1):
            if sz > 150 and (i == main or sz > 0.35 * sizes[main - 1] or near[lab == i].any()): keep |= lab == i
    alpha[~keep] = 0
    ys, xs = np.nonzero(alpha)
    y0b, y1b, x0b, x1b = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    out = np.dstack([a2.clip(0, 255).astype(np.uint8), alpha])[y0b:y1b, x0b:x1b]
    return Image.fromarray(out)

def find_lines(dark, axis, n, frac=0.55):
    """Позиції n найсильніших довгих темних ліній уздовж осі (0 — вертикальні)."""
    prof = dark.mean(axis=axis)
    idx = np.argsort(prof)[::-1]
    picked = []
    for i in idx:
        if prof[i] < frac: break
        if all(abs(i - j) > 20 for j in picked): picked.append(int(i))
        if len(picked) == n: break
    return sorted(picked)

def template_cells(img):
    """Клітинки макета layout_template.png: 4 колонки × 3 рядки, ліва висока клітинка — повна фігура."""
    a = np.asarray(img.convert('RGB')).astype(np.int32)
    H, W = a.shape[:2]
    dark = a.sum(2) < 200
    xs = find_lines(dark[:, 8:W - 8], 0, 3)
    xs = [x + 8 for x in xs] if len(xs) == 3 else [W // 4, W // 2, 3 * W // 4]
    ys = find_lines(dark[8:H - 8, xs[0] + 10:], 1, 2)
    ys = [y + 8 for y in ys] if len(ys) == 2 else [H // 3, 2 * H // 3]
    X = [0] + xs + [W]; Y = [0] + ys + [H]
    c = lambda col, row: (X[col], Y[row], X[col + 1], Y[row + 1])
    return {'full': (0, 0, X[1], Y[2]), 'palette': c(0, 2),
            'helm': c(1, 0), 'torso': c(2, 0), 'lower': c(3, 0),
            'shoulder': c(1, 1), 'arm': c(2, 1), 'leg': c(3, 1),
            'weapon': c(1, 2), 'weapon2': c(2, 2), 'cape': c(3, 2)}

def cat_cells(img):
    """Клітинки cat_layout_template.png: 4×2, повний кіт і тіло — по дві клітинки ліворуч."""
    a = np.asarray(img.convert('RGB')).astype(np.int32)
    H, W = a.shape[:2]
    dark = a.sum(2) < 200
    xs = find_lines(dark[:, 8:W - 8], 0, 2)
    xs = [x + 8 for x in xs] if len(xs) == 2 else [W // 2, 3 * W // 4]
    ys = find_lines(dark[8:H - 8, :], 1, 1)
    ys = [y + 8 for y in ys] if len(ys) == 1 else [H // 2]
    X = [0] + xs + [W]; Y = [0] + ys + [H]
    return {'full': (0, 0, X[1], Y[1]), 'head': (X[1], 0, X[2], Y[1]), 'tail': (X[2], 0, W, Y[1]),
            'body': (0, Y[1], X[1], H), 'front': (X[1], Y[1], X[2], H), 'hind': (X[2], Y[1], W, H)}

def main():
    src, dst = sys.argv[1], sys.argv[2]
    os.makedirs(dst, exist_ok=True)
    img = Image.open(src)
    if '--auto' in sys.argv:   # slice.py аркуш тека --auto helm=560,200 torso=950,210 ...
        picks = {a.split('=')[0]: tuple(int(v) for v in a.split('=')[1].split(',')) for a in sys.argv[3:] if '=' in a}
        return auto_parts(img, picks, dst)
    cells = OLD_CELLS if '--old' in sys.argv else template_cells(img)
    for name, box in cells.items():
        if name == 'palette': continue
        try:
            p = cut(img, box)
        except ValueError:          # порожня клітинка (немає другої зброї чи плаща)
            print(name, '— порожньо'); continue
        p.save(os.path.join(dst, name + '.png'))
        print(name, p.size, 'з клітинки', box)


# ---------- режим --auto: деталі як зв'язні плями (сітка генератора може не збігатися з шаблоном) ----------
def auto_parts(img, picks, dst):
    """picks: {назва: (x, y)} — точка всередині потрібної деталі в пікселях аркуша."""
    from scipy import ndimage
    a = np.asarray(img.convert('RGB')).astype(np.int32)
    m = magenta_score(a)
    fg = m < 60
    dark = a.sum(2) < 75          # лінії сітки — майже чорні (складки плаща темно-бурі, їх не чіпаємо)
    # прибрати лінії сітки: довгі прямі темні відрізки
    line = np.zeros_like(fg)
    for axis in (0, 1):
        d = dark if axis == 1 else dark.T
        out = line if axis == 1 else line.T
        for i in range(d.shape[0]):
            row = d[i]; j = 0; n = len(row)
            while j < n:
                if row[j]:
                    k = j
                    while k < n and row[k]: k += 1
                    if k - j > 220: out[i, j:k] = True
                    j = k
                else: j += 1
    line = ndimage.binary_dilation(line, iterations=2)
    fg &= ~line
    lab, n = ndimage.label(fg)
    for name, (x, y) in picks.items():
        # пляма під точкою; якщо точка влучила в отвір — найближча пляма
        idx = lab[y, x]
        if idx == 0:
            ys, xs = np.nonzero(lab)
            k = np.argmin((ys - y) ** 2 + (xs - x) ** 2); idx = lab[ys[k], xs[k]]
        mask = ndimage.binary_closing(lab == idx, iterations=1)
        ys, xs = np.nonzero(mask)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        rgb = a[y0:y1, x0:x1].copy()
        mm = m[y0:y1, x0:x1]
        fr = (mm > 20)
        unfringe(rgb, fr)
        alpha = (mask[y0:y1, x0:x1] * 255).astype(np.uint8)
        Image.fromarray(np.dstack([rgb.clip(0, 255).astype(np.uint8), alpha])).save(os.path.join(dst, name + '.png'))
        print(name, (x1 - x0, y1 - y0), 'bbox', (x0, y0, x1, y1))

if __name__ == '__main__':
    main()
