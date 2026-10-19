# Task27 — 依確認版 Excel v1.1 補齊 App Day 2／Day 3 行程與地圖點

> PM spec v1，2026-10-19。Olina 原話：「上次有更新EXCEL的行程。補一下 APP 的內容。」**急件**：10/22 出發，須於出發前部署上線。

## 功能描述

把 Task25 留下的 Day 2（10/23）、Day 3（10/24）「行程待補」佔位，換成確認版 Excel v1.1 第 1 張表的時間與行程項目，並在地圖分頁補上這兩天的景點。

## 背景與已拍板決策（不重議）

- 已完成：Task25（v25 已上線）把 App 換成 10/22～10/25 上野行程，當時裁定「每日景點這輪不動、之後補」，Day 2／3 各只有一筆 `行程待補`。本 Task 就是那個「之後補」。Task26 把 Excel 回程更新成 MM623，另存為 v1.1。
- 已拍板：
  1. **唯一內容來源**＝`東京\東京4天上野行程表_20261022-1025確認版_v1.1.xlsx` 第 1 張表「東京4天4日上野行程表」。`東京\` 例外授權**只限唯讀這一個檔**；`東京\` 其他檔禁讀禁動；⛔ 不得修改、另存、搬動此 Excel。
  2. **不自己編景點**：Excel 沒寫的不補。第 4 張「7.21 細節」是 7 月舊行程，不取。
  3. 航班權威仍是 Trip.com 確認信（Task25 已落地）；Excel 與 App 航班若有不一致，以 App 現值為準、不動。
  4. Task25 的私密規則延續：舊住宿名稱、個資、訂位代號不得進任何 tracked 檔；`東京/` 已在 .gitignore。

## 涉及範圍

- [x] 後端／核心邏輯（本 repo 角色對應：`js/tripdata.js` 資料、`js/mapdata.js` 手寫地點、冒煙基線、版號）
- [ ] 前端／UI——**不勾**：`trip-tab.js`／`map-tab.js`／`style.css`／`index.html` 零 diff，現有渲染已能處理（`trip-tab.js` L210 `if (item.detail)` 無 detail 時不渲染細節列）。backend 完成後直接建 `Task27.done`。

## Excel 盤點 [實測]

證據：2026-10-19 PM 以 `openpyxl` 唯讀開啟 v1.1（mtime 2026-10-18 08:45、19,691 bytes），第 1 張表 19 列 × 6 欄、無合併儲存格。欄位：A 日期／B 時間／C 行程項目／D 交通方式與搭乘指引／E 出站與步行詳細動線 ＆ 美食指南／F 備註。

| 日 | Excel 列 | B 時間 | C 行程項目 | D／E／F |
|----|---------|--------|-----------|--------|
| 10/22 | 2 | `10:50 → 15:20` | MM626 桃園 T1 → 成田 T1 | 空 |
| 10/22 | 3 | `17:00` | 機場前往 Tabist HOTEL UENO 39 入住 | E＝飯店英文住址＋電話 |
| 10/23 | 4 | `05:30` | 起床 | 空 |
| 10/23 | 5 | `06:30` | 抵原宿站，前往明治神宮 | 空 |
| 10/23 | 6 | `09:00` | 麥當勞早餐後前往東京地下街 | 空 |
| 10/23 | 7 | `中午` | 於東京地下街用餐 | 空 |
| 10/23 | 8 | `14:30` | 離開東京車站前往淺草寺 | 空 |
| 10/23 | 9 | `17:00` | 離開淺草前往晴空塔 | 空 |
| 10/23 | 10 | `晚間` | 於晴空塔用餐 | 空 |
| 10/23 | 11 | `20:00` | 回 Tabist HOTEL UENO 39 | 空 |
| 10/24 | 12 | `上午` | 進上野、阿美橫 | 空 |
| 10/24 | 13 | `中午` | 於上野阿美橫用餐 | 空 |
| 10/24 | 14 | `13:00` | 前往秋葉原 | 空 |
| 10/24 | 15 | `16:00` | 前往澀谷逢街 | 空 |
| 10/24 | 16 | `19:00` | 回 Tabist HOTEL UENO 39 整理行李 | 空 |
| 10/25 | 17 | `早上` | 寄放行李 | 空 |
| 10/25 | 18 | `約 12:00` | 搭乘 Skyliner 前往成田第一航廈 | D＝Skyliner |
| 10/25 | 19 | `16:40 → 20:00` | MM623 成田 T1 → 桃園 T1 | 空 |

結論：
- **Day 1、Day 4**：App 現值（Task25）已涵蓋 Excel 全部內容且更細（時間、航班、Skyliner 指引一致）→ **零 diff**。
- **Day 2、Day 3**：Excel 只有 B（時間）與 C（項目），D／E／F 全空 → 只補時間與項目，不補交通細節（見 Non-scope）。

## §1 `TRIP.itinerary` Day 2／Day 3

`day`／`isoDate` 不變；`theme` 由「行程待補」改為下表（PM 裁定：以 Excel 當天出現的地點依序串接，不增加 Excel 沒有的地點）。佔位那一筆整筆刪除、換成下列 items（順序＝Excel 列序）。

**Day 2（2026-10-23）** theme：`明治神宮・東京車站・淺草寺・晴空塔`

| # | time | title |
|---|------|-------|
| 1 | `05:30` | `起床` |
| 2 | `06:30` | `抵原宿站，前往明治神宮` |
| 3 | `09:00` | `麥當勞早餐後前往東京地下街` |
| 4 | `中午` | `於東京地下街用餐` |
| 5 | `14:30` | `離開東京車站前往淺草寺` |
| 6 | `17:00` | `離開淺草前往晴空塔` |
| 7 | `晚間` | `於晴空塔用餐` |
| 8 | `20:00` | `回 Tabist HOTEL UENO 39` |

**Day 3（2026-10-24）** theme：`上野阿美橫・秋葉原・澀谷`

| # | time | title |
|---|------|-------|
| 1 | `上午` | `進上野、阿美橫` |
| 2 | `中午` | `於上野阿美橫用餐` |
| 3 | `13:00` | `前往秋葉原` |
| 4 | `16:00` | `前往澀谷逛街` |
| 5 | `19:00` | `回 Tabist HOTEL UENO 39 整理行李` |

規則：
1. time／title **逐字照上表**（＝Excel B／C 欄逐字，唯一例外見第 2 點）。非鐘點的 time（`中午`、`晚間`、`上午`）照原字，不得改成鐘點。
2. **錯字更正（PM 裁定）**：Excel C15「前往澀谷逢街」判讀為「逛街」錯字，App 寫 `前往澀谷逛街`。理由：「逢街」無通行語意，同列無其他可能解讀。此更正列入回報供 Olina 知悉，不阻擋。
3. **不帶 detail 欄**（Excel D／E／F 空）：items 物件只有 `time`、`title` 兩鍵，**省略 detail 鍵**，不得寫任何自編說明。（`trip-tab.js` 以 truthy 判斷，省略即不渲染細節列。）
4. Day 1、Day 4、`flights`、`hotels`、`important`、`COUPONS` 全部零 diff。
5. TRIP 段 `行程待補`、`景點與交通之後再補` 字串 grep＝0。

## §2 地圖 `js/mapdata.js`（手寫，延續 Task25；⛔ 不跑 `make_mapdata.py`）

Day 1、Day 4 段零 diff。Day 2、Day 3 段改為下列地點（住處維持第一點，名稱與座標沿用現值逐字）：

**2026-10-23**：
1. `Tabist上野39飯店（住處）`（現值不動）
2. `原宿駅`
3. `明治神宮`
4. `東京駅（東京地下街）`
5. `浅草寺`
6. `東京スカイツリー（晴空塔）`

**2026-10-24**：
1. `Tabist上野39飯店（住處）`（現值不動）
2. `アメ横（上野阿美橫）`
3. `秋葉原駅`
4. `渋谷駅`

規則：
1. 地點只取 Excel 有寫的；**麥當勞**（Excel 未指明哪一家）不建點。
2. 「東京地下街」Excel 未指明哪一條地下街，以**東京駅**座標代表（同日 C8「離開東京車站」佐證在東京站一帶）。
3. 座標由 backend 以 Google 地圖或官方頁面查證，小數 ≥4 位、lat∈[35,36]、lon∈[139,141]；**證據交付比照 Task25**：在 `DEVELOPMENT_LOG.md` 實作條目逐點列「名稱 ← 座標 ← 來源 URL／查詢條件 ← 查證日」。⛔ 不得憑記憶填座標。
4. 檔頭註解第一行改註明「Task25／Task27 手寫」，其餘格式（`{name,lat,lon}`、isoDate 升冪）不變。
5. MAPDATA isoDate 集合仍＝TRIP（4 天），T25-5 須續綠。

## §3 冒煙基線（`qa_smoke_test.py`，backend 維護，additive）

T25 系列全部保留（含 T25-4 禁字，新內容不得觸發）。新增：

- **T27-1** Day 2 items 恰 8 筆、Day 3 items 恰 5 筆，time 序列與 §1 表逐字相同。
- **T27-2** Day 2／Day 3 title 與 §1 表逐字相同；兩天 theme 與 §1 逐字相同。
- **T27-3** TRIP 段 `行程待補`、`之後再補` grep＝0；TRIP 段 `逢街` grep＝0。
- **T27-4** Day 2／Day 3 items 無 `detail` 鍵。
- **T27-5** MAPDATA 2026-10-23 恰 6 點、2026-10-24 恰 4 點，名稱與 §2 逐字相同；全部點 lat∈[35,36]、lon∈[139,141]；Day 1／Day 4 點數維持 3／3。

## §4 版號

兩檔三行 SOP：`js/version.js` APP_VERSION `v25`→`v26`、APP_VERSION_DATE 填實作當日 `MM/DD`；`sw.js` CACHE_VERSION `v26`。PRECACHE 筆數零增減（44）。

## §5 文件

- `specs/SYSTEM_MAP.md` 由 SA／PM 依慣例更新 tripdata.js、mapdata.js 兩列描述（Day 2/3 不再是佔位）。
- `行前檢查清單.md` 零 diff（真機目視歸 Olina 流程外，不另列項）。

## 邊界條件 / 錯誤處理

- 行程頁總覽與單日下鑽：非鐘點 time（`中午`等）與無 detail 的 item 必須正常渲染、不出現 `undefined`／空白細節列（QA 實走確認）。
- 地圖分頁：Day 2／3 chips 日期頭 theme 顯示新值；每點單點開圖、A→B 路線 deep-link 帶 `hl=zh-TW`（既有行為，迴歸即可）。
- 若 backend 實作時發現 Excel 檔內容與本 spec §Excel 盤點不同（Olina 可能在 Excel 開啟中——2026-10-19 13:19 有 `~$` 鎖定檔），**停工回報 PM**，不自行採用新內容。

## 不在本次範圍（Non-scope）

- 不寫 Day 2／Day 3 的交通指引、出站動線、美食推薦、票價（Excel D／E／F 空；路線由地圖分頁 A→B deep-link 處理）。要寫文字交通版另開 Task。
- 不動 Day 1、Day 4、航班、飯店、重要資料、折價券、購物清單、常用句。
- 不改 `trip-tab.js`／`map-tab.js`／`style.css`／`index.html` 等任何渲染邏輯或樣式。
- 不修改、另存、搬動 Excel；不讀 `東京\` 其他任何檔；不取第 4 張「7.21 細節」。
- 不跑 `make_mapdata.py`、不建 10 月版 KML。
- 不新增 localStorage key、不動本機層 `App.privateData`／匯入碼。
- 不做 git push（push 由 Olina 指示；本 Task 閉環後依慣例 commit）。

## 驗收（QA）

1. `python qa_smoke_test.py` 全綠（含 T25 全系列＋T27-1～5）。
2. `git diff` 範圍只含：`js/tripdata.js`（僅 Day 2／Day 3 兩個 itinerary 物件）、`js/mapdata.js`（檔頭註解＋2026-10-23／10-24 兩段）、`qa_smoke_test.py`、`js/version.js`、`sw.js`、`specs/`、`DEVELOPMENT_LOG.md`。其他檔零 diff。
3. Playwright headless（390px viewport）實走：行程分頁 Day 2／Day 3 總覽與單日下鑽顯示 §1 全部項目；地圖分頁 10/23、10/24 chips 顯示 §2 點位與新 theme；console 無錯誤。
4. 隱私：P-OLD 全 repo 命中＝0（T25-7）、`git ls-files` 無 `東京/`（T25-8）。
5. 座標證據：`DEVELOPMENT_LOG.md` 有 §2 第 3 點要求的逐點來源；QA 抽 2 點以 Google 地圖查證座標落在該地點 300m 內。
6. 真機顯示由 Olina 部署後流程外確認。

## 影響範圍分析（SA，v1 2026-10-19）

> 完整紀錄：`specs/Task27.impact.md`。涉及範圍：純後端 → backend 完成後直接建 `Task27.done`。

### 受影響的既有功能
| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 行程總覽／單日下鑽 | `trip-tab.js`（theme、items 純 textContent，無時間解析） | Day2/3 theme 與 items 換新；無 detail、非鐘點 time 可承接 | ✅ |
| 行程 Day1/4、航班、飯店、重要資料 | `tripdata.js` 其他段 | 零 diff | ✅ |
| 折價券 | `tripdata.js` COUPONS（單檔雙契約） | 零 diff；bump 後券圖重快取 | ✅ |
| 地圖 chips／點位／deep-link | `map-tab.js`（URL 只用 lat,lon） | 10/23 1→6 點、10/24 1→4 點；名稱只顯示 | ✅ |
| 版號／更新 toast | `version.js`＋`sw.js` | v25→v26，PRECACHE 44 不變 | ✅ |

### Backend 注意事項
- Excel v1.1 鎖檔仍在（Olina 開著）：比對 mtime 2026-10-18 08:45／19,691 bytes，不符才重讀比對、不同即停工；不刪鎖檔、不讀 `東京\` 其他檔（含其中的地圖網頁存檔）。
- items 只寫 `time`、`title`，**省略 detail 鍵**（不寫空字串）；`逛街` 非 `逢街`。只 Edit Day2/3 兩物件，勿整檔重寫碰 COUPONS。
- mapdata 手寫、不跑 `make_mapdata.py`；座標逐點附來源於 DEVELOPMENT_LOG，LOG 內勿提舊住宿名稱（T25-7 全 repo 掃描）。
- 冒煙：T27-1～5 additive，並把 `specs/Task27.spec.md`、`specs/Task27.impact.md` 加入 `scan_files`；PRECACHE `== 44` 不改；time 比對逐字、勿用 HH:MM regex。

### Frontend 注意事項
- 不涉及。

### QA 迴歸測試清單
- [ ] 冒煙全綠（T25 全系列＋T27-1～5）
- [ ] git diff 範圍白名單；tripdata.js diff 只落 Day2/3 兩物件
- [ ] 行程 Day1～4 總覽 theme（Day2/3 長字串 390px 不溢出）；Day1/4 下鑽與 v25 相同
- [ ] 地圖 10/22、10/25 各 3 點不變；新點 deep-link 帶 `hl=zh-TW`
- [ ] 折價券開 1 張圖可載；版號徽章 v26；console 無錯誤
- 新功能由 QA 依 spec 驗收
