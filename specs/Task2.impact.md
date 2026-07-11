# Task2 影響範圍分析（SA）

> 涉及範圍：後端（TTS 封裝、大字元件邏輯、sw.js 預快取、Task2.api.md）＋ 前端（常用句分頁、overlay 視覺）→ pipeline 走完整 backend → frontend → QA。
> 本 Task 的特殊性：產出兩個**跨 Task 共用元件**（`App.showBigText` / `App.speak`），Task5（翻譯）、Task6（OCR）將直接引用。本輪定壞 = Task5/6 雙倍返工，前向約束是本分析核心。

## 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 分頁框架 | `js/app.js`（不改檔案本體） | phrases-tab.js 掛 `App.registerTab('phrases',…)`；bigtext.js 為實現「切分頁關 overlay」須外掛 wrap `App.showTab`（見 B2），wrap 不得改變原簽名與行為 | ✅（五分頁切換、lastTab 還原） |
| 離線快取 | `sw.js` | 新增 3 個 js 檔須入 `PRECACHE_URLS` ＋ bump `CACHE_VERSION` v1→v2（A2）；只動兩常數，不動快取策略本體 | ✅（雙 reload 取新版、舊快取名刪除） |
| App shell | `index.html` | 腳本插入 app.js 之後、`</body>` 之前，順序：tts.js → bigtext.js → phrases-tab.js（A6）；佔位卡整塊替換，不改 section 本體（A1 DOM 約定） | ✅（其他四個佔位分頁不受影響） |
| 樣式層級 | `css/style.css` | overlay 用 z-index ≥100，骨架已預留（A7，style.css 註解明載「設 100 即可蓋過導覽列，不需改骨架 CSS」）；沿用 `--safe-*` 變數 | ✅（overlay 蓋過導覽列） |
| 句庫資料 | `js/phrases.js` | 唯讀消費 `window.PHRASES`（六分類、`{zh,ja,romaji}`），內容結構不改 | ❌（資料不動） |

## 前向約束：本輪定案會鎖住 Task5/6 的接點（依返工風險排序）

### B1. overlay 的 DOM 掛載位置——必須直接掛 `document.body`（返工風險最高）

骨架的分頁切換用 section `hidden` 屬性控制、`.tab-section` 各自 `overflow-y: auto`。overlay 若建在任何 section 內：(a) 切分頁時被 `hidden` 連帶藏掉，(b) 被 section 的 overflow 裁切。spec 要求「與分頁無關的獨立元件、任何分頁任何時刻呼叫都能開」，**唯一正解是 overlay 節點直接掛 body**（建議 lazy-create：首次呼叫才建 DOM）。Task5/6 從各自分頁呼叫時，這是元件「跨分頁獨立」成立的前提。**backend 必須把掛載位置記入 Task2.api.md。**

### B2. 「切分頁自動關閉 overlay」的合法實作路徑——外掛 wrap `App.showTab`

app.js 沒有全域 tab-change 事件（`registerTab` 只有 per-tab `onShow`），且 app.js 檔案本體不得修改。若 backend 採 spec 建議「切分頁時自動關閉」，合法做法只有一條：bigtext.js 載入時保存原 `App.showTab`，替換為「先關 overlay（若開著）→ 呼叫原函式」的包裝。約束：
- wrap 必須**保持原簽名與回傳行為**，overlay 未開時等同 no-op（app.js 初始化時的 `App.showTab(initialTab)` 也會經過 wrap，不得受影響）。
- wrap 後的行為成為**文件化契約**：Task5/6 呼叫 `App.showTab()` 會連帶關閉 overlay。這正是期望行為，但必須寫進 Task2.api.md，否則 Task5「翻譯完成開大字」若寫成 `showTab(...)` 再 `showBigText(...)` 的順序反了就會被自己關掉。
- 若 backend 定案「切分頁不關 overlay」，則 overlay 開著時底下分頁已切換，關閉後畫面≠呼叫前狀態，違反 spec「關閉後回到呼叫前的畫面狀態」——**建議照 spec 建議採自動關閉**，並記入 api.md。

### B3. `showBigText` 簽名鎖死——物件參數、`zh`/`romaji` 可缺是 Task6 的生命線

