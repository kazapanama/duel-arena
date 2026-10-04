"""Пакує нарізані деталі набору (img/cutout/<набір>/*.png) у JS із data-URI, щоб гра працювала й через file://
   (інакше полотно «брудне» і getImageData падає), і рахує точки кріплення до кісток рига.
   python tools/setsheets/pack_cutout.py <набір> [--weapons axe1h,sword1h]   →  img/cutout/<набір>.js
   Типи зброї: як у js/paint.js (staff, axe2h, axe1h, sword1h, sword2h, mace1h, hammer1h, hammer2h, spear, dagger, bow,
   pistol, shield). Рука й нога на аркуші прямі й вертикальні, зброя — по діагоналі знизу-зліва (руків'я) вгору-вправо."""
import sys, os, io, json, base64
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = 1.4        # арт-пікселів на світову одиницю для бійців із растрових деталей (у бою; процедурні — 0.7)
MARGIN = 1.3     # запас роздільності над ігровою: браузер ще трохи зменшує
PALETTE = 64     # кольорів у палітрі набору (квантизація піксельного конвеєра)
# зброя в системі кисті (y угору — мінус): [руків'я, вістря] уздовж осі, як малює procedural drawWeapon
WEAPON_AXIS = {'staff': (44, -62), 'spear': (44, -72), 'axe2h': (18, -66), 'hammer2h': (18, -58), 'sword2h': (15, -60),
               'axe1h': (8, -36), 'sword1h': (9, -39), 'mace1h': (8, -35), 'hammer1h': (8, -35), 'dagger': (6, -23)}

R = lambda v: round(float(v), 1)
BLADES = {'dagger', 'sword1h', 'sword2h', 'bfdagger'}

def _load(src, name):
    im = Image.open(os.path.join(src, name + '.png')).convert('RGBA')
    return np.asarray(im.split()[3]) > 128, np.asarray(im.convert('RGB')).astype(int)

def _cx(m, y):
    y = int(round(y))
    for dy in range(12):
        for yy in (y - dy, y + dy):
            if 0 <= yy < m.shape[0]:
                xs = np.nonzero(m[yy])[0]
                if len(xs): return float((xs.min() + xs.max()) / 2)
    return m.shape[1] / 2

def _glow(rgb, m):
    g = m & (rgb[..., 0] > 200) & (rgb[..., 1] > 150) & (rgb[..., 2] < 140)
    ys, xs = np.nonzero(g)
    return [R(xs.mean()), R(ys.mean())] if len(xs) > 3 else None

def _axis(m):
    """Кінці головної осі маски: (нижній-лівий, верхній-правий) + центр ваги."""
    ys, xs = np.nonzero(m); pts = np.stack([xs, ys], 1).astype(float); mu = pts.mean(0)
    v = np.linalg.svd(pts - mu, full_matrices=False)[2][0]; t = (pts - mu) @ v; L = t.max() - t.min()
    a = pts[t < t.min() + 0.03 * L].mean(0); b = pts[t > t.max() - 0.03 * L].mean(0)
    if a[1] < b[1]: a, b = b, a                  # руків'я — нижній кінець
    return a, b, mu

