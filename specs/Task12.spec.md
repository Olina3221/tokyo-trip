# Task12.spec.md — 翻譯分頁「對話語音模式」（中⇄日語音對話即時互譯，Google Speech-to-Text 版）

> **本版（2026-07-12）為重大改寫：語音辨識引擎由「瀏覽器內建 webkitSpeechRecognition」改為 Google Cloud Speech-to-Text API。**
> 舊版 spec（瀏覽器內建版）與其 SA 分析（舊 `Task12.impact.md`、`Task12.sa_done`）已作廢刪除，SA 須對本版重新做影響分析。

## 模組：translate 分頁 對話語音模式（voice conversation mode）

### 功能描述

在既有翻譯分頁內新增「對話模式」：按🎤說中文→錄音→Google Speech 辨識→翻日文→**自動用日文語音唸出**給對方聽；對方按🎤說日文→辨識→翻中文顯示給 Olina 看。目標：Olina 只靠這一個 APP 就能跟日本人對話。

### 背景與已拍板決策（不重議）

- 已完成：Task5 文字翻譯已閉環上線（`App.api.translate`、translate-tab.js、金鑰版控化、sw.js v10）。Task2 的 `App.speak`（日文 TTS）與 `App.showBigText` 為跨 Task 契約。
- 已拍板（Olina 實機提出，附 Google 翻譯對話模式截圖，重要升級）：要語音對話即時互譯，不只打字。
- **已拍板（翻轉舊決策，不重議）：語音辨識改走 Google Cloud Speech-to-Text API，不用瀏覽器內建 `webkitSpeechRecognition`**——Olina 為可靠度改的決定（「到國外什麼都不方便、穩一點」）。
- **已 de-risk（探針 `speech-test.html`，本 Task 完成時清除）**：錄音（getUserMedia + AudioContext/ScriptProcessor）→ LINEAR16@16kHz 編碼 → POST Google Speech `speech:recognize` 的完整鏈，已在 Olina 的 iPhone **Safari 與主畫面 PWA 模式**實測，中文 `cmn-Hant-TW` 與日文 `ja-JP` 皆辨識成功。**錄音演算法 backend 直接參考 `speech-test.html` 搬用（刪檔前搬）。**
- **金鑰已就緒**：Olina 已在 Google Cloud 啟用 Cloud Speech-to-Text API 並加入金鑰的 API 限制（現允許 Translation + Vision + Speech-to-Text 三個）。同一把金鑰、同 `js/config.js`，無新金鑰工作。
- 翻譯重用 Task5 `App.api.translate`（已上線）；語音播放重用 Task2 `App.speak`，但需擴充支援中文（見 §雙向 TTS）。
- 排序：Olina 最在意對話模式，**Task12 排在 Task6（拍照 OCR）之前**。

### 涉及範圍

- [x] 後端／核心邏輯（新檔 recorder.js 錄音/編碼封裝、api.js 加 speechToText 端點、tts.js 雙語擴充、bigtext.js lang 擴充、translate-tab.js 模式狀態機與對話流程、sw.js bump、index.html script、voice-test.html＋speech-test.html 清理、Task12.api.md）
- [x] 前端／UI（對話模式版面：語言列、氣泡歷史、雙麥克風大按鈕、錄音動畫，淺色主題樣式）

---

## 結構定案（PM 已定，不重議）

