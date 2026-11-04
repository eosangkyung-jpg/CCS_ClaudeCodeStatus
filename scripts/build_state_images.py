"""고양이 사진을 위젯용 Base64 묶음(src/renderer/stateImages.js)으로 만든다.

- 원본: src/assets/images/catN.jpg (ref_image에서 복사해 둔 사진)
- 렌더러는 file:// 경로 문제를 피하려고 Data URI를 쓴다 (TROUBLESHOOTING 17번).
- 카드가 최대 156px × 글자 크기 150% × 화면 배율 정도라, 긴 변 480px로 줄여 묶음 크기를 줄인다.
- 사용하지 않는 사진(분류에서 뺀 사진)은 EXCLUDE에 적는다.

사용: python scripts/build_state_images.py
"""
import base64, io, json, re
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src' / 'assets' / 'images'
OUT = ROOT / 'src' / 'renderer' / 'stateImages.js'
EXCLUDE = {'cat34.jpg'}  # 2026-11-05 분류에서 삭제
MAX_SIDE = 480

def key(p):
    return int(re.search(r'\d+', p.name).group())

images = {}
for path in sorted(SRC.glob('cat*.jpg'), key=key):
    if path.name in EXCLUDE:
        continue
    im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=85, optimize=True)
    images[path.name] = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()

OUT.write_text('window.STATE_IMAGES = ' + json.dumps(images) + ';\n', encoding='utf-8')
print(f'{len(images)} images -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1048576:.2f} MB)')
