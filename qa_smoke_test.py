#!/usr/bin/env python3
"""
tokyo-trip PWA — 全系統冒煙基線
機械判準版：每個 Task 的核心結構都在這裡驗。
失敗 = 程式碼沒 merge 好；通過 = 基本結構正確（不代表 UI 正確）。

執行：python qa_smoke_test.py
"""

import re
import sys
import os

REPO = os.path.dirname(os.path.abspath(__file__))

def read(path):
    with open(os.path.join(REPO, path), encoding='utf-8') as f:
        return f.read()

errors = []
passes = []

def ok(label):
    passes.append(label)
    print(f'  PASS  {label}')

def fail(label, detail=''):
    msg = f'{label}' + (f' — {detail}' if detail else '')
    errors.append(msg)
    print(f'  FAIL  {msg}')

# ────────────────────────────────────────────────────────────────
# 通用：版本一致性（Task14 起的 bump SOP 機械閘）
# ────────────────────────────────────────────────────────────────
print('\n[版本一致性]')

version_js = read('js/version.js')
sw_js = read('sw.js')

m_app  = re.search(r"window\.APP_VERSION\s*=\s*'(v\d+)'", version_js)
m_date = re.search(r"window\.APP_VERSION_DATE\s*=\s*'([^']+)'", version_js)
m_cache = re.search(r"var CACHE_VERSION\s*=\s*'(v\d+)'", sw_js)

if m_app and m_cache:
    if m_app.group(1) == m_cache.group(1):
        ok(f'APP_VERSION == CACHE_VERSION ({m_app.group(1)})')
    else:
        fail('APP_VERSION != CACHE_VERSION', f'{m_app.group(1)} vs {m_cache.group(1)}')
else:
    fail('版本字串解析失敗')

if m_date:
    ok(f'APP_VERSION_DATE 存在 ({m_date.group(1)})')
else:
    fail('APP_VERSION_DATE 缺失')

# ────────────────────────────────────────────────────────────────
# 通用：PRECACHE_URLS 數量（Task14 起必須保持 42）
# ────────────────────────────────────────────────────────────────
print('\n[PRECACHE_URLS 數量]')

lines = sw_js.split('\n')
in_list = False
count = 0
for line in lines:
    if 'var PRECACHE_URLS' in line and '[' in line:
        in_list = True
    if in_list:
        stripped = line.strip()
        if stripped.startswith("'./") or stripped.startswith('"./'):
            count += 1
        if ']' in stripped and in_list and not stripped.startswith("'./"):
            in_list = False

if count == 42:
    ok(f'PRECACHE_URLS = {count} 筆（零增減）')
else:
    fail(f'PRECACHE_URLS 數量異常', f'預期 42 筆，實際 {count} 筆')

# ────────────────────────────────────────────────────────────────
# Task21：M1 — _renderPrivateSection 函式體內不得有 _renderLodgingBlock
# ────────────────────────────────────────────────────────────────
print('\n[Task21 M1：_renderPrivateSection 函式體]')

trip_tab = read('js/trip-tab.js')

# 取出 _renderPrivateSection 函式體
m_fn = re.search(
    r'function _renderPrivateSection\(\)\s*\{(.+?)^  \}',
    trip_tab,
    re.DOTALL | re.MULTILINE
)
if m_fn:
    body = m_fn.group(1)
    if '_renderLodgingBlock' in body:
        fail('M1 違規：_renderPrivateSection 函式體內含 _renderLodgingBlock 呼叫')
    else:
        ok('M1：_renderPrivateSection 函式體內無 _renderLodgingBlock（隔離確認）')
else:
    fail('M1：找不到 _renderPrivateSection 函式（正則解析失敗）')

# ────────────────────────────────────────────────────────────────
# Task21：M2 — buildHotelSection 兩條路徑都建立 _lodgingContainerEl
# ────────────────────────────────────────────────────────────────
print('\n[Task21 M2：buildHotelSection 兩路徑建容器]')

# 早退路徑：在 innerHTML 賦值後建立容器
early_return_block = re.search(
    r"飯店資料載入失敗.+?return sec;",
    trip_tab,
    re.DOTALL
)
if early_return_block:
    block = early_return_block.group(0)
    if '_lodgingContainerEl' in block and 'trip-lodging' in block:
        ok('M2a：早退路徑（載入失敗）建立 _lodgingContainerEl')
    else:
        fail('M2a：早退路徑未建立 _lodgingContainerEl')
