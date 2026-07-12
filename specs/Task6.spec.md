# Task6 — 拍照辨識日文（相機/相簿 → Cloud Vision OCR → 翻譯）

> 目標 repo：`C:\Python Project\tokyo-trip\`。角色對應、技術棧、金鑰版控語意見 `INDEX.md` 檔頭（已拍板，不重議）。
> CACHE_VERSION 連動：**開工時實際值 +1**（撰稿時 sw.js 為 v12，預期 v12→v13；若前方有插隊自動吸收）。

## 模組：camera 分頁（拍照辨識）

### 功能描述

對準日文（菜單/招牌/成分表/藥品說明）拍照或從相簿選圖 → Google Cloud Vision OCR 辨識出日文 → Cloud Translation 翻成中文 → 同畫面顯示原日文＋中文翻譯，可大字展示/播音/複製。

### 背景與已拍板決策（不重議）

- 已完成：Task5（翻譯文字模式＋api.js 三層呼叫層）、Task12/13（對話語音模式、wrap 鏈三層）。camera 分頁目前是 Task1 佔位 shell（`index.html` `#tab-camera`、導覽鈕 `data-tab="camera"` 已存在——**分頁 id 是跨 Task 契約，不得改**）。
- 已拍板：OCR 用 **Google Cloud Vision**（`images:annotate`），同一把金鑰（API 限制現為 Translation＋Vision＋Speech 三個，**Vision 已在限制內，無前置阻擋**）；金鑰納入版控＋referer 鎖 `olina3221.github.io/*`（localhost 實呼叫必 403，QA 驗法見 §9）。
- 已拍板：**降級已內建即為 de-risk**——`getUserMedia` 即時取景失敗時優雅降級為 `<input type="file" capture>` 原生拍照，不需另做探針測試。
- 設計依據：Olina 截圖2 樣態（頂部語言列＋中央取景框＋底部相簿鈕/大快門鈕）。
- 本輪 OCR 方向固定 **日→中**：頂部語言列做**靜態標示**「日文 → 中文」，不做方向切換（反向 OCR 列 Non-scope）。

### 涉及範圍

- [x] 後端／核心邏輯（`js/api.js` 端點層追加 `ocr`、新檔 `js/camera-tab.js`、`index.html` 載入行、`sw.js` bump＋PRECACHE）
- [x] 前端／UI（`#tab-camera` 分頁畫面、`css/style.css` camera 樣式節）

---

## 1. UI 樣態（截圖2，淺色主題一致）

由上而下：

1. **語言列**（靜態）：「日文 → 中文」標示，置頂。
2. **取景區**（畫面主體）：
   - live 模式：`<video playsinline muted autoplay>` 即時預覽，疊掃描框四角（角括號樣式）＋提示文字「對準要翻譯的文字」。
   - 降級模式：同區塊顯示占位圖形＋說明「點下方快門用相機拍照」（無 live 預覽）。
3. **底部操作列**（`flex-shrink: 0`，見 §7 沿用契約）：
   - 左：**相簿鈕**（icon＋「相簿」label）→ `<input type="file" accept="image/*">`（無 `capture`，開相簿）。
   - 中：**大快門鈕**（圓形、直徑 ≥ 64px；live 模式＝抓 video 幀，降級模式＝觸發 `<input type="file" accept="image/*" capture="environment">` 開原生相機）。
4. **結果視圖**（取代取景區顯示，非 overlay）：
   - 原文卡（日文，OCR 結果）＋譯文卡（中文，字級較大為主體）。
   - 動作鈕（每鈕點擊區 ≥ 44px）：**大字**（`App.showBigText`，ja=原文、zh=譯文）、**播音**（`App.speak(原文)`，預設 ja-JP）、**複製譯文**、**複製原文**。
   - **重拍鈕**：回到取景視圖（live 模式重啟 camera track）。