def weapon_def(src, part, t):
    m, _ = _load(src, part)
    if t == 'shield':
        ys, xs = np.nonzero(m)
        return {'t': t, 'c': [R((xs.min() + xs.max()) / 2), R((ys.min() + ys.max()) / 2)], 'h': R(ys.max() - ys.min())}, 44 / (ys.max() - ys.min())
    a, b, mu = _axis(m)
    if t == 'bow':
        # кінці лука — до кінців плеч, вигин — уперед (від тятиви); інакше розвертаємо на 180°
        d = (b - a) / np.linalg.norm(b - a); fwd = np.array([-d[1], d[0]])
        if (mu - a) @ fwd < 0: a, b = b, a
        return {'t': t, 'pommel': [R(a[0]), R(a[1])], 'head': [R(b[0]), R(b[1])], 'to': [[-3, 34], [-3, -34]]}, 68 / np.linalg.norm(b - a)
    if t == 'pistol':
        return {'t': t, 'pommel': [R(a[0]), R(a[1])], 'head': [R(b[0]), R(b[1])], 'to': [[-1, 6], [17, -4]]}, 19.5 / np.linalg.norm(b - a)
    if t in BLADES:
        # генератор малює клинки і руків'ям донизу, і вістрям донизу: лезо — світліший метал, руків'я — темніше
        _, rgb = _load(src, part); ys, xs = np.nonzero(m); pts = np.stack([xs, ys], 1).astype(float)
        d = (b - a) / np.linalg.norm(b - a); tt = (pts - a) @ d; L = tt.max()
        lum = rgb[ys, xs].mean(1) + (rgb[ys, xs].max(1) - rgb[ys, xs].min(1)) * 0.3
        if lum[tt < 0.3 * L].mean() > lum[tt > 0.7 * L].mean(): a, b = b, a   # світліший кінець — вістря
    p0, p1 = WEAPON_AXIS.get(t, (12, -40))
    return {'t': t, 'pommel': [R(a[0]), R(a[1])], 'head': [R(b[0]), R(b[1])], 'to': [[0, p0], [0, p1]]}, (p0 - p1) / np.linalg.norm(b - a)

# підборіддя — у системі голови рига (0 — центр голови): 16 перекриває шию й верх тулуба, як процедурна голова (низ на 16.5)
CHIN = 16

def helm_def(src, face_w=25):
    """Шолом кріпимо за підборіддя (низ шолома — під центр голови рига), масштаб — за шириною обличчя
    (нижні 55% висоти, без рогів і гребенів): високі роги ростуть угору, а не зсувають і не зменшують голову."""
    m, rgb = _load(src, 'helm'); ys = np.nonzero(m.any(1))[0]; y0, y1 = ys[0], ys[-1]
    rows = range(int(y0 + 0.45 * (y1 - y0)), int(y1) + 1)
    w = max(1, float(np.median([np.nonzero(m[y])[0].ptp() for y in rows if m[y].any()])))   # медіана: бічні роги внизу не зменшують голову
    xb = np.mean([_cx(m, y) for y in rows])                      # вісь обличчя
    s = face_w / w
    return {'c': [R(xb), R(y1)], 'top': [R(xb), R(y0)], 'to': [[1, CHIN], [1, R(CHIN - (y1 - y0) * s)]], 'eye': _glow(rgb, m), 'fw': face_w}, s

