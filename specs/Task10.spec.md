# Task10.spec — 行程頁字級統一 + 單日細節下鑽

> **依賴閘（硬性）：本任務必須等 Task8（淺色主題）完全閉環後才可進 SA / 開工。**
> 理由：本任務改 `css/style.css` 與 `js/trip-tab.js`，Task8 正在大改 style.css（主題翻轉）——同檔並行必衝突。
> 本 spec 所有樣式工作**以 Task8 完成後的 style.css 為基礎**（淺色主題、:root 變數翻轉後的狀態），字級與版面不得與 Task8 剛定案的淺色配色打架。
> Task8 完成後 `CACHE_VERSION` 預期為 `v6`；本任務 bump 為**開工時實際值 +1**（預期 v6 → v7）。
> **依賴閘更新（2026-07-11，PM）：Task11（導覽列淺色化＋chips 裁切修復）插隊本任務之前，同樣改 `css/style.css`——本任務必須等 Task11 閉環後才可進 SA**（`Task10.ready` 已收回，Task11 閉環後 PM 重建）。CACHE_VERSION 順延為 Task11 後的實際值 +1（預期 v7→v8）。
> **依賴閘解除（2026-07-11，PM）：Task8 與 Task11 皆已正式閉環，本任務所有依賴閘解除，`Task10.ready` 已重建，SA 可開工。** 開工基礎 = Task11 閉環後的 style.css（導覽列/航班/飯店卡已淺色化、A9 深底 override 已刪、`--nav-h` 現為 60px、`.phrases-chips-bar` 已有 flex-shrink:0——本任務不得動這些）；`CACHE_VERSION` 現況實際值 = `v7`，本任務 bump 為 v8。

## 模組：行程分頁（js/trip-tab.js・css/style.css）

### 功能描述
Olina iPhone 實機使用行程頁後的兩項回饋：(R1) 行程頁各區塊字級過小且不一致，收斂為一套清楚的 type scale；(R2) 行程子區塊增加一層「單日細節」——從五天總覽點某一天，進入只顯示那一天完整內容的畫面，旅遊當天只需關注當天。

### 背景與已拍板決策（不重議）
- 已完成：Task1–4 閉環，Olina 已部署 GitHub Pages 並 iPhone 實測中；Task8（淺色主題＋常用句分類導覽）進行中。
- 已拍板：純靜態 HTML+CSS+原生 JS+SW，無框架、無後端；行程資料住 `js/tripdata.js` 的 `window.TRIP`。
- 已拍板（本任務需求，Olina 實機回饋）：行程頁字要統一變大（「顯示部分有些字很小」）；行程要能點入單一天、只看當天、可返回總覽。
- 已拍板（排序）：**Task8 之後才開工**（同檔衝突防護）；與 Task9（常用句內容，動 phrases.js）無檔案交集、順序可前可後。
- SA/backend/frontend 不得重開已拍板討論；有疑慮記入回報交 PM，不自行改走別條路。

### 涉及範圍
- [x] 後端／核心邏輯（trip-tab.js 視圖切換狀態機與兩層 DOM 建構、sw.js bump）
- [x] 前端／UI（style.css 字級 type scale 統一、總覽卡與單日細節版面）

資料層 `js/tripdata.js` **零變更**：既有 `itinerary`（`day`/`isoDate`/`theme`/`items[{time,title,detail}]`）已足夠支撐下鑽，不需新欄位。實作中若發現確需結構性欄位，停下記入回報交 PM 再議，不得自行加欄位。

---

## R1. 行程頁字級統一（frontend 為主）

### 現況問題
style.css 中 `.trip-*` 各區塊字級散落 10px–26px 二十餘個硬編碼值（如 `trip-item-time` 12px、`trip-day-date` 11–12px、flight/hotel 各種 10–11px 小字），無層級邏輯，實機上部分字過小。

### 設計定案（PM 主張，寫死進本 spec）

在 `:root` 建立五階 type scale 變數（供未來全 App 收斂，**本輪只套用到 `.trip-*` 區塊**）：

| 變數 | 值 | 用途（行程頁語意層級） |
|------|----|----------------------|
| `--fs-xl` | 22px | 單日細節層的日期大標 |
| `--fs-lg` | 19px | 卡片／區塊主標題：日卡 day 標籤、總覽卡標題、`trip-flight-label`、`trip-hotel-name`、`trip-section-title` |
| `--fs-md` | 17px | 內文主體：`trip-item-title`、`trip-item-detail`、地址、電話、緊急電話值、本機資料值、航班起降資訊 |
| `--fs-sm` | 15px | 輔助資訊：`trip-item-time`、日期、星期、`trip-day-theme`、note 備注、欄位 label |
| `--fs-xs` | 13px | 純輔助 caption（如「出發/抵達」小標、提示文字）——**全行程頁字級下限，13px 以下一律禁止** |

