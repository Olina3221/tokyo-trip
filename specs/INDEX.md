# tokyo-trip 專案 Spec 索引

> 專案：iPhone 專用東京自由行 PWA（四人同行）。加入主畫面後當 APP 使用。
> 技術棧（已拍板，不重議）：純靜態 HTML + CSS + 原生 JavaScript + Service Worker。**無後端伺服器、無框架、無打包工具。**
> 部署（已拍板）：GitHub Pages。翻譯與 OCR（已拍板）：Google Cloud Translation + Cloud Vision，同一把 API key，由使用者填入 `js/config.js`（gitignored）。

## 本 repo 的角色對應（pipeline 用語翻譯）

本專案沒有傳統後端。pipeline 角色對應如下：

- **backend** = 核心邏輯層：`sw.js`、`js/app.js` 的分頁框架邏輯、`js/api.js`、資料檔結構、git/.gitignore/README 等工程面。
- **frontend** = UI 層：`index.html`、`css/style.css`、畫面組裝、iOS 顯示細節（safe-area、大字排版）。
- QA 在 Windows 上以本機 HTTP server + 瀏覽器（含 iPhone viewport 模擬、離線模擬）驗收；**iPhone 真機驗收由 Olina 在流程外做**。

## Task Roadmap（依「佇列順序」欄依序排隊，一次只跑一個；Task 編號永不重用，順序可調）

| 佇列順序 | Task | 標題 | 需網路 | 狀態 |
|---------|------|------|--------|------|
| — | Task1 | PWA 骨架：index.html + 分頁 shell + 離線快取(sw.js) + 加主畫面基礎 + git 初始化 | 否 | ✅ 已完成（2026-07-11 QA PASS，spec: `Task1.spec.md`） |
| — | Task2 | 旅遊常用句 + 大字展示 + 日文語音播放（Web Speech API，離線） | 否 | ✅ 已完成（2026-07-11 QA PASS 45/45，spec: `Task2.spec.md`） |
| — | Task3 | 行程 / 航班 / 飯店 / 重要資料頁（讀 `js/tripdata.js`，離線；個資走本機層匯入碼） | 否 | ✅ 已完成（2026-07-11 QA PASS，失敗 1 次修復後通過；spec: `Task3.spec.md`；真機項移交 Task7） |
| — | Task4 | 折價券專區（讀 `window.COUPONS`，離線；16 張真實券圖，圖片為主體） | 否 | ✅ 已完成（2026-07-11 QA PASS 64/64；收斂為 16 張—移除東京無店的 drugeleven/kintetsu；spec: `Task4.spec.md`；冷 install 真機項移交 Task7） |
| — | Task8 | UX 調整：全 App 改淺色主題 + 常用句分類切換導覽（Olina 實機回饋；B2 已縮小為僅導覽 UI，內容零增刪） | 否 | ✅ 已完成（2026-07-11 QA PASS 靜態驗收全過，phrases.js 機械判準 6+0/41 句零增刪；spec: `Task8.spec.md`；overlay 可讀性/深藍卡對比之真機目視由 Olina 部署後流程外確認） |
| — | Task11 | 底部導覽列淺色化＋字/icon 放大（U1）＋常用句分類 chips 裁切修復（U2）＋航班/飯店卡淺色化（U3）（Olina 第三批實機回饋） | 否 | ✅ 已完成（2026-07-11 QA PASS 靜態 15/15＋整合全過；spec: `Task11.spec.md`；U2 實機視覺由 Olina 部署後流程外確認） |
| **1（下一個）** | **Task10** | **行程頁字級統一（五階 type scale）＋單日細節下鑽（總覽⇄單日視圖切換）（Olina 實機回饋）。字級以 Task8 淺色主題為基礎** | 否 | 🔨 spec 完成（`Task10.spec.md`）。Task11 已閉環、依賴閘解除——`Task10.ready` 已由 PM 重建，SA 可開工 |
| 2 | Task5 | 中 ⇄ 日即時翻譯（Cloud Translation）＋翻譯結果接大字展示與語音 | 是 | 排隊 |
| 3 | Task6 | 拍照辨識日文（相機/相簿 → Cloud Vision OCR → 翻譯） | 是 | 排隊 |
| 4 | Task7 | GitHub Pages 部署 + iPhone 真機驗收清單 | — | 排隊 |
| 待排 | Task9 | 常用句內容整理（依 Olina 另行提供的句子清單做增/刪/改；**清單未到不開工**，到位後由 PM 撰 spec 排入佇列，與 Task5–7 的先後屆時由 Olina 拍板）。Task8 閘已解除（分類 id 已落地，Task9 動 phrases.js 時分類 id 不得改名） | 否 | ⏸ 等 Olina 清單（Task8 側已無阻擋） |

拆解原則：先做離線可跑的（Task1–4），後做需網路金鑰的難功能（Task5–6），最後部署（Task7）。每個 Task 小到 QA 能單輪 PASS/FAIL。

排序調整（2026-07-11）：Olina 已把 Task1–4 成果部署到 GitHub Pages 並在 iPhone 實測，回饋兩項 UX 問題（深色底戶外難讀、常用句混雜無分類）。**正在用的東西先好用**——Task8 插隊為下一個，翻譯/OCR/部署順延。Task5/6/7 編號不變（既有存檔契約大量指涉）。

排序調整（2026-07-11，第二批實機回饋）：Task10（行程頁字級＋單日下鑽）排 Task8 之後、Task5 之前——同為實機使用回饋，且行程 7/21 開始，行程頁好用優先於翻譯/OCR；Olina 可再調。Task10 與 Task9 檔案零交集（Task10 動 trip-tab.js/style.css，Task9 動 phrases.js），先後皆可，但**兩者都必須在 Task8 之後**（Task8 動 style.css 與 phrases 檔）。

閉環註記（2026-07-11）：**Task8 已正式閉環**，Task9/Task10 的「等 Task8」依賴閘皆已解除；Task9 仍等 Olina 句子清單（Task8 側已無阻擋）。

排序調整（2026-07-11，第三批實機回饋）：**Task11 插隊 Task10 之前**——U2（chips 裁切）是壞掉的既有功能、且 U1/U2 皆為 css 快修，先讓常用句可用；Task10 行程下鑽較大，順延一位。兩任務都改 `css/style.css`，**依序執行**（Task11 先、Task10 後）：`Task10.ready` 已由 PM 收回，Task11 閉環後由 PM 重建。CACHE_VERSION 連動：Task11 預期 v6→v7，Task10 順延為 v7→v8（其 spec 寫「開工時實際值 +1」自動吸收）。

閉環註記（2026-07-11）：**Task11 已正式閉環**（sw.js 現為 v7；深底解耦清單收斂為僅 `.bigtext-*`/`.cv-*`，見 SYSTEM_MAP）。Task10 的「等 Task11 閉環」依賴閘解除，`Task10.ready` 已重建，Task10 為下一個。

## 檔案

- `SYSTEM_MAP.md` — 系統地圖（SA 影響分析用）
- `Task1.spec.md` — Task1 規格
- 各 Task 的 `.impact.md` / `.qa_failed.md` 等 sentinel 依 `signal-flow.md` 在本目錄流轉
