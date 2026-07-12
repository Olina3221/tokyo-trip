# Task12.impact.md — 影響範圍分析（SA，Google Speech-to-Text 版）

> 2026-07-12。本版對應 `Task12.spec.md` 2026-07-12 重大改寫版（辨識引擎 = Google Cloud Speech-to-Text）。
> 舊版（瀏覽器內建 webkitSpeechRecognition 版）影響分析已作廢刪除，本檔為唯一有效版本。
> **涉及範圍標記：後端／核心邏輯 ＋ 前端／UI 皆有** → pipeline 走完整鏈：`sa_done → backend → backend_done → frontend → done → QA`。

---

## 1. 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 常用句：播音 | phrases-tab.js:186 `App.speak(capturedJa)` | tts.js `_pickJaVoice` 一般化波及；呼叫點零 diff、行為零變化（lang 預設 'ja-JP'） | ✅ |
| 常用句：大字 | phrases-tab.js:163 `showBigText({ja,zh,romaji})` | bigtext lang 擴充波及；不帶 lang → 行為零變化 | ✅ |
| 行程：飯店地址大字 | trip-tab.js:452 `showBigText({ja: h.address_ja})` | ja-only 置中版面不變；**_lang 殘留風險測點**（見 §2.3） | ✅ |
| 翻譯：文字模式全部 | translate-tab.js（Task5 全行為） | 模式切換外殼是唯一授權變動；文字模式 UI／邏輯零變更 | ✅ |
| 大字 overlay 播音鈕 | bigtext.js:117 `App.speak(jaEl.textContent)` | **授權例外**：改為 `App.speak(text, _lang)`（本 spec §showBigText 擴充授權；不帶 lang 時行為零變化） | ✅ |
| 分頁切換（全站） | App.showTab wrap 鏈 | 現況已兩層（coupon-viewer→bigtext），Task12 加 translate-tab wrap 成**三層**；call-through 必驗 | ✅ |
| 折價券檢視器 | coupon-viewer.js（零 diff） | 不動，但 wrap 鏈多一層，切分頁自動關檢視器需迴歸 | ✅ |
| 翻譯 API | api.js `translate()` | 端點層追加 speechToText；translate／傳輸層／金鑰層零 diff | ✅ |
| 離線快取 | sw.js | bump v10→v11＋PRECACHE 僅新增 `./js/recorder.js` | ✅ |
| TTS 全域 | tts.js | lang 一般化；isAvailable／cancel 簽名語意不變；B4 契約全數保留 | ✅ |

不受影響（判準：檔案零 diff）：app.js、phrases.js、phrases-tab.js、trip-tab.js、import-data.js、tripdata.js、coupon-viewer.js、coupons-tab.js、manifest.webmanifest。

---

## 2. 雙向 TTS：不破壞既有契約（分析重點 1）

### 2.1 既有呼叫點盤點（全 repo grep 定案，機械判準）

`App.speak(單參數)` 呼叫點**恰 3 處**：

| 位置 | 內容 | 判準 |
|------|------|------|
| phrases-tab.js:186 | `App.speak(capturedJa)` | **零 diff** |
| translate-tab.js:289 | `App.speak(_lastResult)`（文字模式中→日播音鈕） | **零 diff** |
| bigtext.js:117 | `App.speak(jaEl.textContent)` | **授權例外**：改為 `App.speak(jaEl.textContent, _lang)`——這是 showBigText lang 擴充能生效的必要改動，由本 spec §雙向 TTS 授權；`_lang` 預設 'ja-JP' 時行為與現況逐位元相同 |

`App.speak.cancel()` 呼叫點現況 1 處（bigtext.js:61，B6）——零 diff；Task12 新增呼叫點（錄音前、切分頁）皆在新碼內。

### 2.2 `_pickJaVoice` 一般化（tts.js 內部）

現況（tts.js:45-52）：前綴 `'ja'` 掃 `_voices` 取第一個。一般化為 `_pickVoice(lang)`，**挑選順位固定**：