規則：
1. `.trip-*` 選擇器內**所有** `font-size` 一律改用上述變數，不留任何硬編碼 px（QA 可機械驗證）。
2. 各元素歸哪一階由 frontend 依上表語意對號入座；表未列到的元素由 frontend 就近歸階並記入回報，但不得低於 `--fs-xs`。
3. 變數值本身若 frontend 認為需微調（±1px 內）可定案記入回報；階數（5 階）與下限（13px）不得動。
4. 行高與間距配合放大的字級微調（可讀優先），但版面結構不重做。
5. 與 Task8 淺色主題協作：只動字級／行高，**不動 Task8 剛定案的任何色值**；深藍品牌卡（航班/飯店卡）若 Task8 定案保留深底，其內文字級照本表套用、配色不碰。

---

## R2. 單日細節下鑽（backend 為主）

### 實作形態定案（PM 主張，寫死進本 spec）

**分頁內視圖切換**（總覽 ⇄ 單日，兩層 DOM 同住 `#trip-sec-itinerary` 內、以 hidden 切換），**不用 overlay**。理由：
- overlay 層（O1–O4 z-index 分帶紀律）是「展示型」場景（bigtext 給店員看、券圖給店員掃），單日細節是「瀏覽型」場景——要長捲動、要返回、要與 pill 導覽共存，塞 overlay 會撞既有分帶紀律。
- 視圖切換與既有 pill 子區塊模式（hidden 切換）同構，實作與心智模型最一致。

### 視圖結構（皆在 `#trip-sec-itinerary` 內）

**A. 總覽層 `.trip-itin-overview`**
- 五張精簡日卡 `.trip-ov-card`（**取代**既有「五天並列＋展開/收合」的日卡清單）：每卡顯示 Day 標籤、日期（沿用 `isoToDisplay` 的 M/D（週）格式）、theme 一行。**不顯示 items**——總覽就是精簡。
- 若某卡的 `isoDate` ＝今天：卡上加「今天」badge 標記。
- 整卡可點（觸控目標高度 ≥44px）→ 進入該日單日層。
- 既有 `trip-day-header`/`trip-day-body` 展開收合模式在行程子區塊內**退場**（被兩層結構取代）；相關孤兒 CSS 由 frontend 清理或改造為新類別。

**B. 單日層 `.trip-itin-day`**
- 頂部導覽列 `.trip-day-nav`（sticky 置頂可選，frontend 定案）：
  - 返回鈕「‹ 總覽」→ 回總覽層；
  - 標題：「Day N・M/D（週）」＋ theme；
  - 前一天／後一天切換鈕（「‹ 前一天」「後一天 ›」）：首日時「前一天」停用、末日時「後一天」停用（disabled，不隱藏）。
- 內容：該日**全部** items 的時間軸（time＋title＋detail），**detail 一律直接完整顯示、不需點擊展開**——單日場景就是要看全部，移除逐項 toggle。`detail` 的 `\n` 換行沿用既有 escHtml＋`<br>` 處理。
- 只渲染當前那一天的內容，其他日期完全不出現。

**C. 預設視圖與當日快捷（B8 邏輯的演進）**
- 首次 init 時：若今天（`getTodayIsoDate()`，沿用既有函式）落在 itinerary 首日至末日之間且能對上某天的 `isoDate` → **直接進該日單日層**（總覽隨時可返回）；否則顯示總覽層。
- 原 B8「預設展開今日日卡」邏輯由此**取代**（不再有展開/收合可言）。
- 「今天」判斷只在 init 時算一次；使用中跨午夜不即時刷新（可接受，記入 api.md）。

**D. 狀態與冪等（沿用 B6 契約）**
- 當前視圖（總覽 or 第幾天）存記憶體變數；切到別的分頁再回來**保留原視圖**（onShow 不重建 DOM，`_initialized` 模式不變）。
- **不新增任何 localStorage key**。
- 視圖切換（總覽→單日、前後天、返回）時捲動至該區塊頂部。

### 分工

| 角色 | 檔案 | 工作 |
|------|------|------|
| backend | `js/trip-tab.js` | 視圖狀態機、總覽層/單日層 DOM 建構、返回/前後天切換、今日判斷進入點、B6 冪等維持；輸出 `Task10.api.md`（新 DOM class 清單、視圖狀態變數、與 frontend 的樣式掛點） |
| backend | `sw.js` | 僅 bump `CACHE_VERSION`（開工時實際值 +1，預期 v6→v7）；PRECACHE_URLS 零增刪（trip-tab.js、style.css 均已在清單）。backend 執行一次，frontend 不得重複 bump |
| frontend | `css/style.css` | R1 type scale 變數＋`.trip-*` 全面套用；R2 總覽卡、單日層、day-nav 版面樣式；孤兒 CSS 清理；以 Task8 完成後的淺色主題為基礎 |

