# Task4.impact.md — 折價券專區 影響範圍分析（SA）

> 對照 `SYSTEM_MAP.md` 與實際程式碼（sw.js、bigtext.js、app.js、tripdata.js、index.html、來源圖檔實測）產出。
> 涉及範圍：**後端＋前端都有**（core：coupons-tab.js／tripdata.js／sw.js／壓縮產出；UI：index.html／style.css）。pipeline 走完整鏈：backend → frontend → QA。

---

## 一、離線容量定案（分析重點 1）——**採方案 A：壓縮後全量 PRECACHE**

### 定案理由

- 來源實測：18 張（去重後）共 **29.0MB**，最大 tsuruha2026.jpg 7.8MB——**原圖直上確定不行**；壓縮後預估 4–7MB 是安全區。
- iOS Cache Storage 配額按可用磁碟比例計算，歷史最保守下限也有約 50MB／origin；本 app shell 現況 <1MB，加 4–7MB 券圖總量 <10MB，**距離觸頂有數倍餘裕**。
- 備選 B（cache-on-view）「要在有網路時先開過一次頁」——這正是 hard requirement 要消滅的人為前置條件（忘了開＝到店看不到），且本 app 的動態回填快取（sw.js fetch handler）行為隱蔽、QA 難以驗證「哪些看過哪些沒看過」。**否決。**
- 備選 C（進 repo 不預快取＋手動下載按鈕）：只有壓縮後仍 >15MB 才值得付出 UI＋下載狀態管理成本。預估用不到，**不採，但保留為熔斷退路**（見下）。

### Backend 必守實作約束

| # | 約束 | 驗證方式 |
|---|------|----------|
| C1 | `img/coupons/` 總量 **目標 ≤ 8MB，硬上限 10MB**。逐張放寬到 2600px 後若仍超過 10MB → **停工回報 PM 改走方案 C**，不得硬塞 | `du -sh img/coupons/`，QA 複驗 |
| C2 | 壓縮規格照 spec（長邊 ≤2000px、JPEG q≈82、條碼模糊者放寬 2600px、不裁切）；**逐張目視條碼/QR＋條碼數字**，結果記入 `Task4.api.md`（哪幾張放寬、為什麼） | backend 自證清單 |
| C3 | **EXIF 方向與 metadata**：壓縮前先 `ImageOps.exif_transpose()`（否則手機拍的 JPEG 會躺著顯示），輸出時不帶 EXIF（順帶消除任何 GPS/裝置 metadata 進公開 repo 的可能） | 腳本 code review |
| C4 | **PNG→JPEG 透明通道**：4 張 PNG 來源（biccamera/seibu-sogo/odakyu/alpen）若含 alpha，必須先鋪白底再 `convert('RGB')`——直接 convert 會黑底或直接 raise | 腳本 code review＋目視 |
| C5 | 壓縮腳本（建議 `make_coupons.py`，比照 make_icons.py 放 repo 根目錄）只讀來源資料夾、**絕不寫回** `C:\Olina\其它\東京\折價券\`；不進 PRECACHE、不進快取 | code review |
| C6 | PRECACHE 新增 19 筆（18 圖＋coupons-tab.js），`CACHE_VERSION` `'v3'`→`'v4'`；config.js 禁令（A3）不動 | QA 靜態檢查 |

### install 失敗容錯（A4）的新風險——**QA 驗法必須升級**

現行 sw.js install 已是逐檔 `cache.add().catch(warn)`（單檔失敗不炸 install），**機制不用改**。但 Task4 讓 A4 出現新的隱蔽失敗模式：

1. **shell js 缺檔會當場壞頁（看得見）；券圖缺檔只在「到店＋離線」才爆（看不見）**——install 靜默漏抓一張圖，QA 線上測試完全無症狀。
2. 更糟的是 **動態回填會掩蓋 precache 失敗**：只要 QA 在線上開過一次 coupons 分頁，缺的圖就被 fetch handler 回填進快取，離線測試照樣通過——測到的是回填，不是 precache。

**因此 QA 離線驗收必須是「冷 install」流程**：清站點資料 → 重新 install（期間不開 coupons 分頁）→ 直接切離線 → 開 coupons 分頁驗 18 張全部顯示。另建議 backend 在 `Task4.api.md` 附一行 DevTools console 檢查式（列出 cache keys 數量/清單），供 QA 機械化比對 19 筆全在。

### 前向成本（記錄，不在 Task4 修）

`cache.add` 從 SW 內部 fetch，不走自己的 fetch handler → **每次 bump CACHE_VERSION，18 張圖全部重新下載（4–7MB/次）**。Task5/6/7 各要 bump 一次。本 app 是行前在家 wifi 更新的旅行工具，此成本可接受，**不要求 Task4 做舊快取搬運優化**；若未來圖量再長，屆時再開 Task 做「install 時先從舊快取 copy 命中再補網路」。已記入 SYSTEM_MAP 人工補充區。

---

## 二、多 overlay 並存紀律定案（分析重點 2）——**對 Task5/6 的前向約束**

### 現況機制（讀碼確認）

- bigtext.js 載入時把 `App.showTab` 換成 wrap：`closeOverlay(未開時 no-op) → 原函式`。原簽名/回傳不變。
- overlay 背景捲動鎖 = overlay 元素自身的 `touchmove preventDefault (passive:false)`。
- z-index：導覽列 10、`#bigtext-overlay` 100。