Task6（OCR）只有 `ja`，Task5（翻譯）有 `ja`+`zh`。簽名必須：
- 單一物件參數 `{ ja, zh, romaji }`，僅 `ja` 必填；缺 `zh`/`romaji` 時下方小字區**整段不渲染**（不是留空白），版面置中策略不得假設三欄俱在。
- `ja` 缺或空字串的行為（no-op 或顯示空版）由 backend 定案記入 api.md——Task6 OCR 可能辨識失敗傳空值。
- 定案後改成 positional 參數、或把 zh 改必填，= Task5/6 同時返工。QA 本輪就要驗 ja-only 呼叫（模擬 Task6 情境），不能只用句庫（三欄俱全）驗。

### B4. `speak` 的語意契約——isAvailable 不得綁「找到 ja voice」

spec 規則 4 明定「voices 清單找不到 ja 也要以 `lang='ja-JP'` 嘗試播放」。因此**可用性查詢的語意必須是 `'speechSynthesis' in window`，不是「取得 ja voice」**——否則 iOS 首次 `getVoices()` 回空陣列時播放鈕被 disable，直接違反規則 4。這是 spec 的介面語意縫（spec 沒明綁 isAvailable 定義），此處補完，backend 照此實作並記入 api.md。Task5 的播放鈕將用同一查詢，語意錯 = Task5 跟著錯。

其他 speak 內部約束（Task5 直接繼承，本輪做壞 Task5 修不了）：
- **cancel-then-speak 是契約**：每次 speak 前 `cancel()`，連點取消前音不排隊。Task5 連點翻譯結果播放同樣依賴。
- iOS 已知坑（backend 注意）：(a) `cancel()` 後立即 `speak()` 偶發不出聲，需微延遲或重試處理；(b) utterance 被 GC 會中途斷音，須保持引用至播畢；(c) `voiceschanged` 在 iOS 可能不觸發或觸發多次，listener 須冪等、且不得以「等到事件」為播放前置條件。
- 失敗靜默（`utterance.onerror` 只記 console，不彈窗）、UI 保持可再點——Task5 sharing 同一行為。

### B5. iOS 返回手勢與 overlay——本輪不做 history 管理（建議定案）

App 全程無 pushState/hash（分頁切換純 DOM），history stack 為空：瀏覽器內 swipe-back 無頁可退、加入主畫面的 standalone 模式亦然，**返回手勢不會產生「overlay 關不掉/整頁跳走」的問題**。若想讓返回手勢＝關 overlay，需引入 pushState 管理，複雜度外溢到 Task5/6（它們的 overlay 呼叫也得遵守 history 紀律）。建議本輪明確定案「不做 history 整合，關閉僅靠關閉鈕＋切分頁」，記入 Task2.api.md，Task5/6 不得各自加 pushState（加了會互踩）。

### B6. 關 overlay 時的語音狀態（spec 未載，建議補定案）

overlay 內有播放鈕；關閉 overlay（或切分頁觸發自動關閉）時若不 `cancel()`，畫面關了聲音還在播。建議定案：**關閉 overlay 一律 cancel 語音**，記入 api.md。Task5/6 重用時行為一致。

### B7. sw.js A2 迴歸（本輪＋後續每輪固定項）

新增 `js/tts.js`、`js/bigtext.js`、`js/phrases-tab.js` 三檔全部入 `PRECACHE_URLS`、`CACHE_VERSION` bump v1→v2，路徑一律 `./`（A5）。漏做的症狀：斷網抓不到新檔（三個模組全滅，常用句分頁整頁壞）或舊快取吃住改動。列本輪 QA 必驗＋自 Task3 起延續為固定迴歸項。

## Backend 注意事項