1. **完整 lang 精確比對**（`voice.lang === lang`；建議比對前做正規化 `String(v.lang).replace('_','-')` 不分大小寫——iOS 有回報 `zh_TW` 底線變體的紀錄）；
2. 前綴比對（`lang.split('-')[0]`）；
3. 都沒有 → 回 null，utterance 只設 `utt.lang = lang` 讓系統自選（B4 精神：不因清單空就放棄）。

**iOS 陷阱（為什麼精確必須優先）**：iOS 語音清單 zh-CN／zh-HK／zh-TW 並存且順序不保證，前綴 `'zh'` 第一位常是 zh-CN——只做前綴會讓中文譯文用陸腔唸。日文路徑退化驗證：`_pickVoice('ja-JP')` 精確比對失敗時前綴 'ja' 命中，與現況 `_pickJaVoice` 同結果 → 既有日文行為零變化。

### 2.3 overlay 單例 `_lang` 殘留（必重設）

bigtext overlay 是單例、內容跨呼叫重用。`showBigText` **每次呼叫都必須重設 `_lang = params.lang || 'ja-JP'`**，不得只在有 lang 時覆寫。失敗情境（QA 必測）：對話模式日→中氣泡開大字（`lang:'zh-TW'`）→ 關閉 → 切行程分頁點飯店地址（不帶 lang）→ 播音鈕若殘留 zh-TW，日文地址會被中文 voice 唸壞。

### 2.4 其餘 B4 契約

cancel-then-speak、16ms 延遲、utterance 參照保留、onend/onerror 收尾、失敗靜默、voiceschanged 冪等——**全數不變、適用兩語言**。`App.speak.isAvailable`（= `'speechSynthesis' in window`）與 `App.speak.cancel()` 簽名語意零變化。

**附帶發現（建議一併修，tts.js 本來就在授權變動範圍）**：16ms setTimeout 有 latent 疊音縫——兩次 `speak()` 間隔 <16ms 時，第二次的 `cancel()` 取消不到第一次「尚未建立」的 utterance，16ms 後兩個 utterance 先後排隊播出，違反「cancel-then-speak 防疊音」意圖。修法：模組保留 pending timeout id，`speak()` 開頭與 `cancelSpeak()` 皆 `clearTimeout`。此修**強化**既有契約語意、不改任何對外簽名；Task12 新增「錄音前 cancel」讓此縫的後果升級（喇叭殘音進錄音），值得順手關掉。

---

## 3. showBigText 加選填 lang（分析重點 2）

additive 擴充：選項物件新增選填欄 `lang`（預設 'ja-JP'），只控制 overlay 播音鈕的 `App.speak(主文字, _lang)`。

不帶 lang 的既有呼叫點**恰 3 處，全部零 diff、行為零變化**：

| 位置 | 內容 |
|------|------|
| phrases-tab.js:163 | `{ja, zh, romaji}` 三欄 |
| trip-tab.js:452 | `{ja: h.address_ja}` ja-only 置中 |
| translate-tab.js:284 | `{ja: _lastResult, zh: _lastInput}`（文字模式中→日） |

契約文件化：backend 須在 `Task12.api.md` 做契約擴充宣告（比照 Task5.api.md A3 改版宣告格式），註明 Task2.api.md 原簽名仍有效、`ja` 欄語意 = 主文字槽（歷史命名），日→中大字時放中文。B1/B2/B3/B5/B6 全數不變。

---

## 4. api.js `speechToText` 端點層追加（分析重點 3）

### 4.1 零 diff 盤點（機械判準，QA 用 git diff 驗）

api.js 內以下單元**一行 diff 都不得有**：`_getKey()`（金鑰層）、`ErrorCode` 枚舉（不新增不改名）、`_classifyError()`、`_postJson()`（傳輸層）、`translate()`（端點層既有函式）。合法 diff 僅：端點層新增 `speechToText` 函式＋掛載處 `window.App.api` 物件加一個 key＋檔頭註解。

### 4.2 端點差異確認

