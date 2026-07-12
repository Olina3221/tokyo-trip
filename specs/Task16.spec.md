# Task16 — 對話模式自動播無聲修復（iOS TTS 手勢解鎖 + 錄音後音訊 session 釋放）

> **本 spec 基於已核准之 `talk_autoplay.diagnosis.md`（Olina 2026-07-12 真機確認＋口頭核准），覆蓋全部存活根因 RC-H + RC-I。**
> 程式碼側 RC-A~G 已全數排除（git diff 逐位元實證）；RC-J（單向 voice 缺失）經 Olina 真機確認兩方向皆無聲而排除。
> 診斷存檔：`specs/talk_autoplay.diagnosis.md`（永久保留）。`.diagnosed` / `.diagnosis_approved` 已依 signal-flow 收尾規則於本 spec 建 `.ready` 時消費清除。

## 模組：翻譯分頁・對話模式（面對面）自動播音

### 功能描述

修復 v15 面對面對話模式「翻譯文字正常顯示、但兩個方向都不自動發聲」的 iOS 執行期問題：在 user gesture 內解鎖 speechSynthesis（RC-H），並確保錄音結束、音訊 session 釋放後才發 TTS（RC-I）。兩條合修（belt-and-braces）。

### 背景與已拍板決策（不重議）

- 已完成：Task12（對話語音模式）、Task13（雙向自動播）、Task15（面對面版面）皆閉環；Task6 閉環後現版 v15。自動播程式碼（G4 守門＋`App.speak` 呼叫，`translate-tab.js:531-536`）與 Task13 逐位元相同，**不是程式碼回歸**。
- 已拍板（Olina 真機確認＋核准診斷）：
  - 症狀＝翻譯文字有出現、只是沒唸出聲；**兩方向（中→日、日→中）皆無聲**。
  - 要修的存活根因＝ **RC-H**（iOS speechSynthesis 首次發聲需接在 user gesture；自動播發生在「錄音→STT→翻譯」的 async fetch 回呼，iOS 判非手勢脈絡而靜音）＋ **RC-I**（getUserMedia 錄音後 iOS 音訊 session 可能卡在 record 類別，TTS 被靜音或導到聽筒）。
  - **兩條一起修**——本機無法廉價區分、且併修安全。
- 已拍板（本任務正當解除保護）：先前多個 Task 把 `tts.js` 列為零 diff 保護區（Task5/13 等），**本任務正式解除該保護**——但**只加不改**：既有 `speak` / `speak.cancel` / `speak.isAvailable` / `_pickVoice` 的行為與契約一個位元組的語意都不得變。
- SA/backend 不得重開已拍板的討論（例如改回氣泡版、換 TTS 引擎、質疑診斷結論）；有疑慮記入回報交 PM。

### 涉及範圍

- [x] 後端／核心邏輯（`js/tts.js`、`js/translate-tab.js`，可能 `js/recorder.js`；另 bump `sw.js`＋`js/version.js`）
- [ ] 前端／UI（**零 UI 變更**：不動 DOM 結構、不動 CSS、不動 index.html）

純後端任務：backend 完成後直接建 `Task16.done`，跳過 frontend 階段。

### 需求細節

#### R1（RC-H 解法）：`App.speak.unlock()` — 手勢內解鎖語音引擎

在 `js/tts.js` 新增公開方法 `App.speak.unlock()`（additive，掛在 speak 函式上，與既有 `speak.cancel`、`speak.isAvailable` 同掛法）：

