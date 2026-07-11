# SYSTEM_MAP — tokyo-trip

> 純靜態 PWA，無後端伺服器。本圖描述檔案結構與依賴關係，SA 影響分析以此為準。
> 狀態標記：✅ 已存在（草稿，可採用/重寫）｜🔨 進行中｜⬜ 規劃中

## 檔案結構

```
tokyo-trip/
├── index.html              ✅ Task1–3,8  App shell：iOS meta、分頁容器、載入所有 js（Task2 加 tts/bigtext/phrases-tab、Task3 加 import-data/trip-tab，順序定死；Task8 狀態列 black-translucent→default、theme-color→#F5F6F8）
├── css/
│   └── style.css           ✅ Task1–3,8,11  全站樣式（直式 iPhone、safe-area；Task2 加常用句/大字 overlay；Task3 加 trip 分頁 8 視覺區塊：pill 導覽/日卡/航班卡/飯店卡/重要資料/私人段/匯入匯出區/暫時提示；Task8 淺色主題：:root 變數翻轉＋新增 --c-accent-text、硬編碼破口 A1–A10 全清、overlay 深底解耦、.phrases-chips-* 分類 chips 樣式；Task11 導覽列淺色化＋放大（#nav-bar 白底、--nav-h 60px、icon 28px/label 12px）、航班/飯店卡淺色化（A9 深底 override 整塊刪除）、.phrases-chips-bar 加 flex-shrink:0）
├── js/
│   ├── app.js              ✅ Task1  分頁切換框架、SW 註冊、共用工具（Task2 未改本體，showTab 被 bigtext.js 外掛 wrap）
│   ├── config.example.js   ✅        金鑰模板（上 git）
│   ├── config.js           ✅        真實金鑰（gitignored，載入須容錯）
│   ├── phrases.js          ✅ Task8  常用句庫（Task2 消費；Task8 每分類加 `id` 欄位—greetings/dining/shopping/transport/hotel/emergency，41 句內容零增刪）
│   ├── tripdata.js         ✅ Task3–4  行程/航班/飯店/重要資料/折價券資料（單檔雙契約：TRIP=Task3 已換真實資料（schema 見 Task3.api.md，含 isoDate、無 members）、COUPONS=Task4 已換 16 筆真實券資料（schema 見 Task4.api.md：id/store/category/discount/expiry/passport/notes/area/img）；檔頭有隱私警告）
│   ├── tts.js              ✅ Task2  日文語音共用模組（App.speak；Task5 重用）
│   ├── bigtext.js          ✅ Task2  大字展示共用元件（App.showBigText；Task5/6 重用）
│   ├── phrases-tab.js      ✅ Task2,8  常用句分頁（registerTab('phrases')；Task8 重構為分類 chips 導覽：一次只顯示一類、預設 transport、localStorage `tokyotrip.phrasesCat` 記憶、壞值 fallback PHRASES[0]、空分類 chip 不渲染）
│   ├── import-data.js      ✅ Task3  匯入碼解析/localStorage 存取（App.privateData：get/getRawCode/save/clear/isAvailable）
│   ├── trip-tab.js         ✅ Task3  行程分頁（registerTab('trip')，四子區塊 pill 導覽；onShow 冪等）
│   ├── coupon-viewer.js    ✅ Task4  券圖檢視器 overlay（App.openCouponViewer/closeCouponViewer；O1 additive wrap、O3 z-index 110、pinch/pan/雙擊、壞圖文案）
│   ├── coupons-tab.js      ✅ Task4  折價券分頁（registerTab('coupons',{onShow})；冪等；分類分組渲染；點卡→openCouponViewer）
│   └── api.js              ⬜ Task5/6 Google Translation + Vision 呼叫
├── sw.js                   ✅ Task1–4,8,11  Service Worker：cache-first 離線快取（必須在根目錄，scope 才涵蓋全站；現況 CACHE_VERSION='v7'（Task11 bump，PRECACHE_URLS 零增刪），PRECACHE_URLS 含 Task2 三新檔＋Task3 兩新檔＋Task4 兩 js＋16 張券圖）
├── manifest.webmanifest    ✅ Task8  PWA manifest（standalone、portrait、圖示；Task8 background_color/theme_color 改 #F5F6F8，與 index.html theme-color、:root --c-bg 三處一致）
├── icons/                  ✅        icon-192 / icon-512 / apple-touch-icon
├── img/
│   └── coupons/            ✅ Task4  16 張券圖 jpg（全小寫 ASCII 檔名=COUPONS id；總量 4.37MB；與 COUPONS/PRECACHE 三方一致）
├── make_icons.py           ✅        圖示產生腳本（一次性工具，不進快取）
├── make_coupons.py         ✅ Task4  券圖壓縮腳本（一次性工具，不進快取；EXIF 轉正＋白底去 alpha＋長邊≤2000/條碼密集 2600px＋JPEG q=82）
├── .gitignore              ✅ Task1  排除 js/config.js
├── README.md               ✅ Task1  安裝、金鑰設定、部署說明
├── DEVELOPMENT_LOG.md      ✅        進度檔（PM 閉環閘依賴）
└── specs/                  ✅        spec 與 sentinel
```

