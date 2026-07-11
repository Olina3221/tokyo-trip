# Task5 規格 — 中 ⇄ 日即時翻譯（Cloud Translation）＋金鑰納入版控的不變式翻轉

## 模組：翻譯分頁（translate）＋ Google API 呼叫層（Task6 可重用）＋ config.js 版控化

### 功能描述
把 `translate` 佔位分頁做成中文⇄日文即時翻譯：輸入文字 → 呼叫 Google Cloud Translation API → 結果可大字展示給店員看（重用 `App.showBigText`）、日文語音播放（重用 `App.speak`）、一鍵複製。**同輪一併完成「API 金鑰納入版控」的專案級不變式翻轉**（見下方專節）。

### 背景與已拍板決策（不重議）
給冷 context 下游的最小背景。SA/backend/frontend 不得重開已拍板的討論——有疑慮記入回報交 PM，不自行改走別條路。

- 已完成：Task1–4、8–11 全部閉環。sw.js 現況 `CACHE_VERSION='v9'`。`App.registerTab` / `App.showBigText` / `App.speak` 契約見 `Task1.api.md` / `Task2.api.md`。translate 分頁 id 與導覽鈕在 Task1 已建好（`index.html` 的 `#tab-translate` 佔位）。
- 已拍板：金鑰用 `window.APP_CONFIG.GOOGLE_API_KEY`。**Olina 已申請並填入 `js/config.js`**（PM 已驗證檔案含金鑰），並已在 Google Cloud Console 設好兩層限制：
  - HTTP 參照網址限制 = `olina3221.github.io/*`
  - API 限制 = Cloud Translation + Cloud Vision（同一把 key，Task6 沿用）
- **已拍板（本 Task 的結構性決策）：`js/config.js` 改為納入版控並隨 App 部署到 GitHub Pages。** Olina 同意「限制過的金鑰放公開站」的標準做法——手機（github.io）要能用，金鑰必須隨站部署。金鑰安全從此靠「網站限制＋API 限制＋可隨時在 Google Cloud 重新產生作廢」，**不再靠「不進 repo」**。
- 已拍板（測試分工）：**因為來源被鎖成只有 `olina3221.github.io`，localhost 呼叫會被 Google 拒絕（403）**。agent（backend/QA）只能驗程式邏輯與 mock，**真正翻譯 E2E 由 Olina 在部署後的 iPhone（github.io）上驗**。QA 不得以「實呼叫不成功」判 FAIL（403 反而是限制生效的證據）。
- 已拍板（沿用 Task2 定案）：語音走 iOS 內建 speechSynthesis（tts.js），**不用 Google Cloud TTS**；`api.js` 不含 TTS。

### 涉及範圍
- [x] 後端／核心邏輯（api.js 翻譯呼叫層、translate-tab 分頁邏輯、.gitignore 改動、sw.js A3 調整與 bump、README/config.example.js 金鑰語意改寫、`Task5.api.md`）
- [x] 前端／UI（translate 分頁畫面與樣式，淺色主題一致）

---

## ★ 金鑰納入版控——既有不變式翻轉清單（SA 必掃、逐一調和）

過去整個專案把 `js/config.js` 當「絕不進 repo 的秘密」，多處據此設計。本 Task 一致翻轉。**SA 除下列已盤出項外，須全面 grep 掃出所有「假設 config.js 不在 repo」的殘留（註解、文件、判準）並在 impact.md 逐一列出調和方式。**

