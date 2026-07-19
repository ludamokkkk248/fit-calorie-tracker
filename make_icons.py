"""生成燃卡 FitCal 应用图标：深色底 + 电光绿哑铃"""
from PIL import Image, ImageDraw

BG = (14, 15, 19, 255)        # #0E0F13
ACCENT = (198, 244, 50, 255)  # #C6F432
DARK_ACCENT = (114, 142, 26, 255)

def rounded_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)

def make_dumbbell(size, scale=1.0):
    """在透明画布上画一个水平哑铃，然后旋转 -28 度"""
    c = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    s = size * scale
    cx, cy = size / 2, size / 2
    # 尺寸比例
    bar_w, bar_h = 0.62 * s, 0.075 * s          # 杆
    plate1_w, plate1_h = 0.10 * s, 0.40 * s     # 内侧大片
    plate2_w, plate2_h = 0.075 * s, 0.28 * s    # 外侧小片
    gap = 0.015 * s
    r = 0.035 * s
    # 杆
    rounded_rect(d, (cx - bar_w/2, cy - bar_h/2, cx + bar_w/2, cy + bar_h/2), bar_h/2, ACCENT)
    for side in (-1, 1):
        # 内侧大片
        x1 = cx + side * (bar_w/2 - plate1_w * 1.15)
        rounded_rect(d, sorted_box(x1 - side*plate1_w/2, cy - plate1_h/2, x1 + side*plate1_w/2, cy + plate1_h/2), r, ACCENT)
        # 外侧小片
        x2 = cx + side * (bar_w/2 - plate1_w*1.15 + side*0 + (plate1_w/2 + gap + plate2_w/2) * 1)
        x2 = cx + side * (bar_w/2 - plate1_w*1.15 + plate1_w/2 + gap + plate2_w/2)
        rounded_rect(d, sorted_box(x2 - plate2_w/2, cy - plate2_h/2, x2 + plate2_w/2, cy + plate2_h/2), r, ACCENT)
    return c.rotate(-28, resample=Image.BICUBIC, center=(cx, cy))

def sorted_box(x1, y1, x2, y2):
    return (min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2))

def make_icon(size, maskable=False):
    img = Image.new("RGBA", (size, size), BG)
    d = ImageDraw.Draw(img)
    # 底部微弱的 accent 光晕圆
    glow_r = size * 0.55
    d.ellipse((size*0.5 - glow_r, size*0.72 - glow_r, size*0.5 + glow_r, size*0.72 + glow_r),
              fill=(30, 36, 19, 255))
    scale = 0.72 if maskable else 0.88   # maskable 需要中心安全区
    bell = make_dumbbell(size, scale)
    img.alpha_composite(bell)
    return img.convert("RGB")

import os
os.makedirs("icons", exist_ok=True)
make_icon(512).save("icons/icon-512.png")
make_icon(192).save("icons/icon-192.png")
make_icon(512, maskable=True).save("icons/maskable-512.png")
print("icons generated:", os.listdir("icons"))