5. **處理中狀態**：拍照後顯示載入指示（「辨識中…」→「翻譯中…」可合併為單一 spinner＋文案），期間快門/相簿鈕停用防連點。

字級紀律：camera 分頁樣式**全硬編碼、禁用 `--fs-*`**（type scale 變數只授權 `.trip-*`，見 SYSTEM_MAP）；輸入類元素若有，計算字級 ≥16px（本分頁預期無 textarea/input 文字框，file input 隱藏不顯示）。

## 2. 流程（狀態機）

```
進分頁（onShow）
  → 嘗試 getUserMedia({ video: { facingMode: 'environment' } })
      成功 → [viewfinder-live] 即時取景
      失敗/不支援/被拒 → [viewfinder-fallback] 降級模式（原生拍照＋相簿仍可用）
  → 快門（live：video 幀畫到 canvas；fallback：input capture 回傳檔案）
    或 相簿選圖（input file 回傳檔案）
  → [processing] 縮圖（§4）→ JPEG base64
  → App.api.ocr(base64) → 日文文字
      空字串 → 友善提示「沒辨識到文字，請對準文字再拍一次」→ 回取景
  → App.api.translate(text, 'ja', 'zh-TW') → 中文
  → [result] 顯示原文＋譯文＋動作鈕
  → 重拍 → 回取景（live 模式重啟 track）
```

- **拍照成功取得影像後立即停止 camera track**（省電＋隱私）；重拍時重啟。
- **離開分頁停 camera**：additive wrap `App.showTab`（§5）。
- onShow 冪等：重複進入不疊加事件監聽、不重複建 DOM；每次進入視 track 狀態重啟取景。
- OCR 成功、translate 失敗時：仍顯示日文原文＋翻譯錯誤文案（原文有價值，不整包丟棄），提供「重試翻譯」。

## 3. `App.api.ocr` 端點契約（backend 實作於 api.js 端點層，不動金鑰/傳輸層）

| 項目 | 內容 |
|------|------|
| 簽名 | `App.api.ocr(imageBase64)` → `Promise<string>`（辨識出的全文） |
| 參數 | `imageBase64`：JPEG 的 raw base64（**不含** `data:image/jpeg;base64,` 前綴） |
| 端點 | `POST https://vision.googleapis.com/v1/images:annotate?key=...`（沿用 `_postJson`，POST-only 硬約束繼承） |
| 請求體 | `{ requests: [{ image: { content: base64 }, features: [{ type: 'TEXT_DETECTION' }], imageContext: { languageHints: ['ja'] } }] }` |
| 取值 | `responses[0].fullTextAnnotation.text`；無則 fallback `responses[0].textAnnotations[0].description` |
| 空結果 | 2xx 且無上述欄位 → **resolve `''`**（「沒辨識到文字」非錯誤——比照 `speechToText` 語意，與 `translate` 空結果 reject 相反） |
| 逐圖錯誤 | **Vision 可能回 2xx 但 `responses[0].error` 存在**（逐圖錯誤內嵌）→ reject `{ code: HTTP_OTHER, message: error.message }` |
| HTTP/網路錯誤 | 沿用 `_classifyError`：NO_KEY / OFFLINE / HTTP_403 / HTTP_429 / HTTP_OTHER，枚舉不得更名 |

Feature 選擇已拍板 **`TEXT_DETECTION`＋`languageHints: ['ja']`**（招牌/菜單為主用途）；SA/backend 若有證據認為 `DOCUMENT_TEXT_DETECTION` 更適合，記入 impact/回報交 PM，**不得同請求雙發兩個 feature**（多耗流量）。

## 4. 影像處理規則（backend，camera-tab.js 內）

