# Task2 規格 — 旅遊常用句 + 大字展示 + 日文語音播放

## 模組：常用句分頁（phrases）＋ 兩個跨 Task 共用元件（大字展示、日文語音）

### 功能描述
在 `phrases` 分頁顯示離線常用句庫，點任一句可「放大成全螢幕大字給店員看」與「播放日文語音」，三者皆離線可用；大字展示與語音播放做成共用元件，供 Task5（翻譯）、Task6（OCR）重用。

### 背景與已拍板決策（不重議）
給冷 context 下游的最小背景。SA/backend/frontend 不得重開已拍板的討論——有疑慮記入回報交 PM，不自行改走別條路。

- 已完成：Task1 PWA 骨架已 QA PASS 閉環。分頁框架契約在 `Task1.api.md`（A1 分頁 id、A2 sw.js 版本 bump SOP、A5 相對路徑、A6 腳本載入順序、A7 z-index 層級、A8 localStorage 前綴），前向約束在 `Task1.impact.md`。
- 已拍板：**日文語音用 iOS 內建 Web Speech API（`speechSynthesis`，`lang='ja-JP'`）——免費、離線、免金鑰。不使用 Google Cloud TTS。** 理由：旅遊現場常沒網路，離線也要能發音給店員聽。
- 已拍板：語音必須由使用者手勢觸發（iOS 限制）；點擊播放鈕即符合，不做自動播放。
- 已拍板：句庫資料採用既有 `js/phrases.js`（`window.PHRASES`，六分類，每句 `{zh, ja, romaji}`），**內容與結構不改**；之後要加句子是資料維護，不屬本 Task。

### 涉及範圍
- [x] 後端（核心邏輯層：TTS 封裝、大字元件邏輯與對外 API、sw.js 預快取更新、`Task2.api.md`）
- [x] 前端（UI 層：常用句分頁畫面、大字 overlay 視覺、iOS 排版與觸控細節）

### 新增檔案（建議，backend 可調整檔名但須記入 Task2.api.md）
| 檔案 | 職責 |
|------|------|
| `js/tts.js` | 日文語音共用模組：`speak(ja)`、voices 非同步載入、降級判斷 |
| `js/bigtext.js` | 大字展示共用元件：全螢幕 overlay 的建立/開關與對外 API |
| `js/phrases-tab.js` | 常用句分頁：讀 `window.PHRASES` 渲染、掛 `App.registerTab('phrases', …)` |

規則：
- 新增的每個 js 檔，backend **必須依 A2 SOP** 加入 `sw.js` 的 `PRECACHE_URLS` 並 bump `CACHE_VERSION`（Task1.api.md A2）；路徑一律 `./` 相對（A5）。
- 腳本插入位置：**app.js 之後、`</body>` 之前**（A6）。共用模組（tts.js、bigtext.js）在 phrases-tab.js 之前載入。
- 共用 API 掛法：往既有 `App` 物件補掛屬性（如 `App.speak`、`App.showBigText`）或獨立全域（如 `window.TTS` / `window.BigText`），由 backend 定案；**不得修改 `js/app.js` 檔案本身**——新模組在 app.js 之後載入、自行補掛即可。

### 共用介面（跨 Task 契約——本 Task 的核心產出之一）
以下是 PM 層級的介面意圖；**實際簽名由 backend 定案並寫進 `Task2.api.md`**，定案後 Task5/6 直接引用，不得再改名。

1. **大字展示元件**（Task5 翻譯結果、Task6 OCR 結果都要叫它）：
   ```js
   App.showBigText({ ja, zh, romaji })   // zh、romaji 可缺（Task6 的 OCR 原文可能只有 ja）
   ```
   - 全螢幕 overlay，`z-index ≥ 100`（蓋過底部導覽列，A7 已預留）。
   - 主體：超大日文字（給店員看的主角）；下方小字：中文 + 羅馬拼音（有才顯示）。
   - overlay 內含「播放語音」鈕（叫共用 `speak`）與「關閉」鈕。
   - 必須設計成**與分頁無關的獨立元件**：任何分頁、任何時刻呼叫都能開，關閉後回到呼叫前的畫面狀態。