else:
    fail('M2a：找不到早退路徑區塊')

# 正常路徑：forEach 後建立容器
normal_path_block = re.search(
    r'正常路徑.+?_lodgingContainerEl\s*=\s*document\.createElement',
    trip_tab,
    re.DOTALL
)
if normal_path_block:
    ok('M2b：正常路徑（forEach 後）建立 _lodgingContainerEl')
else:
    fail('M2b：正常路徑未找到 _lodgingContainerEl 建立')

# ────────────────────────────────────────────────────────────────
# Task21：M4 — 三個呼叫點都存在
# ────────────────────────────────────────────────────────────────
print('\n[Task21 M4：三個呼叫點]')

call_point_patterns = [
    ('呼叫點 1（clearBtn）', r'App\.privateData\.clear\(\).*?_renderPrivateSection\(\).*?_renderLodgingBlock\(\)', re.DOTALL),
    ('呼叫點 2（confirmBtn）', r'result\.ok.*?_renderPrivateSection\(\).*?_renderLodgingBlock\(\)', re.DOTALL),
    ('呼叫點 3（init 首繪）', r'_renderPrivateSection\(\).*?// Task21 呼叫點 3.*?\n.*?_renderLodgingBlock\(\)', re.DOTALL),
]

for label, pattern, flags in call_point_patterns:
    m = re.search(pattern, trip_tab, flags)
    if m:
        ok(f'M4 {label}')
    else:
        fail(f'M4 {label}：找不到對應的呼叫點')

# 簡單計數確認
count_calls = len(re.findall(r'_renderLodgingBlock\(\)', trip_tab))
# 函式定義本身不算呼叫，所以應是 3 個呼叫 + 1 個定義 = 4 次出現
# 定義行：function _renderLodgingBlock()
count_def = len(re.findall(r'function _renderLodgingBlock\(\)', trip_tab))
count_actual_calls = count_calls - count_def
if count_actual_calls == 3:
    ok(f'M4 呼叫次數 = {count_actual_calls}（恰好 3 個，無多餘呼叫）')
else:
    fail(f'M4 呼叫次數異常', f'預期 3，實際 {count_actual_calls}')

# ────────────────────────────────────────────────────────────────
# Task21：CSS class 存在
# ────────────────────────────────────────────────────────────────
print('\n[Task21 CSS classes]')

style_css = read('css/style.css')

required_classes = [
    '.trip-lodging',
    '.trip-lodging-title',
    '.trip-lodging-empty',
    '.trip-lodging-row',
    '.trip-lodging-row-label',
    '.trip-lodging-row-value',
    '.trip-lodging-copy-btn',
    '.trip-lodging-section',
    '.trip-lodging-section-title',
    '.trip-lodging-wifi-entry',
    '.trip-lodging-wifi-floor',
    '.trip-lodging-selfcheckin',
    '.trip-lodging-host-tel',
]

for cls in required_classes:
    if cls in style_css:
        ok(f'CSS {cls}')
    else:
        fail(f'CSS {cls} 缺失')

# ────────────────────────────────────────────────────────────────
# Task21：type scale — .trip-lodging-* 不得出現硬編碼 px 字級（SA 裁定）
# ────────────────────────────────────────────────────────────────
print('\n[Task21 Type Scale（var(--fs-*) 紀律）]')

# 取出 Task21 CSS 區段
task21_css_block = re.search(
    r'/\*.*?Task21.*?\*/(.*?)(?=/\*|\Z)',
    style_css,
    re.DOTALL
)
if task21_css_block:
    block = task21_css_block.group(1)
    # 排除 copy btn 的 font-size:14px（SA 允許輕量按鈕用 14px）
    lines_with_px = [
        l.strip() for l in block.split('\n')
        if 'font-size' in l and 'px' in l and 'trip-lodging-copy-btn' not in l and '--fs-' not in l
    ]
    if lines_with_px:
        fail('Task21 CSS 含非 var(--fs-*) 的 font-size px 宣告', str(lines_with_px))
    else:
        ok('Task21 CSS：font-size 均使用 var(--fs-*)（copy-btn 除外）')
else:
    fail('找不到 Task21 CSS 區段')

# ────────────────────────────────────────────────────────────────
# Task21：隱私掃描 — 禁止真實密碼 / 電話（三段掃描之 grep 段）
# ────────────────────────────────────────────────────────────────
print('\n[Task21 隱私掃描]')

