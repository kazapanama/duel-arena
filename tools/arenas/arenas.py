"""Фони арен і головного меню через OpenAI Images API (edits): Image 1 — схема композиції (лінія землі), далі промпт.
   python tools/arenas/arenas.py --dry            — список і оцінка вартості
   python tools/arenas/arenas.py [--only id,…]    — згенерувати відсутні (--force — заново)
   Результат: tools/arenas/out/<id>.png (оригінал), img/arenas/<id>.webp (у гру), js/arenas_data.js (THEMES).
   Ключ — той самий, що й для скінів: tools/setsheets/.openai_key."""
import os, sys, json, time, base64, argparse
from concurrent.futures import ThreadPoolExecutor
import requests
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(HERE, 'out'); DST = os.path.join(ROOT, 'img', 'arenas')
W, H, GROUND = 1536, 864, 0.79      # лінія, де стоять ноги бійців (частка висоти); у грі — на 592 з 720 (js/arena.js)

# id, назва в грі, сцена; snow/ember/rain — анімований шар поверх (js/arena.js)
ARENAS = [
    # наявні арени гри
    ('shadow', 'Тінисте плато', 'a haunted plateau of purple rock under a huge pale moon and a starry violet night sky, glowing violet crystals growing from the cliffs, ruined dark stone pillars', {}),
    ('durotar', 'Дуротар', 'the red desert canyons of Durotar at sunset, orange sky, flat-topped red mesas, an orcish palisade of spiked logs with red Horde banners, dry cracked red earth', {'ember': 1}),
    ('northrend', 'Нордскол', 'the frozen wastes of Northrend at night, aurora borealis over snowy mountains, dark snowy pine forest, blue-fire braziers, snow-covered ground', {'snow': 1}),
    # арени World of Warcraft (лише ті, що були у WotLK 3.3.5a)
    ('nagrand', 'Арена Наґранда', "the Nagrand Arena (Ring of Trials) in Outland: a round ogre-built stone arena with wooden spiked palisades and hanging bones, green grassy plains of Nagrand and floating rock islands in a bright alien sky", {}),
    ('blades_edge', 'Арена Блейдс-Еджу', "the Blade's Edge Arena (Circle of Blood) in Outland: a wooden ogre arena on a rock plateau among huge jagged blade-like red rock spires, rope bridges, a dusty orange sky", {}),
    ('lordaeron', 'Руїни Лордерону', "the Ruins of Lordaeron arena: the collapsed throne room of Lordaeron's capital city, broken gothic arches and pillars, ivy, an undead green-tinted gloomy sky seen through the ruined roof, coffins and a green-glowing Forsaken banner", {}),
    ('dalaran', 'Каналізація Даларану', 'the Dalaran Sewers arena (the Underbelly): a stone sewer arena under the magical city, arched brick walls, violet magic lamps, pipes and green-blue water channels, the Underbelly bar balconies above', {}),
    ('ring_of_valor', 'Кільце Звитяги', 'the Ring of Valor arena in Orgrimmar: a large circular orcish gladiator coliseum of dark red stone and iron spikes, roaring crowd of orcs and trolls in the stands, braziers, huge red Horde banners', {'ember': 1}),
    # світові арени
    ('gurubashi', 'Арена Гурубаші', 'the Gurubashi Arena in Stranglethorn Vale: an ancient troll stone amphitheater in the jungle, crumbling stone tiers, tiki torches, jungle trees and a hot tropical sky', {}),
    ('darkmoon', 'Ярмарок Темного Місяця', "the Darkmoon Faire on Darkmoon Island at night: striped carnival tents in purple and gold, lanterns, a Ferris wheel, carnival lights in the starry sky", {}),
    # місця дуелей
    ('stormwind', 'Брама Штормвінда', 'right in front of the main gate of Stormwind City: the huge white stone bridge with the giant hero statues, the tall gate towers with blue Alliance lion banners, a blue sky', {}),
    ('orgrimmar', 'Брама Оргріммара', 'right in front of the main gate of Orgrimmar: massive spiked dark-iron and red-stone orcish gates, Horde banners, red canyon walls, a dusty sunset sky', {'ember': 1}),
    ('ironforge', 'Брама Айронфорджа', 'in front of the giant gate of Ironforge in snowy Dun Morogh: the huge dwarven doors carved into the mountain, a giant dwarf statue, snowy peaks, warm forge light from inside', {'snow': 1}),
    ('dalaran_city', 'Даларан', 'the streets of the floating city of Dalaran: violet-roofed spires of the Kirin Tor, the Violet Citadel, a magical fountain, floating arcane lanterns, a starry purple dusk sky', {}),
]