- Speech 端點 `https://speech.googleapis.com/v1/speech:recognize?key=` 與 Translation **不同網域但同金鑰（`_getKey()`）、同 POST（走 `_postJson`）、同 Google 標準錯誤體格式**（`error.message`）→ `_classifyError` 零改動即正確分類 403/429/其他；400（INVALID_ARGUMENT，音訊格式錯）落 HTTP_OTHER，可接受。
- POST-only 硬約束延續：speechToText 走 `_postJson` 即天然滿足；sw.js 零特例。
- 空結果語意**與 translate 相反，必須明文**：`translate()` 空結果 → reject HTTP_OTHER（現況 api.js:113）；`speechToText` 回應 2xx 但無 `results` → **resolve `''`**（沒聽清楚不是錯誤，探針實證路徑）。backend 不得把 translate 的空結果 reject 模式複製過來。取值鏈：`results[0].alternatives[0].transcript`（多 results 段只取 [0]，與探針一致——60 秒內單句幾乎恆為單段，接受此限制）。

### 4.3 兩套語言碼不可混用（機械判準）

| 方向 | STT `languageCode` | 翻譯 `source→target` | TTS lang |
|------|--------------------|---------------------|----------|
| 中→日 | `cmn-Hant-TW` | `zh-TW → ja` | `ja-JP`（自動播） |
| 日→中 | `ja-JP` | `ja → zh-TW` | `zh-TW`（僅重播鈕） |

**grep 判準**：`cmn-Hant-TW` 字串在全 repo 只准出現在「`speechToText` 的 languageCode 引數」語境（translate-tab.js 呼叫處＋api.js/Task12.api.md 註解），絕不得成為 `translate()` 或 `App.speak()` 的引數；反向：`speechToText` 的呼叫引數只准 `'cmn-Hant-TW'`／`'ja-JP'` 兩值，`'zh-TW'` 不得傳入 speechToText。

---

## 5. recorder.js 錄音封裝（分析重點 4）

### 5.1 iOS 陷阱清單（speech-test.html 已實證，backend 照搬、不得「優化」）

| # | 陷阱 | 探針對應 |
|---|------|---------|
| R1 | `processor.connect(audioCtx.destination)` 必接——iOS 不接 destination 不觸發 onaudioprocess | speech-test:104 |
| R2 | **每次錄音新建 AudioContext、用完即 close**——iOS 對常駐 context 不友善 | start/stop 各一次 |
| R3 | `AudioContext` 帶 `webkitAudioContext` 前綴 fallback；`state==='suspended'` 時 `resume()` | speech-test:80,99 |
| R4 | `start()` 必須在 user gesture handler 內呼叫（iOS 紅線）；**getUserMedia resolve 後才建 AudioContext 的順序不得反轉**——探針即此順序、已實證，勿改成預建 context | speech-test:97-105 |
| R5 | 資源釋放四件套全包 try/catch：`processor.disconnect()`、`source.disconnect()`、`tracks.stop()`、`audioCtx.close()`；stop() 與 abort() 皆須 | speech-test:112 |
| R6 | **`audioCtx.sampleRate` 必須在 close 前讀取**（重取樣比率依它算；close 後讀是 undefined 行為） | speech-test:111 |
| R7 | base64 編碼分塊 0x8000 `String.fromCharCode.apply` 防 call stack 爆（60 秒 16k Int16 ≈ 1.9MB） | speech-test:125 |
| R8 | onaudioprocess 以 `recording` 旗標守門，start 完成前／abort 後不收 buffer | speech-test:102 |

容量心算（不需守則、供 QA 安心）：60 秒上限時原始 buffer（48kHz Float32）≈ 11.5MB 記憶體、LINEAR16@16k base64 ≈ 2.6MB，皆在 sync `speech:recognize` 限制（1 分鐘／10MB）內——60 秒上限同時守住兩者。

### 5.2 介面補完（spec 縫隙定案）

- `stop()` 在**非錄音中**被呼叫：reject `{code:'OTHER'}`（呼叫端狀態機本不該打到這；防禦性語意，translate-tab 靜默處理）。
- `durationMs` 定義 = `Math.round(合併樣本數 / 原始 sampleRate * 1000)`（重取樣前計）。本輪無下游消費者，僅診斷用途——backend 依定義便宜實作即可，不做額外功能。
- `start()` 已在錄音中 → 先 `abort()` 舊實例再開新（spec 已定，雙保險之內層）。