1. **作用**：在 user gesture 脈絡內對 `speechSynthesis` 觸發一次「空發聲」以解鎖 iOS 的首發聲手勢限制——參考做法：`speechSynthesis.speak(new SpeechSynthesisUtterance(''))`（空 utterance，無聲、瞬間結束）。具體細節（是否需 `text=' '` 空白字元、是否緊接 cancel、是否設 volume 0）由 backend 依 iOS 實務定案，寫進實作註解。
2. **冪等**：內部旗標記錄「已成功解鎖」，之後重複呼叫直接 return，零成本。解鎖只需成功一次（per page session）。
3. **無 speechSynthesis 環境 no-op**：`if (!window.speechSynthesis) return;`（比照既有 `speak` 開頭守門），絕不 throw。
4. **不破壞既有契約**：`speak(text, lang)`、`speak.cancel()`、`speak.isAvailable`、`_pickVoice` 的簽名、行為、iOS 陷阱修法（16ms 微延遲、utterance 防 GC、cancel-then-speak）全部不動。unlock 不得動用/干擾 `_pendingTimer` 與 `_currentUtterance`（若 unlock 的空 utterance 需要暫存參照，用獨立變數）。
5. **呼叫點**：`js/translate-tab.js` 的 `_onMicClick(lang)`（L556）**開頭**（在 G5 狀態守門之後、任何 async 呼叫之前）呼叫 `App.speak.unlock()`——此處必定在 mic 按鈕 click handler 內＝user gesture 脈絡。兩顆 mic（L767-768 綁定）與「再按停止」路徑都會經過同一 handler，冪等旗標保證只有第一次真的發空 utterance。
   - **與既有 cancel 的互動（backend 必須驗證定案）**：`_onMicClick` idle 路徑 L585 有 `App.speak.cancel()`（防喇叭回授，Task12 契約，不得移除）。unlock 的空 utterance 若被緊隨的 cancel 清掉，iOS 的手勢解鎖效果一般仍成立（解鎖看的是「speak 曾在手勢內被呼叫」）；backend 需確認呼叫順序（建議 unlock 在 cancel 之前或之後皆測其邏輯自洽），並在 `_onMicClick` 內以註解記錄定案理由。

#### R2（RC-I 解法）：錄音結束、音訊 session 釋放後才發 TTS

目標：自動播的 `App.speak`（`translate-tab.js:535`）發出時，iOS 音訊 session 已離開 record 類別、回到 playback。

1. **backend 先確認現況**：`recorder.js` `_release()`（L57-70）已 stop 全部 tracks＋`audioCtx.close()`——但 `close()` 回傳 Promise 且現況未 await，`stop()` resolve 時 close 可能尚未完成。
2. **強化手法由 backend/SA 定案**，候選（擇一或組合，取最小侵入）：
   - (a) `recorder.js` `stop()` 改為 await `audioCtx.close()` 完成後才 resolve（注意 R5 try/catch 包裹不得破壞；close 不存在或 reject 時 fallback 直接 resolve）；
   - (b) `translate-tab.js` `_processTalk` 的自動播 speak 前加極短明確延遲（例如 100–300ms），讓 iOS 完成 session 切換；
   - (c) 兩者皆做（belt-and-braces，推薦起點：a 為主、必要時加 b）。
3. **紅線**：`recorder.js` 檔頭 R1–R8 iOS 陷阱清單是實證產物，**不得「優化」或重排**；改動限縮在釋放時序，錄音/編碼鏈（resample、LINEAR16、base64）零 diff。
4. 自動播以外的 TTS 路徑（重播鈕 L746/757、常用句、大字）不加延遲——它們本來就在手勢內、無 RC-I 場景。

#### R3：兩方向皆須生效

中→日（`ja-JP`）與日→中（`zh-TW`）兩個方向的自動播共用同一條 `_processTalk` → G4 → `App.speak` 路徑（L531-536），修法天然雙向覆蓋；QA 驗證兩方向的 speak 呼叫皆保留、lang 選擇邏輯零變更。

#### R4：版號 bump（Task14 兩檔三行 SOP）

- `sw.js` `CACHE_VERSION`：`'v15'` → `'v16'`
- `js/version.js` `APP_VERSION`：`'v15'` → `'v16'`；`APP_VERSION_DATE` 更新為實作當日（MM/DD）
- QA 機械閘：`APP_VERSION === CACHE_VERSION` 逐字元相等。

