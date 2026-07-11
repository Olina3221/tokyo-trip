# Task5.api.md — 翻譯模組 + API 呼叫層介面契約

> 供 Task5 Frontend（翻譯分頁 UI/CSS）與 Task6（OCR 重用 api.js）使用。
> 定案後介面簽名不得擅自更改；需異動回報 PM 另開 Task。

---

## ★ A3 改版宣告（廢止 Task1.api.md 舊禁令）

> **Task1.api.md 的 A3 永久禁止項（「js/config.js 不得列入 PRECACHE_URLS」「不得進入動態快取回填」）自 Task5 起全面廢止，以本檔為準。**

Task5 金鑰版控化決策（Olina 拍板）翻轉此不變式：
- `js/config.js` 已納入版控並隨站部署到 GitHub Pages。
- `./js/config.js` 已加入 PRECACHE_URLS（sw.js v10）。
- sw.js fetch handler 的 A3 network-only 特例整段已刪除。
- 金鑰安全改由 Google Cloud Console「HTTP 參照網址限制（olina3221.github.io/*）＋API 限制」保障。

冷 context 讀到 Task1.api.md 的舊 A3 描述時，一律以本節宣告為準，不得依舊禁令操作。

---

## App.api（js/api.js）

### 命名空間

```js
window.App.api   // { ErrorCode, translate }
```

掛在 `window.App.api`；不含 TTS、不碰 DOM/localStorage。

---

### App.api.ErrorCode

```js
App.api.ErrorCode = {
  NO_KEY:     'NO_KEY',      // APP_CONFIG 未定義或 GOOGLE_API_KEY 空
  OFFLINE:    'OFFLINE',     // fetch() 網路失敗（連線拒絕、斷網）
  HTTP_403:   'HTTP_403',    // referer 不符或金鑰未授權（localhost 測試正常情況）
  HTTP_429:   'HTTP_429',    // quota 超量
  HTTP_OTHER: 'HTTP_OTHER',  // 其他 HTTP 錯誤或空翻譯結果
};
```

---

### App.api.translate

```js
App.api.translate(text, source, target)
// → Promise<string>  成功 → 翻譯結果字串
// → Promise.reject({ code: ErrorCode.*, message: string })  失敗
```

| 參數 | 型別 | 說明 |
|------|------|------|
| `text` | string | 原文（非空，由呼叫端保證） |
| `source` | string | BCP-47 語言碼，例 `'zh-TW'` |
| `target` | string | BCP-47 語言碼，例 `'ja'` |

**呼叫細節（Task6 繼承）**：
- 內部固定使用 **POST**（sw.js 只攔 GET；GET 會被 cache-first 回填，金鑰進 cache 索引）。
- URL：`https://translation.googleapis.com/language/translate/v2?key=<GOOGLE_API_KEY>`
- Body：`{ q: text, source, target, format: 'text' }`
- 回應解析：`data.data.translations[0].translatedText`

**使用範例**：

```js
// 中→日
App.api.translate('謝謝', 'zh-TW', 'ja')
  .then(function(result) { console.log(result); })   // 'ありがとう'
  .catch(function(err) { console.error(err.code); }); // 'HTTP_403' 等

// 日→中
App.api.translate('ありがとう', 'ja', 'zh-TW')
  .then(function(result) { console.log(result); });
```

---

### Task6 重用邊界

Task6 要加 `App.api.ocr(imageBase64, mimeType)` 時，直接在 `js/api.js` 的「端點層」段追加。上兩層（金鑰層、傳輸層）完全不動。Cloud Vision `images:annotate` 同為 POST，同一結論：不加 sw.js 排除特例。

---

## translate-tab.js DOM/class 定義（Frontend CSS 對象）

### DOM 結構

```
#tab-translate                              ← App shell（Task1 A1，section 容器）
  div.translate-container                   ← 最外層 wrapper
    div.translate-input-area                ← 輸入區；必須 flex-shrink:0（Task11 紀律）
      div.translate-dir-row                 ← 方向列
        span.translate-dir-label            ← 當前方向文字（例「中文 → 日文」）
        button.translate-dir-toggle         ← 切換方向按鈕
      textarea.translate-textarea           ← 輸入框（font-size ≥16px，iOS 縮放紅線）
      div.translate-char-row                ← 字數列
        span.translate-char-count           ← 已輸入字數（例「42 / 500」）
        span.translate-char-error           ← 超過上限時出現的紅字（JS 控制 display）
      button.translate-btn                  ← 翻譯送出按鈕
    div.translate-result-area               ← 結果區（JS 控制 display:none / ''）
      p.translate-result-text               ← 翻譯結果文字
      div.translate-result-actions          ← 動作鈕列
        button.translate-action-btn .translate-bigtext-btn   ← 大字（僅中→日顯示）
        button.translate-action-btn .translate-speak-btn     ← 播音（僅中→日顯示）
        button.translate-action-btn .translate-copy-btn      ← 複製（雙向皆顯示）
    div.translate-error                     ← 錯誤訊息區（JS 控制 display:none / ''）
```

### CSS 注意事項（Frontend）

- `.translate-input-area`：**必須加 `flex-shrink: 0`**（Task11 教訓：非主捲動區子元素不得被壓縮）。
- `.translate-textarea`：**font-size ≥16px**（iOS 聚焦自動縮放紅線，hardcode，不用 `--fs-*`）。
- 文字顏色用 `--c-accent-text`（非 `--c-accent`），Task8 對比紀律。
- **不得引用 `--fs-*` type scale 變數**（Task10 紀律：僅授權 `.trip-*`）。
- 觸控目標 ≥44px（按鈕 min-height）。
- 顏色走全域 CSS 變數（淺色主題，Task8 已落地）。

### JS 控制的 display 狀態

| 元素 | 預設 | 顯示條件 |
|------|------|---------|
| `.translate-result-area` | none | 翻譯成功後 |
| `.translate-error` | none | 翻譯失敗後 |
| `.translate-char-error` | none | 輸入超過 500 字 |
| `.translate-bigtext-btn` | （依方向）| 中→日時顯示，日→中時 display:none |
| `.translate-speak-btn` | （依方向）| 中→日時顯示，日→中時 display:none |

---

## localStorage key

| Key | 值 | 說明 |
|-----|-----|------|
| `tokyotrip.translateDir` | `'zh2ja'`（預設）或 `'ja2zh'` | 翻譯方向偏好；壞值 fallback `zh2ja`；讀寫包 try/catch（私密瀏覽降級） |

**輸入上限計法**：`textarea.value.length`（UTF-16 code units，≤500 才啟用翻譯鈕）。

---

## Frontend 要加的 script 標籤與順序

在 `index.html` 的 `<!-- Task5-6 功能模組插這裡 -->` 佔位 comment 之後、`coupon-viewer.js` 之前插入：

```html
<!-- Task5 功能模組（api 在 translate-tab 之前；皆在 tts/bigtext 之後）-->
<script src="./js/api.js"></script>
<script src="./js/translate-tab.js"></script>
```

最終載入順序（局部）：

```
tts.js → bigtext.js → phrases-tab.js → import-data.js → trip-tab.js
  → api.js → translate-tab.js                            ← Task5 新增
  → coupon-viewer.js → coupons-tab.js
```

---

## 五種錯誤的使用者訊息（文案固定，frontend 可潤飾排版）

| 錯誤碼 | translate-tab.js 固定文案 |
|--------|--------------------------|
| `NO_KEY` | 「尚未設定 Google API 金鑰，請見 README.md」 |
| `OFFLINE` | 「翻譯需要網路連線」 |
| `HTTP_403` | 「金鑰未授權此網址（本機測試屬正常，請在正式網址使用）」 |
| `HTTP_429` | 「翻譯額度暫時用盡，稍後再試」 |
| `HTTP_OTHER` | 「翻譯失敗，請重試」 |
