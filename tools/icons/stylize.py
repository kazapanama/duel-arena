"""Іконки здібностей у піксель-арт стилі гри через OpenAI Images API (edits).
   Оригінали — з WoW Icon Pack (не в репозиторії); результат — img/icons/<той самий шлях>.png (60×60, у репозиторії).
   Сітка 4×4 оригіналів (Image 1) + кадр бійців гри як зразок стилю (Image 2, style_ref.png) → та сама сітка,
   перемальована → нарізка. Виклик API й облік витрат — з tools/setsheets/gen.py (ledger.csv там же).

   python tools/icons/stylize.py --dry                 # які іконки ще не зроблені й скільки сіток
   python tools/icons/stylize.py                       # згенерувати всі незроблені (усі шляхи з js/data.js)
   python tools/icons/stylize.py --only Spells/Heal.png,Wowhead/x.png --force   # перегенерувати вибрані
   python tools/icons/stylize.py --review              # контактний лист оригінал/нова → tools/icons/out/_review.png
Нова здібність: прописати оригінал у ABILITY_ICONS (js/data.js), покласти файл у пак і запустити без параметрів."""
import os, re, sys, argparse, hashlib
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PACK = os.path.join(ROOT, 'WoW Icon Pack')
DST = os.path.join(ROOT, 'img', 'icons')
OUT = os.path.join(HERE, 'out')
sys.path.insert(0, os.path.join(ROOT, 'tools', 'setsheets'))
import gen  # noqa: E402

N, CELL, GAP = 4, 248, 8          # сітка 4×4: клітинка 248 px + чорний проміжок 8 px = 1024
PROMPT = """Image 1 is a 4x4 grid of fantasy game spell icons. Redraw EVERY icon as hand-made pixel art in the style of Image 2 (character sprites from our 2D pixel fighting game).
- About 32x32 visible square pixels per icon, crisp hard pixel edges, limited palette, simple cel shading, clean dark outlines on the main shapes, no blur, no soft airbrush gradients.
- Keep each icon's subject, composition, main colors and silhouette, so every icon is instantly recognizable as the same icon.
- Keep exactly the same 4x4 grid: the same order, each icon filling its square cell edge to edge, the same thin black gaps between cells. Empty black cells stay empty black.
- Copy only the pixel style from Image 2 (pixel size, outlines, shading) — not its characters or colors.
- No text, no numbers, no extra frames or borders."""

def all_icons():
    """Шляхи з js/data.js ('Spells/X.png') та index.html (src="img/icons/Spells/X.png")."""
    dirs = 'Abilities|Spells|Trade|Miscellaneous|Weapons|Characters and Creatures|Wowhead'
    s = open(os.path.join(ROOT, 'js', 'data.js'), encoding='utf-8').read()
    h = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    return sorted(set(re.findall(rf"'((?:{dirs})/[^']+\.png)'", s)) | set(re.findall(rf'src="(?:img/icons|WoW Icon Pack)/((?:{dirs})/[^"]+\.png)"', h)))

def cell_box(i):
    x, y = (i % N) * (CELL + GAP) + GAP // 2, (i // N) * (CELL + GAP) + GAP // 2
    return x, y, x + CELL, y + CELL

def build_grid(icons, path):
    im = Image.new('RGB', (N * (CELL + GAP),) * 2, (0, 0, 0))
    for i, p in enumerate(icons):
        im.paste(Image.open(os.path.join(PACK, p)).convert('RGB').resize((CELL, CELL), Image.LANCZOS), cell_box(i)[:2])
    im.save(path)

def slice_grid(path, icons):
    """З клітинки зрізаємо по 4% з країв (сліди проміжків) і зводимо до 60×60, як іконки паку."""
    im = Image.open(path).convert('RGB'); k = im.width / (N * (CELL + GAP))
    for i, p in enumerate(icons):
        x0, y0, x1, y1 = (int(v * k) for v in cell_box(i)); m = int((x1 - x0) * 0.04)
        dst = os.path.join(DST, p); os.makedirs(os.path.dirname(dst), exist_ok=True)
        im.crop((x0 + m, y0 + m, x1 - m, y1 - m)).resize((60, 60), Image.LANCZOS).save(dst, optimize=True)

def review(icons):
    S, C = 96, 12; rows = (len(icons) + C - 1) // C
    im = Image.new('RGB', (C * (S + 6) + 6, rows * (2 * S + 24)), (30, 28, 34)); d = ImageDraw.Draw(im)
    for i, p in enumerate(icons):
        x, y = 6 + (i % C) * (S + 6), (i // C) * (2 * S + 24)
        im.paste(Image.open(os.path.join(PACK, p)).convert('RGB').resize((S, S), Image.NEAREST), (x, y + 4))
        if os.path.exists(os.path.join(DST, p)):
            im.paste(Image.open(os.path.join(DST, p)).convert('RGB').resize((S, S), Image.NEAREST), (x, y + S + 6))
        d.text((x, y + 2 * S + 8), os.path.splitext(os.path.basename(p))[0][:16], fill=(220, 220, 220))
    out = os.path.join(OUT, '_review.png'); im.save(out); print(out)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='шляхи іконок через кому (як у js/data.js)')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--dry', action='store_true')
    ap.add_argument('--review', action='store_true')
    ap.add_argument('--workers', type=int, default=3)
    ap.add_argument('--model', default='gpt-image-2.5-sunburst')
    ap.add_argument('--quality', default='high')
    ap.add_argument('--size', default='1024x1024')
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    icons = all_icons()
    if args.review: return review(icons)
    if args.only: icons = [p.strip() for p in args.only.split(',')]
    miss = [p for p in icons if not os.path.exists(os.path.join(PACK, p))]
    if miss: sys.exit(f'Немає оригіналів у паку: {miss}')
    todo = [p for p in icons if args.force or not os.path.exists(os.path.join(DST, p))]
    batches = [todo[i:i + N * N] for i in range(0, len(todo), N * N)]
    print(f'Іконок: {len(todo)} · сіток: {len(batches)} · ≈ ${0.071 * len(batches):.2f}')
    if args.dry or not batches: return
    key = gen.api_key(); os.makedirs(gen.OUT, exist_ok=True)
    def run(ib):
        i, b = ib
        tag = hashlib.sha1('|'.join(b).encode()).hexdigest()[:8]   # проміжні файли — за складом сітки, щоб не підхопити чужу
        grid, res = os.path.join(OUT, f'{tag}_in.png'), os.path.join(OUT, f'{tag}.png')
        build_grid(b, grid)
        if args.force or not os.path.exists(res):
            if not gen.call(args, key, [grid, os.path.join(HERE, 'style_ref.png')], PROMPT, res, f'icons_{tag}'): return 0
        slice_grid(res, b); return 1
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as ex:
        ok = sum(ex.map(run, enumerate(batches)))
    print(f'Готово сіток: {ok}/{len(batches)} → {os.path.relpath(DST, ROOT)}')

if __name__ == '__main__':
    main()
