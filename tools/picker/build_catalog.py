"""Довідник сетів (вибір у picks.json, завдання — tools/setsheets/build_jobs.py): назви → id у базі Wowhead (WotLK Classic) → головний скріншот.
   python tools/picker/build_catalog.py      →  tools/picker/catalog.js + _refs/picker/img/<id>.jpg
   Кеш сторінок — _refs/picker/cache (повторний запуск нічого не качає вдруге)."""
import os, re, json, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, '_refs', 'picker', 'cache')
IMG = os.path.join(ROOT, '_refs', 'picker', 'img')
os.makedirs(CACHE, exist_ok=True); os.makedirs(IMG, exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

BLOCKED = False   # Wowhead (CloudFront) після сотень запитів віддає 403 — тоді більше не стукаємо, решту докачаємо наступним запуском
def get(url, name, binary=False):
    global BLOCKED
    p = os.path.join(CACHE, name)
    if os.path.exists(p):
        return open(p, 'rb').read() if binary else open(p, encoding='utf-8').read()
    if BLOCKED: raise RuntimeError('Wowhead тимчасово блокує запити')
    time.sleep(1.5)                                    # чемно до Wowhead
    try:
        data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read()
    except urllib.error.HTTPError as e:
        if e.code == 403: BLOCKED = True
        raise
    open(p, 'wb').write(data)
    return data if binary else data.decode('utf-8')

# ---------- усі сети бази: загальний список (обрізаний до 1000) + сторінки класів ----------
WH_CLASS = {'warrior': (1, 'warrior'), 'paladin': (2, 'paladin'), 'hunter': (3, 'hunter'), 'rogue': (4, 'rogue'), 'priest': (5, 'priest'),
            'dk': (6, 'death-knight'), 'shaman': (7, 'shaman'), 'mage': (8, 'mage'), 'warlock': (9, 'warlock'), 'druid': (11, 'druid')}
ALL = {}
def harvest(html):
    for m in re.finditer(r"(?:var itemSets\s*=\s*|template: 'item-set', id: 'item-sets'.*?data:\s*)(\[.*?\])(?:;\s*\n|\s*\}\);)", html, re.S):
        try:
            for d in json.loads(m.group(1)): ALL[d['id']] = d
        except json.JSONDecodeError: pass
harvest(get('https://www.wowhead.com/wotlk/item-sets', 'list.html'))
for k, (cid, slug) in WH_CLASS.items():
    harvest(get(f'https://www.wowhead.com/wotlk/class={cid}/{slug}', f'class{cid}.html'))
BY_NAME = {}
for d in ALL.values(): BY_NAME.setdefault(d['name'].lower(), []).append(d)

# ---------- довідник: клас → (група, мітка, назва, фракція, примітка) ----------
# групи: tier — тір-сети T0.5–T10; arena — сезони арени; extra — інші іконічні (T0, T2.5, ZG, PvP класики)
A, H = 'A', 'H'
def tiers(t05, t1, t2, t3, t4, t5, t6, t7, t8, t9a, t9h, t10, heroic=True):
    out = [('tier', 'T0.5', t05)] if t05 else []
    for lab, names in (('T1', t1), ('T2', t2), ('T3', t3), ('T4', t4), ('T5', t5), ('T6', t6)):
        for n in ([names] if isinstance(names, str) else names):
            if n: out.append(('tier', lab, n))
    hero = lambda lab, n, pre: [('tier', lab, n)] + ([('tier', lab, pre + n, None, 'героїчне перефарбування')] if heroic else [])
    out += hero('T7', t7, 'Valorous ') + hero('T8', t8, "Conqueror's ")
    out += [('tier', 'T9', t9a, A), ('tier', 'T9', t9h, H)]
    out += hero('T10', t10, 'Sanctified ')
    return out
SEASONS = [('A1', "Gladiator's"), ('A2', "Merciless Gladiator's"), ('A3', "Vengeful Gladiator's"), ('A4', "Brutal Gladiator's"),
           ('A5', "Deadly Gladiator's"), ('A6', "Furious Gladiator's"), ('A7', "Relentless Gladiator's"), ('A8', "Wrathful Gladiator's")]
def arena(*suffix, start=1):
    return [('arena', lab, [f'{pre} {s}' for s in suffix]) for lab, pre in SEASONS[start - 1:]]
def extra(t0, t25, zg, pvp_a, pvp_h):
    out = [('extra', 'T0', t0), ('extra', 'T2.5', t25), ('extra', 'ZG', zg)]
    if pvp_a: out.append(('extra', 'PvP', pvp_a, A, 'епічний PvP-сет класики'))
    if pvp_h: out.append(('extra', 'PvP', pvp_h, H, 'епічний PvP-сет класики'))
    return out

CATALOG = {
 'warrior': tiers('Battlegear of Heroism', 'Battlegear of Might', 'Battlegear of Wrath', "Dreadnaught's Battlegear",
                  ['Warbringer Battlegear', 'Warbringer Armor'], ['Destroyer Battlegear', 'Destroyer Armor'], ['Onslaught Battlegear', 'Onslaught Armor'],
                  'Dreadnaught Battlegear', 'Siegebreaker Battlegear', "Wrynn's Battlegear", "Hellscream's Battlegear", "Ymirjar Lord's Battlegear")
            + arena('Battlegear') + extra('Battlegear of Valor', "Conqueror's Battlegear", "Vindicator's Battlegear", "Field Marshal's Battlegear", "Warlord's Battlegear"),
 'paladin': tiers('Soulforge Armor', 'Lawbringer Armor', 'Judgement Armor', 'Redemption Armor',
                  ['Justicar Battlegear', 'Justicar Armor', 'Justicar Raiment'], ['Crystalforge Battlegear', 'Crystalforge Armor', 'Crystalforge Raiment'],
                  ['Lightbringer Battlegear', 'Lightbringer Armor', 'Lightbringer Raiment'],
                  'Redemption Battlegear', 'Aegis Battlegear', "Turalyon's Battlegear", "Liadrin's Battlegear", 'Lightsworn Battlegear')
            + arena('Vindication', 'Aegis', 'Redemption') + extra('Lightforge Armor', "Avenger's Battlegear", "Freethinker's Armor", "Field Marshal's Aegis", None),
 'hunter':  tiers('Beastmaster Armor', 'Giantstalker Armor', 'Dragonstalker Armor', 'Cryptstalker Armor',
                  'Demon Stalker Armor', 'Rift Stalker Armor', "Gronnstalker's Armor",
                  'Cryptstalker Battlegear', 'Scourgestalker Battlegear', "Windrunner's Battlegear", "Windrunner's Pursuit", "Ahn'Kahar Blood Hunter's Battlegear")
            + arena('Pursuit') + extra('Beaststalker Armor', "Striker's Garb", "Predator's Armor", "Field Marshal's Pursuit", "Warlord's Pursuit"),
 'rogue':   tiers('Darkmantle Armor', 'Nightslayer Armor', 'Bloodfang Armor', 'Bonescythe Armor',
                  'Netherblade', 'Deathmantle', "Slayer's Armor",
                  'Bonescythe Battlegear', 'Terrorblade Battlegear', "VanCleef's Battlegear", "Garona's Battlegear", "Shadowblade's Battlegear")
            + arena('Vestments') + extra('Shadowcraft Armor', "Deathdealer's Embrace", "Madcap's Outfit", "Field Marshal's Vestments", "Warlord's Vestments"),
 'priest':  tiers('Vestments of the Virtuous', 'Vestments of Prophecy', 'Vestments of Transcendence', 'Vestments of Faith',
                  ['Incarnate Raiment', 'Incarnate Regalia'], ['Avatar Raiment', 'Avatar Regalia'], ['Vestments of Absolution', 'Absolution Regalia'],
                  'Regalia of Faith', 'Sanctification Regalia', "Velen's Regalia", "Zabra's Regalia", "Crimson Acolyte's Regalia")
            + arena('Investiture', 'Raiment') + extra('Vestments of the Devout', 'Garments of the Oracle', "Confessor's Raiment", "Field Marshal's Raiment", "Warlord's Raiment"),
 'dk':      [('tier', 'T7', 'Scourgeborne Battlegear'), ('tier', 'T7', 'Valorous Scourgeborne Battlegear', None, 'героїчне перефарбування'),
             ('tier', 'T8', 'Darkruned Battlegear'), ('tier', 'T8', "Conqueror's Darkruned Battlegear", None, 'героїчне перефарбування'),
             ('tier', 'T9', "Thassarian's Battlegear", A), ('tier', 'T9', "Koltira's Battlegear", H),
             ('tier', 'T10', "Scourgelord's Battlegear"), ('tier', 'T10', "Sanctified Scourgelord's Battlegear", None, 'героїчне перефарбування')]
            + arena('Desecration', start=5),
 'shaman':  tiers('The Five Thunders', 'The Earthfury', 'The Ten Storms', 'The Earthshatterer',
                  ['Cyclone Harness', 'Cyclone Regalia', 'Cyclone Raiment'], ['Cataclysm Harness', 'Cataclysm Regalia', 'Cataclysm Raiment'],
                  ['Skyshatter Harness', 'Skyshatter Regalia', 'Skyshatter Raiment'],
                  'Earthshatter Battlegear', 'Worldbreaker Battlegear', "Nobundo's Battlegear", "Thrall's Battlegear", "Frost Witch's Battlegear")
            + arena('Earthshaker', 'Thunderfist', 'Wartide') + extra('The Elements', "Stormcaller's Garb", "Augur's Regalia", None, "Warlord's Earthshaker"),
 'mage':    tiers("Sorcerer's Regalia", 'Arcanist Regalia', 'Netherwind Regalia', 'Frostfire Regalia',
                  'Aldor Regalia', 'Tirisfal Regalia', 'Tempest Regalia',
                  'Frostfire Garb', 'Kirin Tor Garb', "Khadgar's Regalia", "Sunstrider's Regalia", "Bloodmage's Regalia")
            + arena('Regalia', 'Silk') + extra("Magister's Regalia", 'Enigma Vestments', "Illusionist's Attire", "Field Marshal's Regalia", "Warlord's Regalia"),
 'warlock': tiers('Deathmist Raiment', 'Felheart Raiment', 'Nemesis Raiment', 'Plagueheart Raiment',
                  'Voidheart Raiment', 'Corruptor Raiment', 'Malefic Raiment',
                  'Plagueheart Garb', 'Deathbringer Garb', "Kel'Thuzad's Regalia", "Gul'dan's Regalia", "Dark Coven's Regalia")
            + arena('Dreadgear', 'Felshroud') + extra('Dreadmist Raiment', "Doomcaller's Attire", "Demoniac's Threads", "Field Marshal's Threads", "Warlord's Threads"),
 'druid':   tiers('Feralheart Raiment', 'Cenarion Raiment', 'Stormrage Raiment', 'Dreamwalker Raiment',
                  ['Malorne Harness', 'Malorne Regalia', 'Malorne Raiment'], ['Nordrassil Harness', 'Nordrassil Regalia', 'Nordrassil Raiment'],
                  ['Thunderheart Harness', 'Thunderheart Regalia', 'Thunderheart Raiment'],
                  'Dreamwalker Garb', 'Nightsong Garb', "Malfurion's Garb", "Runetotem's Garb", 'Lasherweave Garb')
            + arena('Sanctuary', 'Wildhide', 'Refuge') + extra('Wildheart Raiment', 'Genesis Raiment', "Haruspex's Garb", "Field Marshal's Sanctuary", "Warlord's Sanctuary"),
}

def resolve(cls, names):
    """Перша назва зі списку, яку знайдено в базі для цього класу; позитивний id (основна версія) — у пріоритеті."""
    bit = 1 << (WH_CLASS[cls][0] - 1)
    for n in ([names] if isinstance(names, str) else names):
        c = [d for d in BY_NAME.get(n.lower(), []) if not d.get('reqclass') or d['reqclass'] & bit]
        if c:
            c.sort(key=lambda d: (d['id'] < 0, abs(d['id'])))
            return n, c[0]
    return None, None

def shot(set_id, name):
    """Головний скріншот сторінки сету (og:image) → _refs/picker/img/<id>.jpg."""
    out = os.path.join(IMG, f'{set_id}.jpg')
    if os.path.exists(out): return True
    html = get(f'https://www.wowhead.com/wotlk/item-set={set_id}', f'set{set_id}.html')
    m = re.search(r'<meta property="og:image" content="([^"]+)"', html)
    if not m or 'screenshots' not in m.group(1): return False
    open(out, 'wb').write(get(m.group(1), f'img{set_id}.jpg', binary=True))
    return True

# запасні джерела скріншота, якщо на сторінці сету його немає:
# 1) наші старі скріншоти _refs/sets/<назва>_0.jpg (той самий сет або сет із тією ж основою назви)
# 2) сторінка «брата» з тим самим виглядом: інша роль чи складність (… Plate / Garb / Regalia, Valorous …, Sanctified …)
import shutil
OLD = os.path.join(ROOT, '_refs', 'sets')
PREFIX = re.compile(r"^(valorous|conqueror's|heroes'|sanctified|triumphant|the)\s+", re.I)
def base(n):
    n = PREFIX.sub('', n.lower()); n = re.sub(r"'s", '', n)
    return re.sub(r"\s+(armor|battlegear|regalia|garb|raiment|plate|harness)$", '', n).strip()
def slug(n): return re.sub(r'[^a-z0-9]+', '_', n.lower()).strip('_')
CAT_NAMES = {(_c, _n.lower()) for _c, _items in CATALOG.items() for _it in _items for _n in ([_it[2]] if isinstance(_it[2], str) else _it[2])}
COLLIDE = set()
for _cls, _items in CATALOG.items():
    _seen = {}
    for _it in _items:
        for _n in ([_it[2]] if isinstance(_it[2], str) else _it[2]):
            _seen.setdefault(base(_n), set()).add(_it[1])
    COLLIDE |= {(_cls, b) for b, labs in _seen.items() if len(labs) > 1}
def fallback(cls, d, alts=()):
    out = os.path.join(IMG, f"{d['id']}.jpg")
    # арена: той самий сезон, інший спек класу — вигляд однаковий
    for n in alts:
        an, ad = resolve(cls, n)
        if ad and ad['id'] != d['id']:
            try:
                if shot(ad['id'], an):
                    shutil.copy(os.path.join(IMG, f"{ad['id']}.jpg"), out); return 'з варіанта ' + ad['name']
            except Exception as e: print('   помилка', ad['id'], e)
    old = {f[:-6]: f for f in os.listdir(OLD) if f.endswith('_0.jpg')}
    same_base = () if (cls, base(d['name'])) in COLLIDE else tuple(k for k in old if base(k.replace('_', ' ')) == base(d['name']).replace("'", ' ').replace('  ', ' '))
    for key in (slug(d['name']),) + same_base:
        if key in old:
            shutil.copy(os.path.join(OLD, old[key]), out); return 'старий скріншот ' + old[key]
    bit = 1 << (WH_CLASS[cls][0] - 1)
    # «брат» не може бути іншим сетом довідника (T3 Dreamwalker Raiment ≠ T7 Dreamwalker Garb)
    sib = [x for x in ALL.values() if x['id'] != d['id'] and base(x['name']) == base(d['name']) and (not x.get('reqclass') or x['reqclass'] & bit)
           and (cls, x['name'].lower()) not in CAT_NAMES]
    sib.sort(key=lambda x: (PREFIX.match(x['name']) is not None, x['id'] < 0, abs(x['id'])))
    for x in sib[:4]:
        try:
            if shot(x['id'], x['name']):
                shutil.copy(os.path.join(IMG, f"{x['id']}.jpg"), out); return 'з варіанта ' + x['name']
        except Exception as e:
            print('   помилка', x['id'], e)
    return None

def main():
    entries, missing, noshot = [], [], []
    for cls, items in CATALOG.items():
        for it in items:
            group, label, names = it[0], it[1], it[2]
            faction = it[3] if len(it) > 3 else None
            note = it[4] if len(it) > 4 else None
            name, d = resolve(cls, names)
            if not d:
                missing.append(f'{cls}: {names}'); continue
            try:
                ok = shot(d['id'], name)
            except Exception as e:                      # 403/таймаут: сет лишається в довіднику без скріншота
                print('   помилка', d['id'], e); ok = False
            src = None
            if not ok:
                src = fallback(cls, d, [n for n in ([names] if isinstance(names, str) else names) if n != name]); ok = bool(src)
                if src: print(f"   {d['name']}: {src}")
            if not ok: noshot.append(f"{cls}: {name} ({d['id']})")
            if src and src.startswith('з варіанта'): note = (note + '; ' if note else '') + 'скріншот ' + src
            entries.append({'id': d['id'], 'cls': cls, 'group': group, 'label': label, 'name': d['name'], 'faction': faction, 'note': note,
                            'img': f"_refs/picker/img/{d['id']}.jpg" if ok else None,
                            'url': f"https://www.wowhead.com/wotlk/item-set={d['id']}"})
            print(f"{cls:8} {label:5} {d['id']:>6}  {d['name']}{'' if ok else '   (без скріншота)'}")

    with open(os.path.join(ROOT, 'tools', 'picker', 'catalog.js'), 'w', encoding='utf-8') as f:
        f.write('// згенеровано tools/picker/build_catalog.py — довідник сетів для tools/setsheets/build_jobs.py\n')
        f.write('const CATALOG=' + json.dumps(entries, ensure_ascii=False, indent=0) + ';\n')
    print(f'\nусього {len(entries)}; не знайдено {len(missing)}; без скріншота {len(noshot)}')
    for m in missing: print('  НЕ ЗНАЙДЕНО', m)
    for m in noshot: print('  БЕЗ СКРІНШОТА', m)


if __name__ == '__main__':
    main()
