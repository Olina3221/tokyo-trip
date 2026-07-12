"""
make_mapdata.py -- KML 地點資料解析腳本（一次性使用，比照 make_coupons.py）

來源：C:\\Olina\\其它\\東京\\2026東京.kml（唯讀，不寫回，KML 原檔不進 repo）
目標：js/mapdata.js（window.MAPDATA，入版控合法——公開地點名與座標，無個資）

規格（spec Task17 A1）：
- 6 個 Folder → MMDD（開頭4位數字）→ isoDate 2026-MM-DD
- 同日多 Folder（0724-築地 ＋ 0724 橫濱）依檔案內順序合併，築地在前
- <coordinates> 格式為「經度,緯度,高度」→ 輸出 {lat, lon}（對調，高度丟棄）
- 每點自檢：lat∈[35,36]、lon∈[139,141]（東京/成田/橫濱合理範圍）
- 腳本遇非 Point 幾何 fail loud（防 KML 日後改版默默漏點）
- Folder 名無法解析出 MMDD → fail loud（不默默略過）
- 地名含 CDATA/撇號：xml.etree 自動解 CDATA，輸出用 json.dumps(ensure_ascii=False)

執行：  python make_mapdata.py
        python make_mapdata.py C:\\Olina\\其它\\東京\\2026東京.kml
        （標準程式庫，無需安裝）
"""

import sys
import os
import re
import json
import xml.etree.ElementTree as ET

KML_DEFAULT = r"C:\Olina\其它\東京\2026東京.kml"
KML_NS = "http://www.opengis.net/kml/2.2"
OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "js", "mapdata.js")

EXPECTED_TOTAL = 49
EXPECTED_DAYS = 5
LAT_MIN, LAT_MAX = 35, 36
LON_MIN, LON_MAX = 139, 141


def parse_mmdd(folder_name):
    """取資料夾名開頭 4 位數字 → MMDD；失敗即報錯中止（fail loud）。"""
    m = re.match(r'^(\d{4})', folder_name)
    if not m:
        raise ValueError(
            "[FAIL] 無法從 Folder 名解析 MMDD（需開頭 4 位數字）：'{}'".format(folder_name)
        )
    return m.group(1)


def mmdd_to_isodate(mmdd):
    """'0721' → '2026-07-21'"""
    return "2026-{}-{}".format(mmdd[:2], mmdd[2:])


def parse_kml(kml_path):
    """
    解析 KML，回傳：
      day_map: dict { isoDate: [{'name':..., 'lat':..., 'lon':...}, ...] }
      day_order: list[isoDate]（依 Folder 出現順序，同日只記一次）
    """
    tree = ET.parse(kml_path)
    root = tree.getroot()
    ns = KML_NS

    document = root.find("{{{ns}}}Document".format(ns=ns))
    if document is None:
        raise ValueError("[FAIL] KML 格式錯誤：找不到 <Document>")

    folders = document.findall("{{{ns}}}Folder".format(ns=ns))
    if not folders:
        raise ValueError("[FAIL] KML 中找不到任何 <Folder>")

    day_map = {}    # isoDate → list of place dicts
    day_order = []  # 維護 isoDate 出現順序（同日合併只記一次）

    for folder in folders:
        name_el = folder.find("{{{ns}}}name".format(ns=ns))
        if name_el is None or not name_el.text:
            raise ValueError("[FAIL] 某個 <Folder> 缺少 <name>")
        folder_name = name_el.text.strip()

        mmdd = parse_mmdd(folder_name)
        iso_date = mmdd_to_isodate(mmdd)

        if iso_date not in day_map:
            day_map[iso_date] = []
            day_order.append(iso_date)

        placemarks = folder.findall("{{{ns}}}Placemark".format(ns=ns))
        for pm in placemarks:
            # 驗證是 Point 幾何（fail loud 防非 Point）
            point = pm.find("{{{ns}}}Point".format(ns=ns))
            if point is None:
                pm_name_el = pm.find("{{{ns}}}name".format(ns=ns))
                pm_name_text = (pm_name_el.text or "").strip() if pm_name_el is not None else ""
                # 偵測其他幾何類型
                geo_types = []
                for geo in ["LineString", "Polygon", "MultiGeometry"]:
                    if pm.find("{{{ns}}}{g}".format(ns=ns, g=geo)) is not None:
                        geo_types.append(geo)
                geo_str = "/".join(geo_types) if geo_types else "未知幾何"
                raise ValueError(
                    "[FAIL] 非 Point 幾何（{}）：Folder='{}' 地點='{}'。"
                    "KML 原檔可能已加入路線，請重新匯出或移除路線後再跑腳本。".format(
                        geo_str, folder_name, pm_name_text
                    )
                )

            coords_el = point.find("{{{ns}}}coordinates".format(ns=ns))
            if coords_el is None or not coords_el.text:
                raise ValueError(
                    "[FAIL] Folder '{}' 中某 Placemark 缺少 <coordinates>".format(folder_name)
                )

            coords_text = coords_el.text.strip()
            parts = coords_text.split(",")
            if len(parts) < 2:
                raise ValueError(
                    "[FAIL] 座標格式錯誤：'{}' （Folder='{}'）".format(coords_text, folder_name)
                )

            # KML 格式：經度,緯度[,高度] → lat/lon 對調，高度丟棄
            try:
                lon = float(parts[0])
                lat = float(parts[1])
            except ValueError:
                raise ValueError(
                    "[FAIL] 座標數值解析失敗：'{}' （Folder='{}'）".format(coords_text, folder_name)
                )

            # 地點名（xml.etree 自動解 CDATA，.text 直接是純文字）
            pm_name_el = pm.find("{{{ns}}}name".format(ns=ns))
            if pm_name_el is None or pm_name_el.text is None:
                raise ValueError(
                    "[FAIL] Folder '{}' 中某 Placemark 缺少 <name>".format(folder_name)
                )
            place_name = pm_name_el.text.strip()

            day_map[iso_date].append({
                "name": place_name,
                "lat": lat,
                "lon": lon,
            })

    return day_map, day_order


