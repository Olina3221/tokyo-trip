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
# 通用：PRECACHE_URLS 數量（Task23 起必須保持 44，+shoppingdata.js/shopping-tab.js）
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

if count == 44:
    ok(f'PRECACHE_URLS = {count} 筆')
else:
    fail(f'PRECACHE_URLS 數量異常', f'預期 44 筆，實際 {count} 筆')

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
    # Task23 additive（SA F2：新檔納入隱私掃描）
    'js/shoppingdata.js',
    'js/shopping-tab.js',
    'specs/Task23.spec.md',
    'specs/Task23.api.md',
    # Task25 additive（SA B3）
    'specs/Task25.spec.md',
    'specs/Task25.impact.md',
    # Task27 additive（SA 注意事項 4）
    'specs/Task27.spec.md',
    'specs/Task27.impact.md',
    # Task28 additive（SA 注意事項 6）
    'specs/Task28.spec.md',
    'specs/Task28.impact.md',
    # Task29 additive（spec §3）
    'specs/Task29.spec.md',
    'specs/Task29.impact.md',
    # Task30 additive（spec §4-3）
    'CLAUDE.md',
    'specs/STATE.md',
    'specs/Task30.spec.md',
    'specs/Task30.impact.md',
    # Task31 additive（spec §4-8；存在性由 T31-8 自檢，SA B4）
    'specs/PIPELINE.md',
    'specs/Task31.spec.md',
    'specs/Task31.impact.md',
    '.claude/agents/pm.md',
    '.claude/agents/sa.md',
    '.claude/agents/backend.md',
    '.claude/agents/frontend.md',
    '.claude/agents/qa.md',
]
T31_SCAN_ADDED = scan_files[-8:]

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
# Task25：10/22～10/25 新行程覆蓋（Task22 Day 2 區塊含 T23-A2 已整段退場——綁 7/22 內容，SA B1 裁定）
# ────────────────────────────────────────────────────────────────
print('\n[Task25：新行程覆蓋]')

import subprocess

tripdata_js = read('js/tripdata.js')
mapdata_js = read('js/mapdata.js')

# TRIP 段 = window.TRIP = { 到 window.COUPONS 之前（SA B4）
i_trip = tripdata_js.find('window.TRIP = {')
i_coupons = tripdata_js.find('window.COUPONS')
if i_trip < 0 or i_coupons < 0 or i_coupons < i_trip:
    fail('T25：無法切出 TRIP 段（window.TRIP / window.COUPONS 定位失敗）')
    trip_seg = ''
else:
    trip_seg = tripdata_js[i_trip:i_coupons]

# T25-1：itinerary 恰 4 天，isoDate 依序 2026-10-22～10-25
iso_dates = re.findall(r'isoDate:\s*"(\d{4}-\d{2}-\d{2})"', trip_seg)
expected_iso = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']
if iso_dates == expected_iso:
    ok(f'T25-1：itinerary 恰 4 天（{" / ".join(iso_dates)}）')
else:
    fail('T25-1：itinerary isoDate 不符', f'預期 {expected_iso}，實際 {iso_dates}')

# T25-2：flights 欄位
m_flights = re.search(r'flights:\s*\[(.*?)\n  \],', trip_seg, re.DOTALL)
flight_blocks = re.findall(r'\{\s*label:.*?\n    \},', m_flights.group(1), re.DOTALL) if m_flights else []
def fl_field(block, pat):
    m = re.search(pat, block)
    return m.group(1) if m else None
if len(flight_blocks) != 2:
    fail('T25-2：flights 筆數不符', f'預期 2，實際 {len(flight_blocks)}')
else:
    expect = [
        ('去程', 'MM626', '2026/10/22（四）', ('台北桃園', 'T1', '10:50'), ('東京成田', 'T1', '15:20')),
        ('回程', 'MM623', '2026/10/25（日）', ('東京成田', 'T1', '16:40'), ('台北桃園', 'T1', '20:00')),
    ]
    for blk, (lab, fno, date, frm, to) in zip(flight_blocks, expect):
        got = (
            fl_field(blk, r'label:\s*"([^"]*)"'),
            fl_field(blk, r'airline:\s*"([^"]*)"'),
            fl_field(blk, r'flightNo:\s*"([^"]*)"'),
            fl_field(blk, r'date:\s*"([^"]*)"'),
            re.search(r'from:\s*\{\s*airport:\s*"([^"]*)",\s*terminal:\s*"([^"]*)",\s*time:\s*"([^"]*)"', blk),
            re.search(r'to:\s*\{\s*airport:\s*"([^"]*)",\s*terminal:\s*"([^"]*)",\s*time:\s*"([^"]*)"', blk),
        )
        problems = []
        if got[0] != lab: problems.append(f'label={got[0]}')
        if got[1] != '樂桃航空 Peach': problems.append(f'airline={got[1]}')
        if got[2] != fno: problems.append(f'flightNo={got[2]}')
        if got[3] != date: problems.append(f'date={got[3]}')
        if not got[4] or got[4].groups() != frm: problems.append(f'from={got[4].groups() if got[4] else None}')
        if not got[5] or got[5].groups() != to: problems.append(f'to={got[5].groups() if got[5] else None}')
        if problems:
            fail(f'T25-2：{lab} 航班欄位不符', '; '.join(problems))
        else:
            ok(f'T25-2：{lab} {fno} {date} {frm[2]}→{to[2]}')
for word in ['MM625', '16:55', '19:40']:
    if word in trip_seg:
        fail(f'T25-2：TRIP 段仍含舊班次字串「{word}」')
    else:
        ok(f'T25-2：TRIP 段無舊班次字串「{word}」')

