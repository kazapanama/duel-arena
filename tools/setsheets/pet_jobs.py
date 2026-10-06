"""Завдання на генерацію петів: вовк мисливця (Dire Beast), дух-вовк шамана (Feral Spirit), гуль лицаря смерті,
   фелгард чорнокнижника. → tools/setsheets/pet_jobs.json, prompts/pet_*.txt, refs/pet_*.png
   python tools/setsheets/pet_jobs.py   далі   python tools/setsheets/gen.py --jobs pet_jobs.json   далі   assemble.py"""
import os, json
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
import form_jobs as fj      # COMMON (правила аркуша) і шаблон кота

WOLF = """Make a pixel-art PARTS SHEET of a {WHAT} for a 2D side-view fighting game. The parts will be cut out automatically and attached to a four-legged animation skeleton, so the layout and the scale rules matter more than anything else.

ATTACHED IMAGES
- Image 1 = LAYOUT AND SCALE TEMPLATE. This is the canvas to fill: keep its exact grid (a wide cell top-left, a wide cell bottom-left, two cells on the right of each row), the magenta background and the black grid lines. The grey dashed shapes only show WHERE each part goes, HOW BIG it is and HOW it is oriented: replace every grey shape with the finished part and leave no grey lines.
- Image 2 = a World of Warcraft wolf: copy its anatomy and style - a big, lean, fierce wolf with a long snout, fangs, shaggy fur, a bushy tail and big paws with claws.

THE CREATURE
{LOOK}. Seen strictly from the SIDE, facing RIGHT, like a classic 16-bit fighting-game sprite.

CELLS (never move, merge or skip them)
- Top-left wide cell: the FULL WOLF standing on all four paws, side view facing right, tail behind. Only a reference for proportions.
- Top row, third cell: the HEAD alone (no neck), side view facing right, mouth closed, ears up.
- Top row, fourth cell: the TAIL alone, extended almost horizontally, its base at the RIGHT end and the tip at the LEFT.
- Bottom-left wide cell: the BODY alone - chest, neck, back, belly and haunches; no head, no legs, no tail. Chest and neck on the right.
- Bottom row, third cell: ONE FRONT LEG, perfectly STRAIGHT and VERTICAL: shoulder at the top, paw with claws at the bottom, toes pointing right.
- Bottom row, fourth cell: ONE HIND LEG, STRAIGHT and VERTICAL: hip and thigh at the top, paw at the bottom, toes pointing right.

""" + fj.COMMON

HUMAN = """Make a pixel-art CHARACTER PARTS SHEET of a {WHAT} for a 2D fighting game. The parts will be cut out automatically and attached to an animation skeleton, so the layout and the scale rules below matter more than anything else.

ATTACHED IMAGES
- Image 1 = LAYOUT AND SCALE TEMPLATE. This is the canvas to fill: keep its exact grid, magenta background, black grid lines and the same cells in the same places. The grey dashed shapes only show WHERE each part goes, HOW BIG it is and HOW it is oriented: replace every grey shape with the finished part and leave no grey lines.
- Image 2 = the {WHAT} from World of Warcraft: copy its anatomy, armor and colors faithfully.

THE CREATURE
{LOOK}. 3/4 view facing RIGHT, chest turned toward the viewer, like a classic 16-bit fighting-game sprite; every part in this same view.

CELLS (never move, merge or skip them)
   row 1: [tall left cell, rows 1-2] FULL CREATURE | HEAD | TORSO | LOWER BODY
   row 2: SHOULDER | ARM | LEG
   row 3: [left] PALETTE | MAIN WEAPON | SECOND WEAPON | CAPE
- FULL CREATURE: standing in a combat stance, feet near the bottom of the cell. Only a reference for proportions.
- HEAD only (with its hair, horns or mohawk), 3/4 view facing right.
- TORSO only: chest and belt, no head, no arms and no shoulder pads.
- LOWER BODY only: {LOWER}, seen from the front, hanging from the belt.
- SHOULDER: {SHOULDER}, outer side.
- ARM: ONE arm, perfectly STRAIGHT and VERTICAL: shoulder at the top, elbow in the middle (at the grey tick), {HAND} at the bottom.
- LEG: ONE leg, perfectly STRAIGHT and VERTICAL: hip at the top, knee in the middle (at the grey tick), {FOOT} at the bottom pointing RIGHT.
- {WEAPON}
- Leave the CAPE cell empty magenta. Palette cell: one row of flat square color swatches.

""" + fj.COMMON