### 5.3 與既有 TTS 的互動

- **錄音前必 `App.speak.cancel()`**（spec 對話流程 §1 已定）：防自動播的日文 TTS 從喇叭進麥克風。
- 16ms race（§2.4 附帶發現）：若不修 tts.js pending timer，存在 <16ms 窗口讓已排程 utterance 在 cancel 後仍播出、進錄音——窗口極小（跨鈕連點 <16ms），修了最好，不修則列已知微縫、QA 不以此 FAIL。
- 氣泡 🔊／⤢ 鈕僅 `idle` 可用（spec §7）：錄音中無 TTS 觸發路徑。

### 5.4 與 overlay 的互動

bigtext overlay 全螢幕蓋住麥克風鈕＋氣泡鈕僅 idle 可用 → 「overlay 開著時開錄音」無觸發路徑，天然互斥，零額外程式。錄音中唯一能開 overlay 的路徑已被狀態機關閉。

### 5.5 切分頁 abort：wrap 設計定案（SA 修正 SYSTEM_MAP 預埋條目）

`App.registerTab` 只有 onShow、無 onHide（Task1 結構事實）→ 清理唯一機制 = additive wrap `App.showTab`。

**現況 wrap 鏈已是兩層**（SYSTEM_MAP 舊預埋寫「Task12 起兩層」有誤，已修正）：coupon-viewer.js:319-329（O1，載入最晚、最外層）→ bigtext.js:197-203 → app.js 原函式。translate-tab.js 載入位置在 bigtext 之後、coupon-viewer 之前（index.html:140），其 wrap 於 IIFE 載入時捕獲 bigtext 版 → **Task12 後鏈為三層（外→內）：coupon-viewer → translate-tab → bigtext → 原函式**，每層 call-through（O1 紀律）。

translate-tab wrap 的行為約束：

1. **abort 條件**：目標 `id !== 'translate'`（導覽列重按當前分頁也觸發 showTab＋onShow，同分頁重按不得中斷錄音）。`App.recorder.abort()` 靜默冪等，非錄音中呼叫無害。
2. **TTS cancel 必須加「translate 為當前分頁」條件**（`!document.getElementById('tab-translate').hidden` 之類）：wrap 攔的是**全站**切分頁——若無條件 cancel，「常用句播音中→切行程」會被 Task12 的 wrap 誤殺，這是對 Task2 既有行為的迴歸破壞。正確條件：`translate 當前可見 && 目標 id !== 'translate'` 才 `abort + cancel`。
3. **統一走單一 `_abortTalk()`**：清 60 秒計時器＋`App.recorder.abort()`＋`App.speak.cancel()`＋狀態回 idle＋UI 復位。wrap、模式切換（§9 G1）、60 秒逾時錯誤路徑共用，防計時器殘留（殘留計時器晚點對非錄音實例打 stop()）。
4. in-flight 辨識／翻譯 Promise：照 append 氣泡（DOM 已建、隱藏中 append 無害）；**自動播 ja 條件 = translate 為當前分頁 && 模式仍為 'talk'**（見 §9 G4）。

---

## 6. 模式切換外殼不動 Task5（分析重點 5）

### 6.1 translate-tab.js 既有碼盤點（零 diff 清單）

具名函式 10 個：`_getDir`、`_saveDir`、`_updateDirLabel`、`_updateCharRow`、`_updateTranslateBtn`、`_updateActionBtns`、`_showResult`、`_showError`、`_clearResultArea`、`_buildDOM`；`_buildDOM` 內事件 handler 6 個：textarea input、dirToggle click、translateBtn click、bigTextBtn click、speakBtn click、copyBtn click。**以上 16 個單元＋模組常數（DIR_KEY/DEFAULT_DIR/MAX_CHARS/DIRS/ERROR_MSG）＋文字模式狀態變數，一行 diff 都不得有。** 唯一授權變動 = `registerTab('translate', {onShow})` 的 onShow（外殼）＋新增的對話模式碼。

### 6.2 外殼掛法（SA 建議解，可保全部零 diff 判準）

