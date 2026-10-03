"""Завдання на генерацію форм друїда: кіт (Feral), мункін (Balance), дерево життя (Restoration) — по одній на скін.
   → tools/setsheets/form_jobs.json, prompts/<id>_form.txt, refs/<id>_form.png (скріншот форми з гри)
   Image 1 — шаблон (кіт — cat_layout_template.png, сова й дерево — layout_template.png),
   Image 2 — як форма виглядає у WoW, Image 3 — сет скіну (кольори й мотиви).
   python tools/setsheets/form_jobs.py   далі   python tools/setsheets/gen.py --jobs form_jobs.json"""
import os, json
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
FORM = {'druid/Feral': 'cat', 'druid/Balance': 'moonkin', 'druid/Restoration': 'tree'}
REF = {'cat': '_refs/forms/cat/3344.jpg', 'moonkin': '_refs/forms/moonkin/82608.jpg', 'tree': '_refs/forms/tree/1538.jpg'}
TEMPLATE = {'cat': 'tools/setsheets/cat_layout_template.png', 'moonkin': 'tools/setsheets/layout_template.png', 'tree': 'tools/setsheets/layout_template.png'}
# забарвлення форми під сет скіну (як FORM_LOOK у js/models.js)
THEME = {
    'Cenarion Raiment': 'warm brown-gold fur with dark leopard spots, a collar of green leaves around the neck, amber eyes',
    'Thunderheart Harness': 'bright orange fur with bold black tiger stripes, cream belly, a few red-and-white feathers braided at the neck, amber eyes',
    'Lasherweave Garb': 'mossy green fur with darker stripes, small thorny vines and spikes along the spine and tail, glowing green eyes',
    'Stormrage Raiment': 'deep blue feathers with a pale silver-white belly, golden markings and a golden beak, glowing yellow eyes, big antlers',
    'Nordrassil Regalia': 'olive-brown feathers with a pale green belly, leaf-shaped markings, glowing green eyes, mossy antlers',
    'Nightsong Garb': 'violet-purple feathers with a lavender belly, small star-like silver markings, pale glowing eyes, dark antlers',
    'Dreamwalker Raiment': 'dark bark with teal-green leaves and small yellow flowers in the crown, glowing yellow eyes',
    "Malorne Raiment": 'warm brown bark with olive leaves and orange blossoms in the crown, glowing green eyes',
    "Runetotem's Garb": 'dark brown bark with bright green leaves and golden flowers in the crown, glowing yellow eyes',
}
COMMON = """THE MOST IMPORTANT RULES
1. ONE SCALE FOR EVERYTHING. Every separate part must be exactly the same size as that part on the full creature in the large cell; match the grey shapes of Image 1. Do NOT enlarge parts to fill their cells; empty magenta space around a part is correct.
2. BIG CHUNKY PIXELS. In the game the creature is about 100 art-pixels tall, so every art-pixel is a square block of about 6x6 image pixels: bold readable shapes, clean cel shading with 3-4 tones per color, a 1-art-pixel dark outline around every part; no noise, no fine filigree.
3. CLEAN SEPARATE PARTS. Each part is complete on its own with its own outline and nothing from the other parts.
4. Flat pure magenta #FF00FF background everywhere outside the parts: no gradient, no shadow, no glow spilling onto the magenta. Keep the black grid lines of Image 1.
5. NO text, letters, numbers or labels anywhere. Landscape 3:2 image."""

CAT = """Make a pixel-art PARTS SHEET of a druid's CAT FORM for a 2D side-view fighting game. The parts will be cut out automatically and attached to a four-legged animation skeleton, so the layout and the scale rules matter more than anything else.

ATTACHED IMAGES
- Image 1 = LAYOUT AND SCALE TEMPLATE. This is the canvas to fill: keep its exact grid (a wide cell top-left, a wide cell bottom-left, two cells on the right of each row), the magenta background and the black grid lines. The grey dashed shapes only show WHERE each part goes, HOW BIG it is and HOW it is oriented: replace every grey shape with the finished part and leave no grey lines.
- Image 2 = the druid CAT FORM from World of Warcraft: copy its anatomy and style - a big muscular feline (panther / sabre-cat), heavy paws with claws, long tail, fierce face with fangs.
- Image 3 = the druid's armor set "{SET}": take only its color scheme and motifs for the fur.

THE CREATURE
Cat form for the "{SET}" skin: {THEME}. Seen strictly from the SIDE, facing RIGHT, like a classic 16-bit fighting-game sprite.

CELLS (never move, merge or skip them)
- Top-left wide cell: the FULL CAT standing on all four paws, side view facing right, tail up behind. Only a reference for proportions.
- Top row, third cell: the HEAD alone (no neck), side view facing right, mouth closed, ears up.
- Top row, fourth cell: the TAIL alone, extended almost horizontally, its base at the RIGHT end and the tip at the LEFT.
- Bottom-left wide cell: the BODY alone - chest, neck, back, belly and haunches; no head, no legs, no tail. Chest and neck on the right.
- Bottom row, third cell: ONE FRONT LEG, perfectly STRAIGHT and VERTICAL: shoulder at the top, paw with claws at the bottom, toes pointing right.
- Bottom row, fourth cell: ONE HIND LEG, STRAIGHT and VERTICAL: hip and thigh at the top, paw at the bottom, toes pointing right.

""" + COMMON