| # | 位置 | 現況 | 調和方式 | 負責 |
|---|------|------|---------|------|
| 1 | `.gitignore` | 排除 `js/config.js` | **移除該排除**（連同檔頭「絕對不進 git」註解）；config.js 首次 add 進版控 | backend |
| 2 | `README.md` 金鑰段（L51–53） | 「已被 .gitignore 排除，不會上傳 GitHub」 | 改寫為：「限制過的金鑰隨站部署，靠 HTTP 參照網址限制＋API 限制保護，可隨時在 Google Cloud 重新產生作廢」；安全提醒段改為描述 Olina 已設的限制 | backend |
| 3 | `README.md` 專案結構註解（L105）＋開發 SOP 禁止項（L84） | 「gitignored」「config.js 永遠不得加入快取」 | 依 #5 的 SA 定案同步改寫 | backend |
| 4 | `js/config.example.js` 檔頭註解 | 「config.js 不會上傳到 GitHub」 | 註解改寫（範本檔保留——它在 PRECACHE 內，退場屬 non-scope） | backend |
| 5 | `sw.js` A3（config.js network-only 不快取，含檔頭禁止項、fetch handler 特例、NOTE 註解） | config.js 雙重排除 | **SA 定案**。PM 建議：config.js 現在納管、可版本化 → **加入 PRECACHE_URLS、刪除 A3 network-only 特例**（金鑰載入不該依賴當下網路；翻譯本身需網路，但「離線開 App 其他頁」不該因 config 缺檔多一次網路失敗）。金鑰輪替生效路徑 = 改 config.js 內容＋bump CACHE_VERSION 部署（README 註明）。`index.html` 的 onerror 容錯與「缺檔不阻斷」保留（防禦縱深不拆） | SA 定案 → backend |
| 6 | `specs/SYSTEM_MAP.md` | config.js 條目標「gitignored」、依賴關係「sw.js 不含 config.js」、人工補充區「config.js 雙重排除」整條、隱私分層條目的 QA 掃描判準 | SA 於本 Task 流程內更新（人工補充區歸 SA 維護） | SA |
| 7 | `specs/INDEX.md` 頭部技術棧註記 | 「填入 js/config.js（gitignored）」 | PM 已於本次更新 | PM ✅ |
| 8 | QA 隱私掃描判準 | 「repo 內任何金鑰/個資都不得出現」的舊直覺 | **新判準（見下方驗收方式）：config.js 含 API 金鑰 = 合法；任何 tracked 檔出現個資真值 = FAIL** | QA（依本 spec） |
| 9 | 歷史存檔（Task1–4 各 spec/api/impact 內的「gitignored」語句） | 多處 | **不改寫存檔**——存檔是歷史紀錄；翻轉以本 spec 為權威定案，SYSTEM_MAP 為現況權威 | 無人（明確不做） |
| 10 | git 歷史 | config.js 從未被追蹤過 | 無歷史金鑰洩漏問題；首次 add 即現行（已限制的）金鑰，合法 | — |

**隱私界線改寫（repo 級永續約束，取代舊表述）：**
- `js/config.js` 現在**合法含 API 金鑰**並進 repo / 公開部署。
- **仍嚴禁任何個資進 config.js 或任何 tracked 檔**：護照、保單、姓名、手機、訂位代號等一律留 localStorage 本機層（`tokyotrip.privateData`，Task3 機制不變）。
- QA 三段式隱私掃描（工作樹 grep＋`TT1.` base64 解碼＋git log -p）照跑，只換判準：金鑰字串（`AIzaSy...`）在 config.js = PASS；個資真值在任何 tracked 檔 = FAIL。

---

## 功能規格

### 新增檔案（建議檔名，backend 可調整但須記入 `Task5.api.md`）

| 檔案 | 職責 |
|------|------|
| `js/api.js` | Google API 呼叫層（SYSTEM_MAP 既有規劃位）：翻譯函式（如 `App.api.translate(text, {source, target})` → Promise）、金鑰存在性檢查、錯誤分類（無金鑰/無網路/HTTP 錯誤）。**設計成 Task6 可重用**：翻譯函式與「金鑰/錯誤處理」通用邏輯分離，Task6 的 Vision OCR 呼叫將掛進同一檔 |
| `js/translate-tab.js` | 翻譯分頁：`App.registerTab('translate', { onShow })`、UI 事件、狀態管理（沿用 `*-tab.js` 命名慣例） |

規則（沿用既有契約，不重述細節）：
- 兩個新檔依 A2 SOP 加入 `PRECACHE_URLS` 並 bump `CACHE_VERSION`（**開工時實際值 +1**，現況 v9 → v10；config.js 若依 #5 定案入 PRECACHE 也在同一次 bump）。
- 載入順序：app.js 之後、`</body>` 之前；`api.js` 在 `translate-tab.js` 之前；兩者都在 tts.js/bigtext.js 之後（translate-tab 呼叫 `App.showBigText`/`App.speak`）。
- 路徑一律 `./` 相對（A5）；不修改 `js/app.js` 本體。

### translate 分頁 UI（frontend）

1. **輸入區**：多行 textarea＋方向切換（中→日 / 日→中，預設中→日）＋「翻譯」鈕。
   - textarea 計算字級 **≥16px**（iOS 聚焦自動縮放紅線，Task3 起既有約束）。
   - 方向切換為單一 toggle（點一下對調），當前方向清楚標示（如「中文 → 日文」）。
