# Task18 — 文字翻譯「加入常用語」（加入時選分類，併入既有分類顯示）

> 狀態：待 SA 影響分析
> 修訂：2026-07-13 PM 依 Olina 補充需求改版——原「單一 mine chip」設計取消，改為加入時手選分類、自訂句併入該分類顯示（SA 未開工前修訂，安全）
> 前置：Task5（文字翻譯）✅、Task8（常用句 chips 導覽）✅、Task17 閉環（現況 v17）
> 佇列：Task7（最終驗收）之前

## 模組：翻譯分頁（文字模式）＋常用句分頁＋新儲存模組

### 功能描述

文字模式中→日翻譯完成後，可把 `{中文原文, 日文譯文}` 加入常用語——**加入時由使用者手選要放進哪個既有分類**（六分類之一）；自訂句顯示在該分類 chip 底下，與內建句同列，帶視覺標記與刪除鈕，可播放（TTS）、大字、刪除。

### 背景與已拍板決策（不重議）

- 已完成：17 個 Task 全閉環，六分頁全落地，現況 v17。翻譯分頁有文字（Task5）/對話（Task12/15）雙模式。
- Olina 用法：臨時遇到的簡單句子，翻一次存起來，之後在常用句分頁重播給日本人聽；要對談才用對話模式。
- 已拍板：
  - 入口**只在文字模式的中→日結果**（日→中結果是給她自己看的，v1 不做加入；對話模式零變更）。
  - 儲存走 **localStorage**（`window.PHRASES` 是靜態打包資料，執行期不可改、本輪零 diff）。
  - **加入時使用者手選分類**（既有六分類之一）——自動分類不做：APP 為離線靜態、無 AI 即時判斷，關鍵字猜不準，以「使用者手選、最可靠」為準。
  - 自訂句**併入所選分類的 chip 底下顯示**（與內建句同列，視覺標記區分＋刪除鈕）。原「單一 mine chip」設計取消（2026-07-13 Olina 拍板改版）；不另設「全部我的」總覽 chip（理由見 C1）。
- SA/backend/frontend 不得重開已拍板方向；有疑慮記入回報交 PM。

### 涉及範圍

- [x] 後端／核心邏輯（新儲存模組 `js/my-phrases.js`、translate-tab 加入邏輯、phrases-tab 併分類渲染、sw.js/version.js bump）
- [x] 前端／UI（加入鈕、分類選擇列 chips、自訂句視覺標記、刪除鈕與排版——真 CSS 工作，非輕量）

---

## A. 儲存設計（backend，新檔 `js/my-phrases.js`）

### A1. localStorage key（新增登記）

| Key | 值 | 說明 |
|-----|----|------|
| `tokyotrip.myPhrases` | JSON 陣列字串 | 使用者自訂常用語（本 Task 新增） |
| `tokyotrip.phrasesCat` | 分類 id | **值域維持既有六分類 id，本輪零變更**（原修訂前草案曾擴充 `'mine'`，已取消） |

陣列元素 schema：

| 欄位 | 型別 | 說明 | 必填 |
|------|------|------|------|
| zh | string | 中文原文（trim 後） | 是 |
| ja | string | 日文譯文 | 是 |
| romaji | string | 羅馬拼音——**本輪恆為空字串**（Google 翻譯無此來源；欄位保留給未來） | 否 |
| catId | string | 所屬分類 id，**必為六分類之一**：`greetings`/`dining`/`shopping`/`transport`/`hotel`/`emergency`（與 phrases.js 現況核對一致） | 是 |
| ts | number | 加入時間 `Date.now()`（排序/除錯用） | 是 |

### A2. 模組契約 `App.myPhrases`

比照 `import-data.js`／`tts.js` 封裝紀律：**localStorage 讀寫只在本模組內**，translate-tab / phrases-tab 一律經此 API，不得自行 `localStorage.getItem('tokyotrip.myPhrases')`。

- `isAvailable()` → boolean（localStorage 可用性測試，可比照 import-data.js 的 `_tt_test` 手法）
- `getAll()` → 陣列（**新→舊排序**；壞資料見 A4）
- `getByCat(catId)` → 陣列（該分類的自訂句，新→舊；phrases-tab 渲染用主入口）
- `add({zh, ja, catId})` → `{ok:true}`｜`{ok:true, duplicate:true}`（已存在，不重複寫）｜`{ok:false}`（儲存失敗或 catId 非法）
- `remove(zh, ja)` → 刪除 zh+ja 全等的那一筆；回 boolean

實作紀律：