沿用契約：`App.registerTab('trip', { onShow })` 簽名不變；pill 子區塊四顆（行程/航班/飯店/重要資料）結構不變；載入順序（import-data.js → trip-tab.js）不變；相對路徑；`escHtml` 跳脫紀律不變。

---

### 業務規則
1. 行程頁所有字級走五階變數，下限 13px；變數定義在 `:root` 但本輪只套 `.trip-*`。
2. 行程子區塊兩層結構：總覽（五天精簡卡）⇄ 單日（完整時間軸，detail 全展開）；單日層必有返回與前後天切換。
3. 旅程期間開 App 直接落在當天的單日層；旅程外落在總覽。
4. 航班/飯店/重要資料三個子區塊**只動字級（R1），不動結構、內容與行為**。
5. `tripdata.js` 內容與 schema 零變更。

### 邊界條件 / 錯誤處理
- `window.TRIP` 或 `itinerary` 缺/空 → 沿用既有「行程資料載入失敗」文案，不壞頁。
- 某天 `items` 為空陣列 → 單日層顯示「本日無排定行程」，不壞頁。
- 某天缺 `isoDate` → 該卡不參與「今天」判斷；今日判斷對不上任何一天 → fallback 總覽層。
- `item.detail` 缺 → 只顯示 time＋title，不留空殼。
- 重要資料子區塊的匯入碼輸入狀態、pill 選擇狀態在視圖切換與分頁切換後不得丟失（B6 迴歸重點）。

### QA 驗收重點
1. 迴歸：Task1–4＋Task8 全功能過（分頁切換、大字、語音、常用句分類、券圖、匯入碼）；`tripdata.js`、`phrases.js`、`phrases-tab.js`、`coupons-tab.js`、`coupon-viewer.js`、`import-data.js`、`app.js`、`tts.js`、`bigtext.js`、`index.html`、`manifest.webmanifest` git diff 零變更。
2. R1 機械驗證：style.css 中 `.trip-*` 區塊內 `font-size` 全為 `var(--fs-*)`，無硬編碼 px；五階變數值符合本 spec（含 frontend ±1px 定案記錄）；全頁無 <13px 字。
3. R2：總覽五卡齊、逐卡點入日期正確、單日層只含該日 items 且 detail 全展開、返回/前一天/後一天正確、首末日邊界鈕 disabled、items 空天文案、跨分頁切回視圖保留（B6）。
4. 當日快捷：mock 系統日期（行程期間內某日 / 行程期間外）驗證預設落點。
5. 淺色主題不打架：行程頁全部文字在 Task8 淺色底上可讀，Task8 定案色值 git diff 未被本任務改動。
6. `CACHE_VERSION` 已 +1、PRECACHE_URLS 零增刪。
7. Non-scope 無越界。

### 不在本次範圍（Non-scope，必填護欄）
- **不動 `js/tripdata.js`**：不改任何行程/航班/飯店/重要資料內容，不加欄位、不做 migration。
- 不做翻譯（Task5）/ OCR（Task6）/ 部署自動化（Task7）——不接任何網路 API。
- 不碰折價券（coupons-tab.js/coupon-viewer.js）與常用句（phrases.js/phrases-tab.js，含字級——type scale 本輪只套 `.trip-*`，其他分頁字級收斂屬未來任務）。
- 不動航班/飯店/重要資料三個子區塊的結構、行為與資料（僅字級）。
- 不動 `.bigtext-*` / `.cv-*` 兩個 overlay（含其字級——展示型 overlay 自成體系）。
- 不改 Task8 定案的任何色值、theme-color、manifest。
- 不新增 localStorage key、不動既有 key。
- 不改 `registerTab`/`showBigText`/`speak` 簽名、不動 O1–O4 overlay 紀律、不改全域 viewport meta。
- 不做行程編輯功能、不做地圖整合、不做提醒/通知。

### 交接
- **等 Task8 閉環後**，SA 依本 spec＋SYSTEM_MAP 做影響分析，輸出 `Task10.impact.md`。
- Backend 完成後輸出 `Task10.api.md`，建 `Task10.backend_done`。
- Frontend 依 api.md＋impact.md 完成樣式，建 `Task10.done`。
- QA 依上方驗收重點測試。