## 分頁（tab）與 Task 對應

| 分頁 | 內容 | 資料來源 | Task |
|------|------|----------|------|
| 常用句 | 分類句庫、點句 → 大字/播音 | `phrases.js` | Task2 |
| 翻譯 | 中⇄日輸入翻譯 → 大字/播音 | Cloud Translation | Task5 |
| 拍照 | 相機/相簿 → OCR → 翻譯 | Cloud Vision | Task6 |
| 行程 | 每日行程、航班、飯店、重要資料 | `tripdata.js` | Task3 |
| 折價券 | 分類分組券卡 → 點卡開圖片檢視器（pinch 放大給店員掃碼） | `tripdata.js`(COUPONS 16 筆) + `img/coupons/` | Task4 ✅ |

（Task1 只建 shell 與佔位分頁；「大字展示」是共用元件，Task2 首次實作，Task5/6 重用。）

## 依賴關係

- `index.html` → 載入 css、全部 js（config.js 缺檔不得阻斷）、註冊 sw.js
- `sw.js` → 預快取 app shell 清單（**不含** config.js；缺檔不得使 install 失敗）
- `app.js` → 分頁框架；各功能分頁掛在其上
- `api.js` → 依賴 `window.APP_CONFIG.GOOGLE_API_KEY`；無金鑰時功能頁須顯示設定提示而非壞掉
- 所有路徑一律相對路徑 `./`（GitHub Pages 子路徑部署相容）

## 人工補充區（SA 維護，程式碼掃描抓不到的業務層級依賴）