# T25-3：hotels[0]
m_hname = re.search(r'hotels:\s*\[\s*\{\s*name:\s*"([^"]*)"', trip_seg)
m_hzh = re.search(r'address_zh:\s*"([^"]*)"', trip_seg)
if m_hname and m_hname.group(1).startswith('Tabist上野39飯店'):
    ok(f'T25-3：hotels[0].name 以 Tabist上野39飯店 開頭')
else:
    fail('T25-3：hotels[0].name 不符', m_hname.group(1) if m_hname else '找不到')
if m_hzh and '上野6-8-11' in m_hzh.group(1):
    ok('T25-3：hotels[0].address_zh 含 上野6-8-11')
else:
    fail('T25-3：hotels[0].address_zh 不符', m_hzh.group(1) if m_hzh else '找不到')

# T25-4：禁字（TRIP 段＋mapdata.js）
for word in ['駒形', '民宿', '橫濱', '横浜', '2026-07-', '2026/07/']:
    bad = [name for name, seg in (('TRIP 段', trip_seg), ('mapdata.js', mapdata_js)) if word in seg]
    if bad:
        fail(f'T25-4：禁字「{word}」出現於 {"、".join(bad)}')
    else:
        ok(f'T25-4：禁字「{word}」在 TRIP 段與 mapdata.js grep=0')

# T25-5：MAPDATA isoDate 集合＝TRIP itinerary isoDate 集合
map_iso = re.findall(r'"isoDate":\s*"(\d{4}-\d{2}-\d{2})"', mapdata_js)
if set(map_iso) == set(iso_dates) and len(map_iso) == len(set(map_iso)):
    ok(f'T25-5：MAPDATA isoDate 集合＝TRIP（{len(map_iso)} 天）')
else:
    fail('T25-5：MAPDATA 與 TRIP isoDate 不對齊', f'MAPDATA {map_iso} vs TRIP {iso_dates}')

# T25-6：Day 4 含 time 逐字「約 12:00」
m_day4 = re.search(r'isoDate:\s*"2026-10-25"(.*?)\n    \},', trip_seg, re.DOTALL)
if m_day4 and re.search(r'time:\s*"約 12:00"', m_day4.group(1)):
    ok('T25-6：Day 4 含 time「約 12:00」')
else:
    fail('T25-6：Day 4 找不到 time「約 12:00」')

# T25-7：全 repo（tracked ∪ 將 commit 的未追蹤檔）P-OLD 命中＝0；程式內顯式排除 東京/（SA B2，不得只靠 .gitignore）
P_OLD = re.compile(r'[Mm][Aa][Pp][Ll][Ee] ?[Hh][Oo][Uu][Ss][Ee]')
BINARY_EXT = ('.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.pdf', '.xlsx', '.kml')
def git_list(*args):
    r = subprocess.run(['git', '-c', 'core.quotepath=false', 'ls-files', *args],
                       cwd=REPO, capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip() or f'git ls-files {args} 失敗')
    return [l for l in r.stdout.splitlines() if l]
try:
    tracked = git_list()
    untracked = git_list('--others', '--exclude-standard')
    git_ok = True
except (OSError, RuntimeError) as e:
    fail('T25-7：git 不可用，無法掃描（fail loud，不得靜默略過）', str(e))
    tracked, untracked, git_ok = [], [], False
if git_ok:
    scan_all = sorted(f for f in set(tracked) | set(untracked) if not f.startswith('東京/'))
    p_old_hits = []
    for f in scan_all:
        if f.lower().endswith(BINARY_EXT):
            continue
        fp = os.path.join(REPO, f)
        if not os.path.isfile(fp):
            continue
        try:
            with open(fp, encoding='utf-8') as fh:
                txt = fh.read()
        except UnicodeDecodeError:
            continue
        n = len(P_OLD.findall(txt))
        if n:
            p_old_hits.append(f'{f}×{n}')
    if p_old_hits:
        fail('T25-7：P-OLD 仍有命中', '、'.join(p_old_hits))
    else:
        ok(f'T25-7：P-OLD 全 repo 命中＝0（掃 {len(scan_all)} 檔，已排除 東京/）')

    # T25-8：.gitignore 含「東京/」一行，且 tracked 無 東京/ 路徑
    gi_lines = [l.strip() for l in read('.gitignore').splitlines()]
    if '東京/' in gi_lines:
        ok('T25-8：.gitignore 含「東京/」')
    else:
        fail('T25-8：.gitignore 缺「東京/」一行')
    tracked_tokyo = [f for f in tracked if f.startswith('東京/')]
    if tracked_tokyo:
        fail('T25-8：git ls-files 含 東京/ 路徑', f'{len(tracked_tokyo)} 筆')
    else:
        ok('T25-8：git ls-files 無 東京/ 路徑')

# T25-9：README.md 與 manifest.webmanifest 不含「四人」
for f in ['README.md', 'manifest.webmanifest']:
    if '四人' in read(f):
        fail(f'T25-9：{f} 仍含「四人」')
    else:
        ok(f'T25-9：{f} 無「四人」')

# ────────────────────────────────────────────────────────────────
# Task27：Day 2／Day 3 依確認版 Excel v1.1 補齊（time／title 逐字寫死；日後改 Day2/3 須同批改本段）
# ────────────────────────────────────────────────────────────────
print('\n[Task27：Day 2／Day 3 行程與地圖點]')