2. **日文語音共用函式**（Task5 翻譯結果也要叫它）：
   ```js
   App.speak(jaText)   // 或等價簽名，backend 定
   ```
   - 內部用 `speechSynthesis` + `SpeechSynthesisUtterance`，`utterance.lang = 'ja-JP'`。
   - 開播前先 `speechSynthesis.cancel()`（防連點排隊疊音）。
   - 提供可用性查詢（如 `App.speak.isAvailable()` 或等價方式），讓 UI 決定播放鈕顯示狀態。

### 業務規則
1. 常用句分頁依 `window.PHRASES` 的六分類分組顯示，順序照資料檔；每句顯示中文（主）＋日文＋羅馬拼音。
2. 每句提供兩個動作：
   - 點**句子本體** → 開大字展示 overlay（主要使用情境：拿給店員看）。
   - 點句子右側的**播放鈕**（喇叭 icon 等）→ 直接播日文語音，不開 overlay。
   - 大字 overlay 內也有播放鈕（拿給店員看的同時播音）。
3. 語音只播日文（`ja` 欄位），不播中文、不播羅馬拼音。
4. voices 非同步載入處理：iOS 的 `speechSynthesis.getVoices()` 首次呼叫常回空陣列，須監聽 `voiceschanged` 事件更新；選 voice 時優先取 `lang` 以 `ja` 開頭者；**即使 voices 清單裡找不到 ja 語音，仍以 `utterance.lang='ja-JP'` 嘗試播放**（iOS 常能由系統挑選），不得因清單為空就直接放棄。
5. 降級規則（按序）：
   - `window.speechSynthesis` 不存在 → 所有播放鈕顯示為不可用（disabled + 簡短提示，如「此裝置不支援語音」），大字展示照常可用，**不得 throw、不得阻斷分頁**。
   - speechSynthesis 存在但播放無聲/失敗 → 不做錯誤彈窗轟炸；UI 保持可再點。
6. 分頁掛載走 `App.registerTab('phrases', { onShow })`（Task1.api.md A1）；渲染結果可快取，`onShow` 每次切換都會觸發，重複進入不得重複疊加 DOM。
7. 大字 overlay 開啟時鎖定背景捲動；關閉（關閉鈕）後解鎖並回復原畫面。關閉鈕觸控目標 ≥ 44px。
8. 全部功能離線可用：斷網狀態下常用句、 大字、語音三者皆正常（語音靠裝置內建語音包；QA 環境若無日文語音包，驗降級路徑即可，真機語音由 Olina 流程外驗）。

### 邊界條件 / 錯誤處理
- `window.PHRASES` 未定義或為空 → 分頁顯示「句庫載入失敗」文字，不 throw、不影響其他分頁。
- 超長句子（如「附近有醫院／藥局嗎？」）在大字模式：允許換行；字級策略（固定大字＋換行，或依長度縮放）由 frontend 定，但**最長句不得溢出螢幕**（直式 iPhone）。
- 連續快速點播放：後點的取消先前發音（`cancel()` 再 `speak()`），不排隊。
- overlay 開啟中切換分頁（程式化或使用者操作）：overlay 屬全域層，行為由 backend 定案記入 Task2.api.md（建議：切分頁時自動關閉，狀態最單純）。
- 本 Task 不使用 localStorage；若 backend 認為需要（如記住最後分類），須用 `tokyotrip.` 前綴（A8）並記入 Task2.api.md。

### 驗收方式（QA）
- Task1 固定迴歸項照跑：A2（bump 後雙 reload 取新版、舊快取名刪除）、A5（grep 無 `/` 開頭絕對路徑）、config.js 缺檔無錯。
- 本次新驗：
  - [ ] 新增 js 檔全部進 `PRECACHE_URLS`、`CACHE_VERSION` 已 bump。
  - [ ] 斷網 reload 後：常用句分頁完整渲染、大字 overlay 可開可關。
  - [ ] 大字 overlay 蓋過底部導覽列（z-index ≥ 100）、關閉鈕 ≥ 44px、最長句不溢出。
  - [ ] 播放鈕觸發 `speechSynthesis.speak`（QA 環境有日文語音則驗有聲；無則驗呼叫路徑與不拋錯）。
  - [ ] 模擬 `speechSynthesis` 不存在（stub 移除）：播放鈕呈不可用、頁面無未捕捉錯誤。
  - [ ] `window.PHRASES` 置空模擬：分頁顯示失敗文案、其他分頁正常。
  - [ ] 重複切換分頁多次：DOM 不重複疊加。
  - [ ] 共用 API 已記入 `Task2.api.md`（簽名、掛載點、Task5/6 呼叫範例）。