### 定案：**「additive wrap 疊加」＋「同分頁互斥責任在開啟方」，不建集中式 closeAllOverlays**

否決集中式 `App.closeAllOverlays()` 的理由：需要回改已驗收的 bigtext.js（Task2 迴歸成本），且目前 wrap 範式本身可組合（composable），集中註冊表是為尚未存在的複雜度買單。若 Task6 實作時 overlay 數量/交叉開啟真的失控，屆時開 Task 重構，屆時再遷移。

四條紀律（Task4 遵守，**Task5/6 繼承，寫進 Task4.api.md**）：

| # | 紀律 | 說明 |
|---|------|------|
| O1 | **每個 overlay 元件各自 additive wrap `App.showTab`**：載入時捕獲當前 `App.showTab` 引用，wrap = 關自己（未開 no-op）→ **必須呼叫捕獲的前一層函式並原樣回傳**。禁止覆蓋不 call-through。 | 疊加後：切分頁 → coupons wrap 關檢視器 → bigtext wrap 關大字 → app.js 原函式切頁。**任意 wrap 順序都成立**，載入順序只決定關閉先後（無感）。coupons-tab.js 排在 bigtext.js 之後載入（spec A6 插入位置已保證）。 |
| O2 | **同時最多開一個 overlay，互斥責任在「開啟方」**：結構上，每個 overlay 只從自己分頁的使用者操作開啟＋O1 保證切分頁全關 → 「開 A 時 B 還開著」只可能發生在**同一分頁內先後開兩種 overlay**。Task4 無此情境（coupons 分頁不呼叫 showBigText；bigtext 不可能在 coupons 分頁存活——切進來時已被 wrap 關掉）。**Task5/6 前向約束**：若某分頁要「自己的 overlay → 再開 showBigText」（Task6 相機預覽層→OCR 結果大字 極可能踩到），開啟方必須先明確關掉前一個 overlay；bigtext.js 目前**沒有公開 close API**，屆時該 Task 需補（另列異動回報 PM），不得偷改。 |
| O3 | **z-index 分帶**：`#coupon-viewer` 定 **110**（bigtext 100、導覽列 10；未來 Task5/6 overlay 從 120 起跳）。即使互斥紀律被違反，疊加順序也是確定的（後開的功能層在上）。 |
| O4 | **捲動鎖各自為政、只鎖自己**：檢視器的 `touchmove preventDefault` 掛在 overlay 背景層；**圖片手勢層（pinch/拖曳目標元素）的事件處理不得被背景鎖吃掉**——建議手勢在內層元素處理並擋住冒泡，或背景 handler 判斷 `e.target` 在手勢層內時放行給自己的 transform 邏輯（實作二選一，frontend/backend 協調，QA 驗「放大平移可動、背景不捲」）。 |

### spec 假設修正（重要，backend 必讀）

spec 寫「PWA viewport 多為 user-scalable=no」——**本 repo 的 viewport 沒有 user-scalable=no**（index.html: `width=device-width, initial-scale=1, viewport-fit=cover`）。後果：檢視器內雙指 pinch 可能觸發 **Safari 頁面縮放** 而非自訂 transform。約束：

- **不得為此改全域 viewport meta**（會改變整個 app 的縮放行為，波及已驗收的 Task2/3 頁面）。
- 檢視器開啟期間在 overlay 上以 `touchstart/touchmove`（passive:false，雙指時 preventDefault）＋ iOS `gesturestart` preventDefault 抑制頁面縮放，關閉時解除。這是 O4 的一部分。

