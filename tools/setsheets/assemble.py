"""Збирання скінів у гру з аркушів out/<id>.png:
   1) нарізка за сіткою шаблону → img/cutout/<id>/*.png
   2) пакування з точками кріплення → img/cutout/<id>.js (вантажиться грою за потреби, js/cutout.js)
   3) SPEC_SKINS у js/data.js — 3 скіни на спек із вибору користувача (tools/picker/picks.json → jobs.json)
   4) SKINS.todo — ✔ для скінів, що вже в грі
   python tools/setsheets/assemble.py              — усі, для яких є аркуш
   python tools/setsheets/assemble.py --only dk_*  — частина (SPEC_SKINS однаково пишеться для всіх готових)"""
import os, re, sys, json, fnmatch, importlib.util
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import pack_cutout
spec = importlib.util.spec_from_file_location('slicer', os.path.join(HERE, 'slice.py'))
slicer = importlib.util.module_from_spec(spec); spec.loader.exec_module(slicer)
import build_jobs

# зброя з промпту (jobs.json) → тип, як у js/paint.js
WTYPE = {'two-handed great axe': 'axe2h', 'two-handed axe': 'axe2h', 'one-handed axe': 'axe1h', 'one-handed sword': 'sword1h',
         'one-handed runesword': 'sword1h', 'two-handed runeblade': 'sword2h', 'shield': 'shield', 'one-handed mace': 'mace1h',
         'one-handed war-hammer': 'hammer1h', 'two-handed war-hammer': 'hammer2h', 'longbow': 'bow', 'spear': 'spear',
         'dagger': 'dagger', 'flintlock pistol': 'pistol', 'staff': 'staff'}

def cut_sheet(jid, cat=False):
    img = Image.open(os.path.join(HERE, 'out', f'{jid}.png'))
    dst = os.path.join(ROOT, 'img', 'cutout', jid); os.makedirs(dst, exist_ok=True)
    for f in os.listdir(dst): os.remove(os.path.join(dst, f))
    for name, box in (slicer.cat_cells(img) if cat else slicer.template_cells(img)).items():
        if name == 'palette': continue
        try: slicer.cut(img, box).save(os.path.join(dst, name + '.png'))
        except ValueError: pass                       # порожня клітинка: немає плаща чи другої зброї
    # перемальовані деталі (gen.py --part → out/<id>_<деталь>.png) замінюють деталь з аркуша; генератор малює
    # їх крупніше, тож зводимо до висоти старої деталі (масштаби форм рахуються від тулуба — pack_cutout.BULK)
    for f in os.listdir(os.path.join(HERE, 'out')):
        if not (f.startswith(jid + '_') and f.endswith('.png')): continue
        part = f[len(jid) + 1:-4]; old = os.path.join(dst, part + '.png')
        if part.startswith('_') or not os.path.exists(old): continue
        im = Image.open(os.path.join(HERE, 'out', f)); new = slicer.cut(im, (0, 0, im.width, im.height))
        h = Image.open(old).height; new = new.resize((max(1, round(new.width * h / new.height)), h), Image.LANCZOS)
        new.save(old); print(f'    {jid}: {part} — перемальована деталь')
    return dst

def colors(dst):
    """Колір броні й оздоблення для процедурного запасного вигляду і підсвіток інтерфейсу."""
    im = Image.open(os.path.join(dst, 'torso.png')).convert('RGBA')
    a = np.asarray(im); px = a[a[..., 3] > 128][:, :3]
    q = Image.fromarray(px.reshape(1, -1, 3)).quantize(6, method=Image.Quantize.MEDIANCUT)
    pal = np.array(q.getpalette()[:18]).reshape(6, 3); cnt = np.bincount(np.asarray(q).ravel(), minlength=6)
    lum = pal.sum(1); sat = pal.max(1) - pal.min(1)
    body = pal[np.argmax(cnt * (lum > 60))]
    trim = pal[np.argmax(sat * 2 + lum)]
    hx = lambda c: '#%02x%02x%02x' % tuple(int(v) for v in c)
    return hx(body), hx(trim)

