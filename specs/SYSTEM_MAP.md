# SYSTEM_MAP — tokyo-trip

> 純靜態 PWA，無後端伺服器。本圖描述檔案結構與依賴關係，SA 影響分析以此為準。
> 狀態標記：✅ 已存在（草稿，可採用/重寫）｜🔨 進行中｜⬜ 規劃中

## 檔案結構

```
tokyo-trip/
├── index.html              ✅ Task1–3  App shell：iOS meta、分頁容器、載入所有 js（Task2 加 tts/bigtext/phrases-tab、Task3 加 import-data/trip-tab，順序定死）
├── css/
│   └── style.css           ✅ Task1–3  全站樣式（直式 iPhone、safe-area；Task2 加常用句/大字 overlay；Task3 加 trip 分頁 8 視覺區塊：pill 導覽/日卡/航班卡/飯店卡/重要資料/私人段/匯入匯出區/暫時提示）
├── js/
│   ├── app.js              ✅ Task1  分頁切換框架、SW 註冊、共用工具（Task2 未改本體，showTab 被 bigtext.js 外掛 wrap）
│   ├── config.example.js   ✅        金鑰模板（上 git）
│   ├── config.js           ✅        真實金鑰（gitignored，載入須容錯）
│   ├── phrases.js          ✅        常用句庫（Task2 消費）
│   ├── tripdata.js         ✅ Task3  行程/航班/飯店/重要資料/折價券資料（單檔雙契約：TRIP=Task3 已換真實資料（schema 見 Task3.api.md，含 isoDate、無 members）、COUPONS=Task4 範例保留；檔頭有隱私警告）
│   ├── tts.js              ✅ Task2  日文語音共用模組（App.speak；Task5 重用）
│   ├── bigtext.js          ✅ Task2  大字展示共用元件（App.showBigText；Task5/6 重用）
│   ├── phrases-tab.js      ✅ Task2  常用句分頁（registerTab('phrases')）
│   ├── import-data.js      ✅ Task3  匯入碼解析/localStorage 存取（App.privateData：get/getRawCode/save/clear/isAvailable）
│   ├── trip-tab.js         ✅ Task3  行程分頁（registerTab('trip')，四子區塊 pill 導覽；onShow 冪等）
│   └── api.js              ⬜ Task5/6 Google Translation + Vision 呼叫
├── sw.js                   ✅ Task1–3  Service Worker：cache-first 離線快取（必須在根目錄，scope 才涵蓋全站；現況 CACHE_VERSION='v3'，PRECACHE_URLS 含 Task2 三新檔＋Task3 兩新檔）
├── manifest.webmanifest    ✅        PWA manifest（standalone、portrait、圖示）
├── icons/                  ✅        icon-192 / icon-512 / apple-touch-icon
├── make_icons.py           ✅        圖示產生腳本（一次性工具，不進快取）
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
| 折價券 | 折價券卡片 | `tripdata.js`(COUPONS) | Task4 |

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
- **`window.PHRASES` 資料契約（Task2 起被消費）**：phrases-tab.js 唯讀消費 `phrases.js` 的資料結構（分類 + 句子 ja/zh/romaji 欄位），缺/空時顯示失敗文案不壞頁。改 phrases.js 資料結構 = 波及 phrases-tab.js 渲染。
- **資料隱私分層是 repo 級永續硬約束（Task3 起）**：repo 內容 = 公開部署內容。公開層（git 追蹤檔全部，含 specs/、DEVELOPMENT_LOG、commit message）禁任何個資真值（護照/保單/訂位代號/姓名/手機）；本機層 = localStorage `tokyotrip.privateData`（匯入碼原字串）。QA 每輪隱私掃描為三段式：工作樹 grep＋**repo 內 `TT1.` 字串 base64 解碼後再 grep**（base64 是純 grep 的盲區）＋git log -p。真值清單由 PM 流程外提供。
- **tripdata.js 是單檔雙契約**：`window.TRIP`（Task3 消費、schema 見 Task3.api.md）＋ `window.COUPONS`（Task4 消費）同住一檔。任一 Task 動此檔都波及另一 Task；且檔名不變、內容變更也必須 bump CACHE_VERSION 才會生效（cache-first 吃住舊資料，頁面不壞、症狀隱蔽）。
- **匯入碼格式 `TT1.<base64(UTF-8 JSON)>` 是跨界契約（Task3 起）**：權威定義在 `Task3.api.md`——它是 repo 外「電腦端真實匯入碼生成器」唯一能對齊的文件。解析端容忍 URL-safe base64 變體；中文必走 TextEncoder/TextDecoder。改格式 = 已發出的真實匯入碼作廢。
- **localStorage key 登記與清除紀律（Task3 起）**：`tokyotrip.lastTab`（Task1/app.js）、`tokyotrip.privateData`（Task3/import-data.js）、Task4 折價券狀態（未來）。**任何模組的「清除」只准 removeItem 自己的 key，全 repo 禁用 `localStorage.clear()`**——誤用會跨 Task 毀資料。
- **`App.privateData`（Task3 首建）**：trip 分頁專用（get/save/clear，簽名見 Task3.api.md），非跨 Task 共用元件；命名已占用 `window.App`，後續 Task 避讓。
- **iOS localStorage 兩坑（Task3 文案已對應，Task7 真機驗）**：(1) Safari 分頁與加入主畫面的 standalone APP 不共用 localStorage——匯入必須在 APP 內做；(2) iOS 儲存壓力可能清除網站資料，本機層非永久，救濟 = 重貼匯入碼（原文須自行留存）。

## 環境

- 目標裝置：iPhone / Safari（iOS 16+ 假設）、直式
- 本機測試：`python -m http.server 8080`（SW 需 localhost 或 HTTPS）
- 正式：GitHub Pages（Task7）
