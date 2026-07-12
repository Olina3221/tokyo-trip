# Task12.api.md — 對話語音模式介面契約

> Task12 Backend 交 Frontend 的函式介面說明。
> Task2.api.md 原簽名仍有效；本檔為 Task12 擴充的契約權威。

---

## ★ 契約擴充宣告

本檔擴充以下既有 API（Task2.api.md 原簽名仍有效，本檔為擴充部分的唯一權威）：

1. `App.speak(text, lang)` — 第二參數 `lang` 選填（預設 `'ja-JP'`），既有單參呼叫零變化。
2. `App.showBigText({ ja, zh, romaji, lang })` — 新增選填欄 `lang`；`ja` 欄語意 = 主文字槽（歷史命名），日→中大字時放中文。
3. `App.showTab` wrap 鏈由兩層擴為三層（見下方）。

---

## App.recorder（js/recorder.js）

```js
App.recorder = {
  isAvailable,   // Boolean：環境支援錄音
  isRecording,   // Boolean getter：是否錄音中
  start(),       // Promise<void>：getUserMedia 成功、開始收音後 resolve
                 //   失敗 reject({ code: App.recorder.ErrorCode.* })
  stop(),        // Promise<{ base64, durationMs }>：停止→重取樣→LINEAR16→base64
                 //   非錄音中呼叫 reject({ code: 'OTHER' })
                 //   沒錄到聲音 reject({ code: 'NO_AUDIO' })
  abort(),       // 同步：停止並丟棄，靜默無回傳
  ErrorCode,     // 見下方
}
```

### App.recorder.ErrorCode

| ErrorCode | 觸發條件 |
|-----------|---------|
| `MIC_DENIED` | getUserMedia `NotAllowedError`/`SecurityError` |
| `MIC_UNAVAILABLE` | `NotFoundError`/`NotReadableError` 等 |
| `NO_AUDIO` | stop 時 buffers 為空 |
| `NOT_SUPPORTED` | isAvailable === false 仍被呼叫 |
| `OTHER` | 其餘，或 stop() 在非錄音中被呼叫 |

### iOS 實作要點（frontend 呼叫時需知）

- `start()` **必須在 user gesture handler（button click）內呼叫**，不得自動觸發。
- `isAvailable` 為 false 時麥克風鈕應 disabled + 顯示說明文案。
- 同時只允許一個錄音實例；`start()` 內部會 abort 舊實例（但呼叫端狀態機應避免）。

---

## App.api.speechToText（js/api.js 端點層追加）

```js
App.api.speechToText(base64Audio, languageCode)
// → Promise<string>  辨識文字（可能為空字串 ''，代表沒聽清楚，不是錯誤）
// → Promise.reject({ code: App.api.ErrorCode.*, message })
```

| 參數 | 型別 | 說明 |
|------|------|------|
| `base64Audio` | string | LINEAR16@16kHz 的 base64，由 `App.recorder.stop()` 產生 |
| `languageCode` | string | 見下方語言碼對照；**只接受** `'cmn-Hant-TW'`（中文）或 `'ja-JP'`（日文） |

- 2xx 但無 results → **resolve `''`**（沒聽清楚，不是錯誤）。
- 錯誤碼沿用 `App.api.ErrorCode`（NO_KEY/OFFLINE/HTTP_403/HTTP_429/HTTP_OTHER），不新增。

---

## 語言碼對照（兩套不可混用）

| 方向 | STT `languageCode` | 翻譯 `source → target` | TTS `lang` |
|------|--------------------|------------------------|------------|
| 中→日 | `cmn-Hant-TW` | `zh-TW → ja` | `ja-JP`（自動播） |
| 日→中 | `ja-JP` | `ja → zh-TW` | `zh-TW`（僅重播鈕） |

**grep 判準**：`cmn-Hant-TW` 只准出現在 `speechToText` 的 `languageCode` 引數語境，不得出現在 `translate()` 或 `App.speak()` 的引數。

---

## App.speak 擴充（js/tts.js）

```js
App.speak(text, lang)   // lang 選填，預設 'ja-JP'
```

- 既有呼叫 `App.speak(jaText)`（單參）**零 diff，行為完全不變**。
- Task12 新增用法：`App.speak(zhText, 'zh-TW')`。
- `App.speak.isAvailable`、`App.speak.cancel()` 簽名語意零變化。
- `_pickVoice(lang)` 挑選順位：精確 lang 比對 → 前綴 → null（B4 精神）。
- 16ms pending timer 疊音縫修復（§2.4）：`speak()` 與 `cancel()` 開頭皆 `clearTimeout(_pendingTimer)`。

---

## App.showBigText 擴充（js/bigtext.js）

```js
App.showBigText({ ja, zh, romaji, lang })
// lang 選填，預設 'ja-JP'；控制 overlay 播音鈕的語言
```