HUMANOID = """Make a pixel-art PARTS SHEET of a druid's {FORM_NAME} for a 2D fighting game. The parts will be cut out automatically and attached to a two-legged animation skeleton, so the layout and the scale rules matter more than anything else.

ATTACHED IMAGES
- Image 1 = LAYOUT AND SCALE TEMPLATE. This is the canvas to fill: keep its exact grid, magenta background, black grid lines and the same cells in the same places. The grey dashed shapes only show WHERE each part goes, HOW BIG it is and HOW it is oriented: replace every grey shape with the finished part and leave no grey lines.
- Image 2 = the druid {FORM_NAME} from World of Warcraft: copy its anatomy and style - {ANATOMY}.
- Image 3 = the druid's armor set "{SET}": take only its color scheme and motifs.

THE CREATURE
{FORM_NAME} for the "{SET}" skin: {THEME}. 3/4 view facing RIGHT, chest turned toward the viewer, like a classic 16-bit fighting-game sprite; every part in this same view. It holds no weapon.

CELLS (never move, merge or skip them)
   row 1: [tall left cell, rows 1-2] FULL CREATURE | HEAD | BODY | LOWER BODY
   row 2: SHOULDER | ARM | LEG
   row 3: [left] PALETTE | (empty) | (empty) | (empty)
- FULL CREATURE: standing, arms slightly spread, feet near the bottom of the cell. Only a reference for proportions.
- HEAD only{HEAD_NOTE}, 3/4 view facing right.
- BODY only: chest and belly, no head, no arms, no legs.
- LOWER BODY only: {LOWER_NOTE}, seen from the front.
- SHOULDER: {SHOULDER_NOTE}, outer side.
- ARM: ONE {ARM_NOTE}, perfectly STRAIGHT and VERTICAL: shoulder at the top, elbow in the middle (at the grey tick), {HAND_NOTE} at the bottom.
- LEG: ONE {LEG_NOTE}, perfectly STRAIGHT and VERTICAL: hip at the top, knee in the middle (at the grey tick), {FOOT_NOTE} at the bottom pointing RIGHT.
- Leave all three weapon/cape cells in the bottom row empty magenta. Palette cell: one row of flat square color swatches.

""" + COMMON

KIND = {
    'moonkin': dict(FORM_NAME='MOONKIN FORM', ANATOMY='a huge round owl-bear: feathered owl head with a short hooked beak and big glowing eyes, large antlers, a broad round feathered body with a pale belly, thick feathered arms ending in clawed hands, short thick legs with big talons',
                    HEAD_NOTE=' with the antlers', LOWER_NOTE='the lower round feathered belly and the feather "skirt" that hangs over the hips',
                    SHOULDER_NOTE='a big tuft of shoulder feathers', ARM_NOTE='thick feathered arm', HAND_NOTE='a clawed hand', LEG_NOTE='short thick feathered leg', FOOT_NOTE='a big taloned foot'),
    'tree': dict(FORM_NAME='TREE OF LIFE FORM', ANATOMY='a walking treant: a bark-covered trunk body, a face carved in the bark with glowing eyes, a crown of leafy branches and blossoms on top of the head, long branch arms with twig fingers, root legs',
                 HEAD_NOTE=' with its leafy crown of branches', LOWER_NOTE='the lower trunk with hanging roots and bark plates',
                 SHOULDER_NOTE='a shoulder knot of bark with a few leafy twigs', ARM_NOTE='long branch arm', HAND_NOTE='a hand of twig fingers', LEG_NOTE='root leg', FOOT_NOTE='a foot of spread roots'),
}

def prep(src, dst):
    im = Image.open(src).convert('RGB')
    if im.height < 1024: im = im.resize((round(im.width * 1024 / im.height), 1024), Image.LANCZOS)
    im.save(dst)

def main():
    jobs = [j for j in json.load(open(os.path.join(HERE, 'jobs.json'), encoding='utf-8')) if j['key'] in FORM]
    out = []
    for j in jobs:
        kind = FORM[j['key']]; jid = j['id'] + '_form'
        theme = THEME.get(j['set'], 'colors of the armor set')
        text = CAT.format(SET=j['set'], THEME=theme) if kind == 'cat' else HUMANOID.format(SET=j['set'], THEME=theme, **KIND[kind])
        open(os.path.join(HERE, 'prompts', jid + '.txt'), 'w', encoding='utf-8').write(text)
        ref = os.path.join(HERE, 'refs', f'form_{kind}.png')
        if not os.path.exists(ref): prep(os.path.join(ROOT, REF[kind]), ref)
        out.append({'id': jid, 'skin': j['id'], 'kind': kind, 'key': j['key'], 'set': j['set'], 'label': j['label'],
                    'template': TEMPLATE[kind], 'ref': f'tools/setsheets/refs/form_{kind}.png', 'refs': [j['ref']],
                    'prompt': f'tools/setsheets/prompts/{jid}.txt', 'weapons': [None, None], 'faction': None})
    json.dump(out, open(os.path.join(HERE, 'form_jobs.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(out), 'форм:', ', '.join(x['id'] for x in out))

if __name__ == '__main__':
    main()