1. **併入既有 translate 分頁，加「文字／對話」模式切換**，不新增第 6 個底部分頁（現有 5 頁已滿，再加會擠壓 Task11 才放大的導覽列）。分頁頂部放兩段式切換（segmented control）：`文字`｜`對話`。
2. **文字模式 = Task5 既有 UI 與邏輯，零變更**——模式切換只是外殼（顯示/隱藏容器），Task5 的輸入框、方向切換、錯誤文案、`tokyotrip.translateDir` 行為原封不動。
3. **模式記憶**：新 localStorage key `tokyotrip.translateMode`，值 `'text'`｜`'talk'`；**預設 `'talk'`（對話）**——對話是本行程主用途，文字模式一鍵可達；壞值 fallback `'talk'`；讀寫包 try/catch（私密瀏覽降級）。
4. **對話結果採「對話氣泡歷史」**（同截圖/Google 翻譯樣式）：比只顯示最新一則好用——對話有來回，看得到上下文；**歷史只存記憶體**（跨分頁切換保留、關 APP 即清），**不進 localStorage**（對話內容可能含隱私，且無跨日保留需求）。上限 50 則，超過丟最舊。
5. **頂部語言列為靜態標示**「🇹🇼 中文 ⇄ 🇯🇵 日文」，**不做語言切換鈕**——本 APP 只支援中日，方向由底部兩顆麥克風決定，切換鈕無事可切、徒增誤觸。
6. **錄音 UX 定案：「按一下開始錄音 → 再按一下停止並辨識」（tap-tap，非按住說話）**。理由：(a) 這正是 de-risk 探針驗證過的互動流，零額外風險；(b) iOS 上長按有 touch-cancel、誤觸選單、手指滑出目標即中斷等陷阱，對長輩同行者不友善；(c) 非串流架構本來就是「收完整句再送」，tap-tap 與之天然對齊。錄音中該鈕變為明顯的「■ 停止」狀態（變色＋脈動動畫），另一顆語言鈕 disabled。

---

## 對話模式 UI（frontend）

版面（`#tab-translate` 內，對話模式容器，由上而下）：

```
div.talk-lang-bar            ← 語言列（靜態）：🇹🇼 中文  ⇄  🇯🇵 日文
div.talk-history             ← 氣泡歷史區（主捲動區，flex:1）
  div.talk-bubble.talk-zh2ja ← 中→日氣泡（靠右）：原文中文小字＋日文譯文大字
  div.talk-bubble.talk-ja2zh ← 日→中氣泡（靠左）：原文日文小字＋中文譯文大字
    div.talk-bubble-actions  ← 每則氣泡：🔊重播、⤢大字 兩鈕
div.talk-status              ← 中央狀態區（flex-shrink:0）：
                                idle=麥克風圖示＋提示「按下方按鈕開始說話」
                                recording=脈動動畫＋「錄音中…說完再按一次停止」
                                recognizing=「辨識中…」
                                translating=「翻譯中…」
div.talk-mic-row             ← 底部兩顆大按鈕（flex-shrink:0）
  button.talk-mic-zh         ← 🎤 中文（我說）
  button.talk-mic-ja         ← 🎤 日文（對方說）
```

UI 要求：
- 兩顆麥克風按鈕是全 APP 最重要的按鈕：**觸控目標遠大於 44px 下限（建議高 ≥60px、各占半寬）**，中文鈕與日文鈕視覺可區分（如主色/描邊差異），錄音中按鈕有明顯「停止」狀態（變色＋動畫＋圖示換 ■）。
- **無串流即時字幕**（Google Speech 非串流版沒有 interim 結果）：錄音中狀態區以動畫＋文案回饋「有在錄」，這是與舊版最大的 UX 差異，frontend 把「錄音中」做得夠明顯來補償。
- 譯文是氣泡主角：**大字好讀**（氣泡譯文字級 ≥22px 量級由 frontend 定，**不得引用 `--fs-*` 變數**——Task10 紀律，僅授權 `.trip-*`）。
- 氣泡動作鈕：`🔊 重播`（用對應語言重唸譯文）、`⤢ 大字`（開 bigtext overlay 給對方看）。觸控目標 ≥44px。
- 淺色主題：走全域 CSS 變數；文字色用 `--c-accent-text` 不用 `--c-accent`（Task8 對比紀律）。**不新增深底 overlay**（重用 bigtext，無新 z-index 需求）。
- `.tab-section` flex 紀律（Task11）：`.talk-lang-bar`、`.talk-status`、`.talk-mic-row` 皆須 `flex-shrink: 0`，捲動只發生在 `.talk-history`。
- 模式切換 segmented control 本身觸控目標 ≥44px。
- 不支援錄音的環境（`App.recorder.isAvailable === false`）：兩顆麥克風鈕 disabled＋狀態區顯示「此瀏覽器不支援錄音，請改用文字模式」。