def auto_def(src, parts, weapons):
    D = {}; K = {}
    have = set(parts)
    if 'arm' in have:
        m, _ = _load(src, 'arm'); ys = np.nonzero(m.any(1))[0]; y0, h = ys[0], ys[-1] - ys[0]
        P = lambda f: [R(_cx(m, y0 + f * h)), R(y0 + f * h)]
        sh, el, hd = P(0.07), P(0.47), P(0.9)
        k = 37 / np.hypot(hd[0] - sh[0], hd[1] - sh[1])
        D['arm'] = {'sh': sh, 'el': el, 'hand': hd, 'cut': el[1], 'k': round(k, 4)}; K['arm'] = k
    leg_h = None
    if 'leg' in have:
        m, _ = _load(src, 'leg'); ys = np.nonzero(m.any(1))[0]; y0, y1 = ys[0], ys[-1]; h = y1 - y0; leg_h = h
        P = lambda f: [R(_cx(m, y0 + f * h)), R(y0 + f * h)]
        hip, kn, ank = P(0.05), P(0.46), P(0.78)
        k = 49 / np.hypot(ank[0] - hip[0], ank[1] - hip[1])
        D['leg'] = {'hip': hip, 'kn': kn, 'ank': ank, 'cut1': R(kn[1] + 0.03 * h), 'cut2': ank[1], 'sole': [ank[0], R(y1)], 'k': round(k, 4)}; K['leg'] = k
    if 'torso' in have:
        m, rgb = _load(src, 'torso'); ys = np.nonzero(m.any(1))[0]; y0, y1 = ys[0], ys[-1]; h = y1 - y0
        D['torso'] = {'neck': [R(_cx(m, y0 + 0.03 * h)), R(y0 + 0.03 * h)], 'bot': [R(_cx(m, y1 - 2)), R(y1)], 'to': [[2, -42], [2, 1]], 'core': _glow(rgb, m)}
        K['torso'] = 43 / h
    if 'helm' in have:
        D['helm'], K['helm'] = helm_def(src)
    if 'lower' in have:
        m, _ = _load(src, 'lower'); ys = np.nonzero(m.any(1))[0]; y0, y1 = ys[0], ys[-1]; cx = _cx(m, y0 + 3)
        robe = bool(leg_h is not None and (y1 - y0) > 0.75 * leg_h)      # довга мантія до щиколоток, а не тасети
        bot = 40 if robe else 22
        D['lower'] = {'top': [R(cx), R(y0)], 'bot': [R(cx), R(y1)], 'to': [[2, -6], [2, bot]], 'robe': robe}
        K['lower'] = (bot + 6) / (y1 - y0)
    for part, t in (('weapon', weapons[0]), ('weapon2', weapons[1])):
        if part in have and t:
            D[part], K[part] = weapon_def(src, part, t)
    if 'cape' in have:
        m, _ = _load(src, 'cape'); ys = np.nonzero(m.any(1))[0]; y0, y1 = ys[0], ys[-1]
        k = 48 / (y1 - y0); D['cape'] = {'top': [R(_cx(m, y0 + 3)), R(y0)], 'k': round(k, 4), 'sx': 0.7}; K['cape'] = k
    if 'shoulder' in have:
        m, _ = _load(src, 'shoulder'); ys, xs = np.nonzero(m); w = xs.max() - xs.min()
        # кріпимо за нижню третину: наплічник сидить на плечі й здіймається над ним
        D['shoulder'] = {'c': [R((xs.min() + xs.max()) / 2), R(ys.min() + 0.62 * (ys.max() - ys.min()))], 'near': round(34 / w, 4), 'far': round(30 / w, 4)}
        K['shoulder'] = 34 / w
    return D, K