1. 新增放**陣列最前**（顯示即新→舊，剛存的最好找）。
2. 去重判準（**PM 定案**）：`zh`（trim 後）與 `ja` **雙欄全等**即重複，**跨分類亦然**（catId 不參與去重）——避免同一句重複散落多類。重複時**不寫入、不搬家**（原句留在原 catId），回 `duplicate`；只同 zh 不同 ja 視為兩筆（重翻結果可能不同，皆保留）。
2a. `catId` 驗證：非六分類 id 之一 → 不寫入，回 `{ok:false}`（防禦性；正常 UI 流程給不出非法值）。
3. 讀寫全包 try/catch（私密瀏覽降級）；**清除只准 `removeItem` 自己的 key，禁 `localStorage.clear()`**（repo 級鐵律）。
4. v1 不設筆數上限（旅行用量小；單句長度天然受翻譯 500 字上限）。
5. 純資料層：不碰 DOM／API／TTS。

### A3. 載入順序與快取

- `index.html`：`<script src="./js/my-phrases.js">` 插在 **bigtext.js 之後、phrases-tab.js 之前**（兩個消費者 phrases-tab / translate-tab 皆在其後）。
- `sw.js`：`PRECACHE_URLS` 加 `./js/my-phrases.js`（41→42 筆）。
- 缺載防禦：兩個消費者呼叫前檢查 `App.myPhrases` 存在，缺載時等同「不可儲存」降級，不壞頁。

### A4. 壞資料處理

`getAll()`／`getByCat()` 遇 JSON parse 失敗、非陣列、元素缺 zh 或 ja、**catId 非六分類 id 之一** → 該筆（或全部）視為不存在，回傳合法子集或 `[]`；下次 `add` 以合法內容覆蓋整個 key。不彈錯誤、不壞頁。（本功能 v18 首發，無舊版無 catId 資料的相容問題——缺 catId 一律視為壞資料即可。）

---

## B. 翻譯分頁「加入常用語」（backend＋frontend）

### B1. 位置與可見性

- 新按鈕加在文字模式結果動作列 `.translate-result-actions`（現有：大字／播音／複製），class `translate-action-btn translate-addphrase-btn`，文字「加入常用語」。
- **只在 `zh2ja` 方向顯示**——併入既有 `_updateActionBtns()` 的方向控制（與大字/播音鈕同進退）；`ja2zh` 隱藏。
- **Task5 文字模式既有 16 單元行為零 diff**：只增不改（新增按鈕與其 handler；`_updateActionBtns` 允許 additive 擴充一行 display 控制）。

### B2. 行為（含分類選擇）

1. 點擊時無 `_lastResult` → return（比照複製鈕守門）。
2. 點「加入常用語」**不直接存**，而是就地展開**分類選擇列**（見 B2a）；使用者點選分類後才呼叫 `App.myPhrases.add({zh: _lastInput, ja: _lastResult, catId: 所選分類})`。
3. 回饋一律用**按鈕文字暫時替換**（比照複製鈕「已複製」模式，1.5s 後恢復，不做新 overlay/toast）：
   - 成功 → 「已加入」
   - `duplicate` → 「已在常用語」（原句留在原分類，不搬家）
   - 失敗或 `App.myPhrases` 缺載／`isAvailable()===false` → 「無法儲存」
4. 加入後不清空輸入、不跳分頁（她可能還要繼續翻）。

### B2a. 分類選擇 UI（PM 定案）

- 形式：**就地展開的 inline chips 列**（六分類，顯示中文分類名，樣式沿用常用句分頁 chip 視覺），插在結果動作列下方；**不做 overlay/彈窗**（repo 有 overlay 與 z-index 紀律，inline 最省事也最穩）。
- 互動：點某分類 chip → 立即存入該 catId、選擇列收合、按鈕回饋（B2-3）。再點一次「加入常用語」或點選擇列外 → 收合＝取消，不存。
- **預設值（PM 定案）**：預設高亮「**本 session 上次選的分類**」（模組內變數記憶，不新增 localStorage key）；session 內尚未選過則預設 `dining`（旅途主場景是點餐連續翻譯）。高亮只是視覺引導，仍需點選才存——不做「點加入鈕直接存進預設類」的捷徑，防誤存錯類。
- 切換翻譯方向、輸入新內容重翻、或切分頁時，展開中的選擇列一律收合。

### B3. 樣式（frontend）

