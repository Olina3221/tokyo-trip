"""
make_coupons.py -- 折價券圖片壓縮腳本（一次性使用，比照 make_icons.py）

來源：C:/Olina/其它/東京/折價券/（唯讀，不寫回）
目標：img/coupons/（全小寫 ASCII，統一 .jpg）

規格（impact.md C1-C5）：
- EXIF exif_transpose 先行（C3），輸出不帶 EXIF
- PNG alpha 鋪白底再 convert RGB（C4）
- 長邊 <= 2000px（等比縮放，條碼密集者放寬到 2600px）（C2）
- JPEG quality = 82（C2）
- 目標容量 <= 8MB，硬上限 10MB -> 超過停工回報 PM（C1）

執行：  python make_coupons.py
        （需 Pillow：pip install Pillow）
"""

import os
from PIL import Image, ImageOps

SRC = r"C:\Olina\其它\東京\折價券"
DST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "img", "coupons")

QUALITY = 82

# (來源檔名, 目標檔名, 長邊上限, 放寬理由)
MAPPING = [
    ("BicCamera_260505.png",                "biccamera.jpg",     2000, ""),
    ("LAOX_2026.jpg",                       "laox.jpg",          2000, ""),
    ("cosmos2026.jpg",                      "cosmos.jpg",        2000, ""),
    ("tsuruha2026.jpg",                     "tsuruha.jpg",       2600, "7.8MB 長圖多段條碼，放寬保條碼數字可讀"),
    ("sundrug _funtime.jpg",                "sundrug.jpg",       2600, "三段條碼（依金額擇一掃），放寬確保數字可讀"),
    ("DRUGELEVEN_2026.jpg",                 "drugeleven.jpg",    2000, ""),
    ("2026sapporo.jpg",                     "satudora.jpg",      2000, ""),
    ("edion2025.jpg",                       "edion.jpg",         2000, ""),
    ("top_zhtw_renewal.jpg",                "donki.jpg",         2600, "三段條碼，放寬確保數字可讀"),
    ("Keio_2026.jpg",                       "keio.jpg",          2000, ""),
    ("seibu2026.png",                       "seibu-sogo.jpg",    2000, ""),
    ("odakyu.png",                          "odakyu.jpg",        2000, ""),
    ("kintetsu2026.jpg",                    "kintetsu.jpg",      2000, ""),
    ("大丸松坂屋.jpg",                        "daimaru.jpg",       2000, ""),
    ("2026Alpen.png",                       "alpen.jpg",         2000, ""),
    ("FunTime_Victoria_202612.jpg",         "victoria.jpg",      2000, ""),
    ("Lottedutyfree_GINZA_FunTime2026.jpg", "lotte-ginza.jpg",   2000, ""),
    ("成田機場免稅折價卷.jpg",                 "japandutyfree.jpg", 2000, ""),
]


def process_image(src_path, dst_path, max_long):
    img = Image.open(src_path)

    # C3: EXIF 方向校正（防止手機拍的 JPEG 躺著顯示）
    img = ImageOps.exif_transpose(img)

    # C4: PNG alpha 鋪白底，避免黑底或報錯
    if img.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])  # alpha channel 作 mask
        img = bg
    elif img.mode == "P":
        # Palette mode：先轉 RGBA 再鋪白底（涵蓋帶 transparency 的 PNG）
        img = img.convert("RGBA")
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # 等比縮放：長邊 <= max_long
    w, h = img.size
    long_side = max(w, h)
    if long_side > max_long:
        ratio = max_long / long_side
        new_w = max(1, int(w * ratio))
        new_h = max(1, int(h * ratio))
        img = img.resize((new_w, new_h), Image.LANCZOS)

    final_w, final_h = img.size

    # C3: 輸出不帶 EXIF（exif 參數省略即不帶）
    img.save(dst_path, "JPEG", quality=QUALITY, optimize=True)

    size_bytes = os.path.getsize(dst_path)
    return final_w, final_h, size_bytes


def main():
    os.makedirs(DST, exist_ok=True)

    print(f"{'目標檔':35s}  {'尺寸':16s}  {'KB':>8s}  備註")
    print("-" * 80)

    total_bytes = 0
    errors = []

    for src_name, dst_name, max_long, note in MAPPING:
        src_path = os.path.join(SRC, src_name)
        dst_path = os.path.join(DST, dst_name)

        if not os.path.exists(src_path):
            msg = f"來源不存在: {src_path}"
            print(f"[ERROR] {msg}")
            errors.append(msg)
            continue

        w, h, size_bytes = process_image(src_path, dst_path, max_long)
        total_bytes += size_bytes
        size_kb = size_bytes / 1024
        dims = f"{w}x{h}"
        marker = f" <- 放寬 {max_long}px: {note}" if max_long > 2000 else ""
        print(f"{dst_name:35s}  {dims:16s}  {size_kb:8.1f} KB{marker}")

    total_mb = total_bytes / (1024 * 1024)
    print("-" * 80)
    print(f"{'合計 img/coupons/ 總量':35s}  {'':16s}  {total_mb:7.2f} MB")
    print()

    if errors:
        print(f"[FAIL] {len(errors)} 個來源檔案不存在，請確認路徑正確")
        for e in errors:
            print(f"  - {e}")
        return

    if total_mb > 10:
        print("[STOP] 超出硬上限 10MB！停工，請回報 PM 改走方案 C。")
    elif total_mb > 8:
        print(f"[WARN] 超出目標 8MB（{total_mb:.2f} MB），仍在硬上限 10MB 內。請評估是否需進一步壓縮。")
    else:
        print(f"[OK]   總量 {total_mb:.2f} MB <= 8MB，在目標範圍內。")

    print()
    print("完成。請逐張目視確認條碼/QR 與條碼下方數字清晰可讀（C2 規定）。")


if __name__ == "__main__":
    main()