- iPhone 真機語音／加主畫面驗收由 Olina 在流程外做（INDEX.md 既定分工）。

### 不在本次範圍（Non-scope，必填護欄）
- 不做中⇄日翻譯（Task5）、不做拍照 OCR（Task6）——大字與語音元件只做到「可被它們呼叫」，不實作它們的頁面。
- 不做行程頁（Task3）、不做折價券頁（Task4）。
- 不接任何網路 API（本 Task 全離線；`js/api.js` 不建）。
- 不改 `js/phrases.js` 的資料內容與結構（採用不改；欄位擴充需另議）。
- 不修改 `js/app.js` 檔案與 `Task1.api.md` 既定介面（共用 API 以外掛方式補上）。
- 不動 sw.js 的快取策略本體——只允許依 A2 SOP 改 `PRECACHE_URLS` 與 `CACHE_VERSION` 兩個常數。
- 不碰 manifest、icons、config.example.js、.gitignore。
- 不提前做 GitHub Pages 部署（Task7）。

---

## 影響範圍分析（SA）

> 完整版見 `specs/Task2.impact.md`（B1–B7 前向約束、Backend/Frontend 注意事項、QA 迴歸清單）。涉及範圍：後端＋前端 → pipeline 走完整 backend → frontend → QA。

### 受影響的既有功能
| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 分頁框架 | js/app.js（不改本體） | registerTab 掛載；「切分頁關 overlay」須外掛 wrap `App.showTab`（impact B2） | ✅ |
| 離線快取 | sw.js | 3 新檔入 PRECACHE_URLS＋bump v1→v2（A2），只動兩常數 | ✅ |
| App shell | index.html | 腳本插 app.js 後：tts.js → bigtext.js → phrases-tab.js（A6） | ✅ |
| 樣式層級 | css/style.css | overlay z-index 100 即可，骨架已預留（A7），不改骨架 CSS | ✅ |
| 句庫資料 | js/phrases.js | 唯讀消費，不改 | ❌ |

### 關鍵前向約束（Task5/6 返工風險，詳見 impact.md）
- **B1** overlay 必須直接掛 `document.body`（section 有 hidden＋overflow 裁切，掛錯跨分頁獨立性即壞）。
- **B2** 切分頁自動關閉的唯一合法路徑＝外掛 wrap `App.showTab`；wrap 行為須文件化成契約。
- **B3** `showBigText({ja, zh, romaji})` 僅 ja 必填；缺欄不渲染小字區。QA 必驗 ja-only（Task6 情境）。
- **B4** `speak` 可用性語意＝`'speechSynthesis' in window`，不得綁「找到 ja voice」（否則違反規則 4）；cancel-then-speak 是契約。
- **B5/B6** 建議定案：不做 history 整合（返回手勢不管 overlay）；關 overlay 一律 cancel 語音。均記入 Task2.api.md。
- **B7** sw.js A2 為本輪＋後續固定迴歸項；漏做症狀＝斷網三模組全滅或舊快取吃住。

### Backend 注意事項（摘）
- Task2.api.md 為 Task5/6 地基：簽名、缺欄行為、isAvailable 語意、overlay 掛載位置、showTab wrap、關閉時 cancel、無 history 定案、呼叫範例。
- iOS 坑：cancel 後立即 speak 偶發無聲、utterance GC 斷音、voiceschanged 不可靠（不得作為播放前置條件）。

### Frontend 注意事項（摘）
- 捲動鎖對象是 `.tab-section`（body 已 overflow:hidden），處理 overlay touchmove 穿透。
- ja-only 版面置中、最長句不溢出、關閉鈕 ≥44px、safe-area 沿用 `--safe-*` 變數。

### QA 迴歸測試清單（摘，完整見 impact.md）
- [ ] Task1 固定項：A2 雙 reload、A5 grep 絕對路徑、config 缺檔無錯
- [ ] 五分頁切換＋lastTab 還原（showTab wrap 不破壞原行為）
- [ ] `showBigText({ja})` ja-only 正常、getVoices 空陣列時播放鈕仍可用
- [ ] overlay 開啟時切分頁（點擊＋程式兩路）行為符合 api.md 定案
- 新功能由 QA 依 spec 驗收方式執行
