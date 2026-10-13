"""Жаба Hex (ульта Restoration-шамана): аркуш out/hex_frog.png (3×2 пози, GPT image) → img/cutout/fx_frog.js.
   python tools/setsheets/frog.py
   Кадри: 0 сидить, 1 горло роздуте, 2 кліпає, 3 присіла перед стрибком, 4 у стрибку, 5 приземлення.
   FROG_DEF: масштаб (одиниць гри на піксель кадру) і точка опори кадру — центр мас по x, низ по y."""
import os, json, numpy as np
from PIL import Image
import slice as slicer, pack_cutout

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
SIT_W = 58          # ширина жаби, що сидить, в одиницях гри (боєць ≈ 110 заввишки)

def main():
    img = Image.open(os.path.join(HERE, 'out', 'hex_frog.png')).convert('RGB')
    W, H = img.size; cw, ch = W // 3, H // 2
    cuts = []
    for j in range(2):
        for i in range(3):
            box = (i * cw, j * ch, (i + 1) * cw, (j + 1) * ch)
            cuts.append(slicer.cut(img, box, inset=8))
    k = SIT_W / cuts[0].width                      # одиниць гри на піксель аркуша
    lines = ['// згенеровано tools/setsheets/frog.py — жаба Hex з out/hex_frog.png',
             'var CUTOUT_IMG=window.CUTOUT_IMG||{}; window.CUTOUT_IMG=CUTOUT_IMG;', "CUTOUT_IMG['fx_frog']={"]
    frames = []
    for n, im in enumerate(cuts):
        a = np.asarray(im.getchannel('A')) > 128
        ys, xs = np.nonzero(a)
        b64, (ratio, pad) = pack_cutout.encode(im, k)
        lines.append(f"  f{n}:'data:image/webp;base64,{b64}',")
        frames.append({'ax': round((xs.mean() + pad) / ratio, 2), 'ay': round((ys.max() + 1 + pad) / ratio, 2), 'u': round(k * ratio, 5)})
    lines.append('};')
    lines.append('var FROG_DEF=' + json.dumps({'frames': frames}) + ';')
    out = os.path.join(ROOT, 'img', 'cutout', 'fx_frog.js')
    open(out, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines) + '\n')
    print(out, os.path.getsize(out) // 1024, 'KB', [c.size for c in cuts])

if __name__ == '__main__':
    main()
