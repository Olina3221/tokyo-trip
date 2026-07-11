# tokyo-trip 專案 Spec 索引

> 專案：iPhone 專用東京自由行 PWA（四人同行）。加入主畫面後當 APP 使用。
> 技術棧（已拍板，不重議）：純靜態 HTML + CSS + 原生 JavaScript + Service Worker。**無後端伺服器、無框架、無打包工具。**
> 部署（已拍板）：GitHub Pages。翻譯與 OCR（已拍板）：Google Cloud Translation + Cloud Vision，同一把 API key，由使用者填入 `js/config.js`（gitignored）。

## 本 repo 的角色對應（pipeline 用語翻譯）

本專案沒有傳統後端。pipeline 角色對應如下：

- **backend** = 核心邏輯層：`sw.js`、`js/app.js` 的分頁框架邏輯、`js/api.js`、資料檔結構、git/.gitignore/README 等工程面。
- **frontend** = UI 層：`index.html`、`css/style.css`、畫面組裝、iOS 顯示細節（safe-area、大字排版）。
- QA 在 Windows 上以本機 HTTP server + 瀏覽器（含 iPhone viewport 模擬、離線模擬）驗收；**iPhone 真機驗收由 Olina 在流程外做**。

## Task Roadmap（依序排隊，一次只跑一個）

| Task | 標題 | 需網路 | 狀態 |
|------|------|--------|------|
| Task1 | PWA 骨架：index.html + 分頁 shell + 離線快取(sw.js) + 加主畫面基礎 + git 初始化 | 否 | **進行中（spec: `Task1.spec.md`）** |
| Task2 | 旅遊常用句 + 大字展示 + 日文語音播放（Web Speech API，離線） | 否 | 排隊 |
| Task3 | 行程 / 航班 / 飯店 / 重要資料頁（讀 `js/tripdata.js`，離線） | 否 | 排隊 |
| Task4 | 折價券專區（讀 `window.COUPONS`，離線） | 否 | 排隊 |
| Task5 | 中 ⇄ 日即時翻譯（Cloud Translation）＋翻譯結果接大字展示與語音 | 是 | 排隊 |
| Task6 | 拍照辨識日文（相機/相簿 → Cloud Vision OCR → 翻譯） | 是 | 排隊 |
| Task7 | GitHub Pages 部署 + iPhone 真機驗收清單 | — | 排隊 |

拆解原則：先做離線可跑的（Task1–4），後做需網路金鑰的難功能（Task5–6），最後部署（Task7）。每個 Task 小到 QA 能單輪 PASS/FAIL。

## 檔案

- `SYSTEM_MAP.md` — 系統地圖（SA 影響分析用）
- `Task1.spec.md` — Task1 規格
- 各 Task 的 `.impact.md` / `.qa_failed.md` 等 sentinel 依 `signal-flow.md` 在本目錄流轉