- **縮圖必做**：長邊 > 1600px 等比縮至 1600px，canvas 匯出 JPEG（quality ≈ 0.85，backend 可在 0.8–0.9 微調）。目的：Vision 有大小限制＋省日本漫遊流量。機械判準：送出的 base64 影像 ≤ 4MB（實務預期 < 1MB）。
- **EXIF 方向**：相簿/原生拍照回傳的 File 可能帶 EXIF 旋轉，橫倒的圖 OCR 準度差——縮圖管線須產出「視覺正向」的影像（iOS 版本間 `<img>` 解碼/`createImageBitmap` 對 EXIF 的行為差異屬 iOS 陷阱，交 SA 細化、backend 落地）。live video 幀無 EXIF 問題。
- **隱私（硬約束）**：拍攝/選取的影像**只存在記憶體**（canvas/blob），除送 Vision API 外不落地——禁 localStorage、禁寫檔、不進 repo、大字/結果只留文字。用完釋放（revokeObjectURL 等資源釋放交實作）。

## 5. iOS 陷阱清單（SA 影響分析須逐條細化，backend 落地）

1. `<video>` 自動播放必須 `playsinline muted autoplay` 三件套，且部分 iOS 版本需在 `srcObject` 設定後顯式 `play()`。
2. 相機權限被拒：`getUserMedia` reject（NotAllowedError/NotFoundError 等）→ 降級模式＋友善訊息（「無法使用即時取景，可用下方快門開相機拍照」），**不壞頁**。
3. 主畫面 PWA（standalone）模式的 getUserMedia 可用性與 Safari 分頁可能不同——降級路徑必須無條件可用，這正是它存在的理由。
4. canvas 尺寸上限與記憶體：iPhone 原相機 12MP，直接全尺寸 drawImage 可能爆記憶體——縮圖在 draw 時一步完成（目標尺寸 canvas）。
5. 離開分頁/切 App 停 track：wrap showTab 之外，`visibilitychange`/`pagehide` 是否也要停，SA 評估後定案。
6. 每次重啟取景是否重建 stream（比照 recorder.js「每次新建 AudioContext」的 iOS 資源紀律）——SA 評估。
7. file input 在 iOS 的 `change` 事件與取消選圖（不觸發 change）的狀態復原。

## 6. 錯誤處理（camera-tab.js 對映友善訊息，比照 translate-tab 文案風格）

| 情境 | 訊息方向 |
|------|----------|
| NO_KEY | 「尚未設定 API 金鑰」（沿用 Task5 文案） |
| OFFLINE | 「目前離線，拍照辨識需要網路」 |
| HTTP_403 | 「API 拒絕存取（金鑰限制）」 |
| HTTP_429 | 「請求太頻繁，稍後再試」 |
| HTTP_OTHER | 「服務發生錯誤，請再試一次」 |
| 相機權限被拒/不可用 | 降級模式提示（§5-2），非錯誤畫面 |
| OCR 空結果 | 「沒辨識到文字，請對準文字再拍一次」 |
| 翻譯失敗（OCR 已成功） | 顯示原文＋錯誤文案＋「重試翻譯」 |

## 7. 沿用契約（機械判準，QA 逐條驗）

- `App.registerTab('camera', { onShow })`，onShow 冪等。
- `App.showBigText` / `App.speak` 直接重用，**不得改簽名**（Task2.api.md＋Task12 lang 擴充為權威）。
- **wrap 鏈**：camera-tab.js additive wrap `App.showTab`（離開 camera 分頁停 track），**必須 call-through 前一層**。載入位置定案：`<script src="./js/camera-tab.js">` 插 `translate-tab.js` 後、`coupon-viewer.js` 前 → 鏈成四層（外→內）：coupon-viewer → **camera-tab** → translate-tab → bigtext → app.js。wrap 條件＝camera 為當前分頁且目標 id ≠ 'camera'（導覽列重按不中斷取景）。
- POST-only：api.js 對 googleapis 的 fetch 必帶 `method: 'POST'`（sw.js 不需新排除特例）。
- 相對路徑 `./`；`--fs-*` 不外溢（禁用於 `.camera-*`）；底部操作列等非內容區子元素 `flex-shrink: 0`；深底元素（若取景區做深底）不得引用會翻轉的全域主題變數，用區域硬編碼（Task8 解耦紀律）。
- z-index：camera 取景是分頁內容非 overlay，不佔 overlay 分帶；本輪唯一 overlay 重用 bigtext（100），**無新增 z-index ≥ 100**。
- localStorage：本 Task **零新增 key**；禁 `localStorage.clear()`。
- `sw.js`：bump CACHE_VERSION（開工時實際值 +1）＋ PRECACHE 加 `./js/camera-tab.js`（api.js 已在清單）。

