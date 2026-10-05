"""Скачує оригінальні іконки WoW з Wowhead у пак: WoW Icon Pack/Wowhead/<назва>.png (60×60, як решта паку).
   python tools/fetch_icon.py spell_ice_lament spell_shadow_possession ...
Назву іконки (поле "icon") видно на сторінці закляття Wowhead або в _refs/picker/cache/class*.html."""
import io, sys, pathlib, urllib.request
from PIL import Image

DST = pathlib.Path(__file__).resolve().parent.parent / 'WoW Icon Pack' / 'Wowhead'
URL = 'https://wow.zamimg.com/images/wow/icons/large/{}.jpg'

def fetch(name):
    req = urllib.request.Request(URL.format(name), headers={'User-Agent': 'Mozilla/5.0'})
    data = urllib.request.urlopen(req, timeout=20).read()
    im = Image.open(io.BytesIO(data)).convert('RGB').resize((60, 60), Image.LANCZOS)
    DST.mkdir(parents=True, exist_ok=True)
    im.save(DST / f'{name}.png')
    print('ok ', f'Wowhead/{name}.png')

if __name__ == '__main__':
    for n in sys.argv[1:]:
        try: fetch(n.lower())
        except Exception as e: print('ERR', n, e)
