# Task1 — PWA 骨架：App Shell + 分頁導覽 + 離線快取 + 加主畫面基礎

## 模組：PWA 骨架（tokyo-trip）

### 功能描述

建立可加入 iPhone 主畫面、離線可開啟的 PWA 空殼：底部分頁導覽（5 個分頁，全部先放佔位內容）、Service Worker 離線快取、git 初始化與 .gitignore、README。後續 Task2–6 只往分頁裡填功能，不再動骨架。

### 背景與已拍板決策（不重議）

全新專案，repo `C:\Python Project\tokyo-trip\`，目前只有草稿檔（manifest、icons、config 模板、phrases.js、tripdata.js——可採用，本 Task 不改其內容）。

- 已拍板：技術棧 = 純靜態 HTML + CSS + 原生 JS + Service Worker。**不引入後端伺服器、不引入框架/打包工具。**
- 已拍板：只針對 iPhone / Safari、直式、四人同行。
- 已拍板：部署 GitHub Pages（本 Task 不部署，見 Non-scope）；翻譯/OCR 用 Google API、金鑰在 `js/config.js`（gitignored）。
- 已拍板（PM 合理預設，記錄於此）：分頁採底部固定導覽列 5 頁——「常用句・翻譯・拍照・行程・折價券」；未實作分頁顯示「即將推出」佔位卡。
- SA/backend/frontend 不得重開已拍板討論；有疑慮記入回報交 PM。

### 涉及範圍

- [x] 後端（核心邏輯層：`js/app.js` 分頁框架、`sw.js`、git init、`.gitignore`、`README.md`）
- [x] 前端（UI 層：`index.html`、`css/style.css`、iOS meta / safe-area / 導覽列視覺）

角色對應見 `specs/INDEX.md`「本 repo 的角色對應」。backend 完成後建 `Task1.backend_done` 並輸出 `Task1.api.md`（app.js 對外介面：分頁註冊方式、切頁函式、SW 註冊點），frontend 依介面組裝 UI。

### 交付檔案清單

| 檔案 | 負責 | 內容要求 |
|------|------|----------|
| `js/app.js` | backend | 分頁切換框架（依 hash 或 data 屬性切換 section）、SW 註冊（僅在支援時）、提供分頁註冊機制供後續 Task 掛功能 |
| `sw.js` | backend | 見「業務規則」快取策略；**必須放 repo 根目錄** |
| `.gitignore` | backend | 至少排除 `js/config.js`、`__pycache__/`、`.DS_Store` |
| `README.md` | backend | 專案簡介、本機啟動方式、Google API 金鑰設定步驟、加入主畫面步驟（GitHub Pages 部署章節留 Task7 補） |
| git 初始化 | backend | `git init` + 首次 commit（確認 config.js 未被追蹤） |
| `index.html` | frontend | iOS meta（viewport `viewport-fit=cover`、`apple-mobile-web-app-capable`、`apple-mobile-web-app-status-bar-style`、apple-touch-icon）、manifest 連結、5 分頁容器與底部導覽、載入順序：config.js（容錯）→ 資料 js → app.js |
| `css/style.css` | frontend | 直式 iPhone 版型、`env(safe-area-inset-*)` 處理瀏海與 home bar、深藍主題呼應 manifest `#1F2A5C`、佔位卡樣式、觸控目標 ≥ 44px |

### 業務規則

1. **快取策略（sw.js）**：install 時預快取 app shell（index.html、style.css、app.js、phrases.js、tripdata.js、config.example.js、manifest、icons）；fetch 採 cache-first、miss 時走網路並回填動態快取。快取名帶版本字串（如 `tokyo-trip-v1`），activate 時刪除舊版快取。
2. **config.js 特例**：`js/config.js` **不得**列入預快取清單（gitignored，部署後可能不存在）；index.html 載入它必須容錯（`onerror` 不阻斷）；sw.js 預快取任何單檔失敗不得使整個 install 失敗。
3. **相對路徑**：所有資源引用一律 `./` 相對路徑，禁止 `/` 開頭絕對路徑（GitHub Pages 子路徑相容）。
4. **佔位分頁**：5 個分頁本 Task 全部只放佔位卡（分頁名 + 「即將推出」），但分頁切換、選中狀態、記住最後分頁（localStorage）須真實可用。
5. **零依賴**：不引入任何 CDN / npm 套件；`make_icons.py` 與 `specs/` 不列入快取。