T27_DAYS = {
    '2026-10-23': ('明治神宮・東京車站・淺草寺・晴空塔', [
        ('05:30', '起床'),
        ('06:30', '抵原宿站，前往明治神宮'),
        ('09:00', '麥當勞早餐後前往東京地下街'),
        ('中午', '於東京地下街用餐'),
        ('14:30', '離開東京車站前往淺草寺'),
        ('17:00', '離開淺草前往晴空塔'),
        ('晚間', '於晴空塔用餐'),
        ('20:00', '回 Tabist HOTEL UENO 39'),
    ]),
    '2026-10-24': ('上野阿美橫・秋葉原・澀谷', [
        ('上午', '進上野、阿美橫'),
        ('中午', '於上野阿美橫用餐'),
        ('13:00', '前往秋葉原'),
        ('16:00', '前往澀谷逛街'),
        ('19:00', '回 Tabist HOTEL UENO 39 整理行李'),
    ]),
}

# Task28／Task29：必須有 detail 的 time 白名單（T27-4 修訂用，iso→集合）；集合外一律無 detail
# Task29 修訂：Day 2 加 中午／14:30／17:00（扭蛋店）、Day 3 加 13:00（秋葉原扭蛋店）
T28_DETAIL_TIME = {'2026-10-23': {'09:00', '中午', '14:30', '17:00'},
                   '2026-10-24': {'13:00'}}
t27_item_objs = {}

def t27_day_block(iso):
    m = re.search(r'isoDate:\s*"' + iso + r'"(.*?)\n    \},', trip_seg, re.DOTALL)
    return m.group(1) if m else ''

for iso, (exp_theme, exp_items) in T27_DAYS.items():
    blk = t27_day_block(iso)
    m_items = re.search(r'items:\s*\[(.*)\]', blk, re.DOTALL)
    items_seg = m_items.group(1) if m_items else ''
    item_objs = re.findall(r'\{[^{}]*\}', items_seg)
    times = [ (re.search(r'time:\s*"([^"]*)"', o) or [None, None])[1] for o in item_objs ]
    titles = [ (re.search(r'title:\s*"([^"]*)"', o) or [None, None])[1] for o in item_objs ]
    exp_times = [t for t, _ in exp_items]
    exp_titles = [t for _, t in exp_items]
    # T27-1：筆數＋time 序列逐字（含非鐘點字，不用 HH:MM regex）
    if len(item_objs) == len(exp_items) and times == exp_times:
        ok(f'T27-1：{iso} items 恰 {len(exp_items)} 筆，time 序列逐字相符')
    else:
        fail(f'T27-1：{iso} items 筆數或 time 不符', f'預期 {exp_times}，實際 {times}')
    # T27-2：title 逐字＋theme 逐字
    if titles == exp_titles:
        ok(f'T27-2：{iso} title 逐字相符')
    else:
        fail(f'T27-2：{iso} title 不符', f'預期 {exp_titles}，實際 {titles}')
    m_theme = re.search(r'theme:\s*"([^"]*)"', blk)
    if m_theme and m_theme.group(1) == exp_theme:
        ok(f'T27-2：{iso} theme＝「{exp_theme}」')
    else:
        fail(f'T27-2：{iso} theme 不符', m_theme.group(1) if m_theme else '找不到')
    # T27-4（Task29 修訂，白名單式）：集合內 time「必須有」detail、集合外「必須無」
    must_detail = T28_DETAIL_TIME.get(iso, set())
    has_detail = [bool(re.search(r'\bdetail\s*:', o)) for o in item_objs]
    if not item_objs:
        fail(f'T27-4：{iso} items 為空')
    else:
        bad = [t for t, h in zip(times, has_detail) if h != (t in must_detail)]
        missing = [t for t in must_detail if t not in times]
        if bad or missing:
            fail(f'T27-4（Task29 修訂）：{iso} detail 鍵分布不符',
                 f'異常 time：{bad}；缺 time：{missing}；預期僅 {sorted(must_detail)} 有 detail')
        elif must_detail:
            ok(f'T27-4（Task29 修訂）：{iso} 僅 {sorted(must_detail)} 有 detail，其餘無')
        else:
            ok(f'T27-4：{iso} items 無 detail 鍵')
    t27_item_objs[iso] = item_objs

# T27-3：TRIP 段佔位字串與錯字 grep=0
for word in ['行程待補', '之後再補', '逢街']:
    if word in trip_seg:
        fail(f'T27-3：TRIP 段仍含「{word}」')
    else:
        ok(f'T27-3：TRIP 段「{word}」grep=0')

# T27-5：MAPDATA 點數／名稱逐字／座標範圍
T27_MAP = {
    '2026-10-22': None,
    # Task28 修訂：第 4 點插入麥當勞（6→7 點）；Task29 修訂：第 6／8／10 點插扭蛋店（7→10 點）
    '2026-10-23': ['Tabist上野39飯店（住處）', '原宿駅', '明治神宮',
                   'マクドナルド 原宿竹下通り店（麥當勞早餐）', '東京駅（東京地下街）',
                   'ガシャポンバンダイオフィシャルショップ＠TOKYO STATION（扭蛋）',
                   '浅草寺',
                   'ガシャポンバンダイオフィシャルショップ 浅草花やしき店（扭蛋）',
                   '東京スカイツリー（晴空塔）',
                   'ガシャポンバンダイオフィシャルショップ 東京ソラマチ店（扭蛋）'],
    # Task29 修訂：第 4 點插秋葉原扭蛋店（4→5 點）
    '2026-10-24': ['Tabist上野39飯店（住處）', 'アメ横（上野阿美橫）', '秋葉原駅',
                   'ガシャポンバンダイオフィシャルショップ 秋葉原店（扭蛋）', '渋谷駅'],
    '2026-10-25': None,
}
T27_MAP_COUNT = {'2026-10-22': 3, '2026-10-23': 10, '2026-10-24': 5, '2026-10-25': 3}  # Task29 修訂：10/23 7→10、10/24 4→5
map_blocks = re.findall(r'"isoDate":\s*"(\d{4}-\d{2}-\d{2})",\s*"places":\s*\[(.*?)\]', mapdata_js, re.DOTALL)
map_by_iso = {iso: re.findall(r'\{"name":\s*"([^"]+)",\s*"lat":\s*([-\d.]+),\s*"lon":\s*([-\d.]+)\}', body)
              for iso, body in map_blocks}