`#tab-translate` 之下做**三個平行直接子元素**：`div.translate-mode-seg`（segmented，flex-shrink:0）＋ `.translate-container`（文字模式，既有）＋ `div.talk-container`（對話模式）。onShow 首次：先 `_buildDOM(section)`（呼叫點與本體**皆零 diff**——它清掉佔位卡並 append `.translate-container`），再由外殼把 segmented 插到 container 之前、talk-container append 到之後；模式切換 = 對兩容器 toggle inline `display`。

這樣 **`.translate-container` 維持 `.tab-section` 的直接 flex 子元素**——style.css:1647 註解明文此前提，包 wrapper 會使既有 `.translate-*` 樣式的佈局前提失效（gap/padding/捲動歸屬），等於隱性改了 Task5 UI。若 backend 採其他掛法，必須保住「直接子元素」與「文字模式 DOM 子樹逐節點不變」兩個判準。

### 6.3 佈局約束（Task11 紀律延伸）

- `.tab-section` 本身 `overflow-y:auto`（style.css:88）：文字模式沿用 section 捲動（現況行為，不動）；**對話模式容器須 `flex:1 + min-height:0`、總高度貼合 section**，捲動只發生在 `.talk-history`（overflow-y:auto）——否則出現「section 捲動＋history 捲動」雙捲，麥克風列會被捲出畫面。
- `.translate-mode-seg`、`.talk-lang-bar`、`.talk-status`、`.talk-mic-row` 皆 `flex-shrink:0`（Task11 U2 教訓）。
- CSS 判準：既有 `.translate-*` 選擇器規則零 diff；新樣式只准新增選擇器（`.translate-mode-seg`／`.talk-*`）；不引用 `--fs-*`（Task10 紀律）；文字色用 `--c-accent-text`（Task8 紀律）；不新增深底 overlay。

### 6.4 模式記憶

新 localStorage key `tokyotrip.translateMode`（'text'｜'talk'，預設與壞值 fallback 皆 'talk'，try/catch 降級）——**本 Task 唯一新 key**，已登記 SYSTEM_MAP。`tokyotrip.translateDir` 行為原封不動（文字模式專用）。

---

## 7. 氣泡歷史（分析重點 6）

- 儲存：記憶體陣列（每則 {dir, 原文, 譯文}），**不進 localStorage**（隱私＋無跨日需求，spec 定案）。
- 上限 50：超過丟最舊——**陣列與 DOM 同步裁剪**（只裁陣列不裁 DOM，DOM 無上限增長；反之亦然。判準：任一時刻氣泡 DOM 節點數 === 陣列長度 ≤ 50）。
- B6 冪等：DOM 只建一次（沿用 `_initialized` 模式）；切分頁 onShow 不重建、不清歷史；氣泡 append 到既有 history 容器。
- append 後 `.talk-history` 自動捲到最底（spec 未明文，SA 補：對話動線必要，新氣泡在底部，不捲到底等於看不到結果）。

---

## 8. 清理、載入順序、bump（分析重點 7）

### 8.1 探針清理（SA 已完成現況掃描）

`voice-test.html`、`speech-test.html` 兩檔皆在 repo 根目錄；**現況引用掃描結果：PRECACHE_URLS 不含、index.html 不含、js/ 全部不含（零引用）**——刪除即乾淨，無連動拆線。順序紀律：**先把 speech-test.html 演算法搬進 recorder.js、再刪檔**。刪後 backend 重跑 grep `voice-test|speech-test` 全 repo（tracked 檔）確認為零，作為交付證據。

### 8.2 載入順序（index.html）

現況 139-140 行 `api.js → translate-tab.js`，**recorder.js 插中間**：`… trip-tab.js → api.js → recorder.js → translate-tab.js → coupon-viewer.js → coupons-tab.js`。recorder.js 比照功能模組掛 `window.App`，必須在 app.js 之後（沿用 `window.App = window.App || {}` 慣例則僅約定性依賴）、translate-tab.js 之前（消費者）。舊版規劃 `js/speech.js` 取消不建（spec 定案）。