# 掃描所有 git 追蹤的 JS / HTML / CSS 檔案
# 只掃 TRIP data 與 privateData 相關的檔案（trip-tab.js, tripdata.js, import-data.js, api.md）
scan_files = [
    'js/trip-tab.js',
    'js/tripdata.js',
    'js/import-data.js',
    'specs/Task21.spec.md',
    'specs/Task21.api.md',
]

# 可疑模式：看起來像真實 WiFi 密碼（8+ 位混合大小寫數字，且非 TEST/testpassword 開頭）
suspicious_pw = re.compile(r'(?:password|密碼)\s*[=:]\s*["\']([A-Za-z0-9@#!$%^&*]{8,})["\']')
# 可疑電話（日本 / 台灣格式，非全 0）
suspicious_tel = re.compile(r'(?:tel|電話)\s*[=:]\s*["\'](\+?[1-9]\d{7,})["\']')

privacy_clean = True
for scan_file in scan_files:
    full_path = os.path.join(REPO, scan_file)
    if not os.path.exists(full_path):
        continue
    content = read(scan_file)
    for m in suspicious_pw.finditer(content):
        val = m.group(1).lower()
        if not val.startswith('test') and 'testpassword' not in val:
            fail(f'隱私：{scan_file} 含可疑密碼', m.group(0)[:40])
            privacy_clean = False
    for m in suspicious_tel.finditer(content):
        val = m.group(1)
        if not re.fullmatch(r'0+[-\d]*', val):  # 全 0 是假值
            fail(f'隱私：{scan_file} 含可疑真實電話', val)
            privacy_clean = False

if privacy_clean:
    ok('隱私掃描：JS / spec / api.md 無可疑真實密碼或電話')

# ────────────────────────────────────────────────────────────────
# Task22：Day 2（2026-07-22）items 驗收
# ────────────────────────────────────────────────────────────────
print('\n[Task22：Day 2 items 驗收]')

tripdata_js = read('js/tripdata.js')

# 切出 Day 2 items 區段：isoDate "2026-07-22" 到下一個 isoDate 之前
m_day2 = re.search(
    r'isoDate:\s*"2026-07-22".*?(?=isoDate:\s*"2026-07-2[3-9]")',
    tripdata_js,
    re.DOTALL
)

if not m_day2:
    fail('Task22：找不到 Day 2（2026-07-22）區段')
else:
    day2_seg = m_day2.group(0)

    # T22-1：items 筆數 = 11（time: 欄位計數）
    item_count = len(re.findall(r'time:\s*"', day2_seg))
    if item_count == 11:
        ok(f'T22-1：Day 2 items 筆數 = {item_count}')
    else:
        fail('T22-1：Day 2 items 筆數不符', f'預期 11，實際 {item_count}')

    # T22-2：禁字串 grep=0（僅 Day 2 段）
    banned = ['分頭', '合羽橋', '宇奈とと', '二選一', '11:10']
    for word in banned:
        if word in day2_seg:
            fail(f'T22-2：Day 2 段含禁字串「{word}」')
        else:
            ok(f'T22-2：禁字串「{word}」在 Day 2 段 grep=0')

    # T22-3：「Skytree Shuttle」在 Day 2 段恰出現 1 次（平日停駛警語形式）
    shuttle_count = day2_seg.count('Skytree Shuttle')
    if shuttle_count == 1:
        ok(f'T22-3：「Skytree Shuttle」在 Day 2 段恰 1 次（警語形式）')
    else:
        fail('T22-3：「Skytree Shuttle」在 Day 2 段出現次數異常', f'預期 1，實際 {shuttle_count}')

    # T22-4：時間軸單調遞增（逐筆比對）
    times = re.findall(r'time:\s*"(\d{2}:\d{2})"', day2_seg)
    monotone = all(times[i] < times[i+1] for i in range(len(times)-1))
    if monotone:
        ok(f'T22-4：時間軸單調遞增（{" → ".join(times)}）')
    else:
        fail('T22-4：時間軸非單調遞增', str(times))

# ────────────────────────────────────────────────────────────────
# 結果彙總
# ────────────────────────────────────────────────────────────────
print('\n' + '='*60)
print(f'PASS: {len(passes)}  FAIL: {len(errors)}')
if errors:
    print('\n失敗項目：')
    for e in errors:
        print(f'  x  {e}')
    sys.exit(1)
else:
    print('全部通過。')
    sys.exit(0)
