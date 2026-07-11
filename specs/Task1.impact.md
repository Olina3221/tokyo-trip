# Task1 影響範圍分析（SA）

> 涉及範圍：後端（核心邏輯層）＋ 前端（UI 層）→ pipeline 走完整 backend → frontend → QA。
> 全新專案：無既有功能可被波及，本分析重點是**前向約束**——Task1 骨架的每個決定如何鎖死 Task2–6 的接點，標出「現在定錯、之後返工」的地方。

## 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| （無） | — | 全新專案，無既有功能。既有草稿檔（phrases.js / tripdata.js / config.example.js / manifest / icons）依 spec Non-scope 不得修改，只被引用 | ❌ |

## 前向約束：Task1 定案會鎖住的接點（依返工風險排序）

### A1. 分頁註冊機制 = Task2–6 的唯一掛載點（返工風險最高）

Task2–6 每個 Task 都要往一個分頁填功能。若 app.js 只做「hash 切 section」而沒有對外註冊 API，後續每個 Task 都得回頭改 app.js 本體，等於骨架沒封版。

**約束（必須寫進 `Task1.api.md`）：**
- 五個分頁 id 現在就定死（建議：`phrases` / `translate` / `camera` / `trip` / `coupons`），DOM section id 與導覽按鈕 data 屬性同名。Task2–6 的 spec 將直接引用這些 id，之後改名 = 全鏈返工。
- 提供分頁生命週期 hook：至少 `App.registerTab(id, { onShow })` 或等價的 tab-change 事件。Task5（翻譯）/ Task6（拍照）需要「切進分頁才初始化」的時機（相機權限、API 檢查不能在載入時就跑）。
- 佔位卡的 DOM 容器約定：每個 section 內佔位內容要可被功能 Task 整塊替換（例如 section 直接就是掛載容器），不要把佔位卡寫成之後要小心拆的結構。

### A2. sw.js 版本化快取的「加新檔 SOP」（每個後續 Task 都會踩）

Task2–6 幾乎每個 Task 都會改檔或加檔（Task5 新增 `js/api.js`）。改動要生效必須：(a) 新檔加入預快取清單、(b) bump 快取版本字串。

**約束：**
- 預快取清單與版本字串必須集中在 sw.js 頂部兩個常數（如 `CACHE_VERSION` / `PRECACHE_URLS`），全檔只出現一次，不得散落。
- 「加新檔 SOP」（加清單＋bump 版本）寫進 README 或 `Task1.api.md`，Task2–6 的 backend 照做；QA 每輪都要驗「舊快取被清、雙 reload 內取到新版」。
- 開發期坑：cache-first 會讓 QA/開發吃到舊檔。README 註明本機驗證用 DevTools「Update on reload / Bypass for network」。

### A3. config.js 的快取語意——spec 有縫，現在補（影響 Task5/6 金鑰輪替）

Spec 業務規則 2 只禁止 config.js 進**預快取**，沒規範 fetch handler 的**動態快取回填**。若 sw.js 對所有 miss 一律回填動態快取，本機存在的 config.js 會被快取住 → 之後使用者換金鑰（Task5/6 上線後的真實場景）reload 拿到舊金鑰，且沒有版本 bump 可救（config.js 不在版控、不隨版本走）。

**約束（backend 必做）：** sw.js fetch handler 對 `config.js` 明確排除回填（走 network-only 或 network-first 不回填）。這不改 spec 拍板內容，是把規則 2 的意圖補完整。

### A4. window.APP_CONFIG 缺席契約（Task5/6 的 api.js 依賴基礎）

Task1 定義「`window.APP_CONFIG` 未定義是合法狀態」。這個契約由三方共同成立：
- index.html：config.js 的 `<script>` 掛 `onerror` 容錯，載入失敗不阻斷後續腳本（frontend）。
- sw.js：預快取任一單檔失敗不使 install 整體失敗（backend；注意 `cache.addAll` 是全有全無，需逐檔 add 容錯或清單根本不含 config.js——後者已拍板）。
- Task5/6 的 api.js 將以 `window.APP_CONFIG?.GOOGLE_API_KEY` 判斷並顯示設定提示。Task1 只需保證前兩點；`Task1.api.md` 把「APP_CONFIG 可能不存在」明文寫成對外契約。

### A5. 相對路徑 + SW scope（Task7 部署的生死線）

sw.js 已拍板放根目錄；註冊必須用 `navigator.serviceWorker.register('./sw.js')`（相對），預快取清單每項都 `./` 開頭。任何一處 `/` 開頭絕對路徑，本機測試全過、Task7 上 GitHub Pages 子路徑（`/tokyo-trip/`）即壞——本機驗不出來，是最典型的「現在錯、最後才炸」點。QA 本輪就要 grep 檢查全部資源引用。