def validate(day_map, day_order):
    """
    自檢（跑完必印摘要）：
    - 總地點數 == EXPECTED_TOTAL (49)
    - 天數 == EXPECTED_DAYS (5)
    - 每點 lat∈[35,36]、lon∈[139,141]
    越界即中止（防 lat/lon 對調錯誤）。
    """
    # 天數
    n_days = len(day_order)
    if n_days != EXPECTED_DAYS:
        raise ValueError(
            "[FAIL] 天數自檢失敗：解析出 {} 天，預期 {} 天。".format(n_days, EXPECTED_DAYS)
        )

    # 總數
    total = sum(len(day_map[d]) for d in day_order)
    if total != EXPECTED_TOTAL:
        raise ValueError(
            "[FAIL] 總地點數自檢失敗：解析到 {} 筆，預期 {} 筆。"
            "請確認 KML 是否正確（腳本依 Placemark 計數，不含路線幾何）。".format(total, EXPECTED_TOTAL)
        )

    # 座標範圍
    coord_errors = []
    for iso in day_order:
        for p in day_map[iso]:
            lat, lon = p["lat"], p["lon"]
            out_of_range = []
            if not (LAT_MIN <= lat <= LAT_MAX):
                out_of_range.append(
                    "lat={} 不在 [{},{}]".format(lat, LAT_MIN, LAT_MAX)
                )
            if not (LON_MIN <= lon <= LON_MAX):
                out_of_range.append(
                    "lon={} 不在 [{},{}]".format(lon, LON_MIN, LON_MAX)
                )
            if out_of_range:
                coord_errors.append(
                    "  [{}] {} → {}".format(iso, p["name"], "、".join(out_of_range))
                )

    if coord_errors:
        print("[FAIL] 座標範圍自檢失敗（lat∈[35,36]/lon∈[139,141] 是東京/成田/橫濱合理範圍）：")
        for e in coord_errors:
            print(e)
        print()
        print("提示：KML <coordinates> 格式為「經度,緯度,高度」，腳本已對調成 lat/lon。")
        print("      若以上數值看起來像 lon（>139）被放在 lat 欄，代表對調邏輯有誤，請回報。")
        raise ValueError("[FAIL] 共 {} 筆座標越界，中止生成。".format(len(coord_errors)))


def generate_js(day_map, day_order):
    """
    生成 mapdata.js 內容（UTF-8）。
    places 陣列用 json.dumps 確保撇號/引號/Unicode 全部正確跳脫。
    """
    sorted_days = sorted(day_order)  # 依 isoDate 升冪

    lines = []
    lines.append("// js/mapdata.js — 由 make_mapdata.py 生成，手改會被覆蓋；資料來源 KML 不進 repo")
    lines.append("// 格式：window.MAPDATA = [{isoDate, places:[{name,lat,lon},...]},...] 依 isoDate 升冪")
    lines.append("")
    lines.append("window.MAPDATA = [")

    for i, iso in enumerate(sorted_days):
        places = day_map[iso]
        is_last_day = (i == len(sorted_days) - 1)

        # places 用 json.dumps 生成（ensure_ascii=False 保留 CJK 字元，正確跳脫撇號/引號）
        place_entries = []
        for p in places:
            entry = json.dumps(
                {"name": p["name"], "lat": p["lat"], "lon": p["lon"]},
                ensure_ascii=False,
                separators=(",", ": ")
            )
            place_entries.append("    {}".format(entry))

        places_block = ",\n".join(place_entries)

        lines.append("  {")
        lines.append('    "isoDate": "{}",'.format(iso))
        lines.append('    "places": [')
        lines.append(places_block)
        lines.append("    ]")
        trailing = "" if is_last_day else ","
        lines.append("  }" + trailing)

    lines.append("];")
    return "\n".join(lines) + "\n"


def main():
    kml_path = sys.argv[1] if len(sys.argv) > 1 else KML_DEFAULT

    if not os.path.exists(kml_path):
        print("[FAIL] KML 檔案不存在：{}".format(kml_path))
        sys.exit(1)

    print("解析 KML：{}".format(kml_path))
    print()

    try:
        day_map, day_order = parse_kml(kml_path)
        validate(day_map, day_order)
    except ValueError as e:
        print(str(e))
        sys.exit(1)

    # 印每天地點數摘要
    sorted_days = sorted(day_order)
    print("── 解析摘要 ──────────────────────────────────────")
    for iso in sorted_days:
        count = len(day_map[iso])
        print("  {}：{} 個地點".format(iso, count))
    total = sum(len(day_map[d]) for d in sorted_days)
    print("  天數：{} 天".format(len(sorted_days)))
    print("  總地點數：{} 筆（自檢通過，預期 {}）".format(total, EXPECTED_TOTAL))
    print("  lat/lon 範圍自檢全部通過（lat=[{},{}] lon=[{},{}]）".format(LAT_MIN, LAT_MAX, LON_MIN, LON_MAX))
    print("─────────────────────────────────────────────────")
    print()

    # 生成 JS
    js_content = generate_js(day_map, day_order)

    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write(js_content)

    print("[OK] 已生成 {}".format(OUTPUT))


if __name__ == "__main__":
    main()
