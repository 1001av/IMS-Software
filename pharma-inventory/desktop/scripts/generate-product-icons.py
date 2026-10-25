import os
import math
from PIL import Image, ImageDraw, ImageFilter

def make_squircle(dim, r, color1, color2):
    margin = int(dim * 0.05)
    bbox = [margin, margin, dim - margin, dim - margin]

    base_bg = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(base_bg)
    bg_draw.rounded_rectangle(bbox, radius=r, fill=color1)

    grad_layer = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    grad_draw = ImageDraw.Draw(grad_layer)
    for y in range(dim):
        factor = y / dim
        alpha = int(factor * 120)
        grad_draw.line([(0, y), (dim, y)], fill=(color2[0], color2[1], color2[2], alpha))

    base_bg = Image.alpha_composite(base_bg, grad_layer)

    mask = Image.new("L", (dim, dim), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(bbox, radius=r, fill=255)
    
    final_bg = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    final_bg.paste(base_bg, (0, 0), mask)

    border_draw = ImageDraw.Draw(final_bg)
    border_draw.rounded_rectangle(bbox, radius=r, outline=(255, 255, 255, 70), width=int(dim * 0.015))
    return final_bg, border_draw

def create_agro_icon(size=1024):
    scale = 2
    dim = size * scale
    r = int(dim * 0.24)
    img, draw = make_squircle(dim, r, (5, 150, 105, 255), (4, 78, 56))

    cx, cy = dim // 2, int(dim * 0.53)

    # Soil arc
    arc_bbox = [int(cx - dim * 0.28), int(cy + dim * 0.18), int(cx + dim * 0.28), int(cy + dim * 0.38)]
    draw.arc(arc_bbox, start=190, end=350, fill=(167, 243, 208, 220), width=int(dim * 0.028))

    # Seed
    node_r = int(dim * 0.04)
    node_bbox = [cx - node_r, int(cy + dim * 0.22) - node_r, cx + node_r, int(cy + dim * 0.22) + node_r]
    draw.ellipse(node_bbox, fill=(245, 158, 11, 255))

    # Stem
    stem_pts = [
        (cx - int(dim * 0.022), int(cy + dim * 0.22)),
        (cx - int(dim * 0.015), int(cy + dim * 0.05)),
        (cx - int(dim * 0.035), int(cy - dim * 0.15)),
        (cx, int(dim * 0.18)),
        (cx + int(dim * 0.015), int(cy - dim * 0.12)),
        (cx + int(dim * 0.025), int(cy + dim * 0.08)),
        (cx + int(dim * 0.022), int(cy + dim * 0.22)),
    ]
    draw.polygon(stem_pts, fill=(240, 253, 244, 255))

    # Leaves
    steps = 40
    p0 = (cx - dim * 0.01, cy + dim * 0.08)
    p_tip = (cx - dim * 0.30, cy - dim * 0.14)
    left_leaf = []
    for i in range(steps + 1):
        t = i / steps
        cpx, cpy = cx - dim * 0.12, cy - dim * 0.32
        x = (1 - t)**2 * p0[0] + 2 * (1 - t) * t * cpx + t**2 * p_tip[0]
        y = (1 - t)**2 * p0[1] + 2 * (1 - t) * t * cpy + t**2 * p_tip[1]
        left_leaf.append((x, y))
    for i in range(steps + 1):
        t = i / steps
        cpx, cpy = cx - dim * 0.26, cy + dim * 0.05
        x = (1 - t)**2 * p_tip[0] + 2 * (1 - t) * t * cpx + t**2 * p0[0]
        y = (1 - t)**2 * p_tip[1] + 2 * (1 - t) * t * cpy + t**2 * p0[1]
        left_leaf.append((x, y))
    draw.polygon(left_leaf, fill=(52, 211, 153, 255))

    p0_r = (cx + dim * 0.01, cy - dim * 0.02)
    p_tip_r = (cx + dim * 0.28, cy - dim * 0.24)
    right_leaf = []
    for i in range(steps + 1):
        t = i / steps
        cpx, cpy = cx + dim * 0.16, cy - dim * 0.34
        x = (1 - t)**2 * p0_r[0] + 2 * (1 - t) * t * cpx + t**2 * p_tip_r[0]
        y = (1 - t)**2 * p0_r[1] + 2 * (1 - t) * t * cpy + t**2 * p_tip_r[1]
        right_leaf.append((x, y))
    for i in range(steps + 1):
        t = i / steps
        cpx, cpy = cx + dim * 0.24, cy - dim * 0.02
        x = (1 - t)**2 * p_tip_r[0] + 2 * (1 - t) * t * cpx + t**2 * p0_r[0]
        y = (1 - t)**2 * p_tip_r[1] + 2 * (1 - t) * t * cpy + t**2 * p0_r[1]
        right_leaf.append((x, y))
    draw.polygon(right_leaf, fill=(167, 243, 208, 255))

    sun_r = int(dim * 0.045)
    sun_x = int(cx + dim * 0.18)
    sun_y = int(cy - dim * 0.35)
    draw.ellipse([sun_x - sun_r, sun_y - sun_r, sun_x + sun_r, sun_y + sun_r], fill=(251, 191, 36, 255))

    return img.resize((size, size), Image.Resampling.LANCZOS)

def create_pharma_icon(size=1024):
    scale = 2
    dim = size * scale
    r = int(dim * 0.24)
    img, draw = make_squircle(dim, r, (13, 148, 136, 255), (15, 76, 71))

    cx, cy = dim // 2, dim // 2

    # Clean bold medical plus cross
    arm_w = int(dim * 0.16)
    arm_l = int(dim * 0.54)
    
    # Rounded vertical bar
    v_box = [cx - arm_w // 2, cy - arm_l // 2, cx + arm_w // 2, cy + arm_l // 2]
    draw.rounded_rectangle(v_box, radius=int(arm_w * 0.35), fill=(255, 255, 255, 255))

    # Rounded horizontal bar
    h_box = [cx - arm_l // 2, cy - arm_w // 2, cx + arm_l // 2, cy + arm_w // 2]
    draw.rounded_rectangle(h_box, radius=int(arm_w * 0.35), fill=(255, 255, 255, 255))

    # Emerald-Teal circular center badge
    c_r = int(dim * 0.12)
    draw.ellipse([cx - c_r, cy - c_r, cx + c_r, cy + c_r], fill=(20, 184, 166, 255))

    # Small white center dot
    spark_r = int(dim * 0.04)
    draw.ellipse([cx - spark_r, cy - spark_r, cx + spark_r, cy + spark_r], fill=(255, 255, 255, 255))

    return img.resize((size, size), Image.Resampling.LANCZOS)

def create_kirana_icon(size=1024):
    scale = 2
    dim = size * scale
    r = int(dim * 0.24)
    img, draw = make_squircle(dim, r, (37, 99, 235, 255), (29, 78, 216))

    cx, cy = dim // 2, int(dim * 0.48)

    # Clean stylized shopping cart basket
    bw = int(dim * 0.48)
    bh = int(dim * 0.30)
    
    basket = [
        (cx - int(bw * 0.45), cy - int(bh * 0.4)),
        (cx + int(bw * 0.45), cy - int(bh * 0.4)),
        (cx + int(bw * 0.35), cy + int(bh * 0.4)),
        (cx - int(bw * 0.30), cy + int(bh * 0.4)),
    ]
    draw.polygon(basket, fill=(255, 255, 255, 255))

    # Basket handle
    draw.line([(cx - int(bw * 0.45), cy - int(bh * 0.4)), (cx - int(bw * 0.58), cy - int(bh * 0.7))], fill=(255, 255, 255, 255), width=int(dim * 0.03))

    # Cart wheels
    wheel_y = cy + int(bh * 0.65)
    wr = int(dim * 0.045)
    draw.ellipse([cx - int(bw * 0.2) - wr, wheel_y - wr, cx - int(bw * 0.2) + wr, wheel_y + wr], fill=(251, 191, 36, 255))
    draw.ellipse([cx + int(bw * 0.25) - wr, wheel_y - wr, cx + int(bw * 0.25) + wr, wheel_y + wr], fill=(251, 191, 36, 255))

    # Grocery items inside cart: Green apple / pulse dot & orange box
    draw.ellipse([cx - int(dim * 0.08), cy - int(dim * 0.22), cx + int(dim * 0.04), cy - int(dim * 0.10)], fill=(52, 211, 153, 255))
    draw.rounded_rectangle([cx + int(dim * 0.05), cy - int(dim * 0.26), cx + int(dim * 0.17), cy - int(dim * 0.10)], radius=int(dim * 0.02), fill=(245, 158, 11, 255))

    return img.resize((size, size), Image.Resampling.LANCZOS)

def save_icon_bundle(icon_img, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    icon_32 = icon_img.resize((32, 32), Image.Resampling.LANCZOS)
    icon_128 = icon_img.resize((128, 128), Image.Resampling.LANCZOS)
    icon_256 = icon_img.resize((256, 256), Image.Resampling.LANCZOS)
    icon_512 = icon_img.resize((512, 512), Image.Resampling.LANCZOS)

    icon_32.save(os.path.join(output_dir, "32x32.png"), "PNG")
    icon_128.save(os.path.join(output_dir, "128x128.png"), "PNG")
    icon_256.save(os.path.join(output_dir, "128x128@2x.png"), "PNG")
    icon_512.save(os.path.join(output_dir, "app-icon.png"), "PNG")

    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    icon_img.save(os.path.join(output_dir, "icon.ico"), format="ICO", sizes=ico_sizes)

if __name__ == "__main__":
    base_dir = r"c:\Users\AKHIL\Downloads\pharma-inventory-phase3-inventory\pharma-inventory\desktop\src-tauri"
    
    print("Generating Agro Kendra icons...")
    save_icon_bundle(create_agro_icon(1024), os.path.join(base_dir, "icons-agro"))

    print("Generating Pharma IMS icons...")
    save_icon_bundle(create_pharma_icon(1024), os.path.join(base_dir, "icons-pharma"))

    print("Generating Kirana Store IMS icons...")
    save_icon_bundle(create_kirana_icon(1024), os.path.join(base_dir, "icons-kirana"))

    print("All multi-product icon bundles generated successfully!")