- **分頁 id 是跨 Task 契約**：Task1 定案的五個分頁 id（見 `Task1.api.md`）被 Task2–6 全部引用；改 id = 全鏈返工。
- **sw.js 版本 bump 依賴**：Task2–6 任何檔案異動要離線生效，都依賴「加預快取清單＋bump `CACHE_VERSION`」SOP；漏做的症狀是「改了沒生效」，迴歸必驗。
- **config.js 雙重排除**：不入預快取（spec 拍板）＋不入動態快取回填（SA 補完，Task1.impact.md A3）——否則金鑰輪替後 cache-first 吃舊值，且無版本 bump 可救。
- **大字展示元件（Task2 首建）**：依賴 Task1 style.css 的 z-index 層級規範（導覽列低層、≥100 留給 overlay）與 safe-area 變數；Task5/6 重用同一元件。
- **localStorage 命名空間**：`tokyotrip.` 前綴慣例（Task1 起用於 lastTab；Task4 折價券狀態等沿用）。
- **`App.showBigText` / `App.speak` 是跨 Task 契約（Task2 首建）**：簽名以 `Task2.api.md` 定案為準，Task5（翻譯結果）/ Task6（OCR 結果，僅 ja）直接引用，改簽名 = 雙 Task 返工。`showBigText` 僅 `ja` 必填；`speak` 可用性語意 = speechSynthesis 存在（不綁 ja voice）。
- **`App.showTab` 被 bigtext.js 外掛 wrap**（Task2 起）：切分頁自動關 overlay 是 wrap 出來的行為（app.js 本體未改）。之後任何 Task 動到分頁切換行為時，須連 wrap 一起考慮；Task5/6 呼叫 showTab 會連帶關 overlay（文件化於 Task2.api.md）。
- **語音走 iOS 內建 speechSynthesis（已拍板，離線免金鑰）**：不用 Google Cloud TTS，`api.js`（Task5/6）不含 TTS。iOS voices 非同步/GC/cancel-race 等坑的處理集中在 tts.js，Task5 不得繞過 tts.js 自己叫 speechSynthesis。
- **`window.PHRASES` 資料契約（Task2 起被消費）**：phrases-tab.js 唯讀消費 `phrases.js` 的資料結構（分類含 `id`（Task8 起，chips 導覽與 phrasesCat 記憶依賴）+ 句子 ja/zh/romaji 欄位），缺/空時顯示失敗文案不壞頁。改 phrases.js 資料結構或分類 id = 波及 phrases-tab.js 渲染與使用者已存的分類記憶。Task9（句子增/刪/改）動此檔時分類 id 不得改名。
- **資料隱私分層是 repo 級永續硬約束（Task3 起）**：repo 內容 = 公開部署內容。公開層（git 追蹤檔全部，含 specs/、DEVELOPMENT_LOG、commit message）禁任何個資真值（護照/保單/訂位代號/姓名/手機）；本機層 = localStorage `tokyotrip.privateData`（匯入碼原字串）。QA 每輪隱私掃描為三段式：工作樹 grep＋**repo 內 `TT1.` 字串 base64 解碼後再 grep**（base64 是純 grep 的盲區）＋git log -p。真值清單由 PM 流程外提供。
- **tripdata.js 是單檔雙契約**：`window.TRIP`（Task3 消費、schema 見 Task3.api.md）＋ `window.COUPONS`（Task4 消費）同住一檔。任一 Task 動此檔都波及另一 Task；且檔名不變、內容變更也必須 bump CACHE_VERSION 才會生效（cache-first 吃住舊資料，頁面不壞、症狀隱蔽）。
- **匯入碼格式 `TT1.<base64(UTF-8 JSON)>` 是跨界契約（Task3 起）**：權威定義在 `Task3.api.md`——它是 repo 外「電腦端真實匯入碼生成器」唯一能對齊的文件。解析端容忍 URL-safe base64 變體；中文必走 TextEncoder/TextDecoder。改格式 = 已發出的真實匯入碼作廢。
- **localStorage key 登記與清除紀律（Task3 起）**：`tokyotrip.lastTab`（Task1/app.js）、`tokyotrip.privateData`（Task3/import-data.js）；Task4 零新增 key；`tokyotrip.phrasesCat`（Task8/phrases-tab.js，分類記憶，值＝分類 id，壞值 fallback PHRASES[0]，讀寫包 try/catch 私密瀏覽降級）。**任何模組的「清除」只准 removeItem 自己的 key，全 repo 禁用 `localStorage.clear()`**——誤用會跨 Task 毀資料。
- **`.tab-section` flex 子項壓縮風險（Task11 SA 發現，永續紀律）**：`.tab-section` 是 `display:flex; flex-direction:column` 的固定高度捲動容器。**任何分頁若在 section 內放多個直接子元素（工具列＋內容區模式），非內容區的子元素必須設 `flex-shrink: 0`**——否則內容高於容器時會被 flex 壓縮（若該子元素帶 overflow-x:auto，自動最小高度歸 0，可被壓到近乎不見；Task11 U2 chips bar 裁切即此因）。修法已落地（Task11 閉環）：`.phrases-chips-bar` 已設 `flex-shrink: 0`。現況唯一多子元素分頁 = 常用句（chips bar＋list area）；trip/coupons 為唯一子元素容器不受影響；Task5/6 新分頁做工具列時同樣適用。
- **主題變數與深色元件的解耦紀律（Task8 起；Task11 閉環後深底清單收斂為僅 `.bigtext-*`/`.cv-*` 兩 overlay——導覽列與航班/飯店卡已轉淺色、回歸全域變數）**：`:root` 主題變數（`--c-bg`/`--c-text`/`--c-text-muted`/`--c-divider`）自 Task8 翻轉為淺色語意；**維持深底的元件（現況僅 `.bigtext-*`、`.cv-*` 兩 overlay）不得引用這些會翻轉的變數**，須用區域性硬編碼色值（合法硬編碼殘留：`#7A8DB8` ×2—bigtext:429 + cv:1534）。後續 Task5/6 新 overlay（深底展示型）同樣適用——引用全域文字變數＝淺色主題下自動壞掉。`--c-primary`/`--c-accent` 為品牌色不翻轉，可安全引用；但 `--c-accent` 當**文字**用在淺底對比僅約 3.5:1，文字場景須用深階 accent 變數 `--c-accent-text`（#2E5BCC，Task8 定案，≥4.5:1）。
- **`App.privateData`（Task3 首建）**：trip 分頁專用（get/save/clear，簽名見 Task3.api.md），非跨 Task 共用元件；命名已占用 `window.App`，後續 Task 避讓。
- **多 overlay 並存紀律（Task4 定案，Task5/6 繼承）**：additive wrap 疊加（每個 overlay 元件各自 wrap `App.showTab`，必須 call-through 前一層）＋同分頁互斥責任在開啟方；z-index 分帶：導覽列 10、bigtext 100、coupon-viewer 110、Task5/6 新 overlay 從 120 起跳。**同一分頁內先後開兩種 overlay**（Task6 相機預覽→OCR 大字最可能踩）時，開啟方須先關前一個；bigtext.js 無公開 close API，屆時需回報 PM 補簽名。全文見 `Task4.impact.md` O1–O4。
- **viewport 沒有 user-scalable=no（易誤設假設）**：index.html viewport 允許頁面縮放。任何自訂手勢 overlay（Task4 檢視器起）須自行抑制頁面縮放（雙指 preventDefault＋gesturestart），**不得改全域 viewport meta**（波及全站已驗收頁面）。
- **PRECACHE 重量前向成本（Task4 起）**：`cache.add` 不走 SW 自身 fetch handler → 每次 bump CACHE_VERSION，18 張券圖（4–7MB）全部重新下載。Task5/6/7 每次 bump 都付此成本（行前家用 wifi 可接受）；若圖量再增長，屆時開 Task 做「install 先從舊快取搬運」優化。
- **precache 失敗的隱蔽性與 QA 冷 install 驗法（Task4 起）**：A4 單檔失敗不炸 install＋動態回填會聯手掩蓋「某張券圖沒進 precache」——線上開過一次頁就回填，離線測試假陽性。QA 離線驗收必須冷 install（清站點資料→重 install 期間不開該分頁→離線→驗全量）。
- **iOS localStorage 兩坑（Task3 文案已對應，Task7 真機驗）**：(1) Safari 分頁與加入主畫面的 standalone APP 不共用 localStorage——匯入必須在 APP 內做；(2) iOS 儲存壓力可能清除網站資料，本機層非永久，救濟 = 重貼匯入碼（原文須自行留存）。

## 環境

- 目標裝置：iPhone / Safari（iOS 16+ 假設）、直式
- 本機測試：`python -m http.server 8080`（SW 需 localhost 或 HTTPS）
- 正式：GitHub Pages（Task7）
