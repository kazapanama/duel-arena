"""Перетискає вже наявні асети в репозиторії тими самими кодеками, що й генератори:
   img/cutout/*.js  — PNG у data-URI → WebP без втрат (pack_cutout.to_webp), повторний запуск пропускає готові;
   img/icons/**.png — PNG з палітрою 256 кольорів (stylize.save_icon), пропускає вже палітрові;
   img/arenas/*.webp — WebP q80 (як arenas.py publish). Перетискання з втратами накопичує артефакти, тому лише з --arenas.
   python tools/optimize_assets.py [--arenas]"""
import os, re, io, sys, glob, base64
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'setsheets'))
from pack_cutout import to_webp  # noqa: E402

def kb(n): return f'{n / 1024:.0f} КБ'

def cutouts():
    before = after = 0
    pat = re.compile(r"data:image/png;base64,([A-Za-z0-9+/=]+)")
    for f in sorted(glob.glob(os.path.join(ROOT, 'img', 'cutout', '*.js'))):
        s = open(f, encoding='utf-8').read(); before += len(s.encode())
        s = pat.sub(lambda m: 'data:image/webp;base64,' + to_webp(Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert('RGBA')), s)
        open(f, 'w', encoding='utf-8').write(s); after += len(s.encode())
    print('деталі скінів:', kb(before), '→', kb(after))

def icons():
    # той самий код, що й stylize.save_icon (stylize імпортує gen з ключем API, тож тут без імпорту)
    before = after = 0
    for f in sorted(glob.glob(os.path.join(ROOT, 'img', 'icons', '**', '*.png'), recursive=True)):
        im = Image.open(f); n = os.path.getsize(f); before += n
        if im.mode != 'P':
            im.convert('RGB').quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(f, optimize=True)
        after += os.path.getsize(f)
    print('іконки:', kb(before), '→', kb(after))

def arenas():
    before = after = 0
    for f in sorted(glob.glob(os.path.join(ROOT, 'img', 'arenas', '*.webp'))):
        before += os.path.getsize(f)
        im = Image.open(f).convert('RGB'); buf = io.BytesIO(); im.save(buf, 'WEBP', quality=80, method=6)
        if buf.tell() < os.path.getsize(f): open(f, 'wb').write(buf.getvalue())
        after += os.path.getsize(f)
    print('фони арен:', kb(before), '→', kb(after))

if __name__ == '__main__':
    cutouts(); icons()
    if '--arenas' in sys.argv: arenas()
