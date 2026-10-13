"""Reproducible user-requested pixel edit and original-image avatar crops (Pillow)."""
from pathlib import Path
from PIL import Image, ImageFont, ImageDraw
import hashlib, json
import numpy as np
ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'web/themes/duckyo'
ORIGINALS = ROOT / 'docs/design/duckyo/originals'
OUT = ROOT / 'docs/design/duckyo/previews/v2'
OUT.mkdir(parents=True, exist_ok=True)
original = Image.open(ORIGINALS / 'B-work.jpg').convert('RGB')
work = original.copy()
# The lamp, cord and rays are isolated on the empty blue wall. Extend a
# neighbouring original wall strip; leave the duck, lettering and desk intact.
box = (480, 0, 608, 580)
strip = original.crop((620, 0, 640, 580))
for x in range(480, 608, 20):
    work.paste(strip.crop((0, 0, min(20, 608-x), 580)), (x, 0))
a, b = np.array(original), np.array(work)
mask = np.zeros(a.shape[:2], dtype=bool)
mask[0:580, 480:608] = True
assert np.array_equal(a[~mask], b[~mask]), 'Pixels outside lamp edit changed'
work.save(ROOT / 'docs/design/duckyo/work-no-lamp.png')
w, h = work.size
cut, delta = 227, 91
shifted = Image.new('RGB', (w, h+delta))
shifted.paste(work.crop((0, 0, w, cut)), (0, 0))
shifted.paste(work.crop((0, cut-delta, w, cut)), (0, cut))
shifted.paste(work.crop((0, cut, w, h)), (0, cut+delta))
shifted.save(ASSETS / 'work.webp', lossless=True, method=6)
shifted.crop((0, 0, 1, h+delta)).save(ASSETS / 'edge-work.webp', lossless=True, method=6)
assert np.array_equal(np.array(Image.open(ASSETS / 'work.webp')), np.array(shifted))
crops = {
 'study': ('A-writing.jpg', (290,1130,820,1660)),
 'work': ('B-work.jpg', (74,475,490,891)),
 'phone': ('C-phone.jpg', (100,830,700,1430)),
 'snack': ('D-snack.jpg', (330,1010,810,1490)),
 'cake': ('E-cake.jpg', (220,506,508,794)),
}
for name, (source, crop) in crops.items():
    im = work if name == 'work' else Image.open(ORIGINALS / source).convert('RGB')
    im.crop(crop).resize((256,256), Image.Resampling.LANCZOS).save(ASSETS / f'avatar-{name}.webp', lossless=True, method=6)
work.crop((0,330,640,757)).resize((600,400), Image.Resampling.LANCZOS).save(ASSETS / 'cover.webp', lossless=True, method=6)
for file in ['meal.webp','edge-meal.webp','avatar-meal.webp']:
    (ASSETS / file).unlink(missing_ok=True)
record = json.loads((ASSETS / 'SOURCES.json').read_text())
record['retired'] = [{'source':'F', 'reference':'docs/design/duckyo/originals/F-meal.jpg','reason':'Removed from runtime background and avatar catalog at user request on 2026-10-13; archived reference only.'}]
record['assets'] = [item for item in record['assets'] if item['id'] != 'F']
for item in record['assets']:
    item['avatarCrop'] = list(crops[item['projectFile'].split('.')[0]][1])
    item['sha256'] = hashlib.sha256((ASSETS / item['projectFile']).read_bytes()).hexdigest()
    if item['id'] == 'B':
        item['edit'] = {'master':'docs/design/duckyo/work-no-lamp.png','removed':'Hanging lamp, cord and rays','bounds':list(box),'fill':'Repeat original wall strip x=620..640, same source rows','verification':'RGB outside edit bounds unchanged; shifted lossless WebP matches edited master plus original background strip.'}
        item['verification'] = 'Only the user-requested lamp region edited; all other original pixels retained before pixel relocation.'
record['avatars'] = [{'file':f'avatar-{name}.webp','source':source[0], 'crop':list(crop), 'size':[256,256], **({'editedMaster':'docs/design/duckyo/work-no-lamp.png'} if name=='work' else {})} for name,(source,crop) in crops.items()]
record['cover']['editedMaster'] = 'docs/design/duckyo/work-no-lamp.png'
record['processing'] = 'Non-AI original crops, resize and pixel relocation. Work lamp removal uses neighbouring original wall pixels; outside-mask equality verified. Backgrounds remain lossless. Avatars are determined by background.'
(ASSETS / 'SOURCES.json').write_text(json.dumps(record, ensure_ascii=False, indent=2)+'\n')
# Review sheet: pixel-edited background beside its five linked avatar crops.
sheet = Image.new('RGB', (960, 1320), '#f9f5eb')
sheet.paste(shifted.resize((480,922), Image.Resampling.LANCZOS), (24,48))
font = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 24)
draw = ImageDraw.Draw(sheet)
draw.text((24,12), '打工小鸭 · 移除吊灯', fill='#433828', font=font)
labels = ['专注写字','打工小鸭','手机时光','零食片刻','蛋糕心情']
for i, (name,label) in enumerate(zip(crops,labels)):
    x, y = 540+(i%2)*194, 50+(i//2)*246
    sheet.paste(Image.open(ASSETS / f'avatar-{name}.webp').resize((174,174)), (x,y))
    draw.text((x,y+186), label, fill='#433828', font=font)
sheet.save(OUT / 'edited-assets.jpg', quality=92)
print('Verified lamp-only edit; 5 background-linked avatars; cover updated; retired runtime assets removed.')