# форма Metamorphosis: читабельний силует для бійця ~100 арт-пікселів — без наплічників, фіолетова (не чорна) шкіра,
# крила — окремою деталлю в клітинці плаща (гра вішає їх за спиною, js/cutout.js cutWings)
DEMON = """Make a pixel-art CHARACTER PARTS SHEET of the warlock's METAMORPHOSIS DEMON FORM from World of Warcraft for a 2D fighting game. The parts will be cut out automatically and attached to an animation skeleton, so the layout and the scale rules below matter more than anything else.

ATTACHED IMAGES
- Image 1 = LAYOUT AND SCALE TEMPLATE. This is the canvas to fill: keep its exact grid, magenta background, black grid lines and the same cells in the same places. The grey dashed shapes only show WHERE each part goes, HOW BIG it is and HOW it is oriented: replace every grey shape with the finished part and leave no grey lines.
- Image 2 = the demon form in World of Warcraft: copy its anatomy and colors.

THE DEMON
A tall, lean, athletic demon (not bulky, not hunched): deep violet-purple skin - clearly PURPLE, not black - with lighter lavender highlights on the muscles so the body shape reads clearly, glowing bright magenta-violet veins and rune marks on the chest and arms, a narrow fanged demonic face with glowing violet eyes, two long curved horns of pale bone swept back, a small glowing violet rune sigil floating above the head, long arms with big black claws tipped with violet glow, digitigrade legs ending in black cloven hooves with violet glow, a short ragged dark loincloth. NO shoulder armor, NO spikes on the shoulders. 3/4 view facing RIGHT, chest turned toward the viewer, like a classic 16-bit fighting-game sprite; every part in this same view. Bold readable silhouette: thin dark outline, 3-4 clear tones per color.

CELLS (never move, merge or skip them)
   row 1: [tall left cell, rows 1-2] FULL DEMON | HEAD | TORSO | LOWER BODY
   row 2: SHOULDER | ARM | LEG
   row 3: [left] PALETTE | MAIN WEAPON | SECOND WEAPON | CAPE
- FULL DEMON: standing in a combat stance with its big bat wings spread behind it, feet near the bottom of the cell. Only a reference for proportions.
- HEAD only (with horns and the floating rune), 3/4 view facing right.
- TORSO only: lean muscular chest and waist with the glowing veins; no head, no arms, no wings.
- LOWER BODY only: the short ragged loincloth, seen from the front, hanging from the waist.
- SHOULDER cell: leave it EMPTY magenta (the demon has no shoulder armor).
- ARM: ONE arm, perfectly STRAIGHT and VERTICAL: bare purple shoulder at the top, elbow in the middle (at the grey tick), a big clawed hand at the bottom.
- LEG: ONE leg, perfectly STRAIGHT and VERTICAL: hip at the top, knee in the middle (at the grey tick), a cloven hoof at the bottom pointing RIGHT.
- Leave both WEAPON cells empty magenta: the demon fights with its claws.
- CAPE cell: draw the PAIR OF BAT WINGS instead of a cape - both wings joined at the root, spread wide upward and outward like on the full demon, seen from behind, black-violet leathery membranes with glowing violet edges and dark bony fingers; the whole pair inside the cell. Palette cell: one row of flat square color swatches.

""" + fj.COMMON