### 8.3 sw.js

`CACHE_VERSION` v10 → **v11**（開工時實際值 +1 規則，現況確認 v10）；PRECACHE_URLS **僅新增** `./js/recorder.js` 一筆。Speech API 呼叫為 POST → `method!=='GET'` 直通（sw.js:98），零排除特例。PRECACHE 重量成本照付（18 張券圖重抓，既知既受）。

---

## 9. spec 縫隙補完（分析重點 8，backend 依此實作、QA 依此出案）

| # | 縫隙 | 定案 |
|---|------|------|
| G1 | **模式切換時 state ≠ idle**（錄音中按 segmented 切「文字」） | 切模式即 `_abortTalk()`（abort＋cancel＋清 timer＋回 idle）再切容器；spec 只寫了切分頁沒寫切模式，此為同型漏洞 |
| G2 | `start()` pending 期間（getUserMedia 權限彈窗中）再點 | 按下 🎤 即刻雙鈕 disabled，start() resolve 進 recording／reject 回 idle 才恢復；防 pending 中重入 |
| G3 | 60 秒計時器清理路徑 | 手動停止、abort（切分頁/切模式）、start 失敗，**所有離開 recording 的路徑都清 timer**；逾時觸發等同按停止（先清 timer 再 stop）。雙觸發保護：逾時 handler 與停止鈕都先檢查 state===recording |
| G4 | 自動播 ja 的完整條件 | translate 為當前分頁 **且** 模式仍為 'talk'（in-flight 期間切文字模式也不該播）；氣泡照 append |
| G5 | `stop()` 非錄音中呼叫 | recorder reject `{code:'OTHER'}`；translate-tab 狀態機保證不會打到，防禦性 |
| G6 | `durationMs` 無消費者 | 依 §5.2 定義實作，本輪不接 UI |
| G7 | 錄音中 iOS 退背景／來電（不觸發 showTab） | **零碼處置**：回前景後按停止，得部分音或 NO_AUDIO 文案，可重錄；QA 不列 FAIL 項，記入已知邊界 |
| G8 | TTS 16ms 疊音縫 | 建議順手修（§2.4）；不修則列已知微縫 |
| G9 | 氣泡 append 後捲動 | `.talk-history` 捲到最底（§7） |
| G10 | Speech 多 results 段 | 只取 `results[0]`，與探針一致，接受限制 |
| G11 | NO_KEY 在錄完送辨識才報 | 接受（金鑰隨站部署，正式環境不會發生；不做錄音前預檢） |
| G12 | transcript >500 字 | 截斷至 500 再送翻譯（spec §9 已定，列此供 QA 對照——60 秒口語實際打不到） |

---

## 10. Backend 注意事項

1. **改 tts.js 時**：3 個單參呼叫點中只有 bigtext.js:117 准動（§2.1）；`_pickVoice` 精確優先於前綴（§2.2）；建議連 16ms pending timer 一起修（§2.4）。
2. **改 bigtext.js 時**：只准動 `_lang` 相關（存取＋speak 鈕帶參）；`_lang` 每次 showBigText 重設（§2.3）；B1–B6 其餘零變化。
3. **改 api.js 時**：只在端點層追加；空結果語意與 translate 相反（resolve ''，§4.2）；語言碼兩套不可混用（§4.3 grep 判準）。
4. **改 translate-tab.js 時**：§6.1 的 16 個既有單元零 diff；wrap 照 §5.5 四條約束（尤其 TTS cancel 的當前分頁條件——否則破壞常用句播音）；狀態機縫隙照 §9。
5. **寫 recorder.js 時**：照搬探針、遵守 R1–R8（§5.1）；純錄音編碼層，不碰 DOM/localStorage/API/TTS；60 秒計時歸 translate-tab（recorder 純被動）。
6. **Task12.api.md**：contract 擴充宣告（speak lang／showBigText lang／App.recorder／App.api.speechToText／wrap 鏈三層現況），註明 Task2.api.md 原簽名仍有效。
7. 交付前自驗證據：探針刪除後全 repo grep 零引用（§8.1）＋spec QA 界線的 6 項機械判準先自跑一遍。