def cat_def(src):
    """Точки кріплення форми кота до скелета js/cat.js (solveCat): тіло, голова, передня/задня лапа, хвіст."""
    D = {}; K = {}
    m, _ = _load(src, 'body'); ys, xs = np.nonzero(m); cy = (ys.min() + ys.max()) / 2
    D['body'] = {'rear': [R(xs.min()), R(cy)], 'front': [R(xs.max()), R(cy)]}; K['body'] = 75 / (xs.max() - xs.min())
    m, rgb = _load(src, 'head'); ys, xs = np.nonzero(m); cy = (ys.min() + ys.max()) / 2
    D['head'] = {'back': [R(xs.min()), R(cy)], 'nose': [R(xs.max()), R(cy)], 'eye': _glow(rgb, m)}; K['head'] = 33 / (xs.max() - xs.min())
    for part, fr, L in (('front', (0.05, 0.5, 0.9), 37), ('hind', (0.05, 0.4, 0.72, 0.92), 46)):
        m, _ = _load(src, part); ys = np.nonzero(m.any(1))[0]; y0, h = ys[0], ys[-1] - ys[0]
        pts = [[R(_cx(m, y0 + f * h)), R(y0 + f * h)] for f in fr]
        D[part] = {'pts': pts, 'k': round(L / (pts[-1][1] - pts[0][1]), 4)}; K[part] = L / (pts[-1][1] - pts[0][1])
    m, _ = _load(src, 'tail'); ys, xs = np.nonzero(m)
    # основа хвоста — товстіший кінець (за промптом праворуч, але перевіряємо)
    w = lambda x0, x1: m[:, x0:x1].sum(0).mean()
    span = xs.max() - xs.min(); q = max(2, span // 6)
    base_right = w(xs.max() - q, xs.max()) >= w(xs.min(), xs.min() + q)
    bx, tx = (xs.max(), xs.min()) if base_right else (xs.min(), xs.max())
    cyb = float(np.nonzero(m[:, int(bx) - (1 if base_right else 0)])[0].mean()); cyt = float(np.nonzero(m[:, int(tx) + (0 if base_right else -1)])[0].mean())
    D['tail'] = {'base': [R(bx), R(cyb)], 'tip': [R(tx), R(cyt)]}; K['tail'] = 49 / span
    return D, K

def pack_cat(name):
    src = os.path.join(ROOT, 'img', 'cutout', name)
    parts = [p for p in ('body', 'head', 'front', 'hind', 'tail') if os.path.exists(os.path.join(src, p + '.png'))]
    D, K = cat_def(src); D['kind'] = 'cat'
    return _write(name, src, parts, D, K)

def encode(im0, k):
    """Зменшення до ~MARGIN× ігрового розміру (LANCZOS + підрізкість), чистка пурпурового ореолу, власний контур."""
    pad = 12; im = Image.new('RGBA', (im0.width + 2 * pad, im0.height + 2 * pad), (0, 0, 0, 0)); im.paste(im0, (pad, pad))
    f = min(1.0, MARGIN * k * ART)
    w, h = max(1, round(im.width * f)), max(1, round(im.height * f))
    rgb = im.convert('RGB').resize((w, h), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1, percent=90, threshold=1))
    rgb = ImageEnhance.Color(rgb).enhance(1.08)
    a = im.split()[3].resize((w, h), Image.LANCZOS)
    arr = np.asarray(rgb).astype(np.int32); lim = arr[..., 1] + 12
    arr[..., 0] = np.where(np.minimum(arr[..., 0], arr[..., 2]) > lim, np.minimum(arr[..., 0], lim), arr[..., 0])
    arr[..., 2] = np.where(arr[..., 2] > lim + 10, lim + 10, arr[..., 2])
    small = Image.fromarray(arr.clip(0, 255).astype(np.uint8)).convert('RGBA'); small.putalpha(a)
    ring = a.point(lambda v: 255 if v > 110 else 0).filter(ImageFilter.MaxFilter(3))
    base = Image.new('RGBA', small.size, (11, 8, 8, 0)); base.putalpha(ring)
    small = Image.alpha_composite(base, small)
    buf = io.BytesIO(); small.save(buf, 'PNG', optimize=True)
    return base64.b64encode(buf.getvalue()).decode(), [round(im.width / w, 4), pad]