PROMPT = """Create a background stage for a 2D side-view pixel-art fighting game (like a 16-bit Street Fighter stage), inspired by World of Warcraft.

SCENE: {scene}.

COMPOSITION (follow Image 1, which is only a guide - do not copy its grey colors or the line):
- The black horizontal line in Image 1 marks where the fighters' feet stand. It is at {g}% of the image height. Everything above it is the backdrop of the scene; just below it is the flat walkable ground floor of the arena, seen slightly from above, continuing to the bottom edge.
- The ground floor must be flat and horizontal across the whole width. Keep the central area just above the line open (no objects in front) - two fighters will stand there. Tall landmarks go to the sides and into the distance.
- Strong depth: a detailed far background, mid-ground landmarks, and the floor in front.

STYLE: high-quality detailed pixel art with crisp square pixels (each art-pixel about 3x3 image pixels), rich lighting and atmosphere, vivid but not oversaturated colors, no blur. Wide landscape 16:9.
NO characters in the foreground, NO text, letters, numbers, UI, frames or watermarks."""

MENU_PROMPT = """Create the epic KEY ART for the main menu of a 2D pixel-art fighting game inspired by World of Warcraft.

SCENE: the DARK PORTAL in the Blasted Lands / Hellfire Peninsula, seen from the front: a colossal ancient stone gate with two huge hooded statues holding swords on its pillars, a swirling vortex of bright green fel energy inside the arch, green fel lightning crackling around it, cracked red wasteland with lava fissures and broken stone stairs leading up to the portal, a dark stormy sky with green and red clouds, floating embers. NO characters, no people, no creatures.

COMPOSITION: wide 16:9. The portal is centered and slightly right, its glowing vortex in the middle of the image. Keep the TOP CENTER (top 25%) dark and calm - a game logo will be placed there. Keep the LEFT THIRD of the lower half darker and less busy - the menu text will be placed there.

STYLE: high-quality detailed pixel art with crisp square pixels (each art-pixel about 3x3 image pixels), dramatic green fel lighting on the stone, epic and atmospheric, no blur. NO text, letters, logos or UI."""

def guide():
    p = os.path.join(HERE, 'guide.png')
    if not os.path.exists(p):
        im = Image.new('RGB', (W, H), (128, 128, 128)); d = ImageDraw.Draw(im)
        gy = round(H * GROUND); d.rectangle([0, gy, W, H], fill=(84, 84, 84)); d.line([(0, gy), (W, gy)], fill=(0, 0, 0), width=6)
        im.save(p)
    return p

def key():
    k = os.environ.get('OPENAI_API_KEY'); p = os.path.join(ROOT, 'tools', 'setsheets', '.openai_key')
    return k or open(p, encoding='utf-8').read().strip()

