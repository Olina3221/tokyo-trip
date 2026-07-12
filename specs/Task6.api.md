# Task6.api.md — 拍照 OCR 模組介面契約

> Task6 Backend 交 Frontend 的函式介面說明。
> 供 Frontend 實作 `#tab-camera` UI 結構、樣式、`index.html` 載入行。

---

## 1. App.api.ocr（js/api.js 端點層追加）

```js
App.api.ocr(imageBase64)
// → Promise<string>   辨識出的全文（2xx 且有文字）
//                     resolve ''（2xx 但無文字，非錯誤，比照 speechToText）
// → Promise.reject({ code: App.api.ErrorCode.*, message: string })
```

| 參數 | 型別 | 說明 |
|------|------|------|
| `imageBase64` | string | JPEG raw base64（**不含** `data:image/jpeg;base64,` 前綴） |

**Vision 2xx 內嵌逐圖錯誤**：`responses[0].error` 存在時 → reject `{ code: HTTP_OTHER, message }`.

**ErrorCode 枚舉（與 translate/speechToText 共用，不得更名）**：
`NO_KEY / OFFLINE / HTTP_403 / HTTP_429 / HTTP_OTHER`

---

## 2. camera-tab.js DOM 結構與 class 清單

```
#tab-camera                          ← section（Task1 A1 契約，id 不得改）
  div.camera-container               ← 主容器
    div.camera-lang-bar              ← 語言列（靜態「日文 → 中文」）
    div.camera-viewfinder-area       ← 取景區（flex:1，唯一捲動主區）
      video.camera-video             ← live 預覽（live 模式可見，降級時隱藏）
      div.camera-scan-frame          ← 掃描框四角（live 模式可見，降級時隱藏）
      div.camera-scan-hint           ← 提示文字（live 模式；CSS 靠近掃描框）
      div.camera-fallback-holder     ← 降級佔位（初始 display:none，降級時顯示）
        p.camera-fallback-text       ← 降級說明文字
    div.camera-processing-area       ← 處理中視圖（初始 display:none）
      p.camera-status-text           ← 「辨識中…」／「翻譯中…」
    div.camera-result-area           ← 結果視圖（初始 display:none）
      div.camera-result-card.camera-result-orig-card
        div.camera-result-card-label ← 「原文（日文）」
        div.camera-result-orig-text  ← OCR 結果文字
      div.camera-result-card.camera-result-trans-card
        div.camera-result-card-label ← 「翻譯（中文）」
        div.camera-result-trans-text ← 翻譯結果（較大字級為主體）
      div.camera-result-error        ← 錯誤訊息（初始 display:none）
      button.camera-action-btn.camera-retry-trans-btn  ← 「重試翻譯」（初始 hidden）
      div.camera-result-actions
        button.camera-action-btn.camera-bigtext-orig-btn  ← 「大字（原文）」
        button.camera-action-btn.camera-bigtext-trans-btn ← 「大字（譯文）」
        button.camera-action-btn.camera-speak-btn         ← 「播音」（TTS 不可用時 disabled）
        button.camera-action-btn.camera-copy-orig-btn     ← 「複製原文」
        button.camera-action-btn.camera-copy-trans-btn    ← 「複製譯文」
        button.camera-action-btn.camera-retake-btn        ← 「重拍」
    div.camera-bottom-bar            ← 底部操作列（flex-shrink:0，Task11 U2 紀律）
      button.camera-album-btn        ← 相簿鈕
        span.camera-btn-icon
        span.camera-btn-label
      button.camera-shutter-btn      ← 快門鈕（圓形，直徑≥64px）
    input[type=file][capture=environment]  ← 原生相機，隱藏，JS trigger
    input[type=file]                 ← 相簿，隱藏，JS trigger
    img（隱藏）                       ← EXIF 解碼用，aria-hidden
```

---

## 3. JS 控制的 display 狀態