PETS = [
    ('pet_wolf', 'cat', '_refs/pets/101389.jpg', WOLF.format(WHAT="hunter's WOLF PET",
        LOOK='a grey-brown timber wolf: dark grey fur on the back, sandy brown flanks, a pale cream belly and muzzle, amber glowing eyes, a scar over one eye')),
    ('pet_spiritwolf', 'cat', '_refs/pets/101389.jpg', WOLF.format(WHAT="shaman's SPIRIT WOLF (Feral Spirit)",
        LOOK='a translucent ghostly spirit wolf made of glowing light-blue spirit energy: icy blue and white fur with wispy flame-like edges, bright white glowing eyes, a few small blue lightning sparks in the fur')),
    ('pet_ghoul', 'human', '_refs/pets/90055.jpg', HUMAN.format(WHAT="death knight's RISEN GHOUL",
        LOOK='a hunched, emaciated undead ghoul: grey-green rotting skin, long stringy pale hair, a huge jaw full of jagged fangs, glowing green eyes, rags and scraps of leather, exposed bones and stitches, very long arms ending in big claws',
        LOWER='a torn loincloth of rags', SHOULDER='a bony shoulder with a scrap of torn leather', HAND='a big clawed hand with long talons',
        FOOT='a bare clawed foot', WEAPON='Leave both weapon cells empty magenta: the ghoul fights with its claws.')),
    ('pet_felguard', 'human', '_refs/pets/29405.jpg', HUMAN.format(WHAT="warlock's FELGUARD demon",
        LOOK='a huge muscular demon warrior: dark blue-grey skin, a tall red mohawk crest of spikes, glowing green eyes, heavy crimson-and-gold spiked plate armor on the shoulders, wrists and legs, a bare muscular chest',
        LOWER='crimson-and-gold plate tassets', SHOULDER='a huge crimson spiked shoulder plate with gold trim', HAND='a closed fist in a crimson gauntlet',
        FOOT='a crimson armored boot', WEAPON='MAIN WEAPON cell: his giant two-handed glaive-axe with a long haft and a huge silver blade, the whole weapon inside its cell, diagonal. Leave the SECOND WEAPON cell empty magenta.')),
    ('pet_infernal', 'human', '_refs/pets/1227808.jpg', HUMAN.format(WHAT="warlock's INFERNAL",
        LOOK='a colossal golem of dark green-black meteorite rock held together by glowing bright fel-green fire: huge jagged boulder shoulders, a small hunched head sunk between the shoulders with a glowing green skull face, cracks across the whole body leaking green flames, enormous rock fists, thick stumpy rock legs. Very bulky and heavy',
        LOWER='the rocky lower body and hips with green fire leaking from the cracks', SHOULDER='a huge jagged boulder shoulder with green flames', HAND='an enormous rock fist',
        FOOT='a heavy rock foot', WEAPON='Leave both weapon cells empty magenta: the infernal fights with its fists.')),
    # не пет, а форма Metamorphosis (Demonology): деталі збираються в модель js/pets.js demonFormModel
    ('form_demon', 'human', '_refs/forms/demon/88715.jpg', DEMON.replace('magenta', 'green').replace('#FF00FF', '#00FF00')),
]

def main():
    out = []
    for pid, kind, ref, prompt in PETS:
        open(os.path.join(HERE, 'prompts', pid + '.txt'), 'w', encoding='utf-8').write(prompt)
        rp = os.path.join(HERE, 'refs', pid + '.png'); fj.prep(os.path.join(ROOT, ref), rp)
        out.append({'id': pid, 'kind': kind, 'set': pid, 'label': 'PET', 'skin': pid,
                    'template': 'tools/setsheets/cat_layout_template.png' if kind == 'cat' else
                                ('tools/setsheets/layout_template_green.png' if pid == 'form_demon' else 'tools/setsheets/layout_template.png'),
                    'bg': 'green' if pid == 'form_demon' else 'magenta',   # фіолетовий демон — на зеленому фоні
                    'ref': f'tools/setsheets/refs/{pid}.png', 'prompt': f'tools/setsheets/prompts/{pid}.txt',
                    'weapons': ['two-handed great axe', None] if pid == 'pet_felguard' else [None, None], 'faction': None,
                    'pack': 'golem' if pid == 'pet_infernal' else None,   # інфернал — масивна збірка (pack_cutout.pack_bulk)
                    'wings': pid == 'form_demon'})                        # клітинка плаща — крила (cape.png → wings.png)
    json.dump(out, open(os.path.join(HERE, 'pet_jobs.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(out), 'петів')

if __name__ == '__main__':
    main()
