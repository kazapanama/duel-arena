"""Завдання на генерацію скінів з вибору користувача (tools/picker/picks.json):
   - tools/setsheets/jobs.json        — 90 завдань (спек × слот): сет, реф, промпт, раса, зброя
   - tools/setsheets/refs/<job>.png   — скріншот сету: обрізаний до портрета й збільшений (так модель краще бачить броню)
   - tools/setsheets/prompts/<job>.txt — промпт із template.txt
   - SKINS.todo (корінь проєкту)       — список для відмітки: ☐ не зроблено, ✔ у грі
   python tools/setsheets/build_jobs.py          — усе заново
   python tools/setsheets/build_jobs.py --todo   — лише оновити SKINS.todo (етапи: які аркуші вже згенеровано)
   Расу чи зброю окремого скіну міняємо в OVERRIDES нижче й перезапускаємо."""
import os, re, json
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CAT = json.loads(re.search(r'const CATALOG=(\[.*\]);', open(os.path.join(ROOT, 'tools/picker/catalog.js'), encoding='utf-8').read(), re.S).group(1))
BY_ID = {e['id']: e for e in CAT}
SPECS = json.loads(re.search(r'const SPECS=(\[.*?\]);', open(os.path.join(ROOT, 'tools/picker/current.js'), encoding='utf-8').read(), re.S).group(1))
PICKS = json.load(open(os.path.join(ROOT, 'tools/picker/picks.json'), encoding='utf-8'))

CLASS_EN = {'warrior': 'Warrior', 'paladin': 'Paladin', 'hunter': 'Hunter', 'rogue': 'Rogue', 'priest': 'Priest', 'dk': 'Death Knight',
            'shaman': 'Shaman', 'mage': 'Mage', 'warlock': 'Warlock', 'druid': 'Druid'}
ARMOR = {'warrior': 'heavy plate', 'paladin': 'heavy plate', 'dk': 'heavy plate', 'hunter': 'mail', 'shaman': 'mail',
         'rogue': 'leather', 'druid': 'leather', 'priest': 'cloth', 'mage': 'cloth', 'warlock': 'cloth'}
# зброя спеку (як у бойовій моделі гри, SPEC_LOOK у js/models.js): [основна, друга або None, як тримає в стійці]
WEAPONS = {
    'warrior/Arms': ('two-handed great axe', None, 'the great axe held diagonally in both hands in front of the body'),
    'warrior/Fury': ('one-handed axe', 'one-handed sword', 'a weapon in each hand: main-hand raised in front, off-hand lowered behind'),
    'warrior/Protection': ('one-handed sword', 'shield', 'shield on the far arm in front of the body, sword raised in the near hand'),
    'paladin/Holy': ('one-handed mace', 'shield', 'shield on the far arm in front of the body, mace raised in the near hand'),
    'paladin/Protection': ('one-handed war-hammer', 'shield', 'shield on the far arm in front of the body, hammer raised in the near hand'),
    'paladin/Retribution': ('two-handed war-hammer', None, 'the war-hammer held diagonally in both hands in front of the body'),
    'hunter/Beast Mastery': ('longbow', None, 'bow held out in the far hand, near hand drawing the string'),
    'hunter/Marksmanship': ('longbow', None, 'bow held out in the far hand, near hand drawing the string'),
    'hunter/Survival': ('spear', None, 'spear held diagonally in both hands, tip pointing forward'),
    'rogue/Assassination': ('dagger', 'dagger', 'a dagger in each hand, crouched and ready'),
    'rogue/Outlaw': ('one-handed sword', 'flintlock pistol', 'sword in the near hand, pistol in the far hand'),
    'rogue/Subtlety': ('dagger', 'dagger', 'a dagger in each hand, crouched and ready'),
    'priest/Discipline': ('staff', None, 'staff held upright in the near hand, far hand open as if casting'),
    'priest/Holy': ('staff', None, 'staff held upright in the near hand, far hand open as if casting'),
    'priest/Shadow': ('staff', None, 'staff held upright in the near hand, far hand open as if casting'),
    'dk/Blood': ('two-handed runeblade', None, 'the runeblade held diagonally in both hands in front of the body'),
    'dk/Frost': ('one-handed runesword', 'one-handed runesword', 'a runesword in each hand: main-hand raised in front, off-hand lowered behind'),
    'dk/Unholy': ('two-handed axe', None, 'the axe held diagonally in both hands in front of the body'),
    'shaman/Elemental': ('staff', None, 'staff held upright in the near hand, far hand open as if casting'),
    'shaman/Enhancement': ('one-handed axe', 'one-handed axe', 'an axe in each hand: main-hand raised in front, off-hand lowered behind'),
    'shaman/Restoration': ('staff', None, 'staff held upright in the near hand, far hand open as if casting'),
    'mage/Arcane': ('staff', None, 'staff held upright in the near hand, far hand open as if casting'),
    'mage/Fire': ('staff', None, 'staff held upright in the near hand, far hand open as if casting'),
    'mage/Frost': ('staff', None, 'staff held upright in the near hand, far hand open as if casting'),
    'warlock/Affliction': ('staff', None, 'staff held upright in the near hand, far hand open as if casting'),
    'warlock/Demonology': ('staff', None, 'staff held upright in the near hand, far hand open as if casting'),
    'warlock/Destruction': ('staff', None, 'staff held upright in the near hand, far hand open as if casting'),
    'druid/Balance': ('staff', None, 'staff held upright in the near hand, far hand open as if casting'),
    'druid/Feral': ('staff', None, 'staff held upright in the near hand, far hand open as if casting'),
    'druid/Restoration': ('staff', None, 'staff held upright in the near hand, far hand open as if casting'),
}
RACE_DEFAULT = 'human male'
# окремі скіни: {'warrior_arms_1': {'race': 'dwarf male'}, ...}
OVERRIDES = {}

