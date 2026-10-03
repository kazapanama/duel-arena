"""Генерація аркушів деталей через OpenAI Images API (edits): Image 1 — layout_template.png, Image 2 — реф сету.
   Ключ: змінна OPENAI_API_KEY або файл tools/setsheets/.openai_key (не потрапляє в git).

   python tools/setsheets/gen.py --dry                         # що буде згенеровано і скільки приблизно коштує — без запитів
   python tools/setsheets/gen.py --only warrior_fury_2         # одне завдання (можна кілька через кому або маску warrior_*)
   python tools/setsheets/gen.py --limit 3                     # перші три незроблені
   python tools/setsheets/gen.py                               # усі незроблені (зроблені — ті, що вже лежать в out/)
   python tools/setsheets/gen.py --only X --force              # перегенерувати
   python tools/setsheets/gen.py --only X --part shoulder      # домалювати одну деталь до готового аркуша → out/X_shoulder.png
   python tools/setsheets/gen.py --anchor out/warrior_protection_1.png   # третім зображенням — схвалений аркуш (тримає стиль)
   python tools/setsheets/gen.py --review                      # контактний лист усіх готових аркушів → out/_review.png

   Результат: out/<id>.png, out/<id>.json (модель, токени, вартість), out/ledger.csv (усі виклики)."""
import os, sys, json, time, base64, argparse, fnmatch, csv, threading
from concurrent.futures import ThreadPoolExecutor
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(HERE, 'out')
TEMPLATE = os.path.join(HERE, 'layout_template.png')
URL = 'https://api.openai.com/v1/images/edits'
# $ за 1M токенів: текст на вході, зображення на вході, зображення на виході (ціни станом на вересень 2026)
PRICES = {'gpt-image-2.5-sunburst': (5, 8, 30), 'gpt-image-2.5-flare': (5, 8, 30), 'gpt-image-2': (5, 8, 30),
          'gpt-image-1.5': (5, 8, 32), 'gpt-image-1': (5, 10, 40), 'gpt-image-1-mini': (2, 2.5, 8)}
# оцінка для --dry: ~1300 токенів тексту, 2 референси по ~1500, вихід 1536×1024 high ≈ 1372 (для 2.5)
EST_TOKENS = (1300, 3000, 1372)

PART_PROMPT = """One part is missing or wrong on the attached sheet. Draw ONLY the {part} of this same character as a new image.
- Image 1 is the parts sheet already made for this character: copy its pixel size, colors, shading and outline exactly; the same scale as the TORSO on that sheet.
- Image 2 is the real armor set (game screenshot): the {part} must match its design.
- {extra}
- One single {part} in the middle of the image, flat pure magenta #FF00FF background, no grid, no shadow, no text."""
PART_EXTRA = {
    'shoulder': 'Seen from the outside in the same 3/4 right-facing view; its bottom edge is where it sits on the shoulder.',
    'helm': 'Helmet only, 3/4 view facing right, no collar or shoulders.',
    'torso': 'Chest and belt only: no head, no arms, no shoulder pads.',
    'lower': 'Only the armor below the belt (tassets, kilt or robe skirt), seen from the front.',
    'arm': 'One arm, perfectly straight and vertical: shoulder at the top, closed fist at the bottom, no shoulder pad.',
    'leg': 'One leg, perfectly straight and vertical: hip at the top, boot at the bottom with the toe pointing right.',
    'weapon': 'The whole main-hand weapon, drawn diagonally.',
    'cape': 'The cape alone, hanging straight, seen from behind.',
}

def api_key():
    k = os.environ.get('OPENAI_API_KEY')
    p = os.path.join(HERE, '.openai_key')
    if not k and os.path.exists(p): k = open(p, encoding='utf-8').read().strip()
    if not k: sys.exit('Немає ключа: задайте OPENAI_API_KEY або покладіть ключ у tools/setsheets/.openai_key')
    return k

def cost(model, usage):
    pt, pi, po = PRICES.get(model, PRICES['gpt-image-2'])
    det = usage.get('input_tokens_details') or {}
    img_in = det.get('image_tokens', 0); txt_in = det.get('text_tokens', usage.get('input_tokens', 0) - img_in)
    return (txt_in * pt + img_in * pi + usage.get('output_tokens', 0) * po) / 1e6

LOCK = threading.Lock()
def ledger(row):
    with LOCK:
        p = os.path.join(OUT, 'ledger.csv'); new = not os.path.exists(p)
        with open(p, 'a', newline='', encoding='utf-8') as f:
            w = csv.writer(f)
            if new: w.writerow(['time', 'id', 'model', 'quality', 'input_tokens', 'output_tokens', 'cost_usd', 'seconds', 'status'])
            w.writerow(row)