### 邊界條件 / 錯誤處理

- 無 `js/config.js` 時：頁面正常載入、無 console 未捕捉錯誤（`window.APP_CONFIG` 未定義是合法狀態）。
- 不支援 Service Worker 的環境（如 `file://` 直開）：頁面仍可瀏覽，僅無離線能力，不噴錯。
- 離線且已快取：斷網 reload 後 app 完整可用（分頁可切換）。
- SW 更新：改版後（快取版本字串變更）重新整理兩次內取得新版，舊快取被清除。

### 驗收方式（QA 參考）

- Windows 本機：repo 根目錄 `python -m http.server 8080` → 瀏覽器開 `http://localhost:8080/`。
- 檢查：SW 註冊成功（DevTools Application）、預快取清單正確、DevTools 切 offline 後 reload 仍可用、iPhone viewport（390×844）下導覽列不被 home bar 遮擋、5 分頁切換正常、console 無錯（含刪掉 config.js 的情境）、`git status` 確認 config.js 未被追蹤。
- iPhone 真機「加入主畫面」由 Olina 流程外驗收，QA 只驗 manifest / meta 齊備。

### 不在本次範圍（Non-scope，必填護欄——不是備註）

- 不實作任何功能分頁內容：常用句 UI、大字展示、語音播放、翻譯、OCR、行程渲染、折價券渲染一律不做（各歸 Task2–6）。
- 不建立 `js/api.js`（Task5 才建）。
- 不修改 `phrases.js`、`tripdata.js`、`config.example.js`、`manifest.webmanifest`、`icons/` 的既有內容（發現問題記入回報，不動手）。
- 不部署 GitHub Pages、不建 GitHub remote、不 push（Task7）。
- 不做 Android / 桌面瀏覽器相容處理。
- 不引入任何外部函式庫、字型 CDN、分析工具。

## 影響範圍分析（SA）

> 完整版見 `specs/Task1.impact.md`。全新專案，無既有功能受波及；重點是 Task1 定案對 Task2–6 的前向約束。

### 受影響的既有功能
| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| （無） | — | 全新專案；既有草稿檔僅被引用、不得修改 | ❌ |

### 前向約束摘要（現在定錯 = 之後返工）
1. **分頁註冊機制**：五分頁 id 本 Task 定死（建議 `phrases`/`translate`/`camera`/`trip`/`coupons`），app.js 須提供 `App.registerTab(id, {onShow})` 等生命週期 hook，Task2–6 只填 section 不改框架。
2. **sw.js 加新檔 SOP**：版本字串與預快取清單集中頂部常數；「加清單＋bump 版本」寫進 README/api.md，Task2–6 每輪照做。
3. **config.js 快取語意補完**：除不預快取外，fetch handler 也不得動態回填 config.js（否則 Task5/6 後換金鑰吃舊值）。
4. **APP_CONFIG 缺席契約**：`window.APP_CONFIG` 未定義為合法狀態，index.html onerror 容錯＋sw.js 單檔失敗不炸 install；Task5/6 的 api.js 依此契約寫。
5. **相對路徑**：全數 `./`，本機驗不出、Task7 GitHub Pages 子路徑才炸——QA 本輪即 grep 檢查。
6. **腳本載入順序規則**：後續新 js（api.js 等）插入位置須在 `Task1.api.md` 寫死。
7. **z-index 層級預留**：導覽列低層級、≥100 保留給 Task2 大字展示全螢幕 overlay。
8. **git init 順序**：本機 config.js 已含真實金鑰，先 .gitignore 再 add，commit 前機械驗證未追蹤。

### Backend / Frontend 注意事項與 QA 迴歸清單
見 `specs/Task1.impact.md` 對應章節；其中「無絕對路徑 grep」「config 缺檔無錯」「版本 bump 雙 reload 生效」自 Task2 起為每輪固定迴歸項。