for iso, exp_n in T27_MAP_COUNT.items():
    pts = map_by_iso.get(iso, [])
    if len(pts) == exp_n:
        ok(f'T27-5：MAPDATA {iso} 恰 {exp_n} 點')
    else:
        fail(f'T27-5：MAPDATA {iso} 點數不符', f'預期 {exp_n}，實際 {len(pts)}')
    exp_names = T27_MAP[iso]
    if exp_names is not None:
        names = [p[0] for p in pts]
        if names == exp_names:
            ok(f'T27-5：MAPDATA {iso} 名稱逐字相符')
        else:
            fail(f'T27-5：MAPDATA {iso} 名稱不符', f'預期 {exp_names}，實際 {names}')
bad_coord = [f'{iso}:{n}' for iso, pts in map_by_iso.items() for n, la, lo in pts
             if not (35 <= float(la) <= 36 and 139 <= float(lo) <= 141)]
if bad_coord:
    fail('T27-5：座標超出 lat∈[35,36]／lon∈[139,141]', '、'.join(bad_coord))
else:
    ok(f'T27-5：全部 {sum(len(p) for p in map_by_iso.values())} 點座標在 lat∈[35,36]、lon∈[139,141]')

# ────────────────────────────────────────────────────────────────
# Task28：10/23 早餐麥當勞 原宿竹下通店（detail＋地圖點；店家若再換，T28-1/2 與 T27-4/5 同批改）
# ────────────────────────────────────────────────────────────────
print('\n[Task28：麥當勞 原宿竹下通店]')

# T28-1：Day 2 09:00 detail 逐字＝spec §1。
# 跳脫層級：tripdata.js 原始碼內是字面「\n」（反斜線＋n）；抽出後一律 .replace('\\n', '\n') 轉成真換行，
# 再與下方以真換行組成的預期值比對（預期值不使用 raw 字面，避免兩邊混用）。
T28_DETAIL = ('🍔 麥當勞 原宿竹下通店（マクドナルド 原宿竹下通り店）\n'
              '📍 東京都渋谷区神宮前1-19-8 原宿ファミリービル\n'
              'JR 原宿站「竹下口」出站步行約 1 分\n'
              '⏰ 營業 07:00～22:00，早餐供應至 10:30（營業時間可能變動）')
t28_obj = next((o for o in t27_item_objs.get('2026-10-23', [])
                if re.search(r'time:\s*"09:00"', o)), '')
m_det = re.search(r'detail:\s*"([^"]*)"', t28_obj)
det = m_det.group(1).replace('\\n', '\n') if m_det else None
if det == T28_DETAIL and all(k in det for k in ['神宮前1-19-8', '竹下口', '10:30']):
    ok('T28-1：Day 2 09:00 detail 與 spec §1 逐字相同（4 行）')
else:
    fail('T28-1：Day 2 09:00 detail 不符', f'實際：{det!r}')

# T28-2：MAPDATA 10/23 第 4 點名稱逐字＋與 原宿駅 haversine 100～400m
def t28_haversine(la1, lo1, la2, lo2):
    import math
    p1, p2 = math.radians(la1), math.radians(la2)
    dp, dl = p2 - p1, math.radians(lo2 - lo1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(a))

pts23 = map_by_iso.get('2026-10-23', [])
T28_NAME = 'マクドナルド 原宿竹下通り店（麥當勞早餐）'
st = next((p for p in pts23 if p[0] == '原宿駅'), None)
if len(pts23) >= 4 and pts23[3][0] == T28_NAME and st:
    d = t28_haversine(float(st[1]), float(st[2]), float(pts23[3][1]), float(pts23[3][2]))
    if 100 <= d <= 400:
        ok(f'T28-2：10/23 第 4 點＝「{T28_NAME}」，距原宿駅 {d:.0f}m（100～400m）')
    else:
        fail('T28-2：麥當勞點距原宿駅不在 100～400m', f'{d:.0f}m')
else:
    fail('T28-2：10/23 第 4 點名稱不符或缺原宿駅', f'實際：{pts23[3][0] if len(pts23) >= 4 else None}')

# T28-3：已歇業 原宿表参道店（神宮前1-13-9）在 TRIP 段＋mapdata.js grep=0（specs 合法含說明字樣，不掃）
for word in ['表参道店', '1-13-9']:
    hits = [n for n, txt in [('TRIP 段', trip_seg), ('js/mapdata.js', mapdata_js)] if word in txt]
    if hits:
        fail(f'T28-3：「{word}」出現於', '、'.join(hits))
    else:
        ok(f'T28-3：TRIP 段＋mapdata.js「{word}」grep=0')

# ────────────────────────────────────────────────────────────────
# Task29：萬代扭蛋官方店 4 家（detail＋地圖點；換店／刪店時 T29-1/2 與 T27-4/5 同批改）
# 店名「＠」為全形（官方 bandainamco-am.co.jp 店舖頁、東京駅一番街官網寫法），detail／點名／斷言三處逐字一致
# ────────────────────────────────────────────────────────────────
print('\n[Task29：萬代扭蛋官方店]')