def call(args, key, images, prompt, out_png, jid):
    files = [('image[]', (os.path.basename(p), open(p, 'rb'), 'image/png')) for p in images]
    data = {'model': args.model, 'prompt': prompt, 'size': args.size, 'quality': args.quality, 'n': '1', 'output_format': 'png'}
    for attempt in range(6):
        t0 = time.time()
        try:
            r = requests.post(URL, headers={'Authorization': f'Bearer {key}'}, data=data, files=files, timeout=600)
        except requests.RequestException as e:
            print(f'  {jid}: мережа ({e}), повтор…'); time.sleep(10 * (attempt + 1)); continue
        finally:
            for _, (_, fh, _) in files: fh.seek(0)
        if r.status_code == 200:
            js = r.json(); usage = js.get('usage', {})
            open(out_png, 'wb').write(base64.b64decode(js['data'][0]['b64_json']))
            c = cost(args.model, usage); dt = round(time.time() - t0, 1)
            json.dump({'id': jid, 'model': args.model, 'quality': args.quality, 'size': args.size, 'usage': usage, 'cost_usd': round(c, 4),
                       'seconds': dt, 'images': [os.path.relpath(p, ROOT) for p in images], 'prompt': prompt},
                      open(out_png[:-4] + '.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            ledger([time.strftime('%Y-%m-%d %H:%M:%S'), jid, args.model, args.quality, usage.get('input_tokens'), usage.get('output_tokens'), round(c, 4), dt, 'ok'])
            print(f'  ✔ {jid}: ${c:.3f}, {dt} с'); return c
        if r.status_code in (429, 500, 502, 503, 504):
            wait = float(r.headers.get('retry-after') or 15 * (attempt + 1))
            print(f'  {jid}: {r.status_code}, чекаю {wait:.0f} с…'); time.sleep(wait); continue
        msg = r.text[:600]
        ledger([time.strftime('%Y-%m-%d %H:%M:%S'), jid, args.model, args.quality, '', '', 0, 0, f'error {r.status_code}'])
        print(f'  ✘ {jid}: помилка {r.status_code}: {msg}')
        if r.status_code in (400, 401, 403): sys.exit('Зупиняюсь: перевірте ключ, назву моделі чи параметри (див. повідомлення вище).')
        return 0
    print(f'  ✘ {jid}: не вдалося після кількох спроб'); return 0

def review():
    from PIL import Image, ImageDraw
    pngs = sorted(f for f in os.listdir(OUT) if f.endswith('.png') and not f.startswith('_') and '_' in f)
    if not pngs: return print('В out/ ще немає аркушів')
    W, H, C = 384, 256, 5
    sheet = Image.new('RGB', (W * C, (H + 18) * ((len(pngs) + C - 1) // C)), (18, 18, 26)); d = ImageDraw.Draw(sheet)
    for i, f in enumerate(pngs):
        im = Image.open(os.path.join(OUT, f)).convert('RGB'); im.thumbnail((W - 4, H - 4))
        x, y = (i % C) * W, (i // C) * (H + 18); sheet.paste(im, (x + 2, y + 2)); d.text((x + 4, y + H + 2), f[:-4], fill=(240, 220, 120))
    p = os.path.join(OUT, '_review.png'); sheet.save(p); print(p)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='id завдань через кому, можна маски (warrior_*)')
    ap.add_argument('--limit', type=int)
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--dry', action='store_true')
    ap.add_argument('--review', action='store_true')
    ap.add_argument('--part', choices=sorted(PART_EXTRA))
    ap.add_argument('--anchor', help='схвалений аркуш — третім зображенням, щоб тримати однаковий стиль')
    ap.add_argument('--model', default='gpt-image-2.5-sunburst')
    ap.add_argument('--quality', default='high')
    ap.add_argument('--size', default='1536x1024')
    ap.add_argument('--workers', type=int, default=2)
    ap.add_argument('--jobs', default='jobs.json', help='файл завдань (form_jobs.json — форми друїда)')
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    if args.review: return review()
    jobs = json.load(open(os.path.join(HERE, args.jobs), encoding='utf-8'))
    if args.only:
        pats = [p.strip() for p in args.only.split(',')]
        jobs = [j for j in jobs if any(fnmatch.fnmatch(j['id'], p) for p in pats)]
    todo = []
    for j in jobs:
        out_png = os.path.join(OUT, f"{j['id']}_{args.part}.png" if args.part else f"{j['id']}.png")
        if os.path.exists(out_png) and not args.force: continue
        if args.part and not os.path.exists(os.path.join(OUT, f"{j['id']}.png")):
            print(f"  {j['id']}: немає аркуша out/{j['id']}.png — спершу згенеруйте його"); continue
        todo.append((j, out_png))
    if args.limit: todo = todo[:args.limit]
    pt, pi, po = PRICES.get(args.model, PRICES['gpt-image-2'])
    est = (EST_TOKENS[0] * pt + EST_TOKENS[1] * pi * (1.5 if args.anchor else 1) + EST_TOKENS[2] * po) / 1e6
    print(f'Завдань: {len(todo)} · модель {args.model}, {args.quality}, {args.size} · оцінка ≈ ${est:.3f} за виклик, ≈ ${est * len(todo):.2f} разом')
    if args.dry:
        for j, out_png in todo: print(f"  {j['id']:24} {j['label']:5} {j['set']}")
        return
    key = api_key()
    def run(item):
        j, out_png = item
        if args.part:
            images = [os.path.join(OUT, f"{j['id']}.png"), os.path.join(ROOT, j['ref'])]
            prompt = PART_PROMPT.format(part=args.part.upper(), extra=PART_EXTRA[args.part])
        else:
            # шаблон завдання (кіт має власний), реф, додаткові референси (сет скіну для форм друїда)
            images = [os.path.join(ROOT, j['template']) if j.get('template') else TEMPLATE, os.path.join(ROOT, j['ref'])]
            images += [os.path.join(ROOT, r) for r in j.get('refs', [])]
            prompt = open(os.path.join(ROOT, j['prompt']), encoding='utf-8').read()
            if args.anchor:
                images.append(os.path.join(ROOT, args.anchor) if not os.path.isabs(args.anchor) else args.anchor)
                prompt += '\n- Image 3 = an approved sheet from the same game: copy only its pixel size, shading, outline style and layout precision, not its design or colors.'
        return call(args, key, images, prompt, out_png, j['id'] + (f'_{args.part}' if args.part else ''))
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as ex:
        total = sum(ex.map(run, todo))
    print(f'Готово за {time.time() - t0:.0f} с · витрачено ≈ ${total:.2f} (точні токени — out/ledger.csv)')

if __name__ == '__main__':
    main()
