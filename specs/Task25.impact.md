# Task25 影響分析（SA）— 新行程覆蓋（10/22～10/25 單人）

> SA，2026-10-18。依據：`Task25.spec.md` v2、`specs/SYSTEM_MAP.md`（本 repo 無生成腳本、無查詢介面，整讀＋程式碼掃描補證）。
> 本檔會隨 Task25 commit，故**不寫舊住宿名稱、舊地址番地、舊電話**；舊住宿偵測一律用 spec 的 P-OLD regex `[Mm][Aa][Pp][Ll][Ee] ?[Hh][Oo][Uu][Ss][Ee]`。

## 涉及範圍標記

- **純後端（本 repo 角色＝資料檔／冒煙基線／版號／.gitignore／README／manifest／文件清除）**；frontend 不參與。
- pipeline 走向：SA → backend → backend 直接建 `Task25.done` → QA（不經 `.backend_done`／frontend）。
- 程式邏輯檔零 diff：`trip-tab.js`、`map-tab.js`、`style.css`、`index.html`、`import-data.js`、`app.js`、`sw.js`（版號行除外）。

## 基線實測（2026-10-18）

| 項目 | 實測值 |
|------|--------|
| 版號 | `version.js` `'v24'`／`'07/21'`，`sw.js` `CACHE_VERSION='v24'`（commit 8c9d59a，購物清單移除兩品項時 bump；SYSTEM_MAP 原記 v23 已校正） |
| 冒煙基線 | `python qa_smoke_test.py` → PASS 51／FAIL 0（cp950 主控台輸出中文亂碼，QA 請設 `PYTHONIOENCODING=utf-8`） |
| PRECACHE | 44 筆，本輪零增減 |
| P-OLD 命中（tracked） | `DEVELOPMENT_LOG.md`×5、`js/mapdata.js`×1、`js/tripdata.js`×4、`specs/INDEX.md`×4、`specs/SYSTEM_MAP.md`×1、`specs/Task20.impact.md`×2、`Task20.spec.md`×3、`Task21.impact.md`×3、`Task21.spec.md`×7、`Task22.impact.md`×1、`Task22.spec.md`×2、`Task3.spec.md`×5、`行前檢查清單.md`×2 |
| P-OLD 命中（untracked，將隨批 commit） | `specs/Task24.spec.md`×2、`Task24.impact.md`×2、**`Task24.tested`×1（spec §9 漏列）** |
| 「駒形」命中 | `tripdata.js`×3（地址 2＋餐廳 1）、`mapdata.js`×1（餐廳）、`Task3.spec.md`×3、`Task3.impact.md`×1（地址）、`Task17.spec.md`×1（**餐廳名，非住宿**） |
| 工作樹既有未提交變更 | `DEVELOPMENT_LOG.md`（+2 行）、`specs/INDEX.md`（Task25 列）＝PM 本輪寫入；`東京/` 未追蹤 |

## 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 行程總覽⇄單日下鑽（Task10） | `trip-tab.js` 總覽卡＋單日層、`getTodayIsoDate` | itinerary 5→4 天。渲染全依陣列長度（無寫死 5），首末日 disabled 自動對到 Day1／Day4。今日直進單日層改由 10/22～25 觸發 | ✅ |
| 單日時間軸 | `trip-tab.js` items 渲染（L189 `items.length===0` →「本日無排定行程」） | Day2/3 用 1 筆佔位（spec 已避開空陣列語意）。時間欄是 `grid-template-columns: 54px 1fr`、15px 粗體：`約 12:00` 估約 60px，會在空白處折成兩行（不重疊、不溢出）；`早上`／`—` 正常 | ✅（目視觀察項，非阻斷） |
| 航班卡 | `buildFlightsSection` | 只改欄位值，結構不變；note 為純文字 | ✅ |
| 飯店卡 | `buildHotelSection` | 讀 name／checkin／checkout／address_ja／address_zh／tel／note；**tel 省略時整列不渲染（L406 有守門）**；地圖鈕用 `address_ja`（含日文飯店名可直接查）；大字鈕顯示 `address_ja` | ✅ |
| 民宿入住資訊區（Task21） | `_renderLodgingBlock` | 程式零改。**Olina 手機本機層若仍是 7 月資料，更新後仍顯示舊住宿門鎖／WiFi**（spec §6 已列流程外）；`addressZh` 去重比對的是新 `TRIP.hotels[0].address_zh`，舊地址必不相等 → 照常顯示。標題「民宿入住資訊」維持（Non-scope） | ✅ |
| 重要資料公開列表 | `buildImportantPublicList` | 只改「樂桃報到提醒」value 一列 | ✅ |
| 地圖分頁（Task17） | `map-tab.js` chips／日期頭／A→B | MAPDATA 4 天、isoDate 必與 TRIP 一一對齊（chip 標籤 `Day1 10/22` 由 `itinDay.day` 去空白而來，`day` 欄須維持 `Day N` 格式）。Day2/3 只有 1 點：A⇄B 互換依既有規則 disabled、可選「目前位置→住處」 | ✅ |
| 地圖地點資料 | `js/mapdata.js` 檔頭註解 | 檔頭寫「由 make_mapdata.py 生成，手改會被覆蓋」——本輪改手寫後此句失真，須改寫（見 Backend 注意 B5） | ✅ |
| 版號徽章＋SW 更新（Task14） | `version.js`／`sw.js` | v24→v25 兩檔三行；不 bump 則 cache-first 吃住舊行程（tripdata 單檔雙契約：COUPONS 一起重抓） | ✅ |
| 折價券（Task4） | `COUPONS`（同住 tripdata.js） | 零 diff；但與 TRIP 同檔，backend 改 TRIP 段時不得誤動 COUPONS | ✅ |
| 購物（Task23） | `shoppingdata.js`／`shopping-tab.js` | 零 diff；冒煙 T23-B/C 保留 | ✅ |
| 冒煙基線 | `qa_smoke_test.py` | Day2 區塊整段退場＋T25 判準＋scan_files 擴充（見 B1～B3） | ✅ |
| 常用句／翻譯／拍照 | — | 無交集 | ✅（只跑冒煙＋分頁切換） |