2. **結果區**：內嵌顯示翻譯結果（不做新 overlay），附三個動作鈕：
   - **大字**：叫 `App.showBigText({ ja: 結果, zh: 原文 })`——**僅中→日方向顯示此鈕**（大字是給日本店員看的；日→中結果是中文，無此需求）。
   - **播音**：叫 `App.speak(結果)`——**僅中→日方向顯示**；依 `App.speak.isAvailable` 決定 disabled。
   - **複製**：`navigator.clipboard.writeText`（github.io 為 HTTPS、localhost 皆 secure context）；成功給短暫回饋（如鈕文字變「已複製」），失敗靜默不彈窗。
3. **狀態顯示**：載入中（翻譯鈕 disabled＋「翻譯中…」）；各錯誤情境友善訊息（見邊界條件）。
4. 淺色主題一致：引用全域主題變數；文字用 `--c-accent` 場景須改用 `--c-accent-text`（Task8 對比紀律）。**不引用 `--fs-*` type scale 變數**（Task10 紀律：僅授權 `.trip-*`；translate 分頁字級硬編碼，收斂屬未來獨立 Task）。
5. `.tab-section` flex 紀律（Task11 教訓）：translate 分頁在 section 內放多個直接子元素（輸入區＋結果區），**非主捲動區的子元素必須 `flex-shrink: 0`**。

### 翻譯邏輯（backend）

1. 呼叫 Cloud Translation API v2：`https://translation.googleapis.com/language/translate/v2?key=<APP_CONFIG.GOOGLE_API_KEY>`，參數 `q`（原文）、`source`/`target`（`zh-TW` ⇄ `ja`）、`format=text`。
2. **必須用 POST**（不得用 GET）。三個理由，SA/QA 必驗：
   - sw.js fetch handler 只攔 GET——GET 會被 cache-first 動態回填，翻譯結果吃快取、金鑰進 cache 索引；
   - 避免長句撞 URL 長度限制；
   - POST 天然繞過 SW 快取，不需在 sw.js 加排除特例。
3. 回應解析：`data.translations[0].translatedText`；`format=text` 下無 HTML entity 問題。
4. 錯誤分類（api.js 回傳可辨識的錯誤型別/代碼，UI 據此顯示訊息）：
   - 金鑰未設定（`window.APP_CONFIG` 未定義或 `GOOGLE_API_KEY` 空）→ 不發請求，直接回「未設定」錯誤；
   - 無網路（fetch reject）；
   - HTTP 403（referer 不符/金鑰未授權——localhost 測試的預期結果）；
   - HTTP 429 / quota；
   - 其他 HTTP 錯誤（含 Google 回應體內的 error.message，可附註於訊息）。
5. 防連點：翻譯進行中再按翻譯鈕 no-op（或 disabled 已擋）。

### 業務規則

1. 方向預設**中→日**（主要使用情境：講給店員聽/看）。
2. 方向偏好記 localStorage：**新 key `tokyotrip.translateDir`**（值 `zh2ja` / `ja2zh`，壞值 fallback `zh2ja`，讀寫包 try/catch 私密瀏覽降級）——登記進 SYSTEM_MAP key 清單（SA）。
3. 輸入上限 **500 字**：超過即時提示「超過 500 字」且翻譯鈕 disabled，不截斷不送出（避免誤貼長文燒配額）。
4. 空輸入（或純空白）：翻譯鈕 disabled。
5. 語音只播日文結果，不播中文（沿用 Task2 規則；tts.js 是唯一 speechSynthesis 入口，不得繞過）。
6. `onShow` 冪等：重複進入分頁不得重複疊加 DOM；輸入框內容與結果在分頁切換間的保留策略由 backend 定（建議保留在記憶體，同 Task10 `_itinView` 模式，不進 localStorage）。
7. 不存翻譯歷史（見 Non-scope）。

### 邊界條件 / 錯誤處理（各情境的使用者可見訊息，文案 frontend 可潤飾但語意固定）