---

## 三、tripdata.js 單檔雙契約破口（分析重點 3）

實際檔案：`window.TRIP` 佔第 9–314 行，`window.COUPONS` 範例佔第 316–334 行（含「此區塊原樣保留不動」舊註解）。破口清單：

| # | 破口 | 約束 |
|---|------|------|
| T1 | **合法編輯區 = 檔案第 316 行起的 COUPONS 區塊**（含該區塊前的兩行舊註解，由本 Task 換成新 schema 註解）。檔頭隱私警告（1–8 行）與 TRIP（9–314 行）**一個位元組都不准動** | `git diff js/tripdata.js` 必須只有一個 hunk 且落在 COUPONS 區；QA 機械檢查：diff 中不得出現任何 `window.TRIP` 區內容 |
| T2 | **單檔共爆半徑**：COUPONS 區一個語法錯誤（漏逗號/引號）會讓整檔 parse 失敗 → `window.TRIP` 一起 undefined → **行程分頁陪葬**。這是本 Task 最容易「改折價券弄壞行程」的路徑 | backend 冒煙必含：載入頁面後 console 驗 `window.TRIP` 與 `window.COUPONS` 皆已定義、`COUPONS.length===18`；QA 迴歸必跑行程分頁 |
| T3 | 舊 schema 註解（`type: "code"/"barcode"` 那兩行）必須隨範例一起刪除，不留過時契約描述誤導 Task5+ | code review |
| T4 | 內容變更靠 bump v4 生效（cache-first 吃舊檔症狀隱蔽：頁不壞、資料是舊的） | 已列 C6 |
| T5 | 現無任何 js 消費 `window.COUPONS`（已 grep 確認），schema 重寫**零既有消費者波及**；coupons-tab.js 是第一個消費者，須按 spec 邊界（undefined/空陣列 → 失敗文案不壞頁） | QA 邊界測試 |

---

## 四、檔名 ASCII 化一致性（分析重點 4）

三處字串必須**逐字元一致**，且與 id 同構：

```
COUPONS[i].id = "biccamera"
COUPONS[i].img = "./img/coupons/biccamera.jpg"   ← A5 相對路徑
sw.js PRECACHE_URLS 含 "./img/coupons/biccamera.jpg" ← 與 img 欄位字串完全相同
```

| # | 約束 | 理由 |
|---|------|------|
| F1 | 18 個目標檔名照 spec 對應表，**全小寫 ASCII、副檔名一律 `.jpg`**（PNG 轉檔後不得殘留 `.png`） | 消滅 URL percent-encoding／空白／括號整類問題（來源檔 `sundrug _funtime.jpg` 含空白、`cosmos2026 (1).jpg` 含括號，都不進 repo） |
| F2 | **大小寫敏感陷阱**：GitHub Pages 檔案系統大小寫敏感，Windows 本機測試不敏感——`Biccamera.jpg` 本機全過、上線 404，QA 抓不到。約束：檔名、img 欄位、PRECACHE 三處全小寫，QA 對 `img/coupons/` 目錄名與兩份清單做機械比對（18×3 交叉一致） | 唯一會「QA 過了但 Task7 上線才爆」的路徑 |
| F3 | `id` = 檔名主幹（spec 已定）——讓資料、檔案、快取清單三方可機械對帳 | QA 可寫一行腳本驗 |
| F4 | repo 全樹不得出現中文/空白/括號圖片檔名（spec QA 7 已列，此處確認含 `img/` 新目錄） | — |

---

## 五、spec 縫隙補完（分析重點 5）

1. **`Task4.api.md` 為 backend 必交付物**（spec 涉及範圍有提但未列細目）：內容至少含 COUPONS 最終 schema、檢視器公開行為（開啟條件/關閉途徑/手勢）、**O1–O4 多 overlay 紀律全文**（Task5/6 的繼承依據）、壓縮參數與逐張放寬紀錄、cache keys 檢查式。
2. **壞圖時檢視器行為二選一定案**：spec 留「不開啟或顯示訊息」——定案為**開啟並顯示「圖片載入失敗」訊息**（不開啟像沒反應，使用者會連點）。
3. **EXIF/alpha/腳本歸屬**：見 C3–C5（spec 未提，屬實作縫隙）。
4. **viewport 無 user-scalable=no 的修正**：見「二、spec 假設修正」。
5. **QA 冷 install 離線驗法**：見「一、install 失敗容錯」——spec 的「離線模擬」原描述不足以排除動態回填假陽性。
6. **非東京券（drugeleven/kintetsu）是否收錄**：spec 已標「待 Olina 拍板」——本分析按「全收錄＋area 警示」進行；若 Olina 拍板移除，只動 COUPONS 資料與 2 張圖＋PRECACHE 兩行，影響面封閉在 Task4 產物內，不需重做影響分析。
7. **localStorage**：本 Task 零 key，A8 登記表不動（Task3.api.md 第 8 節「Task4 待定」維持待定）。