## Backend 注意事項

- **B1 冒煙 Day2 區塊要整段退場，不只 spec 列的五條**：`qa_smoke_test.py` L261–317 是以 `isoDate "2026-07-22"` 切段的單一 `if/else`，內含 T22-1、T22-2、T23-A1、T22-4、**T23-A2**，以及切段失敗時的 `fail('Task22：找不到 Day 2…')`。spec §4 只列 T22-1～4＋T23-A1，若照字面保留 T23-A2，覆蓋後切段失敗直接紅燈。SA 裁定：L261–317 整段刪除（T23-A2 綁的是 7/22 警語殘影，內容隨覆蓋消失，判準已無對象；屬機械連動，非業務規則變更）。
- **B2 T25-7 掃描範圍要含「將一併 commit 的未追蹤檔」，且必須硬排除 `東京/`**：`git ls-files` 抓不到 `specs/Task24.*`、`Task25.*`（QA 跑時都還未追蹤）。建議 T25-7 掃 `git ls-files` ∪ `git ls-files --others --exclude-standard`，**並在程式內再顯式濾掉 `東京/` 開頭路徑**——不可只靠 .gitignore 生效（順序一錯就等於讀了 `東京\` 內檔案，違反禁讀）。冒煙因此引入 `git` 子行程依賴：git 不可用時 fail loud，不得靜默略過。
- **B3 scan_files 白名單 additive 加 `specs/Task25.spec.md`、`specs/Task25.impact.md`**（SYSTEM_MAP 冒煙紀律：白名單寫死，新 spec 不加＝假陰性）。PRECACHE `== 44` 斷言不動。
- **B4 T25-4 切 TRIP 段的邊界**：TRIP 段＝`window.TRIP = {` 到 `window.COUPONS` 之前（tripdata.js L9–319）。實測 COUPONS 段目前不含 `2026-07-`／`2026/07/`，但判準仍須只切 TRIP 段，避免日後券資料誤觸。
- **B5 mapdata.js 檔頭註解改寫**：改為「Task25 手寫（10/22～25，4 天）；KML 仍為 7 月舊資料，⛔ 勿跑 make_mapdata.py 重生成」。`make_mapdata.py` 本體零 diff（其 KML 路徑與 49 點自檢值皆屬 7 月舊資料，Non-scope）。
- **B6 §9 命中清單校正**（spec §9 與實測差異）：
  - **加列 `specs/Task24.tested`**（P-OLD×1）。注意它是 sentinel：Task24 尚未 PM 閉環（`.tested` 仍在）；不論 PM 閉環時刪檔或留檔，都要先清。
  - **`specs/Task17.spec.md` 不動**：其「駒形」是餐廳名（駒形泥鰍鍋），無 P-OLD 命中、非住宿地址；改它會違反「每檔 diff 只能是 §9 替換」。
  - `specs/Task3.impact.md` 無 P-OLD 命中，只有舊地址一處 → 只套「地址→（已移除）」規則。
  - **spec §9 自身命中已由 SA 修記法**：原 L168／L171 以字面寫出舊地址番地，會讓「舊地址 grep＝0」被 spec 自己打破；已改為 regex `駒形 ?1-2-1[0]`（判準不變）。backend 與 QA 一律用此 regex。
  - `specs/SYSTEM_MAP.md` 的 P-OLD 1 處已由 SA 更新地圖時依 §9 規則替換為「7 月舊住宿」，backend 免再處理（仍須 grep 確認＝0）。
  - 地址判準另含郵遞區號（舊住宿郵遞區號目前只在 tripdata.js，隨覆蓋消失）。
- **B7 舊住宿電話是日本手機格式（+81-90）且自 Task3 起已 push**：tripdata.js 隨覆蓋移除；git 歷史仍可查得 → 依 §10.5 列 `[待 Olina]`。是否屬「商家代表號」（§10.2 不算個資）由 backend 判定並在回報說明理由。
- **B8 DEVELOPMENT_LOG.md 與 INDEX.md 有 PM 未提交的本輪寫入**：§9 替換只能在工作樹就地改字，⛔ 禁 `git checkout`／`git restore`／整檔重寫；LOG 124KB，建議用逐行替換工具＋替換後 `git diff` 檢查每個 hunk 只含替換。
- **B9 執行順序**：先改 `.gitignore` 加 `東京/`，之後才做任何 `git status`／`git ls-files --others`；全程 ⛔ `git add`（spec 已定不 commit）。
- **B10 §2.4 停工條件**：反推出的「最晚離開住處」若早於 12:00（即計畫的「約 12:00」已晚於最晚線），停工回報 PM，不自行改 time。
- **B11 TRIP.flights 欄位**：只改 spec A1／A2 欄位；`label`、`airline`、兩端 `airport`／`terminal` 逐字不動（T25-2 會比對）。Day 1 前三筆（06:10／07:50／10:50）逐字保留，含 detail。
- **B12 `行前檢查清單.md` L3 檔頭**（spec §5 未列）：現為「2026-07-21～07-25 東京＋橫濱，4 人（2 大 2 小）」，同時違反 §8 單人化與日期覆蓋意圖，且含同行者組成。SA 判定屬 §8「多人內容依單人重裁」的直接適用範圍，backend 一併改為 10/22～10/25 單人語意；另 L14（v20）、L78（v23）版號行屬歷次驗收紀錄，本輪不動，回報時提一句即可。

## Frontend 注意事項

- 本輪無 frontend 階段。`trip-tab.js`／`map-tab.js`／`style.css`／`index.html` 零 diff。
- 已知觀察項（不阻斷、不在本輪修）：Day4 `約 12:00` 時間欄兩行折行。

## QA 迴歸測試清單

- [ ] `PYTHONIOENCODING=utf-8 python qa_smoke_test.py` 全綠；確認 Day2 區塊（含 T23-A2）已整段移除、T25-1～9 存在
- [ ] 版號閘：`APP_VERSION === CACHE_VERSION === 'v25'`；PRECACHE 仍 44
- [ ] diff 白名單：程式邏輯檔零 diff（`git diff --stat` 比對 spec 驗收 3）；COUPONS 段零 diff；`Task17.spec.md` 零 diff
- [ ] 行程分頁（Playwright 假日期 2026-10-22／10-25／10-18）：總覽 4 張卡、首末日導覽 disabled、Day2/3 顯示「行程待補」（非「本日無排定行程」）
- [ ] 飯店卡：新住處渲染、地圖鈕 URL 用新 address_ja、大字鈕正常、tel 省略時無空列
- [ ] 民宿入住資訊區：未匯入時顯示空狀態文案；以 TEST 假匯入碼（含 lodging）注入仍正常渲染（Task21 迴歸），測畢清除
- [ ] 地圖分頁：chips 4 顆、標籤 `Day1 10/22` 格式、Day1 3 點、Day2/3 1 點且 A⇄B 互換 disabled、deep-link 仍帶 `hl=zh-TW`
- [ ] 七分頁逐一點擊切換（computed display 斷言）——本輪不動導覽，但 tripdata.js 大改，防語法錯誤致全頁失效
- [ ] 折價券 16 張、購物清單 20 筆（g07/g10 已移除）正常
- [ ] P-OLD：tracked ∪ 將 commit 的未追蹤檔（排除 `東京/`）＝0；舊地址 regex `駒形 ?1-2-1[0]`＝0（spec §9 已改此記法，避免 spec 自身命中）
- [ ] 個資三段式（工作樹 grep＋`TT1.` base64 解碼＋`git log -p`）；`git log -p` 既有命中只核對已列 `[待 Olina]`，不算本輪 FAIL
- [ ] `git check-ignore 東京/護照.pdf` 命中；`git ls-files | grep "^東京/"`＝0；QA 自身不得讀 `東京\` 內容
- 新功能（新行程內容、交通查證來源抽查 ≥3 項、§2.4 反推）由 QA 依 spec 驗收

## 業務層級依賴

- `js/mapdata.js` ↔ `js/tripdata.js`：isoDate 對齊契約延續；本輪起 mapdata.js 為**手寫**，`make_mapdata.py` 重生成會蓋回 7 月舊點（含舊住宿點）——須先有 10 月版 KML。
- `qa_smoke_test.py` ↔ `js/tripdata.js`：行程判準綁具體 isoDate／內容，每次覆蓋行程都要整段替換對應判準（Task22→Task25 已是第二次）；後續行程判準建議綁「結構」（天數、isoDate 連續、對齊 MAPDATA）而非單日內容。
- `qa_smoke_test.py` ↔ `.gitignore`／`東京/`：T25-7／T25-8 透過 git 子行程掃描，必須顯式排除 `東京/`，不得只依賴 ignore 規則。
- `js/trip-tab.js` `_renderLodgingBlock` ↔ 本機層 `tokyotrip.privateData`：App 更新不會清本機層，舊住宿資料要靠 Olina 重匯或清除（流程外）。
- `行前檢查清單.md` ↔ `js/tripdata.js`：清單檔頭日期／人數與行程同源，行程覆蓋時要一起改（本輪 B12）。