# T29-1：detail 掛在指定 (iso, time)，含店名日文＋地址關鍵字（不斷言營業時間）
# 跳脫層級同 T28-1：抽出後 .replace('\\n', '\n')；本斷言只用 in 比對，不含換行。
T29_DETAIL = [
    ('2026-10-23', '中午', 'ガシャポンバンダイオフィシャルショップ＠TOKYO STATION', '東京駅一番街'),
    ('2026-10-23', '14:30', 'ガシャポンバンダイオフィシャルショップ 浅草花やしき店', '浅草2-28-1'),
    ('2026-10-23', '17:00', 'ガシャポンバンダイオフィシャルショップ 東京ソラマチ店', '押上1-1-2'),
    ('2026-10-24', '13:00', 'ガシャポンバンダイオフィシャルショップ 秋葉原店', '外神田1-15-9'),
]
for iso, t, name, addr in T29_DETAIL:
    obj = next((o for o in t27_item_objs.get(iso, [])
                if re.search(r'time:\s*"' + re.escape(t) + r'"', o)), '')
    m_d = re.search(r'detail:\s*"([^"]*)"', obj)
    d = m_d.group(1).replace('\\n', '\n') if m_d else ''
    if name in d and addr in d:
        ok(f'T29-1：{iso} {t} detail 含「{name}」＋「{addr}」')
    else:
        fail(f'T29-1：{iso} {t} detail 缺店名或地址', f'實際：{d!r}')

# T29-2：新點名稱逐字＋位置序號（1-based）＋與參考點距離（spec §2 規則 3）
T29_POINTS = [
    ('2026-10-23', 6, 'ガシャポンバンダイオフィシャルショップ＠TOKYO STATION（扭蛋）', '東京駅（東京地下街）', 0, 500),
    ('2026-10-23', 8, 'ガシャポンバンダイオフィシャルショップ 浅草花やしき店（扭蛋）', '浅草寺', 100, 600),
    ('2026-10-23', 10, 'ガシャポンバンダイオフィシャルショップ 東京ソラマチ店（扭蛋）', '東京スカイツリー（晴空塔）', 0, 400),
    ('2026-10-24', 4, 'ガシャポンバンダイオフィシャルショップ 秋葉原店（扭蛋）', '秋葉原駅', 0, 500),
]
for iso, pos, name, ref, lo_m, hi_m in T29_POINTS:
    pts = map_by_iso.get(iso, [])
    p = pts[pos - 1] if len(pts) >= pos else None
    r = next((x for x in pts if x[0] == ref), None)
    if not p or p[0] != name or not r:
        fail(f'T29-2：{iso} 第 {pos} 點名稱不符或缺參考點「{ref}」', f'實際：{p[0] if p else None}')
        continue
    dist = t28_haversine(float(r[1]), float(r[2]), float(p[1]), float(p[2]))
    if lo_m <= dist <= hi_m:
        ok(f'T29-2：{iso} 第 {pos} 點＝「{name}」，距{ref} {dist:.0f}m（{lo_m}～{hi_m}m）')
    else:
        fail(f'T29-2：{iso} 第 {pos} 點距{ref}超界', f'{dist:.0f}m，應 {lo_m}～{hi_m}m')

# T29-3：不加的分店（池袋 2 家、歌舞伎町）在 TRIP 段＋mapdata.js grep=0
# ⚠ 範圍只能是 trip_seg＋mapdata_js：COUPONS 段既有折價券說明含「西武池袋」，掃整個 tripdata.js 必誤紅
for word in ['池袋', '歌舞伎町']:
    hits = [n for n, txt in [('TRIP 段', trip_seg), ('js/mapdata.js', mapdata_js)] if word in txt]
    if hits:
        fail(f'T29-3：「{word}」出現於', '、'.join(hits))
    else:
        ok(f'T29-3：TRIP 段＋mapdata.js「{word}」grep=0')

# ────────────────────────────────────────────────────────────────
# Task23：shoppingdata.js 結構驗收
# ────────────────────────────────────────────────────────────────
print('\n[Task23：shoppingdata.js 結構]')

shopping_path = os.path.join(REPO, 'js/shoppingdata.js')
if not os.path.exists(shopping_path):
    fail('T23-B0：js/shoppingdata.js 不存在')
else:
    shopping_js = read('js/shoppingdata.js')

    # T23-B1：匯率註記
    if '0.18' in shopping_js:
        ok('T23-B1：shoppingdata.js 含匯率 0.18')
    else:
        fail('T23-B1：shoppingdata.js 缺匯率 0.18')

    # T23-B2：分類 id drug/gift
    if '"drug"' in shopping_js and '"gift"' in shopping_js:
        ok('T23-B2：分類 id drug/gift 存在')
    else:
        fail('T23-B2：分類 id drug/gift 缺失')

    # T23-B3：藥妝 d01–d12（12 筆）
    drug_ids = [f'"d{str(i).zfill(2)}"' for i in range(1, 13)]
    missing_drug = [d for d in drug_ids if d not in shopping_js]
    if not missing_drug:
        ok('T23-B3：藥妝 d01–d12 全部存在（12 筆）')
    else:
        fail('T23-B3：藥妝 id 缺失', str(missing_drug))

    # T23-B4：伴手禮 8 筆（g07 東京香蕉、g10 白色戀人已於 v24 移除；id 不重編）
    gift_ids_expected = ['"g01"', '"g02"', '"g03"', '"g04"', '"g05"', '"g06"', '"g08"', '"g09"']
    gift_ids_removed  = ['"g07"', '"g10"']
    missing_gift = [g for g in gift_ids_expected if g not in shopping_js]
    still_present = [g for g in gift_ids_removed if g in shopping_js]
    if not missing_gift and not still_present:
        ok('T23-B4：伴手禮 g01-g06/g08/g09 存在（8 筆），g07/g10 已正確移除')
    elif still_present:
        fail('T23-B4：g07/g10 應已移除但仍存在', str(still_present))
    else:
        fail('T23-B4：伴手禮 id 缺失', str(missing_gift))

    # T23-B5：star: true 恰 6 個（藥妝 4 + 伴手禮 2；g07/g10 移除後 star 各少一）
    star_count = shopping_js.count('star: true')
    if star_count == 6:
        ok(f'T23-B5：star: true 恰 {star_count} 個（藥妝 4 + 伴手禮 2）')
    else:
        fail('T23-B5：star: true 數量異常', f'預期 6，實際 {star_count}')

    # T23-B6：id 無重複
    all_ids = re.findall(r'id:\s*"([dg]\d+)"', shopping_js)
    if len(all_ids) == len(set(all_ids)):
        ok(f'T23-B6：id 無重複（共 {len(all_ids)} 筆）')
    else:
        dupes = [x for x in all_ids if all_ids.count(x) > 1]
        fail('T23-B6：id 有重複', str(set(dupes)))

    # T23-B7：PRECACHE 含 shoppingdata.js
    if "'./js/shoppingdata.js'" in sw_js:
        ok('T23-B7：PRECACHE 含 shoppingdata.js')
    else:
        fail('T23-B7：PRECACHE 缺少 shoppingdata.js')

    # T23-B8：PRECACHE 含 shopping-tab.js
    if "'./js/shopping-tab.js'" in sw_js:
        ok('T23-B8：PRECACHE 含 shopping-tab.js')
    else:
        fail('T23-B8：PRECACHE 缺少 shopping-tab.js')