## 8. 檔案異動清單與分工

| 檔案 | 動作 | 角色 |
|------|------|------|
| `js/api.js` | 端點層追加 `ocr`（掛載處已有預留註解），金鑰/傳輸層零 diff | backend |
| `js/camera-tab.js` | 新檔：取景/拍照/降級/縮圖/OCR→翻譯狀態機/registerTab/wrap showTab | backend |
| `index.html` | `#tab-camera` 佔位改實際結構；加 camera-tab.js 載入行（位置見 §7） | frontend（結構）＋backend（載入行） |
| `css/style.css` | 新增 camera 樣式節（`.camera-*` 前綴），既有選擇器零 diff | frontend |
| `sw.js` | bump＋PRECACHE +1 筆 | backend |
| `DEVELOPMENT_LOG.md` | 完成條目 | 實作者 |

## 9. QA 驗收要點

- **真 OCR E2E 不在 QA 範圍**：金鑰 referer 鎖 github.io，localhost 實呼叫必 403 屬預期——QA 以 mock Vision 回應驗流程（成功/空結果/逐圖 error/403/429/offline），真機真 OCR 由 Olina 部署後流程外驗收。
- 降級路徑：模擬 getUserMedia 不可用/reject，驗降級 UI＋原生拍照 input＋相簿 input 存在且可觸發。
- 靜態機械判準：§7 全部（POST-only、wrap call-through 四層、`--fs-*` 越界掃描、flex-shrink、零新增 localStorage key、PRECACHE/bump 一致）。
- 隱私三段式掃描照常（工作樹 grep＋TT1. base64 解碼＋git log -p）；另驗影像不落地（無 localStorage 寫入、無新增 tracked 圖檔）。
- 迴歸：既有五分頁與 wrap 鏈行為（尤其 translate 對話模式的 abort 錄音、coupon viewer 關閉）不受新 wrap 層影響。

## 10. 不在本次範圍（Non-scope，護欄）

- 不做**即時逐字 OCR**（對準即翻）——拍一張辨識一次即可。
- 不做 OCR 方向切換（中文→日文 OCR）；語言列為靜態標示。
- 不碰翻譯文字/對話模式（Task5/12/13 已閉環，translate-tab.js 零 diff）。
- 不碰常用句、行程、折價券各分頁。
- 不做部署（Task7）、不做 KML 地圖（未立案）。
- 不改 `App.showBigText`/`App.speak`/`App.api.translate`/`recorder.js` 簽名與行為。
- 不改全域 viewport meta、不改分頁 id、不動金鑰與其限制設定。
- 不做拍照歷史/影像儲存（隱私硬約束的另一面）。

執行者發現 Non-scope 內的「順手改善」機會：記入完成回報、不執行，由 PM 決定是否另開 Task。

---

## 影響範圍分析（SA）

> 全文見 `specs/Task6.impact.md`；此處為摘要。涉及範圍＝後端＋前端 UI，pipeline 走 backend → frontend → QA 全程。
> **增量複核（2026-07-12，Task14/15 閉環後新基線）**：bump 改為 **v14→v15 兩檔三行**（sw.js `CACHE_VERSION`＋version.js `APP_VERSION` 逐字元相等＋`APP_VERSION_DATE`，Task14 SOP）；PRECACHE 現況 38 → 加 camera-tab.js 成 **39 筆**；檔案異動清單擴為**七檔**（§8 六檔＋`js/version.js`）。本文其餘 v13/38 舊數字以此為準（impact §0-bis 為權威）。