---

## 錄音／編碼封裝（backend，新檔 `js/recorder.js`）

比照 api.js 紀律：**純錄音＋編碼層，不碰 DOM／localStorage／API 呼叫／TTS**。演算法直接搬 `speech-test.html`（已 iPhone 實證）。掛 `window.App.recorder`：

```js
App.recorder = {
  isAvailable,   // Boolean：!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
                 //          && !!(window.AudioContext || window.webkitAudioContext)
  isRecording,   // Boolean getter：是否錄音中
  start(),       // Promise<void>：getUserMedia 成功、開始收音後 resolve；
                 //   失敗 reject({ code: App.recorder.ErrorCode.* })
  stop(),        // Promise<{ base64, durationMs }>：停止收音→合併→重取樣 16kHz
                 //   →Int16 LINEAR16→base64；沒錄到聲音 reject({ code: 'NO_AUDIO' })
  abort(),       // 同步：停止並丟棄，釋放資源，靜默無回傳
};
```

實作要點（皆為 speech-test.html 已驗證行為，backend 照搬）：
- 收音：`getUserMedia({ audio: true })` → `AudioContext`（含 `webkitAudioContext` 前綴 fallback；`state === 'suspended'` 時 `resume()`）→ `createMediaStreamSource` → `createScriptProcessor(4096, 1, 1)`，`onaudioprocess` 收 `Float32Array` 進 buffers；processor 須 `connect(audioCtx.destination)`（iOS 不接不觸發）。
- 編碼（於 `stop()`）：合併 buffers → 線性內插重取樣至 16000Hz → Float32 clamp [-1,1] 轉 Int16（LINEAR16）→ 分塊（0x8000）`String.fromCharCode` + `btoa` 轉 base64。
- 資源釋放（`stop()`／`abort()` 皆須）：`processor.disconnect()`、`source.disconnect()`、`stream.getTracks().forEach(t => t.stop())`、`audioCtx.close()`，全包 try/catch。**每次錄音新建 AudioContext、用完即關**（iOS 對常駐 AudioContext 不友善，探針即此模式）。
- **同時只允許一個錄音實例**：`start()` 時若已在錄音，先 `abort()` 舊的再開新的。
- **iOS 紅線：`start()` 必須由 user gesture 觸發**（按鈕 click/touch handler 內呼叫），不得自動啟動。

錯誤碼枚舉 `App.recorder.ErrorCode`（recorder 只回碼，文案歸 translate-tab.js）：

| ErrorCode | 觸發 | translate-tab.js 固定文案（frontend 可潤飾排版） |
|-----------|------|--------------------------------------------------|
| `MIC_DENIED` | getUserMedia `NotAllowedError`/`SecurityError` | 「麥克風權限被拒。請到 iOS 設定開啟本 APP 的麥克風權限後，再按一次麥克風重試」 |
| `MIC_UNAVAILABLE` | `NotFoundError`/`NotReadableError` 等 | 「找不到可用的麥克風」 |
| `NO_AUDIO` | stop 時 buffers 為空 | 「沒錄到聲音，請再按一次麥克風重試」 |
| `NOT_SUPPORTED` | isAvailable === false 仍被呼叫 | 「此瀏覽器不支援錄音，請改用文字模式」 |
| `OTHER` | 其餘 | 「錄音失敗，請重試」 |

權限被拒後**不鎖死**：麥克風鈕維持可按（每次按都重試 getUserMedia），使用者去 iOS 設定開權限回來即可直接用，無需重開 APP 提示以外的複雜流程。

---

## Speech API 端點（backend，`js/api.js` 端點層追加）

**重用既有三層設計：金鑰層、傳輸層（`_postJson`＋`_classifyError`＋POST-only 硬約束）零改動，只在端點層追加**（與檔頭「Task6 在此追加」同一擴充模式；Speech 端點網域不同但同金鑰、同 POST、同 Google 錯誤體格式）：