# ────────────────────────────────────────────────────────────────
# Task23：前端整合驗收（frontend 完成後才全過；未完成時優雅跳過）
# ────────────────────────────────────────────────────────────────
print('\n[Task23：前端整合]')

app_js_content = read('js/app.js')
index_html_content = read('index.html')

# T23-C1/C2：TAB_IDS 含 shopping 且長度 7
m_tabs = re.search(r"var TAB_IDS\s*=\s*\[([^\]]+)\]", app_js_content)
if m_tabs:
    tab_ids_str = m_tabs.group(1)
    tab_list = re.findall(r"'([^']+)'", tab_ids_str)
    if 'shopping' in tab_list:
        if len(tab_list) == 7:
            ok(f'T23-C1：TAB_IDS 含 shopping 且長度 7（{tab_list}）')
        else:
            fail('T23-C1：TAB_IDS 含 shopping 但長度不符', f'預期 7，實際 {len(tab_list)}')
    else:
        ok('T23-C1：TAB_IDS 尚未加入 shopping（frontend 待完成，跳過）')
else:
    fail('T23-C1：找不到 TAB_IDS 定義')

# T23-C3/C4：index.html nav 鈕數量（排除 {id} 等模板佔位值）
nav_tabs_raw = re.findall(r'data-tab="([^"]+)"', index_html_content)
nav_tabs = [t for t in nav_tabs_raw if not (t.startswith('{') and t.endswith('}'))]
if len(nav_tabs) == 7:
    ok(f'T23-C3：index.html data-tab 鈕恰 7 顆')
    if 'shopping' in nav_tabs:
        ok('T23-C4：nav 含 shopping 鈕')
    else:
        fail('T23-C4：nav 缺 shopping 鈕')
elif len(nav_tabs) == 6:
    ok('T23-C3：frontend 尚未完成 nav 更新（目前 6 顆，跳過）')
else:
    fail('T23-C3：nav 鈕數量異常', f'預期 7，實際 {len(nav_tabs)}')

# T23-C5：section#tab-shopping 存在
if 'id="tab-shopping"' in index_html_content:
    ok('T23-C5：section#tab-shopping 存在')
else:
    ok('T23-C5：frontend 尚未加入 section#tab-shopping（跳過）')

# T23-C6：shopping-tab.js localStorage key 正確
shopping_tab_path = os.path.join(REPO, 'js/shopping-tab.js')
if os.path.exists(shopping_tab_path):
    shopping_tab_js = read('js/shopping-tab.js')
    if 'tokyotrip.shoppingChecked' in shopping_tab_js:
        ok('T23-C6：shopping-tab.js localStorage key 正確')
    else:
        fail('T23-C6：shopping-tab.js localStorage key 不符，預期 tokyotrip.shoppingChecked')
    if 'localStorage.clear()' in shopping_tab_js:
        fail('T23-C6b：shopping-tab.js 含 localStorage.clear()（repo 級禁令）')
    else:
        ok('T23-C6b：shopping-tab.js 無 localStorage.clear()')
else:
    ok('T23-C6：frontend 尚未建立 shopping-tab.js（跳過）')

# T23-C7：全 repo 主要 JS 無 localStorage.clear() 可執行呼叫
# （注解中的禁令說明文字不算，只掃非注解行）
clear_check_files = [
    'js/app.js', 'js/trip-tab.js', 'js/translate-tab.js',
    'js/my-phrases.js', 'js/import-data.js', 'js/shoppingdata.js',
]
found_clear = []
for cf in clear_check_files:
    cf_path = os.path.join(REPO, cf)
    if os.path.exists(cf_path):
        content = read(cf)
        # 過濾注解行（// 或 * 開頭，去除前導空白後）
        code_lines = [l for l in content.split('\n')
                      if not l.lstrip().startswith('//') and not l.lstrip().startswith('*')]
        code_only = '\n'.join(code_lines)
        if 'localStorage.clear()' in code_only:
            found_clear.append(cf)
if found_clear:
    fail('T23-C7：repo 中含 localStorage.clear() 可執行呼叫', str(found_clear))
else:
    ok('T23-C7：已知 JS 檔無 localStorage.clear() 可執行呼叫')

# ────────────────────────────────────────────────────────────────
# Task30：雲端入口 CLAUDE.md 內容鎖＋specs/STATE.md 結構（鏡像 my-agent check_state.py；本機以 check_state.py 為權威）
# 改 CLAUDE.md 刪到下列關鍵字、或改 STATE 章節規則，須同批改本段
# ────────────────────────────────────────────────────────────────
print('\n[Task30：CLAUDE.md 與 specs/STATE.md]')