### A6. 腳本載入順序契約（Task2–6 加 js 檔時要有規則可循）

Spec 定了 config.js（容錯）→ 資料 js → app.js。後續 Task 的新腳本（api.js、可能的分頁模組）插哪裡？**`Task1.api.md` 必須二選一寫死**（建議前者）：
- app.js 最後載入、內部在 DOMContentLoaded 統一初始化；功能模組載在資料 js 之後、app.js 之前，透過全域註冊表或 `App.registerTab`（app.js 初始化時收割）掛入；或
- app.js 先載、先建好 `App` API，功能模組其後載入自行註冊。

沒寫死的話 Task2 backend 只能猜，猜錯就是介面返工。

### A7. z-index / overlay 層級預留（Task2 大字展示元件）

「大字展示」是全螢幕元件（Task2 首建、Task5/6 重用），必須蓋過底部導覽列。Task1 的 style.css 若把導覽列 z-index 設得漫無章法，Task2 就要回頭改骨架 CSS。

**約束（frontend）：** style.css 明訂層級規範註解（如：導覽列 z-index:10；z-index ≥100 保留給全螢幕 overlay），safe-area padding 的做法（`env(safe-area-inset-bottom)` 加在導覽列）寫清楚，讓大字元件可重用同一套 safe-area 變數。

### A8. localStorage key 命名空間（輕微）

Task1 用 localStorage 記最後分頁；Task4（折價券已用狀態）等之後也可能用。建議 key 一律前綴 `tokyotrip.`（如 `tokyotrip.lastTab`），寫進 `Task1.api.md` 成為慣例。

## Backend 注意事項

- **git init 順序是硬約束**：本機 `js/config.js` 已存在且含真實金鑰。必須「先建 .gitignore → 再 `git add` → commit 前用 `git status` / `git ls-files` 機械驗證 config.js 未被追蹤」。順序反了金鑰就進 git 歷史，救回成本高。
- sw.js：版本字串與預快取清單集中頂部常數（A2）；config.js 不預快取＋不動態回填（A3）；預快取失敗容錯（A4）；清單全 `./` 相對路徑（A5）；`make_icons.py`、`specs/`、`DEVELOPMENT_LOG.md` 不入快取。
- `Task1.api.md` 是 Task2–6 的地基文件，至少含：五分頁 id 定案、`App.registerTab` 介面與生命週期、腳本載入順序規則（A6）、APP_CONFIG 缺席契約（A4）、加新檔 SOP（A2）、localStorage 前綴（A8）。
- 不動 phrases.js / tripdata.js / config.example.js / manifest / icons 內容（Non-scope）；發現問題記回報。

## Frontend 注意事項

- index.html：config.js `<script>` 加 `onerror` 容錯（A4）；載入順序遵守 backend 在 api.md 定案的規則（A6）；所有引用 `./` 相對路徑（A5）；iOS meta 齊備（viewport-fit=cover、apple-mobile-web-app-*、apple-touch-icon、manifest link）。
- style.css：z-index 層級規範與 overlay 預留（A7）；`env(safe-area-inset-*)`；主題色 `#1F2A5C` 呼應 manifest；觸控目標 ≥ 44px；佔位卡做成可整塊替換的結構（A1）。
- `css/` 目前是空資料夾，style.css 由本 Task 新建。

## QA 迴歸測試清單

- 既有功能迴歸：**無**（全新專案，本 Task 建立的即是日後的迴歸基線）。
- 新功能驗收依 spec「驗收方式」執行，SA 加強項：
  - [ ] grep 全部資源引用，確認無 `/` 開頭絕對路徑（A5，本機驗不出、部署才炸）
  - [ ] 刪除 `js/config.js` 後：頁面正常、console 無未捕捉錯誤、SW install 成功（A3/A4）
  - [ ] 存在 config.js 時斷網 reload：config.js 未被動態快取吃住（改內容後恢復網路 reload 應取到新值）（A3）
  - [ ] bump `CACHE_VERSION` 後兩次 reload 內取得新版、DevTools 確認舊快取名已刪（A2）
  - [ ] `git ls-files` 確認 config.js 未被追蹤（backend 注意事項）
  - [ ] 佔位分頁切換 + localStorage 記住最後分頁（key 帶 `tokyotrip.` 前綴）
- 本清單 A2/A5/「config 缺檔無錯」三項自 Task2 起成為**每輪固定迴歸項**。

## 疑慮回報 PM（不重開拍板，僅記錄）

- 無需 PM 裁決的新議題。A3（config.js 動態快取排除）視為業務規則 2 的意圖補完，已直接列為 backend 約束；若 PM 認定超出解釋範圍，請於閉環時裁示。