```js
/**
 * App.api.speechToText(base64Audio, languageCode)
 * @param {string} base64Audio  LINEAR16@16kHz 的 base64（App.recorder.stop() 產物）
 * @param {string} languageCode 'cmn-Hant-TW'（中文）| 'ja-JP'（日文）
 * @returns {Promise<string>} 辨識文字；回應正常但無 results 時 resolve ''（空字串）
 *          或 reject({ code: ErrorCode.*, message })
 */
```

- URL：`https://speech.googleapis.com/v1/speech:recognize?key=<金鑰>`（金鑰同 `_getKey()`，無 key 時 reject `NO_KEY`，同 translate）。
- Body：`{ config: { encoding: 'LINEAR16', sampleRateHertz: 16000, languageCode: <languageCode> }, audio: { content: <base64> } }`。
- 取值：`results[0].alternatives[0].transcript`；**回應 2xx 但無 results（沒聽清楚）→ resolve `''`**，由 translate-tab 對映「沒聽清楚」文案，不視為錯誤（探針實測過此路徑）。
- **錯誤碼沿用既有枚舉，不新增**：`NO_KEY`/`OFFLINE`/`HTTP_403`/`HTTP_429`/`HTTP_OTHER`。403 在 Speech 語境多一種成因（Speech-to-Text API 未啟用或金鑰未含此 API），文案見下表；分類器 `_classifyError` 零改動。
- `translate()` 函式**一行 diff 都不得有**（機械判準）。

translate-tab.js 對 Speech API 錯誤的文案對映：

| ErrorCode | 文案 |
|-----------|------|
| `NO_KEY` | 沿用 Task5 既有 NO_KEY 文案 |
| `OFFLINE` | 「語音辨識需要網路連線」 |
| `HTTP_403` | 「語音辨識服務未授權（API 未啟用、金鑰限制或網域限制）」 |
| `HTTP_429` | 「今日用量已滿，請稍後再試」 |
| `HTTP_OTHER` | 「語音辨識失敗，請重試」 |
| （resolve `''`） | 「沒有聽清楚，請再說一次」（不 append 氣泡、不送翻譯） |

**語言碼對照（backend 留意，兩個 API 的碼不同）**：

| 方向 | STT `languageCode` | 翻譯 `source → target` | TTS lang |
|------|--------------------|------------------------|----------|
| 中→日 | `cmn-Hant-TW` | `zh-TW → ja` | `ja-JP`（自動播） |
| 日→中 | `ja-JP` | `ja → zh-TW` | `zh-TW`（僅重播鈕） |

---

## 對話流程（backend，translate-tab.js 對話模式狀態機）

狀態機：`idle → recording → recognizing → translating → idle`。