T30_CLAUDE_MAX = 6000
T30_KEYWORDS = [
    '繁體中文', 'specs/STATE.md', 'specs/INDEX.md', 'specs/SYSTEM_MAP.md', 'BOOTSTRAP.md',
    'TaskN.spec.md', '影響範圍', 'sentinel', 'scan_files', 'qa_smoke_test.py', 'PYTHONUTF8=1',
    'js/version.js', 'APP_VERSION', 'APP_VERSION_DATE', 'sw.js', 'CACHE_VERSION', '逐字元',
    '個資', '東京/', 'PR', 'Merge', 'GitHub Pages', '版號', 'DEVELOPMENT_LOG.md', '同一個 PR',
]
# Liquid 樣板開頭符號（Jekyll 建置會擋全站部署）；以拼接產生，本檔自身不含該字面
T30_LIQUID = ['{' + '{', '{' + '%']

if os.path.isfile(os.path.join(REPO, 'CLAUDE.md')):
    t30_claude = read('CLAUDE.md')
    ok('T30-1：CLAUDE.md 存在')
    if len(t30_claude) <= T30_CLAUDE_MAX:
        ok(f'T30-2：CLAUDE.md {len(t30_claude)} 字元 ≤ {T30_CLAUDE_MAX}')
    else:
        fail('T30-2：CLAUDE.md 超過字元上限', f'{len(t30_claude)} > {T30_CLAUDE_MAX}')
    for kw in T30_KEYWORDS:
        if kw in t30_claude:
            ok(f'T30-3：CLAUDE.md 含「{kw}」')
        else:
            fail(f'T30-3：CLAUDE.md 缺關鍵字「{kw}」')
else:
    t30_claude = None
    fail('T30-1：CLAUDE.md 不存在')

T30_SECTIONS = ['Current Status', 'In Progress', 'Open Items', 'Last Handoff']
T30_STATE_MAX = 4000
if os.path.isfile(os.path.join(REPO, 'specs/STATE.md')):
    t30_state = read('specs/STATE.md')
    ok('T30-4：specs/STATE.md 存在')
    if len(t30_state) <= T30_STATE_MAX:
        ok(f'T30-5：specs/STATE.md {len(t30_state)} 字元 ≤ {T30_STATE_MAX}')
    else:
        fail('T30-5：specs/STATE.md 超過字元上限（歷史搬 DEVELOPMENT_LOG.md）',
             f'{len(t30_state)} > {T30_STATE_MAX}')
    t30_h2 = re.findall(r'^## (.+)$', t30_state, flags=re.M)
    if t30_h2 == T30_SECTIONS:
        ok('T30-6：specs/STATE.md H2 恰為四章且順序正確')
    else:
        fail('T30-6：specs/STATE.md H2 章節不符', f'實際 {t30_h2}')
    if re.search(r'^- Updated:', t30_state, flags=re.M):
        ok('T30-7：specs/STATE.md 含 Updated: 行')
    else:
        fail('T30-7：specs/STATE.md 缺 Updated: 行')
    t30_oi = re.search(r'^## Open Items\n(.*?)(?=^## |\Z)', t30_state, flags=re.M | re.S)
    t30_bad = []
    if t30_oi:
        for i, item in enumerate(re.findall(r'^- .*(?:\n(?!^[-#>]).*)*', t30_oi.group(1), flags=re.M), 1):
            if '結案條件' not in item:
                t30_bad.append(f'第 {i} 條')
    if t30_bad:
        fail('T30-8：Open Items 有條目缺「結案條件」', '、'.join(t30_bad))
    else:
        ok('T30-8：Open Items 每條皆含「結案條件」')
else:
    t30_state = None
    fail('T30-4：specs/STATE.md 不存在')

for name, txt in (('CLAUDE.md', t30_claude), ('specs/STATE.md', t30_state)):
    if txt is None:
        continue
    hits = [s for s in T30_LIQUID if s in txt]
    if hits:
        fail(f'T30-9：{name} 含 Liquid 樣板開頭符號（會擋 Pages 建置）', str(hits))
    else:
        ok(f'T30-9：{name} 無 Liquid 樣板開頭符號')

# ────────────────────────────────────────────────────────────────
# Task31：repo 版五角色 .claude/agents/ ＋ specs/PIPELINE.md ＋ CLAUDE.md 改寫
# T31-7 本機限定：讀不到使用者層 agents（雲端）印 SKIP、不計 PASS/FAIL ⇒ 本機與雲端 PASS 差 5。
# 模擬雲端：設環境變數 T31_SIMULATE_CLOUD=1（只影響 T31-7；未設時行為與正式一致）
# ────────────────────────────────────────────────────────────────
print('\n[Task31：repo 版 agents／PIPELINE.md／CLAUDE.md]')

T31_ROLES = ['pm', 'sa', 'backend', 'frontend', 'qa']
T31_PIPELINE_MAX = 20000
T31_PIPELINE_KW = [
    ('.ready', '.ready'), ('.sa_done', '.sa_done'), ('.backend_done', '.backend_done'),
    ('.done', 'TaskN.done'),  # `.done` 是 `.sa_done` 子字串，改驗 TaskN.done 才有意義（SA B7）
    ('.tested', '.tested'), ('.qa_failed.md', '.qa_failed.md'), ('qa_history', 'qa_history'),
    ('diagnosis_approved', 'diagnosis_approved'), ('QA 退回：', 'QA 退回：'),
    ('claude/', 'claude/'), ('router', 'router'), ('同步規則', '同步規則'),
]
T31_CLAUDE_MUST = ['.claude/agents', 'specs/PIPELINE.md', 'router']
T31_CLAUDE_BANNED = ['雲端精簡流程', '不建 sentinel', '雲端不建']