def slug(s): return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')

def prep_ref(src, dst):
    """Портретний кадр із фігурою по центру: широкий скріншот обрізаємо з боків, дрібний — збільшуємо (PNG для API)."""
    im = Image.open(src).convert('RGB')
    w, h = im.size
    if w > h * 0.9:                                 # фігура в центрі широкого кадру — прибираємо фон з боків
        nw = int(h * 0.8); x0 = (w - nw) // 2
        im = im.crop((x0, 0, x0 + nw, h))
    if im.height < 1024:
        k = 1024 / im.height
        im = im.resize((round(im.width * k), 1024), Image.LANCZOS)
    im.save(dst)

def main():
    tpl = open(os.path.join(HERE, 'template.txt'), encoding='utf-8').read()
    os.makedirs(os.path.join(HERE, 'refs'), exist_ok=True)
    pdir = os.path.join(HERE, 'prompts'); os.makedirs(pdir, exist_ok=True)
    for f in os.listdir(pdir):
        if f.endswith('.txt'): os.remove(os.path.join(pdir, f))
    jobs = []
    for sp in SPECS:
        for slot, set_id in enumerate(PICKS['assign'].get(sp['key'], []), 1):
            e = BY_ID[set_id]
            jid = f"{sp['cls']}_{slug(sp['spec'])}_{slot}"
            o = OVERRIDES.get(jid, {})
            main_w, off_w, pose = o.get('weapons', WEAPONS[sp['key']])
            same = off_w == main_w
            vars = {
                'SET': e['name'], 'LABEL': e['label'], 'CLASS': CLASS_EN[sp['cls']], 'SPEC': sp['spec'], 'ARMOR': ARMOR[sp['cls']],
                'RACE': o.get('race', RACE_DEFAULT),
                'WEAPONS': f'the same {main_w} in each hand' if same else (f'main hand: {main_w}; off hand: {off_w}' if off_w else f'{main_w} (no off-hand item)'),
                'POSE': pose,
                'OFF_RULE': ('The second weapon cell (bottom row, middle) holds the same weapon again.' if same else
                             f'The second weapon cell (bottom row, middle) holds the off-hand item: {off_w}.' if off_w else
                             'This spec has no off-hand item: leave the second weapon cell (bottom row, middle) empty magenta.'),
            }
            text = re.sub(r'\{\{(\w+)\}\}', lambda m: vars[m.group(1)], tpl)
            ref = os.path.join(HERE, 'refs', f'{jid}.png')
            prep_ref(os.path.join(ROOT, '_refs', 'picker', 'img', f'{set_id}.jpg'), ref)
            open(os.path.join(pdir, f'{jid}.txt'), 'w', encoding='utf-8').write(text)
            jobs.append({'id': jid, 'key': sp['key'], 'cls': sp['cls'], 'clsName': sp['clsName'], 'spec': sp['spec'], 'slot': slot,
                         'set_id': set_id, 'set': e['name'], 'label': e['label'], 'faction': e['faction'], 'race': vars['RACE'],
                         'weapons': [main_w, off_w], 'ref': f'tools/setsheets/refs/{jid}.png', 'prompt': f'tools/setsheets/prompts/{jid}.txt',
                         'wowhead': e['url']})
    json.dump(jobs, open(os.path.join(HERE, 'jobs.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    write_todo(jobs)
    print(f'{len(jobs)} завдань, {len({j["set_id"] for j in jobs})} унікальних сетів')

def write_todo(jobs, done=None):
    """SKINS.todo: відмітки, які вже стояли (✔), зберігаються при перезапуску; done — додатково позначити ✔."""
    path = os.path.join(ROOT, 'SKINS.todo')
    done = set(done or ())
    if os.path.exists(path):
        done |= set(re.findall(r'✔ .*?@(\w+)', open(path, encoding='utf-8').read()))
    lines = ['Азерот Арена — скіни: по 3 сети на спек (вибір — tools/picker/picks.json, обиралка — sets-picker.html).',
             '☐ — не зроблено, ✔ — скін у грі. Після мітки @ — ідентифікатор завдання (tools/setsheets/jobs.json, out/<id>.png).',
             'Етапи кожного скіну: реф (tools/setsheets/refs) → аркуш GPT (tools/setsheets/gen.py) → нарізка (slice.py, pack_cutout.py) → у грі.',
             '«· аркуш» — аркуш деталей уже згенеровано (tools/setsheets/out/<id>.png).', '']
    cur_cls = cur_spec = None
    for j in jobs:
        if j['clsName'] != cur_cls:
            cur_cls = j['clsName']; lines.append(f'{cur_cls}:')
        if j['spec'] != cur_spec:
            cur_spec = j['spec']; lines.append(f'  {cur_spec}:')
        mark = '✔' if j['id'] in done else '☐'
        fac = {'A': ' (Альянс)', 'H': ' (Орда)'}.get(j['faction'], '')
        stage = '  · аркуш' if os.path.exists(os.path.join(HERE, 'out', f"{j['id']}.png")) else ''
        lines.append(f"    {mark} {j['label']} {j['set']}{fac}  @{j['id']}{stage}")
    open(path, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

if __name__ == '__main__':
    import sys
    if '--todo' in sys.argv: write_todo(json.load(open(os.path.join(HERE, 'jobs.json'), encoding='utf-8')))
    else: main()