1. idle 時按 `🎤 中文` →（先 `App.speak.cancel()` 清掉播音中的 TTS，防喇叭聲被麥克風收進去）→ `App.recorder.start()` → 成功進 `recording`：該鈕轉「■ 停止」狀態、另一鈕 disabled、狀態區顯示錄音動畫；失敗顯示上表 recorder 錯誤文案、留在 `idle`。
2. `recording` 中再按同一顆鈕（現為「■ 停止」）→ `App.recorder.stop()` → 進 `recognizing` → `App.api.speechToText(base64, 'cmn-Hant-TW')` → 得到 transcript → 進 `translating` → `App.api.translate(transcript, 'zh-TW', 'ja')` → 成功：append 中→日氣泡（原文中文小字＋日文譯文大字）→ **自動 `App.speak(ja結果, 'ja-JP')` 唸給對方聽** → 回 `idle`。
3. 按 `🎤 日文` → 同流程：`speechToText(base64, 'ja-JP')` → `translate(text, 'ja', 'zh-TW')` → append 日→中氣泡 → **不自動播中文**（結果是給 Olina 看的，自動唸反成干擾；氣泡 🔊 重播鈕可手動用 `App.speak(zh結果, 'zh-TW')` 唸）→ 回 `idle`。此為 PM 定案；Olina 實機若要自動播再開調整 Task。
4. **錄音上限 60 秒**：達上限自動觸發停止並辨識（等同按停止）——防忘記按停止，也守住 Speech 同步辨識 1 分鐘上限。由 translate-tab 計時觸發（recorder 保持純被動）。
5. `recognizing`／`translating` 中兩鈕皆 disabled（防連點，比照 Task5 `_isTranslating`）。
6. 氣泡 `⤢ 大字`：中→日氣泡 → `App.showBigText({ ja: 日文譯文, zh: 中文原文 })`（沿用 Task2 契約）；日→中氣泡 → `App.showBigText({ ja: 中文譯文, lang: 'zh-TW' })`（主文字槽放中文、overlay 播音鈕唸中文，見 §雙向 TTS 的 bigtext 擴充；不帶 zh/romaji，ja-only 置中版面）。
7. 氣泡 `🔊 重播`：中→日 → `App.speak(ja譯文, 'ja-JP')`；日→中 → `App.speak(zh譯文, 'zh-TW')`。氣泡動作鈕僅 `idle` 時作用（防錄音中 TTS 回授）。
8. 錄音／辨識錯誤 → 狀態區顯示對應文案、回 `idle`，不 append 氣泡；辨識空結果（`''` 或 trim 後空）→「沒有聽清楚」文案、不送翻譯；翻譯錯誤 → 沿用 Task5 五種 `App.api.ErrorCode` 文案顯示於狀態區、回 `idle`（**辨識到的原文保留顯示於狀態區**，避免使用者白說一次）。
9. transcript 超過 500 字（`App.api.translate` 上限沿用 Task5 呼叫端保證）：截斷至 500 送翻譯（口語單句幾乎不可能觸及，不做複雜 UI）。
10. 切走分頁：進行中的錄音 `App.recorder.abort()`＋`App.speak.cancel()`；in-flight 的辨識/翻譯 Promise 結果照 append 氣泡，但自動播 ja 僅限 translate 仍為當前分頁。氣泡歷史記憶體保留（切回仍在），onShow 冪等（DOM 只建一次）。

---

## 雙向 TTS（backend，tts.js 擴充；不破壞既有契約）

**`App.speak(text, lang)`——第二參數選填，預設 `'ja-JP'`。**

- 既有呼叫 `App.speak(jaText)`（phrases-tab、bigtext、translate-tab 中→日）**零修改、行為完全不變**——這是機械判準：既有呼叫點一行 diff 都不該有。
- `lang = 'zh-TW'` 時：utterance.lang 設 `'zh-TW'`；voice 挑選把現況 `_pickJaVoice()` 一般化：**完整 lang 精確比對優先 → 前綴（`lang.split('-')[0]`）次之 → null 讓系統自選**（iOS zh-CN 可能搶 zh 前綴第一位，故精確優先；沿用 B4 精神：不因清單空就放棄）。iOS 有內建中文語音。
- cancel-then-speak、16ms 延遲、utterance 參照保留、失敗靜默等 B4 行為契約全數不變，適用兩種語言。
- `App.speak.isAvailable`、`App.speak.cancel()` 簽名與語意不變。

**`App.showBigText` 擴充（bigtext.js，additive）**：選項物件新增選填欄 `lang`（預設 `'ja-JP'`），只控制 overlay 內播音鈕的 `App.speak(ja, lang)` 語言；每次呼叫重設（防前次殘留）；同時在 Task12.api.md 文件化「`ja` 欄位語意 = 主文字槽（歷史命名），日→中大字時放中文」。既有呼叫（不帶 lang）行為零變化。**本擴充由本 spec 授權（契約異動須經 PM 開 Task——就是本 Task）；backend 須在 `Task12.api.md` 內做契約擴充宣告（比照 Task5.api.md 的 A3 改版宣告格式），註明 Task2.api.md 原簽名仍有效、本檔為擴充權威。**

---

## 沿用契約與工程面（backend）