- 動作列現為 4 顆鈕：沿用 `translate-action-btn` 基底（≥44px 觸控目標）；放不下時允許 `.translate-result-actions` 換行（flex-wrap），不得壓縮按鈕高度。
- **分類選擇列**：六 chips 允許換行（flex-wrap），每顆 ≥44px 觸控目標；預設高亮態要與選中態視覺可分（如描邊 vs 實底）。展開/收合不得推擠結果區跳動過劇（自然文檔流即可，不做動畫也行）。
- 字級硬編碼，**禁用 `--fs-*`**（type scale 只授權 `.trip-*`，永續紀律）。

---

## C. 常用句分頁：自訂句併入所選分類（backend＋frontend）

### C1. 呈現原則（取代原「mine chip」設計）

- **不新增任何 chip**：chips bar 維持既有六分類、原順序，零改動。自訂句顯示在它 `catId` 對應的分類 chip 底下，與內建句同一清單。
- **不保留「全部我的」總覽 chip（PM 定案）**：v1 不做。理由——同一句出現在兩處（總覽＋分類）會造成刪除與重繪雙路徑、增加冪等面積；Olina 的使用場景是「到了餐廳點開用餐分類」，按分類找即符合動線。若旅途中實際感到需要總覽，登錄 BACKLOG 後續補（純 additive，不影響本輪結構）。
- 空分類不渲染 chip 的既有行為維持（判準變為「內建句＋該類自訂句皆空」；現況六分類內建皆非空，故實際上 chips 恆全顯）。
- `tokyotrip.phrasesCat` 值域維持六分類 id，初始分類與 fallback 鏈（transport → `PHRASES[0]`）**零改動**。

### C2. 清單渲染與互動

- 每個分類的清單 ＝ **該類自訂句（新→舊）在最前** ＋ 內建句（原順序）在後。
  - 排序定案理由：剛存的句子最好找（與 A2「新增放最前」一致），且自訂句連續成塊、視覺標記不散落。
- 自訂句列表項：
  - 句子本體（沿用 `.phrases-item-body`）：zh＋ja（romaji 空——沿用既有 `item.romaji || ''` 渲染即可）；點擊 → `App.showBigText({ja, zh})`。
  - 播放鈕（沿用 `.phrases-speak-btn`）：`App.speak(ja)`（預設 ja-JP，零簽名變更）。
  - **視覺標記**（新 class `.phrases-item-mine`）：與內建句可辨識區分——建議「自訂」小標籤＋淺色底（實作樣式 frontend 定，但必須同時滿足：不靠顏色單獨傳達、標記不壓縮句子可讀區）。
  - **刪除鈕**（新 class `.phrases-delete-btn`，🗑 或 ✕，≥44px）：點擊 → 原生 `confirm('刪除這句常用語？')` → 確定則 `App.myPhrases.remove(zh, ja)` 並重繪當前分類清單。
- **內建句列表項渲染零 diff**：不長刪除鈕、不帶自訂標記、順序內容不變。
- 自訂句渲染一律 `textContent`（防注入——內容來自使用者輸入＋API 回應）。

### C3. 冪等與跨分頁刷新（結構重點，SA 重點複核項）

現況 `phrases-tab.js` 的 onShow 是「`_initialized` 後純 no-op」——**本輪必須擴充**，否則在翻譯分頁加句後切回常用句分頁看不到：

- shell（chips bar＋list area）仍只建一次，不疊 DOM；chips 集合恆為六分類，onShow 不增刪 chip。
- 每次 onShow：**重繪當前分類清單**（自訂句可能已從翻譯側增加）。重繪冪等——清空 list area 後重建，不疊 DOM。
- 內建六 chips 與內建句渲染路徑不受此擴充影響（機械判準見 F）。

### C4. localStorage 不可用（私密瀏覽）降級

- `getByCat()` 回 `[]` → 各分類只顯示內建句，與現況完全相同。
- 翻譯側加入鈕回饋「無法儲存」（B2）。
- 全程不彈錯、不壞頁。

---

## D. 版號 bump（兩檔三行 SOP，repo 級永續紀律）

- `sw.js` `CACHE_VERSION`：開工時實際值 +1（現況 **v17→v18**）。
- `js/version.js` `APP_VERSION` 同步（與 CACHE_VERSION **逐字元相等**＝QA 機械閘）＋ `APP_VERSION_DATE` 更新為 bump 當天（MM/DD，台灣時區）。
- `PRECACHE_URLS` 加 `./js/my-phrases.js`（41→42）。
- 版號字串不得出現在其他任何檔（含註解）。

## E. 業務規則彙總

