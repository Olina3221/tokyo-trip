# Task27 影響分析（SA v1，2026-10-19）

> spec：`specs/Task27.spec.md`。涉及範圍：**純後端（資料檔＋冒煙基線＋版號）**，無 UI → backend 完成後直接建 `Task27.done`（不經 frontend）。

## 結論

- 波及面＝**行程分頁 Day 2／3 顯示**與**地圖分頁 10/23、10/24 點位清單**兩處，皆為資料替換；渲染程式零 diff 可承接（[實測] 見下）。
- 主要風險不在程式，而在 (1) Excel 正被 Olina 開著、(2) 座標查證品質、(3) 冒煙基線寫死值與隱私掃描清單的連動。
- `tripdata.js` 是單檔雙契約（TRIP＋COUPONS），本輪只動 TRIP Day2/3，但仍必 bump 版號才會生效（cache-first）；bump 會重下 16 張券圖（既知成本，出發前家用 wifi 可接受）。

## 開工前置實測（SA，2026-10-19，唯讀）

| 項目 | 結果 |
|------|------|
| `js/version.js`／`sw.js` | 現為 `v25`／`10/18`／`CACHE_VERSION='v25'`，與 spec §4 起點一致 |
| `js/tripdata.js` Day2/3 | L85–96：`theme: "行程待補"`＋1 筆 `{time:"—", title:"行程待補", detail:"景點與交通之後再補"}`，與 spec 描述一致 |
| `js/mapdata.js` | Day1 3 點／Day2 1 點／Day3 1 點／Day4 3 點；住處點 `Tabist上野39飯店（住處）` 35.7100870,139.7755580 |
| `trip-tab.js` 消費方式 | L202 `item.time \|\| ''`、L207 `item.title \|\| ''` 純 textContent；L210 `if (item.detail)` 省略即不渲染；**全檔無時間字串解析**（grep `getHours`/`split(':')` 無命中於 items 路徑）→ `中午`／`晚間`／`上午` 安全 |
| `map-tab.js` 消費方式 | L87–104 deep-link 一律用 `lat,lon`，`place.name` 只做 textContent 顯示 → 名稱含全形括號（`東京駅（東京地下街）`）不影響 URL |
| 冒煙基線 | 583 行；T25-1～9 無任何斷言綁 Day2/3 佔位字串或點數（可安全被新內容取代）；PRECACHE 寫死 `== 44`（本輪不變）；`scan_files` 寫死白名單，最後一筆為 Task25 |
| T25-4 禁字 | `駒形／民宿／橫濱／横浜／2026-07-／2026/07/`——spec §1／§2 新內容逐字比對皆不觸發 |
| Excel v1.1 磁碟狀態 | mtime 2026-10-18 08:45、19,691 bytes，與 spec 盤點證據一致；**但 `~$…確認版_v1.1.xlsx` 鎖檔仍在（2026-10-19 13:19）＝Olina 仍開著** |

## 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 行程總覽日卡 | `trip-tab.js` 總覽（L251–270，theme） | Day2/3 theme 由「行程待補」改為新字串，較長（`明治神宮・東京車站・淺草寺・晴空塔`），390px 換行觀感需看 | ✅ |
| 行程單日下鑽 | `trip-tab.js` L129–215（day-nav theme＋items） | 新 items 無 detail、time 含非鐘點字；預期無空白細節列、無 `undefined` | ✅ |
| 行程 Day1／Day4、航班、飯店、重要資料 | `tripdata.js` 其他段 | 零 diff，靠 T25-2/3/6 與 git diff 範圍守 | ✅ |
| 折價券 | `tripdata.js` COUPONS＋`coupon-viewer.js` | 同檔不同段，零 diff；bump 後券圖重快取 | ✅（開 1 張券確認圖可載） |
| 地圖 chips／日期頭 | `map-tab.js` L214–218（TRIP isoDate 唯讀 lookup） | 10/23、10/24 日期頭 theme 顯示新值；isoDate 集合不變（T25-5） | ✅ |
| 地圖點位清單＋deep-link | `map-tab.js` L83–104、L248 | 10/23 1→6 點、10/24 1→4 點；單點／A→B URL 帶 `hl=zh-TW` 為既有行為 | ✅ |
| 版號徽章／更新 toast | `version.js`＋`sw.js`＋`app.js` | v25→v26 兩檔三行；PRECACHE 44 不變 | ✅ |
| 購物、常用句、翻譯、拍照 | 各 tab | 不碰 | ❌ |

## Backend 注意事項