| 情境 | 訊息語意 |
|------|---------|
| 金鑰未設定/空 | 「尚未設定 Google API 金鑰」＋指引見 README |
| 無網路 | 「翻譯需要網路連線」（其他分頁離線照常，本頁明說需網路） |
| HTTP 403 | 「金鑰未授權此網址（本機測試屬正常，請在正式網址使用）」 |
| HTTP 429/quota | 「翻譯額度暫時用盡，稍後再試」 |
| 其他錯誤 | 「翻譯失敗，請重試」 |
| 結果為空字串 | 視為失敗，顯示「翻譯失敗，請重試」，不開大字（`showBigText` ja 空本為 no-op） |

任何錯誤都不得 throw 出未捕捉例外、不得阻斷分頁或其他功能。

### 驗收方式（QA）

**E2E 分工註記（拍板，QA 據此設計）**：金鑰有 referer 限制，agent 環境（localhost）實呼叫必得 403——**QA 不驗「實呼叫翻譯成功」**，驗邏輯與 mock；真翻譯 E2E 由 Olina 部署後在 iPhone（github.io）驗，列流程外驗收項。QA 若順手實呼叫收到 403，可記為「限制生效」的正向證據，非必測項。

- 固定迴歸：A5 grep 無絕對路徑；雙 reload 取新版；console 零 error；既有分頁（常用句/行程/折價券）照常；三分頁切換＋overlay 開關迴歸。
- 版控翻轉（靜態機械判準）：
  - [ ] `.gitignore` 不含 `js/config.js`；`git ls-files` 含 `js/config.js`。
  - [ ] `js/config.js` 內容僅 `window.APP_CONFIG = { GOOGLE_API_KEY: "..." }`（金鑰合法），**無任何個資真值**。
  - [ ] 隱私三段式掃描照跑，**新判準**：API 金鑰在 config.js = PASS；個資真值在任何 tracked 檔 = FAIL。
  - [ ] README / config.example.js 無「不會上傳 GitHub」「gitignored」殘句（依翻轉清單 #2–4）。
  - [ ] sw.js 符合 SA 對 #5 的定案（PRECACHE 名單、A3 特例移除與否、註解一致）；`CACHE_VERSION` 已 bump（v9→v10 或開工實際值+1）；新檔全進 PRECACHE。
- 翻譯邏輯（mock/stub fetch）：
  - [ ] 請求形狀：POST、URL 正確、key 來自 APP_CONFIG、`q`/`source`/`target`/`format=text` 正確；中→日 `zh-TW→ja`、日→中 `ja→zh-TW`。
  - [ ] 模擬成功回應：結果渲染；中→日顯示大字/播音/複製三鈕，日→中僅複製；大字叫 `showBigText({ja:結果, zh:原文})`；播音走 `App.speak`。
  - [ ] 模擬 403/429/斷網/金鑰置空：四種友善訊息各自出現、無未捕捉錯誤。
  - [ ] 空輸入與 >500 字：翻譯鈕 disabled；載入中防連點。
  - [ ] `tokyotrip.translateDir` 讀寫、壞值 fallback、私密瀏覽 try/catch。
  - [ ] onShow 冪等（重複切換 DOM 不疊加）。
  - [ ] textarea 計算字級 ≥16px；`--fs-*` 零越界至 translate 區塊；flex-shrink 紀律。
- 流程外（Olina，部署後 iPhone）：真翻譯成功、大字/播音實機手感、離線時其他頁照常＋翻譯頁訊息正確。

### 不在本次範圍（Non-scope，必填護欄）

- 不做拍照 OCR（Task6）——但 `api.js` 的翻譯函式與金鑰/錯誤處理設計成 Task6 可直接重用（本 spec 已授權此前瞻設計，不算越界）。
- 不做 GitHub Pages 部署自動化與真機驗收清單（Task7）；本 Task 不執行部署。
- 不碰行程/常用句/折價券既有邏輯（trip-tab/phrases-tab/coupons-tab/tripdata/phrases 零 diff）。
- 不把任何個資放進任何 tracked 檔（金鑰是唯一新的合法版控內容）。
- 不存翻譯歷史（要的話另開 Task）。
- 不做打字即譯（keystroke 即時觸發）——只做按鈕觸發，避免燒配額。
- 不用 Google Cloud TTS（Task2 拍板沿用 speechSynthesis）；不繞過 tts.js。
- 不做新 overlay（結果內嵌＋重用 bigtext；z-index 120+ 帶保留給未來需要者）。
- 不改 `js/app.js` 本體、不改分頁 id、不改 viewport meta。
- 不重寫歷史存檔（Task1–4 spec/api/impact 內的舊「gitignored」語句保留為歷史）。
- 不改 config.example.js 的存廢（保留、僅改註解）。
- 不動 `--fs-*` type scale 授權範圍（translate 字級硬編碼）。