1. 自訂常用語唯一入口＝文字模式中→日翻譯結果（v1）。
2. 加入時**使用者手選分類**（六分類之一）；自動分類不做。預設高亮＝本 session 上次選的分類，初值 dining。
3. 去重＝zh(trim)＋ja 雙欄全等，**跨分類同句即重複**（catId 不參與判準）；重複不寫入、不搬家。
4. 顯示＝自訂句併入所屬分類，排該類最前（新→舊），帶自訂標記＋刪除鈕。
5. 靜態 `PHRASES` 與六分類 id 永不因本功能變動。
6. 刪除需 confirm 確認，防誤觸（旅途中戴著行李單手操作）；刪除鈕只自訂句有。

## F. QA 機械判準（backend 完成時逐項可驗）

1. `js/version.js` APP_VERSION === `sw.js` CACHE_VERSION === `'v18'`；APP_VERSION_DATE 為 bump 當天。
2. PRECACHE_URLS 42 筆且含 `./js/my-phrases.js`；index.html 載入順序 bigtext.js < my-phrases.js < phrases-tab.js。
3. `tokyotrip.myPhrases` 讀寫只出現在 `js/my-phrases.js`；全 repo `localStorage.clear()` 出現次數 = 0；`tokyotrip.phrasesCat` 相關程式零 diff。
4. translate-tab.js：Task5 既有 16 單元零 diff（加入鈕、分類選擇列與 `_updateActionBtns` additive 擴充除外，diff 逐行可解釋）；對話模式區塊零 diff。
5. phrases-tab.js：chips bar 恆為六分類原順序（無新增 chip）；**內建句列表項渲染零 diff**（不長刪除鈕、無自訂標記）；自訂句只出現在其 catId 對應分類、排該類最前；onShow 重複呼叫不疊 DOM，且翻譯側加句後切回可見（冪等擴充生效）。
6. 方向 ja2zh 時加入鈕不可見；zh2ja 顯示。分類選擇列：點加入展開、點分類存入收合、再點加入或點外部收合不存。
7. 去重：同 zh+ja 連加兩次（**含第二次選不同分類**），storage 僅一筆、catId 維持第一次所選，且第二次回饋「已在常用語」。
8. 壞資料注入（key 塞非 JSON／非陣列／元素 catId 非法）→ 分頁不壞、只渲染合法子集（或視同無自訂句）。
9. wrap 鏈維持四層零 diff；無新 overlay；無新增 z-index ≥100；`var(--fs-` 不出現在非 `.trip-*` 規則。
10. 隱私三段式照常（本輪無個資面，但屬每輪必跑）。

## G. 不在本次範圍（Non-scope，護欄）

- 不碰對話／即時翻譯模式（translate-tab 對話區塊零 diff）。
- 不改靜態 `PHRASES` 六分類內容與 id（phrases.js 零 diff）。
- **不做自動分類**（無 AI 即時判斷、關鍵字猜不準——已拍板手選）。
- 不做「全部我的」總覽 chip（v1 不做，需要時登 BACKLOG 後補）。
- 不做手動輸入新增常用語（入口只從翻譯結果；純手動新增留後續 Task）。
- 不做日→中結果的加入（v1 只中→日）。
- 不做編輯（只增/刪）、不做排序調整、不做匯出/雲端同步。
- 不碰行程／折價券／地圖／拍照分頁。
- 不改任何既有 localStorage key 的 schema 與值域（lastTab/privateData/phrasesCat 全部零變更；本輪唯一新 key 為 `tokyotrip.myPhrases`）、不動 `App.showTab` wrap 鏈、不改 viewport/全域主題。

## H. 分工

- **backend**：`js/my-phrases.js` 新檔（A 全節，含 `add({zh, ja, catId})`／`getByCat`）、translate-tab.js 加入鈕＋分類選擇邏輯（B1/B2/B2a）、phrases-tab.js 併分類渲染與 onShow 冪等擴充（C 全節）、index.html script 插入、sw.js/version.js bump（D）。完成必寫 `Task18.api.md`（App.myPhrases 契約、key 登記、新 DOM class 清單：`.translate-addphrase-btn`、分類選擇列、`.phrases-item-mine`、`.phrases-delete-btn`）供 frontend/後續 Task。
- **frontend**：加入鈕與動作列換行、分類選擇列 chips 樣式（B3/B2a——真 CSS 工作）、自訂句視覺標記與刪除鈕排版（C2，觸控 ≥44px、flex-shrink 紀律、淺色主題、禁 `--fs-*`）。
- 真機手感（加入→切分頁→重播全流程）由 Olina 部署後流程外驗，一併整併進 Task7 行前檢查清單。

---

## 影響範圍分析（SA）