- `App.registerTab('translate', { onShow })` 既有註冊不變；onShow 冪等。
- **載入順序（index.html）**：`recorder.js` 插在 `api.js` 之後、`translate-tab.js` 之前：`… api.js → recorder.js → translate-tab.js → coupon-viewer.js …`。（舊版規劃的 `js/speech.js` **取消、不建**。）
- 相對路徑 `./`。
- **sw.js**：`./js/recorder.js` 加入 PRECACHE_URLS（本 Task 僅此一筆新增）；`CACHE_VERSION` bump（開工時實際值 +1；現況 v10 → 預期 v11）。Speech API 呼叫為 POST，天然不觸 sw.js cache-first（POST-only 硬約束延續，無需排除特例）。
- localStorage 新 key 登記：`tokyotrip.translateMode`（見結構定案 §3）。清除只准 removeItem 自己的 key，禁 `localStorage.clear()`。
- 對話歷史**不進 localStorage**（隱私＋無需求）。

## 清理（backend，本 Task 一併完成）

兩個 de-risk 探針都清掉：

- **刪除根目錄 `voice-test.html`**（瀏覽器內建辨識探針，該方案已棄）。
- **刪除根目錄 `speech-test.html`**（Google Speech 錄音鏈探針，演算法搬進 recorder.js 後即無存在理由）。**先搬演算法再刪檔。**
- 兩檔刪除後 grep 確認：不在 PRECACHE_URLS、index.html 與任何 js 無引用。

---

## 邊界條件 / 錯誤處理

- `App.recorder.isAvailable === false`：麥克風鈕 disabled＋提示改用文字模式；文字模式完全可用。
- 離線：辨識/翻譯 fetch 失敗回 `OFFLINE`，各顯示對應文案；APP 本體照常離線可開（recorder 本身不需網路，但送辨識需要）。
- 麥克風權限被拒：`MIC_DENIED` 文案＋可直接重按重試（見 §錄音封裝——不鎖死）。
- 辨識空結果（無 results 或 trim 後空字串）：「沒有聽清楚」文案，不送翻譯、不 append 氣泡。
- 錄音 60 秒上限自動停止（見對話流程 §4）。
- 私密瀏覽 localStorage 不可寫：try/catch 降級，模式切換仍可用（只是不記憶）。
- 連點防護：`recognizing`/`translating` 中鈕 disabled；`App.recorder.start()` 內部 abort 舊實例雙保險。

## QA 驗收界線（比照 Task5）

- Windows 側驗：靜態驗證＋mock（`App.recorder`／`App.api.speechToText`／`App.api.translate` 皆可 mock）＋既有契約迴歸——重點機械判準：
  1. 既有 `App.speak(單參數)` 呼叫點零 diff；
  2. 文字模式（Task5）全部既有行為零變化，`App.api.translate` 函式零 diff；
  3. sw.js bump v11＋PRECACHE 僅新增 recorder.js；
  4. `voice-test.html` 與 `speech-test.html` 皆已刪除，PRECACHE/index.html/js 無殘留引用；
  5. 新 localStorage key 只有 `tokyotrip.translateMode`；
  6. api.js 傳輸層（`_postJson`/`_classifyError`）零 diff，speechToText 僅端點層追加、POST-only。
- **真錄音→辨識鏈已 de-risk**（Olina iPhone Safari＋PWA 實測成功），QA 不需真機重證；**真對話 E2E（真麥克風、真金鑰、真 TTS 手感）歸 Olina 部署後 iPhone 流程外驗收**（同 Task5 referer 鎖 github.io，localhost 真呼叫必 403，QA 走 mock）。

## 不在本次範圍（Non-scope，必填護欄）

- 不做拍照 OCR（Task6 另案）、不做部署自動化（Task7）。
- 不碰行程／常用句／折價券分頁。
- **不改 Task5 文字翻譯的既有行為**——只並存新增對話模式；模式切換外殼是唯一授權的 translate-tab 既有碼變動。
- **不用瀏覽器內建 `webkitSpeechRecognition`**（已拍板棄用）、不建 `js/speech.js`。
- 不做串流辨識（`streamingRecognize`/WebSocket）、不用 MediaRecorder/AudioWorklet 改寫錄音鏈（ScriptProcessor 雖 deprecated 但為 iOS 實證可用方案，本輪不追新）。
- 不用 Google Cloud TTS（TTS 維持瀏覽器內建 speechSynthesis）。
- 不做中日以外的第三語言、不做語言切換鈕。
- 不做對話歷史持久化（localStorage／匯出）。
- 不做連續聆聽／自動輪替收音（每句都由按鈕觸發，iOS user-gesture 紅線也不允許自動）。
- 不改全域 viewport meta、不動 `--fs-*` 授權範圍、不新增深底 overlay。
- 不改 schema／不碰正式資料（本專案無 DB；tripdata.js 零變更）。