### 業務規則

1. 對話模式定位＝隨行翻譯官（Task13 拍板）：說完話、譯文顯示的同時**自動唸出**，使用者全程不必碰播放鈕。
2. 防回授契約（Task12）不變：按 mic 開始錄音前 cancel 當前 TTS。
3. G4 守門（translate 為當前分頁＋模式為 talk 才自動播）語意零變更。

### 邊界條件 / 錯誤處理

- `speechSynthesis` 不存在（理論上 iOS Safari 皆有）：unlock no-op，`speak` 既有守門已涵蓋。
- unlock 的空 utterance 觸發 `onerror`：靜默（比照 B4 精神，console.warn 即可），不影響冪等旗標判定由 backend 定案（建議：speak 呼叫成功發出即視為已解鎖，不等 onend）。
- 錄音 stop 後 `audioCtx.close()` reject／不存在：fallback 照常 resolve，不得讓錄音結果因釋放失敗而丟失。
- RC-I 若採延遲手法：延遲期間使用者切分頁/切模式，既有 `_abortTalk`（L379）的 `speak.cancel()` 仍會清掉 pending 播音——此為既有正確行為，不得破壞。

### QA 驗收要點（程式碼側；真發聲歸 Olina 真機）

QA **無法在 Windows/桌面瀏覽器驗證 iOS 真實發聲**，只驗程式面：

1. `App.speak.unlock` 存在、冪等（連呼兩次第二次不再 speak）、無 speechSynthesis 時 no-op 不 throw。
2. `_onMicClick` 內（同步手勢路徑上）有呼叫 `App.speak.unlock()`，且在任何 async（`recorder.start/stop`）之前。
3. 既有契約迴歸：`App.speak(text)` 預設 ja-JP 行為不變；`speak.cancel` 行為不變；`phrases-tab.js:186`、`bigtext.js:119`、`translate-tab.js:306/746/757` 既有呼叫點零 diff；`camera-tab.js:646` 的 cancel 守門零 diff。
4. 對話模式兩方向自動播的 `App.speak(result, lang)` 呼叫仍存在且 lang 選擇（zh→ja-JP／ja→zh-TW）零變更。
5. RC-I 手法落地驗證（依 backend 定案：await close 的 resolve 順序／延遲存在且僅作用於自動播路徑）。
6. 文字翻譯模式（Task5 區塊）零 diff；面對面 DOM 建構（`_buildTalkDOM`）零 diff（除非 backend 定案的 RC-I 手法必須動到，須在回報中說明）。
7. 版號機械閘：`sw.js` CACHE_VERSION === `js/version.js` APP_VERSION === `'v16'`，DATE 已更新；PRECACHE 清單無增減（本任務不加檔）。

**真機驗收（流程外，Olina）**：部署後 iPhone 實測——一進 App 直接用對話模式（不先按任何播放鈕），中→日與日→中各說一句，確認兩方向譯文自動出聲。**若一次沒修好，依真機結果迭代**：可能需再調 RC-I 手法（延遲長度／session 切換方式）或加備援（例如自動播失敗時的可見重播提示），由 PM 依 Olina 回報另開修復輪或新 Task。

### 不在本次範圍（Non-scope，護欄）

- 不動文字翻譯模式（Task5 區塊零 diff）
- 不動面對面版面 DOM/CSS/index.html（Task15 產物零視覺變更）
- 不動 G4 守門邏輯、氣泡/歷史等已退場結構不回加
- 不動 recorder.js 的錄音/編碼鏈與 R1–R8 陷阱修法（僅允許釋放時序強化）
- 不改 phrases/bigtext/camera 的 speak 呼叫點
- 不動 SW fetch 策略、不做 SWR、不加 PRECACHE 項目
- 不實作 Task7（部署清單）、KML 地圖等後續項目
- 不引入自動重播、失敗重試 UI 等備援（真機迭代時再議）

## 影響範圍分析（SA）