---

## 受影響的既有功能總表

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 行程分頁 | trip-tab.js / `window.TRIP` | 同檔 tripdata.js 被編輯，語法錯誤共爆（T2） | ✅ |
| 常用句＋大字 overlay | phrases-tab.js / bigtext.js | coupons-tab.js 對 `App.showTab` 疊第二層 wrap（O1），wrap 斷鏈會毀「切分頁自動關大字」 | ✅ |
| 分頁框架/初始分頁 | app.js showTab / lastTab | 初始 `showTab(initialTab)` 會經過兩層 wrap（皆 no-op），行為不得變 | ✅ |
| 離線快取全站 | sw.js v3→v4 | activate 刪 v3 全部快取後重建；install 體積增 4–7MB | ✅ |
| config.js 排除（A3） | sw.js | PRECACHE 大改時最容易誤加，禁令重申 | ✅ |
| 匯入碼/本機私資料 | import-data.js | 不動；但 QA 迴歸確認 v4 換版後 localStorage 資料仍在（快取換版不影響 localStorage，驗一次防呆） | ✅ |
| 翻譯/拍照佔位分頁 | index.html | 不動，冒煙掃過即可 | ✅ |

## Backend 注意事項（彙總）

- C1–C6（容量/壓縮/EXIF/alpha/腳本/bump）；T1–T5（tripdata 編輯區與共爆）；F1–F3（三處字串一致、全小寫）；O1（wrap call-through）、O3（z-index 110）。
- coupons-tab.js 的 registerTab onShow 冪等（比照 trip-tab `_initialized` 模式）。
- 交付 `Task4.api.md`（縫隙 1 細目）。

## Frontend 注意事項（彙總）

- index.html script 標籤插在 `trip-tab.js` 之後、`</body>` 之前（必須晚於 bigtext.js，O1 依賴）。
- style.css：券卡列表＋`#coupon-viewer` 樣式；z-index 110（O3）；✕ 觸控 ≥44px；縮圖 `loading="lazy"`；safe-area 變數沿 Task1 規範。
- 手勢與背景鎖分層（O4）＋頁面縮放抑制（viewport 修正節）。
- 不動既有 `.bigtext-*`、`.trip-*` 任何樣式。

## QA 迴歸測試清單

- [ ] 行程分頁完整渲染（`window.TRIP` 未受 tripdata.js 編輯波及；`git diff` 單 hunk 落在 COUPONS 區）
- [ ] 常用句 → 大字 overlay 開啟/關閉/播音；**開著大字切分頁自動關**（驗兩層 wrap 疊加後 bigtext 行為不變）
- [ ] 交叉情境：coupons 開檢視器 → 切 phrases（檢視器自動關）；phrases 開大字 → 切 coupons（大字自動關、檢視器不受影響可正常開）
- [ ] 初始載入 lastTab 恢復正常（雙層 wrap 下 `showTab(initialTab)` 不變）
- [ ] **冷 install 離線驗法**：清站點資料 → 重 install（不開 coupons 分頁）→ 離線 → coupons 分頁 18 張全顯示、檢視器可開（排除動態回填假陽性）
- [ ] `CACHE_VERSION==='v4'`；PRECACHE 19 筆新增齊全；config.js 仍不在清單且 network-only
- [ ] `img/coupons/` 總量 ≤8MB（硬上限 10MB）；檔名 18×3 交叉一致、全小寫 ASCII
- [ ] v3→v4 換版後 `tokyotrip.privateData`/`tokyotrip.lastTab` 仍在
- [ ] 邊界：COUPONS 清空/單圖壞路徑/缺 img 或 store 欄位 → 依 spec 邊界行為不壞頁
- [ ] 隱私掃描三段式照常（qa.md）
- 新功能驗收由 QA 依 `Task4.spec.md`「QA 驗收重點」執行

## 涉及範圍標記

含 UI。pipeline：backend → frontend → QA（backend 完成建 `.backend_done`，不得直接 `.done`）。
