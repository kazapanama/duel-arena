"""Кандидати на заміну скріншота сету: усі скріншоти зі сторінки сету на Wowhead (lv_screenshots) і з «братів»
   (той самий вигляд: інша роль чи складність). Складає контактні листи, щоб вибрати фігуру анфас на весь зріст.
   python tools/picker/candidates.py <id сету> [<id> ...]   →  _refs/picker/cand/<id>/<shot>.jpg + _refs/picker/cand/sheet_*.png
   Вибраний скріншот ставиться командою:  python tools/picker/candidates.py --use <id сету> <id скріншота>
   Ще джерело — трансмог-сет сучасної бази (часто більше скріншотів):  --tm <id сету>=<id трансмог-сету> ..."""
import os, re, sys, json, shutil
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_catalog as bc          # кеш, get(), ALL (усі сети бази), base(), CAT_NAMES

CAND = os.path.join(bc.ROOT, '_refs', 'picker', 'cand')
os.makedirs(CAND, exist_ok=True)

def shots_of(set_id):
    """Скріншоти сету: сторінка WotLK Classic + сучасна (туди гравці досі вантажать трансмог, часто на людях)."""
    out, seen = [], set()
    pages = [(f'https://www.wowhead.com/wotlk/item-set={set_id}', f'set{set_id}.html')]
    if set_id > 0: pages.append((f'https://www.wowhead.com/item-set={set_id}', f'rset{set_id}.html'))
    for url, cache in pages:
        try: html = bc.get(url, cache)
        except Exception as e: print('  сторінка', url, e); continue
        m = re.search(r'lv_screenshots\s*=\s*(\[.*?\]);', html, re.S)
        for s in (json.loads(m.group(1)) if m else []):
            if s['id'] not in seen: seen.add(s['id']); out.append(s)
    return out

# мітка тіру кожної назви довідника: «брат» з іншим тіром (T7 Dreamwalker для T3 Dreamwalker) виглядає інакше
LABEL = {(c, (it[2] if isinstance(it[2], str) else it[2][0]).lower()): it[1] for c, items in bc.CATALOG.items() for it in items}
def siblings(d):
    b = bc.base(d['name'])
    cls = next((c for (c, n) in LABEL if n == d['name'].lower()), None)
    mine = LABEL.get((cls, d['name'].lower()))
    return [x for x in bc.ALL.values() if x['id'] != d['id'] and bc.base(x['name']) == b and x.get('reqclass') == d.get('reqclass')
            and LABEL.get((cls, x['name'].lower()), mine) == mine][:5]

def tm_shots(tm_id):
    html = bc.get(f'https://www.wowhead.com/transmog-set={tm_id}', f'tm{tm_id}.html')
    m = re.search(r'lv_screenshots\s*=\s*(\[.*?\]);', html, re.S)
    return json.loads(m.group(1)) if m else []

def gather(set_id, tm=()):
    d = bc.ALL[set_id]
    out = os.path.join(CAND, str(set_id)); os.makedirs(out, exist_ok=True)
    found = []
    srcs = [(x, None) for x in [d] + siblings(d)] + [({'id': None, 'name': f'трансмог {t}'}, t) for t in tm]
    for src, t in srcs:
        try: lst = tm_shots(t) if t else shots_of(src['id'])
        except Exception as e: print('  сторінка', src['id'], e); continue
        for s in lst:
            if s.get('width', 0) < 250: continue          # надто дрібні
            p = os.path.join(out, f"{s['id']}.jpg")
            if not os.path.exists(p):
                try:
                    data = bc.get(f"https://wow.zamimg.com/uploads/screenshots/normal/{s['id']}.jpg", f"shot{s['id']}.jpg", binary=True)
                    open(p, 'wb').write(data)
                except Exception as e: print('  скріншот', s['id'], e); continue
            found.append((s['id'], src['name'], s['width'], s['height']))
    return d, found

def sheet(groups, name):
    try: font = ImageFont.truetype('arial.ttf', 13)
    except OSError: font = ImageFont.load_default()
    W, H = 210, 250
    rows = []
    for d, found in groups:
        rows.append((d, sorted(found, key=lambda f: -f[0])[:7]))   # новіші скріншоти — частіше людські моделі
    img = Image.new('RGB', (W * 7 + 180, (H + 20) * len(rows)), (18, 18, 26)); dr = ImageDraw.Draw(img)
    for r, (d, found) in enumerate(rows):
        y = r * (H + 20)
        dr.text((6, y + 6), f"[{d['id']}]\n{d['name'][:22]}", fill=(240, 220, 120), font=font)
        for c, (sid, src, w, h) in enumerate(found):
            im = Image.open(os.path.join(CAND, str(d['id']), f'{sid}.jpg')).convert('RGB'); im.thumbnail((W - 6, H - 6))
            x = 180 + c * W; img.paste(im, (x + (W - im.width) // 2, y + (H - im.height) // 2))
            dr.text((x + 4, y + H + 2), f"{sid} {w}x{h}" + (' *' if src != d['name'] else ''), fill=(200, 200, 210), font=font)
    p = os.path.join(CAND, name); img.save(p); print(p)

if __name__ == '__main__':
    if sys.argv[1] == '--use':
        set_id, shot = int(sys.argv[2]), sys.argv[3]
        shutil.copy(os.path.join(CAND, str(set_id), f'{shot}.jpg'), os.path.join(bc.IMG, f'{set_id}.jpg'))
        print('скріншот сету', set_id, '←', shot)
    elif sys.argv[1] == '--tm':
        pairs = [tuple(int(v) for v in a.split('=')) for a in sys.argv[2:]]
        groups = [gather(sid, [tm]) for sid, tm in pairs]
        for i in range(0, len(groups), 5):
            sheet(groups[i:i + 5], f'sheet_tm{i // 5 + 1}.png')
    else:
        ids = [int(a) for a in sys.argv[1:]]
        groups = [gather(i) for i in ids]
        for i in range(0, len(groups), 5):
            sheet(groups[i:i + 5], f'sheet_{i // 5 + 1}.png')