> 完整版見 `Task16.impact.md`（2026-07-12）。涉及範圍：**純後端**（backend 完成後直接建 `Task16.done`，跳過 frontend）。

### 受影響的既有功能
| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 全域 TTS 各呼叫點（常用句/大字/文字翻譯/camera） | phrases-tab:186、bigtext:119、camera-tab:579/646、translate-tab:306/746/757 | tts.js 只加 unlock（獨立變數），既有函式本體零 diff | ✅ |
| 對話防回授＋錄音鏈 | `_onMicClick` L585／`recorder.stop()` | cancel 保留；unlock 插 cancel 之後；stop 改 await close＋逾時保險，編碼鏈零 diff | ✅ |
| 對話雙向自動播 | `_processTalk` G4（L531-536） | G4＋speak 包 150ms 延遲，守門移入回呼＋新增 `_talkState==='idle'` 守門 | ✅ |
| 切分頁/切模式/60 秒自動停/離線快取 | `_abortTalk`、wrap 鏈、sw.js+version.js | 前三者零 diff；版號 v15→v16 兩檔三行 | ✅ |

### Backend 注意事項（SA 定案，覆蓋 spec 授權的待定點）
- **unlock 時序定案（核心）**：唯一呼叫點＝`_onMicClick` idle 路徑、L585 `App.speak.cancel()` **之後**、`App.recorder.start()` 之前。理由：首次 tap 必走 idle 分支（解鎖必然發生）；cancel 之後才 unlock，防回授 cancel 永遠清不掉解鎖空 utterance。**禁止「開頭＋cancel 後」雙呼叫**——發出即設的冪等旗標會讓第二次 no-op、而第一次已被 cancel 清掉，組合反而失效。recording 分支不加（冪等已覆蓋）。
- unlock 實作：直接 `speechSynthesis.speak`（不走 App.speak）、文字建議 `' '`、不設 voice/lang（不依賴 `_pickVoice`）、utt 用獨立變數、旗標於發出當下即設、no-op 守門。
- **RC-I 定案＝(c) 併用**：(a) `_release()` 回傳吞過 rejection 的 Promise（abort 忽略回傳值保同步契約），`stop()` 尾端 await（含 ~500ms race 逾時保險，close 懸掛不得卡流程）；(b) `_processTalk` 自動播加 150ms 延遲——`_setSideResult` 不延遲，**G4 守門移入延遲回呼內重驗＋新增 `_talkState==='idle'` 守門**（spec 邊界條件的 `_abortTalk` 清 pending 假設只覆蓋 tts.js 內部 timer，不覆蓋本次新 timer；idle 守門堵延遲窗內搶按 mic 的新回授窗）。手動播音路徑一律不加延遲。
- 兩方向天然共用（`_onMicClick`/recorder 層/G4 共用區塊三處修法皆雙向），L535 lang 三元式零變更。
- 歷史判準失效：Task13.spec「tts.js/recorder.js 零 diff」不適用本 Task。

### Frontend 注意事項
- 無 frontend 階段（零 UI 變更）。

### QA 迴歸測試清單（完整版見 impact.md §9）
- [ ] unlock 冪等／no-op／呼叫點位置（cancel 後、start 前、恰一處）；tts.js diff 純新增，四個既有函式本體零 +/-
- [ ] phrases-tab／bigtext／camera-tab 三檔零 diff；translate-tab:306/746/757 零 diff；文字模式零 diff
- [ ] recorder.js diff 限 `_release`/`stop`；abort 同步簽名；close reject/逾時仍 resolve 錄音結果；編碼鏈＋R1–R8 註解零 diff
- [ ] 自動播延遲回呼內守門：切分頁/非 idle 時不發聲；兩方向 lang 各恰一次；`cmn-Hant-TW` 只在 STT 語境
- [ ] 版號機械閘 v16 兩檔相等、DATE 更新、PRECACHE 無增減
- 真機兩方向自動發聲歸 Olina 部署後流程外驗收