- 既有三個呼叫點（phrases-tab:163、trip-tab:452、translate-tab:284）**零 diff**。
- **每次呼叫都必須重設 `_lang`**（防前次殘留，§2.3）。
- `ja` 欄語意 = 主文字槽（歷史命名）；日→中大字時 `ja` 放中文譯文、`lang: 'zh-TW'`。

### 日→中大字呼叫範例

```js
// 日→中氣泡開大字（主文字 = 中文譯文）
App.showBigText({ ja: zh譯文, lang: 'zh-TW' });

// 中→日氣泡開大字（沿用 Task5 契約）
App.showBigText({ ja: ja譯文, zh: zh原文 });
```

---

## App.showTab wrap 鏈（三層）

Task12 後 wrap 鏈為（外→內）：

```
coupon-viewer.js (O1, 載入最晚)
  → translate-tab.js（Task12 新增）
    → bigtext.js（Task2）
      → app.js 原函式
```

### translate-tab wrap 行為

- **abort 條件**：目標 `id !== 'translate'`（重按當前分頁不中斷錄音）。
- **TTS cancel 條件**：translate 為當前分頁（`!section.hidden`）才 abort/cancel（不誤殺常用句播音）。
- 統一走 `_abortTalk()`：清 60 秒 timer + abort + cancel + 回 idle + UI 復位。

---

## translate-tab.js 對話模式 DOM/class（Frontend CSS 對象）

```
#tab-translate                              ← section（Task1 A1）
  div.translate-mode-seg                   ← segmented control（flex-shrink:0）
    button.translate-mode-btn              ← 「文字」按鈕
    button.translate-mode-btn              ← 「對話」按鈕
    (.translate-mode-btn-active)           ← 作用中按鈕 class
  div.translate-container                  ← 文字模式（Task5 既有，直接 flex 子元素）
    ...（Task5.api.md DOM 不變）
  div.talk-container                       ← 對話模式（Task12 新增，直接 flex 子元素）
    div.talk-lang-bar                      ← 語言列（flex-shrink:0）靜態文字
    div.talk-history                       ← 氣泡歷史（flex:1, overflow-y:auto）
      div.talk-bubble.talk-zh2ja           ← 中→日氣泡（靠右）
      div.talk-bubble.talk-ja2zh           ← 日→中氣泡（靠左）
        div.talk-bubble-orig               ← 原文小字
        div.talk-bubble-trans              ← 譯文大字（≥22px 量級）
        div.talk-bubble-actions
          button.talk-bubble-speak         ← 🔊 重播
          button.talk-bubble-bigtext       ← ⤢ 大字
    div.talk-status                        ← 狀態區（flex-shrink:0）
      div.talk-status-idle                 ← idle 狀態顯示
      div.talk-status-recording            ← 錄音中狀態顯示（脈動動畫位置）
      div.talk-status-processing           ← 辨識中/翻譯中
    div.talk-mic-row                       ← 底部鈕列（flex-shrink:0）
      button.talk-mic-zh                   ← 🎤 中文（我說）
      button.talk-mic-ja                   ← 🎤 日文（對方說）
      (.talk-mic-active)                   ← 錄音中按鈕 class（圖示換 ■、變色）
```

### CSS 施工要點（Frontend）

- `.talk-container`：`flex: 1; min-height: 0; display: flex; flex-direction: column`（貼合 section 高度）。
- `.talk-history`：`flex: 1; overflow-y: auto; min-height: 0`（唯一捲動區）。
- `.talk-lang-bar`、`.talk-status`、`.talk-mic-row`：`flex-shrink: 0`（Task11 U2 紀律）。
- `.translate-mode-seg`：`flex-shrink: 0; min-height: 44px`（觸控目標紅線）。
- 兩顆麥克風鈕：`min-height: 60px; width: 50%`（觸控目標遠大於 44px）。
- 氣泡動作鈕 `min-height: 44px`；譯文大字 `font-size: ≥22px`（硬編碼，不用 `--fs-*`）。
- 文字色用 `--c-accent-text`，不用 `--c-accent`（Task8 對比紀律）。
- 不新增深底 overlay；不引用 `--fs-*`（Task10 紀律）。

---

## localStorage key

| Key | 值 | 說明 |
|-----|-----|------|
| `tokyotrip.translateMode` | `'text'`｜`'talk'`（預設 `'talk'`，壞值 fallback `'talk'`） | 模式記憶；try/catch 降級 |

---

## Frontend 要加的 script 標籤與順序

在 `index.html` 的現有 `api.js` 與 `translate-tab.js` 之間插入 `recorder.js`：

```html
<!-- Task5 功能模組（api 在 translate-tab 之前）-->
<script src="./js/api.js"></script>
<!-- Task12 錄音封裝（api.js 之後、translate-tab.js 之前）-->
<script src="./js/recorder.js"></script>
<script src="./js/translate-tab.js"></script>
```

最終載入順序（局部）：

```
tts.js → bigtext.js → phrases-tab.js → import-data.js → trip-tab.js
  → api.js → recorder.js → translate-tab.js
  → coupon-viewer.js → coupons-tab.js
```