1. **Excel 開檔中**：鎖檔存在本身不是停工條件（磁碟內容仍為 08:45 版）。開工先比對 v1.1 mtime＝`2026-10-18 08:45`、size＝`19,691`；任一不符 → 以 openpyxl 唯讀重讀第 1 張表與 spec 盤點表逐格比對，不同即停工回報 PM。⛔ 不得刪鎖檔、不得 save。`東京\` 內另有一份 Google 地圖網頁存檔與其他檔，**一律不讀**（含不得拿來當座標來源）。
2. **tripdata.js 編輯範圍**：只替換 Day2/3 兩個 itinerary 物件的 `theme` 與 `items`（`day`／`isoDate` 不動）；items 物件只寫 `time`、`title` 兩鍵，**省略 detail 鍵**（不要寫 `detail: ""`——T27-4 驗鍵不存在）。字串照 spec §1 表逐字，`逛街` 非 `逢街`。建議用 Edit 精準替換，避免整檔重寫碰到 COUPONS。
3. **mapdata.js**：手寫；⛔ 不跑 `make_mapdata.py`（會蓋回 7 月點）。住處點那一行逐字複製現值。座標 ≥4 位小數、不得憑記憶；`DEVELOPMENT_LOG.md` 逐點列「名稱 ← 座標 ← 來源 URL／查詢條件 ← 查證日」。`東京駅（東京地下街）` 用東京站本體座標（spec §2 規則 2）。`アメ横` 取商店街中段代表點即可（QA 驗 300m 內）。
4. **冒煙基線**（additive）：新增 T27-1～5，並把 `specs/Task27.spec.md`、`specs/Task27.impact.md` additive 加入 `scan_files`（SYSTEM_MAP 人工補充區「scan_files 是寫死白名單」紀律）。不改 PRECACHE `== 44`。T27-1 time 比對要包含非鐘點字逐字，勿用 `HH:MM` regex 篩。
5. **T25-7 P-OLD 全 repo 掃描**會掃到新 spec／impact／DEVELOPMENT_LOG 條目——寫 LOG 時不要提舊住宿名稱。
6. **版號**：`APP_VERSION='v26'`、`APP_VERSION_DATE` 填實作當日（例 `10/19`）、`CACHE_VERSION='v26'`；三處逐字元。
7. 不需 `Task27.api.md`（無介面變更）。完成後建 `Task27.done`。

## Frontend 注意事項

- 不涉及（`trip-tab.js`／`map-tab.js`／`style.css`／`index.html` 零 diff）。

## QA 迴歸測試清單

- [ ] `python qa_smoke_test.py` 全綠（T25 全系列＋T27-1～5、版號一致、PRECACHE 44、隱私掃描含 Task27 兩檔）
- [ ] `git diff --stat` 只含 spec 驗收第 2 條白名單檔；`tripdata.js` diff 只落在 Day2/3 兩物件（COUPONS 段零 diff）
- [ ] 行程分頁：總覽 Day1～4 日卡 theme 正常（Day2/3 新字串 390px 換行不溢出）；Day1／Day4 單日下鑽與 v25 相同
- [ ] 行程分頁：Day2／Day3 單日下鑽，非鐘點 time 顯示原字、無空白細節列、無 `undefined`
- [ ] 地圖分頁：10/22、10/25 仍各 3 點；10/23 6 點、10/24 4 點；新點單點開圖與 A→B URL 帶 `hl=zh-TW`、座標參數為 lat,lon
- [ ] 折價券分頁開 1 張券圖可載（tripdata.js 雙契約迴歸）
- [ ] 版號徽章 `v26 · MM/DD`；console 無錯誤
- 新功能由 QA 依 spec 驗收 1～6 條

## 業務層級依賴

- `js/tripdata.js` Day2/3 與 `東京\東京4天上野行程表_20261022-1025確認版_v1.1.xlsx` 第 1 張表是**手動同步的兩份行程副本**（Task26 已有同型航班副本）；Excel 若再改，App 不會自動跟上，需另開 Task。本輪 App 端唯一刻意偏離＝`逛街`（Excel C15 `逢街`）。
- `js/mapdata.js` 10/23、10/24 點位與 `js/tripdata.js` Day2/3 項目為**人工對應**（地點名非逐字相同，例：明治神宮 ↔ `抵原宿站，前往明治神宮`），無程式連動；日後改 Day2/3 行程必須同步檢查 mapdata 兩段。`make_mapdata.py` 重生成風險不變（KML 仍為 7 月版）。
- `qa_smoke_test.py` T27-1/2/5 把本輪內容寫死成斷言——日後任何調整 Day2/3 或 10/23、10/24 地點的 Task，必須同批改寫這些斷言（比照 Task23 起「基線寫死值連動」紀律）。