| 元素 | 預設 | 顯示條件 |
|------|------|---------|
| `.camera-viewfinder-area` | 顯示 | `_view === 'viewfinder'` |
| `.camera-processing-area` | `none` | `_view === 'processing'` |
| `.camera-result-area` | `none` | `_view === 'result'` |
| `.camera-fallback-holder` | `none` | getUserMedia 失敗後（黏性） |
| `video.camera-video` | 顯示 | live 模式（降級後 `none`） |
| `.camera-scan-frame` | 顯示 | live 模式（降級後 `none`） |
| `.camera-scan-hint` | 顯示 | live 模式（降級後 `none`） |
| `.camera-result-error` | `none` | 有錯誤時 |
| `.camera-retry-trans-btn` | `none` | OCR 成功翻譯失敗時 |

---

## 4. 降級路徑（Frontend 必須保證兩個 file input 無條件存在）

**降級觸發**：getUserMedia 失敗或 video.play() 失敗 → `_activateFallback()`  
→ 黏性旗標（session 內不重試）、video/scanFrame/scanHint 隱藏、fallbackHolder 顯示。

降級模式下快門鈕觸發 `_captureInput.click()`（原生相機）；相簿鈕觸發 `_albumInput.click()`。  
**兩個 file input 必須無條件存在於 DOM**——不依賴 live 偵測結果動態建立（SA §3.2-3）。

---

## 5. wrap showTab 第四層

**載入位置**：`translate-tab.js` 之後、`coupon-viewer.js` 之前（`<!-- Task4 功能模組 -->` comment 前）。

```html
<!-- Task5 功能模組 -->
<script src="./js/api.js"></script>
<script src="./js/recorder.js"></script>
<script src="./js/translate-tab.js"></script>
<!-- Task6 OCR 分頁（translate-tab 之後，coupon-viewer 之前）-->
<script src="./js/camera-tab.js"></script>
<!-- Task4 功能模組 -->
<script src="./js/coupon-viewer.js"></script>
<script src="./js/coupons-tab.js"></script>
```

**wrap 鏈執行順序（外→內）**：
```
coupon-viewer  無條件關 overlay（冪等）
  → camera-tab  守門：camera 可見 && id !== 'camera' → 停 track + speak.cancel()
    → translate-tab  守門：translate 可見 && id !== 'translate' → _abortTalk()
      → bigtext  無條件關 overlay（冪等）
        → app.js 原函式
```

---

## 6. 大字呼叫形（SA §7-d 定案）

```js
// 原文大字（ja-only，B3 置中路徑）
App.showBigText({ ja: ocrText });

// 譯文大字（主文字槽放中文，lang='zh-TW'，Task12 契約）
App.showBigText({ ja: translationText, lang: 'zh-TW' });
```

---

## 7. CSS 施工要點（Frontend）

- 前綴 `.camera-*`；全程硬編碼 font-size，**禁用 `--fs-*`**（Task10 紀律：授權僅 `.trip-*`）。
- `.camera-bottom-bar`：`flex-shrink: 0`（Task11 U2 紀律，底部操作列不被壓縮）。
- `.camera-shutter-btn`：直徑 `≥ 64px`；動作鈕 `min-height: 44px`（觸控紅線）。
- 取景區深底文字/邊框：**區域硬編碼色**，不得引用 `--c-bg`/`--c-text` 等全域翻轉變數（Task8 解耦紀律）。
- 不新增 `z-index ≥ 100`（camera 取景為分頁內容非 overlay；唯一 overlay 重用 bigtext=100）。
- `--c-accent-text` 用於文字色；`--c-accent` 用於填充色（Task8 對比紀律）。

---

## 8. 版號與 PRECACHE

- `sw.js CACHE_VERSION = 'v15'`，`js/version.js APP_VERSION = 'v15'`（逐字元相等，QA 機械閘）
- PRECACHE 39 筆（v14 基線 38 + `./js/camera-tab.js`）
- `APP_VERSION_DATE = '07/12'`

---

## 9. 隱私機械判準（QA 可執行）

1. `camera-tab.js` 全檔 `localStorage` grep → 0 hits（注解不計）
2. `camera-tab.js` 全檔 `fetch(` grep → 0 hits
3. `console.log/warn` 引數無 `base64`/圖像變數名
4. `createObjectURL` 與 `revokeObjectURL` 出現次數配對
5. `git status` 無新增 tracked 圖檔