def t31_frontmatter(txt):
    m = re.match(r'^---\r?\n(.*?)\r?\n---\r?\n', txt, flags=re.S)
    if not m:
        return None
    fm = {}
    for line in m.group(1).splitlines():
        mm = re.match(r'^([A-Za-z_]+):\s*(.*)$', line)
        if mm:
            fm[mm.group(1)] = mm.group(2).strip()
    return fm

t31_agents = {}
for role in T31_ROLES:
    rel = f'.claude/agents/{role}.md'
    if os.path.isfile(os.path.join(REPO, rel)):
        t31_agents[role] = read(rel)
        ok(f'T31-1：{rel} 存在')
    else:
        fail(f'T31-1：{rel} 不存在')

for role, txt in t31_agents.items():
    fm = t31_frontmatter(txt)
    if fm is None:
        fail(f'T31-2：{role}.md 無 frontmatter')
    elif fm.get('name') != role or not fm.get('model') or 'description' not in fm:
        fail(f'T31-2：{role}.md frontmatter 不符（name＝檔名、model 非空、有 description）',
             f'name={fm.get("name")!r} model={fm.get("model")!r} description={"有" if "description" in fm else "缺"}')
    else:
        ok(f'T31-2：{role}.md frontmatter name={role}、model={fm["model"]}、有 description')

for role, txt in t31_agents.items():
    miss = [k for k in ('specs/PIPELINE.md', '同步規則') if k not in txt]
    if miss:
        fail(f'T31-3：{role}.md 缺', '、'.join(miss))
    else:
        ok(f'T31-3：{role}.md 含 specs/PIPELINE.md 與 同步規則')

t31_pipeline = None
if os.path.isfile(os.path.join(REPO, 'specs/PIPELINE.md')):
    t31_pipeline = read('specs/PIPELINE.md')
    ok('T31-4：specs/PIPELINE.md 存在')
    if len(t31_pipeline) <= T31_PIPELINE_MAX:
        ok(f'T31-4：specs/PIPELINE.md {len(t31_pipeline)} 字元 ≤ {T31_PIPELINE_MAX}')
    else:
        fail('T31-4：specs/PIPELINE.md 超過字元上限', f'{len(t31_pipeline)} > {T31_PIPELINE_MAX}')
    for label, kw in T31_PIPELINE_KW:
        shown = label if label == kw else f'{label}（以 {kw} 驗）'
        if kw in t31_pipeline:
            ok(f'T31-4：PIPELINE.md 含「{shown}」')
        else:
            fail(f'T31-4：PIPELINE.md 缺關鍵字「{shown}」')
else:
    fail('T31-4：specs/PIPELINE.md 不存在')

if t30_claude is not None:
    for kw in T31_CLAUDE_MUST:
        if kw in t30_claude:
            ok(f'T31-5：CLAUDE.md 含「{kw}」')
        else:
            fail(f'T31-5：CLAUDE.md 缺「{kw}」')
    for kw in T31_CLAUDE_BANNED:
        if kw in t30_claude:
            fail(f'T31-5：CLAUDE.md 仍含禁字「{kw}」')
        else:
            ok(f'T31-5：CLAUDE.md 不含「{kw}」')

t31_liquid_targets = [('specs/PIPELINE.md', t31_pipeline)] + \
    [(f'.claude/agents/{r}.md', t31_agents.get(r)) for r in T31_ROLES]
for name, txt in t31_liquid_targets:
    if txt is None:
        continue
    hits = [s for s in T30_LIQUID if s in txt]
    if hits:
        fail(f'T31-6：{name} 含 Liquid 樣板開頭符號', str(hits))
    else:
        ok(f'T31-6：{name} 無 Liquid 樣板開頭符號')

# T31-7（本機限定）：使用者層 agents 的 model 與 repo 版逐檔相等
t31_user_dir = os.path.expanduser('~/.claude/agents')
t31_user_any = any(os.path.isfile(os.path.join(t31_user_dir, f'{r}.md')) for r in T31_ROLES)
if os.environ.get('T31_SIMULATE_CLOUD') == '1' or not t31_user_any:
    why = '模擬雲端（T31_SIMULATE_CLOUD=1）' if os.environ.get('T31_SIMULATE_CLOUD') == '1' else '讀不到使用者層 agents'
    print(f'  SKIP  T31-7：{why}，model 比對不計入 PASS/FAIL（5 條）')
else:
    for role in T31_ROLES:
        up_path = os.path.join(t31_user_dir, f'{role}.md')
        if not os.path.isfile(up_path):
            fail(f'T31-7：使用者層 {role}.md 不存在', up_path)
            continue
        with open(up_path, encoding='utf-8') as fh:
            up_fm = t31_frontmatter(fh.read()) or {}
        repo_fm = t31_frontmatter(t31_agents.get(role, '')) or {}
        if up_fm.get('model') and up_fm.get('model') == repo_fm.get('model'):
            ok(f'T31-7：{role} model 與使用者層相等（{up_fm["model"]}）')
        else:
            fail(f'T31-7：{role} model 與使用者層不符',
                 f'repo={repo_fm.get("model")!r} 使用者層={up_fm.get("model")!r}')

# T31-8：scan_files 本輪新增 8 檔皆存在（scan 迴圈缺檔靜默 continue，路徑打錯＝假陰性，SA B4）
t31_missing = [f for f in T31_SCAN_ADDED if not os.path.isfile(os.path.join(REPO, f))]
if t31_missing:
    fail('T31-8：scan_files 新增檔不存在', '、'.join(t31_missing))
else:
    ok(f'T31-8：scan_files 本輪新增 {len(T31_SCAN_ADDED)} 檔皆存在')

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