---

> 本 spec 為純功能新增＋已拍板結構性決策落地，非完整性敏感問題，無診斷前置。
> SA 影響分析後補「影響範圍分析」區塊於此檔（另輸出 `Task5.impact.md`）。

---

## 影響範圍分析（SA，2026-07-12）

> 全文見 `Task5.impact.md`；本節為摘要。涉及範圍：後端＋前端皆有。

### SA 定案（spec 授權裁決項）
1. **翻轉清單 #5（sw.js A3）定案：config.js 進 PRECACHE_URLS、刪除 fetch handler A3 network-only 特例整段（L98–109）＋檔頭禁止項/NOTE 註解**。金鑰輪替生效路徑＝改內容＋bump CACHE_VERSION＋部署（README 註明，含「輪替過渡期舊金鑰 403、reload 兩次恢復」語意）。index.html 的 onerror 容錯與 A4「APP_CONFIG 未定義合法」契約保留。SA 補強理由：config 不進 PRECACHE 時，離線會落「未設定金鑰」誤導訊息而非「需要網路」。
2. **翻轉掃描新增一項 spec 未列殘留（#11）**：`js/config.js` 自身檔頭註解仍寫「已被 .gitignore 排除，不會上傳」——即將公開部署的檔案自稱不上傳，必改（backend）。除 impact.md 一、表列各項外，活文件無其他殘留。
3. `Task1.api.md` L100/L124 的舊 A3 禁令屬歷史存檔不改寫（#9），但 backend 必須在 `Task5.api.md` 開「A3 改版宣告」節明文廢止，防下游冷 context 誤守。

### 受影響的既有功能
| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| SW 離線快取全站 | sw.js | PRECACHE +3（config/api/translate-tab）、v9→v10、刪 A3 特例 | ✅ 含冷 install 離線驗證 |
| 既有三分頁 | phrases/trip/coupons | 零 diff；bump 重下全量（含 18 券圖）已知成本 | ✅ 切換＋overlay 迴歸 |
| 大字/語音 | bigtext.js / tts.js | 零 diff，新消費者；契約相容已確認 | ✅ |
| 腳本鏈 | index.html | +2 script（既留插入點：trip-tab 後、coupon-viewer 前）；config.js onerror 保留 | ✅ |
| git 版控 | .gitignore / config.js | config.js 首次入 repo，隱私判準翻轉 | ✅ 三段式新判準 |

### POST 攔截確認（Task6 前向約束）
sw.js 現況 POST 一律 `return` 直通（method 檢查），不進 cache-first、不回填；刪 A3 特例後不變——**不需**為 googleapis 加排除。但「必須 POST」是硬約束：GET 呼叫會被動態回填段 cache.put（200 CORS 回應也回填）→ 金鑰進 cache 索引＋結果固化。Task6 Vision（POST）同此結論，已登記 SYSTEM_MAP 人工補充區。

### api.js Task6 重用邊界
三層分離：金鑰層（可選鏈檢查）／傳輸層（POST 封裝＋錯誤碼枚舉 `NO_KEY/OFFLINE/HTTP_403/HTTP_429/HTTP_OTHER`，Google 錯誤體格式兩 API 相同）／端點層（`App.api.translate`；Task6 加 `App.api.ocr` 不動上兩層）。掛 `window.App.api`；不含 TTS、不碰 DOM/localStorage。簽名與枚舉記入 `Task5.api.md`。

### QA 隱私判準（翻轉後定義）
三段式掃描照跑；**PASS**＝`AIzaSy...` 金鑰在 `js/config.js`（唯一合法位置，出現在其他 tracked 檔回報 PM）；**FAIL**＝個資真值在任何 tracked 檔。其餘機械判準與行為清單見 `Task5.impact.md` 九（含：`git check-ignore js/config.js` 無輸出、v10、POST-only grep、「APP_CONFIG 存在＋fetch reject 必須出『需要網路』」）。

### 縫隙補完（backend 落實、api.md 記載）
方向切換時清空結果區（防舊結果配錯方向鈕）；輸入上限計法建議 `text.length`；分頁狀態記憶體保留不進 localStorage；`tokyotrip.translateDir` 已登記 SYSTEM_MAP key 清單。