### 受影響的既有功能
| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 分頁切換框架 | 全五分頁 / `App.showTab` | wrap 鏈三層→四層（coupon-viewer → **camera-tab** → translate-tab → bigtext → app.js） | ✅ |
| 翻譯對話模式 | translate wrap 層 | 新層插外側，abort 錄音/cancel TTS 行為零變化（守門互斥，見 impact §2.2） | ✅ |
| 券圖檢視器 / 大字展示 / TTS | coupons、常用句、翻譯、行程 | 元件全零 diff，camera 只重用（大字 ja-only＋lang、speak 單參） | ✅ |
| API 呼叫層 | `api.js` | 只加 `ocr`（**單參數**，Task5.api.md 的 mimeType 草描作廢）；Vision 2xx 內嵌 `responses[0].error` 端點層自查 reject HTTP_OTHER，共用分類器零 diff | ✅ |
| 離線快取 / App shell / 樣式 | sw.js、version.js、index.html、style.css | **v15 兩檔三行**＋PRECACHE **39 筆**；#tab-camera 內容＋一行 script（version.js/#app-version/#update-toast 不動）；`.camera-*` 節 | ✅ |

### Backend 注意事項（詳見 impact §1/§3/§4/§6a/§7）
- api.js 唯一允許刪除行＝掛載處預留註解；ocr 取值順序：內嵌 error → fullTextAnnotation → textAnnotations fallback → resolve ''（responses 整缺同樣 resolve ''）。
- track 停止四時機（拍照後／wrap 離開分頁／visibilitychange hidden／pagehide），統一 `_stopStream()`；重啟一律新建 stream；背景返回且 camera 當前＋live 取景視圖 → 自動重啟。
- EXIF 定案走 `<img>`＋objectURL 解碼路徑，**禁 `createImageBitmap(file)`**；縮圖目標尺寸 canvas 一步 drawImage；降級黏性（session 內不重複彈權限窗）；file input 取消不進 processing、用後 `value=''`。
- onShow 兩層並存：冪等層（DOM/監聽一次）＋生命週期層（依視圖＋track 存活分派；結果視圖回訪不重啟相機）。
- camera wrap 連帶 `App.speak.cancel()`（守門＝camera 可見，SA 補定案）；在途 fetch 不需 AbortController。

### Frontend 注意事項
- 只動 `#tab-camera` 內容（section 本體/id 不動）＋script 行插 translate-tab.js 後、Task4 comment 前；`.camera-*` 前綴、字級硬編碼禁 `--fs-*`、底部列 `flex-shrink:0`、`--c-accent-text`、無新增 z-index ≥100；取景深底文字用區域硬編碼色。

### QA 迴歸測試清單（機械判準全文見 impact §5/§6c）
- [ ] api.js 零 diff 邊界＋Non-scope 檔零 diff
- [ ] wrap 四層 call-through＋既有三層行為零變化（含：translate 錄音中切 camera→abort；常用句播音中進出 camera→不被 cancel）
- [ ] camera track 四時機停止＋重按 camera 導覽鈕不中斷取景
- [ ] mock Vision 六情境（成功/空 ''/內嵌 error/403/429/offline）＋降級路徑＋OCR 成功翻譯失敗（原文＋重試）
- [ ] 版號機械閘：sw.js v15＋version.js APP_VERSION 逐字元相等＋DATE 當日＋PRECACHE 39 筆＋冷 install
- [ ] 隱私機械判準：camera-tab.js 零 `localStorage`、零裸 `fetch`、objectURL 建撤配對、無 base64 落 log、git 無新增圖檔＋三段式掃描
- [ ] 靜態掃描：`--fs-*` 越界 0、z-index ≥100 新增 0、`DOCUMENT_TEXT_DETECTION` 0、`cmn-Hant-TW` 只在 STT 語境