- 不改 `js/app.js`、`js/phrases.js` 檔案本體；共用 API 以外掛補掛（`App.speak`／`App.showBigText`），wrap `App.showTab` 依 B2 紀律。
- `Task2.api.md` 是 Task5/6 的地基文件，至少含：`showBigText` 簽名與缺欄行為（B3）、`speak` 簽名與 isAvailable 語意（B4）、overlay 掛載位置與 lazy-create（B1）、切分頁自動關閉＋showTab wrap 行為（B2）、關 overlay cancel 語音（B6）、無 history 整合定案（B5）、Task5/6 呼叫範例。
- sw.js 只動 `PRECACHE_URLS` 與 `CACHE_VERSION` 兩常數（B7）；config.js 排除邏輯（A3）不得被波及。
- 降級順序照 spec 規則 5：無 `speechSynthesis` → 播放鈕 disabled＋提示，大字照常，不 throw；`window.PHRASES` 缺/空 → 分頁顯示失敗文案，不影響其他分頁。
- 本 Task 不用 localStorage（spec 邊界條件已定）；若確有需要，`tokyotrip.` 前綴（A8）＋記入 api.md。

## Frontend 注意事項

- 背景捲動鎖（spec 規則 7）的骨架現實：body 已 `overflow: hidden`，實際捲動者是 `.tab-section`（`overflow-y: auto`）。鎖捲動要處理的是 **overlay 上的 touchmove 穿透到 section**——用 overlay 容器 `touchmove` preventDefault（保留 overlay 內部可捲區域，若有）或開啟期間暫設 active section `overflow: hidden`，擇一並確認 iOS 橡皮筋效應不穿透。
- overlay z-index 設 100 即符合 A7（style.css 註解已預留，不改骨架 CSS）；safe-area 沿用 `--safe-t/b/l/r` 變數，關閉鈕避開瀏海與 home bar、觸控目標 ≥ 44px。
- 最長句（如「附近有醫院／藥局嗎？」→「この近くに病院／薬局はありますか？」）直式 iPhone 不溢出；字級策略（固定＋換行 or 依長度縮放）frontend 定，但要考慮 B3 的 ja-only 版面（無下方小字時的置中）。
- 佔位卡整塊替換 `#tab-phrases` 內容，不動 section 標籤與 id（A1）；渲染冪等，`onShow` 重複觸發不疊 DOM（spec 規則 6）。
- 播放鈕（列表右側＋overlay 內）依 isAvailable 決定 disabled 狀態，語意照 B4。

## QA 迴歸測試清單

- Task1 固定迴歸項（每輪必跑）：
  - [ ] A2：`CACHE_VERSION` bump 後雙 reload 取新版、DevTools 確認舊快取名已刪
  - [ ] A5：grep 全部資源引用無 `/` 開頭絕對路徑
  - [ ] 刪 `js/config.js` 後頁面正常、console 無未捕捉錯誤、SW install 成功
- 既有功能迴歸（本次新增）：
  - [ ] 五分頁切換正常、lastTab 還原正常（B2 的 showTab wrap 不得破壞原行為）
  - [ ] 其他四個佔位分頁畫面不受 phrases 實作影響
- 本次 spec 驗收照 Task2.spec.md「驗收方式」，SA 加強項：
  - [ ] `App.showBigText({ ja })`（無 zh/romaji，模擬 Task6）：正常開、無 undefined 字樣、版面不破（B3）
  - [ ] stub `getVoices()` 回空陣列：播放鈕仍可用、speak 仍以 `lang='ja-JP'` 嘗試（B4）
  - [ ] overlay 開啟時切分頁（點導覽列＋程式呼叫 `App.showTab` 兩路）：行為符合 api.md 定案；切換後再開 overlay 正常（B2）
  - [ ] 關 overlay 時語音行為符合 api.md 定案（B6）
  - [ ] overlay 開啟時背景 section 不可捲動、關閉後恢復（B6/規則 7）
- 自 Task3 起新增固定迴歸項：**新增/異動任何檔案 → PRECACHE_URLS＋CACHE_VERSION 同步檢查（B7）**；自 Task5 起：`App.showBigText`／`App.speak` 簽名不變檢查（api.md 為準）。

## 疑慮回報 PM（不重開拍板，僅記錄）

- B4（isAvailable 語意）、B5（不做 history 整合）、B6（關 overlay cancel 語音）為 spec 未明載處的補完建議，均不牴觸已拍板決策，由 backend 定案記入 Task2.api.md；若 PM 認定超出解釋範圍，請於閉環時裁示。