def write_skins(jobs):
    ready = [j for j in jobs if os.path.exists(os.path.join(ROOT, 'img', 'cutout', j['id'] + '.js'))]
    by_key = {}
    for j in ready: by_key.setdefault(j['key'], []).append(j)
    out = ['// згенеровано tools/setsheets/assemble.py з вибору tools/picker/picks.json: 3 скіни на спек,',
           '// кожен — растрові деталі img/cutout/<id>.js (js/cutout.js); tier — мітка сету (T5, A7, ZG, PvP)',
           'const SPEC_SKINS={']
    for key in dict.fromkeys(j['key'] for j in jobs):
        out.append(f"  '{key}':[")
        for j in by_key.get(key, []):
            body, trim = colors(os.path.join(ROOT, 'img', 'cutout', j['id']))
            fac = f",faction:'{j['faction']}'" if j['faction'] else ''
            if os.path.exists(os.path.join(ROOT, 'img', 'cutout', j['id'] + '_form.js')): fac += f",formCutout:'{j['id']}_form'"   # форма друїда
            out.append(f"    SK({json.dumps(j['set'])},'{j['label']}','{body}','{trim}',{{cutout:'{j['id']}'{fac}}}),")
        out.append('  ],')
    out.append('};')
    p = os.path.join(ROOT, 'js', 'data.js'); s = open(p, encoding='utf-8').read()
    a = s.index('const SPEC_SKINS={')
    head = s[:a]
    i = head.rfind('// згенеровано tools/setsheets/assemble.py')   # попередній згенерований коментар
    if i >= 0 and head[i:].count('\n') <= 2: head = head[:i]
    b = s.index('\n};\n', a) + 4
    open(p, 'w', encoding='utf-8').write(head + '\n'.join(out) + '\n' + s[b:])
    return ready

def main():
    jobs = json.load(open(os.path.join(HERE, 'jobs.json'), encoding='utf-8'))
    sel = jobs; pats = []
    if '--only' in sys.argv:
        pats = sys.argv[sys.argv.index('--only') + 1].split(',')
        sel = [j for j in jobs if any(fnmatch.fnmatch(j['id'], p) for p in pats)]
    for j in sel:
        if not os.path.exists(os.path.join(HERE, 'out', f"{j['id']}.png")):
            print('  немає аркуша', j['id']); continue
        cut_sheet(j['id'])
        w = tuple(WTYPE.get(x) if x else None for x in j['weapons'])
        out, parts = pack_cutout.pack(j['id'], w)
        print(f"  ✔ {j['id']:24} {os.path.getsize(out) // 1024:4} KB  {','.join(parts)}")
    # форми друїда (кіт, мункін, дерево) — form_jobs.json
    fp = os.path.join(HERE, 'form_jobs.json')
    for f in (json.load(open(fp, encoding='utf-8')) if os.path.exists(fp) else []):
        if sel is not jobs and not any(fnmatch.fnmatch(f['id'], p + '*') or fnmatch.fnmatch(f['skin'], p) for p in pats): continue
        if not os.path.exists(os.path.join(HERE, 'out', f"{f['id']}.png")): continue
        cut_sheet(f['id'], cat=f['kind'] == 'cat')
        out, parts = pack_cutout.pack_cat(f['id']) if f['kind'] == 'cat' else pack_cutout.pack(f['id'], kind=f['kind'])
        print(f"  ✔ {f['id']:24} {os.path.getsize(out) // 1024:4} KB  {','.join(parts)}")
    # пети (вовки, гуль, фелгард) — pet_jobs.json; підключені в js/pets.js (PET_CUTOUT)
    pp = os.path.join(HERE, 'pet_jobs.json')
    for f in (json.load(open(pp, encoding='utf-8')) if os.path.exists(pp) else []):
        if sel is not jobs and not any(fnmatch.fnmatch(f['id'], p) for p in pats): continue
        if not os.path.exists(os.path.join(HERE, 'out', f"{f['id']}.png")): continue
        slicer.KEY = pack_cutout.KEY = f.get('bg', 'magenta')   # аркуш на зеленому — свій ключ фону
        dst = cut_sheet(f['id'], cat=f['kind'] == 'cat')
        if f.get('wings') and os.path.exists(os.path.join(dst, 'cape.png')):   # у клітинці плаща намальовано крила
            os.replace(os.path.join(dst, 'cape.png'), os.path.join(dst, 'wings.png'))
        w = tuple(WTYPE.get(x) if x else None for x in f['weapons'])
        out, parts = pack_cutout.pack_cat(f['id']) if f['kind'] == 'cat' else pack_cutout.pack(f['id'], w, kind=f.get('pack'))
        print(f"  ✔ {f['id']:24} {os.path.getsize(out) // 1024:4} KB  {','.join(parts)}")
        slicer.KEY = pack_cutout.KEY = 'magenta'
    ready = write_skins(jobs)
    build_jobs.write_todo(jobs, done={j['id'] for j in ready})
    print(f'у грі: {len(ready)} з {len(jobs)}')

if __name__ == '__main__':
    main()
