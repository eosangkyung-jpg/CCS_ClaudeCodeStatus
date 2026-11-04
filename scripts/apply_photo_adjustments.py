"""사진 조정 도구(tools/photo-adjuster.html)의 결과대로 원본을 정사각형으로 잘라 앱 사진을 만든다.

- 입력: tools/photo-adjustments.json, 원본 ref_image/catN.jpg
- 출력: src/assets/images/catN.jpg (정사각형, 최대 600px) → 이후 build_state_images.py로 위젯 묶음 재생성
- 계산은 도구 화면과 동일: 사진 영역 150px에 object-fit: cover로 맞춘 뒤 zoom 배율, x/y(px) 이동.
- 조정하지 않은 사진은 가운데 정사각형으로 자른다(위젯의 기본 표시와 동일).

사용: python scripts/apply_photo_adjustments.py
"""
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ADJ = ROOT / 'tools' / 'photo-adjustments.json'
SRC = ROOT / 'ref_image'
OUT = ROOT / 'src' / 'assets' / 'images'
OUT_MAX = 600

data = json.loads(ADJ.read_text(encoding='utf-8'))
inner = data['frame']['inner']
count = 0
for name, a in data['items'].items():
    im = ImageOps.exif_transpose(Image.open(SRC / name)).convert('RGB')
    w, h = im.size
    s = max(inner / w, inner / h) * a['zoom']          # 원본 1px → 화면 px
    left = (inner - w * s) / 2 + a['x']                # 화면에서 사진 왼쪽 위 위치
    top = (inner - h * s) / 2 + a['y']
    x0, y0, side = -left / s, -top / s, inner / s      # 틀에 보이는 영역(원본 좌표)
    size = min(OUT_MAX, round(side))
    # 틀 밖으로 나간 부분(자동 맞춤을 끈 경우)은 흰색으로 채움
    canvas = Image.new('RGB', (round(side), round(side)), 'white')
    box = (max(0, round(x0)), max(0, round(y0)), min(w, round(x0 + side)), min(h, round(y0 + side)))
    canvas.paste(im.crop(box), (box[0] - round(x0), box[1] - round(y0)))
    canvas.resize((size, size), Image.LANCZOS).save(OUT / name, 'JPEG', quality=90, optimize=True)
    count += 1
print(f'{count} photos cropped -> {OUT.relative_to(ROOT)}')