---

## 影響範圍分析（SA）

> 2026-07-12 完成（Google Speech 版）。全文見 `Task12.impact.md`（唯一有效版本），此處為摘要。
> 涉及範圍：後端＋UI → pipeline 走完整鏈（sa_done → backend → backend_done → frontend → done → QA）。

### 受影響的既有功能

| 功能 | 頁面 / 函式 | 影響說明 | 需迴歸測試 |
|------|------------|---------|-----------|
| 常用句播音／大字 | phrases-tab.js:186／:163 | tts 一般化＋bigtext lang 擴充波及；呼叫點零 diff、行為零變化 | ✅ |
| 行程飯店地址大字 | trip-tab.js:452（ja-only） | overlay 單例 `_lang` 殘留風險——showBigText 每次呼叫必重設 | ✅ |
| 翻譯文字模式 | translate-tab.js（Task5 全行為） | 模式外殼是唯一授權變動；16 個既有單元（10 具名函式＋6 handler）零 diff | ✅ |
| 大字 overlay 播音鈕 | bigtext.js:117 | 授權例外：改帶 `_lang`（預設 ja-JP 行為不變） | ✅ |
| 分頁切換 wrap 鏈 | showTab（全站） | **現況已兩層（coupon-viewer→bigtext），Task12 後三層**；translate-tab wrap 的 TTS cancel 必加「translate 為當前分頁」條件，否則誤殺常用句播音 | ✅ |
| 折價券檢視器 | coupon-viewer.js（零 diff） | wrap 鏈多一層，切分頁自動關需迴歸 | ✅ |
| 翻譯 API／離線快取 | api.js translate／sw.js | 端點層追加 speechToText（傳輸層零 diff、空結果 resolve '' 與 translate 相反）；v10→v11、PRECACHE 僅 +recorder.js | ✅ |

### Backend 注意事項（詳見 impact §10）
- `App.speak` 單參呼叫點恰 3 處，僅 bigtext.js:117 准動；`_pickVoice` 精確比對優先於前綴（iOS zh-CN 陷阱）；建議順修 tts 16ms pending timer 疊音縫。
- 語言碼兩套不可混用：`cmn-Hant-TW` 只准出現在 speechToText 語境（grep 判準）。
- recorder.js 照搬探針、守 R1–R8（destination 必接、每次新建 AudioContext、sampleRate 先讀再 close、資源釋放 try/catch、user gesture 順序不得反轉）。
- wrap／狀態機縫隙 G1–G12 定案見 impact §5.5、§9（含：切模式時 state≠idle 須 abort、60 秒 timer 所有離開路徑必清、自動播 ja 條件 = translate 當前分頁且模式仍 talk）。

### Frontend 注意事項（詳見 impact §11）
- 外殼掛法：segmented＋`.translate-container`＋`.talk-container` 三個 section 平行直接子元素（保住 style.css:1647「直接 flex 子元素」前提）；對話容器 flex:1＋min-height:0，捲動只在 `.talk-history`。
- 既有 `.translate-*` CSS 選擇器零 diff；無 interim 字幕→「錄音中」回饋必須顯著。

### QA 迴歸測試清單（完整版見 impact §12）
- [ ] 八個不該動的檔零 diff＋api.js 傳輸層／translate 零 diff
- [ ] `_lang` 殘留測試（zh 大字後 ja-only 大字播音須 ja-JP）
- [ ] wrap 三層 call-through＋常用句播音中切分頁不被 cancel
- [ ] 翻譯文字模式 Task5 全迴歸；sw v11／PRECACHE 僅 +recorder.js；探針兩檔已刪零引用；新 key 僅 translateMode
- 新功能由 QA 依 spec＋impact §9 縫隙案例 mock 驗收；真對話 E2E 歸 Olina 流程外。