> 全文見 `Task18.impact.md`（2026-07-13，基線 v17 已機械核對：兩檔版號逐字元相等、PRECACHE 41 筆、六分類 id 與 phrases.js 實讀一致）。以下為摘要。
> **權威版本澄清**：`Task18.ready` 與 INDEX.md 開工註記為修訂前（mine chip）文字，一律以本 spec 修訂版為準（impact §0）。

### 受影響的既有功能
| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| Task5 文字翻譯 16 單元 | translate-tab.js 文字模式 | additive 白名單 4＋1 位點（impact §2.1 A–E），其餘零 diff | ✅ |
| Task12/13/15/16 對話模式 | translate-tab.js 對話區塊 | 零 diff（僅 wrap 內 additive 一行收合；`_onMicClick`/G4/`_abortTalk` 不動） | ✅ |
| Task8/9 常用句 chips 導覽 | phrases-tab.js | onShow 契約擴充（no-op→每次直達重繪當前分類，禁走 `_selectCat`）＋`_renderListArea` 併自訂句；chips shell/`phrasesCat`/六 id 零變更 | ✅ |
| Task2 大字/播音契約 | App.showBigText / App.speak | 新呼叫點，零簽名變更；自訂句播放鈕比照內建守 `ttsAvailable` | ✅（輕） |
| Task14 版號/SW | sw.js / version.js | 兩檔三行 v17→v18、PRECACHE 41→42；app.js 零 diff | ✅（機械） |

### Backend 注意事項
- translate-tab.js 只准動 impact §2.1 白名單：A `_buildDOM` 新增鈕＋選擇列、B `_updateActionBtns` 一行、C `_clearResultArea` 尾行收合（覆蓋方向切換＋重翻）、D showTab wrap 一行收合（切分頁）、E `_switchMode` 一行收合（SA 補定案，spec B2a 漏列）。session 分類記憶＝closure 變數初值 `dining`，不新增 localStorage key。
- 點外收合 listener：展開掛/收合卸、closest 守門、防開啟點擊立即誤收；duplicate 路徑也收合＋回饋「已在常用語」。
- phrases-tab onShow 擴充：`已初始化 → _renderListArea(_findCatById(_currentCatId))` 直達重繪（app.js 實讀確認 onShow 每次切換含重按都觸發；`_renderListArea` 整塊重建天然冪等）。`_buildShell`/`_getInitialCat`/`_saveCat`/`_selectCat` 零 diff。
- `_buildShell` 空分類判準維持現碼（SA 定案）：六內建分類皆非空（4/9/9/6/5/6）→ chips 恆全顯，與 C1 一致；「僅自訂句的空內建分類」為理論情境，限制已記 SYSTEM_MAP 人工補充區。
- my-phrases.js：catId 用**靜態六 id 白名單**（不執行期讀 PHRASES，零依賴）；`isAvailable` 比照 import-data.js `_tt_test`；`remove` 內部 zh trim 防禦；v1 無「全部清除」API。

### Frontend 注意事項
- 動作列第 4 顆鈕沿用 `.translate-action-btn` ≥44px、動作列 flex-wrap；選擇列六 chips flex-wrap ≥44px、預設高亮態與選中態視覺可分（描邊 vs 實底）、自然文檔流無 overlay、無新增 z-index ≥100。
- `.phrases-item-mine` 標記不靠顏色單獨傳達；`.phrases-delete-btn` ≥44px 只自訂句有；字級硬編碼禁 `var(--fs-*)`；文字色用 `--c-accent-text`。

### QA 迴歸測試清單
- [ ] spec §F 機械判準 1–10（F3 的 `localStorage.clear()`=0 **按執行呼叫計**——import-data.js 有 2 處既有註解提及禁用字樣，純文字 grep 誤 FAIL，impact §8-8）
- [ ] Task8/9：六分類切換、phrasesCat 記憶/fallback、內建句渲染零 diff、phrases.js 零 diff
- [ ] Task5：16 單元（方向/上限/防連點/五錯誤/大字/播音/複製）
- [ ] Task12/13/15/16：面對面對話、雙向自動播 G4＋150ms 守門、unlock 全檔恰一處、wrap 四層
- [ ] 跨分頁：加句選分類→切常用句可見（排該類最前帶標記）→confirm 刪除→消失；重按當前分頁不疊 DOM
- [ ] 去重跨分類（第二次選不同分類仍一筆不搬家）、壞資料注入、無痕降級、離線冷 install（42 筆）
- 新功能由 QA 依 spec §F 驗收；真機全流程歸 Olina 流程外（併 Task7 清單）。