## 11. Frontend 注意事項

1. 外殼掛法照 §6.2（`.translate-container` 保持 section 直接子元素）；佈局照 §6.3（flex 紀律、雙捲防呆）。
2. 兩顆麥克風鈕高 ≥60px 各半寬、錄音中「■ 停止」變色＋脈動；segmented ≥44px；氣泡動作鈕 ≥44px。
3. **無 interim 字幕是本版最大 UX 差異**：recording 狀態的動畫＋文案必須顯著（補償「有在錄」的回饋）。
4. 氣泡譯文大字 ≥22px 量級，硬編碼、不用 `--fs-*`；文字色 `--c-accent-text`；不新增深底 overlay。
5. `App.recorder.isAvailable === false`：雙鈕 disabled＋「此瀏覽器不支援錄音，請改用文字模式」。
6. 既有 `.translate-*` CSS 選擇器零 diff（§6.3 判準）。

## 12. QA 迴歸測試清單

既有功能迴歸（機械判準優先）：

- [ ] git diff 盤點：phrases-tab.js／trip-tab.js／app.js／coupon-viewer.js／coupons-tab.js／import-data.js／tripdata.js／phrases.js 零 diff
- [ ] api.js：`_getKey`/`ErrorCode`/`_classifyError`/`_postJson`/`translate` 零 diff；speechToText 僅端點層、走 `_postJson`（POST-only）
- [ ] tts.js：`App.speak(單參)` 3 呼叫點中 phrases-tab:186／translate-tab:289 零 diff；`isAvailable`/`cancel` 語意不變；`_pickVoice('ja-JP')` 在無精確命中時前綴退化 = 舊行為
- [ ] bigtext：`showBigText` 不帶 lang 3 呼叫點零 diff；**_lang 殘留測試**——先 `showBigText({ja:'中文字', lang:'zh-TW'})` 關閉後再 `showBigText({ja:'日文'})`，播音鈕須以 ja-JP 發聲（mock App.speak 驗第二參數）
- [ ] wrap 鏈三層 call-through：切分頁同時關券檢視器＋關大字＋（translate 錄音中）abort；**常用句播音中切分頁不被 cancel（無 overlay 時）**——新 wrap 不得誤殺
- [ ] 翻譯文字模式 Task5 全迴歸：方向記憶／切換清空／500 上限／五錯誤文案／大字／播音／複製；預設落在對話模式、一鍵切回文字
- [ ] 行程：飯店地址 ja-only 大字置中＋播音
- [ ] sw.js：CACHE_VERSION==='v11'；PRECACHE 相對 v10 僅 +`./js/recorder.js`
- [ ] `voice-test.html`、`speech-test.html` 已刪；全 repo grep 零引用
- [ ] localStorage：新 key 僅 `tokyotrip.translateMode`；全 repo 無 `localStorage.clear()`
- [ ] 語言碼判準：`cmn-Hant-TW` 只出現在 speechToText 語境；speechToText 引數集合 = {'cmn-Hant-TW','ja-JP'}
- [ ] 離線：APP 照常可開；對話模式操作顯示 OFFLINE 文案

新功能（對話模式）由 QA 依 spec 驗收：mock `App.recorder`／`App.api.speechToText`／`App.api.translate` 走狀態機全路徑（含 §9 G1–G5 縫隙案例：錄音中切模式、切分頁、60 秒逾時、pending 重入、空 transcript）。真錄音鏈已 de-risk、真對話 E2E 歸 Olina 部署後 iPhone 流程外驗收（referer 鎖 github.io，localhost 真呼叫必 403）。

---

## 附註（回報 PM，不阻擋開工）

- `specs/INDEX.md` 檔頭金鑰 API 限制清單仍寫「Translation＋Vision」兩個，現況已是三個（＋Speech-to-Text，spec §背景已載）——PM 下次動 INDEX 時順手更新。
- SYSTEM_MAP 舊預埋條目「Task12 起 wrap 鏈為兩層」與「speech.js 封裝」兩處與本版事實不符，SA 已於本輪修正（見 SYSTEM_MAP 人工補充區）。
