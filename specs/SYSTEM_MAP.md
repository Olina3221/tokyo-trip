# SYSTEM_MAP — tokyo-trip

> 純靜態 PWA，無後端伺服器。本圖描述檔案結構與依賴關係，SA 影響分析以此為準。
> 狀態標記：✅ 已存在（草稿，可採用/重寫）｜🔨 進行中｜⬜ 規劃中

## 檔案結構

```
tokyo-trip/
├── index.html              ⬜ Task1  App shell：iOS meta、分頁容器、載入所有 js
├── css/
│   └── style.css           ⬜ Task1  全站樣式（直式 iPhone、safe-area、大字模式）
├── js/
│   ├── app.js              ⬜ Task1  分頁切換框架、SW 註冊、共用工具
│   ├── config.example.js   ✅        金鑰模板（上 git）
│   ├── config.js           ✅        真實金鑰（gitignored，載入須容錯）
│   ├── phrases.js          ✅        常用句庫（Task2 消費）
│   ├── tripdata.js         ✅        行程/航班/飯店/重要資料/折價券資料（Task3、Task4 消費）
│   └── api.js              ⬜ Task5/6 Google Translation + Vision 呼叫、TTS 封裝
├── sw.js                   ⬜ Task1  Service Worker：cache-first 離線快取（必須在根目錄，scope 才涵蓋全站）
├── manifest.webmanifest    ✅        PWA manifest（standalone、portrait、圖示）
├── icons/                  ✅        icon-192 / icon-512 / apple-touch-icon
├── make_icons.py           ✅        圖示產生腳本（一次性工具，不進快取）
├── .gitignore              ⬜ Task1  排除 js/config.js
├── README.md               ⬜ Task1  安裝、金鑰設定、部署說明
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

## 環境

- 目標裝置：iPhone / Safari（iOS 16+ 假設）、直式
- 本機測試：`python -m http.server 8080`（SW 需 localhost 或 HTTPS）
- 正式：GitHub Pages（Task7）
