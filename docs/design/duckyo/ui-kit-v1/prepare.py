"""Review-only Duckyo stickers: original RGB + alpha mask, no AI redraw.

Writes only beside this file. Never writes runtime web/theme assets.
"""
from pathlib import Path
from collections import deque
import json
import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'originals'
OUT = HERE / 'stickers'
OUT.mkdir(exist_ok=True)
# Crop coordinates use original unshifted source dimensions.
CONFIG = {
    'first-step': ('A-writing.jpg', (270, 1110, 870, 1685), [(1546, 1570, 314, 818)], '暂无打卡'),
    'waiting-message': ('C-phone.jpg', (92, 850, 915, 1510), [(1300, 1323, 112, 889)], '空收件箱'),
    'archive': ('B-work.jpg', (45, 470, 638, 985), [(817, 861, 103, 636)], '暂无归档'),
    'inventory': ('D-snack.jpg', (177, 1004, 905, 1548), [(1365, 1389, 194, 900)], '暂无物品'),
}
manifest = []
for name, (source, box, lines, purpose) in CONFIG.items():
    master = HERE.parent / 'work-no-lamp.png' if source == 'B-work.jpg' else SOURCE / source
    im = Image.open(master).convert('RGB').crop(box)
    rgb = np.asarray(im).copy()
    h, w = rgb.shape[:2]
    # Match the two original background colours. Only connected exterior
    # pixels are removed: white body/eyes and enclosed source details survive.
    colours = [rgb[0, 0].astype(int), rgb[-1, -1].astype(int)]
    exterior_candidate = np.zeros((h, w), dtype=bool)
    for colour in colours:
        exterior_candidate |= np.max(np.abs(rgb.astype(int) - colour), axis=2) < 45
    exterior = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h-1):
            if exterior_candidate[y, x] and not exterior[y, x]:
                exterior[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w-1):
            if exterior_candidate[y, x] and not exterior[y, x]:
                exterior[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for yy, xx in ((y-1,x), (y+1,x), (y,x-1), (y,x+1)):
            if 0 <= yy < h and 0 <= xx < w and exterior_candidate[yy,xx] and not exterior[yy,xx]:
                exterior[yy,xx] = True; q.append((yy,xx))
    alpha = np.where(exterior, 0, 255).astype('uint8')
    # Trim only desk lines outside the original character silhouette.
    for y1, y2, left, right in lines:
        alpha[y1-box[1]:y2-box[1], :max(0,left-box[0])] = 0
        alpha[y1-box[1]:y2-box[1], max(0,right-box[0]):] = 0
    if name == 'waiting-message':
        # Exclude the tail of the wall scribble, away from the duck outline.
        alpha[:50, :130] = 0
    rgba = np.dstack((rgb, alpha))
    assert np.array_equal(rgba[:,:,:3], rgb), 'Source RGB changed'
    cut = Image.fromarray(rgba)
    cut = cut.crop(cut.getbbox())
    # Transparent margins are part of the asset, not a painted sticker border.
    cut.thumbnail((232, 218), Image.Resampling.LANCZOS)
    tile = Image.new('RGBA', (256, 256))
    tile.alpha_composite(cut, ((256-cut.width)//2, (256-cut.height)//2))
    tile.save(OUT / f'{name}.png')
    manifest.append({'id':name, 'purpose':purpose, 'source':f'../originals/{source}', 'editedMaster':'../work-no-lamp.png' if source == 'B-work.jpg' else None, 'crop':list(box), 'deskLineAlphaTrim':lines, 'size':[256,256], 'recommendedDisplayPx':64, 'rgbPreservationBeforeResize':True})
(HERE / 'sticker-sources.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
sheet = Image.new('RGB', (1024, 300), '#f8eec8')
for i, name in enumerate(CONFIG):
    im = Image.open(OUT / f'{name}.png')
    sheet.paste(im, (i*256, 24), im)
sheet.save(HERE / 'stickers-review.png')
print('Four draft stickers; original RGB verified before resize; runtime assets unchanged.')