def palette(src, parts):
    ims = [Image.open(os.path.join(src, p + '.png')).convert('RGBA') for p in parts]
    px = np.concatenate([np.asarray(i.convert('RGB'))[np.asarray(i.split()[3]) > 128] for i in ims])
    q = Image.fromarray(px.reshape(1, -1, 3)).quantize(PALETTE, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[:PALETTE * 3]
    return ['#%02x%02x%02x' % tuple(pal[i:i + 3]) for i in range(0, len(pal), 3) if min(pal[i], pal[i + 2]) <= pal[i + 1] + 12]

# поправки пропорцій для форм друїда на гуманоїдному ригу: голова з рогами чи кроною — більша (піввисота голови),
# низ — короткий, а не мантія до щиколоток (у мункіна короткі товсті лапи), плечі — менші, щоб не закривали голову
FORM_TWEAK = {'moonkin': {'face': 34, 'lower': 26, 'shoulder': (24, 21), 'leg_k': 0.6},
              'tree': {'face': 32, 'lower': None, 'shoulder': (22, 19)}}

def tweak(D, K, src, kind):
    t = FORM_TWEAK.get(kind)
    if not t: return
    if 'helm' in D:
        D['helm'], K['helm'] = helm_def(src, t['face'])
    if 'lower' in D and t['lower']:
        L = D['lower']; L['to'] = [[2, -6], [2, t['lower']]]; L['robe'] = False
        K['lower'] = (t['lower'] + 6) / (L['bot'][1] - L['top'][1])
    if 'leg' in D and t.get('leg_k'):   # короткі товсті лапи мункіна: товщина й ступня — менші, ніж дає розтяг до довжини ноги
        D['leg']['k'] = round(D['leg']['k'] * t['leg_k'], 4)
    if 'shoulder' in D:
        m, _ = _load(src, 'shoulder'); xs = np.nonzero(m.any(0))[0]; w = xs[-1] - xs[0]
        D['shoulder']['near'], D['shoulder']['far'] = round(t['shoulder'][0] / w, 4), round(t['shoulder'][1] / w, 4); K['shoulder'] = t['shoulder'][0] / w

def pack_whole(name, height=118):
    """Цільний спрайт повної фігури з аркуша (запасний варіант, без анімації кінцівок). Кріплення — за ступнями.
    Мункін, дерево й інфернал мають власну збірку — pack_bulk."""
    src = os.path.join(ROOT, 'img', 'cutout', name)
    m, _ = _load(src, 'full'); ys, xs = np.nonzero(m); y1 = ys.max(); h = y1 - ys.min()
    foot = np.nonzero(m[int(y1 - 0.06 * h):int(y1) + 1].any(0))[0]
    D = {'whole': {'feet': [R((foot.min() + foot.max()) / 2), R(y1)], 'k': round(height / h, 4)}}
    return _write(name, src, ['full'], D, {'full': height / h})

# масивні форми — мункін, дерево життя, інфернал: власна збірка (js/cutout.js paintBulkCutout) — тулуб як центр мас,
# голова втоплена, плечі на боках тулуба, кінцівки за ригом. Масштаб — від висоти тулуба (TH одиниць гри),
# rel — відносний розмір деталі (аркуші малюють деталі не зовсім в одному масштабі; звірено з повною фігурою),
# scale — масштаб малювання моделі в грі (paintModel / PET_DEFS), щоб пакувальник зберіг потрібну роздільність
BULK = {'moonkin': {'TH': 48, 'scale': 1.12, 'rel': {'helm': 0.92, 'lower': 0.95, 'shoulder': 0.8}},
        'tree':    {'TH': 40, 'scale': 1.14, 'rel': {'helm': 0.95, 'lower': 0.95, 'shoulder': 0.8, 'arm': 1.15, 'leg': 1.25}},
        'golem':   {'TH': 52, 'scale': 1.18, 'nolower': 1, 'rel': {'helm': 1.15, 'shoulder': 0.55, 'arm': 0.95, 'leg': 0.9}}}

def bulk_def(src, kind):
    C = BULK[kind]; rel = {p: C['rel'].get(p, 1.0) for p in ('torso', 'lower', 'helm', 'shoulder', 'arm', 'leg')}
    D = {'kind': kind, 'rel': rel}; K = {}
    # тулуб і низ — вертикальна вісь посередині рамки (верхній край буває кривий: комір, пір'я, зрізаний стовбур)
    m, _ = _load(src, 'torso'); ys, xs = np.nonzero(m); y0, y1 = ys.min(), ys.max(); cx = R((xs.min() + xs.max()) / 2)
    k = C['TH'] / (y1 - y0); D['k'] = round(k, 5)
    D['torso'] = {'top': [cx, R(y0)], 'bot': [cx, R(y1)], 'w': R(xs.max() - xs.min()), 'c': [R(xs.mean()), R(ys.mean())]}
    if os.path.exists(os.path.join(src, 'lower.png')) and not C.get('nolower'):
        m, _ = _load(src, 'lower'); ys, xs = np.nonzero(m); y0, y1 = ys.min(), ys.max(); cx = R((xs.min() + xs.max()) / 2)
        D['lower'] = {'top': [cx, R(y0)], 'bot': [cx, R(y1)], 'w': R(xs.max() - xs.min())}
    # голова: вісь — середина нижніх 40% (без рогів і крони), кріплення за низ
    m, _ = _load(src, 'helm'); ys = np.nonzero(m.any(1))[0]; y0, y1 = ys[0], ys[-1]
    xb = float(np.mean([_cx(m, y) for y in range(int(y0 + 0.6 * (y1 - y0)), int(y1) + 1)]))
    D['helm'] = {'c': [R(xb), R(y1)], 'top': [R(xb), R(y0)]}
    m, _ = _load(src, 'shoulder'); ys, xs = np.nonzero(m)
    D['shoulder'] = {'c': [R((xs.min() + xs.max()) / 2), R(ys.min() + 0.45 * (ys.max() - ys.min()))]}
    m, _ = _load(src, 'arm'); ys = np.nonzero(m.any(1))[0]; y0, h = ys[0], ys[-1] - ys[0]
    P = lambda f: [R(_cx(m, y0 + f * h)), R(y0 + f * h)]
    D['arm'] = {'sh': P(0.07), 'el': P(0.47), 'hand': P(0.88), 'cut': R(y0 + 0.47 * h), 'k': round(k * rel['arm'], 5)}
    m, _ = _load(src, 'leg'); ys = np.nonzero(m.any(1))[0]; y0, y1 = ys[0], ys[-1]; h = y1 - y0
    P = lambda f: [R(_cx(m, y0 + f * h)), R(y0 + f * h)]
    hip, kn, ank = P(0.05), P(0.46), P(0.76)
    D['leg'] = {'hip': hip, 'kn': kn, 'ank': ank, 'cut1': R(kn[1] + 0.03 * h), 'cut2': ank[1], 'sole': [ank[0], R(y1)], 'k': round(k * rel['leg'], 5)}
    for p, r in rel.items(): K[p] = k * r * C['scale']
    return D, K

def pack_bulk(name, kind):
    src = os.path.join(ROOT, 'img', 'cutout', name)
    D, K = bulk_def(src, kind)
    parts = [p for p in ('torso', 'lower', 'helm', 'shoulder', 'arm', 'leg') if os.path.exists(os.path.join(src, p + '.png')) and (p != 'lower' or 'lower' in D)]
    return _write(name, src, parts, D, K)

def pack(name, weapons=(None, None), kind=None):
    if kind in BULK: return pack_bulk(name, kind)
    if kind == 'whole': return pack_whole(name)
    src = os.path.join(ROOT, 'img', 'cutout', name)
    parts = sorted(f[:-4] for f in os.listdir(src) if f.endswith('.png') and f[:-4] != 'full')
    if not weapons[0]: parts = [p for p in parts if p not in ('weapon', 'weapon2')]
    if not weapons[1]: parts = [p for p in parts if p != 'weapon2']
    D, K = auto_def(src, parts, weapons)
    tweak(D, K, src, kind)
    return _write(name, src, parts, D, K)

def _write(name, src, parts, D, K):
    lines = [f'// згенеровано tools/setsheets/pack_cutout.py {name} — деталі з img/cutout/{name}/*.png',
             'var CUTOUT_IMG=window.CUTOUT_IMG||{}; window.CUTOUT_IMG=CUTOUT_IMG;', f'CUTOUT_IMG[{name!r}]={{']
    scales = {}
    for p in parts:
        b64, scales[p] = encode(Image.open(os.path.join(src, p + '.png')).convert('RGBA'), K.get(p, 0.25))
        lines.append(f"  {p}:'data:image/png;base64,{b64}',")
    lines.append('};')
    for var, val in (('CUTOUT_SCALE', scales), ('CUTOUT_AUTO', D), ('CUTOUT_PAL', palette(src, parts))):
        lines.append(f'var {var}=window.{var}||{{}}; window.{var}={var};')
        lines.append(f'{var}[{name!r}]={json.dumps(val)};')
    out = os.path.join(ROOT, 'img', 'cutout', name + '.js')
    open(out, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    return out, parts

if __name__ == '__main__':
    w = (None, None)
    if '--weapons' in sys.argv:
        v = sys.argv[sys.argv.index('--weapons') + 1].split(',') + [None]
        w = (v[0] or None, v[1] or None)
    out, parts = pack(sys.argv[1], w)
    print(out, os.path.getsize(out) // 1024, 'KB', parts)