def gen(jid, prompt, args):
    files = [('image[]', ('guide.png', open(guide(), 'rb'), 'image/png'))]
    data = {'model': args.model, 'prompt': prompt, 'size': f'{W}x{H}', 'quality': args.quality, 'n': '1', 'output_format': 'png'}
    for attempt in range(6):
        t0 = time.time()
        r = requests.post('https://api.openai.com/v1/images/edits', headers={'Authorization': f'Bearer {key()}'}, data=data, files=files, timeout=600)
        files[0][1][1].seek(0)
        if r.status_code == 200:
            js = r.json(); u = js.get('usage', {})
            open(os.path.join(OUT, jid + '.png'), 'wb').write(base64.b64decode(js['data'][0]['b64_json']))
            c = (u.get('input_tokens', 0) * 6 + u.get('output_tokens', 0) * 30) / 1e6
            print(f'  ✔ {jid}: ~${c:.3f}, {time.time() - t0:.0f} с'); return c
        if r.status_code in (429, 500, 502, 503, 504): time.sleep(15 * (attempt + 1)); continue
        print(f'  ✘ {jid}: {r.status_code} {r.text[:400]}'); return 0
    return 0

def publish():
    """out/*.png → img/arenas/*.webp і js/arenas_data.js (список арен для гри)."""
    os.makedirs(DST, exist_ok=True)
    ids = {a[0] for a in ARENAS} | {'menu'}   # лише арени зі списку: прибрані з ARENAS не повертаються зі старих out/*.png
    pngs = [f for f in os.listdir(OUT) if f.endswith('.png') and f[:-4] in ids]
    for f in pngs:
        Image.open(os.path.join(OUT, f)).convert('RGB').save(os.path.join(DST, f[:-4] + '.webp'), 'WEBP', quality=86, method=6)
    os.makedirs(os.path.join(DST, 'thumbs'), exist_ok=True)
    for f in pngs:
        if True:
            im = Image.open(os.path.join(OUT, f)).convert('RGB'); im.thumbnail((400, 400), Image.LANCZOS)
            im.save(os.path.join(DST, 'thumbs', f[:-4] + '.webp'), 'WEBP', quality=82, method=6)
    have = [a for a in ARENAS if os.path.exists(os.path.join(DST, a[0] + '.webp'))]
    rows = ',\n'.join(f"  {{kind:{json.dumps(a[0])},name:{json.dumps(a[1], ensure_ascii=False)},img:'img/arenas/{a[0]}.webp',thumb:'img/arenas/thumbs/{a[0]}.webp',ground:{GROUND}"
                      + ''.join(f',{k}:1' for k in a[3]) + '}' for a in have)
    open(os.path.join(ROOT, 'js', 'arenas_data.js'), 'w', encoding='utf-8').write(
        '"use strict";\n// згенеровано tools/arenas/arenas.py — арени з картинками (js/arena.js); ground — частка висоти, де стоять ноги\n'
        f'const ARENA_IMG=[\n{rows}\n];\n')
    print('у грі арен:', len(have), '; меню:', os.path.exists(os.path.join(DST, 'menu.webp')))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only'); ap.add_argument('--force', action='store_true'); ap.add_argument('--dry', action='store_true')
    ap.add_argument('--publish', action='store_true')
    ap.add_argument('--model', default='gpt-image-2.5-sunburst'); ap.add_argument('--quality', default='high')
    args = ap.parse_args(); os.makedirs(OUT, exist_ok=True)
    if args.publish: return publish()
    jobs = [('menu', MENU_PROMPT)] + [(a[0], PROMPT.format(scene=a[2], g=round(GROUND * 100))) for a in ARENAS]
    if args.only: jobs = [j for j in jobs if j[0] in args.only.split(',')]
    jobs = [j for j in jobs if args.force or not os.path.exists(os.path.join(OUT, j[0] + '.png'))]
    print(f'Завдань: {len(jobs)} · ≈ ${len(jobs) * 0.07:.2f}')
    if args.dry: return [print(' ', j[0]) for j in jobs]
    with ThreadPoolExecutor(3) as ex: total = sum(ex.map(lambda j: gen(j[0], j[1], args), jobs))
    print(f'витрачено ≈ ${total:.2f}'); publish()

if __name__ == '__main__':
    main()
